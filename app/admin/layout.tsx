import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import Link from 'next/link';
import LogoutButton from '@/components/ui/LogoutButton';
import prisma from '@/lib/db';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userRole = (session?.user as any)?.role;

  if (userRole !== 'superadmin' && userRole !== 'developer' && userRole !== 'admin') {
    redirect('/login');
  }

  const userName = session?.user?.name || (userRole === 'developer' ? 'Developer' : userRole === 'superadmin' ? 'Super Admin' : 'Branch Admin');
  const avatarInitials = userRole === 'developer' ? 'DEV' : userRole === 'superadmin' ? 'SA' : 'BA';

  // Fix 21: Fetch pending notification count for developer
  let pendingBranchRequestCount = 0;
  let pendingModuleRequestCount = 0;
  if (userRole === 'developer') {
    [pendingBranchRequestCount, pendingModuleRequestCount] = await Promise.all([
      prisma.branchRequest.count({ where: { status: 'pending' } }),
      prisma.moduleRequest.count({ where: { status: 'pending' } }),
    ]);
  }

  return (
    <SessionProvider session={session}>
      <div 
        className="app-layout"
        style={{ 
          '--primary': '#1A1A2E',
          '--primary-dark': '#0F0F1A',
          '--primary-light': '#EAEAFF',
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
            {['superadmin', 'developer'].includes(userRole) && (
              <Link href="/admin/users" className="active">
                <span className="material-icons-outlined">people</span>
                Master Users
              </Link>
            )}
            {userRole === 'admin' && (
              <Link href="/admin/team" className="active">
                <span className="material-icons-outlined">people</span>
                User Management
              </Link>
            )}
            {userRole === 'developer' && (
              <Link href="/admin/branches">
                <span className="material-icons-outlined">store</span>
                Branches
              </Link>
            )}
            {/* Fix 9: Branch Requests link for developer */}
            {userRole === 'developer' && (
              <Link href="/admin/branch-requests">
                <span className="material-icons-outlined">account_tree</span>
                Branch Requests
                {pendingBranchRequestCount > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    background: 'var(--accent)',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '2px 8px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    minWidth: '20px',
                    textAlign: 'center',
                  }}>
                    {pendingBranchRequestCount}
                  </span>
                )}
              </Link>
            )}
            {userRole === 'developer' && (
              <Link href="/admin/module-requests">
                <span className="material-icons-outlined">extension</span>
                Module Requests
                {pendingModuleRequestCount > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    background: 'var(--accent)',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '2px 8px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    minWidth: '20px',
                    textAlign: 'center',
                  }}>
                    {pendingModuleRequestCount}
                  </span>
                )}
              </Link>
            )}
            {/* Fix 12: Billing link visible only for developer */}
            {userRole === 'developer' && (
              <Link href="/admin/billing">
                <span className="material-icons-outlined">receipt_long</span>
                Billing
              </Link>
            )}
          </nav>

          <div className="sidebar-footer">
            <div className="user-info">
              <div className="avatar" style={{background:'var(--accent)'}}>{avatarInitials}</div>
              <div>
                <div className="user-name" style={{color:'#fff'}}>{userName}</div>
                <div className="user-role" style={{color:'rgba(255,255,255,0.6)', textTransform: 'capitalize'}}>{userRole === 'admin' ? 'Branch Admin' : userRole}</div>
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
              {/* Fix 21: Notification bell for developer */}
              {userRole === 'developer' && pendingBranchRequestCount > 0 && (
                <Link href="/admin/branch-requests" style={{ position: 'relative', color: 'var(--text)', textDecoration: 'none' }}>
                  <span className="material-icons-outlined" style={{ fontSize: '22px' }}>notifications</span>
                  <span style={{
                    position: 'absolute', top: '-4px', right: '-6px',
                    background: '#E94560', color: '#fff',
                    borderRadius: '50%', width: '18px', height: '18px',
                    fontSize: '0.65rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {pendingBranchRequestCount}
                  </span>
                </Link>
              )}
              <LogoutButton />
              <div className="user-profile">
                <div className="avatar">{avatarInitials}</div>
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
