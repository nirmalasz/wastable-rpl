import { and, asc, count, desc, eq, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { inquiries, listings, messages, transactions, users } from '../../db/schema.js';
import { HttpError } from '../../lib/http-error.js';
import { currentUser, requireAuth, requireVerified } from '../../middleware/auth.js';
import { chatLimiter } from '../../middleware/rate-limit.js';
import { notify } from '../notifications/notifications.service.js';

/**
 * Chat between two people about one listing. Clients poll for new messages.
 *  - Trade chat: the buyer and seller of one transaction (/transactions/:id/messages).
 *  - Inquiry chat: a would-be buyer asking the seller before claiming (/inquiries/:id/...).
 */
export const chatRouter = Router();

const idParam = z.object({ id: z.uuid() });

interface Thread {
  /** Restricts message queries to this thread. */
  where: SQL;
  /** Column values for a new message in this thread. */
  owner: { transactionId: string } | { inquiryId: string };
  listingId: string;
  listingTitle: string;
  otherId: string;
  /** Why no new messages are accepted, or null when the chat is open. */
  closedReason: string | null;
  notifyRef: { listingId: string; transactionId?: string; inquiryId?: string };
}

/** Loads a trade thread and checks the caller is its buyer or seller. */
async function tradeThread(transactionId: string, userId: string): Promise<Thread> {
  const [row] = await getDb()
    .select({
      status: transactions.status,
      claimerId: transactions.claimerId,
      sellerId: listings.sellerId,
      listingId: listings.id,
      listingTitle: listings.title,
    })
    .from(transactions)
    .innerJoin(listings, eq(listings.id, transactions.listingId))
    .where(eq(transactions.id, transactionId));
  // Outsiders get the same answer as "missing", so they cannot probe which threads exist.
  if (!row || (userId !== row.claimerId && userId !== row.sellerId)) {
    throw HttpError.notFound('Conversation not found');
  }
  return {
    where: eq(messages.transactionId, transactionId),
    owner: { transactionId },
    listingId: row.listingId,
    listingTitle: row.listingTitle,
    otherId: userId === row.claimerId ? row.sellerId : row.claimerId,
    closedReason:
      row.status === 'CANCELLED' ? 'This trade was cancelled, so the chat is closed' : null,
    notifyRef: { listingId: row.listingId, transactionId },
  };
}

/** Loads an inquiry thread and checks the caller is the asking buyer or the seller. */
async function inquiryThread(inquiryId: string, userId: string): Promise<Thread> {
  const [row] = await getDb()
    .select({
      buyerId: inquiries.buyerId,
      sellerId: listings.sellerId,
      listingId: listings.id,
      listingTitle: listings.title,
      listingStatus: listings.status,
    })
    .from(inquiries)
    .innerJoin(listings, eq(listings.id, inquiries.listingId))
    .where(eq(inquiries.id, inquiryId));
  if (!row || (userId !== row.buyerId && userId !== row.sellerId)) {
    throw HttpError.notFound('Conversation not found');
  }
  return {
    where: eq(messages.inquiryId, inquiryId),
    owner: { inquiryId },
    listingId: row.listingId,
    listingTitle: row.listingTitle,
    otherId: userId === row.buyerId ? row.sellerId : row.buyerId,
    closedReason:
      row.listingStatus === 'REMOVED' || row.listingStatus === 'UNDER_REVIEW'
        ? 'This listing is no longer shown, so the chat is closed'
        : null,
    notifyRef: { listingId: row.listingId, inquiryId },
  };
}

const toPublic = (m: typeof messages.$inferSelect, meId: string) => ({
  id: m.id,
  body: m.body,
  createdAt: m.createdAt,
  readAt: m.readAt,
  mine: m.senderId === meId,
});

/** Messages oldest-first. `?after=<ISO>` returns only newer ones (for polling). Marks theirs read. */
async function listMessages(thread: Thread, meId: string, after: Date | undefined) {
  const db = getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        thread.where,
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
    .where(and(thread.where, ne(messages.senderId, meId), isNull(messages.readAt)));

  return rows.map((m) => toPublic(m, meId));
}

async function sendMessage(thread: Thread, meId: string, text: string) {
  if (thread.closedReason) throw HttpError.conflict(thread.closedReason);
  const db = getDb();

  // Notify once per unread burst, not on every message.
  const [alreadyWaiting] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(thread.where, eq(messages.senderId, meId), isNull(messages.readAt)))
    .limit(1);

  const [message] = await db
    .insert(messages)
    .values({ ...thread.owner, senderId: meId, body: text })
    .returning();
  if (!message) throw new Error('message insert failed');
  if (!alreadyWaiting) {
    await notify(
      db,
      thread.otherId,
      'NEW_MESSAGE',
      `New message about "${thread.listingTitle}".`,
      thread.notifyRef,
    );
  }
  return toPublic(message, meId);
}

const afterQuery = z.object({ after: z.coerce.date().optional() });
const textBody = z.object({ text: z.string().trim().min(1).max(1000) });

// ---------------------------------------------------------------- Trade chat

chatRouter.get('/transactions/:id/messages', requireAuth, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { after } = afterQuery.parse(req.query);
  const me = currentUser(res);
  res.json({ messages: await listMessages(await tradeThread(id, me.id), me.id, after) });
});

chatRouter.post(
  '/transactions/:id/messages',
  requireAuth,
  requireVerified,
  chatLimiter,
  async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { text } = textBody.parse(req.body);
    const me = currentUser(res);
    const message = await sendMessage(await tradeThread(id, me.id), me.id, text);
    res.status(201).json({ message });
  },
);

