'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { FoodSafetyDisclaimer } from '@/components/food-safety-disclaimer';
import { Avatar } from '@/components/avatar';
import { Alert, Badge, Button, Card, Field, Input, Loading } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { priceLabel } from '@/features/listings/listing-card';
import { formatDateTime, humanize, timeLeft } from '@/lib/format';
import type { ListingDetail } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export default function ListingPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, call } = useAuth();
  const detail = useApi<ListingDetail>(`/listings/${id}`, token);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string }>();
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);

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

  if (detail.error) return <Alert>{detail.error}</Alert>;
  if (!detail.data) return <Loading />;

  const { listing: l, isOwner, waitlistCount, myWaitlistPosition, myTransaction } = detail.data;
  const canAct = Boolean(user?.isVerified) && !isOwner;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/" className="text-sm text-brand-700 underline">
        ← Back to feed
      </Link>
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-2xl font-bold">{l.title}</h1>
          <Badge tone="brand">{priceLabel(l)}</Badge>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge tone={l.status === 'AVAILABLE' ? 'brand' : 'neutral'}>{humanize(l.status)}</Badge>
          {l.isUrgent && <Badge tone="urgent">Urgent</Badge>}
          <Badge>{humanize(l.category)}</Badge>
          {l.dietFlags.map((f) => (
            <Badge key={f} tone="danger">
              contains {f}
            </Badge>
          ))}
        </div>
        {l.description && <p className="whitespace-pre-line text-slate-700">{l.description}</p>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {l.photoUrl && <img src={l.photoUrl} alt={l.title} className="max-h-72 rounded-md" />}
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-slate-500">Quantity</dt>
          <dd>{l.quantity}</dd>
          <dt className="text-slate-500">Pickup area</dt>
          <dd>{l.pickupArea}</dd>
          <dt className="text-slate-500">Expires</dt>
          <dd>
            {formatDateTime(l.expiryDate)} ({timeLeft(l.expiryDate)})
          </dd>
          <dt className="text-slate-500">Seller</dt>
          <dd>
            <span className="inline-flex items-center gap-2">
              <Avatar url={l.sellerAvatarUrl} name={l.sellerName ?? '?'} size={24} />
              {l.sellerName}
            </span>
            {l.sellerRating != null &&
              ` ★ ${l.sellerRating.toFixed(1)} (${detail.data.sellerReviewCount})`}
          </dd>
        </dl>

        {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}

        {isOwner ? (
          <p className="text-sm text-slate-500">
            This is your listing. Manage it from your{' '}
            <Link href="/dashboard" className="underline">
              dashboard
            </Link>
            .
          </p>
        ) : !user ? (
          <p className="text-sm">
            <Link href="/login" className="text-brand-700 underline">
              Log in
            </Link>{' '}
            to claim this item.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {l.status === 'AVAILABLE' && (
              <Button
                disabled={busy || !canAct}
                onClick={() =>
                  act(
                    `/listings/${id}/claim`,
                    'Reserved for you! Arrange pickup with the seller, then confirm in your dashboard.',
                  )
                }
              >
                {l.listingType === 'SELL'
                  ? 'Buy'
                  : l.listingType === 'EXCHANGE'
                    ? 'Offer exchange'
                    : 'Claim'}
              </Button>
            )}
            {l.status === 'PENDING' && myTransaction && (
              <Badge tone="brand">Reserved for you. See your dashboard.</Badge>
            )}
            {l.status === 'PENDING' && !myTransaction && myWaitlistPosition === null && (
              <Button
                variant="secondary"
                disabled={busy || !canAct}
                onClick={() => act(`/listings/${id}/waitlist`, 'You joined the waitlist.')}
              >
                Reserved · join waitlist ({waitlistCount} waiting)
              </Button>
            )}
            {myWaitlistPosition !== null && (
              <Badge>You are #{myWaitlistPosition} on the waitlist</Badge>
            )}
            {!canAct && (
              <span className="text-xs text-slate-500">Verify your email to claim items.</span>
            )}
            {user.isVerified && (
              <Button variant="secondary" onClick={() => setReporting((r) => !r)}>
                Report
              </Button>
            )}
          </div>
        )}

        {reporting && (
          <form onSubmit={report} className="space-y-2 rounded-md border border-slate-200 p-3">
            <Field label="Why are you reporting this listing?">
              <Input name="reason" required minLength={3} maxLength={500} />
            </Field>
            <Button type="submit" variant="danger" disabled={busy}>
              Submit report
            </Button>
          </form>
        )}
        <FoodSafetyDisclaimer />
      </Card>
    </div>
  );
}
