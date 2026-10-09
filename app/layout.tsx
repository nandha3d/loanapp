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
  metadataBase: new URL('https://zolofunds.com'),
  title: {
    default: 'Zolo Funds — Complete Lending & Microfinance OS for India',
    template: '%s | Zolo Funds',
  },
  description: 'The all-in-one lending management platform for microfinance companies, NBFCs, and financiers across India. Real-time GPS field tracking, offline mobile sync, instant WhatsApp receipts & RBI compliance.',
  applicationName: 'Zolo Funds',
  authors: [{ name: 'Zolo Funds', url: 'https://zolofunds.com' }],
  generator: 'Next.js',
  keywords: [
    'microfinance software',
    'lending management system',
    'daily collection software',
    'loan tracking software',
    'field collection app',
    'NBFC loan software',
    'micro-lending India',
    'gold loan management system',
    'auto finance software',
    'chit fund management software',
    'EMI collection app',
    'loan management software India',
    'Zolo Funds',
  ],
  creator: 'Zolo Funds',
  publisher: 'Zolo Funds',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: 'https://zolofunds.com',
  },
  openGraph: {
    title: 'Zolo Funds — Complete Lending & Microfinance OS for India',
    description: 'The all-in-one lending management platform for microfinance companies, NBFCs, and financiers across India. Real-time GPS field tracking, offline mobile sync, instant WhatsApp receipts & RBI compliance.',
    url: 'https://zolofunds.com',
    siteName: 'Zolo Funds',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'Zolo Funds — Complete Lending & Microfinance OS for India',
      },
    ],
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zolo Funds — Complete Lending & Microfinance OS for India',
    description: 'The all-in-one lending management platform for microfinance companies, NBFCs, and financiers across India. Real-time GPS field tracking, offline mobile sync, instant WhatsApp receipts & RBI compliance.',
    images: ['/og.png'],
    creator: '@zolofunds',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/assets/logo-square-light.png', media: '(prefers-color-scheme: light)' },
      { url: '/assets/logo-square-dark.png', media: '(prefers-color-scheme: dark)' },
      { url: '/assets/logo.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

// Render at real device width. This was missing, so phones rendered at desktop
// width and zoomed out. viewportFit: 'cover' lets the agent bottom-nav use the
// safe-area inset on notched phones.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#7D287E',
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

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Zolo Funds',
      applicationCategory: 'BusinessApplication, FinanceApplication',
      operatingSystem: 'Web, Android, iOS',
      description: 'India’s premier micro-lending and field collection management operating system. Designed for daily/weekly microfinance, gold loans, auto finance, and chit funds with GPS collection verification and offline sync.',
      url: 'https://zolofunds.com',
      image: 'https://zolofunds.com/og.png',
      offers: {
        '@type': 'Offer',
        price: '12000',
        priceCurrency: 'INR',
        priceValidUntil: '2027-12-31',
        availability: 'https://schema.org/InStock',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        reviewCount: '128',
        bestRating: '5',
        worstRating: '1',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Zolo Funds',
      url: 'https://zolofunds.com',
      logo: 'https://zolofunds.com/assets/logo-horizontal-for-light-bg.png',
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+91-98427-88899',
        contactType: 'Customer Support',
        areaServed: 'IN',
        availableLanguage: ['English', 'Tamil', 'Hindi', 'Telugu', 'Kannada', 'Malayalam'],
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Zolo Funds',
      url: 'https://zolofunds.com',
    },
  ];

  return (
    <html lang="en" className={inter.variable} data-theme={theme} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
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
