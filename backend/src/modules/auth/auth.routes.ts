import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { getDb } from '../../db/client.js';
import { users } from '../../db/schema.js';
import { hashPassword, sha256, signToken, verifyPassword, verifyToken } from '../../lib/crypto.js';
import { MAX_FAILED_LOGINS } from '../../lib/constants.js';
import { HttpError } from '../../lib/http-error.js';
import { kvDel, kvGet, kvIncr } from '../../lib/kv.js';
import { sendMail } from '../../lib/mailer.js';
import { uploadUrlSchema } from '../../lib/storage.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';

/** UC1-UC4 | FR-1, FR-2 */
export const authRouter = Router();

const ACCESS_TTL_SECONDS = 7 * 24 * 3600;
const VERIFY_TTL_SECONDS = 24 * 3600;
const LOGIN_FAIL_WINDOW_SECONDS = 15 * 60;
const exposeTokens = env.NODE_ENV !== 'production';

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
});

type UserRow = typeof users.$inferSelect;

export function toPublicUser(u: UserRow) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    isVerified: u.status === 'ACTIVE',
    violationCount: u.violationCount,
    locationRadiusKm: u.locationRadiusKm,
    contactPreference: u.contactPreference,
    avatarUrl: u.avatarUrl,
    homeLat: u.homeLat === null ? null : Number(u.homeLat),
    homeLng: u.homeLng === null ? null : Number(u.homeLng),
    createdAt: u.createdAt,
  };
}

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const password = z.string().min(8, 'Password must be at least 8 characters').max(128);

/** The fingerprint ties a token to the current password, so a reset signs out old sessions. */
const accessToken = (u: Pick<UserRow, 'id' | 'passwordHash'>) =>
  signToken(
    { sub: u.id, purpose: 'access', fp: sha256(u.passwordHash).slice(0, 16) },
    ACCESS_TTL_SECONDS,
  );

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = await hashPassword('timing-equaliser');

const resetFingerprint = (passwordHash: string) => sha256(passwordHash).slice(0, 16);

authRouter.post('/auth/register', authLimiter, async (req, res) => {
  const body = z
    .object({ name: z.string().trim().min(1).max(80), email, password })
    .parse(req.body);
  const db = getDb();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email));
  if (existing) throw HttpError.conflict('An account with this email already exists');

  const [created] = await db
    .insert(users)
    .values({ name: body.name, email: body.email, passwordHash: await hashPassword(body.password) })
    .returning();
  if (!created) throw new Error('user insert failed');

  const verifyTokenValue = signToken({ sub: created.id, purpose: 'verify' }, VERIFY_TTL_SECONDS);
  await sendMail(
    created.email,
    'Verify your WASTABLE email',
    `Open this link to verify: ${env.CORS_ORIGIN.split(',')[0]}/verify?token=${verifyTokenValue}`,
  );
  res.status(201).json({
    token: accessToken(created),
    user: toPublicUser(created),
    ...(exposeTokens ? { devVerificationToken: verifyTokenValue } : {}),
  });
});

authRouter.post('/auth/verify-email', async (req, res) => {
  const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
  const payload = verifyToken(token, 'verify');
  if (!payload) throw HttpError.badRequest('Verification link is invalid or has expired');
  const [row] = await getDb().select().from(users).where(eq(users.id, payload.sub));
  if (!row) throw HttpError.badRequest('Verification link is invalid or has expired');
  if (row.status === 'UNVERIFIED') {
    const [updated] = await getDb()
      .update(users)
      .set({ status: 'ACTIVE', updatedAt: new Date() })
      .where(eq(users.id, row.id))
      .returning();
    res.json({ user: toPublicUser(updated ?? row) });
    return;
  }
  res.json({ user: toPublicUser(row) });
});

authRouter.post('/auth/resend-verification', requireAuth, async (_req, res) => {
  const me = currentUser(res);
  const [row] = await getDb().select().from(users).where(eq(users.id, me.id));
  if (!row || row.status !== 'UNVERIFIED') throw HttpError.badRequest('Email is already verified');
  const token = signToken({ sub: row.id, purpose: 'verify' }, VERIFY_TTL_SECONDS);
  await sendMail(row.email, 'Verify your WASTABLE email', `Verification token: ${token}`);
  res.json({ ok: true, ...(exposeTokens ? { devVerificationToken: token } : {}) });
});

