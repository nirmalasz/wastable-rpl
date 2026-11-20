import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env.js';
import * as schema from './schema.js';

let pool: Pool | undefined;

/** The shared connection pool (Neon / any Postgres; SSL comes from ?sslmode=require). */
export function getPool(): Pool {
  pool ??= new Pool({ connectionString: env.DATABASE_URL, max: 10 });
  return pool;
}

/** Lazily created Drizzle client, so the app (and tests) can start without a database. */
export function getDb() {
  return drizzle(getPool(), { schema });
}

/** Closes the pool on shutdown, if one was ever opened. */
export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

export type Db = ReturnType<typeof getDb>;

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Either the plain client or a transaction handle, so helpers work inside and outside one. */
export type Executor = Db | Tx;
