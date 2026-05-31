import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId } from '@/lib/tenant';
import { getSubscription, normalizeEnabledModules } from '@/lib/subscription';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { CheckoutButton } from './CheckoutButton';
import prisma from '@/lib/db';

export default async function PortalBillingPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const role = (session.user as any)?.role;
  if (role !== 'superadmin' && role !== 'developer' && role !== 'admin') redirect('/portal');

  const tenantId = await getDefaultTenantId();
  const sub = await getSubscription(tenantId);

  const plan = sub?.plan || 'trial';
  const enabledModulesList = normalizeEnabledModules(sub?.enabledModules);

  // Fetch subscription plans catalog from DB
  const catalogPlans = await prisma.subscriptionPlanCatalog.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' }
  });

  // Fetch Invoices
  let invoices: any[] = [];
  if (sub) {
    invoices = await prisma.billingInvoice.findMany({
      where: { subscriptionId: sub.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px' }}>
      <h2 style={{ marginBottom: '24px' }}>Your Subscription</h2>

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
            {sub?.trialEndsAt && (
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Trial Ends</td>
                <td style={{ color: new Date(sub.trialEndsAt) < new Date() ? 'var(--danger)' : 'inherit' }}>
                  {formatDate(sub.trialEndsAt)}
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

      {/* Upgrade Section */}
      {plan !== 'enterprise' && catalogPlans.length > 0 && (
        <div className="card">
          <div className="card-header"><h3>Upgrade Your Plan</h3></div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '.9rem' }}>
            Unlock more loans, agents, and modules by upgrading your subscription.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            {catalogPlans
              .filter((p) => p.plan !== plan && p.plan !== 'trial')
              .map((p) => (
                <div key={p.plan} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, textTransform: 'capitalize', marginBottom: '8px' }}>{p.displayName}</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px' }}>₹{p.monthlyPrice}<span style={{ fontSize: '.75rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/mo</span></div>
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
                  <CheckoutButton planId={p.plan} />
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
                  <td>{(inv.total / 100).toFixed(2)}</td>
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
