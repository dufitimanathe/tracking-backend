import { Module } from '@nestjs/common';
import { MapsService } from './maps.service';
import { GoogleRoutingProvider } from './providers/google-routing.provider';
import { HaversineRoutingProvider } from './providers/haversine-routing.provider';

@Module({
  providers: [HaversineRoutingProvider, GoogleRoutingProvider, MapsService],
  exports: [MapsService],
})
export class MapsModule {}
