import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Outgoing email over SMTP (any provider: Brevo, Mailgun, SendGrid, Gmail app password, ...).
 * Without SMTP_HOST, messages are only logged; outside production the verification / reset
 * tokens are then returned in API responses instead.
 */
let transporter: Transporter | undefined;

function getTransporter(): Transporter | undefined {
  if (!env.SMTP_HOST) return undefined;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // Port 465 is implicit TLS; other ports (587) upgrade with STARTTLS.
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

/**
 * Sends an email. Never throws: a mail outage is logged instead of failing the request, so
 * responses stay identical whether or not an account exists (no email enumeration).
 */
export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const t = env.NODE_ENV === 'test' ? undefined : getTransporter();
  if (!t) {
    logger.info({ to, subject, text }, 'email (not delivered: SMTP_HOST is not set)');
    return;
  }
  try {
    await t.sendMail({ from: env.MAIL_FROM, to, subject, text });
    logger.info({ to, subject }, 'email sent');
  } catch (err) {
    logger.error({ err, to, subject }, 'email delivery failed');
  }
}
