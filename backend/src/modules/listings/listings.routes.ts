import { and, count, desc, eq, gt, inArray } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { extractListingDraft } from '../../ai/agents/listing-agent.js';
import { moderateListing } from '../../ai/agents/moderation-agent.js';
import { remainingQuota } from '../../ai/orchestrator.js';
import { getDb } from '../../db/client.js';
import {
  compostPartners,
  compostReferrals,
  listings,
  moderationCases,
  transactions,
  users,
  waitlistEntries,
} from '../../db/schema.js';
import { CATEGORIES, URGENT_WINDOW_HOURS } from '../../lib/constants.js';
import { HttpError } from '../../lib/http-error.js';
import { sendMail } from '../../lib/mailer.js';
import { reverseGeocode } from '../../lib/geocode.js';
import { uploadUrlSchema } from '../../lib/storage.js';
import {
  currentUser,
  optionalAuth,
  requireAuth,
  requireVerified,
  type AuthUser,
} from '../../middleware/auth.js';
import { userWriteLimiter } from '../../middleware/rate-limit.js';
import { registerViolation } from '../moderation/moderation.service.js';
import { notify, notifyAdmins } from '../notifications/notifications.service.js';
import { sellerRatings, toPublicListing } from './listings.service.js';

/** UC5-UC8, UC20 | FR-3, FR-4, FR-5, FR-15 */
export const listingsRouter = Router();

const uuidParam = z.object({ id: z.uuid() });

const isUrgent = (expiry: Date, now = new Date()) =>
  expiry.getTime() - now.getTime() <= URGENT_WINDOW_HOURS * 3_600_000;

const listingFields = {
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullish(),
  category: z.enum(CATEGORIES),
  quantity: z.number().int().min(1).max(10_000),
  listingType: z.enum(['SELL', 'EXCHANGE', 'FREE']),
  price: z.number().min(0).max(100_000_000).default(0),
  expiryDate: z.coerce.date(),
  pickupArea: z.string().trim().min(1).max(200),
  pickupLat: z.number().min(-90).max(90).nullish(),
  pickupLng: z.number().min(-180).max(180).nullish(),
  photoUrl: uploadUrlSchema.nullish(),
};

const createSchema = z.object(listingFields);

type ListingType = z.infer<typeof listingFields.listingType>;

/** A "sale" at Rp 0 is a giveaway: store it as FREE so search, badges and claims agree. */
function normalizeOffer(listingType: ListingType, price: number) {
  if (listingType === 'SELL' && price <= 0) return { listingType: 'FREE' as const, price: 0 };
  return { listingType, price: listingType === 'SELL' ? price : 0 };
}

const updateSchema = z.object(listingFields).partial();

async function moderationOutcome(user: AuthUser, text: string) {
  const result = await moderateListing(text, user.id);
  if (result.verdict === 'PROHIBITED') {
    const reason = result.matched.length
      ? `prohibited item (${result.matched.join(', ')})`
      : (result.rationale ?? 'prohibited item');
    await registerViolation(getDb(), user.id, `listing rejected: ${reason}`);
    throw new HttpError(403, `Listing rejected: ${reason}`, { verdict: result.verdict });
  }
  return result;
}

const writer = [requireAuth, requireVerified, userWriteLimiter];

listingsRouter.post('/listings/extract', ...writer, async (req, res) => {
  const body = z
    .object({ text: z.string().trim().max(2000).optional(), photoUrl: uploadUrlSchema.optional() })
    .refine((b) => b.text || b.photoUrl, {
      message: 'Describe the food in words or add a photo first.',
    })
    .parse(req.body);
  const user = currentUser(res);
  const draft = await extractListingDraft(body, user.id);
  res.json({ draft, remainingAiRequests: await remainingQuota(user.id) });
});

