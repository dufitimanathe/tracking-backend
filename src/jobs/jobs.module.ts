import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DispatchModule } from '../dispatch/dispatch.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { ALL_QUEUES } from './jobs.constants';
import { JobsScheduler } from './jobs.scheduler';
import { GpsOfflineProcessor } from './processors/gps-offline.processor';
import {
  IncidentDetectionProcessor,
  InvoicesProcessor,
  NotificationsProcessor,
  WhatsappProcessor,
} from './processors/stub.processor';

@Module({
  imports: [
    BullModule.registerQueue(...ALL_QUEUES.map((name) => ({ name }))),
    IncidentsModule,
    DispatchModule,
  ],
  providers: [
    JobsScheduler,
    GpsOfflineProcessor,
    NotificationsProcessor,
    IncidentDetectionProcessor,
    InvoicesProcessor,
    WhatsappProcessor,
  ],
  exports: [BullModule],
})
export class JobsModule {}
