'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/features/auth';
import { Alert, Button } from './ui';

/** Reminds unverified or suspended users why they cannot post or claim. */
export function AccountBanner() {
  const { user, call, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  if (!user || user.status === 'ACTIVE') return null;

  if (user.status === 'SUSPENDED') {
    return (
      <Alert>
        Your account is suspended. You can browse, but not post or claim.{' '}
        <Link href="/profile" className="underline">
          Submit an appeal
        </Link>
        .
      </Alert>
    );
  }

  async function verify() {
    setBusy(true);
    try {
      const sent = await call<{ devVerificationToken?: string }>('/auth/resend-verification', {
        method: 'POST',
      });
      if (sent.devVerificationToken) {
        // Development only: the API returns the token because no email is delivered.
        await call('/auth/verify-email', { body: { token: sent.devVerificationToken } });
        refreshUser();
      } else {
        setMessage('Verification email sent. Check your inbox.');
      }
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Alert kind="info">
      <div className="flex flex-wrap items-center gap-3">
        <span>Verify your email to post, claim or report items.</span>
        <Button onClick={verify} disabled={busy}>
          {busy ? 'Working…' : 'Verify email'}
        </Button>
        {message && <span>{message}</span>}
      </div>
    </Alert>
  );
}
