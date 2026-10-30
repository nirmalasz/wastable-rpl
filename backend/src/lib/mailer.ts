import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Outgoing email. No SMTP transport is wired in yet, so messages are logged (the dev flow
 * surfaces verification / reset tokens in API responses outside production instead).
 * TODO: plug nodemailer in here once SMTP_* credentials exist.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  logger.info({ to, subject, text, smtp: Boolean(env.SMTP_HOST) }, 'email (not delivered)');
}
