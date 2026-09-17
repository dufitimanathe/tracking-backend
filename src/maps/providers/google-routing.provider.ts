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

@Injectable()
export class GoogleRoutingProvider implements RoutingProvider {
  private readonly logger = new Logger(GoogleRoutingProvider.name);
  private readonly apiKey: string;

  constructor(
    configService: ConfigService,
    private readonly fallback: HaversineRoutingProvider,
  ) {
    this.apiKey = configService.get<string>('app.integrations.googleMapsApiKey', { infer: true }) ?? '';
  }

  async geocode(address: string): Promise<GeocodeResult | null> {
    if (!this.apiKey) {
      return this.fallback.geocode(address);
    }

    try {
      const response = await axios.get<{ results: Array<{ formatted_address: string; geometry: { location: { lat: number; lng: number } } }> }>(
        'https://maps.googleapis.com/maps/api/geocode/json',
        { params: { address, key: this.apiKey } },
      );

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

    try {
      const response = await axios.get<{
        routes: Array<{
          legs: Array<{ distance: { value: number }; duration: { value: number } }>;
          overview_polyline?: { points: string };
        }>;
      }>('https://maps.googleapis.com/maps/api/directions/json', {
        params: {
          origin: `${origin.lat},${origin.lng}`,
          destination: `${destination.lat},${destination.lng}`,
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

  async calculateMatrix(
    origins: GeoCoordinate[],
    destinations: GeoCoordinate[],
  ): Promise<MatrixResult> {
    if (!this.apiKey) {
      return this.fallback.calculateMatrix(origins, destinations);
    }

    try {
      const response = await axios.get<{
        rows: Array<{ elements: Array<{ distance?: { value: number }; duration?: { value: number }; status: string }> }>;
      }>('https://maps.googleapis.com/maps/api/distancematrix/json', {
        params: {
          origins: origins.map((o) => `${o.lat},${o.lng}`).join('|'),
          destinations: destinations.map((d) => `${d.lat},${d.lng}`).join('|'),
          key: this.apiKey,
        },
      });

      const distancesMeters: number[][] = [];
      const durationsSeconds: number[][] = [];

      for (const row of response.data.rows) {
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
}
