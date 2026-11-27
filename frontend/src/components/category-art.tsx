import { ProduceArt } from './produce-art';

/* eslint-disable @next/next/no-img-element -- static category illustrations */

/**
 * One illustration per food category, in frontend/public/images/category/<slug>.svg.
 * "produce" has no file on purpose: it keeps the layered produce illustration (the original
 * Figma tile art), which is also the fallback for any category added later.
 */
const ICONS: Partial<Record<string, string>> = {
  'cooked-meal': '/images/category/cooked-meal.svg',
  bakery: '/images/category/bakery.svg',
  packaged: '/images/category/packaged.svg',
  beverage: '/images/category/beverage.svg',
  dairy: '/images/category/dairy.svg',
  other: '/images/category/other.svg',
};

/** Category illustration in a 140px square; position it with `className`. */
export function CategoryArt({ category, className }: { category: string; className?: string }) {
  const src = ICONS[category];
  if (!src) return <ProduceArt className={className} />;
  return (
    <span aria-hidden className={className}>
      {/* Fixed box: an absolutely placed wrapper would otherwise shrink the image. */}
      <span className="block h-[140px] w-[140px]">
        <img
          src={src}
          alt=""
          width={140}
          height={140}
          className="block h-full w-full max-w-none object-contain p-1 drop-shadow-[0_3px_2px_rgb(0_0_0/0.15)]"
        />
      </span>
    </span>
  );
}
