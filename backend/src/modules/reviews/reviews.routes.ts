import { Router } from 'express';
import { notImplemented } from '../../lib/not-implemented.js';

/** UC14 */
export const reviewsRouter = Router();

reviewsRouter.post('/transactions/:id/reviews', notImplemented('Rate and review'));
reviewsRouter.get('/users/:id/reviews', notImplemented('Public profile reviews'));
