import { Router } from 'express';
import { notImplemented } from '../../lib/not-implemented.js';

/** UC16-UC19 | FR-12, FR-13, FR-14, FR-16 (admin makes the final decision) */
export const moderationRouter = Router();

moderationRouter.post('/listings/:id/reports', notImplemented('Report listing (hide + enqueue)'));
moderationRouter.get('/moderation/cases', notImplemented('Admin: moderation queue'));
moderationRouter.patch('/moderation/cases/:id', notImplemented('Admin: decide case'));
moderationRouter.post('/appeals', notImplemented('Submit appeal'));
moderationRouter.patch('/appeals/:id', notImplemented('Admin: resolve appeal'));
