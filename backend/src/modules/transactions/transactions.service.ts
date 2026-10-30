import { asc, eq, sql } from 'drizzle-orm';
import type { Executor } from '../../db/client.js';
import { listings, transactions, waitlistEntries } from '../../db/schema.js';
import { notify } from '../notifications/notifications.service.js';

type TransactionRow = typeof transactions.$inferSelect;
type ListingRow = typeof listings.$inferSelect;

/**
 * Cancels a PENDING claim: frees the listing (or expires it if its time has passed), tells the
 * given users, and offers the item to the first person on the waitlist (sequence 4a, state 6a
 * "Pending -> Available"). Used by the cancel endpoint and by the claim time-out job.
 * The caller must hold the listing row lock (SELECT ... FOR UPDATE) inside `tx`.
 */
export async function cancelTransaction(
  tx: Executor,
  found: TransactionRow,
  listing: ListingRow,
  notifyUserIds: string[],
  {
    message = `The claim on "${listing.title}" was cancelled.`,
    now = new Date(),
  }: { message?: string; now?: Date } = {},
) {
  const [cancelled] = await tx
    .update(transactions)
    .set({ status: 'CANCELLED', updatedAt: now })
    .where(eq(transactions.id, found.id))
    .returning();

  let listingStatus = listing.status;
  if (listing.status === 'PENDING') {
    listingStatus = listing.expiryDate.getTime() <= now.getTime() ? 'EXPIRED' : 'AVAILABLE';
    await tx
      .update(listings)
      .set({ status: listingStatus, updatedAt: now })
      .where(eq(listings.id, listing.id));
  }
  for (const userId of notifyUserIds) {
    await notify(tx, userId, 'CLAIM_CANCELLED', message);
  }

  const [first] = await tx
    .select()
    .from(waitlistEntries)
    .where(eq(waitlistEntries.listingId, listing.id))
    .orderBy(asc(waitlistEntries.position))
    .limit(1);
  if (first && listingStatus === 'AVAILABLE') {
    await notify(
      tx,
      first.userId,
      'ITEM_AVAILABLE',
      `"${listing.title}" is available again. Claim it now!`,
    );
    await tx.delete(waitlistEntries).where(eq(waitlistEntries.id, first.id));
    await tx
      .update(waitlistEntries)
      .set({ position: sql`${waitlistEntries.position} - 1` })
      .where(eq(waitlistEntries.listingId, listing.id));
  }
  return { transaction: cancelled, listingStatus };
}
