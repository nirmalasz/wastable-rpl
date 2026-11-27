'use client';

import Link from 'next/link';
import { Alert, EmptyState, LoadingBlock, listingGrid } from '@/components/ui';
import { ListingCard } from '@/features/listings/listing-card';
import type { Listing } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const COUNT = 10;

/**
 * "Recommended Listing" on the home page: the first available listings, urgent ones first
 * (the API's default order). No filters here; searching and filtering live on /search.
 */
export function RecommendedListings() {
  const feed = useApi<{ results: Listing[] }>(`/search?limit=${COUNT}`);

  if (feed.error) return <Alert>Could not load listings: {feed.error}</Alert>;
  if (!feed.data) return <LoadingBlock label="Loading listings…" className="min-h-64" />;
  if (feed.data.results.length === 0) {
    return (
      <EmptyState title="No food is listed right now.">
        <p>Check back soon, or be the first to share something.</p>
        <Link href="/listings/new" className="inline-block text-brand-700 underline">
          Post food
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      <div className={listingGrid}>
        {feed.data.results.map((l) => (
          <ListingCard key={l.id} listing={l} />
        ))}
      </div>
      <div className="text-center">
        <Link
          href="/search"
          className="inline-block rounded-[10px] bg-accent px-6 py-2 text-sm font-bold italic text-black shadow-button hover:brightness-95"
        >
          See all listings
        </Link>
      </div>
    </div>
  );
}
