'use client';

import { useCallback } from 'react';
import { createLocalStore } from '@/lib/local-store';
import type { Listing } from '@/lib/types';

/**
 * Cart of listings the user wants to claim. The API has no cart endpoint yet, so the
 * cart lives in this browser's localStorage; claiming still goes through the API.
 */
export type CartItem = Pick<
  Listing,
  'id' | 'title' | 'photoUrl' | 'listingType' | 'price' | 'quantity' | 'pickupArea' | 'expiryDate'
>;

const store = createLocalStore<CartItem[]>('wastable.cart', []);

export function useCart() {
  const items = store.useValue();

  const add = useCallback((l: Listing) => {
    const current = store.get();
    if (current.some((i) => i.id === l.id)) return;
    const { id, title, photoUrl, listingType, price, quantity, pickupArea, expiryDate } = l;
    store.set([
      ...current,
      { id, title, photoUrl, listingType, price, quantity, pickupArea, expiryDate },
    ]);
  }, []);

  const remove = useCallback((id: string) => store.set(store.get().filter((i) => i.id !== id)), []);
  const has = useCallback((id: string) => items.some((i) => i.id === id), [items]);

  return { items, add, remove, has };
}
