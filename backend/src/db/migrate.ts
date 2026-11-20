import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { logger } from '../lib/logger.js';
import { getPool } from './client.js';

/** backend/drizzle, from both src/db (tsx) and dist/db (built). */
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** Postgres advisory lock id, so two dynos booting at once do not migrate concurrently. */
const MIGRATION_LOCK_ID = 841_502;

/** Applies pending migrations from backend/drizzle (already applied ones are skipped). */
export async function runMigrations(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await migrate(drizzle(client), { migrationsFolder });
    logger.info('database migrations are up to date');
  } finally {
    await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}
