import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env.js';
import * as schema from './schema.js';

let pool: Pool | undefined;

/** Lazily created Drizzle client, so the app (and tests) can start without a database. */
export function getDb() {
  pool ??= new Pool({ connectionString: env.DATABASE_URL, max: 10 });
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof getDb>;
