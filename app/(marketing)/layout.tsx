import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Navbar from './_components/Navbar';
import Footer from './_components/Footer';
import { SiteJsonLd } from './_components/JsonLd';
import { siteConfig, baseKeywords, OG_IMAGE } from './_components/seo';
import './marketing.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--mk-font',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: 'LoanTrack — Loan Tracking & Field Collection Software for Lenders',
    template: '%s · LoanTrack',
  },
  description: siteConfig.description,
  keywords: baseKeywords,
  applicationName: siteConfig.name,
  category: 'Business Software',
  alternates: { canonical: '/home' },
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    url: siteConfig.url,
    title: 'LoanTrack — Loan Tracking & Field Collection Software',
    description: siteConfig.description,
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    site: siteConfig.twitter,
    title: 'LoanTrack — Loan Tracking & Field Collection Software',
    description: siteConfig.description,
    images: [OG_IMAGE.url],
  },
  robots: { index: true, follow: true },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`mk-root ${inter.variable}`}>
      <SiteJsonLd />
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
