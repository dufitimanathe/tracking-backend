import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { DataSource, Repository } from 'typeorm';
import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import {
  ErrorCode,
  RiderAvailabilityStatus,
  TransportRequestStatus,
  TripEventType,
  TripStatus,
} from '../common/enums';
import { Rider } from '../riders/entities/rider.entity';
import { TransportRequest } from '../transport-requests/entities/transport-request.entity';
import { TripEventsService } from '../trip-events/trip-events.service';
import { Trip } from '../trips/entities/trip.entity';
import { assertTransition } from '../trips/trip-state-machine';
import { REDIS_CLIENT } from '../common/redis/redis.constants';
import {
  DISPATCH_QUEUE,
  DISPATCH_TIMEOUT_JOB,
  dispatchCandidatesKey,
} from './dispatch.constants';
import { RiderMatchCandidate, RiderMatchingService } from './rider-matching.service';

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(TransportRequest)
    private readonly transportRequestRepository: Repository<TransportRequest>,
    private readonly riderMatchingService: RiderMatchingService,
    private readonly tripEventsService: TripEventsService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @InjectQueue(DISPATCH_QUEUE)
    private readonly dispatchQueue: Queue,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async startAutomaticDispatch(tripId: string): Promise<void> {
    const trip = await this.tripRepository.findOne({ where: { id: tripId } });
    if (!trip) {
      throw new NotFoundDomainException('Trip not found.');
    }

    if (trip.status !== TripStatus.SEARCHING_RIDER) {
      return;
    }

    const radiusMeters = this.configService.get<number>(
      'app.ops.riderSearchRadiusMeters',
      { infer: true },
    )!;

    const candidates = await this.riderMatchingService.findNearbyAvailableRiders(
      trip.companyId,
      trip.pickupLatitude,
      trip.pickupLongitude,
      radiusMeters,
    );

    await this.redis.set(
      dispatchCandidatesKey(tripId),
      JSON.stringify(candidates),
      'EX',
      3600,
    );

    if (candidates.length === 0) {
      await this.markNoRiderAvailable(trip);
      return;
    }

    await this.offerToCandidate(trip, candidates[0], candidates.slice(1));
  }

  async handleOfferTimeout(tripId: string, riderId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const tripRepo = manager.getRepository(Trip);
      const riderRepo = manager.getRepository(Rider);

      const trip = await tripRepo.findOne({
        where: { id: tripId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!trip) {
        return;
      }

      if (trip.status !== TripStatus.RIDER_ASSIGNED || trip.riderId !== riderId) {
        return;
      }

      await this.tripEventsService.appendEvent(
        trip.companyId,
        trip.id,
        TripEventType.OFFER_EXPIRED,
        riderId,
        { riderId },
      );

      const rider = await riderRepo.findOne({ where: { id: riderId } });
      if (rider) {
        rider.availabilityStatus = RiderAvailabilityStatus.AVAILABLE;
        await riderRepo.save(rider);
      }

      assertTransition(trip.status, TripStatus.SEARCHING_RIDER);
      trip.status = TripStatus.SEARCHING_RIDER;
      trip.riderId = null;
      trip.motorcycleId = null;
      trip.assignedAt = null;
      await tripRepo.save(trip);
    });

    const remaining = await this.popCandidateQueue(tripId);
    const trip = await this.tripRepository.findOne({ where: { id: tripId } });
    if (!trip || trip.status !== TripStatus.SEARCHING_RIDER) {
      return;
    }

    if (remaining.length === 0) {
      await this.markNoRiderAvailable(trip);
      return;
    }

    await this.offerToCandidate(trip, remaining[0], remaining.slice(1));
  }

  async manualAssign(
    companyId: string,
    tripId: string,
    riderId: string,
    motorcycleId?: string,
    reason?: string,
    actorId?: string,
  ): Promise<Trip> {
    return this.dataSource.transaction(async (manager) => {
      const tripRepo = manager.getRepository(Trip);
      const riderRepo = manager.getRepository(Rider);
      const requestRepo = manager.getRepository(TransportRequest);

      const trip = await tripRepo.findOne({
        where: { id: tripId, companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!trip) {
        throw new NotFoundDomainException('Trip not found.');
      }

      if (
        trip.status !== TripStatus.SEARCHING_RIDER &&
        trip.status !== TripStatus.RIDER_ASSIGNED
      ) {
        throw new ConflictDomainException(
          ErrorCode.TRIP_INVALID_STATE,
          'Trip cannot be manually assigned in its current state.',
        );
      }

      const rider = await riderRepo.findOne({
        where: { id: riderId, companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!rider) {
        throw new NotFoundDomainException('Rider not found.');
      }

      if (rider.availabilityStatus !== RiderAvailabilityStatus.AVAILABLE) {
        throw new ConflictDomainException(
          ErrorCode.RIDER_NOT_AVAILABLE,
          'Rider is not available for assignment.',
        );
      }

      if (trip.riderId && trip.riderId !== riderId) {
        const previousRider = await riderRepo.findOne({ where: { id: trip.riderId } });
        if (previousRider) {
          previousRider.availabilityStatus = RiderAvailabilityStatus.AVAILABLE;
          await riderRepo.save(previousRider);
        }
      }

      if (
        trip.status === TripStatus.RIDER_ASSIGNED &&
        trip.riderId === riderId
      ) {
        return trip;
      }

      if (trip.status === TripStatus.RIDER_ASSIGNED) {
        assertTransition(trip.status, TripStatus.SEARCHING_RIDER);
        trip.status = TripStatus.SEARCHING_RIDER;
      }

      assertTransition(trip.status, TripStatus.RIDER_ASSIGNED);
      trip.status = TripStatus.RIDER_ASSIGNED;
      trip.riderId = riderId;
      trip.motorcycleId = motorcycleId ?? trip.motorcycleId ?? null;
      trip.assignedAt = new Date();
      await tripRepo.save(trip);

      rider.availabilityStatus = RiderAvailabilityStatus.ASSIGNED;
      await riderRepo.save(rider);

      const request = await requestRepo.findOne({
        where: { id: trip.transportRequestId, companyId },
      });
      if (request && request.status === TransportRequestStatus.DISPATCHING) {
        request.status = TransportRequestStatus.ASSIGNED;
        await requestRepo.save(request);
      }

      await this.tripEventsService.appendEvent(
        companyId,
        trip.id,
        TripEventType.RIDER_ASSIGNED,
        actorId,
        { riderId, motorcycleId: trip.motorcycleId, reason, manual: true },
      );

      await this.scheduleOfferTimeout(trip.id, riderId);
      return trip;
    });
  }

  async reassign(
    companyId: string,
    tripId: string,
    riderId: string,
    motorcycleId?: string,
    reason?: string,
    actorId?: string,
  ): Promise<Trip> {
    const trip = await this.manualAssign(
      companyId,
      tripId,
      riderId,
      motorcycleId,
      reason,
      actorId,
    );

    await this.tripEventsService.appendEvent(
      companyId,
      trip.id,
      TripEventType.RIDER_REASSIGNED,
      actorId,
      { riderId, motorcycleId, reason },
    );

    return trip;
  }

  private async offerToCandidate(
    trip: Trip,
    candidate: RiderMatchCandidate,
    remainingCandidates: RiderMatchCandidate[],
  ): Promise<void> {
    await this.redis.set(
      dispatchCandidatesKey(trip.id),
      JSON.stringify(remainingCandidates),
      'EX',
      3600,
    );

    await this.dataSource.transaction(async (manager) => {
      const tripRepo = manager.getRepository(Trip);
      const riderRepo = manager.getRepository(Rider);
      const requestRepo = manager.getRepository(TransportRequest);

      const lockedTrip = await tripRepo.findOne({
        where: { id: trip.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedTrip || lockedTrip.status !== TripStatus.SEARCHING_RIDER) {
        return;
      }

      const rider = await riderRepo.findOne({
        where: { id: candidate.riderId, companyId: trip.companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!rider || rider.availabilityStatus !== RiderAvailabilityStatus.AVAILABLE) {
        return;
      }

      assertTransition(lockedTrip.status, TripStatus.RIDER_ASSIGNED);
      lockedTrip.status = TripStatus.RIDER_ASSIGNED;
      lockedTrip.riderId = candidate.riderId;
      lockedTrip.motorcycleId = candidate.motorcycleId;
      lockedTrip.assignedAt = new Date();
      await tripRepo.save(lockedTrip);

      rider.availabilityStatus = RiderAvailabilityStatus.ASSIGNED;
      await riderRepo.save(rider);

      const request = await requestRepo.findOne({
        where: { id: lockedTrip.transportRequestId, companyId: trip.companyId },
      });
      if (request && request.status === TransportRequestStatus.DISPATCHING) {
        request.status = TransportRequestStatus.ASSIGNED;
        await requestRepo.save(request);
      }

      await this.tripEventsService.appendEvent(
        trip.companyId,
        trip.id,
        TripEventType.RIDER_ASSIGNED,
        candidate.riderId,
        {
          riderId: candidate.riderId,
          motorcycleId: candidate.motorcycleId,
          distanceMeters: candidate.distanceMeters,
        },
      );
    });

    await this.scheduleOfferTimeout(trip.id, candidate.riderId);
  }

  private async markNoRiderAvailable(trip: Trip): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const tripRepo = manager.getRepository(Trip);
      const requestRepo = manager.getRepository(TransportRequest);

      const lockedTrip = await tripRepo.findOne({
        where: { id: trip.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedTrip || lockedTrip.status !== TripStatus.SEARCHING_RIDER) {
        return;
      }

      assertTransition(lockedTrip.status, TripStatus.NO_RIDER_AVAILABLE);
      lockedTrip.status = TripStatus.NO_RIDER_AVAILABLE;
      await tripRepo.save(lockedTrip);

      const request = await requestRepo.findOne({
        where: { id: lockedTrip.transportRequestId, companyId: trip.companyId },
      });
      if (request) {
        request.status = TransportRequestStatus.CANCELLED;
        await requestRepo.save(request);
      }
    });

    await this.redis.del(dispatchCandidatesKey(trip.id));
  }

  private async scheduleOfferTimeout(tripId: string, riderId: string): Promise<void> {
    const timeoutSeconds = this.configService.get<number>(
      'app.ops.dispatchOfferTimeoutSeconds',
      { infer: true },
    )!;

    await this.dispatchQueue.add(
      DISPATCH_TIMEOUT_JOB,
      { tripId, riderId },
      {
        jobId: `${tripId}:${riderId}`,
        delay: timeoutSeconds * 1000,
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }

  private async popCandidateQueue(tripId: string): Promise<RiderMatchCandidate[]> {
    const raw = await this.redis.get(dispatchCandidatesKey(tripId));
    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as RiderMatchCandidate[];
    } catch (error) {
      this.logger.warn(`Invalid candidate queue for trip ${tripId}: ${String(error)}`);
      return [];
    }
  }
}
