'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthInput, AuthLayout, authButton } from '@/components/auth-layout';
import { Alert } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { TERMS_VERSION } from '@/features/terms/content';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password'));
    if (password !== String(form.get('confirm'))) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreed) {
      setError('Please read and agree to the Terms & SOP first.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await register(String(form.get('name')), String(form.get('email')), password, TERMS_VERSION);
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
        <label className="flex items-start gap-3 pt-1 text-base text-ink">
          <input
            type="checkbox"
            name="terms"
            required
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 size-5 shrink-0 accent-brand-500"
          />
          <span>
            I have read and agree to the {/* New tab, so what was typed in the form is not lost. */}
            <Link href="/terms" target="_blank" className="font-semibold text-brand-700 underline">
              Terms &amp; SOP
            </Link>
            .
          </span>
        </label>
        {error && <Alert>{error}</Alert>}
        <button type="submit" disabled={busy || !agreed} className={`${authButton} mt-2`}>
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
