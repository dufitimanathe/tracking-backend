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
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    whatsappAppSecret: process.env.WHATSAPP_APP_SECRET || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    aiProvider: process.env.AI_PROVIDER || 'mock',
    aiConfidenceThreshold: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD ?? '0.75'),
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
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
  },
}));
