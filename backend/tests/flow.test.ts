import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { getDb } from '../src/db/client.js';
import { users } from '../src/db/schema.js';
import { runListingMaintenanceJob } from '../src/modules/scheduler/jobs.js';

/** End-to-end marketplace flow against the real database. Skipped when PostgreSQL is not reachable. */
const probe = new Pool({
  connectionString: 'postgres://wastable:wastable@localhost:5432/wastable',
  connectionTimeoutMillis: 1500,
});
const dbUp = await probe
  .query('select 1 from users limit 1')
  .then(() => true)
  .catch(() => false);
await probe.end();

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
  title: 'Nasi Kotak Ayam',
  category: 'cooked-meal',
  quantity: 5,
  listingType: 'SELL',
  price: 8000,
  expiryDate: inHours(10),
  pickupArea: 'Depok',
  ...over,
});

const post = (path: string, token: string, body?: object) =>
  request(app).post(path).set(bearer(token)).send(body);
const patch = (path: string, token: string, body: object) =>
  request(app).patch(path).set(bearer(token)).send(body);

describe.skipIf(!dbUp)('marketplace flow', () => {
  it('runs register -> list -> claim -> complete -> review', async () => {
    const seller = await signUp('seller');
    const buyer = await signUp('buyer');
    const waiter = await signUp('waiter');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: seller.email, password: 'password123' });
    expect(login.status).toBe(200);
    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: seller.email, password: 'bad' });
    expect(bad.status).toBe(401);

    const past = await post(
      '/api/listings',
      seller.token,
      listingBody({ expiryDate: inHours(-1) }),
    );
    expect(past.status).toBe(422);
    const alcohol = await post(
      '/api/listings',
      seller.token,
      listingBody({ title: 'Bir dingin 2 botol' }),
    );
    expect(alcohol.status).toBe(403);
    const created = await post(
      '/api/listings',
      seller.token,
      // A word unique to this run, so leftovers from earlier runs cannot push it off the page.
      listingBody({ title: `Nasi goreng babi tok${run}` }),
    );
    expect(created.status).toBe(201);
    expect(created.body.listing.dietFlags).toContain('pork');
    const id = created.body.listing.id as string;

    const found = await request(app)
      .get('/api/search')
      .query({ q: `tok${run}` });
    expect(found.body.results.some((l: { id: string }) => l.id === id)).toBe(true);
    expect(found.body.results[0]).not.toHaveProperty('pickupLat');

    expect((await post(`/api/listings/${id}/claim`, seller.token)).status).toBe(400);
    const claim = await post(`/api/listings/${id}/claim`, buyer.token);
    expect(claim.status).toBe(201);
    const second = await post(`/api/listings/${id}/claim`, waiter.token);
    expect(second.status).toBe(409);
    expect(second.body.details.canJoinWaitlist).toBe(true);
    const wl = await post(`/api/listings/${id}/waitlist`, waiter.token);
    expect(wl.body.entry.position).toBe(1);

    const notes = await request(app).get('/api/notifications').set(bearer(seller.token));
    expect(notes.body.notifications.some((n: { type: string }) => n.type === 'CLAIM_REQUEST')).toBe(
      true,
    );

    const trxId = claim.body.transaction.id as string;
    expect(
      (await patch(`/api/transactions/${trxId}`, seller.token, { status: 'COMPLETED' })).status,
    ).toBe(403);
    const done = await patch(`/api/transactions/${trxId}`, buyer.token, { status: 'COMPLETED' });
    expect(done.body.listingStatus).toBe('COMPLETED');
    const review = await post(`/api/transactions/${trxId}/reviews`, buyer.token, {
      rating: 5,
      comment: 'Fresh',
    });
    expect(review.status).toBe(201);
    expect(
      (await post(`/api/transactions/${trxId}/reviews`, buyer.token, { rating: 4 })).status,
    ).toBe(409);
    const reviews = await request(app).get(`/api/users/${seller.id}/reviews`);
    expect(reviews.body.average).toBe(5);
    expect(reviews.body.reviews[0].reviewerRole).toBe('BUYER');
    expect(reviews.body.reviews[0].listingId).toBe(id);
    expect(reviews.body.reviews[0].photoUrl).toBeNull();

    // The seller rates the buyer back; the label flips.
    const sellerView = await request(app).get('/api/transactions/mine').set(bearer(seller.token));
    const sold = sellerView.body.transactions.find((t: { id: string }) => t.id === trxId);
    expect(sold.counterpart.id).toBe(buyer.id);
    expect(sold.reviewedByMe).toBe(false);
    expect(
      (await post(`/api/transactions/${trxId}/reviews`, seller.token, { rating: 4 })).status,
    ).toBe(201);
    const buyerReviews = await request(app).get(`/api/users/${buyer.id}/reviews`);
    expect(buyerReviews.body.reviews[0].reviewerRole).toBe('SELLER');

    // A completed listing no longer shows on the seller's public profile.
    const profile = await request(app).get(`/api/users/${seller.id}/listings`);
    expect(profile.status).toBe(200);
    expect(profile.body.user.id).toBe(seller.id);
    expect(profile.body.listings.some((l: { id: string }) => l.id === id)).toBe(false);
  });

  it('saves a Rp 0 sale as FREE and shows the exact pin only to the seller', async () => {
    const seller = await signUp('freeseller');
    const viewer = await signUp('freeviewer');
    const created = await post(
      '/api/listings',
      seller.token,
      listingBody({ price: 0, pickupLat: -6.3646, pickupLng: 106.8287 }),
    );
    expect(created.status).toBe(201);
    expect(created.body.listing).toMatchObject({ listingType: 'FREE', price: 0 });
    const id = created.body.listing.id as string;

    const mine = await request(app).get(`/api/listings/${id}`).set(bearer(seller.token));
    expect(mine.body.pickupLocation).toEqual({ lat: -6.3646, lng: 106.8287, address: null });
    const theirs = await request(app).get(`/api/listings/${id}`).set(bearer(viewer.token));
    expect(theirs.body.pickupLocation).toBeNull();
    expect(JSON.stringify(theirs.body)).not.toContain('106.8287');

    // Editing a sale down to Rp 0 turns it into a giveaway too.
    const sale = await post('/api/listings', seller.token, listingBody({ title: 'Roti' }));
    const edited = await patch(`/api/listings/${sale.body.listing.id}`, seller.token, { price: 0 });
    expect(edited.body.listing).toMatchObject({ listingType: 'FREE', price: 0 });
  });

  it('cancelling a claim re-offers the listing to the waitlist', async () => {
    const seller = await signUp('seller2');
    const buyer = await signUp('buyer2');
    const waiter = await signUp('waiter2');
    const { body } = await post(
      '/api/listings',
      seller.token,
      listingBody({ title: 'Roti', listingType: 'FREE', price: 0 }),
    );
    const id = body.listing.id as string;
    const claim = await post(`/api/listings/${id}/claim`, buyer.token);
    await post(`/api/listings/${id}/waitlist`, waiter.token);
    const cancelled = await patch(`/api/transactions/${claim.body.transaction.id}`, buyer.token, {
      status: 'CANCELLED',
    });
    expect(cancelled.body.listingStatus).toBe('AVAILABLE');
    const notes = await request(app).get('/api/notifications').set(bearer(waiter.token));
    expect(
      notes.body.notifications.some((n: { type: string }) => n.type === 'ITEM_AVAILABLE'),
    ).toBe(true);
  });

  it('handles reports, 3 violations, suspension and appeal', async () => {
    const admin = await signUp('admin');
    await getDb().update(users).set({ role: 'ADMIN' }).where(eq(users.id, admin.id));
    const reporter = await signUp('reporter');
    const seller = await signUp('badseller');

    for (let i = 0; i < 3; i++) {
      const created = await post(
        '/api/listings',
        seller.token,
        listingBody({ title: `Makanan ${i}` }),
      );
      const id = created.body.listing.id as string;
      const rep = await post(`/api/listings/${id}/reports`, reporter.token, {
        reason: 'Looks spoiled',
      });
      expect(rep.status).toBe(201);
      expect((await request(app).get(`/api/listings/${id}`)).status).toBe(404);
      const forbidden = await request(app).get('/api/moderation/cases').set(bearer(reporter.token));
      expect(forbidden.status).toBe(403);
      const decide = await patch(`/api/moderation/cases/${rep.body.caseId}`, admin.token, {
        decision: 'CONFIRM_VIOLATION',
      });
      expect(decide.body.suspended).toBe(i === 2);
    }

    expect((await post('/api/listings', seller.token, listingBody())).status).toBe(403);
    const appeal = await post('/api/appeals', seller.token, { reason: 'It was a mistake, sorry.' });
    expect(appeal.status).toBe(201);
    const resolved = await patch(`/api/appeals/${appeal.body.appeal.id}`, admin.token, {
      decision: 'APPROVE',
    });
    expect(resolved.body.appeal.status).toBe('APPROVED');
    const me = await request(app).get('/api/users/me').set(bearer(seller.token));
    expect(me.body.user).toMatchObject({ status: 'ACTIVE', violationCount: 0 });
  });

  it('password reset links are single-use', async () => {
    const u = await signUp('resetter');
    const req1 = await request(app)
      .post('/api/auth/password-reset/request')
      .send({ email: u.email });
    const token = req1.body.devResetToken as string;
    const ok = await request(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token, password: 'newpassword1' });
    expect(ok.status).toBe(200);
    const reuse = await request(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token, password: 'another-one1' });
    expect(reuse.status).toBe(400);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: u.email, password: 'newpassword1' });
    expect(login.status).toBe(200);
  });

  it('scheduler expires listings and flags urgent ones', async () => {
    const seller = await signUp('cronseller');
    const a = await post(
      '/api/listings',
      seller.token,
      listingBody({ title: 'Soon', expiryDate: inHours(1) }),
    );
    expect(a.body.listing.isUrgent).toBe(true);
    const b = await post(
      '/api/listings',
      seller.token,
      listingBody({ title: 'Later', expiryDate: inHours(8) }),
    );
    expect(b.body.listing.isUrgent).toBe(false);
    const summary = await runListingMaintenanceJob(new Date(Date.now() + 2 * 3_600_000));
    expect(summary.expired).toBeGreaterThanOrEqual(1);
    const mine = await request(app).get('/api/listings/mine').set(bearer(seller.token));
    const status = (title: string) =>
      mine.body.listings.find((l: { title: string }) => l.title === title)?.status;
    expect(status('Soon')).toBe('EXPIRED');
    expect(status('Later')).toBe('AVAILABLE');
  });
});
