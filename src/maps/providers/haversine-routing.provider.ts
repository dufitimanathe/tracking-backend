import { Injectable } from '@nestjs/common';
import { haversineDistanceMeters } from '../../common/utils/geo.util';
import {
  GeoCoordinate,
  GeocodeResult,
  MatrixResult,
  RouteResult,
  RoutingProvider,
} from '../interfaces/routing-provider.interface';

const AVERAGE_SPEED_MPS = 8.33; // ~30 km/h urban

@Injectable()
export class HaversineRoutingProvider implements RoutingProvider {
  async geocode(address: string): Promise<GeocodeResult | null> {
    const trimmed = address.trim();
    if (!trimmed) {
      return null;
    }

    return {
      address: trimmed,
      lat: -1.9441,
      lng: 30.0619,
      formattedAddress: trimmed,
    };
  }

  async calculateRoute(origin: GeoCoordinate, destination: GeoCoordinate): Promise<RouteResult> {
    const distanceMeters = haversineDistanceMeters(
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng,
    );
    const durationSeconds = Math.max(60, Math.round(distanceMeters / AVERAGE_SPEED_MPS));

    return {
      distanceMeters,
      durationSeconds,
      legs: [{ distanceMeters, durationSeconds }],
    };
  }

  async calculateMatrix(
    origins: GeoCoordinate[],
    destinations: GeoCoordinate[],
  ): Promise<MatrixResult> {
    const distancesMeters: number[][] = [];
    const durationsSeconds: number[][] = [];

    for (const origin of origins) {
      const rowDist: number[] = [];
      const rowDur: number[] = [];
      for (const destination of destinations) {
        const distance = haversineDistanceMeters(
          origin.lat,
          origin.lng,
          destination.lat,
          destination.lng,
        );
        rowDist.push(distance);
        rowDur.push(Math.max(60, Math.round(distance / AVERAGE_SPEED_MPS)));
      }
      distancesMeters.push(rowDist);
      durationsSeconds.push(rowDur);
    }

    return { origins, destinations, distancesMeters, durationsSeconds };
  }

  computeRouteMatrix(
    origins: GeoCoordinate[],
    destinations: GeoCoordinate[],
  ): Promise<MatrixResult> {
    return this.calculateMatrix(origins, destinations);
  }
}
