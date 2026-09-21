import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeocodeCache } from '../tracking/entities/geocode-cache.entity';
import { MapsController } from './maps.controller';
import { MapsService } from './maps.service';
import { GooglePlacesProvider } from './providers/google-places.provider';
import { GoogleRoutingProvider } from './providers/google-routing.provider';
import { HaversineRoutingProvider } from './providers/haversine-routing.provider';

@Module({
  imports: [TypeOrmModule.forFeature([GeocodeCache])],
  controllers: [MapsController],
  providers: [
    HaversineRoutingProvider,
    GoogleRoutingProvider,
    GooglePlacesProvider,
    MapsService,
  ],
  exports: [MapsService, GooglePlacesProvider],
})
export class MapsModule {}
