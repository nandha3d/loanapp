import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId } from '@/lib/tenant';
import {
  getEffectiveTrialEndsAt,
  getSubscription,
  getTenantSubscriptionAccessState,
  normalizeEnabledModules,
} from '@/lib/subscription';
import { MODULE_LABELS } from '@/lib/plans';
import { formatDate } from '@/lib/utils';
import { CheckoutButton } from './CheckoutButton';
import prisma from '@/lib/db';

export default async function PortalBillingPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const role = (session.user as { role?: string }).role;
  if (role !== 'superadmin' && role !== 'developer' && role !== 'admin') redirect('/portal');

  const tenantId = await getDefaultTenantId();
  const sub = await getSubscription(tenantId);

  const plan = sub?.plan || 'trial';
  const enabledModulesList = normalizeEnabledModules(sub?.enabledModules);
  const access = getTenantSubscriptionAccessState(sub);
  const effectiveTrialEndsAt = getEffectiveTrialEndsAt(sub);

  // Lifetime license: no billing, no upgrade path — show a simple status card.
  if (plan === 'lifetime' || sub?.tenant?.customDomain) {
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px' }}>
        <h2 style={{ marginBottom: '16px' }}>Your Subscription</h2>
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="material-icons-outlined" style={{ color: 'var(--success)' }}>verified</span>
            <strong style={{ fontSize: '1.05rem' }}>Lifetime license</strong>
          </div>
          <p style={{ marginTop: '10px', color: 'var(--text-secondary)', fontSize: '.9rem' }}>
            All included — no billing, no renewals. Your enabled features are managed for you.
          </p>
          <div style={{ marginTop: '14px', fontSize: '.9rem' }}>
            <strong>Active modules:</strong>{' '}
            {enabledModulesList.map((m) => MODULE_LABELS[m] || m).join(', ') || '—'}
          </div>
        </div>
      </div>
    );
  }

  // Fetch subscription plans catalog from DB
  const catalogPlans = await prisma.subscriptionPlanCatalog.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' }
  });

  // Fetch Invoices
  const invoices = sub
    ? await prisma.billingInvoice.findMany({
        where: { subscriptionId: sub.id },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  const currentPeriodEnd = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const hasPaidCoverage = Boolean(currentPeriodEnd && !isNaN(currentPeriodEnd.getTime()) && currentPeriodEnd.getTime() >= Date.now());
  const isTrialActive = !hasPaidCoverage && Boolean(effectiveTrialEndsAt && effectiveTrialEndsAt.getTime() >= Date.now());

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px' }}>
      <h2 style={{ marginBottom: '24px' }}>Your Subscription</h2>

      {access.blocked ? (
        <div role="alert" className="card" style={{ marginBottom: 20, padding: 18, border: '1px solid #ef4444', background: '#fff7f7' }}>
          <strong style={{ color: '#991b1b' }}>Payment required</strong>
          <p style={{ color: '#7f1d1d', margin: '6px 0 0' }}>{access.message}</p>
        </div>
      ) : isTrialActive && effectiveTrialEndsAt ? (
        <div className="card" style={{ marginBottom: 20, padding: 18, border: '1px solid #f59e0b', background: '#fffbeb' }}>
          <strong>Free trial active until {formatDate(effectiveTrialEndsAt)}</strong>
          <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0' }}>
            Set up the recurring payment now. Razorpay will schedule the first charge for the end of your trial.
          </p>
        </div>
      ) : null}

      {sub?.status === 'authenticated' && sub.razorpaySubId ? (
        <div className="card" style={{ marginBottom: 20, padding: 18, border: '1px solid #22c55e', background: '#f0fdf4' }}>
          <strong style={{ color: '#166534' }}>Recurring payment authorized</strong>
          <p style={{ color: '#166534', margin: '6px 0 0' }}>
            Razorpay will make the first charge when the free trial ends. No additional checkout is required.
          </p>
        </div>
      ) : null}

      {/* Current Plan Card */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h3>Current Plan</h3>
          <span className={`badge badge-${plan === 'trial' ? 'warning' : 'success'}`} style={{ fontSize: '.9rem', padding: '4px 10px', textTransform: 'capitalize' }}>
            {plan}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', padding: '8px 0' }}>
          <div className="stat-item" style={{ textAlign: 'center', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>
              {sub?.maxActiveLoans === 999999 ? 'Unlimited' : (sub?.maxActiveLoans ?? 50)}
            </div>
            <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>Max Active Loans</div>
          </div>
          <div className="stat-item" style={{ textAlign: 'center', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>
              {sub?.maxAgents === 999 ? 'Unlimited' : (sub?.maxAgents ?? 3)}
            </div>
            <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>Max Agents</div>
          </div>
          <div className="stat-item" style={{ textAlign: 'center', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{enabledModulesList.length}</div>
            <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>Active Modules</div>
          </div>
        </div>

        <table style={{ width: '100%', marginTop: '12px' }}>
          <tbody>
            <tr>
              <td style={{ color: 'var(--text-secondary)', width: '40%' }}>Status</td>
              <td><span className={`badge badge-${sub?.status === 'active' ? 'success' : 'danger'}`}>{sub?.status || 'active'}</span></td>
            </tr>
            <tr>
              <td style={{ color: 'var(--text-secondary)' }}>Enabled Modules</td>
              <td>{enabledModulesList.join(', ')}</td>
            </tr>
            {!hasPaidCoverage && effectiveTrialEndsAt && (
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Trial Ends</td>
                <td style={{ color: effectiveTrialEndsAt < new Date() ? 'var(--danger)' : 'inherit' }}>
                  {formatDate(effectiveTrialEndsAt)}
                </td>
              </tr>
            )}
            {sub?.currentPeriodEnd && (
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Renews</td>
                <td>{formatDate(sub.currentPeriodEnd)}</td>
              </tr>
            )}
            {sub && sub.plan !== 'trial' && (
              <>
                <tr>
                  <td style={{ color: 'var(--text-secondary)' }}>Base Plan Price</td>
                  <td>₹{sub.basePlanPrice}/mo</td>
                </tr>
                {sub.modulesPrice > 0 && (
                  <tr>
                    <td style={{ color: 'var(--text-secondary)' }}>Modules Charge</td>
                    <td>₹{sub.modulesPrice}/mo</td>
                  </tr>
                )}
                {sub.addonsPrice > 0 && (
                  <tr>
                    <td style={{ color: 'var(--text-secondary)' }}>Add-ons Charge</td>
                    <td>+₹{sub.addonsPrice}/mo</td>
                  </tr>
                )}
                <tr style={{ fontWeight: 600 }}>
                  <td style={{ color: 'var(--text-primary)' }}>Total Monthly Cost</td>
                  <td style={{ color: 'var(--primary)' }}>₹{sub.totalMonthlyPrice}/mo</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Subscribe / renew section */}
      {catalogPlans.length > 0 && sub?.status !== 'authenticated' && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>Choose Your Subscription</h3>
          </div>
          <p style={{ color: '#475569', marginBottom: '20px', fontSize: '.92rem' }}>
            Choose a subscription plan configured for your organization. Payment is handled securely by Razorpay.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            {catalogPlans.map((p) => {
              const isPopular = p.plan === 'business';
              const isCurrent = p.plan === plan && sub?.currentPeriodEnd && sub.currentPeriodEnd >= new Date();
              const isFree = p.monthlyPrice === 0;
              return (
                <div
                  key={p.plan}
                  style={{
                    padding: '24px 20px',
                    backgroundColor: '#ffffff',
                    border: isPopular ? '2px solid #7D287E' : '1.5px solid #cbd5e1',
                    borderRadius: '12px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    boxShadow: isPopular ? '0 10px 25px -5px rgba(125, 40, 126, 0.15)' : '0 2px 8px rgba(0,0,0,0.05)',
                  }}
                >
                  {isPopular && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-12px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#7D287E',
                        color: '#ffffff',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '3px 14px',
                        borderRadius: '20px',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        boxShadow: '0 2px 6px rgba(125, 40, 126, 0.3)',
                      }}
                    >
                      Most Popular
                    </span>
                  )}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#0f172a', textTransform: 'capitalize', marginBottom: '8px' }}>
                      {p.displayName}
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '14px' }}>
                      {isFree ? 'Free' : `INR ${p.monthlyPrice.toLocaleString('en-IN')}`}
                      {!isFree && <span style={{ fontSize: '.85rem', fontWeight: 600, color: '#64748b' }}>/mo</span>}
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '12px 8px', marginBottom: '14px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '.92rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                        {p.maxActiveLoans === 999999 ? 'Unlimited' : p.maxActiveLoans} active loans
                      </div>
                      <div style={{ fontSize: '.88rem', fontWeight: 600, color: '#334155' }}>
                        {p.maxAgents === 999 ? 'Unlimited' : p.maxAgents} staff / agents
                      </div>
                    </div>
                    <div style={{ fontSize: '.84rem', color: '#475569', marginBottom: '18px', minHeight: '40px', lineHeight: 1.4 }}>
                      {p.description}
                    </div>
                  </div>
                  {isCurrent ? (
                    <span className="badge badge-success" style={{ padding: '10px', fontSize: '0.88rem', fontWeight: 700 }}>
                      Paid plan active
                    </span>
                  ) : (
                    <CheckoutButton
                      planId={p.plan}
                      label="Pay & Activate"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Full Feature Comparison Table */}
          <div style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
            <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '16px' }}>
              Full Feature Comparison
            </h4>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a', minWidth: '220px' }}>Features & Capabilities</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a', textAlign: 'center', width: '22%' }}>Basic</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, color: '#7D287E', backgroundColor: '#fbf5fc', textAlign: 'center', width: '26%' }}>
                      Business <span style={{ fontSize: '0.72rem', backgroundColor: '#7D287E', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>Popular</span>
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a', textAlign: 'center', width: '22%' }}>Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Category 1 */}
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    <td colSpan={4} style={{ padding: '8px 16px', fontWeight: 800, fontSize: '0.78rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Core Capacity & Limits
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Active Loans Capacity</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>200 Loans</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#7D287E', backgroundColor: '#fcf8fd' }}>1,000 Loans</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>Unlimited</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Staff & Field Agents</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#334155' }}>5 Accounts</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#7D287E', backgroundColor: '#fcf8fd' }}>25 Accounts</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>Unlimited</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Branch Offices</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#334155' }}>2 Branches</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#7D287E', backgroundColor: '#fcf8fd' }}>5 Branches</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>Unlimited</td>
                  </tr>

                  {/* Category 2 */}
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    <td colSpan={4} style={{ padding: '8px 16px', fontWeight: 800, fontSize: '0.78rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Lending Products & Verticals
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Daily / Weekly Micro Lending</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700, backgroundColor: '#fcf8fd' }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Auto Finance & Vehicle Loans</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700, backgroundColor: '#fcf8fd' }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Chit Funds Management</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#64748b' }}>Add-on (₹299/mo)</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700, backgroundColor: '#fcf8fd' }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Gold Loans & Collateral Vault</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#64748b' }}>Add-on (₹299/mo)</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700, backgroundColor: '#fcf8fd' }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                  </tr>

                  {/* Category 3 */}
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    <td colSpan={4} style={{ padding: '8px 16px', fontWeight: 800, fontSize: '0.78rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Field Operations & Automation
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Mobile App (Android & iOS)</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700, backgroundColor: '#fcf8fd' }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Live GPS Agent Tracking</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700, backgroundColor: '#fcf8fd' }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Speech-to-Text Voice Entry</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700, backgroundColor: '#fcf8fd' }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Offline Sync Queue (No Internet)</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700, backgroundColor: '#fcf8fd' }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                  </tr>

                  {/* Category 4 */}
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    <td colSpan={4} style={{ padding: '8px 16px', fontWeight: 800, fontSize: '0.78rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Receipts, Billing & Accounting
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Digital PDF Receipts & Thermal Print</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700, backgroundColor: '#fcf8fd' }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Day-Book & Cash Reconciliation</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700, backgroundColor: '#fcf8fd' }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Full Double-Entry P&L Statements</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#94a3b8' }}>—</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700, backgroundColor: '#fcf8fd' }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Automatic NPA Classification</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#94a3b8' }}>—</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700, backgroundColor: '#fcf8fd' }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Credit Bureau Pulls (CRIF/CIBIL)</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#94a3b8' }}>—</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700, backgroundColor: '#fcf8fd' }}>✓ Included</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                  </tr>

                  {/* Category 5 */}
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    <td colSpan={4} style={{ padding: '8px 16px', fontWeight: 800, fontSize: '0.78rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Alerts & Premium Support
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Automated SMS & WhatsApp Alerts</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#64748b' }}>SMS Only</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700, backgroundColor: '#fcf8fd' }}>✓ SMS + WhatsApp</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ SMS + WhatsApp</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Customer Support Level</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#334155' }}>Email Support</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#7D287E', backgroundColor: '#fcf8fd' }}>Priority Support</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>Dedicated Manager</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>Custom White-Label Branding</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#94a3b8' }}>—</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#94a3b8', backgroundColor: '#fcf8fd' }}>—</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>✓ Included</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Invoice History */}
      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header">
          <h3>Invoice History</h3>
        </div>
        {invoices.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', padding: '16px', textAlign: 'center' }}>
            No invoices found.
          </p>
        ) : (
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{formatDate(inv.createdAt)}</td>
                  <td>INR {Number(inv.total).toFixed(2)}</td>
                  <td>
                    <span className={`badge badge-${inv.status === 'paid' ? 'success' : 'danger'}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <a href={`/api/portal/invoices/${inv.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline">
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
