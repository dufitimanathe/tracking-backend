import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { In, Repository } from 'typeorm';
import { REDIS_CLIENT } from '../common/redis/redis.constants';
import {
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  MembershipStatus,
  MotorcycleTrackingStatus,
  NotificationType,
  TripStatus,
  UserRole,
} from '../common/enums';
import { haversineDistanceMeters } from '../common/utils/geo.util';
import { CompanyMember } from '../company-members/entities/company-member.entity';
import { GpsDevice } from '../gps-devices/entities/gps-device.entity';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { REALTIME_EVENTS } from '../realtime/realtime.constants';
import { RealtimeService } from '../realtime/realtime.service';
import { Trip } from '../trips/entities/trip.entity';
import { IncidentResponseDto } from './dto/incident-response.dto';
import { Incident } from './entities/incident.entity';

const ACTIVE_TRIP_STATUSES: TripStatus[] = [
  TripStatus.IN_PROGRESS,
  TripStatus.RIDER_TO_PICKUP,
  TripStatus.RIDER_ARRIVED,
  TripStatus.RIDER_ACCEPTED,
  TripStatus.RIDER_ASSIGNED,
];

interface MovementState {
  firstLat: number;
  firstLng: number;
  firstSeenAt: string;
}

export interface MovementLocationInput {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: Date;
}

