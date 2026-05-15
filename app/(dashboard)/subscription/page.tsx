import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId } from '@/lib/tenant';
import { MODULE_LABELS, PLAN_COLORS, PLAN_LABELS } from '@/lib/plans';
import { normalizeEnabledModules } from '@/lib/subscription';

export default async function MySubscriptionPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'superadmin') redirect('/dashboard');

  const tenantId = await getDefaultTenantId();
  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

  const enabledModules = normalizeEnabledModules(sub?.enabledModules);

  const planColor = PLAN_COLORS[sub?.plan || 'trial'];
  const planLabel = PLAN_LABELS[sub?.plan || 'trial'];

  return (
    <div>
      <div className="page-header">
        <div className="header-content">
          <h1>My Subscription</h1>
          <p className="text-muted">Current plan and module access for {tenant?.name}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {/* Plan card */}
        <div className="card" style={{ borderTop: `4px solid ${planColor}`, padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Current Plan</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: planColor }}>{planLabel}</div>
          <div style={{ marginTop: '6px' }}>
            <span className={`badge ${sub?.status === 'active' ? 'badge-active' : 'badge-closed'}`} style={{ textTransform: 'capitalize' }}>
              {sub?.status || 'inactive'}
            </span>
          </div>
        </div>

        {/* Loan limit */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Max Active Loans</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{sub?.maxActiveLoans ?? '—'}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '4px' }}>loans allowed at once</div>
        </div>

        {/* Agent limit */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Max Agents</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{sub?.maxAgents ?? '—'}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '4px' }}>active agents allowed</div>
        </div>

        {/* Expiry */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            {sub?.plan === 'trial' ? 'Trial Ends' : 'Period End'}
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>
            {sub?.plan === 'trial'
              ? (sub?.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString() : 'N/A')
              : (sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'N/A')}
          </div>
        </div>
      </div>

      {/* Enabled Modules */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Enabled Modules</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {Object.entries(MODULE_LABELS).map(([key, label]) => {
            const isEnabled = enabledModules.includes(key);
            return (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 18px', borderRadius: '8px',
                background: isEnabled ? 'var(--success-bg)' : 'var(--bg)',
                border: `1px solid ${isEnabled ? 'var(--success)' : 'var(--border)'}`,
                color: isEnabled ? 'var(--success)' : 'var(--text-light)',
                fontWeight: 500,
              }}>
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
                  {isEnabled ? 'check_circle' : 'cancel'}
                </span>
                {label}
              </div>
            );
          })}
        </div>
        <p style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-light)' }}>
          To change your plan or enabled modules, please contact your system administrator.
        </p>
      </div>
    </div>
  );
}
