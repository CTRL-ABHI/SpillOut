import { PrismaClient } from '@prisma/client';
import { config } from './config.js';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// 1. Resolve DB URL with Vercel Postgres / Neon aliases and serverless fallback
const resolveDbUrl = (): string => {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
  if (url) {
    process.env.DATABASE_URL = url;
    return url;
  }

  if (process.env.VERCEL) {
    console.warn(
      '[Database] WARNING: DATABASE_URL is not set on Vercel. For persistent multi-instance accounts, please configure a PostgreSQL DATABASE_URL in Vercel project environment variables.'
    );
    const tmpUrl = 'file:/tmp/spillout.db';
    process.env.DATABASE_URL = tmpUrl;
    return tmpUrl;
  }

  const localUrl = 'file:./dev.db';
  process.env.DATABASE_URL = localUrl;
  return localUrl;
};

const activeDbUrl = resolveDbUrl();

export const prisma =
  global.__prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: activeDbUrl,
      },
    },
    log: config.isProduction ? ['error', 'warn'] : ['error', 'warn'],
  });

if (!config.isProduction) {
  global.__prisma = prisma;
}

let dbInitPromise: Promise<void> | null = null;

/**
 * Ensure database tables and indexes exist on boot (especially on fresh serverless runtimes).
 */
export async function ensureDatabase(): Promise<void> {
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    try {
      const activeUrl = process.env.DATABASE_URL || '';
      const isPg = activeUrl.startsWith('postgres://') || activeUrl.startsWith('postgresql://');

      if (isPg) {
        await prisma.$executeRawUnsafe(`
          DO $$ BEGIN
            CREATE TYPE "Gender" AS ENUM ('Male', 'Female', 'Object');
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `).catch(() => {});

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "User" (
            "id" TEXT PRIMARY KEY,
            "username" VARCHAR(10) NOT NULL,
            "canonicalUsername" VARCHAR(10) NOT NULL UNIQUE,
            "passwordHash" TEXT NOT NULL,
            "gender" "Gender" NOT NULL,
            "avatarId" VARCHAR(32),
            "publicKey" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Ensure avatarId column exists if table was created previously
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarId" VARCHAR(32);
        `).catch(() => {});

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "Session" (
            "id" TEXT PRIMARY KEY,
            "token" TEXT NOT NULL UNIQUE,
            "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "expiresAt" TIMESTAMP(3) NOT NULL
          );
        `);

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "Message" (
            "id" TEXT PRIMARY KEY,
            "conversationId" TEXT NOT NULL,
            "senderCanonical" TEXT NOT NULL,
            "recipientCanonical" TEXT NOT NULL,
            "ciphertext" TEXT NOT NULL,
            "iv" TEXT NOT NULL,
            "tag" TEXT,
            "senderEphemeralPublicKey" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "expiresAt" TIMESTAMP(3) NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'sent',
            "deliveredAt" TIMESTAMP(3)
          );
        `);

        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "User_canonicalUsername_idx" ON "User"("canonicalUsername");`).catch(() => {});
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "User_lastActivityAt_idx" ON "User"("lastActivityAt");`).catch(() => {});
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Session_token_idx" ON "Session"("token");`).catch(() => {});
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");`).catch(() => {});
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Message_recipientCanonical_expiresAt_idx" ON "Message"("recipientCanonical", "expiresAt");`).catch(() => {});
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Message_conversationId_expiresAt_idx" ON "Message"("conversationId", "expiresAt");`).catch(() => {});
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Message_expiresAt_idx" ON "Message"("expiresAt");`).catch(() => {});
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Message_senderCanonical_createdAt_idx" ON "Message"("senderCanonical", "createdAt");`).catch(() => {});
      } else {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "User" (
            "id" TEXT PRIMARY KEY,
            "username" TEXT NOT NULL,
            "canonicalUsername" TEXT NOT NULL UNIQUE,
            "passwordHash" TEXT NOT NULL,
            "gender" TEXT NOT NULL,
            "avatarId" TEXT,
            "publicKey" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Check and add avatarId column in SQLite if missing
        try {
          const tableInfo: any[] = await prisma.$queryRawUnsafe(`PRAGMA table_info("User");`);
          const hasAvatarId = tableInfo.some((col: any) => col.name === 'avatarId');
          if (!hasAvatarId) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "avatarId" TEXT;`);
          }
        } catch {
          // Ignore pragma check error
        }

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "Session" (
            "id" TEXT PRIMARY KEY,
            "token" TEXT NOT NULL UNIQUE,
            "userId" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "expiresAt" DATETIME NOT NULL,
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
          );
        `);

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "Message" (
            "id" TEXT PRIMARY KEY,
            "conversationId" TEXT NOT NULL,
            "senderCanonical" TEXT NOT NULL,
            "recipientCanonical" TEXT NOT NULL,
            "ciphertext" TEXT NOT NULL,
            "iv" TEXT NOT NULL,
            "tag" TEXT,
            "senderEphemeralPublicKey" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "expiresAt" DATETIME NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'sent',
            "deliveredAt" DATETIME
          );
        `);

        await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_canonicalUsername_key" ON "User"("canonicalUsername");`).catch(() => {});
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "User_canonicalUsername_idx" ON "User"("canonicalUsername");`).catch(() => {});
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "User_lastActivityAt_idx" ON "User"("lastActivityAt");`).catch(() => {});
        await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token");`).catch(() => {});
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Session_token_idx" ON "Session"("token");`).catch(() => {});
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");`).catch(() => {});
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Message_recipientCanonical_expiresAt_idx" ON "Message"("recipientCanonical", "expiresAt");`).catch(() => {});
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Message_conversationId_expiresAt_idx" ON "Message"("conversationId", "expiresAt");`).catch(() => {});
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Message_expiresAt_idx" ON "Message"("expiresAt");`).catch(() => {});
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Message_senderCanonical_createdAt_idx" ON "Message"("senderCanonical", "createdAt");`).catch(() => {});
      }
    } catch (err: any) {
      console.warn('[Database] Auto-migration check:', err?.message || err);
    }
  })();

  return dbInitPromise;
}

