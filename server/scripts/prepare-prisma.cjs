const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rawDbUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || '';
if (!process.env.DATABASE_URL && rawDbUrl) {
  process.env.DATABASE_URL = rawDbUrl;
}

const isPostgres = rawDbUrl.startsWith('postgres://') || rawDbUrl.startsWith('postgresql://');
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

const prismaDir = path.resolve(__dirname, '..', 'prisma');
const targetSchema = path.join(prismaDir, 'schema.prisma');
const pgSchema = path.join(prismaDir, 'schema.postgresql.prisma');

console.log('[Prisma Prepare] Checking database configuration...');

// Activate PostgreSQL schema if postgres URL is present or if building for production/Vercel (unless local file URL explicitly set)
const shouldActivatePostgres = (isPostgres || (isProduction && !rawDbUrl.startsWith('file:'))) && fs.existsSync(pgSchema);

if (shouldActivatePostgres) {
  console.log('[Prisma Prepare] PostgreSQL connection/environment detected. Activating schema.postgresql.prisma');
  fs.copyFileSync(pgSchema, targetSchema);
  // Ensure DATABASE_URL is set so prisma generate does not fail during headless CI/CD builds
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@localhost:5432/placeholder';
  }
} else {
  console.log('[Prisma Prepare] SQLite mode active.');
}

try {
  console.log('[Prisma Prepare] Generating Prisma Client...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  if (isPostgres && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('placeholder')) {
    console.log('[Prisma Prepare] Syncing PostgreSQL schema with prisma db push...');
    execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit' });
  }
} catch (err) {
  console.warn('[Prisma Prepare] Schema sync warning (can be completed at runtime):', err.message);
}

