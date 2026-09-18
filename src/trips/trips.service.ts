import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { getSkipTake } from '../common/dto/pagination.dto';
import {
  ConflictDomainException,
  DomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import {
  ErrorCode,
  MotorcycleTrackingStatus,
  NotificationType,
  RiderAvailabilityStatus,
  TransportRequestStatus,
  TripEventType,
  TripStatus,
  UserRole,
} from '../common/enums';
import { BillingService } from '../billing/billing.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { Employee } from '../employees/entities/employee.entity';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Rider } from '../riders/entities/rider.entity';
import { TransportRequest } from '../transport-requests/entities/transport-request.entity';
import { TripEventsService } from '../trip-events/trip-events.service';
import { User } from '../users/entities/user.entity';
import { AssignTripDto } from './dto/assign-trip.dto';
import { CancelTripDto } from './dto/cancel-trip.dto';
import { TripQueryDto } from './dto/trip-query.dto';
import { TripResponseDto } from './dto/trip-response.dto';
import { Trip } from './entities/trip.entity';
import { assertTransition, isTerminalStatus } from './trip-state-machine';

const ACTIVE_TRIP_STATUSES: TripStatus[] = [
  TripStatus.IN_PROGRESS,
  TripStatus.RIDER_TO_PICKUP,
  TripStatus.RIDER_ARRIVED,
  TripStatus.RIDER_ACCEPTED,
  TripStatus.RIDER_ASSIGNED,
];

@Injectable()
export class TripsService {
  private static readonly SORT_FIELDS = new Set(['createdAt', 'status', 'assignedAt']);

  constructor(
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(Motorcycle)
    private readonly motorcycleRepository: Repository<Motorcycle>,
    @InjectRepository(TransportRequest)
    private readonly transportRequestRepository: Repository<TransportRequest>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly tripEventsService: TripEventsService,
    private readonly dispatchService: DispatchService,
    private readonly billingService: BillingService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(
    companyId: string,
    query: TripQueryDto,
  ): Promise<{ items: TripResponseDto[]; total: number }> {
    const { skip, take } = getSkipTake(query.page, query.limit);
    const qb = this.tripRepository
      .createQueryBuilder('trip')
      .where('trip.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('trip.status = :status', { status: query.status });
    }

    if (query.riderId) {
      qb.andWhere('trip.riderId = :riderId', { riderId: query.riderId });
    }

    if (query.motorcycleId) {
      qb.andWhere('trip.motorcycleId = :motorcycleId', {
        motorcycleId: query.motorcycleId,
      });
    }

    const { field, order } = this.parseSort(query.sort);
    qb.orderBy(`trip.${field}`, order);

    const [items, total] = await qb.skip(skip).take(take).getManyAndCount();

    return {
      items: await this.toResponseDtos(items),
      total,
    };
  }

  async findOne(companyId: string, tripId: string): Promise<TripResponseDto> {
    const trip = await this.findByIdOrFail(companyId, tripId);
    const [dto] = await this.toResponseDtos([trip]);
    return dto;
  }

  async findByIdOrFail(companyId: string, tripId: string): Promise<Trip> {
    const trip = await this.tripRepository.findOne({
      where: { id: tripId, companyId },
    });

    if (!trip) {
      throw new NotFoundDomainException('Trip not found.');
    }

    return trip;
  }

  async findActiveForMotorcycle(motorcycleId: string, companyId: string): Promise<Trip | null> {
    return this.tripRepository.findOne({
      where: {
        motorcycleId,
        companyId,
        status: In(ACTIVE_TRIP_STATUSES),
      },
      order: { updatedAt: 'DESC' },
    });
  }

  async countActiveTrips(companyId: string): Promise<number> {
    return this.tripRepository.count({
      where: {
        companyId,
        status: In(ACTIVE_TRIP_STATUSES),
      },
    });
  }

  async countCompletedToday(companyId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return this.tripRepository
      .createQueryBuilder('trip')
      .where('trip.companyId = :companyId', { companyId })
      .andWhere('trip.status = :status', { status: TripStatus.COMPLETED })
      .andWhere('trip.completedAt >= :startOfDay', { startOfDay })
      .getCount();
  }

  async accept(companyId: string, tripId: string, actor: AuthUser): Promise<TripResponseDto> {
    const rider = await this.getRiderForActor(companyId, actor.id);

    const trip = await this.dataSource.transaction(async (manager) => {
      const tripRepo = manager.getRepository(Trip);
      const riderRepo = manager.getRepository(Rider);

      const lockedTrip = await tripRepo.findOne({
        where: { id: tripId, companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedTrip) {
        throw new NotFoundDomainException('Trip not found.');
      }

      if (
        lockedTrip.status !== TripStatus.RIDER_ASSIGNED ||
        lockedTrip.riderId !== rider.id
      ) {
        throw new ConflictDomainException(
          ErrorCode.TRIP_INVALID_STATE,
          'Trip is not assigned to this rider.',
        );
      }

      assertTransition(lockedTrip.status, TripStatus.RIDER_ACCEPTED);
      lockedTrip.status = TripStatus.RIDER_ACCEPTED;
      lockedTrip.acceptedAt = new Date();
      assertTransition(lockedTrip.status, TripStatus.RIDER_TO_PICKUP);
      lockedTrip.status = TripStatus.RIDER_TO_PICKUP;
      await tripRepo.save(lockedTrip);

      const lockedRider = await riderRepo.findOne({
        where: { id: rider.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (lockedRider) {
        lockedRider.availabilityStatus = RiderAvailabilityStatus.TO_PICKUP;
        await riderRepo.save(lockedRider);
      }

      await this.tripEventsService.appendEvent(
        companyId,
        lockedTrip.id,
        TripEventType.RIDER_ACCEPTED,
        actor.id,
        { riderId: rider.id },
      );

      return lockedTrip;
    });

    await this.notifyRiderTripUpdate(trip, 'Trip accepted');
    return TripResponseDto.fromEntity(trip);
  }

  async decline(companyId: string, tripId: string, actor: AuthUser): Promise<TripResponseDto> {
    const rider = await this.getRiderForActor(companyId, actor.id);

    await this.dataSource.transaction(async (manager) => {
      const tripRepo = manager.getRepository(Trip);
      const riderRepo = manager.getRepository(Rider);

      const lockedTrip = await tripRepo.findOne({
        where: { id: tripId, companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedTrip) {
        throw new NotFoundDomainException('Trip not found.');
      }

      if (
        lockedTrip.status !== TripStatus.RIDER_ASSIGNED ||
        lockedTrip.riderId !== rider.id
      ) {
        throw new ConflictDomainException(
          ErrorCode.TRIP_INVALID_STATE,
          'Trip is not assigned to this rider.',
        );
      }

      await this.tripEventsService.appendEvent(
        companyId,
        lockedTrip.id,
        TripEventType.RIDER_DECLINED,
        actor.id,
        { riderId: rider.id },
      );

      const lockedRider = await riderRepo.findOne({
        where: { id: rider.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (lockedRider) {
        lockedRider.availabilityStatus = RiderAvailabilityStatus.AVAILABLE;
        await riderRepo.save(lockedRider);
      }

      assertTransition(lockedTrip.status, TripStatus.SEARCHING_RIDER);
      lockedTrip.status = TripStatus.SEARCHING_RIDER;
      lockedTrip.riderId = null;
      lockedTrip.motorcycleId = null;
      lockedTrip.assignedAt = null;
      lockedTrip.acceptedAt = null;
      await tripRepo.save(lockedTrip);
    });

    await this.dispatchService.startAutomaticDispatch(tripId);
    const trip = await this.findByIdOrFail(companyId, tripId);
    return TripResponseDto.fromEntity(trip);
  }

  async arrive(companyId: string, tripId: string, actor: AuthUser): Promise<TripResponseDto> {
    const rider = await this.getRiderForActor(companyId, actor.id);

    const trip = await this.dataSource.transaction(async (manager) => {
      const tripRepo = manager.getRepository(Trip);
      const riderRepo = manager.getRepository(Rider);

      const lockedTrip = await this.getLockedTripForRider(
        tripRepo,
        companyId,
        tripId,
        rider.id,
        TripStatus.RIDER_TO_PICKUP,
      );

      assertTransition(lockedTrip.status, TripStatus.RIDER_ARRIVED);
      lockedTrip.status = TripStatus.RIDER_ARRIVED;
      lockedTrip.arrivedAtPickupAt = new Date();
      await tripRepo.save(lockedTrip);

      const lockedRider = await riderRepo.findOne({
        where: { id: rider.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (lockedRider) {
        lockedRider.availabilityStatus = RiderAvailabilityStatus.WAITING_CUSTOMER;
        await riderRepo.save(lockedRider);
      }

      await this.tripEventsService.appendEvent(
        companyId,
        lockedTrip.id,
        TripEventType.RIDER_ARRIVED,
        actor.id,
      );

      return lockedTrip;
    });

    return TripResponseDto.fromEntity(trip);
  }

  async start(companyId: string, tripId: string, actor: AuthUser): Promise<TripResponseDto> {
    const rider = await this.getRiderForActor(companyId, actor.id);

    const trip = await this.dataSource.transaction(async (manager) => {
      const tripRepo = manager.getRepository(Trip);
      const riderRepo = manager.getRepository(Rider);

      const lockedTrip = await this.getLockedTripForRider(
        tripRepo,
        companyId,
        tripId,
        rider.id,
        TripStatus.RIDER_ARRIVED,
      );

      assertTransition(lockedTrip.status, TripStatus.IN_PROGRESS);
      lockedTrip.status = TripStatus.IN_PROGRESS;
      lockedTrip.startedAt = new Date();
      await tripRepo.save(lockedTrip);

      const lockedRider = await riderRepo.findOne({
        where: { id: rider.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (lockedRider) {
        lockedRider.availabilityStatus = RiderAvailabilityStatus.ON_TRIP;
        await riderRepo.save(lockedRider);
      }

      await this.tripEventsService.appendEvent(
        companyId,
        lockedTrip.id,
        TripEventType.TRIP_STARTED,
        actor.id,
      );

      return lockedTrip;
    });

    return TripResponseDto.fromEntity(trip);
  }

  async complete(companyId: string, tripId: string, actor: AuthUser): Promise<TripResponseDto> {
    const rider = await this.getRiderForActor(companyId, actor.id);

    const trip = await this.dataSource.transaction(async (manager) => {
      const tripRepo = manager.getRepository(Trip);
      const riderRepo = manager.getRepository(Rider);
      const motorcycleRepo = manager.getRepository(Motorcycle);
      const requestRepo = manager.getRepository(TransportRequest);

      const lockedTrip = await this.getLockedTripForRider(
        tripRepo,
        companyId,
        tripId,
        rider.id,
        TripStatus.IN_PROGRESS,
      );

      assertTransition(lockedTrip.status, TripStatus.COMPLETED);
      lockedTrip.status = TripStatus.COMPLETED;
      lockedTrip.completedAt = new Date();

      if (!lockedTrip.actualDistanceKm && lockedTrip.estimatedDistanceKm) {
        lockedTrip.actualDistanceKm = lockedTrip.estimatedDistanceKm;
      }

      lockedTrip.finalPrice = lockedTrip.estimatedPrice ?? lockedTrip.finalPrice ?? null;
      await tripRepo.save(lockedTrip);

      const request = await requestRepo.findOne({
        where: { id: lockedTrip.transportRequestId, companyId },
      });
      if (request) {
        request.status = TransportRequestStatus.COMPLETED;
        await requestRepo.save(request);
      }

      const lockedRider = await riderRepo.findOne({
        where: { id: rider.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (lockedRider) {
        lockedRider.availabilityStatus = RiderAvailabilityStatus.AVAILABLE;
        await riderRepo.save(lockedRider);
      }

      if (lockedTrip.motorcycleId) {
        const motorcycle = await motorcycleRepo.findOne({
          where: { id: lockedTrip.motorcycleId, companyId },
        });
        if (motorcycle) {
          motorcycle.trackingStatus = MotorcycleTrackingStatus.PARKED;
          await motorcycleRepo.save(motorcycle);
        }
      }

      await this.tripEventsService.appendEvent(
        companyId,
        lockedTrip.id,
        TripEventType.TRIP_COMPLETED,
        actor.id,
      );

      return lockedTrip;
    });

    await this.billingService.createForCompletedTrip(trip.id);
    await this.notifyRiderTripUpdate(trip, 'Trip completed', NotificationType.TRIP_COMPLETED);

    return TripResponseDto.fromEntity(trip);
  }

  async assign(
    companyId: string,
    tripId: string,
    dto: AssignTripDto,
    actor: AuthUser,
  ): Promise<TripResponseDto> {
    const trip = await this.dispatchService.manualAssign(
      companyId,
      tripId,
      dto.riderId,
      dto.motorcycleId,
      dto.reason,
      actor.id,
    );
    return TripResponseDto.fromEntity(trip);
  }

  async reassign(
    companyId: string,
    tripId: string,
    dto: AssignTripDto,
    actor: AuthUser,
  ): Promise<TripResponseDto> {
    const trip = await this.dispatchService.reassign(
      companyId,
      tripId,
      dto.riderId,
      dto.motorcycleId,
      dto.reason,
      actor.id,
    );
    return TripResponseDto.fromEntity(trip);
  }

  async cancel(
    companyId: string,
    tripId: string,
    dto: CancelTripDto,
    actor: AuthUser,
    actorRole: UserRole,
  ): Promise<TripResponseDto> {
    const trip = await this.dataSource.transaction(async (manager) => {
      const tripRepo = manager.getRepository(Trip);
      const riderRepo = manager.getRepository(Rider);
      const requestRepo = manager.getRepository(TransportRequest);

      const lockedTrip = await tripRepo.findOne({
        where: { id: tripId, companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedTrip) {
        throw new NotFoundDomainException('Trip not found.');
      }

      if (isTerminalStatus(lockedTrip.status)) {
        throw new ConflictDomainException(
          ErrorCode.TRIP_ALREADY_COMPLETED,
          'Trip cannot be cancelled in its current state.',
        );
      }

      assertTransition(lockedTrip.status, TripStatus.CANCELLED);
      lockedTrip.status = TripStatus.CANCELLED;
      lockedTrip.cancelledAt = new Date();
      await tripRepo.save(lockedTrip);

      if (lockedTrip.riderId) {
        const rider = await riderRepo.findOne({ where: { id: lockedTrip.riderId } });
        if (rider) {
          rider.availabilityStatus = RiderAvailabilityStatus.AVAILABLE;
          await riderRepo.save(rider);
        }
      }

      const request = await requestRepo.findOne({
        where: { id: lockedTrip.transportRequestId, companyId },
      });
      if (request && request.status !== TransportRequestStatus.COMPLETED) {
        request.status = TransportRequestStatus.CANCELLED;
        await requestRepo.save(request);
      }

      await this.tripEventsService.appendEvent(
        companyId,
        lockedTrip.id,
        TripEventType.TRIP_CANCELLED,
        actor.id,
        { reason: dto.reason, actorRole },
      );

      return lockedTrip;
    });

    return TripResponseDto.fromEntity(trip);
  }

  async resolveRiderId(companyId: string, userId: string): Promise<string> {
    const rider = await this.getRiderForActor(companyId, userId);
    return rider.id;
  }

  private async getRiderForActor(companyId: string, userId: string): Promise<Rider> {
    const rider = await this.riderRepository.findOne({
      where: { companyId, userId },
    });

    if (!rider) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'Rider profile not found for this user.',
        HttpStatus.FORBIDDEN,
      );
    }

    return rider;
  }

  private async getLockedTripForRider(
    tripRepo: Repository<Trip>,
    companyId: string,
    tripId: string,
    riderId: string,
    expectedStatus: TripStatus,
  ): Promise<Trip> {
    const lockedTrip = await tripRepo.findOne({
      where: { id: tripId, companyId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!lockedTrip) {
      throw new NotFoundDomainException('Trip not found.');
    }

    if (lockedTrip.riderId !== riderId || lockedTrip.status !== expectedStatus) {
      throw new ConflictDomainException(
        ErrorCode.TRIP_INVALID_STATE,
        'Trip is not in the expected state for this rider action.',
      );
    }

    return lockedTrip;
  }

  private async toResponseDtos(trips: Trip[]): Promise<TripResponseDto[]> {
    if (trips.length === 0) {
      return [];
    }

    const employeeIds = [...new Set(trips.map((t) => t.employeeId))];
    const riderIds = [...new Set(trips.map((t) => t.riderId).filter(Boolean))] as string[];
    const motorcycleIds = [
      ...new Set(trips.map((t) => t.motorcycleId).filter(Boolean)),
    ] as string[];

    const [employees, riders, motorcycles] = await Promise.all([
      this.employeeRepository.find({ where: { id: In(employeeIds) } }),
      riderIds.length
        ? this.riderRepository.find({ where: { id: In(riderIds) } })
        : Promise.resolve([] as Rider[]),
      motorcycleIds.length
        ? this.motorcycleRepository.find({ where: { id: In(motorcycleIds) } })
        : Promise.resolve([] as Motorcycle[]),
    ]);

    const userIds = riders.map((r) => r.userId);
    const users = userIds.length
      ? await this.userRepository.find({ where: { id: In(userIds) } })
      : [];

    const employeeMap = new Map(employees.map((e) => [e.id, e.fullName]));
    const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    const riderMap = new Map(
      riders.map((r) => [r.id, userMap.get(r.userId) ?? null]),
    );
    const plateMap = new Map(motorcycles.map((m) => [m.id, m.plateNumber]));

    return trips.map((trip) =>
      TripResponseDto.fromEntity(trip, {
        employeeName: employeeMap.get(trip.employeeId) ?? null,
        riderName: trip.riderId ? (riderMap.get(trip.riderId) ?? null) : null,
        motorcyclePlate: trip.motorcycleId
          ? (plateMap.get(trip.motorcycleId) ?? null)
          : null,
      }),
    );
  }

  private parseSort(sort?: string): { field: string; order: 'ASC' | 'DESC' } {
    const [rawField, rawOrder] = (sort ?? 'createdAt:DESC').split(':');
    const field = TripsService.SORT_FIELDS.has(rawField) ? rawField : 'createdAt';
    const order = rawOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    return { field, order };
  }

  private async notifyRiderTripUpdate(
    trip: Trip,
    message: string,
    type: NotificationType = NotificationType.TRIP_UPDATED,
  ): Promise<void> {
    if (!trip.riderId) {
      return;
    }

    const rider = await this.riderRepository.findOne({ where: { id: trip.riderId } });
    if (!rider) {
      return;
    }

    await this.notificationsService.create({
      companyId: trip.companyId,
      userId: rider.userId,
      type,
      title: 'Trip update',
      message,
      relatedEntityType: 'trip',
      relatedEntityId: trip.id,
    });
  }
}
