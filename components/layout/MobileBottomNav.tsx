'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// App-like bottom tab bar for field agents on mobile. Shown only on small screens
// (CSS `.mobile-bottom-nav` is display:none until the <=768px media query) and
// only mounted for the agent role (see the dashboard layout). One tap to each of
// the agent's core screens.
export default function MobileBottomNav({
  modulePrefix,
  dict,
}: {
  modulePrefix: string;
  dict: any;
}) {
  const pathname = usePathname();

  const items = [
    { href: '/agent-dashboard', icon: 'dashboard', label: dict?.sidebar?.dashboard || 'Home' },
    { href: '/collection', icon: 'point_of_sale', label: dict?.collection?.collections || 'Collect' },
    { href: '/customers', icon: 'people', label: dict?.customers?.title || 'Customers' },
    { href: '/loans', icon: 'account_balance', label: dict?.sidebar?.loans || 'Loans' },
    { href: '/wallet', icon: 'payments', label: 'Wallet' },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Quick navigation">
      {items.map((it) => {
        const full = `${modulePrefix}${it.href}`;
        const active = pathname === full || pathname.startsWith(`${full}/`);
        return (
          <Link key={it.href} href={full} className={active ? 'active' : ''}>
            <span className="material-icons-outlined">{it.icon}</span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
