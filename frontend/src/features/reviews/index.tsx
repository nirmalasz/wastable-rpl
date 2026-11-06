import { Avatar } from '@/components/avatar';
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
        <li key={star} className="flex items-center gap-3 sm:gap-5">
          <span className="w-10 text-xl font-semibold text-black sm:text-[28px]">
            {star.toFixed(1)}
          </span>
          <span className="relative h-4 flex-1 bg-[#b3b3b3]" aria-hidden>
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

/** One review: reviewer avatar + name (Langar), stars on the right, quoted comment. */
export function ReviewCard({ review: r }: { review: Review }) {
  return (
    <article className="rounded-[20px] bg-white px-6 py-5 shadow-card sm:px-9">
      <header className="flex flex-wrap items-center gap-3 sm:gap-8">
        <Avatar name={r.reviewerName} size={42} />
        <h3 className="font-display text-xl text-black">{r.reviewerName}</h3>
        <span className="ml-auto">
          <Stars value={r.rating} size={34} />
        </span>
      </header>
      {r.comment && <p className="mt-3 text-base text-black/65">“{r.comment}”</p>}
      <p className="mt-3 text-xs text-muted">{formatDateTime(r.createdAt)}</p>
    </article>
  );
}

/** Full rating tab: breakdown + summary side by side, then the review list. */
export function RatingPanel({ summary }: { summary: ReviewSummary }) {
  const { average, total, reviews } = summary;
  return (
    <div className="space-y-6">
      <div className="grid items-center gap-6 lg:grid-cols-[1fr_480px]">
        <RatingBreakdown reviews={reviews} />
        <RatingSummary average={average} total={total} />
      </div>
      {total > reviews.length && (
        <p className="text-xs text-muted">Bars show the {reviews.length} most recent ratings.</p>
      )}
      {reviews.length === 0 ? (
        <p className="rounded-[20px] bg-white p-6 text-center text-muted shadow-card">
          No reviews yet. Reviews appear here after completed trades.
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}
    </div>
  );
}
