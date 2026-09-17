import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpStatus } from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  LocationSource,
  MotorcycleTrackingStatus,
  RiderStatus,
} from '../common/enums';
import { DomainException } from '../common/exceptions/domain.exception';
import { ErrorCode } from '../common/enums';
import { toPointWkt } from '../common/utils/geo.util';
import { GpsDevice } from '../gps-devices/entities/gps-device.entity';
import { IncidentDetectionService } from '../incidents/incident-detection.service';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { RiderMotorcycleAssignment } from '../rider-motorcycle-assignments/entities/rider-motorcycle-assignment.entity';
import { Rider } from '../riders/entities/rider.entity';
import { REALTIME_EVENTS } from '../realtime/realtime.constants';
import { RealtimeService } from '../realtime/realtime.service';
import { User } from '../users/entities/user.entity';
import {
  FleetLiveItemDto,
  LocationFreshness,
} from './dto/fleet-live-response.dto';
import { IngestRiderLocationDto } from './dto/ingest-rider-location.dto';
import { LocationPing } from './entities/location-ping.entity';
import { MotorcycleCurrentLocation } from './entities/motorcycle-current-location.entity';
import { MockGpsProvider } from './providers/mock-gps.provider';

const MOVING_SPEED_THRESHOLD_KMH = 2;
const MAX_FUTURE_RECORDED_SECONDS = 300;

export interface LocationUpdatePayload {
  motorcycleId: string;
  companyId: string;
  riderId?: string | null;
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  source: LocationSource;
  recordedAt: Date;
  trackingStatus: MotorcycleTrackingStatus;
  freshness: LocationFreshness;
}

@Injectable()
export class LocationsService {
  private readonly gpsProviders = new Map<string, MockGpsProvider>();

  constructor(
    @InjectRepository(LocationPing)
    private readonly locationPingRepository: Repository<LocationPing>,
    @InjectRepository(MotorcycleCurrentLocation)
    private readonly currentLocationRepository: Repository<MotorcycleCurrentLocation>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(RiderMotorcycleAssignment)
    private readonly assignmentRepository: Repository<RiderMotorcycleAssignment>,
    @InjectRepository(Motorcycle)
    private readonly motorcycleRepository: Repository<Motorcycle>,
    @InjectRepository(GpsDevice)
    private readonly gpsDeviceRepository: Repository<GpsDevice>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly realtimeService: RealtimeService,
    private readonly incidentDetectionService: IncidentDetectionService,
    private readonly mockGpsProvider: MockGpsProvider,
  ) {
    this.gpsProviders.set('mock', mockGpsProvider);
  }

  async ingestRiderLocation(
    userId: string,
    dto: IngestRiderLocationDto,
  ): Promise<LocationUpdatePayload> {
    this.validateCoordinates(dto.latitude, dto.longitude);
    const recordedAt = this.validateRecordedAt(new Date(dto.recordedAt));

    const rider = await this.riderRepository.findOne({
      where: { userId, status: RiderStatus.ACTIVE },
    });

    if (!rider) {
      throw new DomainException(
        ErrorCode.NOT_FOUND,
        'Active rider profile not found for user.',
        HttpStatus.NOT_FOUND,
      );
    }

    const assignment = await this.assignmentRepository.findOne({
      where: {
        riderId: rider.id,
        companyId: rider.companyId,
        active: true,
      },
    });

    if (!assignment) {
      throw new DomainException(
        ErrorCode.MOTORCYCLE_NOT_AVAILABLE,
        'Rider must have an active motorcycle assignment.',
        HttpStatus.CONFLICT,
      );
    }

    const trackingStatus = this.resolveTrackingStatus(dto.speed);
    const receivedAt = new Date();

    await this.locationPingRepository.save(
      this.locationPingRepository.create({
        companyId: rider.companyId,
        motorcycleId: assignment.motorcycleId,
        riderId: rider.id,
        position: toPointWkt({ lat: dto.latitude, lng: dto.longitude }),
        latitude: dto.latitude,
        longitude: dto.longitude,
        speed: dto.speed ?? null,
        heading: dto.heading ?? null,
        accuracy: dto.accuracy ?? null,
        source: LocationSource.RIDER_APP,
        recordedAt,
        receivedAt,
      }),
    );

    await this.upsertCurrentLocation({
      motorcycleId: assignment.motorcycleId,
      companyId: rider.companyId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      speed: dto.speed,
      heading: dto.heading,
      accuracy: dto.accuracy,
      source: LocationSource.RIDER_APP,
      recordedAt,
    });

    rider.currentLatitude = String(dto.latitude);
    rider.currentLongitude = String(dto.longitude);
    rider.position = toPointWkt({ lat: dto.latitude, lng: dto.longitude });
    rider.locationUpdatedAt = receivedAt;
    await this.riderRepository.save(rider);

    await this.motorcycleRepository.update(assignment.motorcycleId, {
      trackingStatus,
    });

    const freshness = this.computeFreshness(recordedAt);
    const payload: LocationUpdatePayload = {
      motorcycleId: assignment.motorcycleId,
      companyId: rider.companyId,
      riderId: rider.id,
      latitude: dto.latitude,
      longitude: dto.longitude,
      speed: dto.speed ?? null,
      heading: dto.heading ?? null,
      source: LocationSource.RIDER_APP,
      recordedAt,
      trackingStatus,
      freshness,
    };

    this.realtimeService.emitToCompany(
      rider.companyId,
      REALTIME_EVENTS.FLEET_LOCATION_UPDATED,
      payload,
    );

    await this.incidentDetectionService.analyzeMovement(
      assignment.motorcycleId,
      rider.companyId,
      {
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy ?? null,
        recordedAt,
      },
    );

    return payload;
  }

