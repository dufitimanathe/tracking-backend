import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor({ name: 'notifications' })
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  async process(job: Job): Promise<void> {
    this.logger.debug(`Notifications stub job ${job.name} received`);
  }
}

@Processor({ name: 'incident-detection' })
export class IncidentDetectionProcessor extends WorkerHost {
  private readonly logger = new Logger(IncidentDetectionProcessor.name);

  async process(job: Job): Promise<void> {
    this.logger.debug(`Incident detection stub job ${job.name} received`);
  }
}

@Processor({ name: 'invoices' })
export class InvoicesProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoicesProcessor.name);

  async process(job: Job): Promise<void> {
    this.logger.debug(`Invoices stub job ${job.name} received`);
  }
}
