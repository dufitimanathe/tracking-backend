import { TripStatus } from '../common/enums';
import { TripInvalidStateException } from '../common/exceptions/domain.exception';
import { assertTransition, isTerminalStatus } from './trip-state-machine';

describe('trip-state-machine', () => {
  describe('assertTransition', () => {
    it('allows valid transitions from SEARCHING_RIDER', () => {
      expect(() =>
        assertTransition(TripStatus.SEARCHING_RIDER, TripStatus.RIDER_ASSIGNED),
      ).not.toThrow();
      expect(() =>
        assertTransition(TripStatus.SEARCHING_RIDER, TripStatus.NO_RIDER_AVAILABLE),
      ).not.toThrow();
      expect(() =>
        assertTransition(TripStatus.SEARCHING_RIDER, TripStatus.CANCELLED),
      ).not.toThrow();
    });

    it('allows decline flow back to SEARCHING_RIDER', () => {
      expect(() =>
        assertTransition(TripStatus.RIDER_ASSIGNED, TripStatus.SEARCHING_RIDER),
      ).not.toThrow();
    });

    it('allows full happy-path progression', () => {
      const path: TripStatus[] = [
        TripStatus.SEARCHING_RIDER,
        TripStatus.RIDER_ASSIGNED,
        TripStatus.RIDER_ACCEPTED,
        TripStatus.RIDER_TO_PICKUP,
        TripStatus.RIDER_ARRIVED,
        TripStatus.IN_PROGRESS,
        TripStatus.COMPLETED,
      ];

      for (let index = 1; index < path.length; index += 1) {
        expect(() => assertTransition(path[index - 1], path[index])).not.toThrow();
      }
    });

    it('throws TripInvalidStateException for invalid transitions', () => {
      expect(() =>
        assertTransition(TripStatus.COMPLETED, TripStatus.IN_PROGRESS),
      ).toThrow(TripInvalidStateException);
      expect(() =>
        assertTransition(TripStatus.SEARCHING_RIDER, TripStatus.IN_PROGRESS),
      ).toThrow(TripInvalidStateException);
    });
  });

  describe('isTerminalStatus', () => {
    it('returns true for terminal statuses', () => {
      expect(isTerminalStatus(TripStatus.COMPLETED)).toBe(true);
      expect(isTerminalStatus(TripStatus.CANCELLED)).toBe(true);
      expect(isTerminalStatus(TripStatus.NO_RIDER_AVAILABLE)).toBe(true);
    });

    it('returns false for active statuses', () => {
      expect(isTerminalStatus(TripStatus.SEARCHING_RIDER)).toBe(false);
      expect(isTerminalStatus(TripStatus.IN_PROGRESS)).toBe(false);
    });
  });
});