listingsRouter.post('/listings', ...writer, async (req, res) => {
  const body = createSchema.parse(req.body);
  const user = currentUser(res);
  const now = new Date();
  if (body.expiryDate.getTime() <= now.getTime()) {
    throw HttpError.unprocessable('Expiry date must be in the future');
  }

  const moderation = await moderationOutcome(user, `${body.title}\n${body.description ?? ''}`);
  const underReview = moderation.verdict === 'UNCERTAIN';

  const offer = normalizeOffer(body.listingType, body.price);
  const geo =
    body.pickupLat != null && body.pickupLng != null
      ? await reverseGeocode(body.pickupLat, body.pickupLng)
      : null;
  const values = {
    sellerId: user.id,
    title: body.title,
    description: body.description ?? null,
    category: body.category,
    quantity: body.quantity,
    listingType: offer.listingType,
    price: String(offer.price),
    expiryDate: body.expiryDate,
    pickupArea: body.pickupArea,
    pickupLat: body.pickupLat == null ? null : String(body.pickupLat),
    pickupLng: body.pickupLng == null ? null : String(body.pickupLng),
    pickupAddress: geo?.address ?? null,
    photoUrl: body.photoUrl ?? null,
    dietFlags: moderation.dietFlags,
    isUrgent: !underReview && isUrgent(body.expiryDate, now),
    status: underReview ? ('UNDER_REVIEW' as const) : ('AVAILABLE' as const),
  };

  const listing = await getDb().transaction(async (tx) => {
    const [row] = await tx.insert(listings).values(values).returning();
    if (!row) throw new Error('listing insert failed');
    if (underReview) {
      await tx.insert(moderationCases).values({
        listingId: row.id,
        source: moderation.source === 'AI' ? 'AI_FLAG' : 'RULE_FILTER',
        aiFlags: moderation.dietFlags,
        aiRationale: moderation.rationale ?? null,
      });
      await notifyAdmins(tx, 'NEW_CASE', `Listing "${row.title}" needs moderation review.`);
    }
    return row;
  });

  if (underReview) {
    res.status(202).json({
      listing: toPublicListing(listing),
      message: 'Your listing is pending admin review before it is published.',
    });
    return;
  }
  res.status(201).json({ listing: toPublicListing(listing) });
});

/** Preview the address for a pin before saving (seller's form). Throttled like Nominatim. */
listingsRouter.get('/geocode/reverse', requireAuth, userWriteLimiter, async (req, res) => {
  const { lat, lng } = z
    .object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) })
    .parse(req.query);
  res.json({ result: await reverseGeocode(lat, lng) });
});

listingsRouter.get('/listings/mine', requireAuth, async (_req, res) => {
  const me = currentUser(res);
  const db = getDb();
  const rows = await db
    .select()
    .from(listings)
    .where(eq(listings.sellerId, me.id))
    .orderBy(desc(listings.createdAt));

  const pendingIds = rows.filter((r) => r.status === 'PENDING').map((r) => r.id);
  const pending = pendingIds.length
    ? await db
        .select({
          listingId: transactions.listingId,
          transactionId: transactions.id,
          claimerName: users.name,
        })
        .from(transactions)
        .innerJoin(users, eq(users.id, transactions.claimerId))
        .where(and(inArray(transactions.listingId, pendingIds), eq(transactions.status, 'PENDING')))
    : [];
  const byListing = new Map(pending.map((p) => [p.listingId, p]));

  res.json({
    listings: rows.map((r) => ({
      ...toPublicListing(r),
      pendingClaim: byListing.get(r.id) ?? null,
    })),
  });
});

/** Public seller profile: who they are plus their live listings (nothing hidden or finished). */
listingsRouter.get('/users/:id/listings', async (req, res) => {
  const { id } = uuidParam.parse(req.params);
  const db = getDb();
  const [user] = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, id));
  if (!user) throw HttpError.notFound('User not found');

  const rows = await db
    .select()
    .from(listings)
    .where(
      and(
        eq(listings.sellerId, id),
        inArray(listings.status, ['AVAILABLE', 'PENDING']),
        gt(listings.expiryDate, new Date()),
      ),
    )
    .orderBy(desc(listings.createdAt));
  const rating = (await sellerRatings(db, [id])).get(id);

  res.json({
    user,
    listings: rows.map((r) =>
      toPublicListing(r, {
        sellerName: user.name,
        sellerAvatarUrl: user.avatarUrl,
        sellerRating: rating?.rating ?? null,
      }),
    ),
  });
});