// ---------------------------------------------------------------- Inquiry chat (before claiming)

/**
 * Opens (or reopens) the caller's question thread with the seller of a listing. Idempotent:
 * asking twice about the same listing returns the same thread.
 */
chatRouter.post('/listings/:id/inquiry', requireAuth, requireVerified, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const me = currentUser(res);
  const db = getDb();
  const [listing] = await db.select().from(listings).where(eq(listings.id, id));
  if (!listing || listing.status === 'UNDER_REVIEW' || listing.status === 'REMOVED') {
    throw HttpError.notFound('Listing not found');
  }
  if (listing.sellerId === me.id) throw HttpError.badRequest('This is your own listing');

  const [existing] = await db
    .select({ id: inquiries.id })
    .from(inquiries)
    .where(and(eq(inquiries.listingId, id), eq(inquiries.buyerId, me.id)));
  if (existing) {
    res.json({ inquiry: existing });
    return;
  }
  if (listing.status !== 'AVAILABLE' && listing.status !== 'PENDING') {
    throw HttpError.conflict('This item is no longer available');
  }
  const [created] = await db
    .insert(inquiries)
    .values({ listingId: id, buyerId: me.id })
    .onConflictDoNothing()
    .returning({ id: inquiries.id });
  // A parallel request may have created it first; return that one.
  const inquiry =
    created ??
    (
      await db
        .select({ id: inquiries.id })
        .from(inquiries)
        .where(and(eq(inquiries.listingId, id), eq(inquiries.buyerId, me.id)))
    )[0];
  res.status(created ? 201 : 200).json({ inquiry });
});

const seller = alias(users, 'seller');

/**
 * The caller's question threads, as buyer or seller, newest activity first. A seller only sees a
 * thread once the buyer has written something.
 */
chatRouter.get('/inquiries/mine', requireAuth, async (_req, res) => {
  const me = currentUser(res);
  const db = getDb();
  const rows = await db
    .select({
      id: inquiries.id,
      createdAt: inquiries.createdAt,
      buyerId: inquiries.buyerId,
      buyerName: users.name,
      buyerAvatarUrl: users.avatarUrl,
      listingId: listings.id,
      listingTitle: listings.title,
      listingStatus: listings.status,
      listingType: listings.listingType,
      price: listings.price,
      pickupArea: listings.pickupArea,
      sellerId: listings.sellerId,
      sellerName: seller.name,
      sellerAvatarUrl: seller.avatarUrl,
    })
    .from(inquiries)
    .innerJoin(listings, eq(listings.id, inquiries.listingId))
    .innerJoin(users, eq(users.id, inquiries.buyerId))
    .innerJoin(seller, eq(seller.id, listings.sellerId))
    .where(or(eq(inquiries.buyerId, me.id), eq(listings.sellerId, me.id)))
    .orderBy(desc(inquiries.createdAt));

  const ids = rows.map((r) => r.id);
  const latest = ids.length
    ? await db
        .selectDistinctOn([messages.inquiryId], {
          inquiryId: messages.inquiryId,
          body: messages.body,
          createdAt: messages.createdAt,
          senderId: messages.senderId,
        })
        .from(messages)
        .where(inArray(messages.inquiryId, ids))
        .orderBy(messages.inquiryId, desc(messages.createdAt))
    : [];
  const unread = ids.length
    ? await db
        .select({ inquiryId: messages.inquiryId, n: count() })
        .from(messages)
        .where(
          and(
            inArray(messages.inquiryId, ids),
            ne(messages.senderId, me.id),
            isNull(messages.readAt),
          ),
        )
        .groupBy(messages.inquiryId)
    : [];
  const lastBy = new Map(latest.map((m) => [m.inquiryId, m]));
  const unreadBy = new Map(unread.map((u) => [u.inquiryId, u.n]));

  res.json({
    inquiries: rows
      .filter((r) => r.buyerId === me.id || lastBy.has(r.id))
      .map((r) => {
        const isBuyer = r.buyerId === me.id;
        const last = lastBy.get(r.id);
        return {
          id: r.id,
          createdAt: r.createdAt,
          listingId: r.listingId,
          listingTitle: r.listingTitle,
          listingStatus: r.listingStatus,
          listingType: r.listingType,
          price: Number(r.price),
          pickupArea: r.pickupArea,
          role: isBuyer ? ('BUYER' as const) : ('SELLER' as const),
          unreadCount: unreadBy.get(r.id) ?? 0,
          lastMessage: last
            ? { body: last.body, createdAt: last.createdAt, mine: last.senderId === me.id }
            : null,
          // No contact details here: those are only shared once a trade exists.
          counterpart: {
            id: isBuyer ? r.sellerId : r.buyerId,
            name: isBuyer ? r.sellerName : r.buyerName,
            avatarUrl: isBuyer ? r.sellerAvatarUrl : r.buyerAvatarUrl,
          },
        };
      }),
  });
});

chatRouter.get('/inquiries/:id/messages', requireAuth, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { after } = afterQuery.parse(req.query);
  const me = currentUser(res);
  res.json({ messages: await listMessages(await inquiryThread(id, me.id), me.id, after) });
});

chatRouter.post(
  '/inquiries/:id/messages',
  requireAuth,
  requireVerified,
  chatLimiter,
  async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { text } = textBody.parse(req.body);
    const me = currentUser(res);
    const message = await sendMessage(await inquiryThread(id, me.id), me.id, text);
    res.status(201).json({ message });
  },
);
