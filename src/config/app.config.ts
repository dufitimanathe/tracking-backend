import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3001')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  swaggerEnabled: (process.env.SWAGGER_ENABLED ?? 'true') === 'true',
  workerMode: (process.env.WORKER_MODE ?? 'false') === 'true',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  database: {
    host: process.env.DATABASE_HOST!,
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER!,
    password: process.env.DATABASE_PASSWORD!,
    name: process.env.DATABASE_NAME!,
    ssl: (process.env.DATABASE_SSL ?? 'false') === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  integrations: {
    /** Server-side Google Maps key (Geocoding / Places / Routes / Distance Matrix). */
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    whatsappBusinessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    whatsappAppSecret: process.env.WHATSAPP_APP_SECRET || '',
    whatsappApiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiTransportModel: process.env.OPENAI_TRANSPORT_MODEL || 'gpt-4o',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    aiProvider: process.env.AI_PROVIDER || 'mock',
    aiConfidenceThreshold: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD ?? '0.75'),
  },
  /**
   * Phone-first tracking: rider mobile GPS is the primary source.
   * Hardware GPS devices remain optional (webhook adapters).
   */
  tracking: {
    mode: (process.env.TRACKING_MODE as 'phone_primary' | 'hardware_primary' | 'hybrid') ||
      'phone_primary',
    /** Meters off planned polyline before flagging "not on specified road" (mobile later). */
    routeDeviationMeters: parseInt(process.env.TRACKING_ROUTE_DEVIATION_METERS ?? '120', 10),
    /** Soft ETA lateness window before nagging rider (seconds) — consumed by mobile later. */
    etaGraceSeconds: parseInt(process.env.TRACKING_ETA_GRACE_SECONDS ?? '180', 10),
    accuracyThresholdMeters: parseFloat(process.env.LOCATION_ACCURACY_THRESHOLD_M ?? '80'),
    movingSpeedThresholdMps: parseFloat(process.env.MOVING_SPEED_THRESHOLD_MPS ?? '1.5'),
    stoppedSpeedThresholdMps: parseFloat(process.env.STOPPED_SPEED_THRESHOLD_MPS ?? '0.6'),
    minDistanceIntervalMeters: parseFloat(process.env.MIN_DISTANCE_INTERVAL_M ?? '12'),
    maxTeleportSpeedMps: parseFloat(process.env.MAX_TELEPORT_SPEED_MPS ?? '55'),
    stopRadiusMeters: parseFloat(process.env.STOP_RADIUS_M ?? '40'),
    stopMinDurationSeconds: parseInt(process.env.STOP_MIN_DURATION_SEC ?? '180', 10),
    movingConfirmSeconds: parseInt(process.env.MOVING_CONFIRM_SEC ?? '8', 10),
    stoppedConfirmSeconds: parseInt(process.env.STOPPED_CONFIRM_SEC ?? '45', 10),
    presenceLiveSeconds: parseInt(process.env.PRESENCE_LIVE_SEC ?? '30', 10),
    presenceDelayedSeconds: parseInt(process.env.PRESENCE_DELAYED_SEC ?? '90', 10),
    presenceStaleSeconds: parseInt(process.env.PRESENCE_STALE_SEC ?? '300', 10),
    presenceOfflineSeconds: parseInt(process.env.PRESENCE_OFFLINE_SEC ?? '300', 10),
    locationUploadBatchSize: parseInt(process.env.LOCATION_UPLOAD_BATCH_SIZE ?? '50', 10),
    redisTrackingTtlSeconds: parseInt(process.env.REDIS_TRACKING_TTL_SEC ?? '600', 10),
    roadsSnapEnabled: (process.env.TRACKING_ROADS_SNAP_ENABLED ?? 'false') === 'true',
    historyRetentionDays: parseInt(process.env.TRACKING_HISTORY_RETENTION_DAYS ?? '365', 10),
  },
  ops: {
    dispatchOfferTimeoutSeconds: parseInt(process.env.DISPATCH_OFFER_TIMEOUT_SECONDS ?? '45', 10),
    gpsOfflineThresholdSeconds: parseInt(process.env.GPS_OFFLINE_THRESHOLD_SECONDS ?? '120', 10),
    locationLiveSeconds: parseInt(process.env.LOCATION_LIVE_SECONDS ?? '30', 10),
    locationDelayedSeconds: parseInt(process.env.LOCATION_DELAYED_SECONDS ?? '120', 10),
    unauthorizedMovementDistanceMeters: parseInt(
      process.env.UNAUTHORIZED_MOVEMENT_DISTANCE_METERS ?? '300',
      10,
    ),
    unauthorizedMovementDurationSeconds: parseInt(
      process.env.UNAUTHORIZED_MOVEMENT_DURATION_SECONDS ?? '120',
      10,
    ),
    unauthorizedMovementMinAccuracyMeters: parseInt(
      process.env.UNAUTHORIZED_MOVEMENT_MIN_ACCURACY_METERS ?? '50',
      10,
    ),
    riderSearchRadiusMeters: parseInt(process.env.RIDER_SEARCH_RADIUS_METERS ?? '10000', 10),
    riderLocationMaxAgeSeconds: parseInt(
      process.env.RIDER_LOCATION_MAX_AGE_SECONDS ?? '60',
      10,
    ),
    assignmentCandidateLimit: parseInt(process.env.ASSIGNMENT_CANDIDATE_LIMIT ?? '10', 10),
    assignmentMatrixFallback: (process.env.ASSIGNMENT_MATRIX_FALLBACK ?? 'true') === 'true',
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
  },
}));
