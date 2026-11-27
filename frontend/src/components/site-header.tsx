'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '@/features/auth';
import { useCart } from '@/features/cart';
import type { Inquiry, Transaction } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { Avatar } from './avatar';
import { BellIcon, HomeIcon } from './icons';

/* eslint-disable @next/next/no-img-element -- static brand SVGs exported from Figma */

/** Unread totals shown on the navigation. Loaded once in the app shell and passed down. */
export interface NavCounts {
  notifications: number;
  chat: number;
  cart: number;
}

/**
 * Polls the unread notification and chat counts every 30 seconds and reads the cart size.
 * Call it once (the app shell does) so the sidebar, header and mobile bar share one set of
 * requests instead of each polling the API on their own.
 */
export function useNavCounts(): NavCounts {
  const { token } = useAuth();
  const notes = useApi<{ unreadCount: number }>(token ? '/notifications' : null, token);
  const trx = useApi<{ transactions: Transaction[] }>(token ? '/transactions/mine' : null, token);
  const asks = useApi<{ inquiries: Inquiry[] }>(token ? '/inquiries/mine' : null, token);
  const cart = useCart();
  const reloadNotes = notes.reload;
  const reloadTrx = trx.reload;
  const reloadAsks = asks.reload;

  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      reloadNotes();
      reloadTrx();
      reloadAsks();
    }, 30_000);
    return () => clearInterval(timer);
  }, [token, reloadNotes, reloadTrx, reloadAsks]);

  return {
    notifications: token ? (notes.data?.unreadCount ?? 0) : 0,
    chat: token
      ? (trx.data?.transactions.reduce((n, t) => n + t.unreadCount, 0) ?? 0) +
        (asks.data?.inquiries.reduce((n, q) => n + q.unreadCount, 0) ?? 0)
      : 0,
    cart: cart.items.length,
  };
}

interface NavItem {
  href: string;
  label: string;
  /** Short label for the mobile bar. */
  short: string;
  icon: ReactNode;
  count?: keyof NavCounts;
  adminOnly?: boolean;
}

const figmaIcon = (src: string) => <img src={src} alt="" className="size-7 object-contain" />;

/** Main destinations, in the order of the Figma left rail. */
const NAV: NavItem[] = [
  {
    href: '/listings/new',
    label: 'Post food',
    short: 'Post',
    icon: figmaIcon('/icons/nav-post.svg'),
  },
  {
    href: '/dashboard',
    label: 'Dashboard',
    short: 'Dashboard',
    icon: figmaIcon('/icons/nav-dashboard.svg'),
  },
  {
    href: '/chat',
    label: 'Chat',
    short: 'Chat',
    icon: figmaIcon('/icons/nav-chat.svg'),
    count: 'chat',
  },
  {
    href: '/cart',
    label: 'Cart',
    short: 'Cart',
    icon: figmaIcon('/icons/nav-cart.svg'),
    count: 'cart',
  },
  {
    href: '/admin',
    label: 'Moderation',
    short: 'Admin',
    icon: <span className="font-display text-sm text-brand-700">Admin</span>,
    adminOnly: true,
  },
];

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

function CountDot({ count, tone = 'urgent' }: { count: number; tone?: 'urgent' | 'brand' }) {
  if (count <= 0) return null;
  return (
    <span
      className={`absolute -top-1 -right-1 min-w-5 rounded-full px-1 text-center text-xs leading-5 font-semibold text-white ${
        tone === 'urgent' ? 'bg-urgent' : 'bg-brand-700'
      }`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** Label that slides out next to a rail icon on hover or keyboard focus. */
const RailTip = ({ children }: { children: ReactNode }) => (
  <span className="pointer-events-none absolute top-1/2 left-full z-10 ml-3 hidden -translate-y-1/2 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block group-focus-visible:block">
    {children}
  </span>
);

const railItem = (active: boolean) =>
  `group relative flex size-12 items-center justify-center rounded-xl transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-500 ${
    active ? 'bg-brand-50' : ''
  }`;

/**
 * Left rail from the Figma Prototype: logo silhouette, the main pages, log out at the bottom.
 * Desktop only; phones get <MobileNav> instead. Signed-out visitors see the same icons and
 * are asked to log in when they open one.
 */
export function SiteSidebar({ counts }: { counts: NavCounts }) {
  const { user, token, logout } = useAuth();
  const pathname = usePathname();
  const items = NAV.filter((i) => !i.adminOnly || user?.role === 'ADMIN');

  return (
    <aside className="sticky top-0 z-30 hidden h-screen w-20 shrink-0 flex-col items-center rounded-r-[14px] bg-surface py-5 shadow-[2px_3px_3px_0_rgb(0_0_0/0.25)] md:flex">
      <Link href="/" aria-label="WASTABLE home" className="mb-8">
        <img src="/brand/logo-silhouette.svg" alt="" width={66} height={44} />
      </Link>

      <nav className="flex flex-col items-center gap-3" aria-label="Main">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={railItem(active)}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute top-2 bottom-2 -left-4 w-1 rounded-r bg-brand-500"
                />
              )}
              {item.icon}
              {item.count && (
                <CountDot
                  count={counts[item.count]}
                  tone={item.count === 'cart' ? 'brand' : 'urgent'}
                />
              )}
              <RailTip>{item.label}</RailTip>
            </Link>
          );
        })}
      </nav>

      {token && (
        <button
          type="button"
          onClick={logout}
          aria-label="Log out"
          className={`${railItem(false)} mt-auto`}
        >
          <img src="/icons/nav-logout.svg" alt="" className="size-7 rotate-90 object-contain" />
          <RailTip>Log out</RailTip>
        </button>
      )}
    </aside>
  );
}

