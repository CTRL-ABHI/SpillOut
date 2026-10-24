import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  cookieSecret: process.env.COOKIE_SECRET || 'spillout_fallback_cookie_secret_32_characters_min',
  sessionTtlHours: parseInt(process.env.SESSION_TTL_HOURS || '168', 10), // 7 days default
  inactivityExpirationDays: parseInt(process.env.INACTIVITY_EXPIRATION_DAYS || '7', 10), // 7 days policy
  inactivityCheckIntervalMs: parseInt(process.env.INACTIVITY_CHECK_INTERVAL_MS || '3600000', 10), // 1 hour
  redisUrl: process.env.REDIS_URL || undefined,
};
