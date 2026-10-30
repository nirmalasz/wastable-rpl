'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Alert, Loading } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { api } from '@/lib/api-client';
import { useEffect, useState } from 'react';

function VerifyEmail() {
  const token = useSearchParams().get('token');
  const { refreshUser } = useAuth();
  const [state, setState] = useState<'working' | 'done' | string>('working');

  useEffect(() => {
    if (!token) return;
    api('/auth/verify-email', { body: { token } })
      .then(() => {
        setState('done');
        refreshUser();
      })
      .catch((err: Error) => setState(err.message));
  }, [token, refreshUser]);

  if (!token) return <Alert>This verification link is missing its token.</Alert>;
  if (state === 'working') return <Loading>Verifying…</Loading>;
  if (state === 'done') {
    return (
      <Alert kind="success">
        Email verified.{' '}
        <Link href="/" className="underline">
          Start browsing
        </Link>
      </Alert>
    );
  }
  return <Alert>{state}</Alert>;
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<Loading />}>
      <VerifyEmail />
    </Suspense>
  );
}