listingsRouter.get('/listings/:id', optionalAuth, async (req, res) => {
  const { id } = uuidParam.parse(req.params);
  const viewer = res.locals.user as AuthUser | undefined;
  const db = getDb();
  const [row] = await db.select().from(listings).where(eq(listings.id, id));
  if (!row) throw HttpError.notFound('Listing not found');

  const isOwner = viewer?.id === row.sellerId;
  const hidden = row.status === 'UNDER_REVIEW' || row.status === 'REMOVED';
  if (hidden && !isOwner && viewer?.role !== 'ADMIN') throw HttpError.notFound('Listing not found');

  const [seller] = await db
    .select({ name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, row.sellerId));
  const rating = (await sellerRatings(db, [row.sellerId])).get(row.sellerId);
  const [{ waitlistCount } = { waitlistCount: 0 }] = await db
    .select({ waitlistCount: count() })
    .from(waitlistEntries)
    .where(eq(waitlistEntries.listingId, id));

  let myWaitlistPosition: number | null = null;
  let myTransaction: { id: string; status: string } | null = null;
  if (viewer) {
    const [w] = await db
      .select({ position: waitlistEntries.position })
      .from(waitlistEntries)
      .where(and(eq(waitlistEntries.listingId, id), eq(waitlistEntries.userId, viewer.id)));
    myWaitlistPosition = w?.position ?? null;
    const [t] = await db
      .select({ id: transactions.id, status: transactions.status })
      .from(transactions)
      .where(
        and(
          eq(transactions.listingId, id),
          eq(transactions.claimerId, viewer.id),
          eq(transactions.status, 'PENDING'),
        ),
      );
    myTransaction = t ?? null;
  }

  res.json({
    listing: toPublicListing(row, {
      sellerName: seller?.name ?? 'Unknown',
      sellerAvatarUrl: seller?.avatarUrl ?? null,
      sellerRating: rating?.rating ?? null,
    }),
    sellerReviewCount: rating?.count ?? 0,
    isOwner,
    // Exact coordinates stay private (NFR); only the seller gets them back, to check the pin.
    pickupLocation:
      isOwner && row.pickupLat !== null && row.pickupLng !== null
        ? { lat: Number(row.pickupLat), lng: Number(row.pickupLng), address: row.pickupAddress }
        : null,
    waitlistCount,
    myWaitlistPosition,
    myTransaction,
  });
});

async function ownedListing(id: string, user: AuthUser) {
  const [row] = await getDb().select().from(listings).where(eq(listings.id, id));
  if (!row) throw HttpError.notFound('Listing not found');
  if (row.sellerId !== user.id)
    throw HttpError.forbidden('Only the seller can change this listing');
  return row;
}

