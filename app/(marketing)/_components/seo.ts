import type { Metadata } from 'next';

/**
 * Central SEO configuration for the public marketing site.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://www.loantrack.in) so
 * canonical URLs, sitemap and Open Graph tags all resolve to the live domain.
 */
export const siteConfig = {
  name: 'LoanTrack',
  // Falls back to APP_URL, then a sensible production placeholder.
  url: (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.loantrack.in'
  ).replace(/\/$/, ''),
  tagline: 'Loan Tracking & Field Collection Software',
  description:
    'LoanTrack is all-in-one loan tracking and management software for micro-lending, auto finance, gold loans and chit funds — with GPS field collection, agent wallets, KYC and accounting. Built for Indian lenders in 6 languages.',
  twitter: '@loantrack',
  locale: 'en_IN',
};

/**
 * Site-wide keyword pool. Page-level keywords are layered on top of these.
 * These target the high-intent searches a lender would actually type.
 */
export const baseKeywords = [
  'loan tracking software',
  'loan management software',
  'loan management software India',
  'microfinance software',
  'micro lending software',
  'loan collection software',
  'daily collection software',
  'EMI collection software',
  'field collection app',
  'loan collection app with GPS',
  'NBFC software',
  'chit fund software',
  'gold loan software',
  'vehicle loan software',
  'auto finance software',
  'loan app for lenders',
  'agent collection software',
  'lending management system',
];

type BuildArgs = {
  title: string;
  description: string;
  /** Path beginning with "/" — used for canonical + OG url. */
  path: string;
  keywords?: string[];
};

/**
 * Builds a complete, consistent Metadata object for a marketing page:
 * canonical URL, keywords, Open Graph and Twitter cards, robots directives.
 */
export const OG_IMAGE = {
  url: '/og.png',
  width: 1200,
  height: 630,
  alt: 'LoanTrack — Loan Tracking & Field Collection Software',
};

export function buildMetadata({ title, description, path, keywords = [] }: BuildArgs): Metadata {
  const url = `${siteConfig.url}${path}`;
  return {
    title,
    description,
    keywords: [...keywords, ...baseKeywords],
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      url,
      title,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      site: siteConfig.twitter,
      creator: siteConfig.twitter,
      title,
      description,
      images: [OG_IMAGE.url],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
  };
}
