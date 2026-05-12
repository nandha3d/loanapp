import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting } from '@/lib/tenant';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';

export default async function ChitsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const tenantId = await getDefaultTenantId();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const resolvedParams = await searchParams;
  const status = resolvedParams.status || '';
  const q = resolvedParams.q || '';

  const where: any = { tenantId };
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
      prisma.chitGroup.count({ where: { tenantId, status: 'active' } }),
      prisma.chitGroup.count({ where: { tenantId, status: 'completed' } }),
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
          <div><div className="kpi-value">{activeCount}</div><div className="kpi-label">Active Chit Groups</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon blue"><span className="material-icons-outlined">check_circle</span></div>
          <div><div className="kpi-value">{completedCount}</div><div className="kpi-label">Completed Groups</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange"><span className="material-icons-outlined">groups</span></div>
          <div><div className="kpi-value">{groups.reduce((s, g) => s + g._count.members, 0)}</div><div className="kpi-label">Total Members</div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>💰 Chit Fund Groups</h3>
          <Link href="/chits/new" className="btn btn-primary btn-sm">
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>add</span> New Chit Group
          </Link>
        </div>

        <form method="GET" className="filter-bar" style={{ marginBottom: '16px' }}>
          <input name="q" type="text" className="form-control" placeholder="Search by name..." defaultValue={q} style={{ maxWidth: '240px' }} />
          <select name="status" className="form-control" style={{ width: 'auto' }} defaultValue={status}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button type="submit" className="btn btn-secondary">Filter</button>
        </form>

        {groups.length === 0 ? (
          <div className="empty-state">
            <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--text-light)' }}>savings</span>
            <p>No chit groups found.</p>
            <Link href="/chits/new" className="btn btn-primary btn-sm">Create First Group</Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Chit Value</th>
                  <th>Monthly</th>
                  <th>Members</th>
                  <th>Auctions Done</th>
                  <th>Start Date</th>
                  <th>Status</th>
                  <th>Action</th>
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
                    <td><Link href={`/chits/${g.id}`} className="btn btn-ghost btn-sm">View</Link></td>
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
