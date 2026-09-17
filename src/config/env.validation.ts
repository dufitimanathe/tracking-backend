import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'staging', 'production').default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),

  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),
  DATABASE_SSL: Joi.boolean().truthy('true').falsy('false').default(false),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  CORS_ORIGINS: Joi.string().default('http://localhost:3001'),

  GOOGLE_MAPS_API_KEY: Joi.string().allow('').optional(),
  WHATSAPP_ACCESS_TOKEN: Joi.string().allow('').optional(),
  WHATSAPP_VERIFY_TOKEN: Joi.string().allow('').optional(),
  WHATSAPP_PHONE_NUMBER_ID: Joi.string().allow('').optional(),
  WHATSAPP_APP_SECRET: Joi.string().allow('').optional(),
  OPENAI_API_KEY: Joi.string().allow('').optional(),
  GEMINI_API_KEY: Joi.string().allow('').optional(),
  AI_PROVIDER: Joi.string().valid('openai', 'gemini', 'mock').default('mock'),
  AI_CONFIDENCE_THRESHOLD: Joi.number().min(0).max(1).default(0.75),

  DISPATCH_OFFER_TIMEOUT_SECONDS: Joi.number().default(45),
  GPS_OFFLINE_THRESHOLD_SECONDS: Joi.number().default(120),
  LOCATION_LIVE_SECONDS: Joi.number().default(30),
  LOCATION_DELAYED_SECONDS: Joi.number().default(120),
  UNAUTHORIZED_MOVEMENT_DISTANCE_METERS: Joi.number().default(300),
  UNAUTHORIZED_MOVEMENT_DURATION_SECONDS: Joi.number().default(120),
  UNAUTHORIZED_MOVEMENT_MIN_ACCURACY_METERS: Joi.number().default(50),
  RIDER_SEARCH_RADIUS_METERS: Joi.number().default(10000),

  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  THROTTLE_TTL_MS: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(120),
  WORKER_MODE: Joi.boolean().truthy('true').falsy('false').default(false),
  DATABASE_SYNC: Joi.boolean().truthy('true').falsy('false').default(false),
  GPS_API_KEY: Joi.string().allow('').optional(),
});
