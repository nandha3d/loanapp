import type { Metadata } from 'next';
import MonitorBanner from '@/components/MonitorBanner';
import './globals.css';

export const metadata: Metadata = {
  title: 'LoanTrack — Micro-Lending Management System',
  description: 'Complete micro-lending management platform with customer onboarding, loan tracking, collection management, and penalty engine.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/assets/logo.svg" />
      </head>
      <body suppressHydrationWarning>
        <MonitorBanner />
        {children}
        <div id="toast-container" className="toast-container"></div>
      </body>
    </html>
  );
}
