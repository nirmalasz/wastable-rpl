import { and, asc, count, desc, eq, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { listings, transactions, users, waitlistEntries } from '../../db/schema.js';
import { MAX_OPEN_CLAIMS } from '../../lib/constants.js';
import { HttpError } from '../../lib/http-error.js';
import { currentUser, requireAuth, requireVerified } from '../../middleware/auth.js';
import { notify } from '../notifications/notifications.service.js';
import { cancelTransaction } from './transactions.service.js';

/** UC11-UC13 | FR-8, FR-9. Claiming locks the listing row (SELECT ... FOR UPDATE). */
export const transactionsRouter = Router();

const idParam = z.object({ id: z.uuid() });

transactionsRouter.post('/listings/:id/claim', requireAuth, requireVerified, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const user = currentUser(res);

  const transaction = await getDb().transaction(async (tx) => {
    const [listing] = await tx.select().from(listings).where(eq(listings.id, id)).for('update');
    if (!listing) throw HttpError.notFound('Listing not found');
    if (listing.sellerId === user.id)
      throw HttpError.badRequest('You cannot claim your own listing');
    if (listing.status === 'PENDING') {
      throw new HttpError(409, 'This item is reserved by someone else', { canJoinWaitlist: true });
    }
    if (listing.status !== 'AVAILABLE' || listing.expiryDate.getTime() <= Date.now()) {
      throw HttpError.conflict('This item is no longer available');
    }
    // Lock the claimer row so two parallel claims cannot both slip under the cap.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update');
    const [{ open } = { open: 0 }] = await tx
      .select({ open: count() })
      .from(transactions)
      .where(and(eq(transactions.claimerId, user.id), eq(transactions.status, 'PENDING')));
    if (open >= MAX_OPEN_CLAIMS) {
      throw HttpError.tooMany(
        `You already have ${MAX_OPEN_CLAIMS} open claims. Complete or cancel one before claiming more.`,
      );
    }

    const [created] = await tx
      .insert(transactions)
      .values({ listingId: id, claimerId: user.id })
      .returning();
    await tx
      .update(listings)
      .set({ status: 'PENDING', updatedAt: new Date() })
      .where(eq(listings.id, id));
    await notify(
      tx,
      listing.sellerId,
      'CLAIM_REQUEST',
      `Someone wants "${listing.title}". Arrange the pickup or delivery details.`,
    );
    return created;
  });
  res.status(201).json({ transaction, listingStatus: 'PENDING' });
});

transactionsRouter.post(
  '/listings/:id/waitlist',
  requireAuth,
  requireVerified,
  async (req, res) => {
    const { id } = idParam.parse(req.params);
    const user = currentUser(res);

    const entry = await getDb().transaction(async (tx) => {
      const [listing] = await tx.select().from(listings).where(eq(listings.id, id)).for('update');
      if (!listing) throw HttpError.notFound('Listing not found');
      if (listing.sellerId === user.id)
        throw HttpError.badRequest('You cannot join your own waitlist');
      if (listing.status !== 'PENDING') {
        throw HttpError.conflict('The waitlist is only available while an item is reserved');
      }
      const [claim] = await tx
        .select({ claimerId: transactions.claimerId })
        .from(transactions)
        .where(and(eq(transactions.listingId, id), eq(transactions.status, 'PENDING')));
      if (claim?.claimerId === user.id) throw HttpError.conflict('You are the one who reserved it');

      const [dupe] = await tx
        .select({ id: waitlistEntries.id })
        .from(waitlistEntries)
        .where(and(eq(waitlistEntries.listingId, id), eq(waitlistEntries.userId, user.id)));
      if (dupe) throw HttpError.conflict('You are already on the waitlist');

      const [{ n } = { n: 0 }] = await tx
        .select({ n: count() })
        .from(waitlistEntries)
        .where(eq(waitlistEntries.listingId, id));
      const [created] = await tx
        .insert(waitlistEntries)
        .values({ listingId: id, userId: user.id, position: n + 1 })
        .returning();
      return created;
    });
    res.status(201).json({ entry });
  },
);

