'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';
import { ProduceArt } from './produce-art';

/* eslint-disable @next/next/no-img-element -- static brand assets exported from Figma */

const AUTOPLAY_MS = 6000;

/** Text + call-to-action slide on a solid brand colour, with the produce illustration. */
function PromoSlide({
  tone,
  title,
  text,
  cta,
  href,
}: {
  tone: 'green' | 'yellow';
  title: string;
  text: string;
  cta: string;
  href: string;
}) {
  const green = tone === 'green';
  return (
    <div
      className={`relative flex h-full items-center overflow-hidden ${green ? 'bg-brand-700' : 'bg-accent'}`}
    >
      <div className="relative z-10 w-full space-y-2 px-[8%] sm:w-[62%] sm:space-y-4">
        <h2
          className={`text-3xl leading-tight sm:text-5xl lg:text-6xl ${green ? 'text-white' : 'text-ink'}`}
        >
          {title}
        </h2>
        <p className={`text-sm sm:text-xl ${green ? 'text-brand-50' : 'text-ink'}`}>{text}</p>
        <Link
          href={href}
          className={`inline-block rounded-[10px] px-5 py-2 text-sm font-bold italic shadow-button transition hover:brightness-95 sm:text-lg ${
            green ? 'bg-accent text-black' : 'bg-brand-700 text-white'
          }`}
        >
          {cta}
        </Link>
      </div>
      <ProduceArt className="absolute right-[4%] bottom-[18%] origin-bottom-right scale-110 opacity-40 sm:right-[12%] sm:bottom-[14%] sm:scale-[2.2] sm:opacity-100 lg:scale-[2.8]" />
    </div>
  );
}

/**
 * The slides, in order. To add, remove or reorder one, edit this list only; the arrows,
 * dots, swipe and autoplay follow its length.
 */
const SLIDES: { label: string; node: ReactNode }[] = [
  {
    label: 'WASTABLE: rescue surplus food near you',
    node: (
      // Primary logo on the brand gradient, photo fading out to the bottom (Figma hero).
      <div className="relative flex h-full items-center overflow-hidden bg-linear-to-b from-brand-500 to-brand-500/0">
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
      </div>
    ),
  },
  {
    label: 'Post your surplus food',
    node: (
      <PromoSlide
        tone="green"
        title="Got extra food?"
        text="Post it in a minute. Describe it in your own words and the AI fills in the form."
        cta="Post food"
        href="/listings/new"
      />
    ),
  },
  {
    label: 'Food that expires soon',
    node: (
      <PromoSlide
        tone="yellow"
        title="Ending soon near you"
        text="Urgent listings are often free or cheaper. Grab them before they expire."
        cta="See urgent food"
        href="/search?urgent=true"
      />
    ),
  },
];

/**
 * Sliding hero for the home page. Swipe or scroll sideways, use the arrows or the dots; it
 * also advances by itself every few seconds unless the pointer or keyboard focus is on it,
 * or the visitor asked their device for reduced motion.
 */
export function HeroCarousel() {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = SLIDES.length;

  function go(to: number) {
    const el = track.current;
    if (!el) return;
    const next = (to + count) % count;
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  }

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => {
      const el = track.current;
      if (!el || document.visibilityState !== 'visible') return;
      const current = Math.round(el.scrollLeft / el.clientWidth);
      el.scrollTo({ left: ((current + 1) % count) * el.clientWidth, behavior: 'smooth' });
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, count]);

  const arrow =
    'absolute top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-brand-700 shadow-button transition hover:bg-white sm:flex';

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative h-56 overflow-hidden rounded-[19px] sm:aspect-[1288/528] sm:h-auto"
    >
      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map((slide, i) => (
          <div
            key={slide.label}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}: ${slide.label}`}
            // Off-screen slides are skipped by the keyboard and by screen readers.
            inert={i !== index}
            className="h-full w-full shrink-0 snap-center"
          >
            {slide.node}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => go(index - 1)}
        aria-label="Previous slide"
        className={`${arrow} left-3`}
      >
        <ChevronLeftIcon size={22} />
      </button>
      <button
        type="button"
        onClick={() => go(index + 1)}
        aria-label="Next slide"
        className={`${arrow} right-3`}
      >
        <ChevronRightIcon size={22} />
      </button>

      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.label}
            type="button"
            onClick={() => go(i)}
            aria-label={`Go to slide ${i + 1}: ${slide.label}`}
            aria-current={i === index}
            // The white ring keeps the active dot visible on the dark green slide too.
            className={`h-2.5 rounded-full shadow-button ring-2 ring-white transition-all ${
              i === index ? 'w-7 bg-brand-700' : 'w-2.5 bg-white hover:bg-brand-50'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
