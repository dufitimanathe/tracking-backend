import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { haversineDistanceMeters, toPointGeoJson } from '../../common/utils/geo.util';
import { DriverStop } from '../entities/driver-stop.entity';

@Injectable()
export class StopDetectionService {
  constructor(
    @InjectRepository(DriverStop)
    private readonly stopRepository: Repository<DriverStop>,
    private readonly configService: ConfigService,
  ) {}

  private cfg() {
    return this.configService.get('app.tracking', { infer: true })!;
  }

  private async findOpenStop(trackingSessionId: string): Promise<DriverStop | null> {
    return this.stopRepository
      .createQueryBuilder('stop')
      .where('stop.trackingSessionId = :sessionId', { sessionId: trackingSessionId })
      .andWhere('stop.endedAt IS NULL')
      .orderBy('stop.startedAt', 'DESC')
      .getOne();
  }

  async onStopped(input: {
    companyId: string;
    riderId: string;
    motorcycleId: string;
    trackingSessionId: string;
    latitude: number;
    longitude: number;
    at: Date;
  }): Promise<DriverStop | null> {
    const openStop = await this.findOpenStop(input.trackingSessionId);

    if (openStop) {
      const dist = haversineDistanceMeters(
        openStop.latitude,
        openStop.longitude,
        input.latitude,
        input.longitude,
      );
      if (dist <= this.cfg().stopRadiusMeters) {
        return openStop;
      }
      openStop.endedAt = input.at;
      openStop.durationSeconds = Math.max(
        0,
        Math.round((input.at.getTime() - openStop.startedAt.getTime()) / 1000),
      );
      await this.stopRepository.save(openStop);
    }

    const stop = this.stopRepository.create({
      companyId: input.companyId,
      riderId: input.riderId,
      motorcycleId: input.motorcycleId,
      trackingSessionId: input.trackingSessionId,
      latitude: input.latitude,
      longitude: input.longitude,
      location: toPointGeoJson({ lat: input.latitude, lng: input.longitude }),
      startedAt: input.at,
    });
    return this.stopRepository.save(stop);
  }

  async onMoving(trackingSessionId: string, at: Date): Promise<DriverStop | null> {
    const openStop = await this.findOpenStop(trackingSessionId);
    if (!openStop) return null;

    const durationSec = Math.max(
      0,
      Math.round((at.getTime() - openStop.startedAt.getTime()) / 1000),
    );
    if (durationSec < this.cfg().stopMinDurationSeconds) {
      await this.stopRepository.remove(openStop);
      return null;
    }

    openStop.endedAt = at;
    openStop.durationSeconds = durationSec;
    return this.stopRepository.save(openStop);
  }
}
