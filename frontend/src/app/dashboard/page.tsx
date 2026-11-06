'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RequireAuth } from '@/components/require-auth';
import { Alert, Badge, Button, Card, Loading } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { priceLabel } from '@/features/listings/listing-card';
import { ReviewForm } from '@/features/reviews';
import { formatDateTime, humanize, timeLeft } from '@/lib/format';
import type { MyListing, Transaction } from '@/lib/types';
import { useApi } from '@/lib/use-api';

function Dashboard() {
  const { token, call } = useAuth();
  const listings = useApi<{ listings: MyListing[] }>('/listings/mine', token);
  const trx = useApi<{ transactions: Transaction[] }>('/transactions/mine', token);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string }>();

  async function run(fn: () => Promise<unknown>, success: string) {
    setNotice(undefined);
    try {
      await fn();
      setNotice({ kind: 'success', text: success });
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      listings.reload();
      trx.reload();
    }
  }

  const setTrx = (id: string, status: 'COMPLETED' | 'CANCELLED', success: string) =>
    run(() => call(`/transactions/${id}`, { method: 'PATCH', body: { status } }), success);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl">Dashboard</h1>
        <Link
          href="/listings/new"
          className="rounded-[10px] bg-accent px-5 py-2 text-sm font-bold italic text-black shadow-button hover:brightness-95"
        >
          Post food
        </Link>
      </div>
      {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}

      <section className="space-y-3">
        <h2 className="text-2xl">My listings</h2>
        {listings.error && <Alert>{listings.error}</Alert>}
        {listings.loading && !listings.data && <Loading />}
        {listings.data?.listings.length === 0 && (
          <p className="text-sm text-muted">You have not posted anything yet.</p>
        )}
        {listings.data?.listings
          .filter((l) => l.status !== 'REMOVED')
          .map((l) => (
            <Card key={l.id} className="flex gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={l.photoUrl ?? '/images/listing-placeholder.jpg'}
                alt=""
                className="h-24 w-24 shrink-0 rounded-[14px] object-cover"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/listings/${l.id}`} className="text-lg font-medium hover:underline">
                    {l.title}
                  </Link>
                  <div className="flex gap-1">
                    <Badge tone={l.status === 'AVAILABLE' ? 'brand' : 'neutral'}>
                      {humanize(l.status)}
                    </Badge>
                    <Badge>{priceLabel(l)}</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted">
                  {l.quantity} × · {l.pickupArea} · {timeLeft(l.expiryDate)}
                </p>
                {l.status === 'UNDER_REVIEW' && (
                  <p className="text-sm text-muted">Hidden while a moderator reviews it.</p>
                )}
                {l.pendingClaim && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>
                      Reserved by <strong>{l.pendingClaim.claimerName}</strong>.
                    </span>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setTrx(
                          l.pendingClaim!.transactionId,
                          'CANCELLED',
                          'Claim cancelled. The listing is available again.',
                        )
                      }
                    >
                      Cancel claim
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  {l.status === 'AVAILABLE' && (
                    <Link
                      href={`/listings/${l.id}/edit`}
                      className="rounded-[10px] bg-cream px-4 py-2 text-sm font-medium text-ink transition hover:bg-sand"
                    >
                      Edit
                    </Link>
                  )}
                  {l.status === 'EXPIRED' && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        run(
                          () => call(`/listings/${l.id}/compost-referral`, { method: 'POST' }),
                          'Referred to a compost partner.',
                        )
                      }
                    >
                      Refer to compost
                    </Button>
                  )}
                  {l.status !== 'PENDING' && l.status !== 'REFERRED_TO_COMPOST' && (
                    <Button
                      variant="danger"
                      onClick={() =>
                        confirm(`Delete "${l.title}"?`) &&
                        run(
                          () => call(`/listings/${l.id}`, { method: 'DELETE' }),
                          'Listing deleted.',
                        )
                      }
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">My claims and sales</h2>
        {trx.error && <Alert>{trx.error}</Alert>}
        {trx.loading && !trx.data && <Loading />}
        {trx.data?.transactions.length === 0 && (
          <p className="text-sm text-muted">No transactions yet.</p>
        )}
        {trx.data?.transactions.map((t) => (
          <Card key={t.id} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/listings/${t.listingId}`} className="font-semibold hover:underline">
                {t.listingTitle}
              </Link>
              <div className="flex gap-1">
                <Badge>{t.role === 'BUYER' ? 'You are buying' : `Sold to ${t.claimerName}`}</Badge>
                <Badge
                  tone={
                    t.status === 'COMPLETED'
                      ? 'brand'
                      : t.status === 'CANCELLED'
                        ? 'danger'
                        : 'urgent'
                  }
                >
                  {humanize(t.status)}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted">
              {priceLabel({ listingType: t.listingType, price: t.price })} · {t.pickupArea} ·{' '}
              {formatDateTime(t.createdAt)}
            </p>
            {t.status !== 'CANCELLED' && (
              <p className="text-sm text-muted">
                {t.role === 'BUYER' ? 'Seller' : 'Buyer'}:{' '}
                <Link href={`/users/${t.counterpart.id}`} className="font-semibold hover:underline">
                  {t.counterpart.name}
                </Link>{' '}
                · {t.counterpart.contact ?? 'no contact details shared yet'}
              </p>
            )}
            {t.status === 'PENDING' && (
              <div className="flex gap-2">
                {t.role === 'BUYER' && (
                  <Button
                    onClick={() =>
                      setTrx(t.id, 'COMPLETED', 'Pickup confirmed. Please rate the seller below.')
                    }
                  >
                    I picked it up
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setTrx(t.id, 'CANCELLED', 'Cancelled.')}>
                  Cancel
                </Button>
              </div>
            )}
            {t.status === 'COMPLETED' &&
              (t.reviewedByMe ? (
                <Badge tone="brand">
                  You reviewed this {t.role === 'BUYER' ? 'seller' : 'buyer'}
                </Badge>
              ) : (
                <ReviewForm
                  transactionId={t.id}
                  role={t.role}
                  counterpartName={t.counterpart.name}
                  onDone={trx.reload}
                />
              ))}
          </Card>
        ))}
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return <RequireAuth>{() => <Dashboard />}</RequireAuth>;
}
