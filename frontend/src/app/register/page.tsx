'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Field, Input } from '@/components/ui';
import { useAuth } from '@/features/auth';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(undefined);
    try {
      await register(
        String(form.get('name')),
        String(form.get('email')),
        String(form.get('password')),
      );
      router.push('/');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-bold">Create your account</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Name">
          <Input name="name" required maxLength={80} autoComplete="name" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Creating…' : 'Sign up'}
        </Button>
      </form>
      <p className="text-sm">
        Already registered?{' '}
        <Link href="/login" className="text-brand-700 underline">
          Log in
        </Link>
      </p>
    </Card>
  );
}
