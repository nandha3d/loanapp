import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { PLAN_COLORS, PLAN_LABELS } from '@/lib/plans';
import { getActiveBranchId, getBranchEnabledModules } from '@/lib/branch';
import { ALL_MODULES, MODULE_LABELS, modulePath, normalizeModuleList } from '@/types/modules';

export default async function MySubscriptionPage() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (user?.role !== 'superadmin' || !user.id) redirect(modulePath(await getUserAppType(), '/dashboard'));

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

      {/* Premium Add-ons & Integrations */}
      <div className="card" style={{ padding: '24px', marginTop: '24px' }}>
        <h3 style={{ marginBottom: '6px', fontSize: '1rem' }}>Premium Add-ons & Integrations</h3>
        <p style={{ marginBottom: '20px', fontSize: '0.85rem', color: 'var(--text-light)' }}>
          Unlock premium business capabilities and automated integrations for your lending enterprise.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {[
            {
              key: 'premiumAccountingEnabled',
              name: 'Premium double-entry Accounting',
              icon: 'account_balance_wallet',
              desc: 'Full double-entry general ledger, fiscal years, tax codes, vendor accounts, and budget tracking.',
              active: Boolean(sub?.premiumAccountingEnabled),
            },
            {
              key: 'whatsappSmsEnabled',
              name: 'WhatsApp & SMS Notifications',
              icon: 'sms',
              desc: 'Automated SMS/WhatsApp transaction alerts, daily receipts, and overdue payment notifications.',
              active: Boolean(sub?.whatsappSmsEnabled),
            },
            {
              key: 'receiptPdfAllowed',
              name: 'Receipt PDF Downloads',
              icon: 'picture_as_pdf',
              desc: 'Export and print professional collection receipts, loan statements, and summaries.',
              active: Boolean(sub?.receiptPdfAllowed),
            },
            {
              key: 'bureauEnabled',
              name: 'Credit Bureau Integration',
              icon: 'credit_score',
              desc: 'Perform direct consumer credit bureau queries and retrieve credit ratings dynamically.',
              active: Boolean(sub?.bureauEnabled),
            },
            {
              key: 'npaEnabled',
              name: 'NPA Classification Engine',
              icon: 'gavel',
              desc: 'Automated NPA classification, provisioning tracking, and compliance according to regulatory norms.',
              active: Boolean(sub?.npaEnabled),
            },
            {
              key: 'kycEnabled',
              name: 'Aadhaar eKYC & Video KYC',
              icon: 'assignment_ind',
              desc: 'Verify borrower identities instantly using Aadhaar OTP eKYC and live Video UAT verification.',
              active: Boolean(sub?.kycEnabled),
            },
            {
              key: 'gpsTrackingEnabled',
              name: 'GPS Collection & Route Tracking',
              icon: 'map',
              desc: 'Real-time geographic tracking of field agents, route check-ins, and GPS location proofs.',
              active: Boolean(sub?.gpsTrackingEnabled),
            },
            {
              key: 'foreclosureEnabled',
              name: 'Foreclosure & Early Settlement',
              icon: 'lock_open',
              desc: 'Calculate precise early closing amounts, apply discretionary waivers, and generate settlement PDFs.',
              active: Boolean(sub?.foreclosureEnabled),
            },
          ].map((addon) => (
            <div
              key={addon.key}
              style={{
                border: `1px solid ${addon.active ? 'var(--success)' : 'var(--border)'}`,
                background: addon.active ? 'rgba(74, 222, 128, 0.04)' : 'var(--bg-light, rgba(255,255,255,0.01))',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: addon.active ? 'var(--success)' : 'var(--text)',
                }}>
                  <span className="material-icons-outlined" style={{ fontSize: '20px' }}>
                    {addon.icon}
                  </span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                    {addon.name}
                  </span>
                </div>
                <span
                  className={`badge ${addon.active ? 'badge-success' : 'badge-closed'}`}
                  style={{
                    fontSize: '0.62rem',
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: addon.active ? 'var(--success-bg)' : 'rgba(255,255,255,0.08)',
                    color: addon.active ? 'var(--success)' : 'var(--text-light)',
                    fontWeight: 700,
                  }}
                >
                  {addon.active ? 'Active' : 'Locked'}
                </span>
              </div>
              <p style={{
                fontSize: '0.78rem',
                color: 'var(--text-light)',
                lineHeight: 1.4,
                margin: 0
              }}>
                {addon.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
