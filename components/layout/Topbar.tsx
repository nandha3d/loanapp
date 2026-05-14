'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState, useEffect, useRef } from 'react';
import { updateLanguage } from '@/app/(dashboard)/settings/actions';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

function formatTodayDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
}

export default function Topbar({ dict, currentLang }: { dict: any; currentLang: string }) {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
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

  const title = getPageTitle(pathname);
  const breadcrumbs = getBreadcrumbs(pathname);

  useEffect(() => {
    setTodayDate(formatTodayDate());
  }, []);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.count || 0);
        }
      } catch {
        // silently fail
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [pathname]);

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
        </select>

        <span className="topbar-date">{todayDate}</span>

        <div className="notification-bell" ref={notifRef} onClick={(e) => { e.stopPropagation(); setNotifOpen(!notifOpen); }}>
          <span className="material-icons-outlined">notifications</span>
          {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          <div className={`notification-dropdown ${notifOpen ? 'show' : ''}`}>
            <div className="nd-header">
              <span>{dict.sidebar.notifications}</span>
              <Link href="/notifications" className="btn-ghost btn-sm" style={{ fontSize: '.78rem' }}>{dict.dashboard.viewAll}</Link>
            </div>
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-light)', fontSize: '.85rem' }}>
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'No new notifications'}
            </div>
          </div>
        </div>

        <button
          className="btn btn-ghost btn-sm"
          title="Logout"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <span className="material-icons-outlined" style={{ fontSize: '20px' }}>logout</span>
        </button>
      </div>
    </header>
  );
}
