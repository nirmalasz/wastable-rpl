'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

type Health = { status: string; time: string };
type State =
  { kind: 'loading' } | { kind: 'ok'; data: Health } | { kind: 'error'; message: string };

/** Shows whether the Express API is reachable. Useful while setting up the project. */
export function ApiStatus() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    api<Health>('/health')
      .then((data) => setState({ kind: 'ok', data }))
      .catch((err: Error) => setState({ kind: 'error', message: err.message }));
  }, []);

  return (
    <div className="rounded-[14px] border border-sand bg-surface p-4 text-sm">
      <span className="font-medium">API status: </span>
      {state.kind === 'loading' && <span className="text-muted">checking…</span>}
      {state.kind === 'ok' && (
        <span className="text-brand-700">connected ({state.data.status})</span>
      )}
      {state.kind === 'error' && (
        <span className="text-danger">unreachable – is the backend running? ({state.message})</span>
      )}
    </div>
  );
}
