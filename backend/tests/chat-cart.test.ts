import { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { runListingMaintenanceJob } from '../src/modules/scheduler/jobs.js';

/** Chat, cart and the endpoints the flow tests do not reach. Skipped without PostgreSQL. */
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
const get = (path: string, token: string) => request(app).get(path).set(bearer(token));
const post = (path: string, token: string, body?: object) =>
  request(app).post(path).set(bearer(token)).send(body);
const patch = (path: string, token: string, body: object) =>
  request(app).patch(path).set(bearer(token)).send(body);

async function signUp(name: string) {
  const email = `${name}.${run}@test.dev`;
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'password123' });
  await request(app).post('/api/auth/verify-email').send({ token: reg.body.devVerificationToken });
  return { token: reg.body.token as string, id: reg.body.user.id as string };
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

/** A seller, a buyer, and a claimed listing between them. */
async function trade(tag: string) {
  const seller = await signUp(`${tag}seller`);
  const buyer = await signUp(`${tag}buyer`);
  const listing = await post('/api/listings', seller.token, listingBody());
  const claim = await post(`/api/listings/${listing.body.listing.id}/claim`, buyer.token);
  expect(claim.status).toBe(201);
  return {
    seller,
    buyer,
    listingId: listing.body.listing.id as string,
    trxId: claim.body.transaction.id as string,
  };
}

const thread = (trxId: string) => `/api/transactions/${trxId}/messages`;
const mineFor = async (token: string, trxId: string) =>
  (await get('/api/transactions/mine', token)).body.transactions.find(
    (t: { id: string }) => t.id === trxId,
  );

describe.skipIf(!dbUp)('chat', () => {
  it('lets buyer and seller message each other with unread counts', async () => {
    const { seller, buyer, trxId } = await trade('chat');

    const sent = await post(thread(trxId), buyer.token, { text: '  Masih ada?  ' });
    expect(sent.status).toBe(201);
    expect(sent.body.message).toMatchObject({ body: 'Masih ada?', mine: true, readAt: null });
    await post(thread(trxId), buyer.token, { text: 'Saya bisa ambil jam 7' });

    const unread = await mineFor(seller.token, trxId);
    expect(unread.unreadCount).toBe(2);
    expect(unread.lastMessage).toMatchObject({ body: 'Saya bisa ambil jam 7', mine: false });

    // Reading the thread marks the buyer's messages as read.
    const read = await get(thread(trxId), seller.token);
    expect(read.body.messages.map((m: { body: string }) => m.body)).toEqual([
      'Masih ada?',
      'Saya bisa ambil jam 7',
    ]);
    expect(read.body.messages.every((m: { mine: boolean }) => !m.mine)).toBe(true);
    expect((await mineFor(seller.token, trxId)).unreadCount).toBe(0);
    expect((await mineFor(buyer.token, trxId)).lastMessage.mine).toBe(true);

    // Polling with ?after= only returns newer messages.
    const cursor = read.body.messages[1].createdAt as string;
    await post(thread(trxId), seller.token, { text: 'Ada, silakan' });
    const newer = await get(`${thread(trxId)}?after=${encodeURIComponent(cursor)}`, buyer.token);
    expect(newer.body.messages.map((m: { body: string }) => m.body)).toEqual(['Ada, silakan']);
  });

  it('notifies once per unread burst, not on every message', async () => {
    const { seller, buyer, trxId } = await trade('burst');
    for (const text of ['a', 'b', 'c']) await post(thread(trxId), buyer.token, { text });
    const notes = await get('/api/notifications', seller.token);
    const chat = notes.body.notifications.filter((n: { type: string }) => n.type === 'NEW_MESSAGE');
    expect(chat).toHaveLength(1);
  });

  it('hides threads from outsiders and closes chat on cancelled trades', async () => {
    const { buyer, trxId } = await trade('priv');
    const outsider = await signUp('privoutsider');
    expect((await get(thread(trxId), outsider.token)).status).toBe(404);
    expect((await post(thread(trxId), outsider.token, { text: 'hi' })).status).toBe(404);
    expect((await post(thread(trxId), buyer.token, { text: '   ' })).status).toBe(400);

    await patch(`/api/transactions/${trxId}`, buyer.token, { status: 'CANCELLED' });
    expect((await post(thread(trxId), buyer.token, { text: 'still there?' })).status).toBe(409);
    expect((await get(thread(trxId), buyer.token)).status).toBe(200);
  });
});

