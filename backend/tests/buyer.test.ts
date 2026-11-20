import { describe, expect, it } from 'vitest';
import { MAX_OPEN_CLAIMS } from '../src/lib/constants.js';
import {
  del,
  get,
  notificationTypes,
  patch,
  post,
  postListing,
  run,
  signUp,
} from './helpers/api.js';
import { dbUp } from './helpers/db.js';

/**
 * Use-case tests from the BUYER's point of view: someone looking for food to buy, swap or take
 * for free. Each `describe` is one use case; each `it` is one scenario (main or alternate flow).
 * Test IDs (B-x.y) match docs/USE-CASE-TESTS.md.
 */
describe.skipIf(!dbUp)('Buyer', () => {
  describe('B-1 Find food (UC9-UC10)', () => {
    it('B-1.1 finds a listing by keyword', async () => {
      const seller = await signUp('Rina Bakery');
      const id = await postListing(seller, { title: `Roti gandum tok${run}c`, category: 'bakery' });
      const res = await get(`/api/search?q=tok${run}c`);
      expect(res.body.results.map((l: { id: string }) => l.id)).toEqual([id]);
    });

    it('B-1.2 filters to free food only', async () => {
      const seller = await signUp('Rina Mixed');
      const free = await postListing(seller, {
        title: `Pisang tok${run}d`,
        price: 0,
        listingType: 'FREE',
      });
      await postListing(seller, { title: `Pisang mahal tok${run}d`, price: 20000 });
      const res = await get(`/api/search?q=tok${run}d&free=true`);
      expect(res.body.results.map((l: { id: string }) => l.id)).toEqual([free]);
    });

    it("B-1.3 sees the seller's other listings and rating on their profile", async () => {
      const seller = await signUp('Rina Profile');
      const a = await postListing(seller, { title: `Apel tok${run}e` });
      const b = await postListing(seller, { title: `Jeruk tok${run}e` });
      const profile = await get(`/api/users/${seller.id}/listings`);
      expect(profile.body.user.name).toBe('Rina Profile');
      expect(profile.body.listings.map((l: { id: string }) => l.id).sort()).toEqual([a, b].sort());
      const reviews = await get(`/api/users/${seller.id}/reviews`);
      expect(reviews.body).toMatchObject({ total: 0, average: null });
    });

    it("B-1.4 does not see the seller's exact location in results", async () => {
      const seller = await signUp('Rina Hidden');
      await postListing(seller, { title: `Tahu tok${run}f`, pickupLat: -6.36, pickupLng: 106.83 });
      const res = await get(`/api/search?q=tok${run}f`);
      expect(res.body.results[0]).not.toHaveProperty('pickupLat');
      expect(res.body.results[0]).not.toHaveProperty('pickupAddress');
    });
  });

  describe('B-2 Save food to the cart (New)', () => {
    it('B-2.1 adds a listing, sees it in the cart, and removes it', async () => {
      const seller = await signUp('Rina Cart');
      const buyer = await signUp('Budi Cart');
      const id = await postListing(seller);
      expect((await post('/api/cart', buyer.token, { listingId: id })).status).toBe(201);
      const cart = await get('/api/cart', buyer.token);
      expect(cart.body.items).toEqual([expect.objectContaining({ available: true })]);
      expect((await del(`/api/cart/${id}`, buyer.token)).status).toBe(204);
      expect((await get('/api/cart', buyer.token)).body.items).toEqual([]);
    });

    it('B-2.2 a claimed item leaves the cart automatically', async () => {
      const seller = await signUp('Rina CartClaim');
      const buyer = await signUp('Budi CartClaim');
      const id = await postListing(seller);
      await post('/api/cart', buyer.token, { listingId: id });
      await post(`/api/listings/${id}/claim`, buyer.token);
      expect((await get('/api/cart', buyer.token)).body.items).toEqual([]);
    });
  });

  describe('B-3 Claim food (UC11)', () => {
    it("B-3.1 claims available food and gets the seller's contact", async () => {
      const seller = await signUp('Rina Contact');
      await patch('/api/users/me', seller.token, { contactPreference: 'WA 0812 1111 2222' });
      const buyer = await signUp('Budi Contact');
      const id = await postListing(seller);

      const claim = await post(`/api/listings/${id}/claim`, buyer.token);
      expect(claim.status).toBe(201);
      expect(claim.body.listingStatus).toBe('PENDING');
      const mine = await get('/api/transactions/mine', buyer.token);
      const trx = mine.body.transactions.find(
        (t: { id: string }) => t.id === claim.body.transaction.id,
      );
      expect(trx).toMatchObject({
        role: 'BUYER',
        counterpart: { name: 'Rina Contact', contact: 'WA 0812 1111 2222' },
      });
    });

    it('B-3.2 cannot claim food someone else has reserved, but is offered the waitlist', async () => {
      const seller = await signUp('Rina Popular');
      const first = await signUp('Budi First');
      const second = await signUp('Budi Second');
      const id = await postListing(seller);
      await post(`/api/listings/${id}/claim`, first.token);
      const res = await post(`/api/listings/${id}/claim`, second.token);
      expect(res.status).toBe(409);
      expect(res.body.details.canJoinWaitlist).toBe(true);
    });

    it(`B-3.3 cannot hold more than ${MAX_OPEN_CLAIMS} open claims`, async () => {
      const seller = await signUp('Rina Many');
      const buyer = await signUp('Budi Greedy');
      const statuses: number[] = [];
      for (let i = 0; i <= MAX_OPEN_CLAIMS; i++) {
        const id = await postListing(seller, { title: `Kue ${i} ${run}` });
        statuses.push((await post(`/api/listings/${id}/claim`, buyer.token)).status);
      }
      expect(statuses).toEqual([...Array(MAX_OPEN_CLAIMS).fill(201), 429]);
    });
  });

  describe('B-4 Join the waitlist (UC12)', () => {
    it('B-4.1 joins the waitlist and is notified when the food is free again', async () => {
      const seller = await signUp('Rina Waitlist');
      const first = await signUp('Budi Leaves');
      const waiter = await signUp('Budi Waits');
      const id = await postListing(seller);
      const claim = await post(`/api/listings/${id}/claim`, first.token);

      const join = await post(`/api/listings/${id}/waitlist`, waiter.token);
      expect(join.body.entry.position).toBe(1);
      await patch(`/api/transactions/${claim.body.transaction.id}`, first.token, {
        status: 'CANCELLED',
      });
      expect(await notificationTypes(waiter)).toContain('ITEM_AVAILABLE');
    });
  });

  describe('B-5 Confirm the pickup or cancel (UC13)', () => {
    it('B-5.1 confirms the pickup, completing the trade', async () => {
      const seller = await signUp('Rina Done');
      const buyer = await signUp('Budi Done');
      const id = await postListing(seller);
      const trx = (await post(`/api/listings/${id}/claim`, buyer.token)).body.transaction.id;
      const res = await patch(`/api/transactions/${trx}`, buyer.token, { status: 'COMPLETED' });
      expect(res.status).toBe(200);
      expect(res.body.listingStatus).toBe('COMPLETED');
    });

    it('B-5.2 cancels the claim, and the seller is told', async () => {
      const seller = await signUp('Rina Told');
      const buyer = await signUp('Budi Changes Mind');
      const id = await postListing(seller);
      const trx = (await post(`/api/listings/${id}/claim`, buyer.token)).body.transaction.id;
      const res = await patch(`/api/transactions/${trx}`, buyer.token, { status: 'CANCELLED' });
      expect(res.body.listingStatus).toBe('AVAILABLE');
      expect(await notificationTypes(seller)).toContain('CLAIM_CANCELLED');
    });
  });

  describe('B-6 Chat with the seller (New)', () => {
    it('B-6.1 messages the seller about a claimed item and sees the reply', async () => {
      const seller = await signUp('Rina Replies');
      const buyer = await signUp('Budi Asks');
      const id = await postListing(seller);
      const trx = (await post(`/api/listings/${id}/claim`, buyer.token)).body.transaction.id;
      await post(`/api/transactions/${trx}/messages`, buyer.token, { text: 'Masih ada?' });
      await post(`/api/transactions/${trx}/messages`, seller.token, { text: 'Masih, silakan' });

      const thread = await get(`/api/transactions/${trx}/messages`, buyer.token);
      expect(
        thread.body.messages.map((m: { body: string; mine: boolean }) => [m.body, m.mine]),
      ).toEqual([
        ['Masih ada?', true],
        ['Masih, silakan', false],
      ]);
    });
  });

  describe('B-7 Review the seller (UC14)', () => {
    it("B-7.1 rates the seller once after pickup; it shows on the seller's profile", async () => {
      const seller = await signUp('Rina Rated');
      const buyer = await signUp('Budi Rates');
      const id = await postListing(seller);
      const trx = (await post(`/api/listings/${id}/claim`, buyer.token)).body.transaction.id;
      await patch(`/api/transactions/${trx}`, buyer.token, { status: 'COMPLETED' });

      const review = await post(`/api/transactions/${trx}/reviews`, buyer.token, {
        rating: 4,
        comment: 'Enak, porsi pas',
      });
      expect(review.status).toBe(201);
      expect(
        (await post(`/api/transactions/${trx}/reviews`, buyer.token, { rating: 5 })).status,
      ).toBe(409);
      const profile = await get(`/api/users/${seller.id}/reviews`);
      expect(profile.body).toMatchObject({ total: 1, average: 4 });
      expect(profile.body.reviews[0]).toMatchObject({
        reviewerRole: 'BUYER',
        reviewerName: 'Budi Rates',
        listingId: id,
      });
    });

    it('B-7.2 the rating must be between 1 and 5', async () => {
      const seller = await signUp('Rina Bounds');
      const buyer = await signUp('Budi Bounds');
      const id = await postListing(seller);
      const trx = (await post(`/api/listings/${id}/claim`, buyer.token)).body.transaction.id;
      await patch(`/api/transactions/${trx}`, buyer.token, { status: 'COMPLETED' });
      for (const rating of [0, 6]) {
        expect(
          (await post(`/api/transactions/${trx}/reviews`, buyer.token, { rating })).status,
        ).toBe(400);
      }
    });
  });

  describe('B-8 Report an unsafe listing (UC16)', () => {
    it('B-8.1 reports a listing once; a second report is refused', async () => {
      const seller = await signUp('Rina Reported');
      const buyer = await signUp('Budi Reporter');
      const id = await postListing(seller);
      const report = { reason: 'Looks spoiled in the photo' };
      expect((await post(`/api/listings/${id}/reports`, buyer.token, report)).status).toBe(201);
      expect((await post(`/api/listings/${id}/reports`, buyer.token, report)).status).toBe(409);
    });

    it('B-8.2 a report needs a reason', async () => {
      const seller = await signUp('Rina NoReason');
      const buyer = await signUp('Budi NoReason');
      const id = await postListing(seller);
      expect((await post(`/api/listings/${id}/reports`, buyer.token, { reason: '' })).status).toBe(
        400,
      );
    });
  });
});
