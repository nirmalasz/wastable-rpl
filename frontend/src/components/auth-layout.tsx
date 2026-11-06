import type { InputHTMLAttributes, ReactNode } from 'react';

/* eslint-disable @next/next/no-img-element -- static brand assets exported from Figma */

/** Two-card layout of the Figma Login/Register screens: food photo left, form card right. */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[1060px] gap-12 py-4 md:grid-cols-[488fr_525fr] md:py-12">
      <div className="hidden overflow-hidden rounded-[17px] bg-white shadow-[0_3px_3px_0_rgb(0_0_0/0.25)] md:block">
        <img src="/images/auth.jpg" alt="" className="h-full w-full object-cover" />
      </div>
      <div className="flex flex-col rounded-[17px] bg-white px-6 py-10 shadow-[0_3px_3px_0_rgb(0_0_0/0.25)] sm:px-8">
        <img
          src="/brand/wordmark-auth.svg"
          alt="WASTABLE"
          width={196}
          height={60}
          className="mx-auto mb-8"
        />
        <h1 className="sr-only">{title}</h1>
        {children}
      </div>
    </div>
  );
}

/** Large cream field with the italic placeholder used on the auth screens. */
export const AuthInput = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className="h-14 w-full rounded-[10px] bg-cream px-5 text-xl text-ink placeholder:font-medium placeholder:italic placeholder:text-black/30 focus:ring-2 focus:ring-brand-500 focus:outline-none"
  />
);

export const authButton =
  'h-14 w-full rounded-[10px] bg-accent text-2xl font-bold italic text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60';
