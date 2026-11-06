/** Shapes returned by the Express API (see backend/src/modules). */
export type ListingType = 'SELL' | 'EXCHANGE' | 'FREE';
export type ListingStatus =
  | 'AVAILABLE'
  | 'PENDING'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'UNDER_REVIEW'
  | 'REMOVED'
  | 'REFERRED_TO_COMPOST';

export const CATEGORIES = [
  'cooked-meal',
  'produce',
  'bakery',
  'packaged',
  'beverage',
  'dairy',
  'other',
] as const;

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  status: 'UNVERIFIED' | 'ACTIVE' | 'SUSPENDED';
  isVerified: boolean;
  violationCount: number;
  locationRadiusKm: number;
  contactPreference: string | null;
  avatarUrl: string | null;
  homeLat: number | null;
  homeLng: number | null;
}

export interface Listing {
  id: string;
  sellerId: string;
  title: string;
  description: string | null;
  category: string;
  quantity: number;
  listingType: ListingType;
  price: number;
  expiryDate: string;
  pickupArea: string;
  isUrgent: boolean;
  status: ListingStatus;
  dietFlags: string[];
  photoUrl: string | null;
  sellerName?: string;
  sellerAvatarUrl?: string | null;
  sellerRating?: number | null;
  distanceKm?: number | null;
}

export interface MyListing extends Listing {
  pendingClaim: { transactionId: string; claimerName: string } | null;
}

export interface ListingDetail {
  listing: Listing;
  sellerReviewCount: number;
  isOwner: boolean;
  waitlistCount: number;
  myWaitlistPosition: number | null;
  myTransaction: { id: string; status: string } | null;
  /** Exact pickup pin; only sent to the seller. */
  pickupLocation: LatLng | null;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Transaction {
  id: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  listingId: string;
  listingTitle: string;
  listingType: ListingType;
  price: number;
  pickupArea: string;
  claimerName: string;
  role: 'BUYER' | 'SELLER';
  reviewedByMe: boolean;
  counterpart: { id: string; name: string; avatarUrl: string | null; contact: string | null };
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ListingDraft {
  title: string;
  category: string;
  quantity: number;
  expiryDate?: string;
  description?: string;
  listingType?: ListingType;
  price?: number;
  source: 'AI' | 'HEURISTIC';
}

export interface SearchFilters {
  query?: string;
  category?: string;
  maxPrice?: number;
  freeOnly?: boolean;
  expiresWithinHours?: number;
  radiusKm?: number;
}

export interface ModerationCase {
  id: string;
  source: string;
  aiFlags: string[];
  aiRationale: string | null;
  createdAt: string;
  listingId: string;
  listingTitle: string;
  listingDescription: string | null;
  listingStatus: ListingStatus;
  sellerName: string;
  sellerViolations: number;
  reports: { reason: string; createdAt: string }[];
}

export interface Appeal {
  id: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  userName?: string;
  userEmail?: string;
  violationCount?: number;
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  /** Optional photo the reviewer attached. */
  photoUrl: string | null;
  createdAt: string;
  /** The product the review is about. */
  listingId: string;
  listingTitle: string;
  listingPhotoUrl: string | null;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatarUrl: string | null;
  /** The reviewer's side of the deal. */
  reviewerRole: 'BUYER' | 'SELLER';
}

export interface PublicUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface ReviewSummary {
  user: PublicUser;
  average: number | null;
  total: number;
  reviews: Review[];
}
