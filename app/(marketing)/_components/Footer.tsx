import Link from 'next/link';
import { Coins, Twitter, LinkedIn, Mail } from './icons';

const COLS = [
  {
    title: 'Product',
    links: [
      { href: '/products', label: 'Micro Lending' },
      { href: '/products', label: 'Auto Finance' },
      { href: '/products', label: 'Gold Loan' },
      { href: '/products', label: 'Chit Funds' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about-us', label: 'About Us' },
      { href: '/solutions', label: 'Solutions' },
      { href: '/contact', label: 'Contact' },
      { href: '/login', label: 'Sign In' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/contact', label: 'Request a Demo' },
      { href: '/contact', label: 'Support' },
      { href: '/solutions', label: 'For NBFCs' },
      { href: '/solutions', label: 'For Chit Companies' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mk-footer">
      <div className="mk-container">
        <div className="mk-footer__top">
          <div className="mk-footer__brand">
            <div className="mk-brand">
              <span className="mk-brand__mark"><Coins /></span>
              Loan<b>Track</b>
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
          <span>© {new Date().getFullYear()} ZoloFund. All rights reserved.</span>
          <span style={{ display: 'flex', gap: 20 }}>
            <Link href="/contact">Privacy Policy</Link>
            <Link href="/contact">Terms of Use</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
