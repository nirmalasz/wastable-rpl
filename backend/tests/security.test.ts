import { rm } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { getDb } from '../src/db/client.js';
import { transactions, users } from '../src/db/schema.js';
import { MAX_FAILED_LOGINS, MAX_OPEN_CLAIMS } from '../src/lib/constants.js';
import { uploadDir } from '../src/lib/storage.js';
import { runListingMaintenanceJob } from '../src/modules/scheduler/jobs.js';
import { dbUp } from './helpers/db.js';

/** Security behaviours against the real database. Skipped when PostgreSQL is not reachable. */

const app = createApp();
const run = Date.now();
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

async function signUp(name: string) {
  const email = `${name}.${run}@test.dev`;
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'password123' });
  expect(reg.status).toBe(201);
  const ver = await request(app)
    .post('/api/auth/verify-email')
    .send({ token: reg.body.devVerificationToken });
  expect(ver.body.user.isVerified).toBe(true);
  return { token: reg.body.token as string, id: reg.body.user.id as string, email };
}

const listingBody = (over: Record<string, unknown> = {}) => ({
  title: 'Nasi goreng',
  category: 'cooked-meal',
  quantity: 1,
  listingType: 'FREE',
  price: 0,
  expiryDate: inHours(10),
  pickupArea: 'Depok',
  ...over,
});

const post = (path: string, token: string, body?: object) =>
  request(app).post(path).set(bearer(token)).send(body);
const patch = (path: string, token: string, body: object) =>
  request(app).patch(path).set(bearer(token)).send(body);

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
  'base64',
);

