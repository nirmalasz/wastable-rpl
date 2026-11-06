'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RequireAuth } from '@/components/require-auth';
import { Alert } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { useCart, type CartItem } from '@/features/cart';
import { priceLabel } from '@/features/listings/listing-card';
import { timeLeft } from '@/lib/format';

const actionLabel = (i: CartItem) =>
  i.listingType === 'SELL' ? 'Buy' : i.listingType === 'EXCHANGE' ? 'Offer exchange' : 'Claim';

/** Cart row from the Figma "cart" screen: photo, product name, yellow action button. */
function CartRow({
  item,
  busy,
  onClaim,
  onRemove,
}: {
  item: CartItem;
  busy: boolean;
  onClaim: () => void;
  onRemove: () => void;
}) {
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
            disabled={busy}
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
  const { items, remove } = useCart();
  const [busyId, setBusyId] = useState<string>();
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string }>();

  async function claim(item: CartItem) {
    setBusyId(item.id);
    setNotice(undefined);
    try {
      await call(`/listings/${item.id}/claim`, { method: 'POST' });
      remove(item.id);
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

      {items.length === 0 ? (
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
          {items.map((i) => (
            <CartRow
              key={i.id}
              item={i}
              busy={busyId === i.id}
              onClaim={() => claim(i)}
              onRemove={() => remove(i.id)}
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
