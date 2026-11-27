import Link from 'next/link';
import { ApiStatus } from '@/components/api-status';
import { HeroCarousel } from '@/components/hero-carousel';
import { CategoryArt } from '@/components/category-art';
import { RecommendedListings } from '@/features/search/recommended';
import { humanize } from '@/lib/format';
import { CATEGORIES } from '@/lib/types';

export default function HomePage() {
  return (
    <section className="space-y-8">
      <h1 className="sr-only">WASTABLE: rescue surplus food near you</h1>
      <HeroCarousel />

      <div className="space-y-4">
        <h2 className="text-4xl sm:text-[45px]">Food Categories</h2>
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pt-[52px] pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-7">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/search?category=${c}`}
              className="relative flex h-[134px] w-36 shrink-0 flex-col items-center justify-end rounded-[23px] bg-white pb-3 shadow-[0_3px_3px_0_rgb(0_0_0/0.25)] transition hover:-translate-y-0.5 sm:w-auto"
            >
              <CategoryArt
                category={c}
                className="absolute -top-[50px] left-1/2 -translate-x-1/2"
              />
              <span className="text-lg font-medium capitalize">{humanize(c)}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-4xl text-black sm:text-[40px]">Recommended Listing</h2>
        <RecommendedListings />
      </div>

      {/* Setup helper for developers; visitors of the built site never see it. */}
      {process.env.NODE_ENV !== 'production' && <ApiStatus />}
    </section>
  );
}
