import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth/auth.routes.js';
import { listingsRouter } from './listings/listings.routes.js';
import { searchRouter } from './search/search.routes.js';
import { transactionsRouter } from './transactions/transactions.routes.js';
import { reviewsRouter } from './reviews/reviews.routes.js';
import { notificationsRouter } from './notifications/notifications.routes.js';
import { moderationRouter } from './moderation/moderation.routes.js';

/** All API routes, mounted under /api in app.ts. */
export const apiRouter = Router();

apiRouter.use(
  healthRouter,
  authRouter,
  listingsRouter,
  searchRouter,
  transactionsRouter,
  reviewsRouter,
  notificationsRouter,
  moderationRouter,
);
