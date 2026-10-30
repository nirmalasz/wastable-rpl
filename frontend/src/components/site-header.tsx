'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth';
import { useApi } from '@/lib/use-api';
import { Avatar } from './avatar';

export function SiteHeader() {
  const { user, token, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const notes = useApi<{ unreadCount: number }>(token ? '/notifications' : null, token);
  const reloadNotes = notes.reload;

  useEffect(() => {
    if (!token) return;
    const timer = setInterval(reloadNotes, 30_000);
    return () => clearInterval(timer);
  }, [token, reloadNotes]);

  const unread = notes.data?.unreadCount ?? 0;
  const link = 'block py-2 text-sm text-slate-700 hover:text-brand-700 md:py-0';
  const close = () => setOpen(false);
  // Signed-in state is known once a token exists; the profile fills in a moment later.
  const signedIn = Boolean(token);

  return (
    <header className="relative border-b border-slate-200">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-brand-700" onClick={close}>
          WASTABLE
        </Link>

        {/* Page links: inline on desktop, a dropdown behind the Menu button on mobile. */}
        <nav
          className={`${open ? 'flex' : 'hidden'} absolute inset-x-0 top-full z-10 flex-col gap-1 border-b border-slate-200 bg-white px-4 py-3 shadow-sm md:static md:ml-4 md:flex md:flex-1 md:flex-row md:items-center md:gap-4 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
          onClick={close}
        >
          <Link href="/" className={link}>
            Browse
          </Link>
          {signedIn && (
            <>
              <Link href="/listings/new" className={link}>
                Post food
              </Link>
              <Link href="/dashboard" className={link}>
                Dashboard
              </Link>
              {user?.role === 'ADMIN' && (
                <Link href="/admin" className={link}>
                  Admin
                </Link>
              )}
              <Link href="/notifications" className={link}>
                Notifications
                {unread > 0 && (
                  <span className="ml-1 rounded-full bg-urgent px-1.5 text-xs text-white">
                    {unread}
                  </span>
                )}
              </Link>
            </>
          )}
        </nav>

        {/* Account actions: always visible, never hidden in the menu. */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {signedIn ? (
            <>
              {unread > 0 && (
                <Link
                  href="/notifications"
                  aria-label={`${unread} unread notifications`}
                  className="rounded-full bg-urgent px-2 text-xs text-white md:hidden"
                >
                  {unread}
                </Link>
              )}
              <Link href="/profile" className="flex items-center gap-2 text-sm" onClick={close}>
                <Avatar url={user?.avatarUrl} name={user?.name ?? '?'} size={28} />
                <span className="hidden max-w-32 truncate sm:inline">{user?.name}</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  close();
                  logout();
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500"
              >
                Sign up
              </Link>
            </>
          )}
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm md:hidden"
          >
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
      </div>
    </header>
  );
}
