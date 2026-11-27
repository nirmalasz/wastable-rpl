/* eslint-disable @next/next/no-img-element -- static illustration layers exported from Figma */

/**
 * Produce illustration from the Figma "Food Categories" tiles (three layers, positioned as
 * drawn there on a 140px square). Place it with `className`; scale it with a CSS transform.
 */
export function ProduceArt({ className }: { className?: string }) {
  return (
    <span aria-hidden className={className}>
      <span className="relative block h-[140px] w-[140px]">
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
    </span>
  );
}
