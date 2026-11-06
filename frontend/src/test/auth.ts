import { vi } from 'vitest';
import type { User } from '@/lib/types';

/**
 * A controllable stand-in for useAuth(). In a test file:
 *
 *   vi.mock('@/features/auth', async () => (await import('@/test/auth')).authModule);
 *   auth.signIn();            // or auth.signOut()
 *   auth.call.mockResolvedValueOnce({ ... });
 */
export const testUser: User = {
  id: 'user-1',
  name: 'Sari Wulandari',
  email: 'sari@example.com',
  role: 'USER',
  status: 'ACTIVE',
  isVerified: true,
  violationCount: 0,
  locationRadiusKm: 3,
  contactPreference: 'WA 0812 0000 0000',
  avatarUrl: null,
  homeLat: null,
  homeLng: null,
};

export const auth = {
  token: null as string | null,
  user: null as User | null,
  ready: true,
  call: vi.fn<(path: string, init?: unknown) => Promise<unknown>>(),
  refreshUser: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  signIn(user: Partial<User> = {}) {
    this.token = 'test-token';
    this.user = { ...testUser, ...user };
  },
  signOut() {
    this.token = null;
    this.user = null;
  },
};

export const authModule = {
  useAuth: () => auth,
  AuthProvider: ({ children }: { children: unknown }) => children,
};
