'use client';

import { APP_CONFIGS, AppType } from '@/lib/appConfig';
import { selectApp } from './actions';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

export default function AppSelectorClient({ 
  userName, 
  userRole, 
  enabledModules 
}: { 
  userName: string, 
  userRole: string, 
  enabledModules: string[] 
}) {
  const apps = Object.values(APP_CONFIGS).filter(app => {
    if (userRole === 'developer') return true;
    return enabledModules.includes(app.id);
  });
  const router = useRouter();

  const handleSelectApp = async (appType: AppType) => {
    await selectApp(appType);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        position: 'absolute', top: '24px', right: '32px',
      }}>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
          onMouseOver={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.2)'}
          onMouseOut={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>logout</span>
          Logout
        </button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>
          Welcome, {userName}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1rem' }}>
          Select an application to manage
        </p>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px', maxWidth: '960px', width: '100%',
      }}>
        {apps.map(app => (
          <button
            key={app.id}
            onClick={() => handleSelectApp(app.id)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '32px 24px',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all .3s ease',
              position: 'relative',
            }}
            onMouseOver={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)';
              (e.currentTarget as HTMLElement).style.borderColor = app.primaryColor;
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              width: '64px', height: '64px', borderRadius: '16px',
              background: app.primaryColor, margin: '0 auto 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="material-icons-outlined" style={{ fontSize: '32px', color: '#fff' }}>{app.icon}</span>
            </div>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>
              {app.name}
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '.85rem', lineHeight: 1.5 }}>
              {app.description}
            </p>

          </button>
        ))}
      </div>
      <div style={{ marginTop: '60px', width: '100%', maxWidth: '960px' }}>
        <h3 style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
          System Administration
        </h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {['superadmin', 'developer'].includes(userRole) && (
            <button
              onClick={() => router.push('/admin/users')}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                padding: '16px 24px', borderRadius: '12px', color: '#fff', cursor: 'pointer',
                transition: 'all 0.2s ease', flex: 1, minWidth: '250px'
              }}
              onMouseOver={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
              onMouseOut={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
            >
              <span className="material-icons-outlined" style={{ color: '#F5A623' }}>admin_panel_settings</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>Master User Management</div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Manage roles across all apps</div>
              </div>
            </button>
          )}

          {userRole === 'developer' && (
            <button
              onClick={() => router.push('/admin/branches')}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                padding: '16px 24px', borderRadius: '12px', color: '#fff', cursor: 'pointer',
                transition: 'all 0.2s ease', flex: 1, minWidth: '250px'
              }}
              onMouseOver={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
              onMouseOut={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
            >
              <span className="material-icons-outlined" style={{ color: '#2980B9' }}>store</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>Branch Management</div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Manage Micro Lending branches</div>
              </div>
            </button>
          )}

          {userRole === 'developer' && (
            <button
              onClick={() => router.push('/admin/billing')}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                padding: '16px 24px', borderRadius: '12px', color: '#fff', cursor: 'pointer',
                transition: 'all 0.2s ease', flex: 1, minWidth: '250px'
              }}
              onMouseOver={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
              onMouseOut={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
            >
              <span className="material-icons-outlined" style={{ color: '#27AE60' }}>credit_card</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>Billing & Subscriptions</div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Manage tenant plans and limits</div>
              </div>
            </button>
          )}

          {userRole === 'superadmin' && (
          <button
            onClick={() => router.push('/subscription')}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              padding: '16px 24px', borderRadius: '12px', color: '#fff', cursor: 'pointer',
              transition: 'all 0.2s ease', flex: 1, minWidth: '250px'
            }}
            onMouseOver={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
            onMouseOut={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
          >
            <span className="material-icons-outlined" style={{ color: '#9B59B6' }}>receipt_long</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600 }}>My Subscription</div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>View plan details and usage</div>
            </div>
          </button>
          )}
        </div>
      </div>
    </div>
  );
}
