import { sql } from 'drizzle-orm';
import { Router } from 'express';
import { getDb } from '../db/client.js';

export const healthRouter = Router();

/** Liveness: the process is up. */
healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'wastable-api', time: new Date().toISOString() });
});

/** Readiness: the database answers too (for uptime monitors). */
healthRouter.get('/health/ready', async (_req, res) => {
  try {
    await getDb().execute(sql`select 1`);
    res.json({ status: 'ok', database: 'up' });
  } catch {
    res.status(503).json({ status: 'error', database: 'down' });
  }
});
