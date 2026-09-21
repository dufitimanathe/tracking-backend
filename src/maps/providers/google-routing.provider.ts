import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  GeoCoordinate,
  GeocodeResult,
  MatrixResult,
  RouteResult,
  RoutingProvider,
} from '../interfaces/routing-provider.interface';
import { HaversineRoutingProvider } from './haversine-routing.provider';

/**
 * Google Maps Platform provider.
 * Prefers Routes API (computeRoutes) for road distance/ETA/polyline;
 * falls back to Directions API, then Haversine.
 *
 * Paste your server key into GOOGLE_MAPS_API_KEY (backend/.env).
 * Restrict that key by server IP in Google Cloud Console.
 */
@Injectable()
export class GoogleRoutingProvider implements RoutingProvider {
  private readonly logger = new Logger(GoogleRoutingProvider.name);
  private readonly apiKey: string;

  constructor(
    configService: ConfigService,
    private readonly fallback: HaversineRoutingProvider,
  ) {
    this.apiKey =
      configService.get<string>('app.integrations.googleMapsApiKey', { infer: true }) ?? '';
  }

  async geocode(address: string): Promise<GeocodeResult | null> {
    if (!this.apiKey) {
      return this.fallback.geocode(address);
    }

    try {
      const response = await axios.get<{
        results: Array<{
          formatted_address: string;
          geometry: { location: { lat: number; lng: number } };
        }>;
        status: string;
      }>('https://maps.googleapis.com/maps/api/geocode/json', {
        params: { address, key: this.apiKey },
      });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        this.logger.warn(`Google geocode status=${response.data.status}`);
      }

      const result = response.data.results[0];
      if (!result) {
        return null;
      }

      return {
        address,
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
      };
    } catch (error) {
      this.logger.warn(`Google geocode failed, using fallback: ${String(error)}`);
      return this.fallback.geocode(address);
    }
  }

  async calculateRoute(origin: GeoCoordinate, destination: GeoCoordinate): Promise<RouteResult> {
    if (!this.apiKey) {
      return this.fallback.calculateRoute(origin, destination);
    }

    const routesApiResult = await this.computeRoutesApi(origin, destination);
    if (routesApiResult) {
      return routesApiResult;
    }

    return this.computeDirectionsApi(origin, destination);
  }

  async calculateMatrix(
    origins: GeoCoordinate[],
    destinations: GeoCoordinate[],
  ): Promise<MatrixResult> {
    if (!this.apiKey) {
      return this.fallback.calculateMatrix(origins, destinations);
    }

    try {
      const response = await axios.get<{
        rows: Array<{
          elements: Array<{
            distance?: { value: number };
            duration?: { value: number };
            status: string;
          }>;
        }>;
        status: string;
      }>('https://maps.googleapis.com/maps/api/distancematrix/json', {
        params: {
          origins: origins.map((o) => `${o.lat},${o.lng}`).join('|'),
          destinations: destinations.map((d) => `${d.lat},${d.lng}`).join('|'),
          mode: 'driving',
          key: this.apiKey,
        },
      });

      const distancesMeters: number[][] = [];
      const durationsSeconds: number[][] = [];

      for (const row of response.data.rows ?? []) {
        const distRow: number[] = [];
        const durRow: number[] = [];
        for (const element of row.elements) {
          if (element.status === 'OK' && element.distance && element.duration) {
            distRow.push(element.distance.value);
            durRow.push(element.duration.value);
          } else {
            distRow.push(0);
            durRow.push(0);
          }
        }
        distancesMeters.push(distRow);
        durationsSeconds.push(durRow);
      }

      return { origins, destinations, distancesMeters, durationsSeconds };
    } catch (error) {
      this.logger.warn(`Google matrix failed, using fallback: ${String(error)}`);
      return this.fallback.calculateMatrix(origins, destinations);
    }
  }

  computeRouteMatrix(
    origins: GeoCoordinate[],
    destinations: GeoCoordinate[],
  ): Promise<MatrixResult> {
    return this.calculateMatrix(origins, destinations);
  }

  /** Preferred: Routes API v2 (enable "Routes API" in Google Cloud Console). */
  private async computeRoutesApi(
    origin: GeoCoordinate,
    destination: GeoCoordinate,
  ): Promise<RouteResult | null> {
    try {
      const response = await axios.post<{
        routes?: Array<{
          distanceMeters?: number;
          duration?: string;
          polyline?: { encodedPolyline?: string };
          legs?: Array<{ distanceMeters?: number; duration?: string }>;
        }>;
        error?: { message?: string };
      }>(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          origin: {
            location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
          },
          destination: {
            location: {
              latLng: { latitude: destination.lat, longitude: destination.lng },
            },
          },
          // TWO_WHEELER is ideal for motorcycles when available in the region.
          travelMode: 'TWO_WHEELER',
          routingPreference: 'TRAFFIC_AWARE',
          languageCode: 'en',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask':
              'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters',
          },
          validateStatus: (status) => status < 500,
        },
      );

      if (response.status >= 400 || !response.data.routes?.[0]) {
        // Retry once as DRIVE if TWO_WHEELER unsupported in region.
        if (response.status === 400) {
          return this.computeRoutesApiAsDrive(origin, destination);
        }
        this.logger.debug(
          `Routes API unavailable (${response.status}), falling back to Directions`,
        );
        return null;
      }

      return this.mapRoutesApiResponse(response.data.routes[0]);
    } catch (error) {
      this.logger.debug(`Routes API error, falling back to Directions: ${String(error)}`);
      return null;
    }
  }

  private async computeRoutesApiAsDrive(
    origin: GeoCoordinate,
    destination: GeoCoordinate,
  ): Promise<RouteResult | null> {
    try {
      const response = await axios.post<{
        routes?: Array<{
          distanceMeters?: number;
          duration?: string;
          polyline?: { encodedPolyline?: string };
          legs?: Array<{ distanceMeters?: number; duration?: string }>;
        }>;
      }>(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          origin: {
            location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
          },
          destination: {
            location: {
              latLng: { latitude: destination.lat, longitude: destination.lng },
            },
          },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          languageCode: 'en',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask':
              'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters',
          },
        },
      );

      const route = response.data.routes?.[0];
      return route ? this.mapRoutesApiResponse(route) : null;
    } catch {
      return null;
    }
  }

  private mapRoutesApiResponse(route: {
    distanceMeters?: number;
    duration?: string;
    polyline?: { encodedPolyline?: string };
    legs?: Array<{ distanceMeters?: number; duration?: string }>;
  }): RouteResult {
    const durationSeconds = this.parseDurationSeconds(route.duration);
    return {
      distanceMeters: route.distanceMeters ?? 0,
      durationSeconds,
      polyline: route.polyline?.encodedPolyline,
      legs: route.legs?.map((leg) => ({
        distanceMeters: leg.distanceMeters ?? 0,
        durationSeconds: this.parseDurationSeconds(leg.duration),
      })),
    };
  }

  /** Legacy Directions API fallback. */
  private async computeDirectionsApi(
    origin: GeoCoordinate,
    destination: GeoCoordinate,
  ): Promise<RouteResult> {
    try {
      const response = await axios.get<{
        routes: Array<{
          legs: Array<{ distance: { value: number }; duration: { value: number } }>;
          overview_polyline?: { points: string };
        }>;
        status: string;
      }>('https://maps.googleapis.com/maps/api/directions/json', {
        params: {
          origin: `${origin.lat},${origin.lng}`,
          destination: `${destination.lat},${destination.lng}`,
          mode: 'driving',
          key: this.apiKey,
        },
      });

      const route = response.data.routes[0];
      if (!route) {
        return this.fallback.calculateRoute(origin, destination);
      }

      const distanceMeters = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0);
      const durationSeconds = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0);

      return {
        distanceMeters,
        durationSeconds,
        polyline: route.overview_polyline?.points,
        legs: route.legs.map((leg) => ({
          distanceMeters: leg.distance.value,
          durationSeconds: leg.duration.value,
        })),
      };
    } catch (error) {
      this.logger.warn(`Google directions failed, using fallback: ${String(error)}`);
      return this.fallback.calculateRoute(origin, destination);
    }
  }

  private parseDurationSeconds(duration?: string): number {
    if (!duration) {
      return 0;
    }
    // Routes API returns e.g. "123s"
    const match = /^(\d+(?:\.\d+)?)s$/.exec(duration);
    if (match) {
      return Math.round(Number(match[1]));
    }
    return 0;
  }
}
