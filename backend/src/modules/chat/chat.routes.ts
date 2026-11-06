import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { listings, messages, transactions } from '../../db/schema.js';
import { HttpError } from '../../lib/http-error.js';
import { currentUser, requireAuth, requireVerified } from '../../middleware/auth.js';
import { chatLimiter } from '../../middleware/rate-limit.js';
import { notify } from '../notifications/notifications.service.js';

/** Trade chat between the buyer and seller of one transaction. Clients poll for new messages. */
export const chatRouter = Router();

const idParam = z.object({ id: z.uuid() });

/** Loads the transaction and checks the caller is its buyer or seller. */
async function participantOf(transactionId: string, userId: string) {
  const [row] = await getDb()
    .select({
      id: transactions.id,
      status: transactions.status,
      claimerId: transactions.claimerId,
      sellerId: listings.sellerId,
      listingTitle: listings.title,
    })
    .from(transactions)
    .innerJoin(listings, eq(listings.id, transactions.listingId))
    .where(eq(transactions.id, transactionId));
  if (!row) throw HttpError.notFound('Conversation not found');
  if (userId !== row.claimerId && userId !== row.sellerId) {
    // Same answer as "missing" so outsiders cannot probe which transactions exist.
    throw HttpError.notFound('Conversation not found');
  }
  const otherId = userId === row.claimerId ? row.sellerId : row.claimerId;
  return { ...row, otherId };
}

const toPublic = (m: typeof messages.$inferSelect, meId: string) => ({
  id: m.id,
  body: m.body,
  createdAt: m.createdAt,
  readAt: m.readAt,
  mine: m.senderId === meId,
});

/** Messages oldest-first. `?after=<ISO>` returns only newer ones (for polling). Marks theirs read. */
chatRouter.get('/transactions/:id/messages', requireAuth, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { after } = z.object({ after: z.coerce.date().optional() }).parse(req.query);
  const me = currentUser(res);
  await participantOf(id, me.id);
  const db = getDb();

  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.transactionId, id),
        // Postgres keeps microseconds but clients only see milliseconds; compare at the
        // precision the client sent, or the cursor message itself comes back on every poll.
        after ? sql`date_trunc('milliseconds', ${messages.createdAt}) > ${after}` : undefined,
      ),
    )
    .orderBy(asc(messages.createdAt))
    .limit(500);

  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(
      and(eq(messages.transactionId, id), ne(messages.senderId, me.id), isNull(messages.readAt)),
    );

  res.json({ messages: rows.map((m) => toPublic(m, me.id)) });
});

chatRouter.post(
  '/transactions/:id/messages',
  requireAuth,
  requireVerified,
  chatLimiter,
  async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { text } = z.object({ text: z.string().trim().min(1).max(1000) }).parse(req.body);
    const me = currentUser(res);
    const trx = await participantOf(id, me.id);
    if (trx.status === 'CANCELLED') {
      throw HttpError.conflict('This trade was cancelled, so the chat is closed');
    }
    const db = getDb();

    // Notify once per unread burst, not on every message.
    const [alreadyWaiting] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(eq(messages.transactionId, id), eq(messages.senderId, me.id), isNull(messages.readAt)),
      )
      .limit(1);

    const [message] = await db
      .insert(messages)
      .values({ transactionId: id, senderId: me.id, body: text })
      .returning();
    if (!message) throw new Error('message insert failed');
    if (!alreadyWaiting) {
      await notify(db, trx.otherId, 'NEW_MESSAGE', `New message about "${trx.listingTitle}".`);
    }
    res.status(201).json({ message: toPublic(message, me.id) });
  },
);
