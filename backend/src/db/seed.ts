import { eq, sql } from 'drizzle-orm';
import { getDb } from './client.js';
import {
  appeals,
  compostPartners,
  compostReferrals,
  listings,
  moderationCases,
  notifications,
  reports,
  reviews,
  transactions,
  users,
  waitlistEntries,
} from './schema.js';
import { hashPassword } from '../lib/crypto.js';
import { env } from '../config/env.js';

if (env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo accounts with a known password in production.');
  process.exit(1);
}

/**
 * Demo data covering every state the app can show: verified / unverified / suspended users,
 * listings in every status, a reserved item with a waitlist, completed deals with reviews,
 * open and decided moderation cases, appeals and compost referrals.
 *
 *   npm run db:seed              seeds once (skips if demo data already exists)
 *   npm run db:seed -- --reset   wipes ALL tables first, then seeds
 */
const db = getDb();
const PASSWORD = 'password123';
const hours = (h: number) => new Date(Date.now() + h * 3_600_000);
const ago = (h: number) => hours(-h);

const [probe] = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, 'admin@wastable.app'));
if (probe && !process.argv.includes('--reset')) {
  console.log('Demo data already present. Run with --reset to wipe and re-seed.');
  process.exit(0);
}
if (process.argv.includes('--reset')) {
  await db.execute(
    sql`truncate table ai_request_logs, notifications, appeals, reports, moderation_cases, reviews,
      waitlist_entries, transactions, compost_referrals, compost_partners, listings, users
      restart identity cascade`,
  );
  console.log('All tables cleared.');
}

const passwordHash = await hashPassword(PASSWORD);

// ---------------------------------------------------------------- Users
// Home coordinates are scattered around Depok / UI so "nearby" reminders and distances look real.
type NewUser = Omit<typeof users.$inferInsert, 'passwordHash'>;
const mkUser = async (u: NewUser) => {
  const [row] = await db
    .insert(users)
    .values({ status: 'ACTIVE', locationRadiusKm: 5, ...u, passwordHash })
    .returning();
  return row!;
};

const admin = await mkUser({
  name: 'Admin WASTABLE',
  email: 'admin@wastable.app',
  role: 'ADMIN',
  homeLat: '-6.3640',
  homeLng: '106.8280',
});
const rina = await mkUser({
  name: 'Rina Kartika',
  email: 'rina@wastable.app',
  contactPreference: 'WhatsApp 0812-3456-7801',
  homeLat: '-6.3680',
  homeLng: '106.8240',
  locationRadiusKm: 5,
});
const budi = await mkUser({
  name: 'Budi Santoso',
  email: 'budi@wastable.app',
  contactPreference: 'WhatsApp 0813-9876-5502',
  homeLat: '-6.3600',
  homeLng: '106.8310',
  locationRadiusKm: 10,
});
const sari = await mkUser({
  name: 'Sari Wulandari',
  email: 'sari@wastable.app',
  contactPreference: 'Telegram @sariwul',
  homeLat: '-6.3720',
  homeLng: '106.8350',
  locationRadiusKm: 3,
});
const andi = await mkUser({
  name: 'Andi Pratama',
  email: 'andi@wastable.app',
  contactPreference: 'WhatsApp 0857-1122-3303',
  homeLat: '-6.3560',
  homeLng: '106.8200',
  locationRadiusKm: 15,
});
const dewi = await mkUser({
  name: 'Dewi Lestari',
  email: 'dewi@wastable.app',
  contactPreference: 'Chat in app',
  violationCount: 2, // one more confirmed violation suspends the account
  homeLat: '-6.3890',
  homeLng: '106.8180',
});
const agus = await mkUser({
  name: 'Agus Firmansyah',
  email: 'agus@wastable.app',
  status: 'SUSPENDED',
  violationCount: 3,
  contactPreference: 'WhatsApp 0821-4455-6604',
  homeLat: '-6.3500',
  homeLng: '106.8400',
});
const maya = await mkUser({
  name: 'Maya Putri',
  email: 'maya@wastable.app',
  status: 'SUSPENDED',
  violationCount: 3,
  homeLat: '-6.3810',
  homeLng: '106.8260',
});
await mkUser({
  name: 'Tono Wijaya (belum verifikasi)',
  email: 'tono@wastable.app',
  status: 'UNVERIFIED',
  homeLat: '-6.3650',
  homeLng: '106.8290',
});

