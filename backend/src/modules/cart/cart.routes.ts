import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { cartItems, listings, users } from '../../db/schema.js';
import { HttpError } from '../../lib/http-error.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { toPublicListing } from '../listings/listings.service.js';

/** Saved-for-later listings. Claiming still goes through POST /listings/:id/claim. */
export const cartRouter = Router();

const listingParam = z.object({ listingId: z.uuid() });

cartRouter.get('/cart', requireAuth, async (_req, res) => {
  const me = currentUser(res);
  const rows = await getDb()
    .select({ listing: listings, addedAt: cartItems.addedAt, sellerName: users.name })
    .from(cartItems)
    .innerJoin(listings, eq(listings.id, cartItems.listingId))
    .innerJoin(users, eq(users.id, listings.sellerId))
    .where(eq(cartItems.userId, me.id))
    .orderBy(desc(cartItems.addedAt));

  const now = Date.now();
  res.json({
    items: rows
      // Hidden or removed listings drop out of the cart instead of leaking their details.
      .filter((r) => r.listing.status !== 'UNDER_REVIEW' && r.listing.status !== 'REMOVED')
      .map((r) => ({
        addedAt: r.addedAt,
        available: r.listing.status === 'AVAILABLE' && r.listing.expiryDate.getTime() > now,
        listing: toPublicListing(r.listing, { sellerName: r.sellerName }),
      })),
  });
});

cartRouter.post('/cart', requireAuth, async (req, res) => {
  const { listingId } = listingParam.parse(req.body);
  const me = currentUser(res);
  const db = getDb();
  const [listing] = await db
    .select({ sellerId: listings.sellerId, status: listings.status })
    .from(listings)
    .where(eq(listings.id, listingId));
  if (!listing || listing.status === 'UNDER_REVIEW' || listing.status === 'REMOVED') {
    throw HttpError.notFound('Listing not found');
  }
  if (listing.sellerId === me.id) throw HttpError.badRequest('You cannot add your own listing');
  if (listing.status !== 'AVAILABLE' && listing.status !== 'PENDING') {
    throw HttpError.conflict('This item is no longer available');
  }
  await db.insert(cartItems).values({ userId: me.id, listingId }).onConflictDoNothing();
  res.status(201).json({ ok: true });
});

cartRouter.delete('/cart/:listingId', requireAuth, async (req, res) => {
  const { listingId } = listingParam.parse(req.params);
  const me = currentUser(res);
  await getDb()
    .delete(cartItems)
    .where(and(eq(cartItems.userId, me.id), eq(cartItems.listingId, listingId)));
  res.status(204).end();
});
