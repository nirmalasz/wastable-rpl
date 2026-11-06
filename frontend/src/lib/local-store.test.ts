import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createLocalStore } from './local-store';

describe('createLocalStore', () => {
  it('reads, writes and notifies subscribed components', () => {
    const store = createLocalStore<string[]>('test.items', []);
    const { result } = renderHook(() => store.useValue());
    expect(result.current).toEqual([]);

    act(() => store.set(['a', 'b']));
    expect(result.current).toEqual(['a', 'b']);
    expect(JSON.parse(localStorage.getItem('test.items') ?? 'null')).toEqual(['a', 'b']);
  });

  it('returns the same object until the stored value changes (stable for React)', () => {
    const store = createLocalStore('test.stable', { n: 0 });
    store.set({ n: 1 });
    expect(store.get()).toBe(store.get());
  });

  it('falls back to the empty value for corrupt entries', () => {
    localStorage.setItem('test.corrupt', '{not json');
    const store = createLocalStore('test.corrupt', { ok: true });
    expect(store.get()).toEqual({ ok: true });
  });
});
