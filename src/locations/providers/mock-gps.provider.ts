import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { LocationSource } from '../../common/enums';
import { DomainException } from '../../common/exceptions/domain.exception';
import { ErrorCode } from '../../common/enums';
import {
  GpsProvider,
  NormalizedGpsPayload,
} from '../interfaces/gps-provider.interface';

@Injectable()
export class MockGpsProvider implements GpsProvider {
  readonly name = 'mock';

  normalize(payload: Record<string, unknown>): NormalizedGpsPayload {
    const deviceId = String(payload.deviceId ?? payload.externalDeviceId ?? '');
    const latitude = Number(payload.latitude ?? payload.lat);
    const longitude = Number(payload.longitude ?? payload.lng ?? payload.lon);

    if (!deviceId || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Invalid GPS payload: deviceId, latitude and longitude are required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const recordedAtRaw = payload.recordedAt ?? payload.timestamp ?? new Date().toISOString();

    return {
      externalDeviceId: deviceId,
      latitude,
      longitude,
      speed: payload.speed != null ? Number(payload.speed) : null,
      heading: payload.heading != null ? Number(payload.heading) : null,
      accuracy: payload.accuracy != null ? Number(payload.accuracy) : null,
      ignition: payload.ignition != null ? Boolean(payload.ignition) : null,
      recordedAt: new Date(String(recordedAtRaw)),
      source: LocationSource.GPS_DEVICE,
    };
  }
}
