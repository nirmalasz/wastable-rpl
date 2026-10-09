import { logger } from '../../lib/logger.js';

/**
 * Scheduled job (Activity diagram 3.13), triggered by a cron (Cloudflare Cron Trigger in production).
 * TODO:
 *  1. Expire AVAILABLE listings whose expiry date has passed and notify the seller (FR-10).
 *  2. Mark listings inside the urgent window as urgent and notify nearby users (FR-5, FR-11).
 */
export async function runListingMaintenanceJob(now: Date = new Date()): Promise<void> {
  logger.info({ at: now.toISOString() }, 'listing maintenance job: not implemented yet');
}
