import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripEvent } from './entities/trip-event.entity';
import { TripEventsService } from './trip-events.service';

@Module({
  imports: [TypeOrmModule.forFeature([TripEvent])],
  providers: [TripEventsService],
  exports: [TripEventsService, TypeOrmModule],
})
export class TripEventsModule {}
