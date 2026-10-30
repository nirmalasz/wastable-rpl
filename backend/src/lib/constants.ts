export const CATEGORIES = [
  'cooked-meal',
  'produce',
  'bakery',
  'packaged',
  'beverage',
  'dairy',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** A listing expiring within this many hours is tagged urgent (FR-5). */
export const URGENT_WINDOW_HOURS = 3;

/** Violations before an account is suspended (FR-13). */
export const SUSPENSION_THRESHOLD = 3;

/** Open (PENDING) claims one user may hold at the same time, so nobody can reserve everything. */
export const MAX_OPEN_CLAIMS = 3;

/** A claim not picked up within this many hours is cancelled by the scheduler. */
export const CLAIM_TIMEOUT_HOURS = 24;

/** Failed logins per email (15-minute window) before further attempts are refused. */
export const MAX_FAILED_LOGINS = 10;
