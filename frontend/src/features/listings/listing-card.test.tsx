import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from '@/test/auth';
import { router } from '@/test/setup';
import type { Listing } from '@/lib/types';
import { ListingCard } from './listing-card';

vi.mock('@/features/auth', async () => (await import('@/test/auth')).authModule);

const cart = { items: [], loaded: true, has: vi.fn(() => false), add: vi.fn(), remove: vi.fn() };
vi.mock('@/features/cart', () => ({ useCart: () => cart }));

const listing: Listing = {
  id: 'listing-1',
  sellerId: 'seller-1',
  title: 'Nasi Kotak Ayam',
  description: null,
  category: 'cooked-meal',
  quantity: 5,
  listingType: 'SELL',
  price: 8000,
  expiryDate: new Date(Date.now() + 5 * 3_600_000).toISOString(),
  pickupArea: 'Depok',
  isUrgent: false,
  status: 'AVAILABLE',
  dietFlags: ['egg'],
  photoUrl: null,
};

beforeEach(() => {
  auth.signIn();
  cart.has.mockReturnValue(false);
});

describe('ListingCard', () => {
  it('shows price, title and diet warnings, linking to the listing', () => {
    render(<ListingCard listing={listing} />);
    expect(screen.getByText('Rp 8.000')).toBeInTheDocument();
    expect(screen.getByText('contains egg')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/listings/listing-1');
  });

  it('adds to and removes from the cart', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ListingCard listing={listing} />);
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(cart.add).toHaveBeenCalledWith(listing);

    cart.has.mockReturnValue(true);
    rerender(<ListingCard listing={listing} />);
    await user.click(screen.getByRole('button', { name: 'Remove from cart' }));
    expect(cart.remove).toHaveBeenCalledWith('listing-1');
  });

  it('sends signed-out visitors to the login page instead', async () => {
    auth.signOut();
    render(<ListingCard listing={listing} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(router.push).toHaveBeenCalledWith('/login');
    expect(cart.add).not.toHaveBeenCalled();
  });

  it("hides the cart button on the seller's own listing", () => {
    auth.signIn({ id: 'seller-1' });
    render(<ListingCard listing={listing} />);
    expect(screen.queryByRole('button', { name: /cart/i })).not.toBeInTheDocument();
  });

  it('shows the reason when adding fails', async () => {
    cart.add.mockRejectedValueOnce(new Error('This item is no longer available'));
    render(<ListingCard listing={listing} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This item is no longer available');
  });
});
