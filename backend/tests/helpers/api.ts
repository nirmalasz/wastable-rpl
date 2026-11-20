import request from 'supertest';
import { expect } from 'vitest';
import { createApp } from '../../src/app.js';

/**
 * Shared building blocks for the use-case tests (seller.test.ts, buyer.test.ts): an app, users
 * who sign up and verify like a real person, a sample listing, and short request helpers.
 */
export const app = createApp();

/** Unique per run, so names and search words never collide with data from earlier runs. */
export const run = Date.now();

export const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
export const get = (path: string, token?: string) =>
  token ? request(app).get(path).set(auth(token)) : request(app).get(path);
export const post = (path: string, token: string, body?: object) =>
  request(app).post(path).set(auth(token)).send(body);
export const patch = (path: string, token: string, body: object) =>
  request(app).patch(path).set(auth(token)).send(body);
export const del = (path: string, token: string) => request(app).delete(path).set(auth(token));

export interface Person {
  id: string;
  name: string;
  email: string;
  token: string;
}

/** Registers and verifies a new account, the way a person does through the app. */
export async function signUp(name: string): Promise<Person> {
  const email = `${name.toLowerCase().replace(/\W+/g, '.')}.${run}@test.dev`;
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'password123' });
  expect(reg.status).toBe(201);
  const verified = await request(app)
    .post('/api/auth/verify-email')
    .send({ token: reg.body.devVerificationToken });
  expect(verified.body.user.isVerified).toBe(true);
  return { id: reg.body.user.id, name, email, token: reg.body.token };
}

/** A typical listing: five boxed rice meals for sale in Depok, good for 10 hours. */
export const listingBody = (over: Record<string, unknown> = {}) => ({
  title: `Nasi Kotak Ayam ${run}`,
  category: 'cooked-meal',
  quantity: 5,
  listingType: 'SELL',
  price: 8000,
  expiryDate: inHours(10),
  pickupArea: 'Depok',
  ...over,
});

/** Posts a listing as `seller` and returns its id. */
export async function postListing(seller: Person, over: Record<string, unknown> = {}) {
  const res = await post('/api/listings', seller.token, listingBody(over));
  expect(res.status).toBe(201);
  return res.body.listing.id as string;
}

/** Notification types a person has received, newest first. */
export async function notificationTypes(person: Person): Promise<string[]> {
  const res = await get('/api/notifications', person.token);
  return res.body.notifications.map((n: { type: string }) => n.type);
}
