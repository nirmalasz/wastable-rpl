'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { FoodSafetyDisclaimer } from '@/components/food-safety-disclaimer';
import { Avatar } from '@/components/avatar';
import { Alert, Badge, Button, Field, Input, Loading } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { ListingCard, priceLabel } from '@/features/listings/listing-card';
import { formatDateTime, humanize, timeLeft } from '@/lib/format';
import type { Listing, ListingDetail } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/* eslint-disable @next/next/no-img-element -- listing photos and static icons */

const safeBy = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

function Stars({ rating }: { rating: number | null | undefined }) {
  const filled = Math.round(rating ?? 0);
  return (
    <div
      className="flex gap-1"
      aria-label={rating != null ? `${rating.toFixed(1)} of 5` : 'No ratings yet'}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <img
          key={n}
          src="/icons/star.svg"
          alt=""
          width={44}
          height={44}
          className={n <= filled ? '' : 'opacity-30 grayscale'}
        />
      ))}
    </div>
  );
}

function SimilarListings({ listing }: { listing: Listing }) {
  const similar = useApi<{ results: Listing[] }>(
    `/search?category=${encodeURIComponent(listing.category)}`,
  );
  const others = similar.data?.results.filter((l) => l.id !== listing.id).slice(0, 10) ?? [];
  if (others.length === 0) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-4xl text-black sm:text-[52px] sm:leading-tight">Similar Listings</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {others.map((l) => (
          <ListingCard key={l.id} listing={l} />
        ))}
      </div>
    </section>
  );
}

export default function ListingPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, call } = useAuth();
  const detail = useApi<ListingDetail>(`/listings/${id}`, token);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string }>();
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function act(path: string, success: string) {
    setBusy(true);
    setNotice(undefined);
    try {
      await call(path, { method: 'POST' });
      setNotice({ kind: 'success', text: success });
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
      detail.reload();
    }
  }

  async function report(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get('reason'));
    setBusy(true);
    try {
      await call(`/listings/${id}/reports`, { body: { reason } });
      setNotice({
        kind: 'success',
        text: 'Thanks. The listing is hidden while a moderator reviews it.',
      });
      setReporting(false);
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
      detail.reload();
    }
  }

  async function share(title: string) {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    }
  }

  if (detail.error) return <Alert>{detail.error}</Alert>;
  if (!detail.data) return <Loading />;

  const { listing: l, isOwner, waitlistCount, myWaitlistPosition, myTransaction } = detail.data;
  const canAct = Boolean(user?.isVerified) && !isOwner;
  const claimLabel =
    l.listingType === 'SELL' ? 'buy' : l.listingType === 'EXCHANGE' ? 'offer exchange' : 'claim';

  // The big green button from the design; its state follows the listing and the viewer.
  let primary;
  if (isOwner) {
    primary = (
      <Link href="/dashboard" className="claim-button">
        manage
      </Link>
    );
  } else if (!user) {
    primary = (
      <Link href="/login" className="claim-button">
        login to {claimLabel}
      </Link>
    );
  } else if (l.status === 'AVAILABLE') {
    primary = (
      <button
        type="button"
        className="claim-button"
        disabled={busy || !canAct}
        onClick={() =>
          act(
            `/listings/${id}/claim`,
            'Reserved for you! Arrange pickup with the seller, then confirm in your dashboard.',
          )
        }
      >
        {claimLabel}
      </button>
    );
  } else if (l.status === 'PENDING' && !myTransaction && myWaitlistPosition === null) {
    primary = (
      <button
        type="button"
        className="claim-button"
        disabled={busy || !canAct}
        onClick={() => act(`/listings/${id}/waitlist`, 'You joined the waitlist.')}
      >
        join waitlist ({waitlistCount})
      </button>
    );
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-6 lg:grid-cols-[434px_1fr]">
        {/* Left column: photo, claim, seller */}
        <div className="space-y-5">
          <div className="rounded-[20px] bg-white p-5 shadow-card">
            <img
              src={l.photoUrl ?? '/images/listing-placeholder.jpg'}
              alt={l.title}
              className="aspect-square w-full rounded-[14px] object-cover"
            />
          </div>

          {primary}
          {!isOwner && user && !user.isVerified && (
            <p className="text-center text-xs text-muted">Verify your email to claim items.</p>
          )}

          <div className="space-y-4 rounded-[20px] bg-brand-300 p-6">
            <div className="flex items-center gap-4">
              {l.sellerAvatarUrl ? (
                <Avatar url={l.sellerAvatarUrl} name={l.sellerName ?? '?'} size={91} />
              ) : (
                <img src="/icons/seller-avatar.svg" alt="" width={91} height={91} />
              )}
              <div>
                <p className="text-3xl font-medium text-black">{l.sellerName}</p>
                <p className="text-sm text-ink">
                  {detail.data.sellerReviewCount} review
                  {detail.data.sellerReviewCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <Stars rating={l.sellerRating} />
          </div>
        </div>

        {/* Right column: details */}
        <div className="space-y-5 rounded-[20px] bg-white p-6 shadow-card sm:p-8">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="font-sans text-3xl font-medium text-black sm:text-[38px] sm:leading-tight">
                {l.title}
              </h1>
              <p className="text-2xl font-light text-black">{l.quantity} available</p>
            </div>
            <button
              type="button"
              onClick={() => share(l.title)}
              aria-label="Share listing"
              title={copied ? 'Link copied' : 'Share'}
              className="shrink-0"
            >
              <img src="/icons/share.svg" alt="" width={40} height={40} />
            </button>
          </div>

          <p className="text-4xl font-bold italic text-black sm:text-[46px]">{priceLabel(l)}</p>

          <div className="flex flex-wrap gap-1">
            <Badge tone={l.status === 'AVAILABLE' ? 'brand' : 'neutral'}>
              {humanize(l.status)}
            </Badge>
            {l.isUrgent && <Badge tone="urgent">Urgent</Badge>}
            <Badge>{humanize(l.category)}</Badge>
            {l.dietFlags.map((f) => (
              <Badge key={f} tone="danger">
                contains {f}
              </Badge>
            ))}
          </div>

          <p className="rounded-[20px] bg-expiry px-6 py-4 text-center text-xl font-light text-black sm:text-2xl">
            Safe to Consume by {safeBy(l.expiryDate)}
            <span className="block text-sm">
              {formatDateTime(l.expiryDate)} · {timeLeft(l.expiryDate)}
            </span>
          </p>

          {l.description && (
            <p className="text-justify text-xl leading-relaxed font-light whitespace-pre-line text-black sm:text-2xl">
              {l.description}
            </p>
          )}

          <p className="text-base">
            <span className="text-muted">Pickup area: </span>
            {l.pickupArea}
          </p>

          {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}

          {l.status === 'PENDING' && myTransaction && (
            <Badge tone="brand">Reserved for you. See your dashboard.</Badge>
          )}
          {myWaitlistPosition !== null && (
            <Badge>You are #{myWaitlistPosition} on the waitlist</Badge>
          )}

          {user?.isVerified && !isOwner && (
            <Button variant="secondary" onClick={() => setReporting((r) => !r)}>
              Report
            </Button>
          )}

          {reporting && (
            <form onSubmit={report} className="space-y-2 rounded-[14px] border border-sand p-3">
              <Field label="Why are you reporting this listing?">
                <Input name="reason" required minLength={3} maxLength={500} />
              </Field>
              <Button type="submit" variant="danger" disabled={busy}>
                Submit report
              </Button>
            </form>
          )}
          <FoodSafetyDisclaimer />
        </div>
      </div>

      <SimilarListings listing={l} />
    </div>
  );
}
