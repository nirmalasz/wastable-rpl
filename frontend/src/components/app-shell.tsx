'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AccountBanner } from './account-banner';
import { FoodSafetyDisclaimer } from './food-safety-disclaimer';
import { MobileNav, SiteHeader, SiteSidebar, useNavCounts } from './site-header';

/** Sign-in and reading pages: no left rail or bottom bar, just the header and the page. */
const BARE_PATHS = ['/login', '/register', '/reset', '/verify', '/terms'];

const isBare = (pathname: string) =>
  BARE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** Page frame shared by every route: navigation, header, content column and footer. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = isBare(pathname);
  const counts = useNavCounts();

  return (
    <div className="flex min-h-screen">
      {!bare && <SiteSidebar counts={counts} />}
      {/* The bottom padding keeps the footer clear of the mobile tab bar. */}
      <div className={`flex min-w-0 flex-1 flex-col ${bare ? '' : 'pb-16 md:pb-0'}`}>
        <SiteHeader unread={counts.notifications} />
        <main className="mx-auto w-full max-w-[1320px] flex-1 space-y-4 px-4 pt-2 pb-8 md:px-8">
          <AccountBanner />
          {children}
        </main>
        <footer className="border-t border-sand">
          <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 md:px-8">
            <FoodSafetyDisclaimer />
            <Link href="/terms" className="text-xs text-brand-700 underline">
              Terms &amp; SOP
            </Link>
          </div>
        </footer>
      </div>
      {!bare && <MobileNav counts={counts} />}
    </div>
  );
}
