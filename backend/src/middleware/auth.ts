import type { RequestHandler, Response } from 'express';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { users } from '../db/schema.js';
import { sha256, verifyToken } from '../lib/crypto.js';
import { HttpError } from '../lib/http-error.js';

export type Role = 'USER' | 'ADMIN';

export interface AuthUser {
  id: string;
  role: Role;
  status: 'UNVERIFIED' | 'ACTIVE' | 'SUSPENDED';
  isVerified: boolean;
}

/** The authenticated user set by requireAuth / optionalAuth. */
export const currentUser = (res: Response): AuthUser => {
  const user = res.locals.user as AuthUser | undefined;
  if (!user) throw HttpError.unauthorized();
  return user;
};

async function loadUser(header: string | undefined): Promise<AuthUser | null> {
  if (!header?.startsWith('Bearer ')) return null;
  const payload = verifyToken(header.slice(7), 'access');
  if (!payload) throw HttpError.unauthorized('Invalid or expired token');
  const [row] = await getDb().select().from(users).where(eq(users.id, payload.sub)).limit(1);
  if (!row) throw HttpError.unauthorized('Account no longer exists');
  if (payload.fp !== sha256(row.passwordHash).slice(0, 16)) {
    throw HttpError.unauthorized('Your session has expired. Please log in again.');
  }
  return { id: row.id, role: row.role, status: row.status, isVerified: row.status === 'ACTIVE' };
}

/** Requires a valid Bearer token and loads the user (so suspensions apply immediately). */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const user = await loadUser(req.headers.authorization);
  if (!user) throw HttpError.unauthorized('Missing bearer token');
  res.locals.user = user;
  next();
};

/** Attaches the user when a valid token is sent, but lets anonymous requests through. */
export const optionalAuth: RequestHandler = async (req, res, next) => {
  const user = await loadUser(req.headers.authorization);
  if (user) res.locals.user = user;
  next();
};

/** Blocks unverified or suspended users from posting or claiming (FR-1). Use after requireAuth. */
export const requireVerified: RequestHandler = (_req, res, next) => {
  const user = res.locals.user as AuthUser | undefined;
  if (user?.status === 'SUSPENDED') {
    next(HttpError.forbidden('Your account is suspended. You can submit an appeal.'));
    return;
  }
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
