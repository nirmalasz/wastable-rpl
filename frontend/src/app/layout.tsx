import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Langar } from 'next/font/google';
import type { ReactNode } from 'react';
import { AccountBanner } from '@/components/account-banner';
import { FoodSafetyDisclaimer } from '@/components/food-safety-disclaimer';
import { SiteHeader, SiteSidebar } from '@/components/site-header';
import { AuthProvider } from '@/features/auth';
import './globals.css';

// Brand typography: Langar for headings, Be Vietnam for body text.
const langar = Langar({ weight: '400', subsets: ['latin'], variable: '--font-langar' });
const beVietnam = Be_Vietnam_Pro({
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin', 'vietnamese'],
  variable: '--font-be-vietnam',
});

export const metadata: Metadata = {
  title: 'WASTABLE',
  description: 'Buy, exchange, or give away surplus food near you.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${langar.variable} ${beVietnam.variable}`}>
      <body className="min-h-screen">
        <AuthProvider>
          <div className="flex min-h-screen">
            <SiteSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <SiteHeader />
              <main className="mx-auto w-full max-w-[1320px] flex-1 space-y-4 px-4 pt-2 pb-8 md:px-8">
                <AccountBanner />
                {children}
              </main>
              <footer className="border-t border-sand">
                <div className="mx-auto max-w-[1320px] px-4 py-4 md:px-8">
                  <FoodSafetyDisclaimer />
                </div>
              </footer>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
