'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthInput, AuthLayout, authButton } from '@/components/auth-layout';
import { Alert } from '@/components/ui';
import { useAuth } from '@/features/auth';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password'));
    if (password !== String(form.get('confirm'))) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await register(String(form.get('name')), String(form.get('email')), password);
      router.push('/');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Create your account">
      <form onSubmit={onSubmit} className="space-y-4">
        <AuthInput
          name="name"
          required
          maxLength={80}
          autoComplete="name"
          placeholder="name"
          aria-label="Name"
        />
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
          minLength={8}
          autoComplete="new-password"
          placeholder="password"
          aria-label="Password (at least 8 characters)"
        />
        <AuthInput
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="confirm password"
          aria-label="Confirm password"
        />
        {error && <Alert>{error}</Alert>}
        <button type="submit" disabled={busy} className={`${authButton} mt-2`}>
          {busy ? 'Creating…' : 'Register'}
        </button>
      </form>
      <p className="mt-6 text-right text-lg italic">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold hover:underline">
          Login
        </Link>
      </p>
    </AuthLayout>
  );
}
