import { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

/**
 * Seller-confirmed handover, Terms & SOP consent on sign-up, and notifications that carry the
 * listing / trade they are about. Skipped without PostgreSQL (except the validation check).
 */
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
const get = (path: string, token: string) => request(app).get(path).set(bearer(token));
const post = (path: string, token: string, body?: object) =>
  request(app).post(path).set(bearer(token)).send(body);
const patch = (path: string, token: string, body: object) =>
  request(app).patch(path).set(bearer(token)).send(body);

async function signUp(name: string) {
  const reg = await request(app)
    .post('/api/auth/register')
    .send({
      name,
      email: `${name}.${run}@test.dev`,
      password: 'password123',
      acceptedTermsVersion: '2026-11-27',
    });
  expect(reg.status).toBe(201);
  await request(app).post('/api/auth/verify-email').send({ token: reg.body.devVerificationToken });
  return { token: reg.body.token as string, id: reg.body.user.id as string };
}

async function trade(tag: string) {
  const seller = await signUp(`${tag}seller`);
  const buyer = await signUp(`${tag}buyer`);
  const listing = await post('/api/listings', seller.token, {
    title: 'Roti Tawar',
    category: 'bakery',
    quantity: 2,
    listingType: 'FREE',
    expiryDate: new Date(Date.now() + 10 * 3_600_000).toISOString(),
    pickupArea: 'Depok',
  });
  const listingId = listing.body.listing.id as string;
  const claim = await post(`/api/listings/${listingId}/claim`, buyer.token);
  expect(claim.status).toBe(201);
  return { seller, buyer, listingId, trxId: claim.body.transaction.id as string };
}

describe('terms consent (no database needed)', () => {
  it('rejects sign-up without agreeing to the Terms & SOP', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'No Terms', email: `noterms.${run}@test.dev`, password: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.fields.acceptedTermsVersion).toBe('Please read and agree to the Terms & SOP.');
  });
});

describe.skipIf(!dbUp)('handover, terms and notification links', () => {
  it('stores the accepted terms version on the account', async () => {
    const u = await signUp('terms');
    const me = await get('/api/users/me', u.token);
    expect(me.body.user.termsVersion).toBe('2026-11-27');
  });

  it('lets the seller confirm the handover and tells the buyer', async () => {
    const { seller, buyer, listingId, trxId } = await trade('handover');
    const done = await patch(`/api/transactions/${trxId}`, seller.token, { status: 'COMPLETED' });
    expect(done.status).toBe(200);
    expect(done.body.listingStatus).toBe('COMPLETED');

    const notes = (await get('/api/notifications', buyer.token)).body.notifications;
    expect(notes.find((n: { type: string }) => n.type === 'PICKUP_COMPLETED')).toMatchObject({
      listingId,
      transactionId: trxId,
    });
    // Completed once, from either side, is final.
    expect(
      (await patch(`/api/transactions/${trxId}`, buyer.token, { status: 'COMPLETED' })).status,
    ).toBe(409);
    // Both sides can now review each other.
    expect(
      (await post(`/api/transactions/${trxId}/reviews`, seller.token, { rating: 5 })).status,
    ).toBe(201);
    expect(
      (await post(`/api/transactions/${trxId}/reviews`, buyer.token, { rating: 4 })).status,
    ).toBe(201);
  });

  it('links chat and review notifications to their trade', async () => {
    const { seller, buyer, listingId, trxId } = await trade('links');
    await post(`/api/transactions/${trxId}/messages`, buyer.token, { text: 'Halo' });
    const msg = (await get('/api/notifications', seller.token)).body.notifications.find(
      (n: { type: string }) => n.type === 'NEW_MESSAGE',
    );
    expect(msg).toMatchObject({ listingId, transactionId: trxId });

    await patch(`/api/transactions/${trxId}`, buyer.token, { status: 'COMPLETED' });
    await post(`/api/transactions/${trxId}/reviews`, buyer.token, { rating: 5 });
    const review = (await get('/api/notifications', seller.token)).body.notifications.find(
      (n: { type: string }) => n.type === 'NEW_REVIEW',
    );
    expect(review).toMatchObject({ listingId, transactionId: trxId });
  });
});