// ---------------------------------------------------------------- Compost partners
const [komposDepok] = await db
  .insert(compostPartners)
  .values([
    { name: 'Depok Kompos Kita', contactEmail: 'hello@komposkita.example', areaServed: 'Depok' },
    { name: 'Jakarta Green Loop', contactEmail: 'drop@greenloop.example', areaServed: 'Jakarta' },
  ])
  .returning();

// ---------------------------------------------------------------- Listings
type NewListing = typeof listings.$inferInsert;
const kukusan = { pickupArea: 'Depok - Kukusan', pickupLat: '-6.3680', pickupLng: '106.8240' };
const margonda = {
  pickupArea: 'Depok - Jl. Margonda Raya',
  pickupLat: '-6.3640',
  pickupLng: '106.8280',
};
const beji = { pickupArea: 'Depok - Beji', pickupLat: '-6.3720', pickupLng: '106.8350' };
const pondokCina = {
  pickupArea: 'Depok - Pondok Cina',
  pickupLat: '-6.3560',
  pickupLng: '106.8330',
};
const cimanggis = { pickupArea: 'Depok - Cimanggis', pickupLat: '-6.3890', pickupLng: '106.8180' };

const mkListing = async (l: NewListing) => {
  const [row] = await db.insert(listings).values(l).returning();
  return row!;
};

// --- Available: urgent (expires within 3h, shown first and highlighted)
await mkListing({
  sellerId: rina.id,
  ...kukusan,
  title: 'Nasi Kotak Ayam Bakar',
  description: 'Sisa katering seminar, masih hangat. Ambil sebelum jam 8 malam ya.',
  category: 'cooked-meal',
  quantity: 5,
  listingType: 'SELL',
  price: '8000',
  expiryDate: hours(2),
  isUrgent: true,
});
await mkListing({
  sellerId: sari.id,
  ...beji,
  title: 'Roti Manis Isi Cokelat (8 pcs)',
  description: 'Roti toko hari ini, tidak terjual. Teksturnya masih empuk.',
  category: 'bakery',
  quantity: 8,
  listingType: 'FREE',
  expiryDate: hours(1.5),
  isUrgent: true,
  dietFlags: ['gluten', 'dairy', 'egg'],
});
await mkListing({
  sellerId: andi.id,
  ...pondokCina,
  title: 'Soto Ayam + Lontong (3 porsi)',
  description: 'Masak kebanyakan untuk acara keluarga. Kuah dipisah plastik.',
  category: 'cooked-meal',
  quantity: 3,
  listingType: 'SELL',
  price: '12000',
  expiryDate: hours(2.5),
  isUrgent: true,
});

// --- Available: normal range of types, categories and prices
await mkListing({
  sellerId: rina.id,
  ...kukusan,
  title: 'Sayur Bayam Segar 3 ikat',
  description: 'Panen kebun belakang, kelebihan. Sudah dicuci.',
  category: 'produce',
  quantity: 3,
  listingType: 'FREE',
  expiryDate: hours(20),
  dietFlags: ['vegan'],
});
await mkListing({
  sellerId: rina.id,
  ...kukusan,
  title: 'Roti Tawar Gandum 2 bungkus',
  description: 'Mau ditukar dengan sayur atau buah.',
  category: 'bakery',
  quantity: 2,
  listingType: 'EXCHANGE',
  expiryDate: hours(30),
  dietFlags: ['gluten'],
});
await mkListing({
  sellerId: sari.id,
  ...beji,
  title: 'Pisang Cavendish 1 sisir',
  description: 'Mulai matang, cocok untuk banana bread atau dimakan langsung.',
  category: 'produce',
  quantity: 1,
  listingType: 'SELL',
  price: '10000',
  expiryDate: hours(36),
  dietFlags: ['vegan'],
});
await mkListing({
  sellerId: sari.id,
  ...beji,
  title: 'Yogurt Plain 6 cup',
  description: 'Kemasan utuh, disimpan di kulkas. Expired lusa.',
  category: 'dairy',
  quantity: 6,
  listingType: 'SELL',
  price: '15000',
  expiryDate: hours(48),
  dietFlags: ['dairy'],
});
await mkListing({
  sellerId: andi.id,
  ...pondokCina,
  title: 'Es Teh & Jus Jeruk Botolan (10 botol)',
  description: 'Sisa acara kantor. Belum dibuka, masih dingin.',
  category: 'beverage',
  quantity: 10,
  listingType: 'FREE',
  expiryDate: hours(26),
});
await mkListing({
  sellerId: andi.id,
  ...pondokCina,
  title: 'Biskuit & Snack Kemasan (1 dus)',
  description: 'Kemasan penyok tapi isi aman. Best before minggu depan.',
  category: 'packaged',
  quantity: 24,
  listingType: 'SELL',
  price: '30000',
  expiryDate: hours(24 * 6),
  dietFlags: ['gluten'],
});
await mkListing({
  sellerId: dewi.id,
  ...cimanggis,
  title: 'Mie Instan 10 bungkus',
  description: 'Mau ditukar dengan beras 1 kg atau telur.',
  category: 'packaged',
  quantity: 10,
  listingType: 'EXCHANGE',
  expiryDate: hours(24 * 10),
});
await mkListing({
  sellerId: dewi.id,
  ...cimanggis,
  title: 'Telur Ayam Negeri 1 lusin',
  category: 'dairy',
  quantity: 12,
  listingType: 'SELL',
  price: '22000',
  expiryDate: hours(72),
  dietFlags: ['egg'],
});
await mkListing({
  sellerId: budi.id,
  ...margonda,
  title: 'Nasi Goreng Kampung (2 porsi)',
  description: 'Masak sore tadi, tidak habis. Pedas sedang.',
  category: 'cooked-meal',
  quantity: 2,
  listingType: 'FREE',
  expiryDate: hours(5),
});
// no coordinates: never excluded by a radius filter, no distance shown
await mkListing({
  sellerId: budi.id,
  pickupArea: 'Depok - area UI (hubungi untuk lokasi tepat)',
  title: 'Tahu & Tempe Bacem (1 kotak)',
  description: 'Lokasi pickup disepakati lewat chat.',
  category: 'other',
  quantity: 1,
  listingType: 'SELL',
  price: '9000',
  expiryDate: hours(14),
  dietFlags: ['vegan'],
});

