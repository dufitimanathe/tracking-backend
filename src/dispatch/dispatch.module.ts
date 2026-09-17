import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '../common/redis/redis.module';
import { Rider } from '../riders/entities/rider.entity';
import { TransportRequest } from '../transport-requests/entities/transport-request.entity';
import { TripEventsModule } from '../trip-events/trip-events.module';
import { Trip } from '../trips/entities/trip.entity';
import { DISPATCH_QUEUE } from './dispatch.constants';
import { DispatchProcessor } from './dispatch.processor';
import { DispatchService } from './dispatch.service';
import { RiderMatchingService } from './rider-matching.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, Rider, TransportRequest]),
    BullModule.registerQueue({ name: DISPATCH_QUEUE }),
    TripEventsModule,
    RedisModule,
  ],
  providers: [DispatchService, RiderMatchingService, DispatchProcessor],
  exports: [DispatchService, RiderMatchingService],
})
export class DispatchModule {}
