export const GPS_QUALITY = {
  excellentAccuracy: 25,
  acceptableAccuracy: 80,
  poorAccuracy: 200,
  rejectAccuracy: 500,
  staleAfterMs: 30_000,
} as const;

export type GpsQualityBand =
  | 'excellent'
  | 'acceptable'
  | 'poor'
  | 'very-poor'
  | 'rejected';

export function classifyGpsAccuracy(
  accuracy: number | null | undefined,
): GpsQualityBand {
  if (accuracy == null || !Number.isFinite(accuracy) || accuracy < 0) {
    return 'acceptable';
  }
  if (accuracy > GPS_QUALITY.rejectAccuracy) return 'rejected';
  if (accuracy <= GPS_QUALITY.excellentAccuracy) return 'excellent';
  if (accuracy <= GPS_QUALITY.acceptableAccuracy) return 'acceptable';
  if (accuracy <= GPS_QUALITY.poorAccuracy) return 'poor';
  return 'very-poor';
}

/**
 * Keep a recent, more accurate live pin when the new fix is much worse.
 * Lat/lng are never swapped — only accuracy/recency decides replacement.
 */
export function shouldReplaceLiveLocation(input: {
  incomingAccuracy: number | null | undefined;
  currentAccuracy: number | null | undefined;
  currentCapturedAt: Date | null | undefined;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  const incoming = input.incomingAccuracy;
  const current = input.currentAccuracy;

  if (incoming != null && incoming > GPS_QUALITY.rejectAccuracy) {
    return false;
  }

  if (!input.currentCapturedAt || current == null || !Number.isFinite(current)) {
    return true;
  }

  const ageMs = now.getTime() - input.currentCapturedAt.getTime();
  if (ageMs >= GPS_QUALITY.staleAfterMs) {
    return true;
  }

  if (incoming == null || !Number.isFinite(incoming)) {
    return true;
  }

  // Don't let a much worse reading replace a good recent one.
  if (incoming > current * 2 && current <= GPS_QUALITY.acceptableAccuracy) {
    return false;
  }

  // Approximate (>200 m) must not overwrite a recent acceptable-or-better pin.
  if (
    incoming > GPS_QUALITY.poorAccuracy &&
    current <= GPS_QUALITY.acceptableAccuracy
  ) {
    return false;
  }

  return true;
}
