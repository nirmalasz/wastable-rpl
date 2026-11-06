import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { createElement, type AnchorHTMLAttributes } from 'react';
import { afterEach, vi } from 'vitest';

/**
 * Shared test setup: DOM matchers, cleanup between tests, and stand-ins for the parts of
 * Next.js that need a running app router. Tests control navigation through `router`.
 */
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// next/link needs the app router context; a plain anchor is enough for unit tests.
vi.mock('next/link', () => ({
  default: ({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    createElement('a', { href, ...rest }),
}));

// jsdom has no <dialog> modal methods yet.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}
