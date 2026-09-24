import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { DataSource, In, Not, Repository } from 'typeorm';
import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import {
  AssignmentMethod,
  ErrorCode,
  RiderAvailabilityStatus,
  RiderStatus,
  MotorcycleStatus,
  TransportRequestStatus,
  TripEventType,
  TripStatus,
} from '../common/enums';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { Rider } from '../riders/entities/rider.entity';
import { RiderMotorcycleAssignment } from '../rider-motorcycle-assignments/entities/rider-motorcycle-assignment.entity';
import { TransportRequest } from '../transport-requests/entities/transport-request.entity';
import { TripEventsService } from '../trip-events/trip-events.service';
import { Trip } from '../trips/entities/trip.entity';
import { assertTransition } from '../trips/trip-state-machine';
import { REDIS_CLIENT } from '../common/redis/redis.constants';
import { User } from '../users/entities/user.entity';
import { DISPATCH_QUEUE, DISPATCH_TIMEOUT_JOB, dispatchCandidatesKey } from './dispatch.constants';
import { AssignmentAttempt } from './entities/assignment-attempt.entity';
import { RiderMatchCandidate, RiderMatchingService } from './rider-matching.service';
import { WhatsAppStatusNotifierService } from '../whatsapp/whatsapp-status-notifier.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface AssignmentCandidateDto {
  rank: number;
  riderId: string;
  motorcycleId: string;
  riderName: string;
  riderPhone: string;
  plateNumber: string;
  distanceMeters?: number;
  durationSeconds?: number;
  etaMinutes?: number;
  latitude?: number;
  longitude?: number;
  locationAgeSeconds?: number;
  recommended: boolean;
  locationStale: boolean;
}

