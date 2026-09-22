import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ErrorCode,
  LocationSource,
  MotorcycleTrackingStatus,
  TrackingMovementState,
  TrackingSessionStatus,
} from '../../common/enums';
import { DomainException } from '../../common/exceptions/domain.exception';
import { toPointGeoJson } from '../../common/utils/geo.util';
import { Company } from '../../companies/entities/company.entity';
import { LocationPing } from '../../locations/entities/location-ping.entity';
import { MotorcycleCurrentLocation } from '../../locations/entities/motorcycle-current-location.entity';
import { Motorcycle } from '../../motorcycles/entities/motorcycle.entity';
import { REALTIME_EVENTS } from '../../realtime/realtime.constants';
import { RealtimeService } from '../../realtime/realtime.service';
import { Rider } from '../../riders/entities/rider.entity';
import { User } from '../../users/entities/user.entity';
import { LocationUpdateDto } from '../dto/location-update.dto';
import { TrackingSession } from '../entities/tracking-session.entity';
import { GpsFilterService } from './gps-filter.service';
import { GeofenceService } from './geofence.service';
import { MovementDetectionService } from './movement-detection.service';
import { ReverseGeocodingService } from './reverse-geocoding.service';
import { StopDetectionService } from './stop-detection.service';
import {
  LiveDriverState,
  TrackingPresenceService,
} from './tracking-presence.service';
import { TrackingRetentionService } from './tracking-retention.service';
import { TrackingSessionsService } from './tracking-sessions.service';

export interface IngestResult {
  accepted: boolean;
  reason?: string;
  clientLocationId: string;
  trackingSessionId: string;
  distanceMeters?: number;
  movementState?: TrackingMovementState;
}

@Injectable()
export class LocationIngestionService {
  private readonly logger = new Logger(LocationIngestionService.name);
  private readonly movementCandidates = new Map<string, Date | null>();

  constructor(
    @InjectRepository(LocationPing)
    private readonly pingRepository: Repository<LocationPing>,
    @InjectRepository(MotorcycleCurrentLocation)
    private readonly currentLocationRepository: Repository<MotorcycleCurrentLocation>,
    @InjectRepository(TrackingSession)
    private readonly sessionRepository: Repository<TrackingSession>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(Motorcycle)
    private readonly motorcycleRepository: Repository<Motorcycle>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly sessionsService: TrackingSessionsService,
    private readonly gpsFilter: GpsFilterService,
    private readonly movementDetection: MovementDetectionService,
    private readonly stopDetection: StopDetectionService,
    private readonly geofenceService: GeofenceService,
    private readonly presenceService: TrackingPresenceService,
    private readonly realtimeService: RealtimeService,
    private readonly retentionService: TrackingRetentionService,
    private readonly reverseGeocoding: ReverseGeocodingService,
  ) {}

  async ingestForUser(userId: string, dto: LocationUpdateDto): Promise<IngestResult> {
    const rider = await this.sessionsService.resolveActiveRider(userId);
    return this.ingestForRider(rider, dto);
  }

