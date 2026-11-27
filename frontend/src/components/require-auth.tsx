'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from '@/features/auth';
import type { User } from '@/lib/types';
import { LoadingBlock } from './ui';

/** Renders children only for logged-in users (optionally admins), otherwise a login prompt. */
export function RequireAuth({
  children,
  admin = false,
}: {
  children: (user: User) => ReactNode;
  admin?: boolean;
}) {
  const { user, token, ready } = useAuth();
  if (!ready || (token && !user)) return <LoadingBlock className="min-h-[60vh]" />;
  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-[20px] bg-white p-8 text-center shadow-card">
        <h1 className="text-3xl">Log in to continue</h1>
        <p className="text-sm text-muted">
          You need an account to post food, claim items, chat and see your dashboard.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="rounded-[10px] bg-accent px-6 py-2 text-sm font-bold italic text-black shadow-button hover:brightness-95"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="rounded-[10px] bg-cream px-6 py-2 text-sm font-medium text-ink hover:bg-sand"
          >
            Register
          </Link>
        </div>
      </div>
    );
  }
  if (admin && user.role !== 'ADMIN') return <p className="text-sm">Admins only.</p>;
  return <>{children(user)}</>;
}
