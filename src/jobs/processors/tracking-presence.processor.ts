import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { REDIS_CLIENT } from '../../common/redis/redis.constants';
import { TrackingPresenceState, TrackingSessionStatus } from '../../common/enums';
import { REALTIME_EVENTS } from '../../realtime/realtime.constants';
import { RealtimeService } from '../../realtime/realtime.service';
import { TrackingSession } from '../../tracking/entities/tracking-session.entity';
import {
  LiveDriverState,
  TrackingPresenceService,
} from '../../tracking/services/tracking-presence.service';
import { QUEUE_TRACKING_PRESENCE } from '../jobs.constants';

@Processor(QUEUE_TRACKING_PRESENCE)
export class TrackingPresenceProcessor extends WorkerHost {
  private readonly logger = new Logger(TrackingPresenceProcessor.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(TrackingSession)
    private readonly sessionRepository: Repository<TrackingSession>,
    private readonly presenceService: TrackingPresenceService,
    private readonly realtimeService: RealtimeService,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const active = await this.sessionRepository.find({
      where: { status: TrackingSessionStatus.ACTIVE },
      take: 500,
    });

    for (const session of active) {
      const state = await this.presenceService.getLiveState(session.riderId);
      if (!state) {
        if (
          session.lastLocationAt &&
          Date.now() - session.lastLocationAt.getTime() >
            this.presenceService['cfg']().presenceOfflineSeconds * 1000
        ) {
          this.realtimeService.emitToCompany(
            session.companyId,
            REALTIME_EVENTS.TRACKING_DRIVER_OFFLINE,
            {
              riderId: session.riderId,
              motorcycleId: session.motorcycleId,
              sessionId: session.id,
            },
          );
        }
        continue;
      }

      const previous = state.presence;
      const next = this.presenceService.computePresence(new Date(state.capturedAt));
      if (previous !== next) {
        const updated: LiveDriverState = { ...state, presence: next };
        await this.presenceService.setLiveState(updated);
        this.realtimeService.emitToCompany(
          session.companyId,
          REALTIME_EVENTS.TRACKING_DRIVER_STATUS,
          {
            riderId: session.riderId,
            motorcycleId: session.motorcycleId,
            presence: next,
            movementState: state.movementState,
          },
        );
        if (next === TrackingPresenceState.OFFLINE) {
          this.realtimeService.emitToCompany(
            session.companyId,
            REALTIME_EVENTS.TRACKING_DRIVER_OFFLINE,
            { riderId: session.riderId, motorcycleId: session.motorcycleId },
          );
        }
        if (
          previous === TrackingPresenceState.OFFLINE &&
          next === TrackingPresenceState.LIVE
        ) {
          this.realtimeService.emitToCompany(
            session.companyId,
            REALTIME_EVENTS.TRACKING_DRIVER_ONLINE,
            { riderId: session.riderId, motorcycleId: session.motorcycleId },
          );
        }
      }
    }

    this.logger.debug(`Presence sweep checked ${active.length} active sessions`);
    void this.redis;
  }
}
