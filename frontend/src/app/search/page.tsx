import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingBlock } from '@/components/ui';
import { Feed } from '@/features/search/feed';

export const metadata: Metadata = { title: 'Search · WASTABLE' };

/** Search and filter listings. The header search box and the home page categories land here. */
export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingBlock className="min-h-[60vh]" />}>
      <Feed />
    </Suspense>
  );
}
