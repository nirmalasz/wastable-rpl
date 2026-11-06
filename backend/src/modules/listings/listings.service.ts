import { and, asc, desc, eq, gt, ilike, inArray, lte, or, sql, avg, type SQL } from 'drizzle-orm';
import type { Executor } from '../../db/client.js';
import { listings, reviews, users } from '../../db/schema.js';

type ListingRow = typeof listings.$inferSelect;

/** Public shape of a listing. Exact coordinates and address are never returned (privacy NFR). */
export function toPublicListing(
  row: ListingRow,
  extra: {
    sellerName?: string;
    sellerAvatarUrl?: string | null;
    sellerRating?: number | null;
    distanceKm?: number | null;
  } = {},
) {
  const rest: Partial<ListingRow> = { ...row };
  delete rest.pickupLat;
  delete rest.pickupLng;
  delete rest.pickupAddress;
  return { ...rest, price: Number(row.price), ...extra } as Omit<
    ListingRow,
    'pickupLat' | 'pickupLng' | 'pickupAddress' | 'price'
  > & {
    price: number;
    sellerName?: string;
    sellerRating?: number | null;
    distanceKm?: number | null;
  };
}

export async function sellerRatings(db: Executor, sellerIds: string[]) {
  const map = new Map<string, { rating: number | null; count: number }>();
  if (sellerIds.length === 0) return map;
  const rows = await db
    .select({ id: reviews.revieweeId, avg: avg(reviews.rating), count: sql<number>`count(*)::int` })
    .from(reviews)
    .where(inArray(reviews.revieweeId, sellerIds))
    .groupBy(reviews.revieweeId);
  for (const r of rows) map.set(r.id, { rating: r.avg ? Number(r.avg) : null, count: r.count });
  return map;
}

export interface SearchParams {
  q?: string;
  category?: string;
  type?: 'SELL' | 'EXCHANGE' | 'FREE';
  maxPrice?: number;
  freeOnly?: boolean;
  urgentOnly?: boolean;
  expiresWithinHours?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit: number;
  offset: number;
}

const STOP_WORDS = new Set(['the', 'and', 'for', 'yang', 'dan', 'dekat', 'near', 'some', 'with']);

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Browse / filter the feed (FR-6). Only AVAILABLE, unexpired listings. Urgent items first,
 * then soonest to expire. A listing without stored coordinates is never excluded by radius.
 */
export async function searchListings(db: Executor, p: SearchParams, now: Date = new Date()) {
  const conds: (SQL | undefined)[] = [
    eq(listings.status, 'AVAILABLE'),
    gt(listings.expiryDate, now),
  ];

  const tokens = (p.q ?? '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t))
    .slice(0, 8);
  if (tokens.length > 0) {
    conds.push(
      or(
        ...tokens.flatMap((t) => [
          ilike(listings.title, `%${escapeLike(t)}%`),
          ilike(listings.description, `%${escapeLike(t)}%`),
          ilike(listings.category, `%${escapeLike(t)}%`),
        ]),
      ),
    );
  }
  if (p.category) conds.push(eq(listings.category, p.category));
  if (p.type) conds.push(eq(listings.listingType, p.type));
  if (p.freeOnly) conds.push(eq(listings.listingType, 'FREE'));
  if (p.maxPrice !== undefined) conds.push(lte(listings.price, String(p.maxPrice)));
  if (p.urgentOnly) conds.push(eq(listings.isUrgent, true));
  if (p.expiresWithinHours !== undefined) {
    conds.push(
      lte(listings.expiryDate, new Date(now.getTime() + p.expiresWithinHours * 3_600_000)),
    );
  }

  const hasLocation = p.lat !== undefined && p.lng !== undefined;
  const distance = hasLocation
    ? sql<
        number | null
      >`CASE WHEN ${listings.pickupLat} IS NULL OR ${listings.pickupLng} IS NULL THEN NULL ELSE
        6371 * acos(least(1, greatest(-1,
          cos(radians(${p.lat}::float8)) * cos(radians(${listings.pickupLat}::float8))
            * cos(radians(${listings.pickupLng}::float8) - radians(${p.lng}::float8))
          + sin(radians(${p.lat}::float8)) * sin(radians(${listings.pickupLat}::float8))))) END`
    : sql<number | null>`NULL::float8`;
  if (hasLocation && p.radiusKm !== undefined) {
    conds.push(sql`(${distance} IS NULL OR ${distance} <= ${p.radiusKm}::float8)`);
  }

  const rows = await db
    .select({ listing: listings, sellerName: users.name, distanceKm: distance })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.sellerId))
    .where(and(...conds))
    .orderBy(desc(listings.isUrgent), asc(listings.expiryDate))
    .limit(p.limit)
    .offset(p.offset);

  const ratings = await sellerRatings(db, [...new Set(rows.map((r) => r.listing.sellerId))]);
  return rows.map((r) =>
    toPublicListing(r.listing, {
      sellerName: r.sellerName,
      sellerRating: ratings.get(r.listing.sellerId)?.rating ?? null,
      distanceKm: r.distanceKm === null ? null : Math.round(Number(r.distanceKm) * 10) / 10,
    }),
  );
}