authRouter.post('/auth/login', authLimiter, async (req, res) => {
  const body = z.object({ email, password: z.string().min(1) }).parse(req.body);
  // Per-account throttle on top of the per-IP limiter, so a botnet cannot guess one password.
  const failKey = `login:fail:${sha256(body.email)}`;
  if (Number((await kvGet(failKey)) ?? 0) >= MAX_FAILED_LOGINS) {
    throw HttpError.tooMany(
      'Too many failed attempts. Please wait 15 minutes or reset your password.',
    );
  }
  const [row] = await getDb().select().from(users).where(eq(users.email, body.email));
  const ok = await verifyPassword(body.password, row?.passwordHash ?? DUMMY_HASH);
  if (!row || !ok) {
    await kvIncr(failKey, LOGIN_FAIL_WINDOW_SECONDS);
    throw HttpError.unauthorized('Incorrect email or password');
  }
  await kvDel(failKey);
  res.json({ token: accessToken(row), user: toPublicUser(row) });
});

authRouter.post('/auth/password-reset/request', authLimiter, async (req, res) => {
  const body = z.object({ email }).parse(req.body);
  const [row] = await getDb().select().from(users).where(eq(users.email, body.email));
  let devToken: string | undefined;
  if (row) {
    devToken = signToken(
      { sub: row.id, purpose: 'reset', fp: resetFingerprint(row.passwordHash) },
      env.PASSWORD_RESET_TTL_MINUTES * 60,
    );
    await sendMail(
      row.email,
      'Reset your WASTABLE password',
      `This link is valid for ${env.PASSWORD_RESET_TTL_MINUTES} minutes: ${env.CORS_ORIGIN.split(',')[0]}/reset?token=${devToken}`,
    );
  }
  // Same response whether or not the account exists, so emails cannot be enumerated.
  res.json({ ok: true, ...(exposeTokens && devToken ? { devResetToken: devToken } : {}) });
});

authRouter.post('/auth/password-reset/confirm', authLimiter, async (req, res) => {
  const body = z.object({ token: z.string().min(1), password }).parse(req.body);
  const payload = verifyToken(body.token, 'reset');
  if (!payload) throw HttpError.badRequest('Reset link is invalid or has expired');
  const [row] = await getDb().select().from(users).where(eq(users.id, payload.sub));
  // The fingerprint changes once the password changes, which makes each link single-use.
  if (!row || payload.fp !== resetFingerprint(row.passwordHash)) {
    throw HttpError.badRequest('Reset link is invalid or has expired');
  }
  await getDb()
    .update(users)
    .set({ passwordHash: await hashPassword(body.password), updatedAt: new Date() })
    .where(eq(users.id, row.id));
  await kvDel(`login:fail:${sha256(row.email)}`); // a reset lifts the login throttle
  res.json({ ok: true });
});

authRouter.get('/users/me', requireAuth, async (_req, res) => {
  const [row] = await getDb()
    .select()
    .from(users)
    .where(eq(users.id, currentUser(res).id));
  if (!row) throw HttpError.notFound('User not found');
  res.json({ user: toPublicUser(row) });
});

const profileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  locationRadiusKm: z.number().int().min(1).max(50).optional(),
  contactPreference: z.string().trim().max(200).nullable().optional(),
  avatarUrl: uploadUrlSchema.nullable().optional(),
  homeLat: z.number().min(-90).max(90).nullable().optional(),
  homeLng: z.number().min(-180).max(180).nullable().optional(),
});

authRouter.patch('/users/me', requireAuth, async (req, res) => {
  const body = profileSchema.parse(req.body);
  const { homeLat, homeLng, ...rest } = body;
  const [row] = await getDb()
    .update(users)
    .set({
      ...rest,
      ...(homeLat !== undefined ? { homeLat: homeLat === null ? null : String(homeLat) } : {}),
      ...(homeLng !== undefined ? { homeLng: homeLng === null ? null : String(homeLng) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, currentUser(res).id))
    .returning();
  if (!row) throw HttpError.notFound('User not found');
  res.json({ user: toPublicUser(row) });
});