listingsRouter.patch('/listings/:id', ...writer, async (req, res) => {
  const { id } = uuidParam.parse(req.params);
  const body = updateSchema.parse(req.body);
  const user = currentUser(res);
  const existing = await ownedListing(id, user);
  if (existing.status !== 'AVAILABLE') {
    throw HttpError.conflict(`A ${existing.status.toLowerCase()} listing cannot be edited`);
  }
  if (body.expiryDate && body.expiryDate.getTime() <= Date.now()) {
    throw HttpError.unprocessable('Expiry date must be in the future');
  }
  const { listingType, price } = normalizeOffer(
    body.listingType ?? existing.listingType,
    body.price ?? Number(existing.price),
  );

  let dietFlags = existing.dietFlags;
  let underReview = false;
  let moderation: Awaited<ReturnType<typeof moderationOutcome>> | undefined;
  if (body.title !== undefined || body.description !== undefined) {
    const title = body.title ?? existing.title;
    const description = body.description === undefined ? existing.description : body.description;
    moderation = await moderationOutcome(user, `${title}\n${description ?? ''}`);
    dietFlags = moderation.dietFlags;
    underReview = moderation.verdict === 'UNCERTAIN';
  }
  const expiryDate = body.expiryDate ?? existing.expiryDate;

  // Look the address up again only when the pin moves; clearing the pin clears it.
  const pinChanged = body.pickupLat !== undefined || body.pickupLng !== undefined;
  const pickupAddress = !pinChanged
    ? undefined
    : body.pickupLat != null && body.pickupLng != null
      ? ((await reverseGeocode(body.pickupLat, body.pickupLng))?.address ?? null)
      : null;

  const updated = await getDb().transaction(async (tx) => {
    const [row] = await tx
      .update(listings)
      .set({
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.quantity !== undefined && { quantity: body.quantity }),
        listingType,
        price: String(price),
        expiryDate,
        ...(body.pickupArea !== undefined && { pickupArea: body.pickupArea }),
        ...(body.pickupLat !== undefined && {
          pickupLat: body.pickupLat === null ? null : String(body.pickupLat),
        }),
        ...(body.pickupLng !== undefined && {
          pickupLng: body.pickupLng === null ? null : String(body.pickupLng),
        }),
        ...(pickupAddress !== undefined && { pickupAddress }),
        ...(body.photoUrl !== undefined && { photoUrl: body.photoUrl }),
        dietFlags,
        isUrgent: isUrgent(expiryDate),
        status: underReview ? 'UNDER_REVIEW' : 'AVAILABLE',
        updatedAt: new Date(),
      })
      .where(eq(listings.id, id))
      .returning();
    if (!row) throw HttpError.notFound('Listing not found');
    if (underReview && moderation) {
      await tx.insert(moderationCases).values({
        listingId: id,
        source: moderation.source === 'AI' ? 'AI_FLAG' : 'RULE_FILTER',
        aiFlags: moderation.dietFlags,
        aiRationale: moderation.rationale ?? null,
      });
      await notifyAdmins(tx, 'NEW_CASE', `Edited listing "${row.title}" needs moderation review.`);
    }
    return row;
  });
  res.json({ listing: toPublicListing(updated) });
});

listingsRouter.delete('/listings/:id', requireAuth, async (req, res) => {
  const { id } = uuidParam.parse(req.params);
  const existing = await ownedListing(id, currentUser(res));
  if (existing.status === 'PENDING') {
    throw HttpError.conflict('Resolve the pending claim before deleting this listing');
  }
  await getDb()
    .update(listings)
    .set({ status: 'REMOVED', updatedAt: new Date() })
    .where(eq(listings.id, id));
  res.status(204).end();
});

listingsRouter.post(
  '/listings/:id/compost-referral',
  requireAuth,
  requireVerified,
  async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    const existing = await ownedListing(id, currentUser(res));
    if (existing.status !== 'EXPIRED') {
      throw HttpError.conflict('Only expired listings can be referred to compost');
    }
    const partners = await getDb().select().from(compostPartners);
    const area = existing.pickupArea.toLowerCase();
    const partner =
      partners.find((p) => p.areaServed && area.includes(p.areaServed.toLowerCase())) ??
      partners[0];
    if (!partner) throw new HttpError(503, 'No compost partner is available right now');

    const referral = await getDb().transaction(async (tx) => {
      const [row] = await tx
        .insert(compostReferrals)
        .values({ listingId: id, partnerId: partner.id })
        .returning();
      await tx
        .update(listings)
        .set({ status: 'REFERRED_TO_COMPOST', updatedAt: new Date() })
        .where(eq(listings.id, id));
      await notify(
        tx,
        existing.sellerId,
        'LISTING_EXPIRED',
        `"${existing.title}" was referred to ${partner.name} for composting.`,
      );
      return row;
    });
    await sendMail(
      partner.contactEmail,
      'WASTABLE compost referral',
      `${existing.quantity} x ${existing.title} (${existing.category}) at ${existing.pickupArea} is available for composting.`,
    );
    res.status(201).json({ referral, partner: { id: partner.id, name: partner.name } });
  },
);
