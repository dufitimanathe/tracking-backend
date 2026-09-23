import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.constants';
import {
  TrackingMovementState,
  TrackingPresenceState,
} from '../../common/enums';

export interface LiveDriverState {
  riderId: string;
  motorcycleId: string;
  companyId: string;
  trackingSessionId: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  movementState: TrackingMovementState;
  presence: TrackingPresenceState;
  capturedAt: string;
  receivedAt: string;
  totalDistanceMeters: number;
  riderName?: string | null;
  phone?: string | null;
  plateNumber?: string | null;
  placeName?: string | null;
  /** ACTIVE while receiving pings; STALE when overdue; STOPPED when parked/ended. */
  sessionHealth?: 'ACTIVE' | 'STALE' | 'STOPPED' | null;
}

@Injectable()
export class TrackingPresenceService {
  private readonly logger = new Logger(TrackingPresenceService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  private cfg() {
    return this.configService.get('app.tracking', { infer: true })!;
  }

  driverKey(riderId: string): string {
    return `tracking:driver:${riderId}`;
  }

  companySetKey(companyId: string): string {
    return `tracking:company:${companyId}:drivers`;
  }

  presenceThresholds() {
    return this.cfg();
  }

  computePresence(capturedAt: Date, now = new Date()): TrackingPresenceState {
    const ageSec = Math.max(0, (now.getTime() - capturedAt.getTime()) / 1000);
    const t = this.cfg();
    if (ageSec <= t.presenceLiveSeconds) return TrackingPresenceState.LIVE;
    if (ageSec <= t.presenceDelayedSeconds) return TrackingPresenceState.DELAYED;
    if (ageSec <= t.presenceStaleSeconds) return TrackingPresenceState.STALE;
    return TrackingPresenceState.OFFLINE;
  }

  /** Coarse health for admin UI aligned to sparse ~10 min sharing. */
  computeSessionHealth(
    capturedAt: Date,
    now = new Date(),
  ): 'ACTIVE' | 'STALE' | 'STOPPED' {
    const ageSec = Math.max(0, (now.getTime() - capturedAt.getTime()) / 1000);
    const t = this.cfg();
    // ACTIVE within delayed window (~25 min default); else STALE until cleared.
    if (ageSec <= t.presenceDelayedSeconds) return 'ACTIVE';
    return 'STALE';
  }

  async setLiveState(state: LiveDriverState): Promise<void> {
    const ttl = this.cfg().redisTrackingTtlSeconds;
    const key = this.driverKey(state.riderId);
    try {
      await this.redis.set(key, JSON.stringify(state), 'EX', ttl);
      await this.redis.sadd(this.companySetKey(state.companyId), state.riderId);
    } catch (err) {
      this.logger.warn(`Redis live state write failed: ${(err as Error).message}`);
    }
  }

  async getLiveState(riderId: string): Promise<LiveDriverState | null> {
    try {
      const raw = await this.redis.get(this.driverKey(riderId));
      if (!raw) return null;
      const state = JSON.parse(raw) as LiveDriverState;
      state.presence = this.computePresence(new Date(state.capturedAt));
      return state;
    } catch {
      return null;
    }
  }

  async listCompanyLive(companyId: string): Promise<LiveDriverState[]> {
    try {
      const ids = await this.redis.smembers(this.companySetKey(companyId));
      if (!ids.length) return [];
      const pipeline = this.redis.pipeline();
      ids.forEach((id) => pipeline.get(this.driverKey(id)));
      const results = await pipeline.exec();
      const out: LiveDriverState[] = [];
      const staleIds: string[] = [];
      results?.forEach((res, idx) => {
        const [, value] = res ?? [];
        if (typeof value !== 'string') {
          staleIds.push(ids[idx]);
          return;
        }
        try {
          const state = JSON.parse(value) as LiveDriverState;
          state.presence = this.computePresence(new Date(state.capturedAt));
          out.push(state);
        } catch {
          staleIds.push(ids[idx]);
        }
      });
      if (staleIds.length) {
        await this.redis.srem(this.companySetKey(companyId), ...staleIds);
      }
      return out;
    } catch (err) {
      this.logger.warn(`Redis live list failed: ${(err as Error).message}`);
      return [];
    }
  }

  async clearDriver(companyId: string, riderId: string): Promise<void> {
    try {
      await this.redis.del(this.driverKey(riderId));
      await this.redis.srem(this.companySetKey(companyId), riderId);
    } catch {
      // ignore
    }
  }
}
