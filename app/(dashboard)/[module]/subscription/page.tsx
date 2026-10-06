import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { PLAN_COLORS, PLAN_LABELS } from '@/lib/plans';
import { getActiveBranchId, getBranchEnabledModules } from '@/lib/branch';
import { ALL_MODULES, MODULE_LABELS, modulePath, normalizeModuleList } from '@/types/modules';
import { getDictionary } from '@/lib/i18n';
import { normalizeEnabledModules } from '@/lib/subscription';
import { calculateVerticalSubscriptionPricing, yearlySavingsPercent } from '@/lib/pricing';
import { normalizeBillingCycle, normalizeRazorpayPlanId } from '@/lib/razorpay';
import { PLAN_FEATURES, parseFeatureKeys } from '@/lib/planFeatures';
import SubscriptionPlansClient from './SubscriptionPlansClient';

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export default async function MySubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ feature?: string }>;
}) {
  // Optional deep link from a locked-feature prompt: highlights that feature's card.
  const highlightFeature = (await searchParams).feature;
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (user?.role !== 'superadmin' || !user.id) redirect(modulePath(await getUserAppType(), '/dashboard'));

  const tenantId = await getDefaultTenantId();
  const dict = await getDictionary(tenantId);
  const d = dict.subscription || {};

  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const userId = user.id;

  const [activeBranchCount, catalogPlans] = await Promise.all([
    prisma.branch.count({ where: { tenantId, status: 'active' } }),
    prisma.subscriptionPlanCatalog.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

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

  const planKey = sub?.plan || 'free';
  const planColor = PLAN_COLORS[planKey] || '#3b82f6';
  const planLabel = PLAN_LABELS[planKey] || (planKey.charAt(0).toUpperCase() + planKey.slice(1));

  // Compute pricing for each catalog plan based on tenant modules and add-ons
  const enabledTenantModules = normalizeEnabledModules(sub?.enabledModules);
  const selectedAddons = parseStringList(sub?.selectedAddons);
  const addonRows = selectedAddons.length
    ? await prisma.addonCatalog.findMany({
        where: { addon: { in: selectedAddons }, isActive: true },
        select: { monthlyPrice: true },
      })
    : [];
  const addonsPrice = addonRows.reduce((sum, addon) => sum + addon.monthlyPrice, 0);

  // Paid plans by price: each plan's card lists its full (cumulative) premium set and
  // names the plan below it, so higher plans visibly include the lower ones.
  const paidByPrice = [...catalogPlans].filter((p) => p.monthlyPrice > 0).sort((x, y) => x.monthlyPrice - y.monthlyPrice);
  const formattedPlans = catalogPlans.map((cp) => {
    const pricing = calculateVerticalSubscriptionPricing(
      cp.monthlyPrice,
      enabledTenantModules,
      addonsPrice,
    );
    let featuresList: string[] = [];
    try {
      featuresList = JSON.parse(cp.features);
    } catch {
      featuresList = [cp.features];
    }
    return {
      id: cp.id,
      plan: cp.plan,
      displayName: cp.displayName,
      description: cp.description,
      monthlyPrice: cp.monthlyPrice,
      maxBranches: cp.maxBranches,
      maxAgents: cp.maxAgents,
      maxActiveLoans: cp.maxActiveLoans,
      features: featuresList,
      razorpayPlanId: cp.razorpayPlanId,
      // Yearly is offered only when a price AND a Razorpay yearly plan are set.
      yearlyPrice: (cp.yearlyPrice ?? 0) > 0 && normalizeRazorpayPlanId(cp.razorpayYearlyPlanId)
        ? cp.yearlyPrice
        : null,
      yearlySavingsPercent: yearlySavingsPercent(cp.monthlyPrice, cp.yearlyPrice ?? 0),
      premiumFeatures: parseFeatureKeys(cp.includedFeatures),
      includesPlan: (() => {
        const i = paidByPrice.findIndex((p) => p.plan === cp.plan);
        return i > 0 ? paidByPrice[i - 1].displayName : null;
      })(),
      isActive: cp.isActive,
      sortOrder: cp.sortOrder,
      calculatedPrice: pricing,
    };
  });

  // Premium features (bundled into plans). Locked ones name the cheapest plan that includes them.
  const featureMeta: Record<string, { icon: string; desc: string }> = {
    kyc: { icon: 'assignment_ind', desc: 'Verify borrower identities instantly using Aadhaar OTP eKYC and live Video KYC verification.' },
    foreclosure: { icon: 'lock_open', desc: 'Calculate precise early closing amounts, apply discretionary waivers, and generate settlement PDFs.' },
    receipt_pdf: { icon: 'picture_as_pdf', desc: 'Export and print professional collection receipts, loan statements, and summaries.' },
    whatsapp_sms: { icon: 'sms', desc: 'Automated SMS/WhatsApp transaction alerts, daily receipts, and overdue payment notifications.' },
    gps_tracking: { icon: 'map', desc: 'Real-time geographic tracking of field agents, route check-ins, and GPS location proofs.' },
    bureau: { icon: 'credit_score', desc: 'Perform direct consumer credit bureau queries and retrieve credit ratings dynamically.' },
    nach: { icon: 'account_balance', desc: 'Collect instalments automatically with eNACH bank mandates and scheduled auto-debits.' },
    premium_accounting: { icon: 'account_balance_wallet', desc: 'Full double-entry general ledger, fiscal years, tax codes, vendor accounts, and budget tracking.' },
    npa: { icon: 'gavel', desc: 'Automated NPA classification, provisioning tracking, and compliance according to regulatory norms.' },
  };
  const paidPlansByPrice = [...catalogPlans].filter((cp) => cp.monthlyPrice > 0).sort((x, y) => x.monthlyPrice - y.monthlyPrice);
  const featureCards = PLAN_FEATURES.map((f) => ({
    key: f.key,
    name: d[`featureName_${f.key}`] || f.label,
    icon: featureMeta[f.key]?.icon ?? 'star',
    desc: featureMeta[f.key]?.desc ?? '',
    active: Boolean((sub as Record<string, unknown> | null)?.[f.flag]),
    includedIn: paidPlansByPrice.find((cp) => parseFeatureKeys(cp.includedFeatures).includes(f.key))?.displayName ?? null,
  }));

  const maxBranchesAllowed = sub?.maxBranches ?? 1;
  const isBranchLimitReached = maxBranchesAllowed < 999 && activeBranchCount >= maxBranchesAllowed;

  return (
    <div>
      <div className="page-header">
        <div className="header-content">
          <h1>{d.title || 'My Subscription'}</h1>
          <p className="text-muted">
            {d.subtitle || 'Current plan and active branch module access for'} {tenant?.name}
          </p>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '18px', marginBottom: '28px' }}>
        {/* Plan card */}
        <div className="card" style={{ borderTop: `4px solid ${planColor}`, padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            {d.currentPlan || 'Current Plan'}
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: planColor }}>{planLabel}</div>
          <div style={{ marginTop: '6px' }}>
            <span className={`badge ${sub?.status === 'active' ? 'badge-active' : 'badge-closed'}`} style={{ textTransform: 'capitalize' }}>
              {sub?.status || 'inactive'}
            </span>
          </div>
        </div>

        {/* Max Branches - directly connects to tenant branch limit */}
        <div className="card" style={{ padding: '20px', borderTop: isBranchLimitReached ? '4px solid #f59e0b' : undefined }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            {d.maxBranches || 'Max Branches'}
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: isBranchLimitReached ? '#d97706' : 'inherit' }}>
            {maxBranchesAllowed >= 999 ? (d.unlimited || 'Unlimited') : `${activeBranchCount} / ${maxBranchesAllowed}`}
          </div>
          <div style={{ fontSize: '0.82rem', color: isBranchLimitReached ? '#d97706' : 'var(--text-light)', marginTop: '4px', fontWeight: isBranchLimitReached ? 600 : 400 }}>
            {isBranchLimitReached ? '⚠️ Limit reached' : (d.branchesAllowed || 'branches allowed')}
          </div>
        </div>

        {/* Loan limit */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            {d.maxActiveLoans || 'Max Active Loans'}
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>
            {(sub?.maxActiveLoans ?? 0) >= 999999 ? (d.unlimited || 'Unlimited') : (sub?.maxActiveLoans ?? '—')}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-light)', marginTop: '4px' }}>
            {d.loansAllowedAtOnce || 'loans allowed at once'}
          </div>
        </div>

        {/* Agent limit */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            {d.maxAgents || 'Max Agents'}
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>
            {(sub?.maxAgents ?? 0) >= 999 ? (d.unlimited || 'Unlimited') : (sub?.maxAgents ?? '—')}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-light)', marginTop: '4px' }}>
            {d.activeAgentsAllowed || 'active agents allowed'}
          </div>
        </div>

        {/* Expiry */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            {sub?.plan === 'trial' ? (d.trialEnds || 'Trial Ends') : (d.periodEnd || 'Period End')}
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>
            {sub?.plan === 'trial'
              ? (sub?.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString() : 'N/A')
              : (sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'N/A')}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-light)', marginTop: '4px' }}>
            {sub?.currentPeriodEnd
              ? (normalizeBillingCycle(sub.billingCycle) === 'yearly' ? (d.autoRenewsYearly || 'Auto-renews yearly') : 'Auto-renews monthly')
              : 'No expiry set'}
          </div>
        </div>
      </div>

      {/* Available Plans & Upgrades Section with Razorpay Pipeline */}
      <SubscriptionPlansClient
        plans={formattedPlans}
        currentPlanKey={planKey}
        currentStatus={sub?.status || 'inactive'}
        currentBillingCycle={normalizeBillingCycle(sub?.billingCycle)}
        currentMaxBranches={maxBranchesAllowed}
        currentMaxLoans={sub?.maxActiveLoans ?? 25}
        currentMaxAgents={sub?.maxAgents ?? 1}
        activeBranchCount={activeBranchCount}
        dict={dict}
      />

      {/* Enabled Modules */}
      <div className="card" style={{ padding: '24px', marginTop: '32px' }}>
        <h3 style={{ marginBottom: '8px', fontSize: '1rem' }}>
          {d.activeBranchModules || 'Active Branch Modules'}
        </h3>
        <p style={{ marginBottom: '16px', fontSize: '0.85rem', color: 'var(--text-light)' }}>
          {activeBranch ? activeBranch.name : 'No active branch selected'}
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {ALL_MODULES.map((key) => {
            const label = MODULE_LABELS[key];
            const isEnabled = enabledModules.includes(key);
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  background: isEnabled ? 'var(--success-bg)' : 'var(--bg)',
                  border: `1px solid ${isEnabled ? 'var(--success)' : 'var(--border)'}`,
                  color: isEnabled ? 'var(--success)' : 'var(--text-light)',
                  fontWeight: 500,
                }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
                  {isEnabled ? 'check_circle' : 'cancel'}
                </span>
                {label}
              </div>
            );
          })}
        </div>
        <p style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-light)', margin: '16px 0 0' }}>
          {d.branchModulesNote || 'Branch modules are granted by the developer. Subscription limits still control tenant plan capacity.'}
        </p>
      </div>

      {/* Premium Add-ons & Integrations */}
      <div className="card" style={{ padding: '24px', marginTop: '24px' }}>
        <h3 style={{ marginBottom: '6px', fontSize: '1rem' }}>
          {d.planFeaturesTitle || 'Features in your plan'}
        </h3>
        <p style={{ marginBottom: '20px', fontSize: '0.85rem', color: 'var(--text-light)' }}>
          {d.planFeaturesDesc || 'Premium capabilities bundled into your subscription plan. Upgrade to unlock the locked ones.'}
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
          }}
        >
          {featureCards.map((addon) => (
            <div
              key={addon.key}
              id={`feature-${addon.key}`}
              style={{
                scrollMarginTop: '24px',
                border: addon.key === highlightFeature
                  ? '2px solid var(--primary, #3b82f6)'
                  : `1px solid ${addon.active ? 'var(--success)' : 'var(--border)'}`,
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: addon.active ? 'var(--success)' : 'var(--text)',
                  }}
                >
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
              <p
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-light)',
                  lineHeight: 1.4,
                  margin: 0,
                }}
              >
                {addon.desc}
              </p>
              {!addon.active && addon.includedIn && (
                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary, #3b82f6)', margin: 0 }}>
                  {(d.includedInPlan || 'Included in {plan}').replace('{plan}', addon.includedIn)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
