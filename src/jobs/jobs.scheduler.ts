import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { QUEUE_GPS_PROCESSING, QUEUE_TRACKING_PRESENCE } from './jobs.constants';

@Injectable()
export class JobsScheduler implements OnModuleInit {
  constructor(
    @InjectQueue(QUEUE_GPS_PROCESSING) private readonly gpsQueue: Queue,
    @InjectQueue(QUEUE_TRACKING_PRESENCE) private readonly presenceQueue: Queue,
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

    await this.presenceQueue.add(
      'tracking-presence-sweep',
      {},
      {
        repeat: { every: 20_000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  }
}
