import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import Link from 'next/link';
import LogoutButton from '@/components/ui/LogoutButton';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userRole = (session?.user as any)?.role;

  if (userRole !== 'superadmin' && userRole !== 'developer') {
    redirect('/login');
  }

  const userName = session?.user?.name || (userRole === 'developer' ? 'Developer' : 'Super Admin');

  return (
    <SessionProvider session={session}>
      <div 
        className="app-layout"
        style={{ 
          '--primary': '#1A1A2E',
          '--primary-dark': '#0F0F1A',
          '--primary-light': '#2A2A4A',
          '--accent': '#E94560',
        } as React.CSSProperties}
      >
        <aside className="sidebar open" style={{ background: 'var(--primary)', color: '#fff' }}>
          <div className="sidebar-brand">
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'var(--accent)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span className="material-icons-outlined" style={{ color: '#fff', fontSize: '20px' }}>admin_panel_settings</span>
            </div>
            <h2 style={{color:'#fff'}}>System<span>Admin</span></h2>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-section">Management</div>
            <Link href="/admin/users" className="active">
              <span className="material-icons-outlined">people</span>
              Master Users
            </Link>
            {userRole === 'developer' && (
              <Link href="/admin/branches">
                <span className="material-icons-outlined">store</span>
                Branches
              </Link>
            )}
            {/* Billing section removed as it is accessible via portal */}
          </nav>

          <div className="sidebar-footer">
            <div className="user-info">
              <div className="avatar" style={{background:'var(--accent)'}}>{userRole === 'developer' ? 'DEV' : 'SA'}</div>
              <div>
                <div className="user-name" style={{color:'#fff'}}>{userName}</div>
                <div className="user-role" style={{color:'rgba(255,255,255,0.6)', textTransform: 'capitalize'}}>{userRole}</div>
              </div>
            </div>
            <Link href="/portal" style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 12px', margin: '8px 12px 0',
              borderRadius: 'var(--radius-sm)', fontSize: '.78rem',
              color: 'rgba(255,255,255,.7)', background: 'rgba(255,255,255,.08)',
              textDecoration: 'none',
            }}>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
              Back to Portal
            </Link>
          </div>
        </aside>

        <main className="main-content">
          <header className="topbar">
            <div className="topbar-search">
              {/* Optional Search */}
            </div>
            <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <LogoutButton />
              <div className="user-profile">
                <div className="avatar">{userRole === 'developer' ? 'DEV' : 'SA'}</div>
              </div>
            </div>
          </header>
          <div className="page-content fade-up">
            {children}
          </div>
        </main>
      </div>
    </SessionProvider>
  );
}