// --- Pending: reserved by Budi, with a waitlist (Andi, Sari)
const reserved = await mkListing({
  sellerId: rina.id,
  ...kukusan,
  title: 'Brownies Panggang (1 loyang)',
  description: 'Sudah dipotong 12. Ada kacang almond.',
  category: 'bakery',
  quantity: 12,
  listingType: 'SELL',
  price: '25000',
  expiryDate: hours(18),
  status: 'PENDING',
  dietFlags: ['gluten', 'dairy', 'egg', 'nuts'],
});
await db.insert(transactions).values({
  listingId: reserved.id,
  claimerId: budi.id,
  status: 'PENDING',
  createdAt: ago(1),
  updatedAt: ago(1),
});
await db.insert(waitlistEntries).values([
  { listingId: reserved.id, userId: andi.id, position: 1 },
  { listingId: reserved.id, userId: sari.id, position: 2 },
]);

// --- Pending: another claim, close to the 24h auto-cancel
const staleItem = await mkListing({
  sellerId: sari.id,
  ...beji,
  title: 'Sayur Sop Siap Masak (2 bungkus)',
  category: 'produce',
  quantity: 2,
  listingType: 'FREE',
  expiryDate: hours(10),
  status: 'PENDING',
  dietFlags: ['vegan'],
});
await db.insert(transactions).values({
  listingId: staleItem.id,
  claimerId: andi.id,
  status: 'PENDING',
  createdAt: ago(21),
  updatedAt: ago(21),
});

// --- Completed deals + reviews
const doneMeal = await mkListing({
  sellerId: rina.id,
  ...kukusan,
  title: 'Lontong Sayur (4 porsi)',
  category: 'cooked-meal',
  quantity: 4,
  listingType: 'SELL',
  price: '7000',
  expiryDate: ago(30),
  status: 'COMPLETED',
  createdAt: ago(60),
});
const [doneMealTx] = await db
  .insert(transactions)
  .values({
    listingId: doneMeal.id,
    claimerId: budi.id,
    status: 'COMPLETED',
    completedAt: ago(34),
    createdAt: ago(40),
    updatedAt: ago(34),
  })
  .returning();
const doneBread = await mkListing({
  sellerId: sari.id,
  ...beji,
  title: 'Donat Kentang (6 pcs)',
  category: 'bakery',
  quantity: 6,
  listingType: 'FREE',
  expiryDate: ago(70),
  status: 'COMPLETED',
  createdAt: ago(96),
  dietFlags: ['gluten', 'egg'],
});
const [doneBreadTx] = await db
  .insert(transactions)
  .values({
    listingId: doneBread.id,
    claimerId: rina.id,
    status: 'COMPLETED',
    completedAt: ago(75),
    createdAt: ago(80),
    updatedAt: ago(75),
  })
  .returning();
