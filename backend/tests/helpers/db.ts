import { Pool } from 'pg';

/**
 * Whether the integration database is reachable (and migrated). Files that need it use
 * `describe.skipIf(!dbUp)`, so the suite still runs on a laptop without Docker.
 * In CI a missing database is an error instead: silently skipping hid 27 tests before.
 */
const url = process.env.DATABASE_URL ?? 'postgres://wastable:wastable@localhost:5432/wastable';
const probe = new Pool({ connectionString: url, connectionTimeoutMillis: 1500 });

export const dbUp = await probe
  .query('select 1 from users limit 1')
  .then(() => true)
  .catch(() => false);
await probe.end();

if (!dbUp && process.env.CI) {
  throw new Error(
    `Integration database not reachable at ${url.replace(/:[^:@/]+@/, ':***@')}. ` +
      'Start Postgres and run `npm run db:migrate -w backend` before the tests.',
  );
}
