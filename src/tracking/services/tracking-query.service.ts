import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { LocationPing } from '../../locations/entities/location-ping.entity';
import { Motorcycle } from '../../motorcycles/entities/motorcycle.entity';
import { Rider } from '../../riders/entities/rider.entity';
import { User } from '../../users/entities/user.entity';
import { DriverStop } from '../entities/driver-stop.entity';
import { TrackingSession } from '../entities/tracking-session.entity';
import {
  TrackingMovementState,
  TrackingPresenceState,
} from '../../common/enums';
import { DistanceService } from './distance.service';
import {
  LiveDriverState,
  TrackingPresenceService,
} from './tracking-presence.service';
import { LocationsService } from '../../locations/locations.service';

@Injectable()
export class TrackingQueryService {
  constructor(
    @InjectRepository(LocationPing)
    private readonly pingRepository: Repository<LocationPing>,
    @InjectRepository(DriverStop)
    private readonly stopRepository: Repository<DriverStop>,
    @InjectRepository(TrackingSession)
    private readonly sessionRepository: Repository<TrackingSession>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(Motorcycle)
    private readonly motorcycleRepository: Repository<Motorcycle>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly presenceService: TrackingPresenceService,
    private readonly distanceService: DistanceService,
    private readonly locationsService: LocationsService,
  ) {}

  async getLive(companyId: string): Promise<LiveDriverState[]> {
    const fromRedis = await this.presenceService.listCompanyLive(companyId);
    if (fromRedis.length > 0) {
      return fromRedis;
    }

    const fleet = await this.locationsService.getLiveFleet(companyId);
    return fleet
      .filter((f) => f.riderId && f.latitude != null && f.longitude != null)
      .map((f): LiveDriverState => ({
        riderId: f.riderId!,
        motorcycleId: f.motorcycleId,
        companyId,
        trackingSessionId: '',
        latitude: f.latitude!,
        longitude: f.longitude!,
        speed: f.speed ?? null,
        heading: f.heading ?? null,
        accuracy: null,
        movementState:
          f.trackingStatus === 'MOVING'
            ? TrackingMovementState.MOVING
            : TrackingMovementState.TRACKING,
        presence:
          f.freshness === 'LIVE'
            ? TrackingPresenceState.LIVE
            : f.freshness === 'DELAYED'
              ? TrackingPresenceState.DELAYED
              : TrackingPresenceState.OFFLINE,
        capturedAt: f.recordedAt
          ? new Date(f.recordedAt).toISOString()
          : new Date().toISOString(),
        receivedAt: f.recordedAt
          ? new Date(f.recordedAt).toISOString()
          : new Date().toISOString(),
        totalDistanceMeters: 0,
        riderName: f.riderName ?? null,
        phone: null,
        plateNumber: f.plateNumber ?? null,
      }));
  }

  async getSessionRoute(
    companyId: string,
    sessionId: string,
    options?: { limit?: number; downsample?: boolean },
  ): Promise<
    Array<{
      latitude: number;
      longitude: number;
      speed: number | null;
      heading: number | null;
      accuracy: number | null;
      capturedAt: string;
    }>
  > {
    const limit = options?.limit ?? 2000;
    const points = await this.pingRepository.find({
      where: { companyId, trackingSessionId: sessionId },
      order: { recordedAt: 'ASC' },
      take: limit,
    });

    let selected = points;
    if (options?.downsample && points.length > 500) {
      const step = Math.ceil(points.length / 500);
      selected = points.filter((_, i) => i % step === 0 || i === points.length - 1);
    }

    return selected.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      speed: p.speed ?? null,
      heading: p.heading ?? null,
      accuracy: p.accuracy ?? null,
      capturedAt: p.recordedAt.toISOString(),
    }));
  }

  async getSessionStops(companyId: string, sessionId: string): Promise<DriverStop[]> {
    return this.stopRepository.find({
      where: { companyId, trackingSessionId: sessionId },
      order: { startedAt: 'ASC' },
    });
  }

  async riderStatistics(companyId: string, riderId: string) {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, week, month, sessions] = await Promise.all([
      this.distanceService.distanceSince(companyId, riderId, startOfDay, now),
      this.distanceService.distanceSince(companyId, riderId, startOfWeek, now),
      this.distanceService.distanceSince(companyId, riderId, startOfMonth, now),
      this.sessionRepository.find({
        where: {
          companyId,
          riderId,
          startedAt: Between(startOfMonth, now),
        },
      }),
    ]);

    const movingHours =
      sessions.reduce((s, x) => s + (x.movingDurationSeconds ?? 0), 0) / 3600;
    const stoppedHours =
      sessions.reduce((s, x) => s + (x.stoppedDurationSeconds ?? 0), 0) / 3600;
    const activeHours =
      sessions.reduce((s, x) => {
        const end = x.endedAt ?? now;
        return s + Math.max(0, (end.getTime() - x.startedAt.getTime()) / 1000);
      }, 0) / 3600;

    return {
      distanceTodayMeters: today,
      distanceWeekMeters: week,
      distanceMonthMeters: month,
      activeHours,
      movingHours,
      stoppedHours,
      tripCount: sessions.length,
    };
  }

  async motorcycleStatistics(companyId: string, motorcycleId: string) {
    const sessions = await this.sessionRepository.find({
      where: { companyId, motorcycleId },
      order: { startedAt: 'DESC' },
      take: 100,
    });
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const todaySessions = sessions.filter((s) => s.startedAt >= startOfDay);
    const distanceToday = todaySessions.reduce(
      (s, x) => s + (x.totalDistanceMeters ?? 0),
      0,
    );

    const moto = await this.motorcycleRepository.findOne({
      where: { id: motorcycleId, companyId },
    });
    const live = await this.presenceService.listCompanyLive(companyId);
    const driverLive = live.find((l) => l.motorcycleId === motorcycleId);

    return {
      distanceTodayMeters: distanceToday,
      distanceMonthMeters: sessions.reduce((s, x) => s + (x.totalDistanceMeters ?? 0), 0),
      assignedDriverId: driverLive?.riderId ?? null,
      lastKnownPosition: driverLive
        ? { latitude: driverLive.latitude, longitude: driverLive.longitude }
        : null,
      lastActiveAt: driverLive?.capturedAt ?? sessions[0]?.lastLocationAt?.toISOString() ?? null,
      plateNumber: moto?.plateNumber ?? null,
    };
  }

  async companyStatistics(companyId: string) {
    const live = await this.getLive(companyId);
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const todaySessions = await this.sessionRepository.find({
      where: { companyId, startedAt: Between(startOfDay, now) },
    });
    const distanceToday = todaySessions.reduce(
      (s, x) => s + (x.totalDistanceMeters ?? 0),
      0,
    );

    return {
      activeDrivers: live.filter((l) => l.presence !== 'OFFLINE').length,
      movingDrivers: live.filter((l) => l.movementState === 'MOVING').length,
      stoppedDrivers: live.filter((l) => l.movementState === 'STOPPED').length,
      offlineDrivers: live.filter((l) => l.presence === 'OFFLINE').length,
      delayedDrivers: live.filter((l) => l.presence === 'DELAYED').length,
      activeMotorcycles: new Set(live.map((l) => l.motorcycleId)).size,
      totalKilometresToday: distanceToday / 1000,
    };
  }
}
