const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const isTestMode = process.argv.includes('--test') || process.argv.includes('--sqlite') || process.env.NODE_ENV === 'test';

if (!isTestMode) {
  try {
    require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
  } catch {}
}

let rawDbUrl = isTestMode ? 'file:./dev.db' : (process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || '');
if (!isTestMode && !process.env.DATABASE_URL && rawDbUrl) {
  process.env.DATABASE_URL = rawDbUrl;
}

const isPostgres = !isTestMode && (rawDbUrl.startsWith('postgres://') || rawDbUrl.startsWith('postgresql://'));
const isProduction = !isTestMode && (process.env.NODE_ENV === 'production' || !!process.env.VERCEL);

const serverDir = path.resolve(__dirname, '..');
const prismaDir = path.resolve(serverDir, 'prisma');
const targetSchema = path.join(prismaDir, 'schema.prisma');
const pgSchema = path.join(prismaDir, 'schema.postgresql.prisma');
const sqliteSchema = path.join(prismaDir, 'schema.sqlite.prisma');

console.log(`[Prisma Prepare] Checking database configuration... (isTestMode=${isTestMode})`);

const shouldActivatePostgres = !isTestMode && (isPostgres || (isProduction && !rawDbUrl.startsWith('file:'))) && fs.existsSync(pgSchema);

if (shouldActivatePostgres) {
  console.log('[Prisma Prepare] PostgreSQL connection/environment detected. Activating schema.postgresql.prisma');
  fs.copyFileSync(pgSchema, targetSchema);
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@localhost:5432/placeholder';
  }
} else {
  console.log('[Prisma Prepare] SQLite mode active. Activating schema.sqlite.prisma');
  if (fs.existsSync(sqliteSchema)) {
    fs.copyFileSync(sqliteSchema, targetSchema);
  }
  process.env.DATABASE_URL = 'file:./dev.db';
}

try {
  console.log('[Prisma Prepare] Generating Prisma Client...');
  execSync('npx prisma generate', { stdio: 'inherit', cwd: serverDir, env: { ...process.env } });

  if (shouldActivatePostgres && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('placeholder')) {
    console.log('[Prisma Prepare] Syncing PostgreSQL schema with prisma db push...');
    execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit', cwd: serverDir, env: { ...process.env } });
  } else if (!shouldActivatePostgres) {
    console.log('[Prisma Prepare] Syncing SQLite schema with prisma db push...');
    execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit', cwd: serverDir, env: { ...process.env } });
  }
} catch (err) {
  console.warn('[Prisma Prepare] Schema sync warning (can be completed at runtime):', err.message);
}
