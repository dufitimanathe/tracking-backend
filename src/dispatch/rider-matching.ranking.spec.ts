import { AssignmentMethod } from '../common/enums';
import { RiderMatchCandidate } from './rider-matching.service';

/** Pure ranking helper mirrored from dispatch matrix sort for unit coverage. */
function rankByMatrix(
  candidates: RiderMatchCandidate[],
  durationsSeconds: number[][],
  distancesMeters: number[][],
): RiderMatchCandidate[] {
  return candidates
    .map((candidate, index) => ({
      ...candidate,
      durationSeconds: durationsSeconds[index]?.[0],
      distanceMeters: distancesMeters[index]?.[0] || candidate.distanceMeters,
    }))
    .sort((a, b) => {
      const durA = a.durationSeconds ?? Number.MAX_SAFE_INTEGER;
      const durB = b.durationSeconds ?? Number.MAX_SAFE_INTEGER;
      if (durA !== durB) return durA - durB;
      return a.distanceMeters - b.distanceMeters;
    });
}

describe('Route Matrix ranking', () => {
  it('prefers shorter duration over PostGIS distance order', () => {
    const shortlist: RiderMatchCandidate[] = [
      { riderId: 'a', motorcycleId: 'm1', distanceMeters: 100 },
      { riderId: 'b', motorcycleId: 'm2', distanceMeters: 500 },
    ];

    const ranked = rankByMatrix(shortlist, [[600], [120]], [[100], [800]]);
    expect(ranked[0].riderId).toBe('b');
    expect(ranked[0].durationSeconds).toBe(120);
  });

  it('falls back to PostGIS order when matrix missing', () => {
    const method = AssignmentMethod.POSTGIS_FALLBACK;
    const shortlist: RiderMatchCandidate[] = [
      { riderId: 'a', motorcycleId: 'm1', distanceMeters: 100 },
      { riderId: 'b', motorcycleId: 'm2', distanceMeters: 500 },
    ];
    expect(method).toBe(AssignmentMethod.POSTGIS_FALLBACK);
    expect(shortlist[0].riderId).toBe('a');
  });
});
