import { TripStatus } from '../common/enums';
import { TripInvalidStateException } from '../common/exceptions/domain.exception';

const VALID_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  [TripStatus.SEARCHING_RIDER]: [
    TripStatus.RIDER_ASSIGNED,
    TripStatus.NO_RIDER_AVAILABLE,
    TripStatus.CANCELLED,
  ],
  [TripStatus.RIDER_ASSIGNED]: [
    TripStatus.RIDER_ACCEPTED,
    TripStatus.SEARCHING_RIDER,
    TripStatus.CANCELLED,
  ],
  [TripStatus.RIDER_ACCEPTED]: [TripStatus.RIDER_TO_PICKUP, TripStatus.CANCELLED],
  [TripStatus.RIDER_TO_PICKUP]: [TripStatus.RIDER_ARRIVED, TripStatus.CANCELLED],
  [TripStatus.RIDER_ARRIVED]: [TripStatus.IN_PROGRESS, TripStatus.CANCELLED],
  [TripStatus.IN_PROGRESS]: [TripStatus.COMPLETED, TripStatus.CANCELLED],
  [TripStatus.COMPLETED]: [],
  [TripStatus.CANCELLED]: [],
  [TripStatus.NO_RIDER_AVAILABLE]: [],
};

const TERMINAL_STATUSES = new Set<TripStatus>([
  TripStatus.COMPLETED,
  TripStatus.CANCELLED,
  TripStatus.NO_RIDER_AVAILABLE,
]);

export function assertTransition(from: TripStatus, to: TripStatus): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new TripInvalidStateException(
      `Cannot transition trip from ${from} to ${to}.`,
    );
  }
}

export function isTerminalStatus(status: TripStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
