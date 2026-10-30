import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  // Never write credentials to the logs.
  redact: ['req.headers.authorization', 'req.headers.cookie', 'headers.authorization'],
  level: env.NODE_ENV === 'production' ? 'info' : env.NODE_ENV === 'test' ? 'silent' : 'debug',
});
