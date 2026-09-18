import { ConfigService } from '@nestjs/config';
import { GpsFilterService } from './gps-filter.service';

function makeService(
  overrides: Record<string, number> = {},
): GpsFilterService {
  const tracking = {
    accuracyThresholdMeters: 80,
    movingSpeedThresholdMps: 1.5,
    stoppedSpeedThresholdMps: 0.6,
    minDistanceIntervalMeters: 12,
    maxTeleportSpeedMps: 55,
    ...overrides,
  };
  const config = {
    get: () => tracking,
  } as unknown as ConfigService;
  return new GpsFilterService(config);
}

describe('GpsFilterService', () => {
  const base = {
    clientLocationId: '11111111-1111-1111-1111-111111111111',
    latitude: -1.95,
    longitude: 30.06,
    accuracy: 10,
    speed: 5,
    heading: 90,
    altitude: null,
    capturedAt: new Date('2026-01-01T10:00:00.000Z'),
  };

  it('accepts a valid first point', () => {
    const svc = makeService();
    const result = svc.validate(base, null);
    expect(result.accepted).toBe(true);
  });

  it('rejects invalid coordinates', () => {
    const svc = makeService();
    const result = svc.validate({ ...base, latitude: 120 }, null);
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('INVALID_COORDINATES');
  });

  it('rejects poor accuracy', () => {
    const svc = makeService();
    const result = svc.validate({ ...base, accuracy: 200 }, null);
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('POOR_ACCURACY');
  });

  it('rejects duplicate clientLocationId', () => {
    const svc = makeService();
    const result = svc.validate(base, {
      latitude: -1.95,
      longitude: 30.06,
      capturedAt: new Date('2026-01-01T09:59:50.000Z'),
      clientLocationId: base.clientLocationId,
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('DUPLICATE');
  });

  it('rejects teleport jumps', () => {
    const svc = makeService();
    const result = svc.validate(
      {
        ...base,
        clientLocationId: '22222222-2222-2222-2222-222222222222',
        latitude: -1.5,
        longitude: 30.5,
        capturedAt: new Date('2026-01-01T10:00:05.000Z'),
      },
      {
        latitude: base.latitude,
        longitude: base.longitude,
        capturedAt: base.capturedAt,
        clientLocationId: 'prev',
      },
    );
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('TELEPORT');
  });

  it('rejects out-of-order timestamps', () => {
    const svc = makeService();
    const result = svc.validate(
      {
        ...base,
        clientLocationId: '33333333-3333-3333-3333-333333333333',
        capturedAt: new Date('2026-01-01T09:00:00.000Z'),
      },
      {
        latitude: base.latitude,
        longitude: base.longitude,
        capturedAt: base.capturedAt,
        clientLocationId: 'prev',
      },
    );
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('OUT_OF_ORDER');
  });
});
