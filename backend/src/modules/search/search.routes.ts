import { Router } from 'express';
import { z } from 'zod';
import { parseSearchQuery } from '../../ai/agents/discovery-agent.js';
import { remainingQuota } from '../../ai/orchestrator.js';
import { getDb } from '../../db/client.js';
import { CATEGORIES } from '../../lib/constants.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { userWriteLimiter } from '../../middleware/rate-limit.js';
import { searchListings, type SearchParams } from '../listings/listings.service.js';

/** UC9-UC10 | FR-6, FR-7, FR-17 */
export const searchRouter = Router();

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const searchQuery = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.enum(CATEGORIES).optional(),
  type: z.enum(['SELL', 'EXCHANGE', 'FREE']).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  free: bool.optional(),
  urgent: bool.optional(),
  expiresWithinHours: z.coerce
    .number()
    .positive()
    .max(24 * 30)
    .optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

searchRouter.get('/search', async (req, res) => {
  const q = searchQuery.parse(req.query);
  const params: SearchParams = {
    q: q.q,
    category: q.category,
    type: q.type,
    maxPrice: q.maxPrice,
    freeOnly: q.free,
    urgentOnly: q.urgent,
    expiresWithinHours: q.expiresWithinHours,
    lat: q.lat,
    lng: q.lng,
    radiusKm: q.radiusKm,
    limit: q.limit,
    offset: q.offset,
  };
  res.json({ results: await searchListings(getDb(), params) });
});

/** Natural-language search: the Discovery Agent turns the sentence into filters. */
searchRouter.get('/search/chat', requireAuth, userWriteLimiter, async (req, res) => {
  const { q, lat, lng } = z
    .object({
      q: z.string().trim().min(1).max(300),
      lat: z.coerce.number().min(-90).max(90).optional(),
      lng: z.coerce.number().min(-180).max(180).optional(),
    })
    .parse(req.query);
  const user = currentUser(res);
  const filters = await parseSearchQuery(q, user.id);
  const results = await searchListings(getDb(), {
    q: filters.query,
    category: filters.category,
    maxPrice: filters.maxPrice,
    freeOnly: filters.freeOnly,
    expiresWithinHours: filters.expiresWithinHours,
    radiusKm: filters.radiusKm,
    lat,
    lng,
    limit: 30,
    offset: 0,
  });
  res.json({ filters, results, remainingAiRequests: await remainingQuota(user.id) });
});
