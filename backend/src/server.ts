import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeDb } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { logger } from './lib/logger.js';
import { closeRedis } from './lib/redis.js';
import { storageDriver } from './lib/storage.js';
import { startMaintenanceSchedule } from './modules/scheduler/jobs.js';

if (env.MIGRATE_ON_START) await runMigrations();

if (env.NODE_ENV === 'production' && storageDriver === 'local') {
  logger.warn(
    'S3_BUCKET is not set: uploaded photos are stored on local disk and will be lost on restart',
  );
}

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`WASTABLE API listening on port ${env.PORT} (/api)`);
});

const schedule = startMaintenanceSchedule();

/** Heroku sends SIGTERM on deploys and daily restarts, then SIGKILL after 30 seconds. */
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  clearInterval(schedule);
  const force = setTimeout(() => process.exit(1), 25_000);
  force.unref();
  server.close(() => {
    void Promise.allSettled([closeDb(), closeRedis()]).then(() => process.exit(0));
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
