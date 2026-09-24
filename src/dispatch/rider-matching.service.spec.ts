import { RiderMatchingService } from './rider-matching.service';

describe('Rider matching', () => {
  it('ranks last-known positions without excluding stale or missing GPS', async () => {
    const repository = {
      query: jest.fn().mockResolvedValue([
        { riderId: 'unknown', motorcycleId: 'm0', lat: null, lng: null, age_seconds: null },
        { riderId: 'far', motorcycleId: 'm1', lat: -2, lng: 30, age_seconds: '172800' },
        { riderId: 'near', motorcycleId: 'm2', lat: -1.001, lng: 30, age_seconds: '86400' },
      ]),
    };
    const service = new RiderMatchingService(repository as never, {} as never, {} as never);
    const result = await service.findManualCandidates('company', -1, 30);
    expect(result.map((c) => c.riderId)).toEqual(['near', 'far', 'unknown']);
    expect(result[0].distanceMeters).toBeCloseTo(111, 0);
    expect(result[0].locationAgeSeconds).toBe(86400);
    expect(result[2].distanceMeters).toBeUndefined();
  });

  it('uses recorded GPS time and preserves route-duration ranking for automatic dispatch', async () => {
    const repository = {
      query: jest.fn().mockResolvedValue([
        {
          riderId: 'near',
          motorcycleId: 'm1',
          lat: -1,
          lng: 30,
          distance_meters: '100',
          age_seconds: '15',
        },
        {
          riderId: 'fast',
          motorcycleId: 'm2',
          lat: -1,
          lng: 30,
          distance_meters: '500',
          age_seconds: '20',
        },
      ]),
    };
    const maps = {
      computeRouteMatrix: jest
        .fn()
        .mockResolvedValue({ durationsSeconds: [[600], [120]], distancesMeters: [[100], [800]] }),
    };
    const service = new RiderMatchingService(
      repository as never,
      maps as never,
      { get: () => undefined } as never,
    );
    const result = await service.findAndRankCandidates('company', -1, 30, 10000);
    expect(result.candidates[0].riderId).toBe('fast');
    const [sql, params] = repository.query.mock.calls[0];
    expect(sql).toContain('cl."recordedAt"');
    expect(sql).not.toContain('cl."createdAt"');
    expect(params).toEqual(['company', 30, -1, 10000, 60, 10]);
  });
});
