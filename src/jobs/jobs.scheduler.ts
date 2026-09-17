import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { QUEUE_GPS_PROCESSING } from './jobs.constants';

@Injectable()
export class JobsScheduler implements OnModuleInit {
  constructor(
    @InjectQueue(QUEUE_GPS_PROCESSING) private readonly gpsQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.configService.get<boolean>('app.workerMode', { infer: true })) {
      return;
    }

    await this.gpsQueue.add(
      'gps-offline-check',
      {},
      {
        repeat: { every: 60_000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  }
}
