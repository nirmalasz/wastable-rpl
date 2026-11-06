'use client';

import { Button } from '@/components/ui';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-4xl">Something went wrong</h1>
        <p className="text-sm text-muted">An unexpected error occurred. Please try again.</p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
