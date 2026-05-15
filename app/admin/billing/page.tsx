import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { normalizeEnabledModules } from '@/lib/subscription';

export default async function AdminBillingPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'developer') redirect('/dashboard');

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'asc' },
    include: { subscription: true },
  });

  const PLAN_COLORS: Record<string, string> = {
    trial: 'warning',
    basic: 'info',
    pro: 'success',
    enterprise: 'purple',
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>💳 Tenant Subscriptions</h3>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Max Loans</th>
              <th>Max Agents</th>
              <th>Enabled Modules</th>
              <th>Expires</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => {
              const sub = t.subscription;
              return (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong><br /><span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{t.slug}</span></td>
                  <td>
                    {sub ? (
                      <span className={`badge badge-${PLAN_COLORS[sub.plan] || 'secondary'}`}>{sub.plan}</span>
                    ) : (
                      <span className="badge badge-secondary">none</span>
                    )}
                  </td>
                  <td>
                    {sub ? (
                      <span className={`badge badge-${sub.status === 'active' ? 'success' : 'danger'}`}>{sub.status}</span>
                    ) : '—'}
                  </td>
                  <td>{sub?.maxActiveLoans ?? '—'}</td>
                  <td>{sub?.maxAgents ?? '—'}</td>
                  <td style={{ fontSize: '.78rem' }}>{sub?.enabledModules ? normalizeEnabledModules(sub.enabledModules).join(', ') : '—'}</td>
                  <td>{sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : sub?.trialEndsAt ? `Trial ends ${formatDate(sub.trialEndsAt)}` : '—'}</td>
                  <td>
                    <Link href={`/admin/billing/${t.id}`} className="btn btn-ghost btn-sm">Manage</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
