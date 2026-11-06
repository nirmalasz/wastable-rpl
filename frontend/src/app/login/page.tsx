'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthInput, AuthLayout, authButton } from '@/components/auth-layout';
import { Alert } from '@/components/ui';
import { useAuth } from '@/features/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(undefined);
    try {
      await login(String(form.get('email')), String(form.get('password')));
      router.push('/');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Log in">
      <form onSubmit={onSubmit} className="space-y-4">
        <AuthInput
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="email"
          aria-label="Email"
        />
        <AuthInput
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="password"
          aria-label="Password"
        />
        {error && <Alert>{error}</Alert>}
        <button type="submit" disabled={busy} className={`${authButton} mt-2`}>
          {busy ? 'Logging in…' : 'Login'}
        </button>
      </form>
      <div className="mt-6 space-y-2 text-center text-lg italic">
        <p>
          Don’t have an account?{' '}
          <Link href="/register" className="font-semibold hover:underline">
            Register
          </Link>
        </p>
        <p className="text-base">
          <Link href="/reset" className="text-brand-700 hover:underline">
            Forgot password?
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