const doneJuice = await mkListing({
  sellerId: andi.id,
  ...pondokCina,
  title: 'Jus Alpukat (5 cup)',
  category: 'beverage',
  quantity: 5,
  listingType: 'EXCHANGE',
  expiryDate: ago(100),
  status: 'COMPLETED',
  createdAt: ago(130),
});
const [doneJuiceTx] = await db
  .insert(transactions)
  .values({
    listingId: doneJuice.id,
    claimerId: sari.id,
    status: 'COMPLETED',
    completedAt: ago(110),
    createdAt: ago(118),
    updatedAt: ago(110),
  })
  .returning();
await db.insert(reviews).values([
  {
    transactionId: doneMealTx!.id,
    reviewerId: budi.id,
    revieweeId: rina.id,
    rating: 5,
    comment: 'Masih hangat dan porsinya banyak. Penjual ramah!',
    createdAt: ago(33),
  },
  {
    transactionId: doneMealTx!.id,
    reviewerId: rina.id,
    revieweeId: budi.id,
    rating: 5,
    comment: 'Pembeli tepat waktu.',
    createdAt: ago(32),
  },
  {
    transactionId: doneBreadTx!.id,
    reviewerId: rina.id,
    revieweeId: sari.id,
    rating: 4,
    comment: 'Donatnya enak, hanya agak lama menunggu balasan.',
    createdAt: ago(74),
  },
  {
    transactionId: doneBreadTx!.id,
    reviewerId: sari.id,
    revieweeId: rina.id,
    rating: 5,
    createdAt: ago(73),
  },
  {
    transactionId: doneJuiceTx!.id,
    reviewerId: sari.id,
    revieweeId: andi.id,
    rating: 3,
    comment: 'Jusnya sedikit encer, tapi lokasi mudah.',
    createdAt: ago(108),
  },
]);

// --- Cancelled transaction (listing went back on the market)
const cancelled = await mkListing({
  sellerId: andi.id,
  ...pondokCina,
  title: 'Pepes Ikan (3 bungkus)',
  category: 'cooked-meal',
  quantity: 3,
  listingType: 'SELL',
  price: '11000',
  expiryDate: hours(7),
});
await db.insert(transactions).values({
  listingId: cancelled.id,
  claimerId: dewi.id,
  status: 'CANCELLED',
  createdAt: ago(6),
  updatedAt: ago(5),
});

// --- Expired: seller can refer to compost
await mkListing({
  sellerId: rina.id,
  ...kukusan,
  title: 'Pisang Goreng (sudah dingin)',
  category: 'cooked-meal',
  quantity: 10,
  listingType: 'FREE',
  expiryDate: ago(5),
  status: 'EXPIRED',
  createdAt: ago(20),
});
await mkListing({
  sellerId: budi.id,
  ...margonda,
  title: 'Sayur Kangkung 2 ikat',
  category: 'produce',
  quantity: 2,
  listingType: 'FREE',
  expiryDate: ago(12),
  status: 'EXPIRED',
  createdAt: ago(40),
  dietFlags: ['vegan'],
});
// --- Referred to compost
const referred = await mkListing({
  sellerId: sari.id,
  ...beji,
  title: 'Buah Naga Overripe (5 buah)',
  category: 'produce',
  quantity: 5,
  listingType: 'FREE',
  expiryDate: ago(50),
  status: 'REFERRED_TO_COMPOST',
  createdAt: ago(90),
  dietFlags: ['vegan'],
});
await db.insert(compostReferrals).values({
  listingId: referred.id,
  partnerId: komposDepok!.id,
  status: 'COLLECTED',
  createdAt: ago(46),
});

// ---------------------------------------------------------------- Moderation
// 1) Rule filter flagged as UNCERTAIN on creation: listing hidden, case open
const reviewAi = await mkListing({
  sellerId: dewi.id,
  ...cimanggis,
  title: 'Jamu Herbal Tradisional (10 botol)',
  description: 'Jamu buatan sendiri, bisa untuk meredakan berbagai penyakit.',
  category: 'beverage',
  quantity: 10,
  listingType: 'SELL',
  price: '15000',
  expiryDate: hours(40),
  status: 'UNDER_REVIEW',
});
await db.insert(moderationCases).values({
  listingId: reviewAi.id,
  source: 'AI_FLAG',
  aiFlags: ['UNCERTAIN', 'health-claim'],
  aiRationale: 'Homemade drink with unverified health claims; needs a human decision.',
});

