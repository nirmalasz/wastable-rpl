import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Review } from '@/lib/types';
import { RatingBreakdown, RatingPanel, ReviewCard, Stars } from './index';

vi.mock('@/features/auth', async () => (await import('@/test/auth')).authModule);

const review = (over: Partial<Review> = {}): Review => ({
  id: crypto.randomUUID(),
  rating: 5,
  comment: 'Masih segar, penjual ramah',
  photoUrl: null,
  createdAt: '2026-11-06T09:00:00Z',
  listingId: 'listing-1',
  listingTitle: 'Organic Bartlett Pear',
  listingPhotoUrl: null,
  reviewerId: 'buyer-1',
  reviewerName: 'Budi',
  reviewerAvatarUrl: null,
  reviewerRole: 'BUYER',
  ...over,
});

describe('Stars', () => {
  it('fills whole stars and part of the last one', () => {
    const { container } = render(<Stars value={4.3} size={20} />);
    expect(screen.getByRole('img', { name: '4.3 out of 5' })).toBeInTheDocument();
    const fills = [...container.querySelectorAll<HTMLElement>('span[style*="width"]')]
      .filter((el) => el.style.width.endsWith('%'))
      .map((el) => el.style.width);
    expect(fills.map((w) => Math.round(parseFloat(w)))).toEqual([100, 100, 100, 100, 30]);
  });
});

describe('RatingBreakdown', () => {
  it('counts reviews per star, five first', () => {
    render(
      <RatingBreakdown
        reviews={[review({ rating: 5 }), review({ rating: 5 }), review({ rating: 2 })]}
      />,
    );
    const rows = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(rows).toEqual(['5.02', '4.00', '3.00', '2.01', '1.00']);
  });
});

describe('ReviewCard', () => {
  it("labels the reviewer's role and links the reviewed product and profile", () => {
    render(<ReviewCard review={review({ reviewerRole: 'SELLER', reviewerName: 'Ani' })} />);
    expect(screen.getByText('Seller')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Organic Bartlett Pear/ })).toHaveAttribute(
      'href',
      '/listings/listing-1',
    );
    expect(screen.getByRole('link', { name: /Ani/ })).toHaveAttribute('href', '/users/buyer-1');
  });

  it('shows an attached photo only when there is one', () => {
    const { rerender } = render(<ReviewCard review={review()} />);
    expect(screen.queryByAltText(/Photo from/)).not.toBeInTheDocument();
    rerender(<ReviewCard review={review({ photoUrl: 'http://api.test/uploads/a.png' })} />);
    expect(screen.getByAltText('Photo from Budi')).toHaveAttribute(
      'src',
      'http://api.test/uploads/a.png',
    );
  });
});

describe('RatingPanel', () => {
  it('filters reviews by who wrote them', async () => {
    const user = userEvent.setup();
    render(
      <RatingPanel
        summary={{
          user: { id: 'u', name: 'Sari', avatarUrl: null },
          average: 4.5,
          total: 2,
          reviews: [
            review({ reviewerName: 'Budi', reviewerRole: 'BUYER' }),
            review({ reviewerName: 'Ani', reviewerRole: 'SELLER', rating: 4 }),
          ],
        }}
      />,
    );
    const names = () =>
      screen.getAllByRole('article').map((a) => within(a).getByRole('heading').textContent);
    expect(names()).toEqual(['Budi', 'Ani']);

    await user.click(screen.getByRole('button', { name: 'From sellers' }));
    expect(names()).toEqual(['Ani']);
    expect(screen.getByRole('button', { name: 'From sellers' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('explains an empty rating tab', () => {
    render(
      <RatingPanel
        summary={{
          user: { id: 'u', name: 'Sari', avatarUrl: null },
          average: null,
          total: 0,
          reviews: [],
        }}
      />,
    );
    expect(screen.getByText(/No reviews yet/)).toBeInTheDocument();
  });
});
