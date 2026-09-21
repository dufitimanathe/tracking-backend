import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ErrorCode,
  MotorcycleTrackingStatus,
  RiderStatus,
  TrackingMovementState,
  TrackingSessionStatus,
} from '../../common/enums';
import { DomainException } from '../../common/exceptions/domain.exception';
import { toPointGeoJson } from '../../common/utils/geo.util';
import { Motorcycle } from '../../motorcycles/entities/motorcycle.entity';
import { REALTIME_EVENTS } from '../../realtime/realtime.constants';
import { RealtimeService } from '../../realtime/realtime.service';
import { RiderMotorcycleAssignment } from '../../rider-motorcycle-assignments/entities/rider-motorcycle-assignment.entity';
import { Rider } from '../../riders/entities/rider.entity';
import { User } from '../../users/entities/user.entity';
import { StartTrackingDto } from '../dto/start-tracking.dto';
import { TrackingSession } from '../entities/tracking-session.entity';
import { DistanceService } from './distance.service';
import { ReverseGeocodingService } from './reverse-geocoding.service';
import { TrackingPresenceService } from './tracking-presence.service';

@Injectable()
export class TrackingSessionsService {
  constructor(
    @InjectRepository(TrackingSession)
    private readonly sessionRepository: Repository<TrackingSession>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(RiderMotorcycleAssignment)
    private readonly assignmentRepository: Repository<RiderMotorcycleAssignment>,
    @InjectRepository(Motorcycle)
    private readonly motorcycleRepository: Repository<Motorcycle>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly realtimeService: RealtimeService,
    private readonly presenceService: TrackingPresenceService,
    private readonly distanceService: DistanceService,
    private readonly reverseGeocoding: ReverseGeocodingService,
  ) {}

  async resolveActiveRider(userId: string): Promise<Rider> {
    const rider = await this.riderRepository.findOne({
      where: { userId, status: RiderStatus.ACTIVE },
    });
    if (!rider) {
      throw new DomainException(
        ErrorCode.NOT_FOUND,
        'Active rider profile not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return rider;
  }

  async findActiveForRider(riderId: string): Promise<TrackingSession | null> {
    return this.sessionRepository.findOne({
      where: { riderId, status: TrackingSessionStatus.ACTIVE },
      order: { startedAt: 'DESC' },
    });
  }

  async start(userId: string, dto: StartTrackingDto = {}): Promise<TrackingSession> {
    const rider = await this.resolveActiveRider(userId);
    const existing = await this.findActiveForRider(rider.id);
    if (existing) return existing;

    const assignment = await this.assignmentRepository.findOne({
      where: { riderId: rider.id, companyId: rider.companyId, active: true },
    });
    if (!assignment) {
      throw new DomainException(
        ErrorCode.MOTORCYCLE_NOT_AVAILABLE,
        'Assign a motorcycle before starting tracking.',
        HttpStatus.CONFLICT,
      );
    }

    const now = new Date();
    const session = await this.sessionRepository.save(
      this.sessionRepository.create({
        companyId: rider.companyId,
        riderId: rider.id,
        motorcycleId: assignment.motorcycleId,
        tripId: dto.tripId ?? null,
        status: TrackingSessionStatus.ACTIVE,
        movementState: TrackingMovementState.TRACKING,
        startedAt: now,
        totalDistanceMeters: 0,
        movingDurationSeconds: 0,
        stoppedDurationSeconds: 0,
      }),
    );

    await this.motorcycleRepository.update(assignment.motorcycleId, {
      trackingStatus: MotorcycleTrackingStatus.ONLINE,
    });

    const user = await this.userRepository.findOne({ where: { id: rider.userId } });
    const moto = await this.motorcycleRepository.findOne({
      where: { id: assignment.motorcycleId },
    });

    this.realtimeService.emitToCompany(
      rider.companyId,
      REALTIME_EVENTS.TRACKING_SESSION_STARTED,
      {
        sessionId: session.id,
        riderId: rider.id,
        motorcycleId: assignment.motorcycleId,
        startedAt: now.toISOString(),
        riderName: user ? `${user.firstName} ${user.lastName}`.trim() : null,
        plateNumber: moto?.plateNumber ?? null,
      },
    );

    return session;
  }

  async end(userId: string, sessionId: string): Promise<TrackingSession> {
    const rider = await this.resolveActiveRider(userId);
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, riderId: rider.id, companyId: rider.companyId },
    });
    if (!session) {
      throw new DomainException(ErrorCode.NOT_FOUND, 'Tracking session not found.', HttpStatus.NOT_FOUND);
    }
    if (session.status !== TrackingSessionStatus.ACTIVE) {
      return session;
    }

    const now = new Date();
    const distance = await this.distanceService.sessionDistanceMeters(session.id);
    session.status = TrackingSessionStatus.COMPLETED;
    session.movementState = TrackingMovementState.TRIP_COMPLETED;
    session.endedAt = now;
    session.totalDistanceMeters = distance;
    if (session.endLatitude != null && session.endLongitude != null) {
      session.endLocation = toPointGeoJson({
        lat: session.endLatitude,
        lng: session.endLongitude,
      });
      session.endAddress =
        (await this.reverseGeocoding.reverse(session.endLatitude, session.endLongitude)) ??
        null;
    }
    if (session.startLatitude != null && session.startLongitude != null && !session.startAddress) {
      session.startAddress =
        (await this.reverseGeocoding.reverse(
          session.startLatitude,
          session.startLongitude,
        )) ?? null;
    }

    const durationSec = Math.max(
      0,
      Math.round((now.getTime() - session.startedAt.getTime()) / 1000),
    );
    if (durationSec > 0 && distance > 0) {
      session.averageSpeed = distance / durationSec;
    }

    const saved = await this.sessionRepository.save(session);
    await this.presenceService.clearDriver(session.companyId, session.riderId);

    this.realtimeService.emitToCompany(
      session.companyId,
      REALTIME_EVENTS.TRACKING_SESSION_ENDED,
      {
        sessionId: session.id,
        riderId: session.riderId,
        motorcycleId: session.motorcycleId,
        endedAt: now.toISOString(),
        totalDistanceMeters: session.totalDistanceMeters,
      },
    );

    return saved;
  }

  async getForCompany(companyId: string, sessionId: string): Promise<TrackingSession> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, companyId },
    });
    if (!session) {
      throw new DomainException(ErrorCode.NOT_FOUND, 'Tracking session not found.', HttpStatus.NOT_FOUND);
    }
    return session;
  }

  async listForCompany(
    companyId: string,
    query: { riderId?: string; motorcycleId?: string; from?: Date; to?: Date; limit?: number },
  ): Promise<TrackingSession[]> {
    const qb = this.sessionRepository
      .createQueryBuilder('s')
      .where('s.companyId = :companyId', { companyId })
      .orderBy('s.startedAt', 'DESC')
      .take(query.limit ?? 50);

    if (query.riderId) qb.andWhere('s.riderId = :riderId', { riderId: query.riderId });
    if (query.motorcycleId) {
      qb.andWhere('s.motorcycleId = :motorcycleId', { motorcycleId: query.motorcycleId });
    }
    if (query.from) qb.andWhere('s.startedAt >= :from', { from: query.from });
    if (query.to) qb.andWhere('s.startedAt <= :to', { to: query.to });

    return qb.getMany();
  }
}