  async ingestBatch(
    userId: string,
    locations: LocationUpdateDto[],
  ): Promise<{ results: IngestResult[]; accepted: number; rejected: number }> {
    const rider = await this.sessionsService.resolveActiveRider(userId);
    const sorted = [...locations].sort(
      (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
    );
    const results: IngestResult[] = [];
    for (const loc of sorted) {
      results.push(await this.ingestForRider(rider, loc));
    }
    return {
      results,
      accepted: results.filter((r) => r.accepted).length,
      rejected: results.filter((r) => !r.accepted).length,
    };
  }

  private async ingestForRider(
    rider: Rider,
    dto: LocationUpdateDto,
  ): Promise<IngestResult> {
    const existing = await this.pingRepository.findOne({
      where: { companyId: rider.companyId, clientLocationId: dto.clientLocationId },
    });
    if (existing) {
      return {
        accepted: true,
        clientLocationId: dto.clientLocationId,
        trackingSessionId: dto.trackingSessionId,
        reason: 'IDEMPOTENT_REPLAY',
      };
    }

    const session = await this.sessionRepository.findOne({
      where: {
        id: dto.trackingSessionId,
        riderId: rider.id,
        companyId: rider.companyId,
      },
    });
    if (!session || session.status !== TrackingSessionStatus.ACTIVE) {
      throw new DomainException(
        ErrorCode.TRIP_INVALID_STATE,
        'No active tracking session for this upload.',
        HttpStatus.CONFLICT,
      );
    }

    const previous = await this.pingRepository.findOne({
      where: { trackingSessionId: session.id },
      order: { recordedAt: 'DESC' },
    });

    const capturedAt = new Date(dto.capturedAt);
    const filtered = this.gpsFilter.validate(
      {
        clientLocationId: dto.clientLocationId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy ?? null,
        speed: dto.speed ?? null,
        heading: dto.heading ?? null,
        altitude: dto.altitude ?? null,
        capturedAt,
      },
      previous
        ? {
            latitude: previous.latitude,
            longitude: previous.longitude,
            capturedAt: previous.recordedAt,
            clientLocationId: previous.clientLocationId,
          }
        : null,
    );

    if (!filtered.accepted) {
      if (filtered.reason === 'POOR_ACCURACY') {
        this.realtimeService.emitToCompany(
          rider.companyId,
          REALTIME_EVENTS.TRACKING_GPS_WARNING,
          {
            riderId: rider.id,
            motorcycleId: session.motorcycleId,
            accuracy: dto.accuracy ?? null,
            capturedAt: capturedAt.toISOString(),
          },
        );
      }
      this.logger.debug(
        `Rejected GPS point ${dto.clientLocationId}: ${filtered.reason}`,
      );
      return {
        accepted: false,
        reason: filtered.reason,
        clientLocationId: dto.clientLocationId,
        trackingSessionId: session.id,
      };
    }

    const sample = filtered.value;
    const receivedAt = new Date();

    const savedPing = await this.pingRepository.save(
      this.pingRepository.create({
        companyId: rider.companyId,
        motorcycleId: session.motorcycleId,
        riderId: rider.id,
        tripId: session.tripId ?? null,
        trackingSessionId: session.id,
        clientLocationId: sample.clientLocationId,
        position: toPointGeoJson({ lat: sample.latitude, lng: sample.longitude }),
        latitude: sample.latitude,
        longitude: sample.longitude,
        speed: sample.computedSpeedMps,
        heading: sample.heading ?? null,
        accuracy: sample.accuracy ?? null,
        altitude: sample.altitude ?? null,
        source: LocationSource.RIDER_APP,
        recordedAt: capturedAt,
        receivedAt,
      }),
    );

    const company = await this.companyRepository.findOne({
      where: { id: rider.companyId },
    });
    if (company?.trackingKeepDailyLastPingOnly !== false) {
      await this.retentionService.compactDayForMotorcycle(
        rider.companyId,
        session.motorcycleId,
        capturedAt,
        savedPing.id,
      );
    }

    const movement = this.movementDetection.evaluate(
      {
        movementState: session.movementState,
        candidateSince: this.movementCandidates.get(session.id) ?? null,
        lastLatitude: previous?.latitude,
        lastLongitude: previous?.longitude,
      },
      {
        speedMps: sample.computedSpeedMps,
        latitude: sample.latitude,
        longitude: sample.longitude,
        at: capturedAt,
      },
    );
    this.movementCandidates.set(session.id, movement.candidateSince);

    const prevLast = session.lastLocationAt ?? session.startedAt;
    const elapsedSec = Math.max(
      0,
      Math.round((capturedAt.getTime() - prevLast.getTime()) / 1000),
    );
    if (session.movementState === TrackingMovementState.MOVING) {
      session.movingDurationSeconds += elapsedSec;
    } else if (session.movementState === TrackingMovementState.STOPPED) {
      session.stoppedDurationSeconds += elapsedSec;
    }

    session.movementState = movement.movementState;
    session.lastLocationAt = capturedAt;
    session.totalDistanceMeters += sample.distanceFromPreviousMeters;
    if (
      sample.computedSpeedMps != null &&
      (session.maxSpeed == null || sample.computedSpeedMps > session.maxSpeed)
    ) {
      session.maxSpeed = sample.computedSpeedMps;
    }
    session.endLatitude = sample.latitude;
    session.endLongitude = sample.longitude;
    if (session.startLatitude == null) {
      session.startLatitude = sample.latitude;
      session.startLongitude = sample.longitude;
      session.startLocation = toPointGeoJson({
        lat: sample.latitude,
        lng: sample.longitude,
      });
    }
    await this.sessionRepository.save(session);

    if (movement.transitioned) {
      if (movement.movementState === TrackingMovementState.STOPPED) {
        await this.stopDetection.onStopped({
          companyId: rider.companyId,
          riderId: rider.id,
          motorcycleId: session.motorcycleId,
          trackingSessionId: session.id,
          latitude: sample.latitude,
          longitude: sample.longitude,
          at: capturedAt,
        });
        this.realtimeService.emitToCompany(
          rider.companyId,
          REALTIME_EVENTS.TRACKING_DRIVER_STOPPED,
          { riderId: rider.id, motorcycleId: session.motorcycleId, at: capturedAt.toISOString() },
        );
      } else if (movement.movementState === TrackingMovementState.MOVING) {
        await this.stopDetection.onMoving(session.id, capturedAt);
        this.realtimeService.emitToCompany(
          rider.companyId,
          REALTIME_EVENTS.TRACKING_DRIVER_MOVING,
          { riderId: rider.id, motorcycleId: session.motorcycleId, at: capturedAt.toISOString() },
        );
      }
    } else if (movement.movementState === TrackingMovementState.STOPPED) {
      await this.stopDetection.onStopped({
        companyId: rider.companyId,
        riderId: rider.id,
        motorcycleId: session.motorcycleId,
        trackingSessionId: session.id,
        latitude: sample.latitude,
        longitude: sample.longitude,
        at: capturedAt,
      });
    }

    await this.upsertCurrentLocation(session, sample, capturedAt);
    rider.currentLatitude = String(sample.latitude);
    rider.currentLongitude = String(sample.longitude);
    rider.position = toPointGeoJson({ lat: sample.latitude, lng: sample.longitude });
    rider.locationUpdatedAt = receivedAt;
    await this.riderRepository.save(rider);

    const trackingStatus =
      movement.movementState === TrackingMovementState.MOVING
        ? MotorcycleTrackingStatus.MOVING
        : movement.movementState === TrackingMovementState.STOPPED
          ? MotorcycleTrackingStatus.PARKED
          : MotorcycleTrackingStatus.ONLINE;
    await this.motorcycleRepository.update(session.motorcycleId, { trackingStatus });

    try {
      await this.geofenceService.checkPoint({
        companyId: rider.companyId,
        riderId: rider.id,
        motorcycleId: session.motorcycleId,
        trackingSessionId: session.id,
        latitude: sample.latitude,
        longitude: sample.longitude,
        at: capturedAt,
      });
    } catch (err) {
      this.logger.warn(`Geofence check failed: ${(err as Error).message}`);
    }

    const user = await this.userRepository.findOne({ where: { id: rider.userId } });
    const moto = await this.motorcycleRepository.findOne({
      where: { id: session.motorcycleId },
    });

    let placeName: string | null = session.startAddress ?? null;
    try {
      const resolved = await this.reverseGeocoding.reverse(
        sample.latitude,
        sample.longitude,
      );
      if (resolved) {
        placeName = resolved;
        if (!session.startAddress) {
          session.startAddress = resolved;
          await this.sessionRepository.save(session);
        }
      }
    } catch (err) {
      this.logger.debug(`Reverse geocode skipped: ${(err as Error).message}`);
    }

    const live: LiveDriverState = {
      riderId: rider.id,
      motorcycleId: session.motorcycleId,
      companyId: rider.companyId,
      trackingSessionId: session.id,
      latitude: sample.latitude,
      longitude: sample.longitude,
      speed: sample.computedSpeedMps,
      heading: sample.heading ?? null,
      accuracy: sample.accuracy ?? null,
      movementState: session.movementState,
      presence: this.presenceService.computePresence(capturedAt, receivedAt),
      capturedAt: capturedAt.toISOString(),
      receivedAt: receivedAt.toISOString(),
      totalDistanceMeters: session.totalDistanceMeters,
      riderName: user ? `${user.firstName} ${user.lastName}`.trim() : null,
      phone: rider.phone,
      plateNumber: moto?.plateNumber ?? null,
      placeName,
    };
    await this.presenceService.setLiveState(live);

    const locationPayload = {
      ...live,
      source: LocationSource.RIDER_APP,
      trackingStatus,
      freshness: live.presence,
      recordedAt: capturedAt,
    };

    this.realtimeService.emitToCompany(
      rider.companyId,
      REALTIME_EVENTS.FLEET_LOCATION_UPDATED,
      locationPayload,
    );
    this.realtimeService.emitToCompany(
      rider.companyId,
      REALTIME_EVENTS.TRACKING_DRIVER_LOCATION,
      live,
    );

    return {
      accepted: true,
      clientLocationId: dto.clientLocationId,
      trackingSessionId: session.id,
      distanceMeters: session.totalDistanceMeters,
      movementState: session.movementState,
    };
  }

  private async upsertCurrentLocation(
    session: TrackingSession,
    sample: { latitude: number; longitude: number; computedSpeedMps: number | null; heading?: number | null; accuracy?: number | null },
    recordedAt: Date,
  ): Promise<void> {
    let current = await this.currentLocationRepository.findOne({
      where: { motorcycleId: session.motorcycleId },
    });
    if (!current) {
      current = this.currentLocationRepository.create({
        motorcycleId: session.motorcycleId,
        companyId: session.companyId,
      });
    }
    current.latitude = sample.latitude;
    current.longitude = sample.longitude;
    current.position = toPointGeoJson({ lat: sample.latitude, lng: sample.longitude });
    current.speed = sample.computedSpeedMps;
    current.heading = sample.heading ?? null;
    current.accuracy = sample.accuracy ?? null;
    current.source = LocationSource.RIDER_APP;
    current.recordedAt = recordedAt;
    await this.currentLocationRepository.save(current);
  }
}
