import Link from 'next/link';
import { Suspense } from 'react';
import { ApiStatus } from '@/components/api-status';
import { Loading } from '@/components/ui';
import { Feed } from '@/features/search/feed';
import { humanize } from '@/lib/format';
import { CATEGORIES } from '@/lib/types';

/* eslint-disable @next/next/no-img-element -- static brand assets exported from Figma */

/** Produce illustration from the Figma "Food Categories" tiles (three layers, as positioned there). */
function CategoryArt() {
  return (
    <span
      aria-hidden
      className="absolute -top-[50px] left-1/2 h-[140px] w-[140px] -translate-x-1/2"
    >
      <span className="absolute top-0 left-[12px] flex h-[139px] w-[128px] items-center justify-center">
        <img
          src="/images/category/layer-1.svg"
          alt=""
          width={102}
          height={116}
          className="-rotate-[15.74deg] -skew-x-[0.81deg]"
        />
      </span>
      <img
        src="/images/category/layer-2.svg"
        alt=""
        width={55}
        height={46}
        className="absolute top-[43px] left-[37px]"
      />
      <span className="absolute top-[2px] left-0 flex h-[128px] w-[83px] items-center justify-center">
        <img
          src="/images/category/layer-3.svg"
          alt=""
          width={81}
          height={127}
          className="-rotate-[1.12deg]"
        />
      </span>
    </span>
  );
}

export default function HomePage() {
  return (
    <section className="space-y-8">
      {/* Hero: primary logo on the brand gradient, photo fading out to the bottom. */}
      <div className="relative flex min-h-56 items-center overflow-hidden rounded-[19px] bg-linear-to-b from-brand-500 to-brand-500/0 sm:aspect-[1288/528] sm:min-h-0">
        <img
          src="/images/hero.png"
          alt=""
          className="absolute inset-y-0 right-0 h-full w-auto -scale-x-100 object-cover mask-b-from-40% mask-b-to-100%"
        />
        <div className="relative w-1/2 pl-[8%]">
          <img
            src="/brand/logo-primary.svg"
            alt="WASTABLE 2026"
            width={394}
            height={264}
            className="h-auto w-full max-w-[394px]"
          />
        </div>
        <h1 className="sr-only">WASTABLE: rescue surplus food near you</h1>
      </div>

      <div className="space-y-4">
        <h2 className="text-4xl sm:text-[45px]">Food Categories</h2>
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pt-[52px] pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-7">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/?category=${c}`}
              scroll={false}
              className="relative flex h-[134px] w-36 shrink-0 flex-col items-center justify-end rounded-[23px] bg-white pb-3 shadow-[0_3px_3px_0_rgb(0_0_0/0.25)] transition hover:-translate-y-0.5 sm:w-auto"
            >
              <CategoryArt />
              <span className="text-lg font-medium capitalize">{humanize(c)}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-4xl text-black sm:text-[40px]">Recommended Listing</h2>
        <Suspense fallback={<Loading />}>
          <Feed />
        </Suspense>
      </div>

      <ApiStatus />
    </section>
  );
}
