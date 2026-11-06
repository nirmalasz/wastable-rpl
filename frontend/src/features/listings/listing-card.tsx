'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { useCart } from '@/features/cart';
import { rupiah, timeLeft } from '@/lib/format';
import type { Listing } from '@/lib/types';

export function priceLabel(l: Pick<Listing, 'listingType' | 'price'>) {
  if (l.listingType === 'FREE') return 'Free';
  if (l.listingType === 'EXCHANGE') return 'Exchange';
  return rupiah(l.price);
}

/** Listing tile from the Figma "Recommended Listing" grid; the plus button adds it to the cart. */
export function ListingCard({
  listing: l,
  cartable = true,
}: {
  listing: Listing;
  /** Hide the add-to-cart button, e.g. on the owner's own listings. */
  cartable?: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const cart = useCart();
  const inCart = cart.has(l.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // Your own listings never get a cart button.
  const showCart = cartable && user?.id !== l.sellerId;

  async function toggleCart() {
    if (!user) return router.push('/login');
    setBusy(true);
    setError(undefined);
    try {
      await (inCart ? cart.remove(l.id) : cart.add(l));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="group flex h-full flex-col rounded-[20px] bg-white p-3 shadow-card transition hover:-translate-y-0.5">
      <Link href={`/listings/${l.id}`} className="flex flex-1 flex-col">
        <div className="relative aspect-square overflow-hidden rounded-[14px] bg-cream">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={l.photoUrl ?? '/images/listing-placeholder.jpg'}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
          {l.isUrgent && (
            <span className="absolute top-2 left-2">
              <Badge tone="urgent">Urgent</Badge>
            </span>
          )}
        </div>

        <p className="mt-2 text-2xl leading-tight font-bold italic text-black">{priceLabel(l)}</p>
        <h3 className="line-clamp-2 text-base leading-snug font-medium text-black">{l.title}</h3>
        <p className="text-xs font-light text-black">
          {l.quantity} available · {l.pickupArea}
          {l.distanceKm != null && ` · ${l.distanceKm} km`}
        </p>
        {l.dietFlags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {l.dietFlags.map((f) => (
              <Badge key={f} tone="danger">
                contains {f}
              </Badge>
            ))}
          </div>
        )}
      </Link>

      <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-muted">
        <span>
          {timeLeft(l.expiryDate)}
          {l.sellerRating != null && ` · ★ ${l.sellerRating.toFixed(1)}`}
        </span>
        {showCart && (
          <button
            type="button"
            onClick={toggleCart}
            disabled={busy}
            aria-pressed={inCart}
            title={error ?? (inCart ? 'Remove from cart' : 'Add to cart')}
            className={`shrink-0 rounded-full transition hover:scale-110 disabled:opacity-50 ${inCart ? 'bg-brand-50 ring-2 ring-brand-500' : ''}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/plus-circle.svg"
              alt={inCart ? 'Remove from cart' : 'Add to cart'}
              width={32}
              height={32}
              className={inCart ? 'rotate-45' : ''}
            />
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="pt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
