'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getAppConfig } from '@/lib/appConfig';
import { MODULE_ROUTES, parseModulePath, prefixDashboardHref, type ModuleKey } from '@/types/modules';

interface NavItem {
  section?: string;
  id?: string;
  icon?: string;
  label?: string;
  href?: string;
  adminOnly?: boolean;
  agentOnly?: boolean;
  developerOnly?: boolean;
  superadminOnly?: boolean;
  appTypes?: string[];
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Sidebar({
  appType: initialAppType,
  enabledModules = ['microlending'],
  dict,
  role,
  userName,
  modulePrefix,
  subscription,
}: {
  appType?: string;
  enabledModules?: string[];
  dict: any;
  role: string;
  userName: string;
  modulePrefix?: string;
  subscription?: {
    gpsTrackingEnabled?: boolean;
    kycEnabled?: boolean;
    premiumAccountingEnabled?: boolean;
  } | null;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  function getRoleName(role: string): string {
    return (dict.roles as any)[role] || role;
  }

  const userAppType = initialAppType || 'microlending';
  const hrefModule = modulePrefix?.replace(/^\//, '') || userAppType;
  const currentPage = parseModulePath(pathname).page;

  const navItems: NavItem[] = [
    { section: dict.sidebar.sections.main },
    { id: 'agent-dashboard', icon: 'dashboard', label: dict.sidebar.dashboard, href: '/agent-dashboard', agentOnly: true, appTypes: ['microlending', 'autofinance', 'goldloan'] },
    { id: 'dashboard', icon: 'dashboard', label: dict.sidebar.dashboard, href: '/dashboard', adminOnly: true, appTypes: ['microlending', 'autofinance', 'goldloan'] },
    { id: 'collection', icon: 'point_of_sale', label: dict.sidebar.collection, href: '/collection' },
    { id: 'collection-runs', icon: 'route', label: 'Collection Runs', href: '/collection/runs', appTypes: ['microlending', 'autofinance', 'goldloan'] },
    { id: 'self-pay', icon: 'qr_code_2', label: 'Self-Pay', href: '/collection/self-pay', appTypes: ['microlending', 'autofinance', 'goldloan'] },
    { id: 'route-tracker', icon: 'map', label: dict.sidebar.routeTracker, href: '/route-tracker', adminOnly: true, appTypes: ['microlending', 'autofinance', 'goldloan'] },
    { section: dict.sidebar.sections.management },
    { id: 'customers', icon: 'people', label: dict.sidebar.customers, href: '/customers' },
    { id: 'loans', icon: 'account_balance', label: dict.sidebar.loans, href: '/loans', adminOnly: true, appTypes: ['microlending', 'autofinance', 'goldloan'] },
    { id: 'vehicles', icon: 'directions_car', label: dict.sidebar.vehicles, href: '/vehicles', adminOnly: true, appTypes: ['autofinance'] },
    { id: 'chits', icon: 'savings', label: dict.sidebar.chits, href: '/chits', adminOnly: true, appTypes: ['chitfunds'] },
    { id: 'penalties', icon: 'gavel', label: dict.sidebar.penalties, href: '/penalties', adminOnly: true, appTypes: ['microlending', 'autofinance', 'goldloan'] },
    { id: 'approvals', icon: 'verified', label: dict.sidebar.approvals, href: '/approvals', appTypes: ['microlending', 'autofinance', 'goldloan'] },
    { id: 'kyc-review', icon: 'rate_review', label: dict.sidebar.kycReview, href: '/kyc-review', adminOnly: true, appTypes: ['microlending', 'autofinance', 'goldloan'] },
    { id: 'accounting', icon: 'account_balance_wallet', label: dict.sidebar.accounting, href: '/accounting', adminOnly: true, appTypes: ['microlending', 'autofinance', 'goldloan'] },
    { id: 'wallet', icon: 'payments', label: (dict.sidebar as any).wallet || 'Cash Float', href: '/wallet', adminOnly: true, appTypes: ['microlending', 'autofinance', 'goldloan'] },
    { section: dict.sidebar.sections.insights },
    { id: 'analytics', icon: 'insights', label: dict.sidebar.analytics, href: '/analytics', adminOnly: true, appTypes: ['microlending', 'autofinance', 'goldloan'] },
    { id: 'notifications', icon: 'notifications', label: dict.sidebar.notifications, href: '/notifications' },
    { id: 'settings', icon: 'settings', label: dict.sidebar.settings, href: '/settings', adminOnly: true },
    { section: dict.sidebar.sections.account },
    { id: 'branch-requests', icon: 'account_tree', label: dict.sidebar.branchRequests, href: '/branch-requests', superadminOnly: true },
    { id: 'subscription', icon: 'credit_card', label: dict.sidebar.subscription, href: '/subscription', superadminOnly: true },
    { id: 'affiliate', icon: 'handshake', label: dict.sidebar.affiliate || 'Affiliate Program', href: '/affiliate', superadminOnly: true },
    { id: 'billing', icon: 'manage_accounts', label: dict.sidebar.billing, href: '/admin/billing', developerOnly: true },
  ];

  // Get app config for branding
  const appConfig = getAppConfig(userAppType);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsOpen(false);
    document.getElementById('sidebar')?.classList.remove('open');
  }, [pathname]);

  const filteredNav = navItems.filter(item => {
    if (item.section) return false; // sections evaluated separately below
    if (item.adminOnly && role !== 'admin' && role !== 'superadmin' && role !== 'developer') return false;
    if (item.agentOnly && role !== 'agent') return false;
    if (item.developerOnly && role !== 'developer') return false;
    if (item.superadminOnly && role !== 'superadmin') return false;
    
    // Filter strictly by the current user's active app context
    if (item.appTypes && !item.appTypes.includes(userAppType)) return false;

    // Subscription-gated modules check
    if (item.id === 'route-tracker' && !subscription?.gpsTrackingEnabled) return false;
    if (item.id === 'kyc-review' && !subscription?.kycEnabled) return false;

    // Check if the route is enabled for the active app module
    if (item.href) {
      const alwaysVisible = ['/dashboard', '/agent-dashboard', '/collection', '/approvals', '/settings', '/notifications', '/subscription', '/affiliate', '/portal', '/admin', '/kyc-review'];
      if (!alwaysVisible.some((path) => item.href!.startsWith(path))) {
        const routeEnabled = MODULE_ROUTES[userAppType as ModuleKey]?.some((route: string) =>
          item.href!.startsWith(route)
        );
        if (!routeEnabled) return false;
      }
    }
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
      if (item.href && (currentPage === item.href || currentPage.startsWith(`${item.href}/`))) {
        return item.id;
      }
    }
    return '';
  };

  const activeId = getActiveId();

  return (
    <>
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
            const href = item.href ? prefixDashboardHref(item.href, hrefModule) : '#';
            return (
              <Link
                key={item.id}
                href={href}
                className={activeId === item.id ? 'active' : ''}
                onClick={() => document.getElementById('sidebar')?.classList.remove('open')}
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
          {role !== 'developer' && (role === 'superadmin' || (role === 'admin' && enabledModules.length > 1)) && (
            <Link 
              href="/portal" 
              onClick={() => document.getElementById('sidebar')?.classList.remove('open')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 12px', margin: '8px 12px 0',
                borderRadius: 'var(--radius-sm)', fontSize: '.78rem',
                color: 'rgba(255,255,255,.7)', background: 'rgba(255,255,255,.08)',
                textDecoration: 'none',
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>apps</span>
              {dict.sidebar.backToPortal}
            </Link>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      <div
        className="sidebar-overlay"
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
          zIndex: 45, display: 'none',
        }}
        onClick={() => document.getElementById('sidebar')?.classList.remove('open')}
      />
      <style>{`
        #sidebar.open ~ .sidebar-overlay {
          display: block !important;
        }
      `}</style>
    </>
  );
}
