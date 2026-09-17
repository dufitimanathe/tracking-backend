export const REALTIME_EVENTS = {
  FLEET_LOCATION_UPDATED: 'fleet.location.updated',
  RIDER_STATUS_UPDATED: 'rider.status.updated',
  TRANSPORT_REQUEST_CREATED: 'transport_request.created',
  TRIP_STATUS_UPDATED: 'trip.status.updated',
  INCIDENT_CREATED: 'incident.created',
  NOTIFICATION_CREATED: 'notification.created',
} as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export function companyRoom(companyId: string): string {
  return `company:${companyId}`;
}

export function tripRoom(tripId: string): string {
  return `trip:${tripId}`;
}

export function riderRoom(riderId: string): string {
  return `rider:${riderId}`;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}
