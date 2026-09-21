import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '../common/redis/redis.module';
import { MapsModule } from '../maps/maps.module';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { Rider } from '../riders/entities/rider.entity';
import { TransportRequest } from '../transport-requests/entities/transport-request.entity';
import { TripEventsModule } from '../trip-events/trip-events.module';
import { Trip } from '../trips/entities/trip.entity';
import { User } from '../users/entities/user.entity';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { DISPATCH_QUEUE } from './dispatch.constants';
import { DispatchProcessor } from './dispatch.processor';
import { DispatchService } from './dispatch.service';
import { AssignmentAttempt } from './entities/assignment-attempt.entity';
import { RiderMatchingService } from './rider-matching.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Trip,
      Rider,
      TransportRequest,
      AssignmentAttempt,
      Motorcycle,
      User,
    ]),
    BullModule.registerQueue({ name: DISPATCH_QUEUE }),
    TripEventsModule,
    RedisModule,
    MapsModule,
    forwardRef(() => WhatsappModule),
  ],
  providers: [DispatchService, RiderMatchingService, DispatchProcessor],
  exports: [DispatchService, RiderMatchingService],
})
export class DispatchModule {}
