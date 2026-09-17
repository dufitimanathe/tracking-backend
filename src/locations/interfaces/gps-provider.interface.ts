import { LocationSource } from '../../common/enums';

export interface NormalizedGpsPayload {
  externalDeviceId: string;
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  ignition?: boolean | null;
  recordedAt: Date;
  source: LocationSource;
}

export interface GpsProvider {
  readonly name: string;
  normalize(payload: Record<string, unknown>): NormalizedGpsPayload;
}
