/**
 * Database schema, derived from the Chapter 3 class diagrams (Figures 3.3 and 3.4).
 * After editing, run `npm run db:generate -w backend` to create a migration.
 */
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------- Enums ----------
export const roleEnum = pgEnum('role', ['USER', 'ADMIN']);
export const accountStatusEnum = pgEnum('account_status', ['UNVERIFIED', 'ACTIVE', 'SUSPENDED']);
export const listingTypeEnum = pgEnum('listing_type', ['SELL', 'EXCHANGE', 'FREE']);
export const listingStatusEnum = pgEnum('listing_status', [
  'AVAILABLE',
  'PENDING',
  'COMPLETED',
  'EXPIRED',
  'UNDER_REVIEW',
  'REMOVED',
  'REFERRED_TO_COMPOST',
]);
export const transactionStatusEnum = pgEnum('transaction_status', [
  'PENDING',
  'COMPLETED',
  'CANCELLED',
]);
export const caseSourceEnum = pgEnum('case_source', ['USER_REPORT', 'AI_FLAG', 'RULE_FILTER']);
export const caseStatusEnum = pgEnum('case_status', ['OPEN', 'DISMISSED', 'VIOLATION_CONFIRMED']);
export const appealStatusEnum = pgEnum('appeal_status', ['PENDING', 'APPROVED', 'REJECTED']);
export const notificationChannelEnum = pgEnum('notification_channel', ['IN_APP', 'EMAIL', 'PUSH']);
export const referralStatusEnum = pgEnum('referral_status', ['SENT', 'ACCEPTED', 'COLLECTED']);
export const agentTypeEnum = pgEnum('agent_type', ['LISTING', 'MODERATION', 'DISCOVERY']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

// ---------- Marketplace core ----------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('USER'),
  status: accountStatusEnum('status').notNull().default('UNVERIFIED'),
  violationCount: smallint('violation_count').notNull().default(0),
  locationRadiusKm: smallint('location_radius_km').notNull().default(3),
  contactPreference: text('contact_preference'),
  ...timestamps,
});

export const listings = pgTable(
  'listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    description: text('description'),
    category: text('category').notNull(),
    quantity: integer('quantity').notNull(),
    listingType: listingTypeEnum('listing_type').notNull(),
    price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0'),
    expiryDate: timestamp('expiry_date', { withTimezone: true }).notNull(),
    /** Public pickup area / building name. Exact coordinates are never returned by the API. */
    pickupArea: text('pickup_area').notNull(),
    pickupLat: numeric('pickup_lat', { precision: 9, scale: 6 }),
    pickupLng: numeric('pickup_lng', { precision: 9, scale: 6 }),
    isUrgent: boolean('is_urgent').notNull().default(false),
    status: listingStatusEnum('status').notNull().default('AVAILABLE'),
    dietFlags: text('diet_flags').array().notNull().default([]),
    photoUrl: text('photo_url'),
    ...timestamps,
  },
  (t) => [index('listings_status_expiry_idx').on(t.status, t.expiryDate)],
);

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => listings.id),
  claimerId: uuid('claimer_id')
    .notNull()
    .references(() => users.id),
  status: transactionStatusEnum('status').notNull().default('PENDING'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps,
});

export const waitlistEntries = pgTable(
  'waitlist_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    position: integer('position').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('waitlist_listing_user_uq').on(t.listingId, t.userId)],
);

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id')
    .notNull()
    .references(() => transactions.id),
  reviewerId: uuid('reviewer_id')
    .notNull()
    .references(() => users.id),
  revieweeId: uuid('reviewee_id')
    .notNull()
    .references(() => users.id),
  rating: smallint('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Safety & moderation ----------
export const moderationCases = pgTable('moderation_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => listings.id),
  source: caseSourceEnum('source').notNull(),
  aiFlags: text('ai_flags').array().notNull().default([]),
  aiRationale: text('ai_rationale'),
  status: caseStatusEnum('status').notNull().default('OPEN'),
  adminDecision: text('admin_decision'),
  decidedBy: uuid('decided_by').references(() => users.id),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  ...timestamps,
});

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => listings.id),
  reporterId: uuid('reporter_id')
    .notNull()
    .references(() => users.id),
  caseId: uuid('case_id').references(() => moderationCases.id),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const appeals = pgTable('appeals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  caseId: uuid('case_id').references(() => moderationCases.id),
  reason: text('reason').notNull(),
  status: appealStatusEnum('status').notNull().default('PENDING'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  ...timestamps,
});

// ---------- Notifications, compost, AI usage ----------
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  type: text('type').notNull(),
  message: text('message').notNull(),
  channel: notificationChannelEnum('channel').notNull().default('IN_APP'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const compostPartners = pgTable('compost_partners', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  contactEmail: text('contact_email').notNull(),
  areaServed: text('area_served'),
});

export const compostReferrals = pgTable('compost_referrals', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => listings.id),
  partnerId: uuid('partner_id')
    .notNull()
    .references(() => compostPartners.id),
  status: referralStatusEnum('status').notNull().default('SENT'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const aiRequestLogs = pgTable('ai_request_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  agentType: agentTypeEnum('agent_type').notNull(),
  promptHash: text('prompt_hash').notNull(),
  cacheHit: boolean('cache_hit').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
