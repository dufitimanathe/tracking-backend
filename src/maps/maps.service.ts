import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GeoCoordinate,
  GeocodeResult,
  MatrixResult,
  RouteResult,
  RoutingProvider,
} from './interfaces/routing-provider.interface';
import { GoogleRoutingProvider } from './providers/google-routing.provider';
import { HaversineRoutingProvider } from './providers/haversine-routing.provider';

export const ROUTING_PROVIDER = 'ROUTING_PROVIDER';

@Injectable()
export class MapsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly googleProvider: GoogleRoutingProvider,
    private readonly haversineProvider: HaversineRoutingProvider,
  ) {}

  getProvider(): RoutingProvider {
    const apiKey = this.configService.get<string>('app.integrations.googleMapsApiKey', {
      infer: true,
    });
    return apiKey ? this.googleProvider : this.haversineProvider;
  }

  geocode(address: string): Promise<GeocodeResult | null> {
    return this.getProvider().geocode(address);
  }

  calculateRoute(origin: GeoCoordinate, destination: GeoCoordinate): Promise<RouteResult> {
    return this.getProvider().calculateRoute(origin, destination);
  }

  calculateMatrix(
    origins: GeoCoordinate[],
    destinations: GeoCoordinate[],
  ): Promise<MatrixResult> {
    return this.getProvider().calculateMatrix(origins, destinations);
  }
}
