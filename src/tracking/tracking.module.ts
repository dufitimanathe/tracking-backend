import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { LocationPing } from '../locations/entities/location-ping.entity';
import { MotorcycleCurrentLocation } from '../locations/entities/motorcycle-current-location.entity';
import { LocationsModule } from '../locations/locations.module';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { RiderMotorcycleAssignment } from '../rider-motorcycle-assignments/entities/rider-motorcycle-assignment.entity';
import { Rider } from '../riders/entities/rider.entity';
import { User } from '../users/entities/user.entity';
import { DriverStop } from './entities/driver-stop.entity';
import { GeocodeCache } from './entities/geocode-cache.entity';
import { GeofenceEvent } from './entities/geofence-event.entity';
import { Geofence } from './entities/geofence.entity';
import { TrackingSession } from './entities/tracking-session.entity';
import { DistanceService } from './services/distance.service';
import { GeofenceService } from './services/geofence.service';
import { GpsFilterService } from './services/gps-filter.service';
import { LocationIngestionService } from './services/location-ingestion.service';
import { MovementDetectionService } from './services/movement-detection.service';
import { ReverseGeocodingService } from './services/reverse-geocoding.service';
import { StopDetectionService } from './services/stop-detection.service';
import { TrackingPresenceService } from './services/tracking-presence.service';
import { TrackingQueryService } from './services/tracking-query.service';
import { TrackingSessionsService } from './services/tracking-sessions.service';
import { TrackingController } from './tracking.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TrackingSession,
      DriverStop,
      Geofence,
      GeofenceEvent,
      GeocodeCache,
      LocationPing,
      MotorcycleCurrentLocation,
      Rider,
      Motorcycle,
      RiderMotorcycleAssignment,
      User,
    ]),
    AuthGuardsModule,
    RealtimeModule,
    LocationsModule,
  ],
  controllers: [TrackingController],
  providers: [
    GpsFilterService,
    MovementDetectionService,
    StopDetectionService,
    DistanceService,
    TrackingPresenceService,
    ReverseGeocodingService,
    GeofenceService,
    TrackingSessionsService,
    LocationIngestionService,
    TrackingQueryService,
  ],
  exports: [
    TrackingSessionsService,
    LocationIngestionService,
    TrackingPresenceService,
    TrackingQueryService,
    GpsFilterService,
    DistanceService,
  ],
})
export class TrackingModule {}
