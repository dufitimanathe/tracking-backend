import {
  classifyGpsAccuracy,
  shouldReplaceLiveLocation,
} from './gps-quality.util';

describe('gps-quality.util', () => {
  it('classifies accuracy bands', () => {
    expect(classifyGpsAccuracy(10)).toBe('excellent');
    expect(classifyGpsAccuracy(50)).toBe('acceptable');
    expect(classifyGpsAccuracy(120)).toBe('poor');
    expect(classifyGpsAccuracy(300)).toBe('very-poor');
    expect(classifyGpsAccuracy(600)).toBe('rejected');
  });

  it('keeps a recent good pin when the new reading is much worse', () => {
    const now = new Date('2026-01-01T10:00:20.000Z');
    const keep = shouldReplaceLiveLocation({
      incomingAccuracy: 280,
      currentAccuracy: 20,
      currentCapturedAt: new Date('2026-01-01T10:00:00.000Z'),
      now,
    });
    expect(keep).toBe(false);
  });

  it('replaces when the current pin is stale', () => {
    const now = new Date('2026-01-01T10:01:00.000Z');
    const replace = shouldReplaceLiveLocation({
      incomingAccuracy: 280,
      currentAccuracy: 20,
      currentCapturedAt: new Date('2026-01-01T10:00:00.000Z'),
      now,
    });
    expect(replace).toBe(true);
  });
});
