import { Router } from 'express';
import { notImplemented } from '../../lib/not-implemented.js';

/** UC15 | FR-11 */
export const notificationsRouter = Router();

notificationsRouter.get('/notifications', notImplemented('List my notifications'));
notificationsRouter.patch('/notifications/:id/read', notImplemented('Mark as read'));
