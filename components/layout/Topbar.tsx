'use client';

import Link from '@/components/layout/DashboardLink';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { updateLanguage } from '@/app/(dashboard)/[module]/settings/actions';
import { markNotificationRead, markAllNotificationsRead } from '@/app/(dashboard)/[module]/notifications/actions';
import { parseModulePath } from '@/types/modules';
import { formatNotificationTime } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

function formatTodayDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
}

export default function Topbar({
  dict,
  currentLang,
  branchSwitcher,
}: {
  dict: any;
  currentLang: string;
  branchSwitcher?: React.ReactNode;
}) {
  const pathname = usePathname();
  const pagePath = parseModulePath(pathname).page;
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifItems, setNotifItems] = useState<any[]>([]);
  const [todayDate, setTodayDate] = useState('');
  const notifRef = useRef<HTMLDivElement>(null);
  
  function getPageTitle(pathname: string): string {
    const map: Record<string, string> = {
      '/dashboard': dict.sidebar.dashboard,
      '/collection': dict.sidebar.collection,
      '/customers': dict.sidebar.customers,
      '/customers/new': dict.customers.registerTitle,
      '/loans': dict.sidebar.loans,
      '/loans/new': dict.loans.newLoan,
      '/penalties': dict.sidebar.penalties,
      '/reports': dict.sidebar.reports,
      '/notifications': dict.sidebar.notifications,
      '/settings': dict.sidebar.settings,
    };
    if (map[pathname]) return map[pathname];
    if (pathname.startsWith('/customers/')) return dict.customers.title;
    if (pathname.startsWith('/loans/')) return dict.sidebar.loans;
    return dict.sidebar.dashboard;
  }

  function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
    const parts = pathname.split('/').filter(Boolean);
    const crumbs: BreadcrumbItem[] = [{ label: dict.sidebar.dashboard, href: '/dashboard' }];
    
    if (parts[0] && parts[0] !== 'dashboard') {
      const id = parts[0];
      const label = (dict.sidebar as any)[id] || id.charAt(0).toUpperCase() + id.slice(1);
      
      if (parts.length > 1) {
        crumbs.push({ label, href: `/${parts[0]}` });
        if (parts[1] === 'new') {
          crumbs.push({ label: dict.loans.newLoan });
        } else {
          crumbs.push({ label: parts[1] });
        }
      } else {
        crumbs.push({ label });
      }
    }
    
    return crumbs;
  }

  const title = getPageTitle(pagePath);
  const breadcrumbs = getBreadcrumbs(pagePath);

  useEffect(() => {
    setTodayDate(formatTodayDate());
  }, []);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count || 0);
        setNotifItems(data.items || []);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [pathname, fetchCount]);

  // Mark one read on click, then refresh the badge immediately (don't wait for
  // the 30s poll). Optimistically drop the count so the bell feels responsive.
  const handleNotifClick = useCallback(async (n: any) => {
    if (!n.isRead) {
      setUnreadCount((c) => Math.max(0, c - 1));
      try { await markNotificationRead(n.id); } catch { /* ignore */ }
      fetchCount();
    }
  }, [fetchCount]);

  const handleMarkAllRead = useCallback(async () => {
    setUnreadCount(0);
    try { await markAllNotificationsRead(); } catch { /* ignore */ }
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleMenuClick = () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  };

  return (
    <header className="topbar" id="topbar">
      <div className="topbar-left">
        <button className="btn-menu material-icons-outlined" onClick={handleMenuClick}>
          menu
        </button>
        <div>
          <h2>{title}</h2>
          {breadcrumbs.length > 1 && (
            <div className="breadcrumb">
              {breadcrumbs.map((b, i) => (
                <span key={i}>
                  {i > 0 && <span style={{ margin: '0 4px' }}>/</span>}
                  {b.href ? (
                    <Link href={b.href}>{b.label}</Link>
                  ) : (
                    <span>{b.label}</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="topbar-right">
        {branchSwitcher}

        <select
          className="form-control"
          style={{ width: 'auto', padding: '4px 8px', fontSize: '.85rem', marginRight: '10px' }}
          onChange={(e) => updateLanguage(e.target.value)}
          value={currentLang}
          suppressHydrationWarning
        >
          <option value="en">English</option>
          <option value="ta">Tamil (தமிழ்)</option>
          <option value="hi">Hindi (हिन्दी)</option>
          <option value="te">Telugu (తెలుగు)</option>
          <option value="kn">Kannada (ಕನ್ನಡ)</option>
          <option value="ml">Malayalam (മലയാളം)</option>
        </select>

        <span className="topbar-date">{todayDate}</span>

        <div className="notification-bell" ref={notifRef} onClick={(e) => { e.stopPropagation(); setNotifOpen(!notifOpen); }}>
          <span className="material-icons-outlined">notifications</span>
          {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          <div className={`notification-dropdown ${notifOpen ? 'show' : ''}`}>
            <div className="nd-header">
              <span>{dict.sidebar.notifications}</span>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  style={{ fontSize: '.78rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); handleMarkAllRead(); }}
                >
                  {dict.notifications?.markAllRead || 'Mark all read'}
                </button>
              ) : (
                <Link href="/notifications" className="btn-ghost btn-sm" style={{ fontSize: '.78rem' }}>{dict.dashboard.viewAll}</Link>
              )}
            </div>
            {notifItems.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-light)', fontSize: '.85rem' }}>
                No new notifications
              </div>
            ) : (
              <div>
                {notifItems.map((n) => (
                  <Link
                    key={n.id}
                    href={n.link || '/notifications'}
                    onClick={() => { handleNotifClick(n); setNotifOpen(false); }}
                    style={{
                      display: 'flex',
                      gap: '10px',
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border)',
                      textDecoration: 'none',
                      color: 'inherit',
                      background: n.isRead ? 'transparent' : 'var(--primary-light)',
                    }}
                  >
                    <span
                      className="material-icons-outlined"
                      style={{ fontSize: '18px', color: 'var(--primary)', marginTop: '2px', flexShrink: 0 }}
                    >
                      {n.icon || 'notifications'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ fontSize: '.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {n.title}
                        </div>
                        <span style={{ fontSize: '.68rem', color: 'var(--text-light)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {formatNotificationTime(n.createdAt, { justNow: dict.notifications?.justNow || 'now', minutesAgo: dict.notifications?.minutesAgo || 'min ago', hoursAgo: dict.notifications?.hoursAgo || 'h ago' })}
                        </span>
                      </div>
                      <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.message}
                      </div>
                    </div>
                  </Link>
                ))}
                <Link
                  href="/notifications"
                  onClick={() => setNotifOpen(false)}
                  style={{ display: 'block', padding: '10px', textAlign: 'center', fontSize: '.78rem', color: 'var(--primary)' }}
                >
                  {dict.dashboard.viewAll}
                </Link>
              </div>
            )}
          </div>
        </div>

        <button
          className="btn btn-ghost btn-sm"
          title="Logout"
          suppressHydrationWarning
          onClick={async () => {
            // redirect:false + manual navigation keeps logout on the current
            // domain (custom tenant domains would otherwise bounce to the root
            // SaaS host).
            await signOut({ redirect: false });
            window.location.href = '/login';
          }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '20px' }}>logout</span>
        </button>
      </div>
    </header>
  );
}
