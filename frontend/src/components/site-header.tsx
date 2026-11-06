'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/features/auth';
import { useCart } from '@/features/cart';
import { useApi } from '@/lib/use-api';
import { Avatar } from './avatar';

/* eslint-disable @next/next/no-img-element -- static brand SVGs exported from Figma */

function useUnread() {
  const { token } = useAuth();
  const notes = useApi<{ unreadCount: number }>(token ? '/notifications' : null, token);
  const reloadNotes = notes.reload;

  useEffect(() => {
    if (!token) return;
    const timer = setInterval(reloadNotes, 30_000);
    return () => clearInterval(timer);
  }, [token, reloadNotes]);

  return notes.data?.unreadCount ?? 0;
}

function UnreadDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-urgent px-1 text-center text-xs leading-5 font-semibold text-white">
      {count}
    </span>
  );
}

function CartCount() {
  const { items } = useCart();
  if (items.length === 0) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-brand-700 px-1 text-center text-xs leading-5 font-semibold text-white">
      {items.length}
    </span>
  );
}

/** Left rail from the Figma Prototype: logo silhouette, page icons, settings and log out. */
export function SiteSidebar() {
  const { user, token, logout } = useAuth();
  const pathname = usePathname();
  const signedIn = Boolean(token);

  const item = (href: string) =>
    `relative flex h-12 w-12 items-center justify-center rounded-xl transition hover:bg-brand-50 ${
      pathname === href ? 'bg-brand-50' : ''
    }`;

  return (
    <aside className="sticky top-0 hidden h-screen w-20 shrink-0 flex-col items-center rounded-r-[14px] bg-surface py-5 shadow-[2px_3px_3px_0_rgb(0_0_0/0.25)] md:flex">
      <Link href="/" aria-label="WASTABLE home" className="mb-8">
        <img src="/brand/logo-silhouette.svg" alt="" width={66} height={44} />
      </Link>

      {signedIn && (
        <nav className="flex flex-col items-center gap-4" aria-label="Main">
          <Link href="/listings/new" className={item('/listings/new')} title="Post food">
            <img src="/icons/nav-post.svg" alt="Post food" width={34} height={34} />
          </Link>
          <Link href="/dashboard" className={item('/dashboard')} title="Dashboard">
            <img src="/icons/nav-dashboard.svg" alt="Dashboard" width={34} height={34} />
          </Link>
          <Link href="/chat" className={item('/chat')} title="Chat">
            <img src="/icons/nav-chat.svg" alt="Chat" width={32} height={32} />
          </Link>
          <Link href="/cart" className={item('/cart')} title="Cart">
            <img src="/icons/nav-cart.svg" alt="Cart" width={39} height={33} />
            <CartCount />
          </Link>
          {user?.role === 'ADMIN' && (
            <Link
              href="/admin"
              className={`${item('/admin')} font-display text-sm text-brand-700`}
              title="Moderation"
            >
              Admin
            </Link>
          )}
        </nav>
      )}

      {signedIn && (
        <div className="mt-auto flex flex-col items-center gap-3">
          <Link href="/profile" className={item('/profile')} title="Profile and settings">
            <img src="/icons/nav-settings.svg" alt="Profile and settings" width={28} height={28} />
          </Link>
          <button type="button" onClick={logout} className={item('')} title="Log out">
            <img
              src="/icons/nav-logout.svg"
              alt="Log out"
              width={28}
              height={28}
              className="rotate-90"
            />
          </button>
        </div>
      )}
    </aside>
  );
}

function SearchBar() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get('q') ?? '';
  const [q, setQ] = useState(current);
  const [synced, setSynced] = useState(current);
  // Keep the box in step when the URL changes (e.g. "Reset" on the feed).
  if (synced !== current) {
    setSynced(current);
    setQ(current);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (q.trim()) next.set('q', q.trim());
    else next.delete('q');
    const qs = next.toString();
    router.push(qs ? `/?${qs}` : '/');
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
export function SiteHeader() {
  const { user, token, logout } = useAuth();
  const pathname = usePathname();
  const unread = useUnread();
  const [open, setOpen] = useState(false);
  // Signed-in state is known once a token exists; the profile fills in a moment later.
  const signedIn = Boolean(token);
  const close = () => setOpen(false);

  const yellow =
    'shrink-0 rounded-[10px] bg-accent px-5 py-2 text-sm font-medium italic text-black shadow-button hover:brightness-95';
  const mobileLink = 'block rounded-lg px-3 py-2 text-sm hover:bg-brand-50';

  return (
    <header className="relative z-20">
      <div className="flex items-center gap-3 px-4 py-3 md:px-8">
        <Link href="/" onClick={close} className="shrink-0" aria-label="WASTABLE home">
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
            <Link
              href="/notifications"
              onClick={close}
              className="relative hidden rounded-[10px] bg-surface px-3 py-2 text-sm shadow-button hover:bg-brand-50 md:block"
            >
              Notifications
              <UnreadDot count={unread} />
            </Link>
          )}
          {signedIn ? (
            <Link
              href="/profile"
              onClick={close}
              className="flex items-center gap-2"
              title="Your profile"
            >
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
          {signedIn && (
            <button
              type="button"
              aria-label="Menu"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className="relative rounded-[10px] bg-surface px-3 py-2 text-sm shadow-button md:hidden"
            >
              {open ? 'Close' : 'Menu'}
              <UnreadDot count={unread} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-2 sm:hidden">
        <Suspense fallback={<div className="h-11 rounded-[12px] bg-surface" />}>
          <SearchBar />
        </Suspense>
      </div>

      {/* Mobile: the sidebar's links live behind the Menu button. */}
      {open && signedIn && (
        <nav
          className="absolute inset-x-4 top-full flex flex-col gap-1 rounded-[14px] bg-surface p-3 shadow-card md:hidden"
          onClick={close}
        >
          <Link href="/" className={mobileLink}>
            Browse
          </Link>
          <Link href="/listings/new" className={mobileLink}>
            Post food
          </Link>
          <Link href="/dashboard" className={mobileLink}>
            Dashboard
          </Link>
          <Link href="/chat" className={mobileLink}>
            Chat
          </Link>
          <Link href="/cart" className={mobileLink}>
            Cart
          </Link>
          <Link href="/notifications" className={mobileLink}>
            Notifications{unread > 0 && ` (${unread})`}
          </Link>
          {user?.role === 'ADMIN' && (
            <Link href="/admin" className={mobileLink}>
              Admin
            </Link>
          )}
          <Link href="/profile" className={mobileLink}>
            Profile
          </Link>
          <button type="button" onClick={logout} className={`${mobileLink} text-left`}>
            Log out
          </button>
        </nav>
      )}
    </header>
  );
}
