import Link from 'next/link';
import LogoutButton from '@/components/ui/LogoutButton';
import type { TenantSubscriptionAccessState } from '@/lib/subscription';

export default function SubscriptionPaywall({
  access,
  role,
}: {
  access: TenantSubscriptionAccessState;
  role: string;
}) {
  const canManageBilling = role === 'superadmin' || role === 'admin';

  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: '24px',
      background: 'linear-gradient(145deg, #fff7ed 0%, #f8fafc 48%, #eff6ff 100%)',
    }}>
      <section
        role="alert"
        aria-live="assertive"
        style={{
          width: 'min(560px, 100%)',
          background: '#fff',
          border: '1px solid #fed7aa',
          borderRadius: '20px',
          boxShadow: '0 24px 70px rgba(15, 23, 42, 0.14)',
          padding: '36px',
          textAlign: 'center',
        }}
      >
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          margin: '0 auto 20px',
          background: '#ffedd5',
          color: '#c2410c',
        }}>
          <span className="material-icons-outlined" style={{ fontSize: '36px' }}>lock</span>
        </div>

        <div style={{
          display: 'inline-flex',
          padding: '5px 10px',
          borderRadius: '999px',
          background: '#fff7ed',
          color: '#9a3412',
          fontSize: '.75rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '.06em',
          marginBottom: '12px',
        }}>
          Payment required
        </div>

        <h1 style={{ margin: '0 0 12px', color: '#0f172a', fontSize: '1.8rem' }}>
          Workspace access is paused
        </h1>
        <p style={{ margin: '0 auto', color: '#475569', lineHeight: 1.65, maxWidth: '460px' }}>
          {access.message || 'Complete your subscription payment to continue using ZoloFund.'}
        </p>
        <p style={{ margin: '12px auto 0', color: '#64748b', lineHeight: 1.55, fontSize: '.9rem' }}>
          No application data or operations are available until the subscription is active.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '28px' }}>
          {canManageBilling ? (
            <Link href="/portal/billing" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>payments</span>
              Pay & restore access
            </Link>
          ) : (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#f1f5f9',
              color: '#334155',
              fontSize: '.88rem',
            }}>
              Ask your workspace owner or branch admin to complete payment.
            </div>
          )}
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
