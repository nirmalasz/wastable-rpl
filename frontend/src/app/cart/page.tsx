'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RequireAuth } from '@/components/require-auth';
import { Alert, Badge, Loading } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { useCart } from '@/features/cart';
import { priceLabel } from '@/features/listings/listing-card';
import { humanize, timeLeft } from '@/lib/format';
import type { CartEntry, Listing } from '@/lib/types';

const actionLabel = (i: Listing) =>
  i.listingType === 'SELL' ? 'Buy' : i.listingType === 'EXCHANGE' ? 'Offer exchange' : 'Claim';

/** Cart row from the Figma "cart" screen: photo, product name, yellow action button. */
function CartRow({
  entry,
  busy,
  onClaim,
  onRemove,
}: {
  entry: CartEntry;
  busy: boolean;
  onClaim: () => void;
  onRemove: () => void;
}) {
  const item = entry.listing;
  return (
    <li className="flex gap-4 rounded-[17px] bg-white p-4 shadow-card sm:gap-5 sm:p-5">
      <Link href={`/listings/${item.id}`} className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.photoUrl ?? '/images/listing-placeholder.jpg'}
          alt=""
          className="size-24 rounded-[4px] object-cover sm:size-[150px]"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          href={`/listings/${item.id}`}
          className="text-xl leading-tight text-black hover:underline sm:text-[26px]"
        >
          {item.title}
        </Link>
        <p className="mt-1 text-lg font-bold italic text-black">{priceLabel(item)}</p>
        <p className="text-sm font-light text-black">
          {item.quantity} available · {item.pickupArea} · {timeLeft(item.expiryDate)}
        </p>

        <div className="mt-auto flex flex-wrap items-center justify-end gap-3 pt-3">
          {!entry.available && (
            <span className="mr-auto">
              <Badge tone="danger">
                {item.status === 'AVAILABLE'
                  ? 'Expired'
                  : `No longer available (${humanize(item.status)})`}
              </Badge>
            </span>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="text-sm text-muted underline hover:text-danger"
          >
            Remove
          </button>
          <button
            type="button"
            onClick={onClaim}
            disabled={busy || !entry.available}
            className="h-11 w-full rounded-[6.5px] bg-accent px-6 text-base font-medium italic text-black shadow-button transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-[194px]"
          >
            {busy ? 'Working…' : actionLabel(item)}
          </button>
        </div>
      </div>
    </li>
  );
}

function Cart() {
  const { call } = useAuth();
  const { items, loaded, remove, reload } = useCart();
  const [busyId, setBusyId] = useState<string>();
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string }>();

  async function claim(item: Listing) {
    setBusyId(item.id);
    setNotice(undefined);
    try {
      await call(`/listings/${item.id}/claim`, { method: 'POST' });
      // The API takes a claimed item out of the cart; refresh to match.
      await reload();
      setNotice({
        kind: 'success',
        text: `"${item.title}" is reserved for you. Arrange pickup in chat, then confirm in your dashboard.`,
      });
    } catch (err) {
      setNotice({ kind: 'error', text: `${item.title}: ${(err as Error).message}` });
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Cart</h1>
      {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}

      {!loaded ? (
        <Loading />
      ) : items.length === 0 ? (
        <div className="rounded-[17px] bg-white p-8 text-center shadow-card">
          <p className="text-lg">Your cart is empty.</p>
          <p className="mt-1 text-sm text-muted">
            Tap the <span className="font-semibold">+</span> on any listing to save it here.
          </p>
          <Link href="/" className="mt-4 inline-block text-brand-700 underline">
            Browse food
          </Link>
        </div>
      ) : (
        <ul className="space-y-6">
          {items.map((e) => (
            <CartRow
              key={e.listing.id}
              entry={e}
              busy={busyId === e.listing.id}
              onClaim={() => claim(e.listing)}
              onRemove={() =>
                remove(e.listing.id).catch((err: Error) =>
                  setNotice({ kind: 'error', text: err.message }),
                )
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CartPage() {
  return <RequireAuth>{() => <Cart />}</RequireAuth>;
}
