import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { startMaintenanceSchedule } from './modules/scheduler/jobs.js';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`WASTABLE API listening on http://localhost:${env.PORT}/api`);
});

startMaintenanceSchedule();
