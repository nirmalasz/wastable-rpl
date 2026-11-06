'use client';

import type { ReactNode } from 'react';
import { Avatar } from '@/components/avatar';

export type ProfileTab = 'listing' | 'rating';

/** Header card from the Figma profile: big avatar overlapping the bottom edge. */
export function ProfileHeader({
  name,
  avatarUrl,
  subtitle,
  action,
}: {
  name: string;
  avatarUrl: string | null;
  subtitle?: ReactNode;
  /** Top-right slot, e.g. the "Edit profile" button. */
  action?: ReactNode;
}) {
  return (
    <section className="relative mb-20 rounded-[17px] bg-white px-6 pt-24 pb-6 shadow-card sm:mb-[105px] sm:px-14 sm:pt-[150px] sm:pb-8">
      <div className="flex flex-wrap items-end gap-4 sm:gap-7">
        <div className="-mb-16 rounded-full bg-white sm:-mb-[81px]">
          <span className="block sm:hidden">
            <Avatar url={avatarUrl} name={name} size={128} />
          </span>
          <span className="hidden sm:block">
            <Avatar url={avatarUrl} name={name} size={252} />
          </span>
        </div>
        <div className="min-w-0 flex-1 pb-1">
          <h1 className="truncate text-3xl leading-tight text-black sm:text-[40px]">{name}</h1>
          {subtitle && (
            <p className="truncate text-xl text-black sm:text-[34px] sm:leading-tight">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="absolute top-4 right-4 sm:top-6 sm:right-6">{action}</div>}
      </div>
    </section>
  );
}

/** "Listing   Rating" tabs; the active one gets the grey underline. */
export function ProfileTabs({
  tab,
  onChange,
}: {
  tab: ProfileTab;
  onChange: (t: ProfileTab) => void;
}) {
  return (
    <div role="tablist" className="flex justify-end gap-8 sm:gap-12">
      {(['listing', 'rating'] as const).map((t) => (
        <button
          key={t}
          role="tab"
          type="button"
          aria-selected={tab === t}
          onClick={() => onChange(t)}
          className="flex flex-col items-center font-display text-3xl text-black capitalize sm:text-[40px]"
        >
          <span className="leading-[1.65]">{t}</span>
          <span
            aria-hidden
            className={`h-3 w-[142px] max-w-full ${tab === t ? 'bg-[#b3b3b3]' : 'bg-transparent'}`}
          />
        </button>
      ))}
    </div>
  );
}

/** Responsive listing grid used on both profile pages. */
export function ListingGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-7">
      {children}
    </div>
  );
}