describe.skipIf(!dbUp)('cart', () => {
  it('adds, lists, removes, and clears an item once claimed', async () => {
    const seller = await signUp('cartseller');
    const buyer = await signUp('cartbuyer');
    const a = (await post('/api/listings', seller.token, listingBody({ title: 'Roti' }))).body
      .listing.id as string;
    const b = (await post('/api/listings', seller.token, listingBody({ title: 'Susu' }))).body
      .listing.id as string;

    expect((await post('/api/cart', buyer.token, { listingId: a })).status).toBe(201);
    expect((await post('/api/cart', buyer.token, { listingId: a })).status).toBe(201); // idempotent
    await post('/api/cart', buyer.token, { listingId: b });
    expect((await post('/api/cart', seller.token, { listingId: a })).status).toBe(400); // own

    const cart = await get('/api/cart', buyer.token);
    expect(cart.body.items).toHaveLength(2);
    expect(cart.body.items[0]).toMatchObject({ available: true, listing: { title: 'Susu' } });
    expect(JSON.stringify(cart.body)).not.toMatch(/pickupLat|pickupAddress/);

    await post(`/api/listings/${a}/claim`, buyer.token);
    expect((await request(app).delete(`/api/cart/${b}`).set(bearer(buyer.token))).status).toBe(204);
    expect((await get('/api/cart', buyer.token)).body.items).toHaveLength(0);
  });

  it('marks items unavailable once they expire', async () => {
    const seller = await signUp('cartexpseller');
    const buyer = await signUp('cartexpbuyer');
    const id = (await post('/api/listings', seller.token, listingBody({ expiryDate: inHours(1) })))
      .body.listing.id as string;
    await post('/api/cart', buyer.token, { listingId: id });
    await runListingMaintenanceJob(new Date(Date.now() + 2 * 3_600_000));
    const cart = await get('/api/cart', buyer.token);
    expect(
      cart.body.items.find((i: { listing: { id: string } }) => i.listing.id === id),
    ).toMatchObject({ available: false });
  });

  it('requires login', async () => {
    expect((await request(app).get('/api/cart')).status).toBe(401);
  });
});

describe.skipIf(!dbUp)('endpoints the flow tests skip', () => {
  it('AI extract and conversational search fall back to rules with AI off', async () => {
    const u = await signUp('aiuser');
    const draft = await post('/api/listings/extract', u.token, { text: '5 nasi kotak ayam' });
    expect(draft.status).toBe(200);
    expect(draft.body.draft).toMatchObject({ source: 'HEURISTIC', category: 'cooked-meal' });
    expect((await post('/api/listings/extract', u.token, {})).status).toBe(400);

    const search = await get('/api/search/chat?q=makanan%20gratis', u.token);
    expect(search.status).toBe(200);
    expect(Array.isArray(search.body.results)).toBe(true);
    expect(search.body.filters).toBeTypeOf('object');
  });

  it('marks all notifications read', async () => {
    const { seller } = await trade('notes');
    const before = await get('/api/notifications', seller.token);
    expect(before.body.unreadCount).toBeGreaterThan(0);
    expect((await post('/api/notifications/read-all', seller.token)).status).toBe(200);
    expect((await get('/api/notifications', seller.token)).body.unreadCount).toBe(0);
  });

  it('resends verification only to unverified accounts', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'resend', email: `resend.${run}@test.dev`, password: 'password123' });
    const again = await post('/api/auth/resend-verification', reg.body.token);
    expect(again.status).toBe(200);
    expect(again.body.devVerificationToken).toBeTypeOf('string');
    await request(app)
      .post('/api/auth/verify-email')
      .send({ token: again.body.devVerificationToken });
    expect((await post('/api/auth/resend-verification', reg.body.token)).status).toBe(400);
  });

  it('refers an expired listing to a compost partner, once', async () => {
    const seller = await signUp('compost');
    const id = (await post('/api/listings', seller.token, listingBody({ expiryDate: inHours(1) })))
      .body.listing.id as string;
    expect((await post(`/api/listings/${id}/compost-referral`, seller.token)).status).toBe(409);
    await runListingMaintenanceJob(new Date(Date.now() + 2 * 3_600_000));
    const ref = await post(`/api/listings/${id}/compost-referral`, seller.token);
    expect(ref.status).toBe(201);
    expect(ref.body.partner.name).toBeTypeOf('string');
    expect((await post(`/api/listings/${id}/compost-referral`, seller.token)).status).toBe(409);
  });
});
