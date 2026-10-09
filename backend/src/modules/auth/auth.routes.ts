import { Router } from 'express';
import { notImplemented } from '../../lib/not-implemented.js';

/** UC1-UC4 | FR-1, FR-2 */
export const authRouter = Router();

authRouter.post('/auth/register', notImplemented('Register with email + password'));
authRouter.post('/auth/verify-email', notImplemented('Verify email link'));
authRouter.post('/auth/login', notImplemented('Login (OAuth 2.0 bearer token)'));
authRouter.post('/auth/password-reset/request', notImplemented('Request 10-minute reset link'));
authRouter.post('/auth/password-reset/confirm', notImplemented('Set new password'));
authRouter.get('/users/me', notImplemented('Get own profile'));
authRouter.patch('/users/me', notImplemented('Update profile and location radius'));
