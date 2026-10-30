import { eq } from 'drizzle-orm';
import type { Executor } from '../../db/client.js';
import { notifications, users } from '../../db/schema.js';

export type NotificationType =
  | 'CLAIM_REQUEST'
  | 'CLAIM_CANCELLED'
  | 'PICKUP_COMPLETED'
  | 'ITEM_TAKEN'
  | 'ITEM_AVAILABLE'
  | 'LISTING_EXPIRED'
  | 'URGENT_ITEM'
  | 'LISTING_HIDDEN'
  | 'LISTING_RESTORED'
  | 'LISTING_REMOVED'
  | 'REPORT_DISMISSED'
  | 'REPORT_ACTIONED'
  | 'VIOLATION_WARNING'
  | 'ACCOUNT_SUSPENDED'
  | 'APPEAL_SUBMITTED'
  | 'APPEAL_DECIDED'
  | 'NEW_CASE'
  | 'NEW_REVIEW';

/** Creates an in-app notification (FR-11). Pass a transaction handle to make it atomic. */
export async function notify(
  db: Executor,
  userId: string,
  type: NotificationType,
  message: string,
): Promise<void> {
  await db.insert(notifications).values({ userId, type, message, channel: 'IN_APP' });
}

export async function notifyAdmins(
  db: Executor,
  type: NotificationType,
  message: string,
): Promise<void> {
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'ADMIN'));
  if (admins.length === 0) return;
  await db
    .insert(notifications)
    .values(admins.map((a) => ({ userId: a.id, type, message, channel: 'IN_APP' as const })));
}