/** Bottom tab bar for phones: the rail's pages plus Home, always one tap away. */
export function MobileNav({ counts }: { counts: NavCounts }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const items: NavItem[] = [
    {
      href: '/',
      label: 'Home',
      short: 'Home',
      icon: <HomeIcon size={28} className="text-brand-700" />,
    },
    ...NAV.filter((i) => !i.adminOnly || user?.role === 'ADMIN'),
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex justify-around rounded-t-[14px] bg-surface px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-[0_-2px_6px_0_rgb(0_0_0/0.18)] md:hidden"
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] leading-tight ${
              active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink'
            }`}
          >
            <span className="relative flex size-7 items-center justify-center">
              {item.icon}
              {item.count && (
                <CountDot
                  count={counts[item.count]}
                  tone={item.count === 'cart' ? 'brand' : 'urgent'}
                />
              )}
            </span>
            <span className="max-w-full truncate">{item.short}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Search box in the header. Submitting opens the search page with the typed words. */
function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const onSearchPage = pathname === '/search';
  const current = onSearchPage ? (params.get('q') ?? '') : '';
  const [q, setQ] = useState(current);
  const [synced, setSynced] = useState(current);
  // Keep the box in step when the URL changes (e.g. "Reset" on the search page).
  if (synced !== current) {
    setSynced(current);
    setQ(current);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    // On the search page the other filters stay; from anywhere else it is a fresh search.
    const next = new URLSearchParams(onSearchPage ? params.toString() : '');
    if (q.trim()) next.set('q', q.trim());
    else next.delete('q');
    const qs = next.toString();
    router.push(qs ? `/search?${qs}` : '/search');
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[12px] bg-surface px-3 shadow-button"
    >
      <img src="/icons/search.svg" alt="" width={22} height={22} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search food…"
        aria-label="Search food"
        className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-black/30 focus:outline-none"
      />
    </form>
  );
}

/** Top bar from the Figma Prototype: wordmark, search, yellow account button, avatar. */
export function SiteHeader({ unread }: { unread: number }) {
  const { user, token } = useAuth();
  const pathname = usePathname();
  // Signed-in state is known once a token exists; the profile fills in a moment later.
  const signedIn = Boolean(token);

  const yellow =
    'shrink-0 rounded-[10px] bg-accent px-5 py-2 text-sm font-medium italic text-black shadow-button hover:brightness-95';

  return (
    <header className="relative z-20">
      <div className="flex items-center gap-3 px-4 py-3 md:px-8">
        <Link href="/" className="shrink-0" aria-label="WASTABLE home">
          <img
            src="/brand/wordmark.svg"
            alt="WASTABLE"
            width={141}
            height={43}
            className="h-9 w-auto sm:h-[43px]"
          />
        </Link>

        <div className="hidden min-w-0 flex-1 sm:flex">
          <Suspense fallback={<div className="h-11 flex-1 rounded-[12px] bg-surface" />}>
            <SearchBar />
          </Suspense>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {signedIn && (
            <>
              <Link
                href="/notifications"
                className="relative hidden rounded-[10px] bg-surface px-3 py-2 text-sm shadow-button hover:bg-brand-50 md:block"
              >
                Notifications
                <CountDot count={unread} />
              </Link>
              {/* Phones: the same link as a bell, so it fits next to the avatar. */}
              <Link
                href="/notifications"
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
                className="relative flex size-11 items-center justify-center rounded-[10px] bg-surface text-brand-700 shadow-button md:hidden"
              >
                <BellIcon size={24} />
                <CountDot count={unread} />
              </Link>
            </>
          )}
          {signedIn ? (
            <Link href="/profile" className="flex items-center gap-2" title="Your profile">
              <span className="hidden max-w-32 truncate text-sm lg:inline">{user?.name}</span>
              <Avatar url={user?.avatarUrl} name={user?.name ?? '?'} size={44} />
            </Link>
          ) : pathname === '/login' ? (
            <Link href="/register" className={yellow}>
              Sign Up
            </Link>
          ) : (
            <Link href="/login" className={yellow}>
              Login
            </Link>
          )}
        </div>
      </div>

      <div className="px-4 pb-2 sm:hidden">
        <Suspense fallback={<div className="h-11 rounded-[12px] bg-surface" />}>
          <SearchBar />
        </Suspense>
      </div>
    </header>
  );
}
