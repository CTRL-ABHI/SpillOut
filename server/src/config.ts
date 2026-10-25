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

// Validate production environment settings without printing secrets
if (config.isProduction) {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_PRISMA_URL && !process.env.POSTGRES_URL) {
    console.warn('[Config] WARNING: Running in production without a PostgreSQL DATABASE_URL. Persistent multi-instance state requires a hosted database.');
  }
  if (!process.env.COOKIE_SECRET || process.env.COOKIE_SECRET.includes('fallback')) {
    console.warn('[Config] WARNING: COOKIE_SECRET is using a default fallback. Set a custom 32+ character COOKIE_SECRET in your production dashboard.');
  }
}