export interface AssignmentRecommendationsDto {
  tripId: string;
  method: AssignmentMethod;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  recommendedRiderId?: string;
  candidates: AssignmentCandidateDto[];
  searchRadiusMeters: number;
  automaticLocationMaxAgeSeconds: number;
}

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
    @InjectRepository(AssignmentAttempt)
    private readonly assignmentAttemptRepository: Repository<AssignmentAttempt>,
    @InjectRepository(Motorcycle)
    private readonly motorcycleRepository: Repository<Motorcycle>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly riderMatchingService: RiderMatchingService,
    private readonly tripEventsService: TripEventsService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @InjectQueue(DISPATCH_QUEUE)
    private readonly dispatchQueue: Queue,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly whatsappStatusNotifier: WhatsAppStatusNotifierService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Include every eligible rider; old or missing GPS must not prevent manual dispatch.
   */
  async getAssignmentRecommendations(
    companyId: string,
    tripId: string,
  ): Promise<AssignmentRecommendationsDto> {
    const trip = await this.tripRepository.findOne({ where: { id: tripId, companyId } });
    if (!trip) {
      throw new NotFoundDomainException('Trip not found.');
    }

    const ranked = await this.riderMatchingService.findManualCandidates(
      companyId,
      trip.pickupLatitude,
      trip.pickupLongitude,
    );

    const riderIds = ranked.map((c) => c.riderId);
    const motorcycleIds = ranked.map((c) => c.motorcycleId);

    const [riders, motorcycles] = await Promise.all([
      riderIds.length
        ? this.riderRepository.find({ where: { id: In(riderIds), companyId } })
        : Promise.resolve([] as Rider[]),
      motorcycleIds.length
        ? this.motorcycleRepository.find({ where: { id: In(motorcycleIds), companyId } })
        : Promise.resolve([] as Motorcycle[]),
    ]);

    const userIds = riders.map((r) => r.userId).filter(Boolean) as string[];
    const users = userIds.length
      ? await this.userRepository.find({ where: { id: In(userIds) } })
      : [];

    const riderMap = new Map(riders.map((r) => [r.id, r]));
    const motoMap = new Map(motorcycles.map((m) => [m.id, m]));
    const userMap = new Map(users.map((u) => [u.id, u]));

    const candidates: AssignmentCandidateDto[] = ranked.map((c, index) => {
      const rider = riderMap.get(c.riderId);
      const user = rider?.userId ? userMap.get(rider.userId) : undefined;
      const moto = motoMap.get(c.motorcycleId);
      const riderName = user
        ? `${user.firstName} ${user.lastName}`.trim()
        : (rider?.phone ?? 'Rider');
      return {
        rank: index + 1,
        riderId: c.riderId,
        motorcycleId: c.motorcycleId,
        riderName,
        riderPhone: rider?.phone ?? '',
        plateNumber: moto?.plateNumber ?? '',
        distanceMeters: c.distanceMeters == null ? undefined : Math.round(c.distanceMeters),
        durationSeconds: c.durationSeconds,
        etaMinutes:
          c.durationSeconds != null ? Math.max(1, Math.round(c.durationSeconds / 60)) : undefined,
        latitude: c.latitude,
        longitude: c.longitude,
        locationAgeSeconds: c.locationAgeSeconds,
        recommended: index === 0 && c.distanceMeters != null,
        locationStale: false,
      };
    });

    return {
      tripId: trip.id,
      method: AssignmentMethod.MANUAL,
      pickupAddress: trip.pickupAddress,
      pickupLatitude: trip.pickupLatitude,
      pickupLongitude: trip.pickupLongitude,
      recommendedRiderId: candidates.find((c) => c.recommended)?.riderId,
      candidates,
      searchRadiusMeters: 0,
      automaticLocationMaxAgeSeconds: 0,
    };
  }

  async assignNearest(companyId: string, tripId: string, actorId: string): Promise<Trip> {
    const recommendations = await this.getAssignmentRecommendations(companyId, tripId);
    const nearest = recommendations.candidates.find((c) => c.recommended);
    if (!nearest) {
      throw new ConflictDomainException(
        ErrorCode.NO_RIDER_AVAILABLE,
        'No available rider has a known location. Choose a rider manually.',
      );
    }
    return this.manualAssign(
      companyId,
      tripId,
      nearest.riderId,
      nearest.motorcycleId,
      'Admin assigned nearest available rider using last-known location',
      actorId,
    );
  }

  async startAutomaticDispatch(tripId: string): Promise<void> {
    const trip = await this.tripRepository.findOne({ where: { id: tripId } });
    if (!trip) {
      throw new NotFoundDomainException('Trip not found.');
    }

    if (trip.status !== TripStatus.SEARCHING_RIDER) {
      return;
    }

    // Nearest available driver by last-known GPS — no search-radius / freshness gate.
    const ranked = await this.riderMatchingService.findManualCandidates(
      trip.companyId,
      trip.pickupLatitude,
      trip.pickupLongitude,
    );
    const candidates = ranked
      .filter((c): c is typeof c & { distanceMeters: number } => c.distanceMeters != null)
      .map((c) => ({
        riderId: c.riderId,
        motorcycleId: c.motorcycleId,
        distanceMeters: c.distanceMeters,
        durationSeconds: c.durationSeconds,
        latitude: c.latitude,
        longitude: c.longitude,
        locationAgeSeconds: c.locationAgeSeconds,
      }));

    await this.assignmentAttemptRepository.save(
      this.assignmentAttemptRepository.create({
        companyId: trip.companyId,
        tripId: trip.id,
        transportRequestId: trip.transportRequestId,
        candidates: candidates.map((c) => ({
          riderId: c.riderId,
          motorcycleId: c.motorcycleId,
          distanceMeters: c.distanceMeters,
          durationSeconds: c.durationSeconds,
          locationAgeSeconds: c.locationAgeSeconds,
        })),
        selectedRiderId: candidates[0]?.riderId ?? null,
        selectedMotorcycleId: candidates[0]?.motorcycleId ?? null,
        method: AssignmentMethod.MANUAL,
        reason:
          candidates.length === 0
            ? 'No available riders with a known location'
            : 'Nearest available rider by last-known GPS',
        success: candidates.length > 0,
      }),
    );

    if (candidates.length === 0) {
      await this.markNoRiderAvailable(trip);
      return;
    }

    await this.offerToCandidate(trip, candidates[0], candidates.slice(1));
  }

  /**
   * Reset NO_RIDER_AVAILABLE / stuck SEARCHING and run auto-dispatch again.
   */
  async restartAutomaticDispatch(companyId: string, tripId: string): Promise<void> {
    const trip = await this.tripRepository.findOne({ where: { id: tripId, companyId } });
    if (!trip) {
      throw new NotFoundDomainException('Trip not found.');
    }

    if (
      trip.status !== TripStatus.NO_RIDER_AVAILABLE &&
      trip.status !== TripStatus.SEARCHING_RIDER
    ) {
      throw new ConflictDomainException(
        ErrorCode.TRIP_INVALID_STATE,
        'Auto-dispatch can only be restarted while searching or when no rider was available.',
      );
    }

    if (trip.status === TripStatus.NO_RIDER_AVAILABLE) {
      assertTransition(trip.status, TripStatus.SEARCHING_RIDER);
      trip.status = TripStatus.SEARCHING_RIDER;
      trip.riderId = null;
      trip.motorcycleId = null;
      trip.assignedAt = null;
      await this.tripRepository.save(trip);
    }

    await this.startAutomaticDispatch(trip.id);
  }

  async handleOfferTimeout(tripId: string, riderId: string, assignedAt?: string): Promise<void> {
    const expired = await this.dataSource.transaction(async (manager) => {
      const tripRepo = manager.getRepository(Trip);
      const riderRepo = manager.getRepository(Rider);

      const trip = await tripRepo.findOne({
        where: { id: tripId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!trip) {
        return;
      }

      if (
        trip.status !== TripStatus.RIDER_ASSIGNED ||
        trip.riderId !== riderId ||
        (assignedAt != null && trip.assignedAt?.toISOString() !== assignedAt)
      ) {
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
      return true;
    });

    if (!expired) return;
    await this.continueDispatch(tripId);
  }

  async continueDispatch(tripId: string): Promise<void> {
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
    let newlyAssigned = false;
    const assignedTrip = await this.dataSource.transaction(async (manager) => {
      const tripRepo = manager.getRepository(Trip);
      const riderRepo = manager.getRepository(Rider);
      const requestRepo = manager.getRepository(TransportRequest);
      const attemptRepo = manager.getRepository(AssignmentAttempt);

      const trip = await tripRepo.findOne({
        where: { id: tripId, companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!trip) {
        throw new NotFoundDomainException('Trip not found.');
      }

      if (
        trip.status !== TripStatus.SEARCHING_RIDER &&
        trip.status !== TripStatus.RIDER_ASSIGNED &&
        trip.status !== TripStatus.NO_RIDER_AVAILABLE
      ) {
        throw new ConflictDomainException(
          ErrorCode.TRIP_INVALID_STATE,
          'Trip cannot be manually assigned in its current state.',
        );
      }

      if (trip.status === TripStatus.NO_RIDER_AVAILABLE) {
        assertTransition(trip.status, TripStatus.SEARCHING_RIDER);
        trip.status = TripStatus.SEARCHING_RIDER;
        await tripRepo.save(trip);
      }

      const rider = await riderRepo.findOne({
        where: { id: riderId, companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!rider) {
        throw new NotFoundDomainException('Rider not found.');
      }

      if (
        rider.status !== RiderStatus.ACTIVE ||
        (rider.availabilityStatus !== RiderAvailabilityStatus.AVAILABLE &&
          !(trip.riderId === riderId && trip.status === TripStatus.RIDER_ASSIGNED))
      ) {
        throw new ConflictDomainException(
          ErrorCode.RIDER_NOT_AVAILABLE,
          'Rider is not available for assignment.',
        );
      }

      const assignment = await manager.getRepository(RiderMotorcycleAssignment).findOne({
        where: { companyId, riderId, active: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!assignment || (motorcycleId && motorcycleId !== assignment.motorcycleId)) {
        throw new ConflictDomainException(
          ErrorCode.MOTORCYCLE_NOT_AVAILABLE,
          'Rider must have an active assignment to the selected motorcycle.',
        );
      }
      const motorcycle = await manager.getRepository(Motorcycle).findOne({
        where: { id: assignment.motorcycleId, companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!motorcycle || motorcycle.status !== MotorcycleStatus.ACTIVE) {
        throw new ConflictDomainException(
          ErrorCode.MOTORCYCLE_NOT_AVAILABLE,
          'The assigned motorcycle is not active.',
        );
      }
      const activeStatuses = In([
        TripStatus.RIDER_ASSIGNED,
        TripStatus.RIDER_ACCEPTED,
        TripStatus.RIDER_TO_PICKUP,
        TripStatus.RIDER_ARRIVED,
        TripStatus.IN_PROGRESS,
      ]);
      const busy = await tripRepo.exists({
        where: [
          { companyId, id: Not(tripId), riderId, status: activeStatuses },
          { companyId, id: Not(tripId), motorcycleId: motorcycle.id, status: activeStatuses },
        ],
      });
      if (busy) {
        throw new ConflictDomainException(
          ErrorCode.RIDER_NOT_AVAILABLE,
          'Rider or motorcycle is already assigned to another trip.',
        );
      }

      if (trip.riderId && trip.riderId !== riderId) {
        const previousRider = await riderRepo.findOne({ where: { id: trip.riderId } });
        if (previousRider) {
          previousRider.availabilityStatus = RiderAvailabilityStatus.AVAILABLE;
          await riderRepo.save(previousRider);
        }
      }

      if (trip.status === TripStatus.RIDER_ASSIGNED && trip.riderId === riderId) {
        return trip;
      }

      if (trip.status === TripStatus.RIDER_ASSIGNED) {
        assertTransition(trip.status, TripStatus.SEARCHING_RIDER);
        trip.status = TripStatus.SEARCHING_RIDER;
      }

      assertTransition(trip.status, TripStatus.RIDER_ASSIGNED);
      trip.status = TripStatus.RIDER_ASSIGNED;
      trip.riderId = riderId;
      trip.motorcycleId = motorcycle.id;
      trip.assignedAt = new Date();
      await tripRepo.save(trip);
      newlyAssigned = true;

      rider.availabilityStatus = RiderAvailabilityStatus.ASSIGNED;
      await riderRepo.save(rider);

      const request = await requestRepo.findOne({
        where: { id: trip.transportRequestId, companyId },
      });
      if (request) {
        request.status = TransportRequestStatus.ASSIGNED;
        await requestRepo.save(request);
      }

      await attemptRepo.save(
        attemptRepo.create({
          companyId,
          tripId: trip.id,
          transportRequestId: trip.transportRequestId,
          candidates: [{ riderId, motorcycleId: trip.motorcycleId }],
          selectedRiderId: riderId,
          selectedMotorcycleId: trip.motorcycleId,
          method: AssignmentMethod.MANUAL,
          reason: reason ?? 'Manual assignment',
          success: true,
        }),
      );

      await this.tripEventsService.appendEvent(
        companyId,
        trip.id,
        TripEventType.RIDER_ASSIGNED,
        actorId,
        { riderId, motorcycleId: trip.motorcycleId, reason, manual: true },
      );

      return trip;
    });
    await this.redis.del(dispatchCandidatesKey(tripId));
    // Drop any auto-dispatch timeouts so a lagging "no rider" job cannot fire after admin assign.
    await this.cancelPendingOfferTimeouts(tripId);
    if (newlyAssigned) {
      await this.scheduleOfferTimeout(assignedTrip.id, riderId, assignedTrip.assignedAt!);
      await this.notificationsService.notifyRiderTripOffer(assignedTrip);
    }
    return assignedTrip;
  }

  async reassign(
    companyId: string,
    tripId: string,
    riderId: string,
    motorcycleId?: string,
    reason?: string,
    actorId?: string,
  ): Promise<Trip> {
    const trip = await this.manualAssign(companyId, tripId, riderId, motorcycleId, reason, actorId);

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
    let offered = false;
    let assignedAt: Date | undefined;

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

      // Skip to next when rider no longer AVAILABLE (fixes previous silent gap)
      if (
        !rider ||
        rider.status !== RiderStatus.ACTIVE ||
        rider.availabilityStatus !== RiderAvailabilityStatus.AVAILABLE
      ) {
        this.logger.debug(
          `Skipping rider ${candidate.riderId} — not AVAILABLE for trip ${trip.id}`,
        );
        return;
      }

      const assignment = await manager.getRepository(RiderMotorcycleAssignment).findOne({
        where: {
          companyId: trip.companyId,
          riderId: rider.id,
          motorcycleId: candidate.motorcycleId,
          active: true,
        },
        lock: { mode: 'pessimistic_write' },
      });
      const motorcycle = await manager.getRepository(Motorcycle).findOne({
        where: { id: candidate.motorcycleId, companyId: trip.companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!assignment || motorcycle?.status !== MotorcycleStatus.ACTIVE) return;
      const busyStatuses = In([
        TripStatus.RIDER_ASSIGNED,
        TripStatus.RIDER_ACCEPTED,
        TripStatus.RIDER_TO_PICKUP,
        TripStatus.RIDER_ARRIVED,
        TripStatus.IN_PROGRESS,
      ]);
      if (
        await tripRepo.exists({
          where: [
            {
              companyId: trip.companyId,
              id: Not(trip.id),
              riderId: rider.id,
              status: busyStatuses,
            },
            {
              companyId: trip.companyId,
              id: Not(trip.id),
              motorcycleId: motorcycle.id,
              status: busyStatuses,
            },
          ],
        })
      )
        return;

      assertTransition(lockedTrip.status, TripStatus.RIDER_ASSIGNED);
      lockedTrip.status = TripStatus.RIDER_ASSIGNED;
      lockedTrip.riderId = candidate.riderId;
      lockedTrip.motorcycleId = candidate.motorcycleId;
      lockedTrip.assignedAt = new Date();
      assignedAt = lockedTrip.assignedAt;
      await tripRepo.save(lockedTrip);

      // Reserve until rider accepts (accept path sets ASSIGNED)
      rider.availabilityStatus = RiderAvailabilityStatus.RESERVED;
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
          durationSeconds: candidate.durationSeconds,
          reserved: true,
        },
      );

      await this.redis.set(
        dispatchCandidatesKey(trip.id),
        JSON.stringify(remainingCandidates),
        'EX',
        3600,
      );
      offered = true;
    });

    if (!offered) {
      if (remainingCandidates.length === 0) {
        const fresh = await this.tripRepository.findOne({ where: { id: trip.id } });
        if (fresh && fresh.status === TripStatus.SEARCHING_RIDER) {
          await this.markNoRiderAvailable(fresh);
        }
        return;
      }
      await this.offerToCandidate(trip, remainingCandidates[0], remainingCandidates.slice(1));
      return;
    }

    const latest = await this.tripRepository.findOne({ where: { id: trip.id } });
    if (
      latest?.status === TripStatus.RIDER_ASSIGNED &&
      latest.riderId === candidate.riderId
    ) {
      if (trip.transportRequestId) {
        await this.whatsappStatusNotifier.notifyRequestStatus(
          trip.companyId,
          trip.transportRequestId,
          'Rider assigned — waiting for acceptance',
        );
      }
      await this.notificationsService.notifyRiderTripOffer(latest);
    }

    await this.scheduleOfferTimeout(trip.id, candidate.riderId, assignedAt!);
  }

  private async markNoRiderAvailable(trip: Trip): Promise<void> {
    const changed = await this.dataSource.transaction(async (manager) => {
      const tripRepo = manager.getRepository(Trip);
      const requestRepo = manager.getRepository(TransportRequest);

      const lockedTrip = await tripRepo.findOne({
        where: { id: trip.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedTrip || lockedTrip.status !== TripStatus.SEARCHING_RIDER) {
        return;
      }

      const request = await requestRepo.findOne({
        where: { id: lockedTrip.transportRequestId, companyId: trip.companyId },
      });
      // Admin assign may have won the race on the request row already.
      if (request?.status === TransportRequestStatus.ASSIGNED) {
        return;
      }

      assertTransition(lockedTrip.status, TripStatus.NO_RIDER_AVAILABLE);
      lockedTrip.status = TripStatus.NO_RIDER_AVAILABLE;
      await tripRepo.save(lockedTrip);

      if (request) {
        request.status = TransportRequestStatus.DISPATCHING;
        await requestRepo.save(request);
      }
      return true;
    });

    if (!changed) return;
    await this.redis.del(dispatchCandidatesKey(trip.id));

    // Admin may have assigned between the status write and this notify — never
    // send a lagging "no rider" WhatsApp after a successful assignment.
    const latest = await this.tripRepository.findOne({ where: { id: trip.id } });
    if (!latest || latest.status !== TripStatus.NO_RIDER_AVAILABLE || latest.riderId) {
      this.logger.debug(
        `Skipping no-rider WhatsApp for trip ${trip.id}; status=${latest?.status} riderId=${latest?.riderId}`,
      );
      return;
    }

    await this.whatsappStatusNotifier.notifyRequestStatus(
      trip.companyId,
      trip.transportRequestId,
      'No rider could be assigned automatically - awaiting admin assignment',
    );
  }

  private async cancelPendingOfferTimeouts(tripId: string): Promise<void> {
    try {
      const jobs = await this.dispatchQueue.getJobs(['delayed', 'waiting', 'prioritized']);
      await Promise.all(
        jobs
          .filter(
            (job) =>
              job.name === DISPATCH_TIMEOUT_JOB &&
              (job.data as { tripId?: string } | undefined)?.tripId === tripId,
          )
          .map(async (job) => {
            try {
              await job.remove();
            } catch {
              // Job may already be active or removed.
            }
          }),
      );
    } catch (error) {
      this.logger.warn(`Failed to cancel offer timeouts for trip ${tripId}: ${String(error)}`);
    }
  }

  private async scheduleOfferTimeout(
    tripId: string,
    riderId: string,
    assignedAt: Date,
  ): Promise<void> {
    const timeoutSeconds =
      this.configService.get<number>('app.ops.dispatchOfferTimeoutSeconds', { infer: true }) ?? 45;

    // BullMQ custom jobIds must not contain ':' (Redis key separator).
    const jobId = `offer-${tripId}-${riderId}-${assignedAt.getTime()}`;

    await this.dispatchQueue.add(
      DISPATCH_TIMEOUT_JOB,
      { tripId, riderId, assignedAt: assignedAt.toISOString() },
      {
        jobId,
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