const seller = alias(users, 'seller');

transactionsRouter.get('/transactions/mine', requireAuth, async (_req, res) => {
  const me = currentUser(res);
  const rows = await getDb()
    .select({
      id: transactions.id,
      status: transactions.status,
      createdAt: transactions.createdAt,
      completedAt: transactions.completedAt,
      listingId: listings.id,
      listingTitle: listings.title,
      listingType: listings.listingType,
      price: listings.price,
      pickupArea: listings.pickupArea,
      sellerId: listings.sellerId,
      claimerId: transactions.claimerId,
      claimerName: users.name,
      claimerContact: users.contactPreference,
      sellerName: seller.name,
      sellerContact: seller.contactPreference,
    })
    .from(transactions)
    .innerJoin(listings, eq(listings.id, transactions.listingId))
    .innerJoin(users, eq(users.id, transactions.claimerId))
    .innerJoin(seller, eq(seller.id, listings.sellerId))
    .where(or(eq(transactions.claimerId, me.id), eq(listings.sellerId, me.id)))
    .orderBy(desc(transactions.createdAt));

  res.json({
    transactions: rows.map(({ claimerContact, sellerName, sellerContact, claimerId, ...r }) => {
      const isBuyer = claimerId === me.id;
      return {
        ...r,
        price: Number(r.price),
        role: isBuyer ? ('BUYER' as const) : ('SELLER' as const),
        // Contact details are only shared between the two people in an open or finished deal.
        counterpart: {
          name: isBuyer ? sellerName : r.claimerName,
          contact: r.status === 'CANCELLED' ? null : isBuyer ? sellerContact : claimerContact,
        },
      };
    }),
  });
});

const updateSchema = z.object({ status: z.enum(['COMPLETED', 'CANCELLED']) });

/** Buyer confirms pickup (COMPLETED); buyer or seller can cancel, which frees the listing. */
transactionsRouter.patch('/transactions/:id', requireAuth, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { status } = updateSchema.parse(req.body);
  const user = currentUser(res);

  const result = await getDb().transaction(async (tx) => {
    const [found] = await tx.select().from(transactions).where(eq(transactions.id, id));
    if (!found) throw HttpError.notFound('Transaction not found');
    const [listing] = await tx
      .select()
      .from(listings)
      .where(eq(listings.id, found.listingId))
      .for('update');
    if (!listing) throw HttpError.notFound('Listing not found');

    const isClaimer = found.claimerId === user.id;
    const isSeller = listing.sellerId === user.id;
    if (!isClaimer && !isSeller) throw HttpError.forbidden();
    if (status === 'COMPLETED' && !isClaimer) {
      throw HttpError.forbidden('Only the buyer can confirm the pickup');
    }
    if (found.status !== 'PENDING')
      throw HttpError.conflict(`Transaction is already ${found.status}`);

    if (status === 'COMPLETED') {
      const waiting = await tx
        .select()
        .from(waitlistEntries)
        .where(eq(waitlistEntries.listingId, listing.id))
        .orderBy(asc(waitlistEntries.position));
      const [done] = await tx
        .update(transactions)
        .set({ status, completedAt: new Date(), updatedAt: new Date() })
        .where(eq(transactions.id, id))
        .returning();
      await tx
        .update(listings)
        .set({ status: 'COMPLETED', updatedAt: new Date() })
        .where(eq(listings.id, listing.id));
      await notify(
        tx,
        listing.sellerId,
        'PICKUP_COMPLETED',
        `Pickup of "${listing.title}" is confirmed. Leave a review!`,
      );
      for (const w of waiting) {
        await notify(tx, w.userId, 'ITEM_TAKEN', `"${listing.title}" has been taken.`);
      }
      await tx.delete(waitlistEntries).where(eq(waitlistEntries.listingId, listing.id));
      return { transaction: done, listingStatus: 'COMPLETED' as const };
    }

    // CANCELLED: free the listing and offer it to the first person in the queue.
    const other = isClaimer ? listing.sellerId : found.claimerId;
    return cancelTransaction(tx, found, listing, [other]);
  });
  res.json(result);
});
