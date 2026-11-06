'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Avatar } from '@/components/avatar';
import { ImageUpload } from '@/components/image-upload';
import { Badge, Button, Input } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { formatDateTime } from '@/lib/format';
import type { Review, ReviewSummary } from '@/lib/types';

/* eslint-disable @next/next/no-img-element -- static star SVG exported from Figma */

/** Five yellow Figma stars; `value` may be fractional (e.g. 4.3 fills 30% of the fifth). */
export function Stars({ value, size = 38 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex shrink-0" role="img" aria-label={`${value.toFixed(1)} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.min(Math.max(value - i, 0), 1);
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <img
              src="/icons/star.svg"
              alt=""
              width={size}
              height={size}
              className="absolute inset-0 opacity-25 grayscale"
            />
            <span
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <img src="/icons/star.svg" alt="" width={size} height={size} className="max-w-none" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);

/** Per-star bars from the Figma rating tab: "5.0 [yellow/grey bar] 1.5k". */
export function RatingBreakdown({ reviews }: { reviews: Review[] }) {
  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.count));

  return (
    <ul className="space-y-3 sm:space-y-4">
      {counts.map(({ star, count }) => (
        <li key={star} className="flex items-center gap-6 sm:gap-10">
          <span className="w-10 text-xl font-semibold text-black sm:text-[28px]">
            {star.toFixed(1)}
          </span>
          <span className=" relative h-4 flex-1 bg-[#b3b3b3]" aria-hidden>
            <span
              className="absolute inset-y-0 left-0 bg-accent"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </span>
          <span className="w-12 text-xl text-black/65 sm:text-[28px]">{compact(count)}</span>
        </li>
      ))}
    </ul>
  );
}

/** White summary card: big average, five stars, rating count. */
export function RatingSummary({ average, total }: Pick<ReviewSummary, 'average' | 'total'>) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] bg-white px-6 py-6 shadow-card">
      <p className="text-[40px] leading-none font-bold text-black">
        {average != null ? average.toFixed(1) : '–'}
      </p>
      <Stars value={average ?? 0} size={56} />
      <p className="text-2xl text-black/65">
        {total} {total === 1 ? 'Rating' : 'Ratings'}
      </p>
    </div>
  );
}

const roleLabel = (role: Review['reviewerRole']) => (role === 'BUYER' ? 'Buyer' : 'Seller');

/** One review: reviewer avatar + name (Langar) with their role, stars on the right, comment. */
export function ReviewCard({ review: r }: { review: Review }) {
  return (
    <article className="rounded-[20px] bg-white px-6 py-5 shadow-card sm:px-8">
      <header className="flex flex-wrap items-center gap-3 sm:gap-4">
        <Link href={`/users/${r.reviewerId}`} className="flex items-center gap-3 hover:underline">
          <Avatar url={r.reviewerAvatarUrl} name={r.reviewerName} size={40} />
          <h3 className="font-display text-base text-black">{r.reviewerName}</h3>
        </Link>
        <Badge tone={r.reviewerRole === 'BUYER' ? 'brand' : 'neutral'}>
          {roleLabel(r.reviewerRole)}
        </Badge>
        <span className="ml-auto">
          <Stars value={r.rating} size={32} />
        </span>
      </header>
      <Link
        href={`/listings/${r.listingId}`}
        className="mt-3 inline-flex max-w-full items-center gap-2 rounded-[10px] bg-cream py-1 pr-3 pl-1 text-sm text-ink hover:bg-sand"
        title="Reviewed product"
      >
        <img
          src={r.listingPhotoUrl ?? '/images/listing-placeholder.jpg'}
          alt=""
          className="size-8 shrink-0 rounded-[6px] object-cover"
        />
        <span className="truncate">
          <span className="text-muted">Product: </span>
          {r.listingTitle}
        </span>
      </Link>
      {r.comment && <p className="mt-3 text-base text-black/65">“{r.comment}”</p>}
      {r.photoUrl && (
        <a
          href={r.photoUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block"
          title="Open photo"
        >
          <img
            src={r.photoUrl}
            alt={`Photo from ${r.reviewerName}`}
            loading="lazy"
            className="size-16 rounded-[4px] object-cover transition hover:opacity-90"
          />
        </a>
      )}
      <p className="mt-2 text-xs text-muted">{formatDateTime(r.createdAt)}</p>
    </article>
  );
}

type Filter = 'ALL' | Review['reviewerRole'];
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'BUYER', label: 'From buyers' },
  { value: 'SELLER', label: 'From sellers' },
];

/** Full rating tab: breakdown + summary side by side, then the review list. */
export function RatingPanel({ summary }: { summary: ReviewSummary }) {
  const { average, total, reviews } = summary;
  const [filter, setFilter] = useState<Filter>('ALL');
  const shown = filter === 'ALL' ? reviews : reviews.filter((r) => r.reviewerRole === filter);

  return (
    <div className="space-y-6">
      <div className="grid items-center gap-6 lg:grid-cols-[1fr_480px]">
        <RatingBreakdown reviews={reviews} />
        <RatingSummary average={average} total={total} />
      </div>
      {total > reviews.length && (
        <p className="text-xs text-muted">Bars show the {reviews.length} most recent ratings.</p>
      )}
      {reviews.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter reviews">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-4 py-1 text-sm shadow-button transition ${
                filter === f.value
                  ? 'bg-brand-500 text-white'
                  : 'bg-white text-ink hover:bg-brand-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="rounded-[20px] bg-white p-6 text-center text-muted shadow-card">
          {reviews.length === 0
            ? 'No reviews yet. Reviews appear here after completed trades.'
            : 'No reviews in this group yet.'}
        </p>
      ) : (
        <div className="space-y-4">
          {shown.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Rate the other side of a completed trade. Both buyer and seller get one review each;
 * `role` is *your* side, so a buyer rates "the seller" and vice versa.
 */
export function ReviewForm({
  transactionId,
  role,
  counterpartName,
  onDone,
}: {
  transactionId: string;
  role: 'BUYER' | 'SELLER';
  counterpartName: string;
  onDone: () => void;
}) {
  const { call } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const other = role === 'BUYER' ? 'seller' : 'buyer';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!rating) return setError('Pick a star rating first.');
    setBusy(true);
    setError(undefined);
    try {
      await call(`/transactions/${transactionId}/reviews`, {
        body: { rating, comment: comment.trim() || undefined, photoUrl },
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-[14px] bg-white p-4 shadow-card">
      <p className="text-sm font-medium text-ink">
        Rate the {other}, {counterpartName}
      </p>
      <div className="flex items-center gap-1" role="radiogroup" aria-label={`Rate the ${other}`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            onClick={() => setRating(n)}
            className={`transition hover:scale-110 ${n <= rating ? '' : 'opacity-25 grayscale'}`}
          >
            <img src="/icons/star.svg" alt="" width={32} height={32} />
          </button>
        ))}
      </div>
      <ImageUpload
        label="Add a photo (optional)"
        shape="thumb"
        value={photoUrl}
        onChange={setPhotoUrl}
      />
      <div className="flex flex-wrap gap-2">
        <Input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Comment (optional)"
          maxLength={1000}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="brand" disabled={busy}>
          {busy ? 'Sending…' : 'Send review'}
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}