  async ingestGpsDevice(
    provider: string,
    payload: Record<string, unknown>,
  ): Promise<LocationUpdatePayload> {
    const gpsProvider = this.gpsProviders.get(provider.toLowerCase());
    if (!gpsProvider) {
      throw new DomainException(
        ErrorCode.NOT_FOUND,
        `GPS provider "${provider}" is not supported.`,
        HttpStatus.NOT_FOUND,
      );
    }

    const normalized = gpsProvider.normalize(payload);
    this.validateCoordinates(normalized.latitude, normalized.longitude);
    const recordedAt = this.validateRecordedAt(normalized.recordedAt);

    const device = await this.gpsDeviceRepository.findOne({
      where: { externalDeviceId: normalized.externalDeviceId },
    });

    if (!device) {
      throw new DomainException(
        ErrorCode.GPS_DEVICE_NOT_ASSIGNED,
        'GPS device not registered.',
        HttpStatus.NOT_FOUND,
      );
    }

    const assignment = await this.assignmentRepository.findOne({
      where: {
        motorcycleId: device.motorcycleId,
        companyId: device.companyId,
        active: true,
      },
    });

    const trackingStatus = this.resolveTrackingStatus(normalized.speed ?? undefined);
    const receivedAt = new Date();

    await this.locationPingRepository.save(
      this.locationPingRepository.create({
        companyId: device.companyId,
        motorcycleId: device.motorcycleId,
        riderId: assignment?.riderId ?? null,
        position: toPointWkt({ lat: normalized.latitude, lng: normalized.longitude }),
        latitude: normalized.latitude,
        longitude: normalized.longitude,
        speed: normalized.speed ?? null,
        heading: normalized.heading ?? null,
        accuracy: normalized.accuracy ?? null,
        ignition: normalized.ignition ?? null,
        source: normalized.source,
        recordedAt,
        receivedAt,
      }),
    );

    await this.upsertCurrentLocation({
      motorcycleId: device.motorcycleId,
      companyId: device.companyId,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      speed: normalized.speed ?? undefined,
      heading: normalized.heading ?? undefined,
      accuracy: normalized.accuracy ?? undefined,
      source: normalized.source,
      recordedAt,
    });

    device.lastSeenAt = receivedAt;
    await this.gpsDeviceRepository.save(device);

    await this.motorcycleRepository.update(device.motorcycleId, { trackingStatus });

    const freshness = this.computeFreshness(recordedAt);
    const updatePayload: LocationUpdatePayload = {
      motorcycleId: device.motorcycleId,
      companyId: device.companyId,
      riderId: assignment?.riderId ?? null,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      speed: normalized.speed ?? null,
      heading: normalized.heading ?? null,
      source: normalized.source,
      recordedAt,
      trackingStatus,
      freshness,
    };

    this.realtimeService.emitToCompany(
      device.companyId,
      REALTIME_EVENTS.FLEET_LOCATION_UPDATED,
      updatePayload,
    );

    await this.incidentDetectionService.analyzeMovement(
      device.motorcycleId,
      device.companyId,
      {
        latitude: normalized.latitude,
        longitude: normalized.longitude,
        accuracy: normalized.accuracy ?? null,
        recordedAt,
      },
    );

    return updatePayload;
  }

