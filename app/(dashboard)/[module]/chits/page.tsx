import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getSetting } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from '@/components/layout/DashboardLink';
import { getDictionary } from '@/lib/i18n';
import { getActiveBranchId } from '@/lib/branch';
import { modulePath } from '@/types/modules';

export default async function ChitsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  if (!session) redirect('/login');

  const tenantId = await getDefaultTenantId();
  const appType = 'chitfunds';
  if (userRole === 'agent') redirect(modulePath(appType, '/collection'));
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
          auctions: {
            orderBy: { periodNumber: 'asc' },
            select: { id: true, periodNumber: true, status: true, scheduledAt: true, auctionDate: true, roomStatus: true },
          },
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {groups.map((g) => {
              const completedAuctions = g.auctions.filter((a: any) => ['confirmed', 'paid', 'completed'].includes(a.status));
              const nextAuction = g.auctions.find((a: any) => ['pending', 'notice_sent', 'in_progress'].includes(a.status));
              return (
                <div key={g.id} className="card" style={{ padding: '14px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                    <div>
                      <h4 style={{ margin: 0 }}>{g.name}</h4>
                      <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{g.groupCode ?? g.id}</div>
                    </div>
                    <span className={`badge badge-${g.status === 'active' ? 'success' : g.status === 'completed' ? 'info' : 'secondary'}`}>{g.status}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '.84rem', marginBottom: '12px' }}>
                    <span>{dict.chits.chitValue}<br /><strong>{formatCurrency(Number(g.chitValue), currencySymbol)}</strong></span>
                    <span>{dict.chits.monthly}<br /><strong>{formatCurrency(Number(g.monthlyContrib), currencySymbol)}</strong></span>
                    <span>{dict.chits.members}<br /><strong>{g._count.members} / {g.totalMembers}</strong></span>
                    <span>{dict.chits.auctionsDone}<br /><strong>{completedAuctions.length} / {g.durationMonths}</strong></span>
                  </div>
                  <div style={{ fontSize: '.82rem', color: 'var(--text-secondary)', minHeight: '38px', marginBottom: '12px' }}>
                    {nextAuction
                      ? <>Next auction: Period {nextAuction.periodNumber} · {formatDate(nextAuction.scheduledAt ?? nextAuction.auctionDate)} {nextAuction.scheduledAt ? new Date(nextAuction.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</>
                      : <>Started {formatDate(g.startDate)}</>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Link href={`/chits/${g.id}`} className="btn btn-ghost btn-sm">{dict.chits.view}</Link>
                    {nextAuction && (
                      <Link href={`/chits/${g.id}/auctions/${nextAuction.id}`} className="btn btn-secondary btn-sm">
                        {g.auctionType === 'open_live' ? 'Enter room' : 'Manage auction'}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
