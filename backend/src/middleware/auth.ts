import type { RequestHandler } from 'express';
import { HttpError } from '../lib/http-error.js';

export type Role = 'USER' | 'ADMIN';

export interface AuthUser {
  id: string;
  role: Role;
  isVerified: boolean;
}

/**
 * Requires a Bearer token.
 * TODO(auth module): verify the JWT signature with env.JWT_SECRET and load the user.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(HttpError.unauthorized('Missing bearer token'));
    return;
  }
  next(HttpError.unauthorized('Token verification not implemented yet'));
};

/** Blocks unverified users from posting or claiming (FR-1). Use after requireAuth. */
export const requireVerified: RequestHandler = (_req, res, next) => {
  const user = res.locals.user as AuthUser | undefined;
  if (!user?.isVerified) {
    next(HttpError.forbidden('Please verify your email first'));
    return;
  }
  next();
};

export const requireRole =
  (role: Role): RequestHandler =>
  (_req, res, next) => {
    const user = res.locals.user as AuthUser | undefined;
    if (user?.role !== role) {
      next(HttpError.forbidden());
      return;
    }
    next();
  };
