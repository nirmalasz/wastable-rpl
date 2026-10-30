import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AccountBanner } from '@/components/account-banner';
import { FoodSafetyDisclaimer } from '@/components/food-safety-disclaimer';
import { SiteHeader } from '@/components/site-header';
import { AuthProvider } from '@/features/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'WASTABLE',
  description: 'Buy, exchange, or give away surplus food near you.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <AuthProvider>
          <SiteHeader />
          <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8">
            <AccountBanner />
            {children}
          </main>
        </AuthProvider>
        <footer className="border-t border-slate-200">
          <div className="mx-auto max-w-5xl px-4 py-4">
            <FoodSafetyDisclaimer />
          </div>
        </footer>
      </body>
    </html>
  );
}
