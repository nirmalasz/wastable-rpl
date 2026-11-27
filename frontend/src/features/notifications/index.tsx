import type { ReactNode } from 'react';
import { BellIcon, BoxIcon, ChatIcon, ClockIcon, ShieldIcon, StarIcon } from '@/components/icons';
import type { Notification } from '@/lib/types';

/** The listing title the API puts in quotes inside the message, e.g. `Hurry: "Nasi Kotak" …`. */
const quotedTitle = (message: string) => /"([^"]+)"/.exec(message)?.[1];

const searchFor = (message: string) => {
  const title = quotedTitle(message);
  return title ? `/search?q=${encodeURIComponent(title)}` : '/search';
};

/**
 * Where a notification takes you when you tap it, or `null` if there is nothing to open.
 *
 * The API sends the listing (`listingId`) and trade (`transactionId`) each notification is
 * about, so most open the exact page: the chat with the other person, the listing, or the
 * dashboard where the next step is (review, compost referral). Notifications created before
 * those fields existed have neither; they fall back to the closest general page.
 */
export function notificationHref(n: Notification): string | null {
  const listing = n.listingId ? `/listings/${n.listingId}` : null;
  const chat = n.transactionId
    ? `/chat?with=${n.transactionId}`
    : n.inquiryId
      ? `/chat?ask=${n.inquiryId}`
      : null;

  switch (n.type) {
    // A conversation to answer: someone claimed your item, or wrote to you (in a trade or in a
    // question asked before claiming).
    case 'CLAIM_REQUEST':
    case 'NEW_MESSAGE':
      return chat ?? (n.type === 'NEW_MESSAGE' ? '/chat' : '/dashboard');
    // The next step lives in the dashboard: leave a review, refer an expired item to compost.
    case 'PICKUP_COMPLETED':
    case 'LISTING_EXPIRED':
      return '/dashboard';
    case 'NEW_REVIEW':
      return '/profile?tab=rating';
    // About one listing: yours (hidden, restored, removed) or one you wanted or reported.
    case 'CLAIM_CANCELLED':
    case 'LISTING_HIDDEN':
    case 'LISTING_RESTORED':
    case 'LISTING_REMOVED':
    case 'REPORT_DISMISSED':
    case 'REPORT_ACTIONED':
    case 'ITEM_TAKEN':
      return listing ?? '/dashboard';
    // Someone else's listing you can go and claim.
    case 'ITEM_AVAILABLE':
    case 'URGENT_ITEM':
      return listing ?? searchFor(n.message);
    case 'ACCOUNT_SUSPENDED':
    case 'VIOLATION_WARNING':
    case 'APPEAL_DECIDED':
      return '/profile';
    // Admins: a listing or appeal waiting for a decision.
    case 'NEW_CASE':
    case 'APPEAL_SUBMITTED':
      return '/admin';
    default:
      return listing;
  }
}

/** Icon and colour for a notification, grouped by what it is about. */
export function notificationLook(type: string): { icon: ReactNode; tone: string } {
  switch (type) {
    case 'NEW_MESSAGE':
      return { icon: <ChatIcon size={20} />, tone: 'bg-brand-50 text-brand-700' };
    case 'NEW_REVIEW':
      return { icon: <StarIcon size={20} />, tone: 'bg-accent/40 text-ink' };
    case 'URGENT_ITEM':
    case 'LISTING_EXPIRED':
      return { icon: <ClockIcon size={20} />, tone: 'bg-urgent/20 text-urgent' };
    case 'LISTING_HIDDEN':
    case 'LISTING_REMOVED':
    case 'ACCOUNT_SUSPENDED':
    case 'VIOLATION_WARNING':
    case 'REPORT_ACTIONED':
      return { icon: <ShieldIcon size={20} />, tone: 'bg-expiry/30 text-danger' };
    case 'LISTING_RESTORED':
    case 'REPORT_DISMISSED':
    case 'APPEAL_DECIDED':
      return { icon: <ShieldIcon size={20} />, tone: 'bg-cream text-ink' };
    case 'CLAIM_REQUEST':
    case 'PICKUP_COMPLETED':
    case 'CLAIM_CANCELLED':
    case 'ITEM_AVAILABLE':
    case 'ITEM_TAKEN':
      return { icon: <BoxIcon size={20} />, tone: 'bg-brand-50 text-brand-700' };
    default:
      return { icon: <BellIcon size={20} />, tone: 'bg-cream text-ink' };
  }
}
