import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { haversineDistanceMeters } from '../../common/utils/geo.util';

export interface RawLocationSample {
  clientLocationId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  altitude?: number | null;
  capturedAt: Date;
}

export interface AcceptedLocationSample extends RawLocationSample {
  computedSpeedMps: number | null;
  distanceFromPreviousMeters: number;
}

export type GpsRejectReason =
  | 'INVALID_COORDINATES'
  | 'POOR_ACCURACY'
  | 'DUPLICATE'
  | 'OUT_OF_ORDER'
  | 'TELEPORT'
  | 'UNREALISTIC_SPEED'
  | 'TOO_CLOSE';

@Injectable()
export class GpsFilterService {
  constructor(private readonly configService: ConfigService) {}

  private cfg() {
    return this.configService.get('app.tracking', { infer: true })!;
  }

  validate(
    sample: RawLocationSample,
    previous?: {
      latitude: number;
      longitude: number;
      capturedAt: Date;
      clientLocationId?: string | null;
    } | null,
  ): { accepted: true; value: AcceptedLocationSample } | { accepted: false; reason: GpsRejectReason } {
    const { latitude, longitude, accuracy, capturedAt, clientLocationId } = sample;
    const tracking = this.cfg();

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return { accepted: false, reason: 'INVALID_COORDINATES' };
    }

    // Later pings: reject poor accuracy. First session fix always allowed so live map gets a pin.
    if (
      previous &&
      accuracy != null &&
      Number.isFinite(accuracy) &&
      accuracy > tracking.accuracyThresholdMeters
    ) {
      return { accepted: false, reason: 'POOR_ACCURACY' };
    }

    if (
      previous?.clientLocationId &&
      clientLocationId &&
      previous.clientLocationId === clientLocationId
    ) {
      return { accepted: false, reason: 'DUPLICATE' };
    }

    if (previous && capturedAt.getTime() < previous.capturedAt.getTime() - 2000) {
      return { accepted: false, reason: 'OUT_OF_ORDER' };
    }

    let distanceFromPreviousMeters = 0;
    let computedSpeedMps: number | null =
      sample.speed != null && Number.isFinite(sample.speed) ? sample.speed : null;

    if (previous) {
      distanceFromPreviousMeters = haversineDistanceMeters(
        previous.latitude,
        previous.longitude,
        latitude,
        longitude,
      );
      const elapsedSec = Math.max(
        (capturedAt.getTime() - previous.capturedAt.getTime()) / 1000,
        0.001,
      );

      if (
        distanceFromPreviousMeters < tracking.minDistanceIntervalMeters &&
        elapsedSec < 20
      ) {
        return { accepted: false, reason: 'TOO_CLOSE' };
      }

      const derivedSpeed = distanceFromPreviousMeters / elapsedSec;
      if (computedSpeedMps == null) {
        computedSpeedMps = derivedSpeed;
      }

      if (derivedSpeed > tracking.maxTeleportSpeedMps) {
        return { accepted: false, reason: 'TELEPORT' };
      }

      if (computedSpeedMps > tracking.maxTeleportSpeedMps) {
        return { accepted: false, reason: 'UNREALISTIC_SPEED' };
      }
    }

    return {
      accepted: true,
      value: {
        ...sample,
        computedSpeedMps,
        distanceFromPreviousMeters,
      },
    };
  }
}
