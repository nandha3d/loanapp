'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import { Coins, Menu, Close, Arrow } from './icons';

const NAV = [
  { href: '/home', label: 'Home' },
  { href: '/products', label: 'Products' },
  { href: '/solutions', label: 'Solutions' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about-us', label: 'About Us' },
  { href: '/contact', label: 'Contact' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="mk-nav">
      <div className="mk-container mk-nav__inner">
        <Link href="/home" className="mk-brand" onClick={() => setOpen(false)} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <AppLogo variant="horizontal" theme="light" height={36} />
        </Link>

        <nav className={`mk-nav__links${open ? ' is-open' : ''}`}>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`mk-nav__link${pathname === n.href ? ' is-active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="mk-nav__cta">
          <Link href="/login" className="mk-btn mk-btn--ghost">Sign In</Link>
          <Link href="/contact" className="mk-btn mk-btn--primary">
            Request a Demo <Arrow />
          </Link>
          <button
            className="mk-nav__toggle"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <Close /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
