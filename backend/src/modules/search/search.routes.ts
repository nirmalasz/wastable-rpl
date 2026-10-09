import { Router } from 'express';
import { notImplemented } from '../../lib/not-implemented.js';

/** UC9-UC10 | FR-6, FR-7, FR-17 */
export const searchRouter = Router();

searchRouter.get('/search', notImplemented('Filter by radius, urgency, category, price'));
searchRouter.get('/search/chat', notImplemented('Discovery Agent: natural-language search'));
