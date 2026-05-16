import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId } from '@/lib/tenant';
import { PLAN_COLORS, PLAN_LABELS } from '@/lib/plans';
import { getActiveBranchId, getBranchEnabledModules } from '@/lib/branch';
import { ALL_MODULES, MODULE_LABELS, normalizeModuleList } from '@/types/modules';

export default async function MySubscriptionPage() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (user?.role !== 'superadmin' || !user.id) redirect('/dashboard');

  const tenantId = await getDefaultTenantId();
  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const userId = user.id;

  let activeBranchId = await getActiveBranchId();
  let activeBranch = activeBranchId
    ? await prisma.branch.findFirst({
        where: { id: activeBranchId, tenantId, superadminId: userId, status: 'active' },
        select: { id: true, name: true, enabledModules: true },
      })
    : null;

  if (!activeBranch) {
    activeBranch = await prisma.branch.findFirst({
      where: { tenantId, superadminId: userId, status: 'active' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, enabledModules: true },
    });
    activeBranchId = activeBranch?.id ?? null;
  }

  const enabledModules = activeBranchId
    ? await getBranchEnabledModules(activeBranchId)
    : normalizeModuleList(activeBranch?.enabledModules);

  const planColor = PLAN_COLORS[sub?.plan || 'trial'];
  const planLabel = PLAN_LABELS[sub?.plan || 'trial'];

  return (
    <div>
      <div className="page-header">
        <div className="header-content">
          <h1>My Subscription</h1>
          <p className="text-muted">Current plan and active branch module access for {tenant?.name}</p>
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
        <h3 style={{ marginBottom: '8px', fontSize: '1rem' }}>Active Branch Modules</h3>
        <p style={{ marginBottom: '16px', fontSize: '0.85rem', color: 'var(--text-light)' }}>
          {activeBranch ? activeBranch.name : 'No active branch selected'}
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {ALL_MODULES.map((key) => {
            const label = MODULE_LABELS[key];
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
          Branch modules are granted by the developer. Subscription limits still control tenant plan capacity.
        </p>
      </div>
    </div>
  );
}
