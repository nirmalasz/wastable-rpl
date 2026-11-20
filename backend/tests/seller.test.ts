import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { runListingMaintenanceJob } from '../src/modules/scheduler/jobs.js';
import {
  app,
  del,
  get,
  inHours,
  listingBody,
  notificationTypes,
  patch,
  post,
  postListing,
  run,
  signUp,
} from './helpers/api.js';
import { dbUp } from './helpers/db.js';

/**
 * Use-case tests from the SELLER's point of view: someone with surplus food who lists it.
 * Each `describe` is one use case; each `it` is one scenario (main flow or an alternate flow).
 * Test IDs (S-x.y) match docs/USE-CASE-TESTS.md.
 */
describe.skipIf(!dbUp)('Seller', () => {
  describe('S-1 Create an account and sign in (UC1-UC4)', () => {
    it('S-1.1 registers, verifies the email, and signs in', async () => {
      const seller = await signUp('Rina Seller');
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: seller.email, password: 'password123' });
      expect(login.status).toBe(200);
      expect(login.body.user).toMatchObject({ name: 'Rina Seller', isVerified: true });
    });

    it('S-1.2 cannot sign in with a wrong password', async () => {
      const seller = await signUp('Rina Wrongpass');
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: seller.email, password: 'not-my-password' });
      expect(login.status).toBe(401);
    });

    it('S-1.3 cannot post food before verifying the email', async () => {
      const reg = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Unverified', email: `unverified.${run}@test.dev`, password: 'password123' });
      const res = await post('/api/listings', reg.body.token, listingBody());
      expect(res.status).toBe(403);
    });
  });

  describe('S-2 Post surplus food (UC5-UC8)', () => {
    it('S-2.1 posts a listing that buyers can find', async () => {
      const seller = await signUp('Rina Poster');
      const id = await postListing(seller, { title: `Roti tawar tok${run}a`, category: 'bakery' });

      const search = await get(`/api/search?q=tok${run}a`);
      expect(search.body.results.map((l: { id: string }) => l.id)).toContain(id);
      const mine = await get('/api/listings/mine', seller.token);
      expect(mine.body.listings.find((l: { id: string }) => l.id === id)).toMatchObject({
        status: 'AVAILABLE',
      });
    });

    it('S-2.2 a sale at Rp 0 is listed as free', async () => {
      const seller = await signUp('Rina Free');
      const res = await post('/api/listings', seller.token, listingBody({ price: 0 }));
      expect(res.body.listing).toMatchObject({ listingType: 'FREE', price: 0 });
    });

    it('S-2.3 a prohibited item (alcohol) is rejected', async () => {
      const seller = await signUp('Rina Alcohol');
      const res = await post(
        '/api/listings',
        seller.token,
        listingBody({ title: 'Bir dingin 6 kaleng' }),
      );
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/rejected/i);
    });

    it('S-2.4 diet ingredients are flagged for buyers', async () => {
      const seller = await signUp('Rina Diet');
      const res = await post(
        '/api/listings',
        seller.token,
        listingBody({ title: 'Nasi goreng babi' }),
      );
      expect(res.status).toBe(201);
      expect(res.body.listing.dietFlags).toContain('pork');
    });

    it('S-2.5 an expiry date in the past is refused', async () => {
      const seller = await signUp('Rina Past');
      const res = await post(
        '/api/listings',
        seller.token,
        listingBody({ expiryDate: inHours(-1) }),
      );
      expect(res.status).toBe(422);
    });

    it('S-2.6 the AI helper drafts a listing from a description', async () => {
      const seller = await signUp('Rina Draft');
      const res = await post('/api/listings/extract', seller.token, {
        text: '5 nasi kotak ayam sisa katering, habis malam ini',
      });
      expect(res.status).toBe(200);
      expect(res.body.draft).toMatchObject({ category: 'cooked-meal' });
    });
  });

  describe('S-3 Edit or remove a listing (UC5-UC8)', () => {
    it('S-3.1 edits the price and title of an available listing', async () => {
      const seller = await signUp('Rina Editor');
      const id = await postListing(seller);
      const res = await patch(`/api/listings/${id}`, seller.token, {
        title: `Nasi Kotak Ayam murah ${run}`,
        price: 5000,
      });
      expect(res.status).toBe(200);
      expect(res.body.listing).toMatchObject({
        price: 5000,
        title: `Nasi Kotak Ayam murah ${run}`,
      });
    });

    it("S-3.2 cannot edit another seller's listing", async () => {
      const owner = await signUp('Rina Owner');
      const other = await signUp('Rina Other');
      const id = await postListing(owner);
      expect((await patch(`/api/listings/${id}`, other.token, { price: 1 })).status).toBe(403);
    });

    it('S-3.3 cannot edit a listing while a buyer has reserved it', async () => {
      const seller = await signUp('Rina Reserved');
      const buyer = await signUp('Budi Reserver');
      const id = await postListing(seller);
      await post(`/api/listings/${id}/claim`, buyer.token);
      expect((await patch(`/api/listings/${id}`, seller.token, { price: 1 })).status).toBe(409);
    });

    it('S-3.4 removes a listing so buyers no longer see it', async () => {
      const seller = await signUp('Rina Remover');
      const id = await postListing(seller, { title: `Susu tok${run}b`, category: 'dairy' });
      expect((await del(`/api/listings/${id}`, seller.token)).status).toBe(204);
      const search = await get(`/api/search?q=tok${run}b`);
      expect(search.body.results).toEqual([]);
    });
  });

  describe('S-4 Handle a claim from a buyer (UC11-UC13)', () => {
    it('S-4.1 is notified of the claim and sees who reserved it', async () => {
      const seller = await signUp('Rina Claimed');
      const buyer = await signUp('Budi Claimer');
      const id = await postListing(seller);
      await post(`/api/listings/${id}/claim`, buyer.token);

      expect(await notificationTypes(seller)).toContain('CLAIM_REQUEST');
      const mine = await get('/api/listings/mine', seller.token);
      expect(mine.body.listings.find((l: { id: string }) => l.id === id)).toMatchObject({
        status: 'PENDING',
        pendingClaim: { claimerName: 'Budi Claimer' },
      });
    });

    it('S-4.2 cancels a claim, which makes the food available again', async () => {
      const seller = await signUp('Rina Canceller');
      const buyer = await signUp('Budi NoShow');
      const id = await postListing(seller);
      const claim = await post(`/api/listings/${id}/claim`, buyer.token);
      const res = await patch(`/api/transactions/${claim.body.transaction.id}`, seller.token, {
        status: 'CANCELLED',
      });
      expect(res.body.listingStatus).toBe('AVAILABLE');
    });

    it('S-4.3 cannot mark the pickup as done (only the buyer confirms)', async () => {
      const seller = await signUp('Rina Confirm');
      const buyer = await signUp('Budi Confirm');
      const id = await postListing(seller);
      const claim = await post(`/api/listings/${id}/claim`, buyer.token);
      const res = await patch(`/api/transactions/${claim.body.transaction.id}`, seller.token, {
        status: 'COMPLETED',
      });
      expect(res.status).toBe(403);
    });

    it('S-4.4 cannot claim their own food', async () => {
      const seller = await signUp('Rina Self');
      const id = await postListing(seller);
      expect((await post(`/api/listings/${id}/claim`, seller.token)).status).toBe(400);
    });
  });

  describe('S-5 Chat with the buyer (New)', () => {
    it("S-5.1 reads the buyer's message and replies", async () => {
      const seller = await signUp('Rina Chat');
      const buyer = await signUp('Budi Chat');
      const id = await postListing(seller);
      const trx = (await post(`/api/listings/${id}/claim`, buyer.token)).body.transaction.id;

      await post(`/api/transactions/${trx}/messages`, buyer.token, { text: 'Bisa ambil jam 7?' });
      const thread = await get(`/api/transactions/${trx}/messages`, seller.token);
      expect(thread.body.messages).toEqual([
        expect.objectContaining({ body: 'Bisa ambil jam 7?', mine: false }),
      ]);
      const reply = await post(`/api/transactions/${trx}/messages`, seller.token, { text: 'Bisa' });
      expect(reply.status).toBe(201);
    });
  });

  describe('S-6 Review the buyer after a completed trade (UC14)', () => {
    it('S-6.1 reviews the buyer, and the review is labelled as from a seller', async () => {
      const seller = await signUp('Rina Reviewer');
      const buyer = await signUp('Budi Reviewed');
      const id = await postListing(seller);
      const trx = (await post(`/api/listings/${id}/claim`, buyer.token)).body.transaction.id;
      await patch(`/api/transactions/${trx}`, buyer.token, { status: 'COMPLETED' });

      const review = await post(`/api/transactions/${trx}/reviews`, seller.token, {
        rating: 5,
        comment: 'Tepat waktu',
      });
      expect(review.status).toBe(201);
      const profile = await get(`/api/users/${buyer.id}/reviews`);
      expect(profile.body.reviews[0]).toMatchObject({ rating: 5, reviewerRole: 'SELLER' });
    });

    it('S-6.2 cannot review before the pickup is completed', async () => {
      const seller = await signUp('Rina Early');
      const buyer = await signUp('Budi Early');
      const id = await postListing(seller);
      const trx = (await post(`/api/listings/${id}/claim`, buyer.token)).body.transaction.id;
      expect(
        (await post(`/api/transactions/${trx}/reviews`, seller.token, { rating: 4 })).status,
      ).toBe(409);
    });
  });

  describe('S-7 Send expired food to compost (UC20)', () => {
    it('S-7.1 refers an expired listing to a compost partner', async () => {
      const seller = await signUp('Rina Compost');
      const id = await postListing(seller, { expiryDate: inHours(1) });
      await runListingMaintenanceJob(new Date(Date.now() + 2 * 3_600_000));
      const res = await post(`/api/listings/${id}/compost-referral`, seller.token);
      expect(res.status).toBe(201);
      expect(res.body.partner.name).toBeTypeOf('string');
    });
  });

  describe('S-8 Keep the exact pickup location private (Privacy NFR)', () => {
    it('S-8.1 the seller sees the saved pin; a buyer does not', async () => {
      const seller = await signUp('Rina Pin');
      const buyer = await signUp('Budi Pin');
      const id = await postListing(seller, { pickupLat: -6.3646, pickupLng: 106.8287 });

      const own = await get(`/api/listings/${id}`, seller.token);
      expect(own.body.pickupLocation).toMatchObject({ lat: -6.3646, lng: 106.8287 });
      const theirs = await get(`/api/listings/${id}`, buyer.token);
      expect(theirs.body.pickupLocation).toBeNull();
      expect(JSON.stringify(theirs.body)).not.toContain('106.8287');
    });
  });
});
