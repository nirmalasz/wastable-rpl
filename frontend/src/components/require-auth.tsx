'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from '@/features/auth';
import type { User } from '@/lib/types';
import { Loading } from './ui';

/** Renders children only for logged-in users (optionally admins), otherwise a login prompt. */
export function RequireAuth({
  children,
  admin = false,
}: {
  children: (user: User) => ReactNode;
  admin?: boolean;
}) {
  const { user, token, ready } = useAuth();
  if (!ready || (token && !user)) return <Loading />;
  if (!user) {
    return (
      <p className="text-sm">
        Please{' '}
        <Link href="/login" className="text-brand-700 underline">
          log in
        </Link>{' '}
        to continue.
      </p>
    );
  }
  if (admin && user.role !== 'ADMIN') return <p className="text-sm">Admins only.</p>;
  return <>{children(user)}</>;
}
