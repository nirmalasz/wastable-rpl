import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CartEntry, Listing } from '@/lib/types';

// Defined with vi.hoisted so it survives vi.resetModules(): the cart and the test always
// share this one fake, even though each test reloads the cart module.
const auth = vi.hoisted(() => ({
  token: null as string | null,
  call: vi.fn<(path: string, init?: unknown) => Promise<unknown>>(),
}));
vi.mock('@/features/auth', () => ({ useAuth: () => auth }));

const listing = (id: string): Listing => ({
  id,
  sellerId: 'seller-1',
  title: `Item ${id}`,
  description: null,
  category: 'produce',
  quantity: 1,
  listingType: 'FREE',
  price: 0,
  expiryDate: '2030-01-01T00:00:00Z',
  pickupArea: 'Depok',
  isUrgent: false,
  status: 'AVAILABLE',
  dietFlags: [],
  photoUrl: null,
});
const entry = (id: string): CartEntry => ({
  addedAt: '2026-11-06T09:00:00Z',
  available: true,
  listing: listing(id),
});

/** Fresh cart module per test (it keeps module-level state) over a fake /cart API. */
async function freshCart({ signedIn = true, items = [] as CartEntry[] } = {}) {
  vi.resetModules();
  auth.call.mockReset();
  auth.token = signedIn ? 'test-token' : null;
  let server = items;
  auth.call.mockImplementation(async (path: string, init?: unknown) => {
    const opts = (init ?? {}) as { method?: string; body?: { listingId: string } };
    if (path === '/cart' && opts.body) server = [entry(opts.body.listingId), ...server];
    else if (opts.method === 'DELETE') {
      server = server.filter((e) => `/cart/${e.listing.id}` !== path);
    }
    return path === '/cart' && !opts.body ? { items: server } : { ok: true };
  });
  const { useCart } = await import('./index');
  return { useCart };
}

describe('useCart', () => {
  it('loads the cart from the API once, even with several components', async () => {
    const { useCart } = await freshCart({ items: [entry('a')] });
    const one = renderHook(() => useCart());
    renderHook(() => useCart());
    await waitFor(() => expect(one.result.current.loaded).toBe(true));
    expect(one.result.current.items.map((i) => i.listing.id)).toEqual(['a']);
    expect(auth.call.mock.calls.filter(([p, i]) => p === '/cart' && !i)).toHaveLength(1);
  });

  it('adds and removes items through the API', async () => {
    const { useCart } = await freshCart();
    const { result } = renderHook(() => useCart());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(() => result.current.add(listing('b')));
    expect(auth.call).toHaveBeenCalledWith('/cart', { body: { listingId: 'b' } });
    expect(result.current.has('b')).toBe(true);

    await act(() => result.current.remove('b'));
    expect(auth.call).toHaveBeenCalledWith('/cart/b', { method: 'DELETE' });
    expect(result.current.items).toEqual([]);
  });

  it('moves an old browser-only cart to the API once', async () => {
    localStorage.setItem('wastable.cart', JSON.stringify([{ id: 'old-1' }, { id: 'old-2' }]));
    const { useCart } = await freshCart();
    const { result } = renderHook(() => useCart());
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(localStorage.getItem('wastable.cart')).toBeNull();
  });

  it('is empty when signed out and never calls the API', async () => {
    const { useCart } = await freshCart({ signedIn: false });
    const { result } = renderHook(() => useCart());
    expect(result.current.items).toEqual([]);
    expect(auth.call).not.toHaveBeenCalled();
  });
});
