'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { getAppConfig } from '@/lib/appConfig';

interface NavItem {
  section?: string;
  id?: string;
  icon?: string;
  label?: string;
  href?: string;
  adminOnly?: boolean;
  developerOnly?: boolean;  // only visible to developer role
  superadminOnly?: boolean; // only visible to superadmin role
  appTypes?: string[]; // if set, only show for these appTypes
}

const navItems: NavItem[] = [
  { section: 'Main' },
  { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', href: '/dashboard', adminOnly: true },
  { id: 'collection', icon: 'point_of_sale', label: 'Collection Entry', href: '/collection' },
  { section: 'Management' },
  { id: 'customers', icon: 'people', label: 'Customers', href: '/customers' },
  { id: 'loans', icon: 'account_balance', label: 'Loans', href: '/loans', adminOnly: true },
  { id: 'vehicles', icon: 'directions_car', label: 'Vehicles', href: '/vehicles', adminOnly: true, appTypes: ['autofinance'] },
  { id: 'chits', icon: 'savings', label: 'Chit Groups', href: '/chits', adminOnly: true, appTypes: ['chitfunds'] },
  { id: 'penalties', icon: 'gavel', label: 'Penalties', href: '/penalties', adminOnly: true },
  { id: 'approvals', icon: 'verified', label: 'Approvals', href: '/approvals' },
  { section: 'Insights' },
  { id: 'reports', icon: 'bar_chart', label: 'Reports', href: '/reports', adminOnly: true },
  { id: 'notifications', icon: 'notifications', label: 'Notifications', href: '/notifications' },
  { id: 'settings', icon: 'settings', label: 'Settings', href: '/settings', adminOnly: true },
  { section: 'Account' },
  { id: 'subscription', icon: 'credit_card', label: 'My Subscription', href: '/subscription', superadminOnly: true },
  { id: 'billing', icon: 'manage_accounts', label: 'Billing & Subscriptions', href: '/admin/billing', developerOnly: true },
];

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function getRoleName(role: string): string {
  const map: Record<string, string> = {
    superadmin: 'Super Admin',
    admin: 'Administrator',
    agent: 'Field Agent',
    borrower: 'Borrower',
  };
  return map[role] || role;
}

export default function Sidebar({ appType: initialAppType }: { appType?: string }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  const role = (session?.user as any)?.role || 'agent';
  const userAppType = initialAppType || (session?.user as any)?.appType || 'microlending';
  const userName = session?.user?.name || 'User';

  // Get app config for branding
  const appConfig = getAppConfig(userAppType);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const filteredNav = navItems.filter(item => {
    if (item.section) return false; // sections evaluated separately below
    if (item.adminOnly && role !== 'admin' && role !== 'superadmin' && role !== 'developer') return false;
    if (item.developerOnly && role !== 'developer') return false;
    if (item.superadminOnly && role !== 'superadmin') return false;
    if (item.appTypes && !item.appTypes.includes(userAppType)) return false;
    return true;
  });

  // Build final nav list preserving sections only when they have visible children
  const navWithSections: NavItem[] = [];
  let currentSectionItems: NavItem[] = [];
  let currentSection: NavItem | null = null;

  for (const item of navItems) {
    if (item.section) {
      if (currentSection && currentSectionItems.length > 0) {
        navWithSections.push(currentSection, ...currentSectionItems);
      }
      currentSection = item;
      currentSectionItems = [];
    } else if (filteredNav.includes(item)) {
      currentSectionItems.push(item);
    }
  }
  if (currentSection && currentSectionItems.length > 0) {
    navWithSections.push(currentSection, ...currentSectionItems);
  }

  // Determine active page
  const getActiveId = () => {
    for (const item of navItems) {
      if (item.href && pathname.startsWith(item.href)) {
        return item.id;
      }
    }
    return '';
  };

  const activeId = getActiveId();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
            zIndex: 45, display: 'block',
          }}
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`} id="sidebar"
        style={{ '--primary': appConfig.primaryColor, '--primary-dark': appConfig.primaryDark } as React.CSSProperties}
      >
        <div className="sidebar-brand">
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: appConfig.primaryColor, display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span className="material-icons-outlined" style={{ color: '#fff', fontSize: '20px' }}>{appConfig.icon}</span>
          </div>
          <h2>{appConfig.logoText[0]}<span>{appConfig.logoText[1]}</span></h2>
        </div>

        <nav className="sidebar-nav">
          {navWithSections.map((item, idx) => {
            if (item.section) {
              return <div key={`section-${idx}`} className="nav-section">{item.section}</div>;
            }
            return (
              <Link
                key={item.id}
                href={item.href || '#'}
                className={activeId === item.id ? 'active' : ''}
              >
                <span className="material-icons-outlined">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="avatar">{getInitials(userName)}</div>
            <div>
              <div className="user-name">{userName}</div>
              <div className="user-role">{getRoleName(role)}</div>
            </div>
          </div>
          {role === 'superadmin' && (
            <Link href="/portal" style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 12px', margin: '8px 12px 0',
              borderRadius: 'var(--radius-sm)', fontSize: '.78rem',
              color: 'rgba(255,255,255,.7)', background: 'rgba(255,255,255,.08)',
              textDecoration: 'none',
            }}>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>apps</span>
              Switch Application
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
