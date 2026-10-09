import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { FoodSafetyDisclaimer } from '@/components/food-safety-disclaimer';
import './globals.css';

export const metadata: Metadata = {
  title: 'WASTABLE',
  description: 'Buy, exchange, or give away surplus food near you.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <header className="border-b border-slate-200">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <span className="text-lg font-bold text-brand-700">WASTABLE</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-slate-200">
          <div className="mx-auto max-w-5xl px-4 py-4">
            <FoodSafetyDisclaimer />
          </div>
        </footer>
      </body>
    </html>
  );
}