@Injectable()
export class IncidentDetectionService {
  private readonly logger = new Logger(IncidentDetectionService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(Motorcycle)
    private readonly motorcycleRepository: Repository<Motorcycle>,
    @InjectRepository(GpsDevice)
    private readonly gpsDeviceRepository: Repository<GpsDevice>,
    @InjectRepository(CompanyMember)
    private readonly companyMemberRepository: Repository<CompanyMember>,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async analyzeMovement(
    motorcycleId: string,
    companyId: string,
    newLocation: MovementLocationInput,
  ): Promise<void> {
    const activeTrip = await this.tripRepository.findOne({
      where: {
        motorcycleId,
        companyId,
        status: In(ACTIVE_TRIP_STATUSES),
      },
    });

    if (activeTrip) {
      await this.clearMovementState(motorcycleId);
      return;
    }

    const ops = this.configService.get('app.ops', { infer: true })!;
    const key = this.movementKey(motorcycleId);
    const existingRaw = await this.redis.get(key);

    if (!existingRaw) {
      const state: MovementState = {
        firstLat: newLocation.latitude,
        firstLng: newLocation.longitude,
        firstSeenAt: newLocation.recordedAt.toISOString(),
      };
      await this.redis.set(
        key,
        JSON.stringify(state),
        'EX',
        ops.unauthorizedMovementDurationSeconds * 10,
      );
      return;
    }

    const state = JSON.parse(existingRaw) as MovementState;
    const distanceMeters = haversineDistanceMeters(
      state.firstLat,
      state.firstLng,
      newLocation.latitude,
      newLocation.longitude,
    );
    const durationSeconds =
      (newLocation.recordedAt.getTime() - new Date(state.firstSeenAt).getTime()) / 1000;

    const accuracyOk =
      newLocation.accuracy == null ||
      newLocation.accuracy <= ops.unauthorizedMovementMinAccuracyMeters;

    if (
      distanceMeters < ops.unauthorizedMovementDistanceMeters ||
      durationSeconds < ops.unauthorizedMovementDurationSeconds ||
      !accuracyOk
    ) {
      return;
    }

    await this.createOrUpdateUnauthorizedMovement(
      motorcycleId,
      companyId,
      distanceMeters,
      durationSeconds,
      state,
      newLocation,
    );

    await this.motorcycleRepository.update(motorcycleId, {
      trackingStatus: MotorcycleTrackingStatus.UNAUTHORIZED_MOVEMENT,
    });

    await this.clearMovementState(motorcycleId);
  }

  async checkGpsOfflineDevices(): Promise<number> {
    const ops = this.configService.get('app.ops', { infer: true })!;
    const threshold = new Date(Date.now() - ops.gpsOfflineThresholdSeconds * 1000);

    const staleDevices = await this.gpsDeviceRepository
      .createQueryBuilder('d')
      .where('d.lastSeenAt IS NULL OR d.lastSeenAt < :threshold', { threshold })
      .getMany();

    let created = 0;
    for (const device of staleDevices) {
      const existing = await this.incidentRepository.findOne({
        where: {
          companyId: device.companyId,
          motorcycleId: device.motorcycleId,
          type: IncidentType.GPS_OFFLINE,
          status: In([IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED]),
        },
      });

      if (existing) {
        continue;
      }

      const incident = await this.incidentRepository.save(
        this.incidentRepository.create({
          companyId: device.companyId,
          motorcycleId: device.motorcycleId,
          type: IncidentType.GPS_OFFLINE,
          severity: IncidentSeverity.MEDIUM,
          status: IncidentStatus.OPEN,
          title: 'GPS device offline',
          description: 'GPS device has not reported location within threshold.',
          detectedAt: new Date(),
        }),
      );

      await this.notifyIncident(incident);
      created += 1;
    }

    this.logger.debug(`GPS offline check created ${created} incidents`);
    return created;
  }

  private async createOrUpdateUnauthorizedMovement(
    motorcycleId: string,
    companyId: string,
    distanceMeters: number,
    durationSeconds: number,
    startState: MovementState,
    endLocation: MovementLocationInput,
  ): Promise<void> {
    const existing = await this.incidentRepository.findOne({
      where: {
        companyId,
        motorcycleId,
        type: IncidentType.UNAUTHORIZED_MOVEMENT,
        status: In([IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED]),
      },
    });

    const metadata = {
      distanceMeters: Math.round(distanceMeters),
      durationSeconds: Math.round(durationSeconds),
      startPosition: { lat: startState.firstLat, lng: startState.firstLng },
      endPosition: { lat: endLocation.latitude, lng: endLocation.longitude },
      lastSeenAt: endLocation.recordedAt.toISOString(),
    };

    if (existing) {
      existing.metadata = { ...(existing.metadata ?? {}), ...metadata };
      existing.description = `Unauthorized movement detected: ${Math.round(distanceMeters)}m over ${Math.round(durationSeconds)}s`;
      await this.incidentRepository.save(existing);
      return;
    }

    const incident = await this.incidentRepository.save(
      this.incidentRepository.create({
        companyId,
        motorcycleId,
        type: IncidentType.UNAUTHORIZED_MOVEMENT,
        severity: IncidentSeverity.HIGH,
        status: IncidentStatus.OPEN,
        title: 'Unauthorized motorcycle movement',
        description: `Unauthorized movement detected: ${Math.round(distanceMeters)}m over ${Math.round(durationSeconds)}s`,
        detectedAt: new Date(),
        metadata,
      }),
    );

    await this.notifyIncident(incident);
  }

  private async notifyIncident(incident: Incident): Promise<void> {
    const dto = IncidentResponseDto.fromEntity(incident);

    this.realtimeService.emitToCompany(
      incident.companyId,
      REALTIME_EVENTS.INCIDENT_CREATED,
      dto,
    );

    const admins = await this.companyMemberRepository.find({
      where: {
        companyId: incident.companyId,
        role: In([UserRole.COMPANY_ADMIN, UserRole.SUPERVISOR]),
        status: MembershipStatus.ACTIVE,
      },
    });

    if (admins.length > 0) {
      await this.notificationsService.createForCompanyAdmins(
        incident.companyId,
        admins.map((a) => a.userId),
        {
          type: NotificationType.INCIDENT,
          title: incident.title,
          message: incident.description ?? incident.title,
          relatedEntityType: 'incident',
          relatedEntityId: incident.id,
        },
      );
    }
  }

  private movementKey(motorcycleId: string): string {
    return `movement:moto:${motorcycleId}`;
  }

  private async clearMovementState(motorcycleId: string): Promise<void> {
    await this.redis.del(this.movementKey(motorcycleId));
  }
}
