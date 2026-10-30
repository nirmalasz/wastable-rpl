import { and, eq, gt, isNotNull, lte, sql } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { listings, transactions, users } from '../../db/schema.js';
import { CLAIM_TIMEOUT_HOURS, URGENT_WINDOW_HOURS } from '../../lib/constants.js';
import { logger } from '../../lib/logger.js';
import { notify } from '../notifications/notifications.service.js';
import { cancelTransaction } from '../transactions/transactions.service.js';

const MAX_NEARBY_REMINDERS = 50;
/** Postgres advisory lock id, so only one API instance runs the job at a time. */
const JOB_LOCK_ID = 841_501;

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface MaintenanceSummary {
  skipped: boolean;
  claimsTimedOut: number;
  expired: number;
  urgent: number;
  reminders: number;
}

/**
 * Scheduled job (Activity diagram 3.13), run every 15 minutes (Cloudflare Cron Trigger in production).
 *  0. Cancel claims nobody picked up within CLAIM_TIMEOUT_HOURS, freeing the listing.
 *  1. Expire AVAILABLE listings whose expiry date has passed and offer the compost referral (FR-10).
 *  2. Mark listings inside the urgent window as urgent and remind nearby users (FR-5, FR-11).
 * Runs in one transaction guarded by an advisory lock: a second instance skips instead of
 * sending duplicate notifications.
 */
export async function runListingMaintenanceJob(
  now: Date = new Date(),
): Promise<MaintenanceSummary> {
  const summary = await getDb().transaction(async (tx) => {
    const lock = await tx.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(${JOB_LOCK_ID}) as locked`,
    );
    if (!lock.rows[0]?.locked) {
      return { skipped: true, claimsTimedOut: 0, expired: 0, urgent: 0, reminders: 0 };
    }

    // 0. Claim time-out
    const staleBefore = new Date(now.getTime() - CLAIM_TIMEOUT_HOURS * 3_600_000);
    const stale = await tx
      .select()
      .from(transactions)
      .where(and(eq(transactions.status, 'PENDING'), lte(transactions.createdAt, staleBefore)));
    for (const t of stale) {
      const [listing] = await tx
        .select()
        .from(listings)
        .where(eq(listings.id, t.listingId))
        .for('update');
      if (!listing) continue;
      await cancelTransaction(tx, t, listing, [t.claimerId, listing.sellerId], {
        message: `The claim on "${listing.title}" was cancelled because it was not picked up within ${CLAIM_TIMEOUT_HOURS} hours.`,
        now,
      });
    }

    // 1. Expiry
    const expired = await tx
      .update(listings)
      .set({ status: 'EXPIRED', isUrgent: false, updatedAt: now })
      .where(and(eq(listings.status, 'AVAILABLE'), lte(listings.expiryDate, now)))
      .returning({ id: listings.id, sellerId: listings.sellerId, title: listings.title });
    for (const l of expired) {
      await notify(
        tx,
        l.sellerId,
        'LISTING_EXPIRED',
        `"${l.title}" has expired. You can refer it to a compost partner from your dashboard.`,
      );
    }

    // 2. Urgent window + nearby reminders
    const windowEnd = new Date(now.getTime() + URGENT_WINDOW_HOURS * 3_600_000);
    const urgent = await tx
      .update(listings)
      .set({ isUrgent: true, updatedAt: now })
      .where(
        and(
          eq(listings.status, 'AVAILABLE'),
          eq(listings.isUrgent, false),
          gt(listings.expiryDate, now),
          lte(listings.expiryDate, windowEnd),
        ),
      )
      .returning();

    let reminders = 0;
    if (urgent.length > 0) {
      const candidates = await tx
        .select()
        .from(users)
        .where(and(eq(users.status, 'ACTIVE'), isNotNull(users.homeLat), isNotNull(users.homeLng)));
      for (const l of urgent) {
        if (l.pickupLat === null || l.pickupLng === null) continue;
        let sent = 0;
        for (const u of candidates) {
          if (u.id === l.sellerId || sent >= MAX_NEARBY_REMINDERS) continue;
          const d = distanceKm(
            Number(l.pickupLat),
            Number(l.pickupLng),
            Number(u.homeLat),
            Number(u.homeLng),
          );
          if (d > u.locationRadiusKm) continue;
          await notify(
            tx,
            u.id,
            'URGENT_ITEM',
            `Hurry: "${l.title}" expires soon, ${d.toFixed(1)} km away.`,
          );
          sent++;
        }
        reminders += sent;
      }
    }

    return {
      skipped: false,
      claimsTimedOut: stale.length,
      expired: expired.length,
      urgent: urgent.length,
      reminders,
    };
  });

  logger.info({ at: now.toISOString(), ...summary }, 'listing maintenance job finished');
  return summary;
}

/** Runs the job on an interval inside the Node server (production uses a Cron Trigger instead). */
export function startMaintenanceSchedule(intervalMs = 15 * 60_000): NodeJS.Timeout {
  const run = () =>
    runListingMaintenanceJob().catch((err) => logger.error(err, 'maintenance job failed'));
  void run();
  return setInterval(run, intervalMs);
}
