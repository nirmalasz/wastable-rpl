/**
 * Terms of use and SOP shown on /terms and agreed to on the register form.
 *
 * DRAFT: this text was written from how the app behaves today (claim rules, time-outs,
 * moderation). It has not been reviewed as a legal document; the team should read and
 * adjust it before launch.
 *
 * Bump TERMS_VERSION whenever the text changes in a way people must agree to again.
 * The register form sends this value as `acceptedTermsVersion`; the API stores it on the account
 * with the time of consent.
 */
export const TERMS_VERSION = '2026-11-27';
export const TERMS_UPDATED = '27 November 2026';

export interface TermsSection {
  id: string;
  title: string;
  /** Opening sentence(s) of the section. */
  intro?: string;
  points: string[];
}

export const TERMS: TermsSection[] = [
  {
    id: 'about',
    title: 'What WASTABLE is',
    intro:
      'WASTABLE is a peer-to-peer platform where students and households give away, sell or exchange surplus food that is still safe to eat.',
    points: [
      'WASTABLE connects people. It does not own, store, inspect or deliver any of the food listed.',
      'Every trade is an agreement between the person who posts the food and the person who claims it.',
      'By creating an account you agree to these terms and to follow the steps (SOP) below.',
    ],
  },
  {
    id: 'account',
    title: 'Your account',
    points: [
      'Use your real name and an email address you can read. One account per person.',
      'Keep your password to yourself. You are responsible for what happens under your account.',
      'Add a way to be contacted (for example a WhatsApp number) so the other side can arrange the pickup. It is only shown to someone you have an active trade with.',
      'You may browse without an account. Posting, claiming, chatting, reporting and reviewing need one.',
    ],
  },
  {
    id: 'posting',
    title: 'SOP for posting food',
    intro: 'Before you post, make sure the food is something you would eat yourself.',
    points: [
      'Only list food that is still safe to consume. Do not list spoiled, opened-and-used or recalled items.',
      'Describe it honestly: what it is, how much there is, and how it was stored. Add a clear photo when you can.',
      'Set a truthful "safe to consume by" time. Listings disappear from search once that time passes.',
      'Mention common allergens and ingredients people avoid (for example gluten, dairy, nuts, pork).',
      'Alcohol and other prohibited items may not be listed.',
      'Choose "Free", "For sale" or "Exchange". A sale priced at Rp 0 is treated as free.',
      'The pickup area you type is public. Your exact pin is private and is only used to show buyers a distance.',
      'Edit or delete your listing as soon as the food is no longer available.',
    ],
  },
  {
    id: 'claiming',
    title: 'SOP for claiming food',
    intro: 'Claiming is a commitment to come and collect the item.',
    points: [
      'Tapping Claim, Buy or Offer exchange reserves the whole listing for you straight away. The seller does not need to approve it first.',
      'You can hold at most 3 open claims at a time.',
      'You can ask the seller questions with "Chat with seller" on the listing before you claim. After claiming, arrange the time and place in the same chat page.',
      'Collect the food within 24 hours. A claim that is not completed within 24 hours is cancelled automatically and the listing becomes available again.',
      'When the food changes hands, either side confirms it in the dashboard: the buyer taps "I picked it up" or the seller taps "I handed the food". That completes the trade for both.',
      'If you cannot come, cancel the claim early so someone else can have the food.',
      'If an item is already reserved you can join its waitlist. You are notified if it becomes available; you still have to claim it yourself.',
    ],
  },
  {
    id: 'payment',
    title: 'Payment',
    points: [
      'WASTABLE does not process, hold or refund money. The price on a listing is information only.',
      'For items that are for sale, buyer and seller settle the payment directly when they meet, in cash or by transfer.',
      'Agree on the price and payment method in chat before meeting. Do not pay in advance to someone you have not met.',
    ],
  },
  {
    id: 'safety',
    title: 'Food safety',
    points: [
      'Always check the condition, smell and packaging of food before consuming it.',
      'WASTABLE does not guarantee the quality, safety or labelling of items listed by users.',
      'Allergen and diet labels are added automatically and may be incomplete. Ask the seller if you have an allergy.',
      'Meet in a public, well-lit place when you can.',
    ],
  },
  {
    id: 'reviews',
    title: 'Ratings and reviews',
    points: [
      'After a completed trade, buyer and seller can each leave one rating (1 to 5 stars) with an optional comment and photo.',
      'Reviews are public, appear on the other person’s profile, and cannot be edited or deleted afterwards.',
      'Be honest and respectful. Reviews must be about the trade you actually had.',
    ],
  },
  {
    id: 'moderation',
    title: 'Moderation, reports and suspension',
    points: [
      'New and edited listings are screened automatically. A listing that is flagged, or reported by another user, is hidden while a moderator reviews it.',
      'If a moderator confirms a violation, the listing is removed and a violation is recorded on the seller’s account.',
      'Accounts with repeated violations may be suspended. A suspended account can browse but cannot post, claim, report or review.',
      'A suspended user can submit an appeal from their profile page. A moderator decides on it.',
      'Report a listing only for a real problem, and say clearly what is wrong.',
    ],
  },
  {
    id: 'privacy',
    title: 'Your data',
    points: [
      'We store what you give us: name, email, profile photo, contact preference, your listings, claims, chat messages and reviews.',
      'If you share your location, it is used to sort listings by distance and to send reminders about urgent food near you. Exact coordinates are never shown to other users.',
      'Your contact details are shown only to the other person in a trade that has not been cancelled, never in a question asked before claiming.',
      'We record which version of these terms you agreed to, and when.',
    ],
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    points: [
      'These terms may be updated as the platform grows. The date at the top shows the current version.',
      'Continuing to use WASTABLE after a change means you accept the updated terms.',
    ],
  },
];
