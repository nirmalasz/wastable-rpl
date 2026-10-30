'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Alert, Button, Card, Field, Input, Loading } from '@/components/ui';
import { api } from '@/lib/api-client';

function ResetForm() {
  const tokenParam = useSearchParams().get('token');
  const [token, setToken] = useState(tokenParam ?? '');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [done, setDone] = useState(false);

  async function requestLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email'));
    setError(undefined);
    try {
      const res = await api<{ devResetToken?: string }>('/auth/password-reset/request', {
        body: { email },
      });
      if (res.devResetToken) setToken(res.devResetToken); // dev only: no email is delivered
      setNotice(
        res.devResetToken
          ? 'Development mode: the reset token was filled in below.'
          : 'If that email exists, a reset link (valid for 10 minutes) was sent.',
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get('password'));
    setError(undefined);
    try {
      await api('/auth/password-reset/confirm', { body: { token, password } });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (done) {
    return (
      <Alert kind="success">
        Password updated.{' '}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-4">
      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="info">{notice}</Alert>}
      {!tokenParam && (
        <Card>
          <form onSubmit={requestLink} className="space-y-3">
            <h1 className="text-xl font-bold">Reset password</h1>
            <Field label="Account email">
              <Input name="email" type="email" required />
            </Field>
            <Button type="submit">Send reset link</Button>
          </form>
        </Card>
      )}
      {token && (
        <Card>
          <form onSubmit={confirm} className="space-y-3">
            <h2 className="font-bold">Choose a new password</h2>
            <Field label="New password" hint="At least 8 characters.">
              <Input name="password" type="password" required minLength={8} />
            </Field>
            <Button type="submit">Update password</Button>
          </form>
        </Card>
      )}
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ResetForm />
    </Suspense>
  );
}