// 2) User-reported listing with two reports: hidden, case open
const reportedMeat = await mkListing({
  sellerId: andi.id,
  ...pondokCina,
  title: 'Daging Ayam Mentah 2 kg',
  description: 'Dibeli kemarin, belum dimasak. Disimpan di freezer biasa.',
  category: 'other',
  quantity: 2,
  listingType: 'FREE',
  expiryDate: hours(12),
  status: 'UNDER_REVIEW',
});
const [openCase] = await db
  .insert(moderationCases)
  .values({
    listingId: reportedMeat.id,
    source: 'USER_REPORT',
    aiFlags: ['UNCERTAIN'],
    aiRationale: 'Raw meat with unclear storage conditions.',
  })
  .returning();
await db.insert(reports).values([
  {
    listingId: reportedMeat.id,
    reporterId: sari.id,
    caseId: openCase!.id,
    reason: 'Daging mentah tanpa kemasan, takut tidak higienis.',
  },
  {
    listingId: reportedMeat.id,
    reporterId: budi.id,
    caseId: openCase!.id,
    reason: 'Tidak jelas disimpan di suhu berapa.',
  },
]);

// 3) Dismissed case: listing restored
const dismissedListing = await mkListing({
  sellerId: sari.id,
  ...beji,
  title: 'Tempe Mendoan (20 pcs)',
  category: 'cooked-meal',
  quantity: 20,
  listingType: 'SELL',
  price: '10000',
  expiryDate: hours(9),
  dietFlags: ['vegan'],
});
const [dismissedCase] = await db
  .insert(moderationCases)
  .values({
    listingId: dismissedListing.id,
    source: 'USER_REPORT',
    status: 'DISMISSED',
    adminDecision: 'Laporan tidak terbukti, makanan aman.',
    decidedBy: admin.id,
    decidedAt: ago(8),
    createdAt: ago(10),
    updatedAt: ago(8),
  })
  .returning();
await db.insert(reports).values({
  listingId: dismissedListing.id,
  reporterId: andi.id,
  caseId: dismissedCase!.id,
  reason: 'Terlihat terlalu berminyak.',
  createdAt: ago(10),
});

// 4) Confirmed violations: removed listings that suspended Agus and Maya
const violationCases = [];
for (const [seller, title] of [
  [agus, 'Daging Babi Giling'],
  [agus, 'Minuman Beralkohol Homemade'],
  [agus, 'Ayam Kedaluwarsa (bau)'],
  [maya, 'Kosmetik Racikan Sendiri'],
  [maya, 'Obat Herbal Tanpa Izin'],
  [maya, 'Susu Basi'],
] as const) {
  const l = await mkListing({
    sellerId: seller.id,
    pickupArea: 'Depok - Sawangan',
    title,
    category: 'other',
    quantity: 1,
    listingType: 'FREE',
    expiryDate: ago(48),
    status: 'REMOVED',
    createdAt: ago(200),
  });
  const [c] = await db
    .insert(moderationCases)
    .values({
      listingId: l.id,
      source: 'RULE_FILTER',
      aiFlags: ['PROHIBITED'],
      aiRationale: 'Matches the prohibited-items list.',
      status: 'VIOLATION_CONFIRMED',
      adminDecision: 'Melanggar aturan: barang terlarang.',
      decidedBy: admin.id,
      decidedAt: ago(120),
      createdAt: ago(121),
      updatedAt: ago(120),
    })
    .returning();
  violationCases.push(c!);
}

// ---------------------------------------------------------------- Appeals
await db.insert(appeals).values([
  {
    userId: agus.id,
    caseId: violationCases[2]!.id,
    reason:
      'Saya tidak sengaja mengunggah foto yang salah. Saya berjanji memeriksa kondisi makanan sebelum memposting.',
    status: 'PENDING',
    createdAt: ago(5),
    updatedAt: ago(5),
  },
  {
    userId: maya.id,
    caseId: violationCases[5]!.id,
    reason: 'Itu susu kemasan yang baru dibuka kemarin, mohon ditinjau ulang.',
    status: 'REJECTED',
    decidedAt: ago(30),
    createdAt: ago(60),
    updatedAt: ago(30),
  },
]);