describe.skipIf(!dbUp)('security', () => {
  it('rejects unsafe listing photo URLs with a friendly message', async () => {
    const u = await signUp('photoer');
    for (const photoUrl of [
      'http://169.254.169.254/x.png',
      'http://localhost:4000/uploads/../../etc/passwd',
    ]) {
      const res = await post('/api/listings', u.token, listingBody({ photoUrl }));
      expect(res.status).toBe(400);
      expect(typeof res.body.fields.photoUrl).toBe('string');
      expect(JSON.stringify(res.body)).not.toMatch(/invalid_|ZodError|"code"/);
    }
  });

  it('rejects an external avatarUrl', async () => {
    const u = await signUp('avatarer');
    const res = await patch('/api/users/me', u.token, { avatarUrl: 'https://evil.example/a.png' });
    expect(res.status).toBe(400);
  });

  it('accepts a real PNG upload, serves it with nosniff, and rejects fake images', async () => {
    const u = await signUp('uploader');
    const res = await request(app)
      .post('/api/uploads')
      .set(bearer(u.token))
      .set('Content-Type', 'image/png')
      .send(PNG);
    expect(res.status).toBe(201);
    const url = new URL(res.body.url as string);
    expect(url.pathname.startsWith('/uploads/')).toBe(true);
    try {
      const got = await request(app).get(url.pathname);
      expect(got.status).toBe(200);
      expect(got.headers['x-content-type-options']).toBe('nosniff');
    } finally {
      await rm(path.join(uploadDir, path.basename(url.pathname)), { force: true });
    }

    const fake = await request(app)
      .post('/api/uploads')
      .set(bearer(u.token))
      .set('Content-Type', 'image/png')
      .send(Buffer.from('this is definitely not an image, just plain text'));
    expect(fake.status).toBe(415);
  });

  it('revokes the old access token after a password reset', async () => {
    const u = await signUp('revoker');
    const req1 = await request(app)
      .post('/api/auth/password-reset/request')
      .send({ email: u.email });
    const ok = await request(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token: req1.body.devResetToken, password: 'newpassword1' });
    expect(ok.status).toBe(200);
    expect((await request(app).get('/api/users/me').set(bearer(u.token))).status).toBe(401);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: u.email, password: 'newpassword1' });
    expect(login.status).toBe(200);
    const me = await request(app).get('/api/users/me').set(bearer(login.body.token));
    expect(me.status).toBe(200);
  });

  it('does not let a user report the same listing twice', async () => {
    const seller = await signUp('rseller');
    const reporter = await signUp('rreporter');
    const created = await post('/api/listings', seller.token, listingBody());
    expect(created.status).toBe(201);
    const id = created.body.listing.id as string;
    expect(
      (await post(`/api/listings/${id}/reports`, reporter.token, { reason: 'Spoiled' })).status,
    ).toBe(201);
    expect(
      (await post(`/api/listings/${id}/reports`, reporter.token, { reason: 'Spoiled' })).status,
    ).toBe(409);
  });

  it('shares counterpart contact in /transactions/mine without leaking email or hash', async () => {
    const seller = await signUp('cseller');
    const buyer = await signUp('cbuyer');
    expect(
      (await patch('/api/users/me', seller.token, { contactPreference: 'WA 0812' })).status,
    ).toBe(200);
    const created = await post('/api/listings', seller.token, listingBody());
    const claim = await post(`/api/listings/${created.body.listing.id}/claim`, buyer.token);
    expect(claim.status).toBe(201);
    const mine = await request(app).get('/api/transactions/mine').set(bearer(buyer.token));
    expect(mine.status).toBe(200);
    const trx = mine.body.transactions.find(
      (t: { id: string }) => t.id === claim.body.transaction.id,
    );
    expect(trx.counterpart.contact).toBe('WA 0812');
    const raw = JSON.stringify(mine.body).toLowerCase();
    expect(raw).not.toContain(seller.email.toLowerCase());
    expect(raw).not.toMatch(/password|\$2[aby]\$|argon2/);
  });

  it(`caps open claims per user at ${MAX_OPEN_CLAIMS}`, async () => {
    const seller = await signUp('capseller');
    const buyer = await signUp('capbuyer');
    for (let i = 0; i <= MAX_OPEN_CLAIMS; i++) {
      const created = await post('/api/listings', seller.token, listingBody({ title: `Cap ${i}` }));
      const claim = await post(`/api/listings/${created.body.listing.id}/claim`, buyer.token);
      expect(claim.status).toBe(i < MAX_OPEN_CLAIMS ? 201 : 429);
    }
  });

  it('throttles repeated failed logins for one account and a reset lifts it', async () => {
    const u = await signUp('bruteforced');
    const attempt = (password: string) =>
      request(app).post('/api/auth/login').send({ email: u.email, password });
    for (let i = 0; i < MAX_FAILED_LOGINS; i++)
      expect((await attempt('wrongpass')).status).toBe(401);
    // Even the right password is refused while the account is throttled.
    expect((await attempt('password123')).status).toBe(429);

    const reset = await request(app)
      .post('/api/auth/password-reset/request')
      .send({ email: u.email });
    await request(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token: reset.body.devResetToken, password: 'newpassword1' });
    expect((await attempt('newpassword1')).status).toBe(200);
  });

  it('does not let a suspended user post a review', async () => {
    const seller = await signUp('rvseller');
    const buyer = await signUp('rvbuyer');
    const created = await post('/api/listings', seller.token, listingBody());
    const claim = await post(`/api/listings/${created.body.listing.id}/claim`, buyer.token);
    const trxId = claim.body.transaction.id as string;
    expect(
      (await patch(`/api/transactions/${trxId}`, buyer.token, { status: 'COMPLETED' })).status,
    ).toBe(200);
    await getDb().update(users).set({ status: 'SUSPENDED' }).where(eq(users.id, buyer.id));
    const review = await post(`/api/transactions/${trxId}/reviews`, buyer.token, { rating: 5 });
    expect(review.status).toBe(403);
  });

  it('only accepts review photos from our own uploads', async () => {
    const seller = await signUp('rpseller');
    const buyer = await signUp('rpbuyer');
    const created = await post('/api/listings', seller.token, listingBody());
    const claim = await post(`/api/listings/${created.body.listing.id}/claim`, buyer.token);
    const trxId = claim.body.transaction.id as string;
    await patch(`/api/transactions/${trxId}`, buyer.token, { status: 'COMPLETED' });
    const review = await post(`/api/transactions/${trxId}/reviews`, buyer.token, {
      rating: 5,
      photoUrl: 'https://evil.example/tracker.png',
    });
    expect(review.status).toBe(400);
  });

  it('scheduler cancels claims that were never picked up', async () => {
    const seller = await signUp('toseller');
    const buyer = await signUp('tobuyer');
    const created = await post('/api/listings', seller.token, listingBody({ title: 'Timeout' }));
    const listingId = created.body.listing.id as string;
    const claim = await post(`/api/listings/${listingId}/claim`, buyer.token);
    // Backdate only this claim, so the job does not touch other data in the dev database.
    await getDb()
      .update(transactions)
      .set({ createdAt: new Date(Date.now() - 25 * 3_600_000) })
      .where(eq(transactions.id, claim.body.transaction.id));

    const summary = await runListingMaintenanceJob();
    expect(summary.skipped).toBe(false);
    expect(summary.claimsTimedOut).toBeGreaterThanOrEqual(1);
    const detail = await request(app).get(`/api/listings/${listingId}`);
    expect(detail.body.listing.status).toBe('AVAILABLE');
  });
});
