import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { getDictionary } from '@/lib/i18n';
import { getActiveBranchId } from '@/lib/branch';

export default async function ChitsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  if (!session) redirect('/login');
  if (userRole === 'agent') redirect('/collection');

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const dict = await getDictionary(tenantId);
  try {
    await requireModule(tenantId, 'chitfunds');
  } catch {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
        <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--border)' }}>lock</span>
        <h3 style={{ margin: '16px 0 8px' }}>Module Not Enabled</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
          The Chit Funds module is not included in your current subscription plan.
        </p>
        <Link href="/subscription" className="btn btn-primary">View Subscription</Link>
      </div>
    );
  }
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const resolvedParams = await searchParams;
  const status = resolvedParams.status || '';
  const q = resolvedParams.q || '';

  const branchId = await getActiveBranchId();
  const where: any = { tenantId, appType };
  if (branchId) where.branchId = branchId;
  if (status) where.status = status;
  if (q) where.name = { contains: q };

  let groups: any[] = [];
  let activeCount = 0;
  let completedCount = 0;
  let dbError: string | null = null;

  try {
    [groups, activeCount, completedCount] = await Promise.all([
      prisma.chitGroup.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { members: true, auctions: true } },
          auctions: { where: { status: 'completed' }, select: { id: true } },
        },
      }),
      prisma.chitGroup.count({ where: { tenantId, appType, status: 'active', ...(branchId ? { branchId } : {}) } }),
      prisma.chitGroup.count({ where: { tenantId, appType, status: 'completed', ...(branchId ? { branchId } : {}) } }),
    ]);
  } catch (e: any) {
    dbError = e.message || 'Database tables not yet migrated. Run: npx prisma migrate deploy';
  }

  if (dbError) {
    return (
      <div className="card" style={{ padding: '24px', color: '#b91c1c' }}>
        <strong>Database not ready:</strong> {dbError}
      </div>
    );
  }

  return (
    <div>
      <div className="kpi-grid" style={{ marginBottom: '20px' }}>
        <div className="kpi-card">
          <div className="kpi-icon green"><span className="material-icons-outlined">savings</span></div>
          <div><div className="kpi-value">{activeCount}</div><div className="kpi-label">{dict.chits.activeGroups}</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon blue"><span className="material-icons-outlined">check_circle</span></div>
          <div><div className="kpi-value">{completedCount}</div><div className="kpi-label">{dict.chits.completedGroups}</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange"><span className="material-icons-outlined">groups</span></div>
          <div><div className="kpi-value">{groups.reduce((s, g) => s + g._count.members, 0)}</div><div className="kpi-label">{dict.chits.totalMembers}</div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>💰 {dict.chits.chitFundGroups}</h3>
          <Link href="/chits/new" className="btn btn-primary btn-sm">
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>add</span> {dict.chits.newChitGroup}
          </Link>
        </div>

        <form method="GET" className="filter-bar" style={{ marginBottom: '16px' }}>
          <input name="q" type="text" className="form-control" placeholder={dict.chits.searchPlaceholder} defaultValue={q} style={{ maxWidth: '240px' }} />
          <select name="status" className="form-control" style={{ width: 'auto' }} defaultValue={status}>
            <option value="">{dict.chits.allStatus}</option>
            <option value="active">{dict.chits.active}</option>
            <option value="completed">{dict.chits.completed}</option>
            <option value="cancelled">{dict.chits.cancelled}</option>
          </select>
          <button type="submit" className="btn btn-secondary">{dict.chits.filter}</button>
        </form>

        {groups.length === 0 ? (
          <div className="empty-state">
            <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--text-light)' }}>savings</span>
            <p>{dict.chits.noChits}</p>
            <Link href="/chits/new" className="btn btn-primary btn-sm">{dict.chits.createFirst}</Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{dict.chits.name}</th>
                  <th>{dict.chits.chitValue}</th>
                  <th>{dict.chits.monthly}</th>
                  <th>{dict.chits.members}</th>
                  <th>{dict.chits.auctionsDone}</th>
                  <th>{dict.chits.startDate}</th>
                  <th>{dict.chits.status}</th>
                  <th>{dict.chits.action}</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td><strong>{g.name}</strong></td>
                    <td>{formatCurrency(Number(g.chitValue), currencySymbol)}</td>
                    <td>{formatCurrency(Number(g.monthlyContrib), currencySymbol)}</td>
                    <td>{g._count.members} / {g.totalMembers}</td>
                    <td>{g.auctions.length} / {g.durationMonths}</td>
                    <td>{formatDate(g.startDate)}</td>
                    <td><span className={`badge badge-${g.status === 'active' ? 'success' : g.status === 'completed' ? 'info' : 'secondary'}`}>{g.status}</span></td>
                    <td><Link href={`/chits/${g.id}`} className="btn btn-ghost btn-sm">{dict.chits.view}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
