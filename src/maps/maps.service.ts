import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GeoCoordinate,
  GeocodeResult,
  MatrixResult,
  RouteResult,
  RoutingProvider,
} from './interfaces/routing-provider.interface';
import {
  LocationSearchOptions,
  PlaceCandidate,
} from './interfaces/location-provider.interface';
import { GooglePlacesProvider } from './providers/google-places.provider';
import { GoogleRoutingProvider } from './providers/google-routing.provider';
import { HaversineRoutingProvider } from './providers/haversine-routing.provider';
import { isOffRoute } from './utils/polyline.util';

export const ROUTING_PROVIDER = 'ROUTING_PROVIDER';

export interface MapsStatusDto {
  provider: 'google' | 'haversine';
  googleConfigured: boolean;
  trackingMode: 'phone_primary' | 'hardware_primary' | 'hybrid';
  routeDeviationThresholdMeters: number;
  /** Browser Maps JS key is configured on the frontend (NEXT_PUBLIC_*), not returned here. */
  notes: string[];
}

@Injectable()
export class MapsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly googleProvider: GoogleRoutingProvider,
    private readonly haversineProvider: HaversineRoutingProvider,
    private readonly placesProvider: GooglePlacesProvider,
  ) {}

  getProvider(): RoutingProvider {
    const apiKey = this.configService.get<string>('app.integrations.googleMapsApiKey', {
      infer: true,
    });
    return apiKey ? this.googleProvider : this.haversineProvider;
  }

  getStatus(): MapsStatusDto {
    const apiKey = this.configService.get<string>('app.integrations.googleMapsApiKey', {
      infer: true,
    });
    const tracking = this.configService.get('app.tracking', { infer: true })!;
    const googleConfigured = Boolean(apiKey);

    return {
      provider: googleConfigured ? 'google' : 'haversine',
      googleConfigured,
      trackingMode: tracking.mode,
      routeDeviationThresholdMeters: tracking.routeDeviationMeters,
      notes: [
        'Paste GOOGLE_MAPS_API_KEY in backend/.env (server key, IP-restricted).',
        'Paste NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in frontend/.env.local (browser key, HTTP-referrer-restricted).',
        'Enable: Maps JavaScript API, Geocoding API, Places API (New), Routes API (and optionally Distance Matrix / Directions).',
        'Primary location source is rider phone GPS via POST /locations/rider. Hardware GPS is optional.',
      ],
    };
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

  computeRouteMatrix(
    origins: GeoCoordinate[],
    destinations: GeoCoordinate[],
  ): Promise<MatrixResult> {
    const provider = this.getProvider();
    if (provider.computeRouteMatrix) {
      return provider.computeRouteMatrix(origins, destinations);
    }
    return provider.calculateMatrix(origins, destinations);
  }

  searchPlaces(options: LocationSearchOptions): Promise<PlaceCandidate[]> {
    return this.placesProvider.searchPlaces(options);
  }

  getPlaceDetails(placeId: string): Promise<PlaceCandidate | null> {
    return this.placesProvider.getPlaceDetails(placeId);
  }

  checkRouteDeviation(
    point: GeoCoordinate,
    encodedPolyline: string,
    thresholdMeters?: number,
  ) {
    const tracking = this.configService.get('app.tracking', { infer: true })!;
    const threshold = thresholdMeters ?? tracking.routeDeviationMeters;
    return isOffRoute(point, encodedPolyline, threshold);
  }
}