  async getLiveFleet(companyId: string): Promise<FleetLiveItemDto[]> {
    const rows = await this.motorcycleRepository
      .createQueryBuilder('m')
      .leftJoin(
        MotorcycleCurrentLocation,
        'loc',
        'loc.motorcycleId = m.id AND loc.companyId = m.companyId',
      )
      .leftJoin(
        RiderMotorcycleAssignment,
        'a',
        'a.motorcycleId = m.id AND a.companyId = m.companyId AND a.active = true',
      )
      .leftJoin(Rider, 'r', 'r.id = a.riderId')
      .leftJoin(User, 'u', 'u.id = r.userId')
      .select([
        'm.id AS "motorcycleId"',
        'm.plateNumber AS "plateNumber"',
        'm.status AS "status"',
        'm.trackingStatus AS "trackingStatus"',
        'r.id AS "riderId"',
        'u.firstName AS "riderFirstName"',
        'u.lastName AS "riderLastName"',
        'loc.latitude AS "latitude"',
        'loc.longitude AS "longitude"',
        'loc.speed AS "speed"',
        'loc.heading AS "heading"',
        'loc.recordedAt AS "recordedAt"',
      ])
      .where('m.companyId = :companyId', { companyId })
      .getRawMany<{
        motorcycleId: string;
        plateNumber: string;
        status: string;
        trackingStatus: string;
        riderId: string | null;
        riderFirstName: string | null;
        riderLastName: string | null;
        latitude: number | null;
        longitude: number | null;
        speed: number | null;
        heading: number | null;
        recordedAt: Date | null;
      }>();

    return rows.map((row) => ({
      motorcycleId: row.motorcycleId,
      plateNumber: row.plateNumber,
      status: row.status as FleetLiveItemDto['status'],
      trackingStatus: row.trackingStatus as FleetLiveItemDto['trackingStatus'],
      riderId: row.riderId,
      riderName:
        row.riderFirstName && row.riderLastName
          ? `${row.riderFirstName} ${row.riderLastName}`
          : null,
      latitude: row.latitude,
      longitude: row.longitude,
      speed: row.speed,
      heading: row.heading,
      recordedAt: row.recordedAt,
      freshness: row.recordedAt
        ? this.computeFreshness(new Date(row.recordedAt))
        : LocationFreshness.OFFLINE,
    }));
  }

  computeFreshness(recordedAt: Date): LocationFreshness {
    const ops = this.configService.get('app.ops', { infer: true })!;
    const ageSeconds = (Date.now() - recordedAt.getTime()) / 1000;

    if (ageSeconds <= ops.locationLiveSeconds) {
      return LocationFreshness.LIVE;
    }
    if (ageSeconds <= ops.locationDelayedSeconds) {
      return LocationFreshness.DELAYED;
    }
    return LocationFreshness.OFFLINE;
  }

  private async upsertCurrentLocation(input: {
    motorcycleId: string;
    companyId: string;
    latitude: number;
    longitude: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
    source: LocationSource;
    recordedAt: Date;
  }): Promise<void> {
    const existing = await this.currentLocationRepository.findOne({
      where: { motorcycleId: input.motorcycleId },
    });

    const data = {
      companyId: input.companyId,
      position: toPointWkt({ lat: input.latitude, lng: input.longitude }),
      latitude: input.latitude,
      longitude: input.longitude,
      speed: input.speed ?? null,
      heading: input.heading ?? null,
      accuracy: input.accuracy ?? null,
      source: input.source,
      recordedAt: input.recordedAt,
    };

    if (existing) {
      await this.currentLocationRepository.update(input.motorcycleId, data);
    } else {
      await this.currentLocationRepository.save(
        this.currentLocationRepository.create({
          motorcycleId: input.motorcycleId,
          ...data,
        }),
      );
    }
  }

  private validateCoordinates(latitude: number, longitude: number): void {
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Invalid latitude or longitude.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private validateRecordedAt(recordedAt: Date): Date {
    const now = Date.now();
    const recordedMs = recordedAt.getTime();

    if (Number.isNaN(recordedMs)) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Invalid recordedAt timestamp.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (recordedMs - now > MAX_FUTURE_RECORDED_SECONDS * 1000) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'recordedAt cannot be too far in the future.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return recordedAt;
  }

  private resolveTrackingStatus(speedKmh?: number): MotorcycleTrackingStatus {
    if (speedKmh != null && speedKmh > MOVING_SPEED_THRESHOLD_KMH) {
      return MotorcycleTrackingStatus.MOVING;
    }
    return MotorcycleTrackingStatus.PARKED;
  }
}
