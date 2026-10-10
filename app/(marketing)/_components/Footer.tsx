import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import { Twitter, LinkedIn, Mail } from './icons';

const COLS = [
  {
    title: 'Lending Verticals',
    links: [
      { href: '/products', label: 'Micro Lending & Daily Collection' },
      { href: '/products', label: 'Auto & Vehicle Finance' },
      { href: '/products', label: 'Gold Loan Vault' },
      { href: '/products', label: 'Chit Fund Operations' },
      { href: '/pricing', label: 'Subscription Pricing' },
    ],
  },
  {
    title: 'Platform Features',
    links: [
      { href: '/solutions', label: 'GPS Geofenced Field Sync' },
      { href: '/solutions', label: 'Customer KYC & Aadhaar OTP' },
      { href: '/solutions', label: 'Automated RBI NPA Buckets' },
      { href: '/solutions', label: 'CRIF & CIBIL Bureau Checks' },
      { href: '/contact', label: 'Schedule Live Demo' },
    ],
  },
  {
    title: 'Legal & Policies',
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
      { href: '/refund', label: 'Cancellation & Refund' },
      { href: '/security', label: 'Security & Architecture' },
      { href: '/delete-account', label: 'Request Data Deletion' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mk-footer">
      <div className="mk-container">
        <div className="mk-footer__top">
          <div className="mk-footer__brand">
            <div className="mk-brand" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <AppLogo variant="horizontal" theme="dark" height={36} />
            </div>
            <p>
              The modern field-collection and loan-management platform for India&apos;s
              micro-lenders, NBFCs and chit-fund operators — GPS collection, multi-module
              lending and full accounting in one place.
            </p>
            <div className="mk-footer__social">
              <a href="#" aria-label="Twitter"><Twitter /></a>
              <a href="#" aria-label="LinkedIn"><LinkedIn /></a>
              <a href="/contact" aria-label="Email"><Mail /></a>
            </div>
          </div>

          {COLS.map((col) => (
            <div className="mk-footer__col" key={col.title}>
              <h4>{col.title}</h4>
              {col.links.map((l, i) => (
                <Link key={`${l.label}-${i}`} href={l.href}>{l.label}</Link>
              ))}
            </div>
          ))}
        </div>

        <div className="mk-footer__bottom">
          <span>© {new Date().getFullYear()} Zolo Funds (India) Technologies Private Limited. All rights reserved.</span>
          <span style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/refund">Refund Policy</Link>
            <Link href="/security">Security</Link>
            <Link href="/delete-account">Data Deletion</Link>
            <Link href="/login">Staff Login</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
