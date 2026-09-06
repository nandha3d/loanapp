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
    where: { isActive: true, monthlyPrice: { gt: 0 } },
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
        <div className="card">
          <div className="card-header"><h3>Choose Your Subscription</h3></div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '.9rem' }}>
            Prices include all {Math.max(enabledModulesList.length, 1)} active verticals and your existing add-ons. Payment is handled securely by Razorpay.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            {catalogPlans.map((p) => (
                <div key={p.plan} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, textTransform: 'capitalize', marginBottom: '8px' }}>{p.displayName}</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px' }}>INR {p.monthlyPrice * Math.max(enabledModulesList.length, 1) + (sub?.addonsPrice ?? 0)}<span style={{ fontSize: '.75rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/mo</span></div>
                    <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      {p.maxActiveLoans === 999999 ? 'Unlimited' : p.maxActiveLoans} active loans
                    </div>
                    <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      {p.maxAgents === 999 ? 'Unlimited' : p.maxAgents} agents
                    </div>
                    <div style={{ fontSize: '.75rem', color: 'var(--text-light)', marginBottom: '12px', minHeight: '36px' }}>
                      {p.description}
                    </div>
                  </div>
                  {p.plan === plan && sub?.currentPeriodEnd && sub.currentPeriodEnd >= new Date() ? (
                    <span className="badge badge-success" style={{ padding: 8 }}>Paid plan active</span>
                  ) : (
                    <CheckoutButton
                      planId={p.plan}
                      label={p.plan === plan
                        ? (access.blocked ? 'Renew current plan' : 'Set up recurring payment')
                        : `Choose ${p.displayName}`}
                    />
                  )}
                </div>
              ))}
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
