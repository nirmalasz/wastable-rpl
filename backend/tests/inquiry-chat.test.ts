import { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

/** Asking the seller before claiming (inquiry threads). Skipped without PostgreSQL. */
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

async function signUp(name: string) {
  const reg = await request(app)
    .post('/api/auth/register')
    .send({
      name,
      email: `${name}.${run}@test.dev`,
      password: 'password123',
      acceptedTermsVersion: 'test',
    });
  expect(reg.status).toBe(201);
  await request(app).post('/api/auth/verify-email').send({ token: reg.body.devVerificationToken });
  return { token: reg.body.token as string, id: reg.body.user.id as string };
}

async function listingBy(token: string) {
  const res = await post('/api/listings', token, {
    title: 'Kue Lapis',
    category: 'bakery',
    quantity: 4,
    listingType: 'SELL',
    price: 10000,
    expiryDate: new Date(Date.now() + 10 * 3_600_000).toISOString(),
    pickupArea: 'Depok',
  });
  return res.body.listing.id as string;
}

describe.skipIf(!dbUp)('inquiry chat', () => {
  it('lets a buyer ask the seller before claiming, and the seller answer', async () => {
    const seller = await signUp('askseller');
    const buyer = await signUp('askbuyer');
    const listingId = await listingBy(seller.token);

    const opened = await post(`/api/listings/${listingId}/inquiry`, buyer.token);
    expect(opened.status).toBe(201);
    const inquiryId = opened.body.inquiry.id as string;
    // Asking again reopens the same thread.
    const again = await post(`/api/listings/${listingId}/inquiry`, buyer.token);
    expect(again.status).toBe(200);
    expect(again.body.inquiry.id).toBe(inquiryId);

    // The seller does not see an empty thread.
    expect((await get('/api/inquiries/mine', seller.token)).body.inquiries).toHaveLength(0);

    const asked = await post(`/api/inquiries/${inquiryId}/messages`, buyer.token, {
      text: 'Masih ada?',
    });
    expect(asked.status).toBe(201);

    const sellerList = (await get('/api/inquiries/mine', seller.token)).body.inquiries;
    expect(sellerList).toHaveLength(1);
    expect(sellerList[0]).toMatchObject({
      id: inquiryId,
      listingId,
      role: 'SELLER',
      unreadCount: 1,
      counterpart: { id: buyer.id },
    });
    expect(sellerList[0].counterpart.contact).toBeUndefined();

    const note = (await get('/api/notifications', seller.token)).body.notifications.find(
      (n: { type: string }) => n.type === 'NEW_MESSAGE',
    );
    expect(note).toMatchObject({ listingId, inquiryId, transactionId: null });

    const thread = await get(`/api/inquiries/${inquiryId}/messages`, seller.token);
    expect(thread.body.messages.map((m: { body: string }) => m.body)).toEqual(['Masih ada?']);
    await post(`/api/inquiries/${inquiryId}/messages`, seller.token, { text: 'Masih!' });

    const buyerList = (await get('/api/inquiries/mine', buyer.token)).body.inquiries;
    expect(buyerList[0]).toMatchObject({ role: 'BUYER', unreadCount: 1 });
    expect(buyerList[0].lastMessage).toMatchObject({ body: 'Masih!', mine: false });
  });

  it('keeps outsiders and the owner out, and closes on removed listings', async () => {
    const seller = await signUp('askowner');
    const buyer = await signUp('askasker');
    const outsider = await signUp('askoutsider');
    const listingId = await listingBy(seller.token);

    expect((await post(`/api/listings/${listingId}/inquiry`, seller.token)).status).toBe(400);
    const inquiryId = (await post(`/api/listings/${listingId}/inquiry`, buyer.token)).body.inquiry
      .id as string;
    expect((await get(`/api/inquiries/${inquiryId}/messages`, outsider.token)).status).toBe(404);
    expect(
      (await post(`/api/inquiries/${inquiryId}/messages`, outsider.token, { text: 'hi' })).status,
    ).toBe(404);

    await request(app).delete(`/api/listings/${listingId}`).set(bearer(seller.token));
    expect(
      (await post(`/api/inquiries/${inquiryId}/messages`, buyer.token, { text: 'hi' })).status,
    ).toBe(409);
    // History stays readable.
    expect((await get(`/api/inquiries/${inquiryId}/messages`, buyer.token)).status).toBe(200);
  });
});
