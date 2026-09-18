import { Module } from '@nestjs/common';
import { MapsController } from './maps.controller';
import { MapsService } from './maps.service';
import { GoogleRoutingProvider } from './providers/google-routing.provider';
import { HaversineRoutingProvider } from './providers/haversine-routing.provider';

@Module({
  controllers: [MapsController],
  providers: [HaversineRoutingProvider, GoogleRoutingProvider, MapsService],
  exports: [MapsService],
})
export class MapsModule {}
