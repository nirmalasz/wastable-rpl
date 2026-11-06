'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@/features/auth';
import type { CartEntry, Listing } from '@/lib/types';

/**
 * The signed-in user's cart, stored by the API (/cart). One shared store so the sidebar
 * count, the "+" on listing cards and the cart page always agree.
 */
type Call = ReturnType<typeof useAuth>['call'];

interface State {
  token: string | null;
  items: CartEntry[];
  loaded: boolean;
}

let state: State = { token: null, items: [], loaded: false };
const EMPTY: State = { token: null, items: [], loaded: false };
const listeners = new Set<() => void>();
const emit = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Before the cart had an API it lived in localStorage; move those items over once. */
const LEGACY_KEY = 'wastable.cart';
async function migrateLegacy(call: Call) {
  let ids: string[] = [];
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    ids = (JSON.parse(raw) as { id: string }[]).map((i) => i.id);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    return;
  }
  // Items that were claimed or removed meanwhile are simply skipped.
  await Promise.allSettled(ids.map((listingId) => call('/cart', { body: { listingId } })));
}

async function load(token: string, call: Call) {
  await migrateLegacy(call);
  const res = await call<{ items: CartEntry[] }>('/cart');
  if (state.token === token) emit({ items: res.items, loaded: true });
}

export function useCart() {
  const { token, call } = useAuth();
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );

  useEffect(() => {
    // Several components use the cart; only the first one for a given user starts the load.
    if (state.token === token) return;
    emit({ token, items: [], loaded: false });
    if (token) load(token, call).catch(() => emit({ loaded: true }));
  }, [token, call]);

  const reload = useCallback(() => {
    if (token) return load(token, call);
  }, [token, call]);

  const add = useCallback(
    async (l: Listing) => {
      await call('/cart', { body: { listingId: l.id } });
      await reload();
    },
    [call, reload],
  );

  const remove = useCallback(
    async (listingId: string) => {
      // Optimistic: drop it right away, then confirm with the server.
      emit({ items: state.items.filter((i) => i.listing.id !== listingId) });
      await call(`/cart/${listingId}`, { method: 'DELETE' });
      await reload();
    },
    [call, reload],
  );

  const items = useMemo(
    () => (token === snapshot.token ? snapshot.items : []),
    [token, snapshot.token, snapshot.items],
  );
  const has = useCallback((id: string) => items.some((i) => i.listing.id === id), [items]);

  return { items, loaded: snapshot.loaded, add, remove, has, reload };
}
