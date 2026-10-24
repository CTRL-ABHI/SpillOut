const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || '';
if (!process.env.DATABASE_URL && dbUrl) {
  process.env.DATABASE_URL = dbUrl;
}
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

const prismaDir = path.resolve(__dirname, '..', 'prisma');
const targetSchema = path.join(prismaDir, 'schema.prisma');
const pgSchema = path.join(prismaDir, 'schema.postgresql.prisma');

console.log('[Prisma Prepare] Checking database configuration...');

if (isPostgres && fs.existsSync(pgSchema)) {
  console.log('[Prisma Prepare] PostgreSQL connection detected. Activating schema.postgresql.prisma');
  fs.copyFileSync(pgSchema, targetSchema);
} else {
  console.log('[Prisma Prepare] SQLite mode active.');
}

try {
  console.log('[Prisma Prepare] Generating Prisma Client...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  if (isPostgres) {
    console.log('[Prisma Prepare] Syncing PostgreSQL schema with prisma db push...');
    execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit' });
  }
} catch (err) {
  console.warn('[Prisma Prepare] Schema sync warning (can be completed at runtime):', err.message);
}
