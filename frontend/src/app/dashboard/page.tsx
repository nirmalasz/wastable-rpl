'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { CloseIcon } from '@/components/icons';
import { ConfirmDialog, Modal } from '@/components/modal';
import { RequireAuth } from '@/components/require-auth';
import { Alert, Badge, Button, EmptyState, LoadingBlock, listingGrid } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { priceLabel } from '@/features/listings/listing-card';
import { ReviewForm } from '@/features/reviews';
import { formatDateTime, humanize, timeLeft } from '@/lib/format';
import type { MyListing, Transaction } from '@/lib/types';
import { useApi } from '@/lib/use-api';

type Notice = { kind: 'error' | 'success' | 'info'; text: string };

/** What a confirmation dialog is about to do. */
interface Pending {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  run: () => Promise<unknown>;
  success: string;
}

const STATUS_LABEL: Record<Transaction['status'], string> = {
  PENDING: 'pending',
  COMPLETED: 'done',
  CANCELLED: 'cancelled',
};
const STATUS_TONE = { PENDING: 'urgent', COMPLETED: 'brand', CANCELLED: 'danger' } as const;

/** One of your own listings as a tile: photo, facts, and what you can do with it. */
function MyListingCard({
  listing: l,
  onDelete,
  onCompost,
}: {
  listing: MyListing;
  onDelete: () => void;
  onCompost: () => void;
}) {
  return (
    <li className="flex h-full flex-col rounded-[20px] bg-white p-3 shadow-card">
      <Link href={`/listings/${l.id}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-[14px] bg-cream">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={l.photoUrl ?? '/images/listing-placeholder.jpg'}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <span className="absolute top-2 left-2">
            <Badge tone={l.status === 'AVAILABLE' ? 'brand' : 'neutral'}>
              {humanize(l.status)}
            </Badge>
          </span>
        </div>
        <h3 className="mt-2 line-clamp-2 text-base leading-snug font-medium text-black">
          {l.title}
        </h3>
      </Link>
      <p className="text-xs font-light text-black">
        {priceLabel(l)} · {l.quantity} available · {timeLeft(l.expiryDate)}
      </p>
      <p className="truncate text-xs font-light text-black">{l.pickupArea}</p>
      {l.pendingClaim && (
        <p className="mt-1 text-xs text-brand-700">
          Reserved by <strong>{l.pendingClaim.claimerName}</strong>. See My Sales below.
        </p>
      )}
      {l.status === 'UNDER_REVIEW' && (
        <p className="mt-1 text-xs text-muted">Hidden while a moderator reviews it.</p>
      )}

      <div className="mt-auto flex flex-wrap justify-center gap-2 pt-3">
        {l.status === 'AVAILABLE' && (
          <Link
            href={`/listings/${l.id}/edit`}
            className="rounded-[10px] bg-cream px-4 py-2 text-sm font-medium text-ink transition hover:bg-sand"
          >
            Edit
          </Link>
        )}
        {l.status === 'EXPIRED' && (
          <Button variant="secondary" onClick={onCompost}>
            Refer to compost
          </Button>
        )}
        {l.status !== 'PENDING' && l.status !== 'REFERRED_TO_COMPOST' && (
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
    </li>
  );
}

/** One claim or sale: what it is and who with on the left, the next step on the right. */
function TradeRow({
  trade: t,
  onComplete,
  onCancel,
  onReview,
}: {
  trade: Transaction;
  onComplete: () => void;
  onCancel: () => void;
  onReview: () => void;
}) {
  const buying = t.role === 'BUYER';
  const other = buying ? 'seller' : 'buyer';

  return (
    <li className="flex flex-col gap-4 rounded-[20px] bg-white p-5 shadow-card sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href={`/listings/${t.listingId}`}
            className="text-xl leading-tight text-black hover:underline"
          >
            {t.listingTitle}
          </Link>
          <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
        </div>
        <p className="text-sm text-ink">
          {priceLabel({ listingType: t.listingType, price: t.price })} · {t.pickupArea} ·{' '}
          {formatDateTime(t.createdAt)}
        </p>
        <p className="text-sm text-muted">
          {buying ? 'Seller' : 'Buyer'}:{' '}
          <Link href={`/users/${t.counterpart.id}`} className="font-semibold hover:underline">
            {t.counterpart.name}
          </Link>
          {t.status !== 'CANCELLED' &&
            ` · ${t.counterpart.contact ?? 'no contact details shared yet'}`}
        </p>
        {t.status !== 'CANCELLED' && (
          <Link
            href={`/chat?with=${t.id}`}
            className="inline-block text-sm text-brand-700 underline"
          >
            Open chat{t.unreadCount > 0 && ` (${t.unreadCount} new)`}
          </Link>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:w-64">
        {t.status === 'PENDING' && (
          <>
            <Button className="py-2.5 text-base" onClick={onComplete}>
              {buying ? 'I picked it up' : 'I handed the food'}
            </Button>
            <Button variant="secondary" className="italic" onClick={onCancel}>
              Cancel
            </Button>
          </>
        )}
        {t.status === 'COMPLETED' &&
          (t.reviewedByMe ? (
            <p className="rounded-full bg-brand-300 px-4 py-2 text-center text-sm italic text-black">
              You have reviewed this {other}
            </p>
          ) : (
            <Button variant="soft" className="py-2.5 text-base" onClick={onReview}>
              Review {other}
            </Button>
          ))}
      </div>
    </li>
  );
}

function TradeList({
  title,
  empty,
  trades,
  children,
}: {
  title: string;
  empty: ReactNode;
  trades: Transaction[] | undefined;
  children: (t: Transaction) => ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-3xl sm:text-4xl">{title}</h2>
      {!trades ? (
        <LoadingBlock className="min-h-40" />
      ) : trades.length === 0 ? (
        <EmptyState title={`No ${title.replace('My ', '').toLowerCase()} yet.`}>{empty}</EmptyState>
      ) : (
        <ul className="space-y-3">{trades.map(children)}</ul>
      )}
    </section>
  );
}

function Dashboard() {
  const { token, call } = useAuth();
  const listings = useApi<{ listings: MyListing[] }>('/listings/mine', token);
  const trx = useApi<{ transactions: Transaction[] }>('/transactions/mine', token);
  const [notice, setNotice] = useState<Notice>();
  const [pending, setPending] = useState<Pending>();
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState<Transaction>();

  const reloadAll = () => {
    listings.reload();
    trx.reload();
  };

  async function run(fn: () => Promise<unknown>, success: string) {
    setNotice(undefined);
    setBusy(true);
    try {
      await fn();
      setNotice({ kind: 'success', text: success });
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
      setPending(undefined);
      reloadAll();
    }
  }

  const setTrx = (id: string, status: 'COMPLETED' | 'CANCELLED') =>
    call(`/transactions/${id}`, { method: 'PATCH', body: { status } });

  const mine = listings.data?.listings.filter((l) => l.status !== 'REMOVED');
  const claims = trx.data?.transactions.filter((t) => t.role === 'BUYER');
  const sales = trx.data?.transactions.filter((t) => t.role === 'SELLER');

  const cancelTrade = (t: Transaction) =>
    setPending({
      title: 'Cancel this trade?',
      body: (
        <p>
          “{t.listingTitle}” becomes available to others again and {t.counterpart.name} is told it
          was cancelled.
        </p>
      ),
      confirmLabel: 'Cancel trade',
      danger: true,
      run: () => setTrx(t.id, 'CANCELLED'),
      success: 'Cancelled. The listing is available again.',
    });

  return (
    <div className="space-y-10">
      <h1 className="sr-only">Dashboard</h1>
      {/* Sticky, so the result of a button far down the page is still in view. */}
      {notice && (
        <div className="sticky top-2 z-10 flex items-start gap-2 rounded-[10px] bg-cream shadow-card">
          <div className="min-w-0 flex-1">
            <Alert kind={notice.kind}>{notice.text}</Alert>
          </div>
          <button
            type="button"
            onClick={() => setNotice(undefined)}
            aria-label="Dismiss message"
            className="mt-1.5 mr-1.5 rounded-full p-1 text-ink hover:bg-sand"
          >
            <CloseIcon size={18} />
          </button>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-3xl sm:text-4xl">My Listings</h2>
          <Link
            href="/listings/new"
            className="rounded-[10px] bg-accent px-5 py-2 text-sm font-bold italic text-black shadow-button hover:brightness-95"
          >
            Post food
          </Link>
        </div>
        {listings.error && <Alert>{listings.error}</Alert>}
        {!mine && !listings.error && <LoadingBlock className="min-h-64" />}
        {mine?.length === 0 && (
          <EmptyState title="You have not posted anything yet.">
            <p>Share surplus food in a minute. It shows up here once posted.</p>
          </EmptyState>
        )}
        {mine && mine.length > 0 && (
          <ul className={listingGrid}>
            {mine.map((l) => (
              <MyListingCard
                key={l.id}
                listing={l}
                onCompost={() =>
                  run(
                    () => call(`/listings/${l.id}/compost-referral`, { method: 'POST' }),
                    'Referred to a compost partner.',
                  )
                }
                onDelete={() =>
                  setPending({
                    title: 'Delete this listing?',
                    body: <p>“{l.title}” will be removed for good. This cannot be undone.</p>,
                    confirmLabel: 'Delete',
                    danger: true,
                    run: () => call(`/listings/${l.id}`, { method: 'DELETE' }),
                    success: 'Listing deleted.',
                  })
                }
              />
            ))}
          </ul>
        )}
      </section>

      {trx.error && <Alert>{trx.error}</Alert>}

      {!trx.error && (
        <>
          {/* Things you are getting from others. */}
          <TradeList
            title="My Claims"
            trades={claims}
            empty={
              <Link href="/search" className="text-brand-700 underline">
                Find food to claim
              </Link>
            }
          >
            {(t) => (
              <TradeRow
                key={t.id}
                trade={t}
                onComplete={() =>
                  setPending({
                    title: 'Confirm pickup?',
                    body: (
                      <p>
                        Only confirm once you have “{t.listingTitle}” in your hands. This completes
                        the trade and cannot be undone.
                      </p>
                    ),
                    confirmLabel: 'Yes, I picked it up',
                    run: () => setTrx(t.id, 'COMPLETED'),
                    success: 'Pickup confirmed. Please rate the seller.',
                  })
                }
                onCancel={() => cancelTrade(t)}
                onReview={() => setReviewing(t)}
              />
            )}
          </TradeList>

          {/* Things others are getting from you. */}
          <TradeList
            title="My Sales"
            trades={sales}
            empty={<p>When someone claims one of your listings, it appears here.</p>}
          >
            {(t) => (
              <TradeRow
                key={t.id}
                trade={t}
                onComplete={() =>
                  setPending({
                    title: 'Confirm handover?',
                    body: (
                      <p>
                        Only confirm once {t.counterpart.name} has “{t.listingTitle}”. This
                        completes the trade for both of you and cannot be undone.
                      </p>
                    ),
                    confirmLabel: 'Yes, I handed it over',
                    run: () => setTrx(t.id, 'COMPLETED'),
                    success: 'Handover confirmed. Please rate the buyer.',
                  })
                }
                onCancel={() => cancelTrade(t)}
                onReview={() => setReviewing(t)}
              />
            )}
          </TradeList>
        </>
      )}

      {pending && (
        <ConfirmDialog
          title={pending.title}
          confirmLabel={pending.confirmLabel}
          danger={pending.danger}
          busy={busy}
          onClose={() => setPending(undefined)}
          onConfirm={() => run(pending.run, pending.success)}
        >
          {pending.body}
        </ConfirmDialog>
      )}

      {reviewing && (
        <Modal
          title={`Review ${reviewing.role === 'BUYER' ? 'seller' : 'buyer'}`}
          onClose={() => setReviewing(undefined)}
        >
          <p className="text-sm text-muted">For “{reviewing.listingTitle}”.</p>
          <ReviewForm
            flat
            transactionId={reviewing.id}
            role={reviewing.role}
            counterpartName={reviewing.counterpart.name}
            onDone={() => {
              setReviewing(undefined);
              setNotice({ kind: 'success', text: 'Thanks! Your review was sent.' });
              trx.reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return <RequireAuth>{() => <Dashboard />}</RequireAuth>;
}
