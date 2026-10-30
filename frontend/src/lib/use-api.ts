'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './api-client';

interface Settled<T> {
  key: string;
  data?: T;
  error?: string;
}

/**
 * GET helper for client components. Pass `null` as the path to skip the request.
 * Keeps the previous data while reloading, so lists do not flash empty.
 */
export function useApi<T>(path: string | null, token?: string | null) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Settled<T>>();
  const key = `${path}|${token ?? ''}|${version}`;

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api<T>(path, { token: token ?? undefined })
      .then((data) => !cancelled && setResult({ key, data }))
      .catch((err: Error) => !cancelled && setResult({ key, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [key, path, token]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const settled = result?.key === key;
  return {
    data: result?.data,
    error: settled ? result?.error : undefined,
    loading: Boolean(path) && !settled,
    reload,
  };
}
