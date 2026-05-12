import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { updateSubscription } from '../billingActions';

const PLANS = ['trial', 'basic', 'pro', 'enterprise'];
const MODULES = ['microlending', 'autofinance', 'chitfunds'];

export default async function TenantBillingPage({ params }: { params: { tenantId: string } }) {
  const { tenantId } = await params;
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'developer') redirect('/dashboard');

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: true },
  });
  if (!tenant) notFound();

  const sub = tenant.subscription;
  const enabledModulesList = sub?.enabledModules?.split(',') || ['microlending'];

  return (
    <div className="card" style={{ maxWidth: '560px' }}>
      <div className="card-header">
        <h3>Manage Subscription — {tenant.name}</h3>
      </div>

      <form action={updateSubscription}>
        <input type="hidden" name="tenantId" value={tenantId} />

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label">Plan</label>
          <select name="plan" className="form-control" defaultValue={sub?.plan || 'trial'}>
            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label">Status</label>
          <select name="status" className="form-control" defaultValue={sub?.status || 'active'}>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div className="form-group">
            <label className="form-label">Max Active Loans</label>
            <input name="maxActiveLoans" type="number" className="form-control" defaultValue={sub?.maxActiveLoans ?? 50} min="1" />
          </div>
          <div className="form-group">
            <label className="form-label">Max Agents</label>
            <input name="maxAgents" type="number" className="form-control" defaultValue={sub?.maxAgents ?? 3} min="1" />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label">Enabled Modules</label>
          <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
            {MODULES.map((m) => (
              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="enabledModules"
                  value={m}
                  defaultChecked={enabledModulesList.includes(m)}
                />
                {m}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div className="form-group">
            <label className="form-label">Trial Ends At</label>
            <input name="trialEndsAt" type="date" className="form-control" defaultValue={sub?.trialEndsAt ? sub.trialEndsAt.toISOString().split('T')[0] : ''} />
          </div>
          <div className="form-group">
            <label className="form-label">Current Period End</label>
            <input name="currentPeriodEnd" type="date" className="form-control" defaultValue={sub?.currentPeriodEnd ? sub.currentPeriodEnd.toISOString().split('T')[0] : ''} />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label className="form-label">Razorpay Sub ID</label>
          <input name="razorpaySubId" type="text" className="form-control" defaultValue={sub?.razorpaySubId || ''} placeholder="sub_xxx..." />
        </div>

        <button type="submit" className="btn btn-primary">Save Changes</button>
      </form>
    </div>
  );
}
