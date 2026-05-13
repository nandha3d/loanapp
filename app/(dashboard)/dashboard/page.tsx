import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getBranding, getUserAppType } from '@/lib/tenant';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getDictionary } from '@/lib/i18n';
import Link from 'next/link';
import { redirect } from 'next/navigation';

async function getDashboardData(tenantId: string, appType: string, adminBranchId?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Branch-scoped base filter for admin role
  const loanWhere: any = { tenantId, appType };
  const customerWhere: any = { tenantId, appType };
  if (adminBranchId) {
    // Include records from admin's branch AND unscoped (null branchId) records
    const branchFilter = { OR: [{ branchId: adminBranchId }, { branchId: null }] };
    Object.assign(loanWhere, branchFilter);
    Object.assign(customerWhere, branchFilter);
  }

  // Get counts and aggregates
  const [
    activeLoans,
    overdueLoans,
    totalCustomers,
    totalAgents,
    recentLoans,
    todayInstalments,
    todayPaidInstalments,
    pendingPenalties,
    routes,
    recentActivity,
  ] = await Promise.all([
    // Active loans count
    prisma.loan.count({ where: { ...loanWhere, status: 'active' } }),
    // Overdue loans count
    prisma.loan.count({ where: { ...loanWhere, status: 'overdue' } }),
    // Total customers
    prisma.customer.count({ where: { ...customerWhere, status: { not: 'blacklisted' } } }),
    // Total agents (not branch-scoped — agents are shared)
    prisma.user.count({ where: { tenantId, appType, role: 'agent', status: 'active' } }),
    // Loans created this month
    prisma.loan.count({
      where: {
        ...loanWhere,
        createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) },
      },
    }),
    // Today's expected instalments
    prisma.instalment.findMany({
      where: {
        loan: { ...loanWhere },
        dueDate: { gte: today, lt: tomorrow },
      },
      include: { loan: { include: { customer: true } } },
    }),
    // Today's paid instalments
    prisma.instalment.count({
      where: {
        loan: { ...loanWhere },
        dueDate: { gte: today, lt: tomorrow },
        status: 'paid',
      },
    }),
    // Pending penalties
    prisma.penalty.aggregate({
      where: { loan: { ...loanWhere }, status: 'pending' },
      _sum: { grossPenalty: true },
      _count: true,
    }),
    // Routes with agent info
    prisma.route.findMany({
      where: { tenantId, appType, status: 'active' },
      include: { assignedAgent: true, _count: { select: { customers: true } } },
    }),
    // Recent audit log — exclude actions performed by developer accounts
    prisma.auditLog.findMany({
      where: {
        tenantId,
        user: { role: { not: 'developer' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: true },
    }),
  ]);

  // Calculate today's collection
  const todayExpected = todayInstalments.reduce((sum, i) => sum + Number(i.dueAmount), 0);
  const todayCollected = todayInstalments
    .filter(i => i.status === 'paid' || i.status === 'partial')
    .reduce((sum, i) => sum + Number(i.receivedAmount), 0);

  // Get defaulters (overdue customers)
  const defaulters = await prisma.loan.findMany({
    where: { ...loanWhere, status: 'overdue' },
    include: {
      customer: true,
      penalties: { where: { status: 'pending' } },
    },
    take: 5,
  });

  // Loans closing this week
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const closingThisWeek = await prisma.loan.count({
    where: {
      ...loanWhere,
      status: 'active',
      endDate: { gte: today, lte: weekEnd },
    },
  });

  // Auto Finance extras (not branch-scoped for vehicles)
  let repoFlaggedCount = 0;
  let insuranceExpiringCount = 0;
  if (appType === 'autofinance') {
    try {
      const in30 = new Date();
      in30.setDate(in30.getDate() + 30);
      [repoFlaggedCount, insuranceExpiringCount] = await Promise.all([
        prisma.vehicle.count({ where: { tenantId, repoFlag: true } }),
        prisma.vehicle.count({ where: { tenantId, insuranceExpiry: { lte: in30, gte: new Date() } } }),
      ]);
    } catch { /* table may not exist yet */ }
  }

  // Chit Fund extras
  let activeChitGroups = 0;
  if (appType === 'chitfunds') {
    try {
      activeChitGroups = await prisma.chitGroup.count({ where: { tenantId, status: 'active' } });
    } catch { /* table may not exist yet */ }
  }

  return {
    activeLoans,
    overdueLoans,
    totalCustomers,
    totalAgents,
    recentLoans,
    todayExpected,
    todayCollected,
    todayPaidInstalments,
    totalTodayInstalments: todayInstalments.length,
    pendingPenaltyTotal: Number(pendingPenalties._sum.grossPenalty || 0),
    pendingPenaltyCount: pendingPenalties._count,
    defaulters,
    closingThisWeek,
    routes,
    recentActivity,
    repoFlaggedCount,
    insuranceExpiringCount,
    activeChitGroups,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  if (userRole === 'agent') redirect('/collection');

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const branding = await getBranding(tenantId);
  const dict = await getDictionary(tenantId);

  const userBranchId = (session?.user as any)?.branchId as string | undefined;
  // Scope dashboard data to branch for admin role
  const adminBranchId = userRole === 'admin' && userBranchId ? userBranchId : undefined;
  const data = await getDashboardData(tenantId, appType, adminBranchId);

  const collectionGap = data.todayExpected - data.todayCollected;

  return (
    <>
      {/* KPI Row 1 */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon green">
            <span className="material-icons-outlined">trending_up</span>
          </div>
          <div>
            <div className="kpi-value">{formatCurrency(data.todayExpected, branding.currencySymbol)}</div>
            <div className="kpi-label">{dict.dashboard.expectedCollection}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange">
            <span className="material-icons-outlined">account_balance_wallet</span>
          </div>
          <div>
            <div className="kpi-value">{formatCurrency(data.todayCollected, branding.currencySymbol)}</div>
            <div className="kpi-label">{dict.dashboard.actualCollected}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon red">
            <span className="material-icons-outlined">trending_down</span>
          </div>
          <div>
            <div className="kpi-value">{formatCurrency(collectionGap, branding.currencySymbol)}</div>
            <div className="kpi-label">{dict.dashboard.collectionGap}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon blue">
            <span className="material-icons-outlined">credit_card</span>
          </div>
          <div>
            <div className="kpi-value">{data.activeLoans}</div>
            <div className="kpi-label">{dict.dashboard.activeLoans}</div>
          </div>
        </div>
      </div>

      {/* KPI Row 2 */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon red">
            <span className="material-icons-outlined">warning</span>
          </div>
          <div>
            <div className="kpi-value">{data.overdueLoans}</div>
            <div className="kpi-label">{dict.dashboard.totalDefaulters}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon purple">
            <span className="material-icons-outlined">gavel</span>
          </div>
          <div>
            <div className="kpi-value">{formatCurrency(data.pendingPenaltyTotal, branding.currencySymbol)}</div>
            <div className="kpi-label">{dict.dashboard.penaltyAccumulated}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon blue">
            <span className="material-icons-outlined">event</span>
          </div>
          <div>
            <div className="kpi-value">{data.closingThisWeek}</div>
            <div className="kpi-label">{dict.dashboard.closingThisWeek}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon green">
            <span className="material-icons-outlined">add_circle</span>
          </div>
          <div>
            <div className="kpi-value">{data.recentLoans}</div>
            <div className="kpi-label">{dict.dashboard.newLoansMonth}</div>
          </div>
        </div>
      </div>

      {/* Auto Finance KPIs */}
      {appType === 'autofinance' && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon red"><span className="material-icons-outlined">car_crash</span></div>
            <div>
              <div className="kpi-value">{data.repoFlaggedCount}</div>
              <div className="kpi-label">Repo Flagged Vehicles</div>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon orange"><span className="material-icons-outlined">policy</span></div>
            <div>
              <div className="kpi-value">{data.insuranceExpiringCount}</div>
              <div className="kpi-label">Insurance Expiring (30d)</div>
            </div>
          </div>
          <Link href="/vehicles?filter=repo" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="kpi-icon blue"><span className="material-icons-outlined">directions_car</span></div>
            <div>
              <div className="kpi-value">View Vehicles</div>
              <div className="kpi-label">Vehicle Registry</div>
            </div>
          </Link>
        </div>
      )}

      {/* Chit Fund KPIs */}
      {appType === 'chitfunds' && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon green"><span className="material-icons-outlined">savings</span></div>
            <div>
              <div className="kpi-value">{data.activeChitGroups}</div>
              <div className="kpi-label">Active Chit Groups</div>
            </div>
          </div>
          <Link href="/chits" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="kpi-icon blue"><span className="material-icons-outlined">groups</span></div>
            <div>
              <div className="kpi-value">Manage Chits</div>
              <div className="kpi-label">Chit Fund Manager</div>
            </div>
          </Link>
        </div>
      )}

      <div className="grid-60-40">
        {/* Defaulter Alerts */}
        <div className="card">
          <div className="card-header">
            <h3>⚠️ {dict.dashboard.defaulterAlerts}</h3>
            <Link href="/customers?filter=overdue" className="btn btn-ghost btn-sm">{dict.dashboard.viewAll}</Link>
          </div>
          {data.defaulters.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Route</th>
                    <th>Penalty</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.defaulters.map((loan) => {
                    const totalPenalty = loan.penalties.reduce((s, p) => s + Number(p.grossPenalty), 0);
                    return (
                      <tr key={loan.id}>
                        <td>
                          <strong>{loan.customer.name}</strong>
                          <br />
                          <span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{loan.customer.customerCode}</span>
                        </td>
                        <td>{loan.loanCode}</td>
                        <td style={{ color: 'var(--danger)', fontWeight: 600 }}>
                          {formatCurrency(totalPenalty, branding.currencySymbol)}
                        </td>
                        <td>
                          <Link href={`/customers/${loan.customer.customerCode}`} className="btn btn-ghost btn-sm">View</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '24px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '36px', color: 'var(--success)' }}>check_circle</span>
              <p style={{ marginTop: '8px', fontSize: '.85rem', color: 'var(--text-secondary)' }}>{dict.dashboard.noDefaulters}</p>
            </div>
          )}
        </div>

        {/* Route Performance */}
        <div className="card">
          <div className="card-header"><h3>📊 {dict.dashboard.routePerformance}</h3></div>
          {data.routes.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Agent</th>
                    <th>Customers</th>
                  </tr>
                </thead>
                <tbody>
                  {data.routes.map((route) => (
                    <tr key={route.id}>
                      <td><strong>{route.name}</strong></td>
                      <td>{route.assignedAgent?.name || '—'}</td>
                      <td>{route._count.customers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '24px' }}>
              <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>{dict.dashboard.noRoutes}</p>
              <Link href="/settings" className="btn btn-primary btn-sm" style={{ marginTop: '8px' }}>{dict.dashboard.configureRoutes}</Link>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header"><h3>🕐 {dict.dashboard.recentActivity}</h3></div>
        {data.recentActivity.length > 0 ? (
          <div>
            {data.recentActivity.map((log) => (
              <div className="activity-item" key={log.id}>
                <div className="activity-dot"></div>
                <div style={{ flex: 1 }}>
                  <div className="activity-text">
                    <strong>{log.user?.name || 'System'}</strong> — {log.action} {log.entityType}
                  </div>
                  <div className="activity-time">{formatDate(log.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-light)', fontSize: '.85rem' }}>
            No activity recorded yet. Start by adding customers and creating loans.
          </div>
        )}
      </div>
    </>
  );
}
