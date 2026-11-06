import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import type { AuthUser } from './auth.js';

/**
 * Per-account limit for writes that call the AI model (listing create/edit, AI extract,
 * conversational search, reports). The moderation agent is not covered by the daily AI quota,
 * so without this one account could run up the Gemini bill. Use after requireAuth.
 */
export const userWriteLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (_req, res) => `user:${(res.locals.user as AuthUser).id}`,
  skip: () => env.NODE_ENV === 'test',
  message: { error: 'You are doing that too often. Please wait a few minutes and try again.' },
});
