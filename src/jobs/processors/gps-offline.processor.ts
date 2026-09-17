import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { IncidentDetectionService } from '../../incidents/incident-detection.service';
import { QUEUE_GPS_PROCESSING } from '../jobs.constants';

@Processor(QUEUE_GPS_PROCESSING)
export class GpsOfflineProcessor extends WorkerHost {
  private readonly logger = new Logger(GpsOfflineProcessor.name);

  constructor(private readonly incidentDetectionService: IncidentDetectionService) {
    super();
  }

  async process(job: Job): Promise<{ created: number }> {
    if (job.name === 'gps-offline-check') {
      const created = await this.incidentDetectionService.checkGpsOfflineDevices();
      this.logger.debug(`GPS offline job created ${created} incidents`);
      return { created };
    }

    this.logger.warn(`Unknown GPS processing job: ${job.name}`);
    return { created: 0 };
  }
}
