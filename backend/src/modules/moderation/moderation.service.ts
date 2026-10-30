import { eq, sql } from 'drizzle-orm';
import type { Executor } from '../../db/client.js';
import { users } from '../../db/schema.js';
import { SUSPENSION_THRESHOLD } from '../../lib/constants.js';
import { notify } from '../notifications/notifications.service.js';

/**
 * Adds one violation to a user and suspends the account at the threshold (FR-13).
 * Returns the new count and whether this violation caused the suspension.
 */
export async function registerViolation(
  db: Executor,
  userId: string,
  reason: string,
): Promise<{ count: number; suspended: boolean }> {
  const [row] = await db
    .update(users)
    .set({ violationCount: sql`${users.violationCount} + 1`, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ count: users.violationCount });
  const count = row?.count ?? 0;

  if (count >= SUSPENSION_THRESHOLD) {
    await db.update(users).set({ status: 'SUSPENDED' }).where(eq(users.id, userId));
    await notify(
      db,
      userId,
      'ACCOUNT_SUSPENDED',
      `Your account was suspended after ${count} violations (${reason}). You can submit an appeal.`,
    );
    return { count, suspended: true };
  }
  await notify(
    db,
    userId,
    'VIOLATION_WARNING',
    `Warning ${count}/${SUSPENSION_THRESHOLD}: ${reason}. Your account is suspended at ${SUSPENSION_THRESHOLD} violations.`,
  );
  return { count, suspended: false };
}
