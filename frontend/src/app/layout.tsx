import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Langar } from 'next/font/google';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
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
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
