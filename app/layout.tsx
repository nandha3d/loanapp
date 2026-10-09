import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import MonitorBanner from '@/components/MonitorBanner';
import AnnouncementProvider from '@/components/announcements/AnnouncementProvider';
import { withBasePath } from '@/lib/public-path';
import './globals.css';

// Self-hosted at build time by next/font — removes the render-blocking
// fonts.googleapis.com CSS chain (2 external round-trips before first paint)
// and serves the woff2 from our own origin with immutable caching.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'ZoloFund — Micro-Lending Management System',
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let theme = 'zolofunds';
  try {
    const headerList = await headers();
    const host = headerList.get('x-zolofund-host') || headerList.get('host') || '';
    if (host.toLowerCase().includes('samuraibuiness.in') || host.toLowerCase().includes('samurai')) {
      theme = 'samurai';
    }
  } catch {
    // fallback at build time
  }

  return (
    <html lang="en" className={inter.variable} data-theme={theme} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var h=window.location.host.toLowerCase();var isS=h.indexOf('samuraibuiness.in')!==-1||h.indexOf('samurai')!==-1;document.documentElement.setAttribute('data-theme',isS?'samurai':'zolofunds');}catch(e){}})();`,
          }}
        />
        <link rel="icon" href={withBasePath('/assets/logo-square-dark.png')} media="(prefers-color-scheme: dark)" />
        <link rel="icon" href={withBasePath('/assets/logo-square-light.png')} media="(prefers-color-scheme: light)" />
        <link rel="icon" href={withBasePath('/assets/logo.svg')} type="image/svg+xml" />
        <link rel="apple-touch-icon" href={withBasePath('/apple-touch-icon.png')} />
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
        <AnnouncementProvider />
        {children}
        <div id="toast-container" className="toast-container"></div>
      </body>
    </html>
  );
}
