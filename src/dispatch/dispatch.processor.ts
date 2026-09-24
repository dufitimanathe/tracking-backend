import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DISPATCH_QUEUE, DISPATCH_TIMEOUT_JOB } from './dispatch.constants';
import { DispatchService } from './dispatch.service';

interface DispatchTimeoutPayload {
  tripId: string;
  riderId: string;
  assignedAt?: string;
}

@Processor(DISPATCH_QUEUE)
export class DispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(DispatchProcessor.name);

  constructor(private readonly dispatchService: DispatchService) {
    super();
  }

  async process(job: Job<DispatchTimeoutPayload>): Promise<void> {
    if (job.name !== DISPATCH_TIMEOUT_JOB) {
      this.logger.warn(`Unknown dispatch job: ${job.name}`);
      return;
    }

    await this.dispatchService.handleOfferTimeout(
      job.data.tripId,
      job.data.riderId,
      job.data.assignedAt,
    );
  }
}
