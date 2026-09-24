export const REALTIME_EVENTS = {
  FLEET_LOCATION_UPDATED: 'fleet.location.updated',
  RIDER_STATUS_UPDATED: 'rider.status.updated',
  TRANSPORT_REQUEST_CREATED: 'transport_request.created',
  TRIP_STATUS_UPDATED: 'trip.status.updated',
  INCIDENT_CREATED: 'incident.created',
  NOTIFICATION_CREATED: 'notification.created',
  TRIP_OFFER: 'trip.offer',
  TRACKING_DRIVER_LOCATION: 'tracking.driver-location',
  TRACKING_DRIVER_STATUS: 'tracking.driver-status',
  TRACKING_SESSION_STARTED: 'tracking.session-started',
  TRACKING_SESSION_ENDED: 'tracking.session-ended',
  TRACKING_DRIVER_ONLINE: 'tracking.driver-online',
  TRACKING_DRIVER_OFFLINE: 'tracking.driver-offline',
  TRACKING_DRIVER_STOPPED: 'tracking.driver-stopped',
  TRACKING_DRIVER_MOVING: 'tracking.driver-moving',
  TRACKING_GEOFENCE_ENTER: 'tracking.geofence-enter',
  TRACKING_GEOFENCE_EXIT: 'tracking.geofence-exit',
  TRACKING_GPS_WARNING: 'tracking.gps-warning',
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
