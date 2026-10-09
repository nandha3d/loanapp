import type { Metadata } from 'next';
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Zolo Funds — Complete Lending & Microfinance OS for India',
  description:
    'The all-in-one lending management platform for microfinance companies, auto finance firms, and chit fund operators. Field collections with GPS proof, RBI compliance, CRIF/CIBIL credit checks, and cross-platform apps.',
  keywords: [
    'microfinance software',
    'loan management software',
    'field collection app',
    'chit fund software',
    'auto finance software',
    'gold loan software',
    'GPS collection tracking',
  ],
};

export default function ZoloFundsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${outfit.variable} ${plusJakarta.variable}`}>
      {children}
    </div>
  );
}
