import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_WHATSAPP } from '../jobs/jobs.constants';
import {
  InboundWhatsAppJobPayload,
  WhatsAppOrchestrationService,
} from './whatsapp-orchestration.service';
import { WHATSAPP_PROCESS_INBOUND_JOB } from './whatsapp.service';

@Processor({ name: QUEUE_WHATSAPP })
export class WhatsappInboundProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsappInboundProcessor.name);

  constructor(private readonly orchestration: WhatsAppOrchestrationService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== WHATSAPP_PROCESS_INBOUND_JOB && job.name !== 'process-inbound') {
      this.logger.debug(`Ignoring WhatsApp job ${job.name}`);
      return;
    }

    await this.orchestration.processInbound(job.data as InboundWhatsAppJobPayload);
  }
}
