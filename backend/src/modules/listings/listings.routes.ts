import { Router } from 'express';
import { notImplemented } from '../../lib/not-implemented.js';

/** UC5-UC8, UC20 | FR-3, FR-4, FR-5, FR-15 */
export const listingsRouter = Router();

listingsRouter.post('/listings/extract', notImplemented('Listing Agent: draft from text/photo'));
listingsRouter.post('/listings', notImplemented('Create listing (validate expiry, moderate)'));
listingsRouter.get('/listings/mine', notImplemented('Seller dashboard with statuses'));
listingsRouter.get('/listings/:id', notImplemented('Listing detail'));
listingsRouter.patch('/listings/:id', notImplemented('Edit listing'));
listingsRouter.delete('/listings/:id', notImplemented('Delete listing'));
listingsRouter.post(
  '/listings/:id/compost-referral',
  notImplemented('Refer waste to compost partner'),
);
