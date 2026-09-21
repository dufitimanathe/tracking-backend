import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DispatchModule } from '../dispatch/dispatch.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TrackingModule } from '../tracking/tracking.module';
import { TrackingSession } from '../tracking/entities/tracking-session.entity';
import { ALL_QUEUES } from './jobs.constants';
import { JobsScheduler } from './jobs.scheduler';
import { GpsOfflineProcessor } from './processors/gps-offline.processor';
import { TrackingPresenceProcessor } from './processors/tracking-presence.processor';
import {
  IncidentDetectionProcessor,
  InvoicesProcessor,
  NotificationsProcessor,
} from './processors/stub.processor';

@Module({
  imports: [
    BullModule.registerQueue(...ALL_QUEUES.map((name) => ({ name }))),
    TypeOrmModule.forFeature([TrackingSession]),
    IncidentsModule,
    DispatchModule,
    TrackingModule,
    RealtimeModule,
  ],
  providers: [
    JobsScheduler,
    GpsOfflineProcessor,
    TrackingPresenceProcessor,
    NotificationsProcessor,
    IncidentDetectionProcessor,
    InvoicesProcessor,
  ],
  exports: [BullModule],
})
export class JobsModule {}