// ---------------------------------------------------------------- Notifications
const notif = (userId: string, type: string, message: string, h: number, isRead = false) => ({
  userId,
  type,
  message,
  isRead,
  createdAt: ago(h),
});
await db
  .insert(notifications)
  .values([
    notif(
      rina.id,
      'CLAIM_REQUEST',
      'Someone wants "Brownies Panggang (1 loyang)". Arrange the pickup or delivery details.',
      1,
    ),
    notif(
      rina.id,
      'LISTING_EXPIRED',
      '"Pisang Goreng (sudah dingin)" has expired. You can refer it to a compost partner from your dashboard.',
      5,
    ),
    notif(rina.id, 'NEW_REVIEW', 'You received a 5-star review.', 33, true),
    notif(
      rina.id,
      'URGENT_ITEM',
      'Hurry: "Roti Manis Isi Cokelat (8 pcs)" expires soon, 1.4 km away.',
      0.5,
    ),
    notif(budi.id, 'URGENT_ITEM', 'Hurry: "Nasi Kotak Ayam Bakar" expires soon, 0.9 km away.', 0.3),
    notif(
      budi.id,
      'URGENT_ITEM',
      'Hurry: "Soto Ayam + Lontong (3 porsi)" expires soon, 1.1 km away.',
      0.2,
    ),
    notif(
      budi.id,
      'REPORT_DISMISSED',
      'Your report on "Tempe Mendoan (20 pcs)" was reviewed and dismissed.',
      8,
      true,
    ),
    notif(
      andi.id,
      'LISTING_HIDDEN',
      '"Daging Ayam Mentah 2 kg" is hidden while an admin reviews a report.',
      4,
    ),
    notif(
      andi.id,
      'CLAIM_CANCELLED',
      'The claim on "Pepes Ikan (3 bungkus)" was cancelled.',
      5,
      true,
    ),
    notif(
      sari.id,
      'PICKUP_COMPLETED',
      'Pickup of "Donat Kentang (6 pcs)" is confirmed. Leave a review!',
      75,
      true,
    ),
    notif(
      sari.id,
      'ITEM_TAKEN',
      '"Brownies Panggang (1 loyang)" is reserved by someone else. You are #2 on the waitlist.',
      1,
    ),
    notif(
      dewi.id,
      'LISTING_HIDDEN',
      '"Jamu Herbal Tradisional (10 botol)" is awaiting admin review.',
      2,
    ),
    notif(
      agus.id,
      'LISTING_REMOVED',
      '"Ayam Kedaluwarsa (bau)" was removed for violating the rules. Your account is suspended.',
      120,
      true,
    ),
    notif(
      maya.id,
      'APPEAL_DECIDED',
      'Your appeal was rejected. Your account remains suspended.',
      30,
    ),
    notif(
      admin.id,
      'NEW_CASE',
      'Listing "Jamu Herbal Tradisional (10 botol)" needs moderation review.',
      2,
    ),
    notif(
      admin.id,
      'NEW_CASE',
      'Listing "Daging Ayam Mentah 2 kg" was reported: Daging mentah tanpa kemasan, takut tidak higienis.',
      4,
    ),
    notif(admin.id, 'APPEAL_SUBMITTED', 'A suspended user submitted an appeal.', 5),
  ]);

console.log('Seeded demo data. All accounts use password:', PASSWORD);
console.table([
  {
    account: 'admin@wastable.app',
    role: 'ADMIN',
    state: 'moderation queue (2 open cases) + 1 pending appeal',
  },
  {
    account: 'rina@wastable.app',
    role: 'seller',
    state: 'urgent + available + reserved (waitlist) + expired (compost)',
  },
  {
    account: 'budi@wastable.app',
    role: 'buyer',
    state: 'has an open claim, completed deal, reviews',
  },
  {
    account: 'sari@wastable.app',
    role: 'seller/buyer',
    state: 'urgent free bread, referred-to-compost, on waitlist',
  },
  {
    account: 'andi@wastable.app',
    role: 'seller',
    state: 'reported listing under review, cancelled deal',
  },
  {
    account: 'dewi@wastable.app',
    role: 'seller',
    state: '2 violations, listing awaiting AI-flag review',
  },
  { account: 'agus@wastable.app', role: 'suspended', state: 'pending appeal' },
  { account: 'maya@wastable.app', role: 'suspended', state: 'appeal rejected' },
  { account: 'tono@wastable.app', role: 'unverified', state: 'cannot post/claim until verified' },
]);
process.exit(0);
