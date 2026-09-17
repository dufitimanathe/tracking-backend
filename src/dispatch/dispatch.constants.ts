export const DISPATCH_QUEUE = 'dispatch';
export const DISPATCH_TIMEOUT_JOB = 'dispatch-timeout';

export function dispatchCandidatesKey(tripId: string): string {
  return `dispatch:trip:${tripId}:candidates`;
}
