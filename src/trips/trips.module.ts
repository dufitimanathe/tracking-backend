import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { BillingModule } from '../billing/billing.module';
import { DispatchModule } from '../dispatch/dispatch.module';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Rider } from '../riders/entities/rider.entity';
import { TransportRequest } from '../transport-requests/entities/transport-request.entity';
import { TripEventsModule } from '../trip-events/trip-events.module';
import { Trip } from './entities/trip.entity';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, Rider, Motorcycle, TransportRequest]),
    AuthGuardsModule,
    TripEventsModule,
    DispatchModule,
    BillingModule,
    NotificationsModule,
  ],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
