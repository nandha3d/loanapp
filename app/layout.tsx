import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import MonitorBanner from '@/components/MonitorBanner';
import { withBasePath } from '@/lib/public-path';
import './globals.css';

// Self-hosted at build time by next/font — removes the render-blocking
// fonts.googleapis.com CSS chain (2 external round-trips before first paint)
// and serves the woff2 from our own origin with immutable caching.
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'LoanTrack — Micro-Lending Management System',
  description: 'Complete micro-lending management platform with customer onboarding, loan tracking, collection management, and penalty engine.',
};

// Render at real device width. This was missing, so phones rendered at desktop
// width and zoomed out. viewportFit: 'cover' lets the agent bottom-nav use the
// safe-area inset on notched phones.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" href={withBasePath('/assets/logo.svg')} />
        <link
          rel="preload"
          href={withBasePath('/fonts/MaterialIconsOutlined-Regular.woff2')}
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body suppressHydrationWarning>
        <MonitorBanner />
        {children}
        <div id="toast-container" className="toast-container"></div>
      </body>
    </html>
  );
}
