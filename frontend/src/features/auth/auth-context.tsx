'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api-client';
import type { User } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const STORAGE_KEY = 'wastable_token';
const listeners = new Set<() => void>();

const readToken = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable (private mode): session just will not persist
  }
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
};
const noopSubscribe = () => () => {};

interface AuthResponse {
  token: string;
  user: User;
  devVerificationToken?: string;
}

interface AuthContextValue {
  token: string | null;
  user: User | null;
  /** False during server render and the first client render. */
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<AuthResponse>;
  logout: () => void;
  refreshUser: () => void;
  /** Authenticated API call. */
  call: <T>(path: string, init?: Parameters<typeof api>[1]) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(subscribe, readToken, () => null);
  const ready = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const me = useApi<{ user: User }>(token ? '/users/me' : null, token);

  // An expired or revoked token surfaces as an error on /users/me: drop it.
  const stale = Boolean(token && me.error && /token|account/i.test(me.error));
  const user = token && !stale ? (me.data?.user ?? null) : null;
  useEffect(() => {
    if (stale) writeToken(null);
  }, [stale]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<AuthResponse>('/auth/login', { body: { email, password } });
    writeToken(res.token);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api<AuthResponse>('/auth/register', { body: { name, email, password } });
    writeToken(res.token);
    return res;
  }, []);

  const call = useCallback(
    <T,>(path: string, init: Parameters<typeof api>[1] = {}) =>
      api<T>(path, { ...init, token: token ?? undefined }),
    [token],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      ready,
      login,
      register,
      logout: () => writeToken(null),
      refreshUser: me.reload,
      call,
    }),
    [token, user, ready, login, register, me.reload, call],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
