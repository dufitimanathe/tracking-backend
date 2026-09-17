import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { GpsDevice } from '../gps-devices/entities/gps-device.entity';
import { IncidentsModule } from '../incidents/incidents.module';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { RiderMotorcycleAssignment } from '../rider-motorcycle-assignments/entities/rider-motorcycle-assignment.entity';
import { Rider } from '../riders/entities/rider.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { User } from '../users/entities/user.entity';
import { LocationPing } from './entities/location-ping.entity';
import { MotorcycleCurrentLocation } from './entities/motorcycle-current-location.entity';
import { GpsWebhookController } from './gps-webhook.controller';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { MockGpsProvider } from './providers/mock-gps.provider';

@Module({
  imports: [
    AuthGuardsModule,
    RealtimeModule,
    forwardRef(() => IncidentsModule),
    TypeOrmModule.forFeature([
      LocationPing,
      MotorcycleCurrentLocation,
      Rider,
      RiderMotorcycleAssignment,
      Motorcycle,
      GpsDevice,
      User,
    ]),
  ],
  controllers: [LocationsController, GpsWebhookController],
  providers: [LocationsService, MockGpsProvider],
  exports: [LocationsService],
})
export class LocationsModule {}
