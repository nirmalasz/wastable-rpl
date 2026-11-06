import { desc, eq, avg, count } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { listings, reviews, transactions, users } from '../../db/schema.js';
import { HttpError } from '../../lib/http-error.js';
import { uploadUrlSchema } from '../../lib/storage.js';
import { currentUser, requireAuth, requireVerified } from '../../middleware/auth.js';
import { notify } from '../notifications/notifications.service.js';

/** UC14 */
export const reviewsRouter = Router();

const idParam = z.object({ id: z.uuid() });

// Suspended accounts cannot leave reviews (requireVerified also blocks SUSPENDED).
reviewsRouter.post('/transactions/:id/reviews', requireAuth, requireVerified, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const body = z
    .object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().max(1000).optional(),
      photoUrl: uploadUrlSchema.nullish(),
    })
    .parse(req.body);
  const me = currentUser(res);
  const db = getDb();

  const [row] = await db
    .select({
      status: transactions.status,
      claimerId: transactions.claimerId,
      sellerId: listings.sellerId,
    })
    .from(transactions)
    .innerJoin(listings, eq(listings.id, transactions.listingId))
    .where(eq(transactions.id, id));
  if (!row) throw HttpError.notFound('Transaction not found');
  if (me.id !== row.claimerId && me.id !== row.sellerId) throw HttpError.forbidden();
  if (row.status !== 'COMPLETED')
    throw HttpError.conflict('You can review after the pickup is completed');

  const revieweeId = me.id === row.claimerId ? row.sellerId : row.claimerId;
  const existing = await db.query.reviews.findFirst({
    where: (r, { and: all, eq: is }) => all(is(r.transactionId, id), is(r.reviewerId, me.id)),
  });
  if (existing) throw HttpError.conflict('You already reviewed this transaction');

  const [review] = await db
    .insert(reviews)
    .values({
      transactionId: id,
      reviewerId: me.id,
      revieweeId,
      rating: body.rating,
      comment: body.comment ?? null,
      photoUrl: body.photoUrl ?? null,
    })
    .returning();
  await notify(db, revieweeId, 'NEW_REVIEW', `You received a ${body.rating}-star review.`);
  res.status(201).json({ review });
});

reviewsRouter.get('/users/:id/reviews', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const db = getDb();
  const [user] = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, id));
  if (!user) throw HttpError.notFound('User not found');

  const [summary] = await db
    .select({ average: avg(reviews.rating), total: count() })
    .from(reviews)
    .where(eq(reviews.revieweeId, id));
  const items = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      photoUrl: reviews.photoUrl,
      createdAt: reviews.createdAt,
      reviewerId: reviews.reviewerId,
      reviewerName: users.name,
      reviewerAvatarUrl: users.avatarUrl,
      claimerId: transactions.claimerId,
      listingId: listings.id,
      listingTitle: listings.title,
      listingPhotoUrl: listings.photoUrl,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.reviewerId))
    .innerJoin(transactions, eq(transactions.id, reviews.transactionId))
    .innerJoin(listings, eq(listings.id, transactions.listingId))
    .where(eq(reviews.revieweeId, id))
    .orderBy(desc(reviews.createdAt))
    .limit(50);

  res.json({
    user,
    average: summary?.average ? Number(summary.average) : null,
    total: summary?.total ?? 0,
    // The reviewer's side of the deal: the claimer is the buyer, the other party the seller.
    reviews: items.map(({ claimerId, ...r }) => ({
      ...r,
      reviewerRole: r.reviewerId === claimerId ? ('BUYER' as const) : ('SELLER' as const),
    })),
  });
});
