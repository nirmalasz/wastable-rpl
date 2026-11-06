'use client';

import { useSyncExternalStore } from 'react';

/**
 * A JSON value in localStorage that React components can subscribe to. Updates are shared
 * between components and between tabs. Reads fall back to `empty` when storage is
 * unavailable or the entry is corrupt, so callers never have to guard.
 */
export function createLocalStore<T>(key: string, empty: T) {
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; value: T } = { raw: null, value: empty };

  function get(): T {
    let raw: string | null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      return empty;
    }
    if (raw !== cache.raw) {
      let value = empty;
      try {
        value = raw ? (JSON.parse(raw) as T) : empty;
      } catch {
        // Corrupt entry: treat as empty.
      }
      cache = { raw, value };
    }
    return cache.value;
  }

  function set(value: T) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable (private mode): the value just won't persist.
    }
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => e.key === key && listener();
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  }

  const useValue = () => useSyncExternalStore(subscribe, get, () => empty);

  return { get, set, useValue };
}
