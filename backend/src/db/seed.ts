import { eq } from 'drizzle-orm';
import { getDb } from './client.js';
import { compostPartners, listings, users } from './schema.js';
import { hashPassword } from '../lib/crypto.js';

import { env } from '../config/env.js';

if (env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo accounts with a known password in production.');
  process.exit(1);
}

/** Demo data: an admin, a seller, a buyer, a compost partner and a few listings. */
const db = getDb();
const hours = (h: number) => new Date(Date.now() + h * 3_600_000);

async function upsertUser(name: string, email: string, role: 'USER' | 'ADMIN') {
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) return existing;
  const [row] = await db
    .insert(users)
    .values({
      name,
      email,
      role,
      status: 'ACTIVE',
      passwordHash: await hashPassword('password123'),
      homeLat: '-6.3640',
      homeLng: '106.8280',
      locationRadiusKm: 5,
    })
    .returning();
  return row!;
}

const admin = await upsertUser('Admin', 'admin@wastable.app', 'ADMIN');
const rina = await upsertUser('Rina (seller)', 'rina@wastable.app', 'USER');
await upsertUser('Budi (buyer)', 'budi@wastable.app', 'USER');

const partners = await db.select().from(compostPartners);
if (partners.length === 0) {
  await db.insert(compostPartners).values({
    name: 'Depok Kompos Kita',
    contactEmail: 'hello@komposkita.example',
    areaServed: 'Depok',
  });
}

const existingListings = await db
  .select({ id: listings.id })
  .from(listings)
  .where(eq(listings.sellerId, rina.id));
if (existingListings.length === 0) {
  const base = {
    sellerId: rina.id,
    pickupArea: 'Depok - Kukusan',
    pickupLat: '-6.3680',
    pickupLng: '106.8240',
  };
  await db.insert(listings).values([
    {
      ...base,
      title: 'Nasi Kotak Ayam',
      description: 'Sisa katering, masih hangat',
      category: 'cooked-meal',
      quantity: 5,
      listingType: 'SELL',
      price: '8000',
      expiryDate: hours(2),
      isUrgent: true,
    },
    {
      ...base,
      title: 'Sayur Bayam 3 ikat',
      category: 'produce',
      quantity: 3,
      listingType: 'FREE',
      expiryDate: hours(20),
    },
    {
      ...base,
      title: 'Roti tawar 2 bungkus',
      category: 'bakery',
      quantity: 2,
      listingType: 'EXCHANGE',
      expiryDate: hours(30),
      dietFlags: ['gluten'],
    },
  ]);
}

console.log(`Seeded. Admin: ${admin.email} / password123`);
console.log('Seller: rina@wastable.app, Buyer: budi@wastable.app (same password)');
process.exit(0);
