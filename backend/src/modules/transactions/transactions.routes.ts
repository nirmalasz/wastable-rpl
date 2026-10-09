import { Router } from 'express';
import { notImplemented } from '../../lib/not-implemented.js';

/** UC11-UC13 | FR-8, FR-9. Claiming must lock the listing row (SELECT ... FOR UPDATE). */
export const transactionsRouter = Router();

transactionsRouter.post('/listings/:id/claim', notImplemented('Claim / buy / exchange item'));
transactionsRouter.post('/listings/:id/waitlist', notImplemented('Join waitlist'));
transactionsRouter.get('/transactions/mine', notImplemented('My transactions'));
transactionsRouter.patch('/transactions/:id', notImplemented('Confirm pickup or cancel'));
