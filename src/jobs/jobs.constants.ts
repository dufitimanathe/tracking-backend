export const QUEUE_DISPATCH = 'dispatch';
export const QUEUE_NOTIFICATIONS = 'notifications';
export const QUEUE_GPS_PROCESSING = 'gps-processing';
export const QUEUE_INCIDENT_DETECTION = 'incident-detection';
export const QUEUE_INVOICES = 'invoices';
export const QUEUE_WHATSAPP = 'whatsapp';

export const ALL_QUEUES = [
  QUEUE_DISPATCH,
  QUEUE_NOTIFICATIONS,
  QUEUE_GPS_PROCESSING,
  QUEUE_INCIDENT_DETECTION,
  QUEUE_INVOICES,
  QUEUE_WHATSAPP,
] as const;
