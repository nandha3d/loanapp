import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getBranding, getUserAppType } from '@/lib/tenant';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { redirect } from 'next/navigation';

type DashboardInstalment = {
  id: string;
  dueDate: Date;
  dueAmount: unknown;
  receivedAmount: unknown;
  status: string;
  loan: {
    id: string;
    loanCode: string;
    penaltyRate: unknown;
    customer: {
      id: string;
      name: string;
      customerCode: string;
      route?: { id: string; name: string } | null;
    };
  };
};

function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function outstanding(instalment: Pick<DashboardInstalment, 'dueAmount' | 'receivedAmount'>) {
  return Math.max(0, Number(instalment.dueAmount) - Number(instalment.receivedAmount || 0));
}

function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
}

async function getDashboardData(tenantId: string, appType: string, adminBranchId?: string) {
  const today = startOfDay();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);

  const branchFilter = adminBranchId ? { OR: [{ branchId: adminBranchId }, { branchId: null }] } : {};
  const loanWhere: any = { tenantId, appType, ...branchFilter };
  const customerWhere: any = { tenantId, appType, ...branchFilter };

  const [
    totalCustomers,
    recentLoans,
    pendingApprovals,
    routes,
    todayInstalments,
    overdueInstalmentsRaw,
    weekInstalments,
    pendingPenalties,
    recentActivity,
  ] = await Promise.all([
    prisma.customer.count({ where: { ...customerWhere, status: 'active' } }),
    prisma.loan.count({
      where: {
        ...loanWhere,
        createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) },
      },
    }),
    prisma.approvalRequest.count({ where: { tenantId, appType, status: 'pending' } }),
    prisma.route.findMany({
      where: { tenantId, appType, status: 'active' },
      include: {
        assignedAgent: true,
        customers: {
          select: {
            id: true,
            loans: {
              where: { status: { in: ['active', 'overdue'] } },
              select: {
                instalments: {
                  where: { dueDate: { lt: today }, status: { in: ['upcoming', 'missed', 'partial'] } },
                  select: { dueAmount: true, receivedAmount: true },
                },
              },
            },
          },
        },
        _count: { select: { customers: true } },
      },
    }),
    prisma.instalment.findMany({
      where: {
        loan: { ...loanWhere, status: { in: ['active', 'overdue', 'closed'] } },
        dueDate: { gte: today, lt: tomorrow },
      },
      include: { loan: { include: { customer: { include: { route: true } } } } },
      orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
    }),
    prisma.instalment.findMany({
      where: {
        loan: { ...loanWhere, status: { in: ['active', 'overdue'] } },
        dueDate: { lt: today },
        status: { in: ['upcoming', 'missed', 'partial'] },
      },
      include: { loan: { include: { customer: { include: { route: true } } } } },
      orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
      take: 10,
    }),
    prisma.instalment.findMany({
      where: {
        loan: { ...loanWhere },
        dueDate: { gte: weekStart, lt: tomorrow },
      },
      select: { dueDate: true, dueAmount: true, receivedAmount: true },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.penalty.aggregate({
      where: { loan: { ...loanWhere }, status: { in: ['pending', 'partial'] } },
      _sum: { grossPenalty: true },
      _count: true,
    }),
    prisma.auditLog.findMany({
      where: { tenantId, user: { role: { not: 'developer' } } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { user: true },
    }),
  ]);

  const todayExpected = todayInstalments.reduce((sum, item) => sum + Number(item.dueAmount), 0);
  const todayCollected = todayInstalments.reduce((sum, item) => sum + Math.min(Number(item.receivedAmount || 0), Number(item.dueAmount)), 0);
  const todayGap = todayInstalments.reduce((sum, item) => sum + outstanding(item), 0);

  const overdueInstalments = overdueInstalmentsRaw
    .map((item) => {
      const dueDate = startOfDay(item.dueDate);
      const overdueAmount = outstanding(item);
      const daysOverdue = daysBetween(dueDate, today);
      return { ...item, overdueAmount, daysOverdue };
    })
    .filter((item) => item.overdueAmount > 0);

  const overdueAmount = overdueInstalments.reduce((sum, item) => sum + item.overdueAmount, 0);
  const overdueCustomerCount = new Set(overdueInstalments.map((item) => item.loan.customer.id)).size;
  const dynamicPenalty = overdueInstalments.reduce((sum, item) => {
    return sum + item.daysOverdue * Number(item.loan.penaltyRate || 0);
  }, 0);
  const pendingPenaltyTotal = Math.max(Number(pendingPenalties._sum.grossPenalty || 0), dynamicPenalty);

  const trend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const dateKey = date.toISOString().slice(0, 10);
    const rows = weekInstalments.filter((item) => item.dueDate.toISOString().slice(0, 10) === dateKey);
    return {
      label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      expected: rows.reduce((sum, item) => sum + Number(item.dueAmount), 0),
      collected: rows.reduce((sum, item) => sum + Math.min(Number(item.receivedAmount || 0), Number(item.dueAmount)), 0),
    };
  });

  const routePerformance = routes.map((route) => {
    const routeOverdue = route.customers.reduce((sum, customer) => {
      return sum + customer.loans.reduce((loanSum, loan) => {
        return loanSum + loan.instalments.reduce((instSum, item) => instSum + outstanding(item), 0);
      }, 0);
    }, 0);
    return {
      id: route.id,
      name: route.name,
      agent: route.assignedAgent?.name || '-',
      customers: route._count.customers,
      overdue: routeOverdue,
    };
  });

  return {
    totalCustomers,
    recentLoans,
    pendingApprovals,
    todayExpected,
    todayCollected,
    todayGap,
    overdueAmount,
    overdueCustomerCount,
    pendingPenaltyTotal,
    pendingPenaltyCount: pendingPenalties._count,
    overdueInstalments,
    trend,
    routePerformance,
    recentActivity,
  };
}

function BarChart({
  data,
  currencySymbol,
}: {
  data: { label: string; expected: number; collected: number }[];
  currencySymbol: string;
}) {
  const max = Math.max(1, ...data.flatMap((item) => [item.expected, item.collected]));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, gap: '12px', alignItems: 'end', height: '220px' }}>
      {data.map((item) => (
        <div key={item.label} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'end', height: '100%', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'end', gap: '5px', height: '150px' }} title={`${formatCurrency(item.collected, currencySymbol)} collected / ${formatCurrency(item.expected, currencySymbol)} expected`}>
            <div style={{ width: '50%', height: `${Math.max(4, (item.expected / max) * 100)}%`, borderRadius: '6px 6px 2px 2px', background: '#DBEAFE' }} />
            <div style={{ width: '50%', height: `${Math.max(4, (item.collected / max) * 100)}%`, borderRadius: '6px 6px 2px 2px', background: 'var(--primary)' }} />
          </div>
          <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', textAlign: 'center', fontWeight: 700 }}>{item.label}</div>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const userRole = (session?.user as { role?: string })?.role;
  if (userRole === 'agent') redirect('/collection');

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const branding = await getBranding(tenantId);

  const userBranchId = (session?.user as { branchId?: string })?.branchId;
  const adminBranchId = userRole === 'admin' && userBranchId ? userBranchId : undefined;
  const data = await getDashboardData(tenantId, appType, adminBranchId);

  return (
    <>
      <div className="kpi-grid">
        <Link href="/collection" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="kpi-icon green"><span className="material-icons-outlined">trending_up</span></div>
          <div>
            <div className="kpi-value">{formatCurrency(data.todayExpected, branding.currencySymbol)}</div>
            <div className="kpi-label">Today's Expected Collection</div>
          </div>
        </Link>
        <Link href="/collection" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="kpi-icon orange"><span className="material-icons-outlined">account_balance_wallet</span></div>
          <div>
            <div className="kpi-value">{formatCurrency(data.todayCollected, branding.currencySymbol)}</div>
            <div className="kpi-label">Adjusted Collected Today</div>
          </div>
        </Link>
        <Link href="/collection" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="kpi-icon red"><span className="material-icons-outlined">trending_down</span></div>
          <div>
            <div className="kpi-value">{formatCurrency(data.todayGap, branding.currencySymbol)}</div>
            <div className="kpi-label">Today's Balance</div>
          </div>
        </Link>
        <Link href="/customers" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="kpi-icon blue"><span className="material-icons-outlined">groups</span></div>
          <div>
            <div className="kpi-value">{data.totalCustomers}</div>
            <div className="kpi-label">Active Customers</div>
          </div>
        </Link>
      </div>

      <div className="kpi-grid">
        <Link href="/collection" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="kpi-icon red"><span className="material-icons-outlined">warning</span></div>
          <div>
            <div className="kpi-value">{data.overdueCustomerCount}</div>
            <div className="kpi-label">Overdue Customers</div>
          </div>
        </Link>
        <Link href="/collection" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="kpi-icon red"><span className="material-icons-outlined">currency_rupee</span></div>
          <div>
            <div className="kpi-value">{formatCurrency(data.overdueAmount, branding.currencySymbol)}</div>
            <div className="kpi-label">Total Overdue Amount</div>
          </div>
        </Link>
        <Link href="/penalties?status=pending" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="kpi-icon purple"><span className="material-icons-outlined">gavel</span></div>
          <div>
            <div className="kpi-value">{formatCurrency(data.pendingPenaltyTotal, branding.currencySymbol)}</div>
            <div className="kpi-label">Penalty Accumulated</div>
          </div>
        </Link>
        <Link href="/approvals?status=pending" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="kpi-icon blue"><span className="material-icons-outlined">approval</span></div>
          <div>
            <div className="kpi-value">{data.pendingApprovals}</div>
            <div className="kpi-label">Pending Approvals</div>
          </div>
        </Link>
      </div>

      <div className="grid-60-40">
        <div className="card">
          <div className="card-header">
            <h3>Collection Trend</h3>
            <div style={{ display: 'flex', gap: '12px', fontSize: '.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#DBEAFE', borderRadius: 2 }} /> Expected</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--primary)', borderRadius: 2 }} /> Collected</span>
            </div>
          </div>
          <BarChart data={data.trend} currencySymbol={branding.currencySymbol} />
        </div>

        <div className="card">
          <div className="card-header"><h3>Route Health</h3></div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Agent</th>
                  <th>Customers</th>
                  <th>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {data.routePerformance.map((route) => (
                  <tr key={route.id}>
                    <td><strong>{route.name}</strong></td>
                    <td>{route.agent}</td>
                    <td>{route.customers}</td>
                    <td style={{ color: route.overdue > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>
                      {formatCurrency(route.overdue, branding.currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid-60-40" style={{ marginTop: '20px' }}>
        <div className="card">
          <div className="card-header">
            <h3>Overdue Alerts</h3>
            <Link href="/collection" className="btn btn-ghost btn-sm">View All</Link>
          </div>
          {data.overdueInstalments.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Route</th>
                    <th>Due Date</th>
                    <th>Overdue</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.overdueInstalments.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.loan.customer.name}</strong>
                        <br />
                        <span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{item.loan.customer.customerCode}</span>
                      </td>
                      <td>{item.loan.customer.route?.name || '-'}</td>
                      <td>{formatDate(item.dueDate)} ({item.daysOverdue}d)</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 700 }}>{formatCurrency(item.overdueAmount, branding.currencySymbol)}</td>
                      <td><Link href={`/customers/${item.loan.customer.customerCode}`} className="btn btn-ghost btn-sm">View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '24px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '36px', color: 'var(--success)' }}>check_circle</span>
              <p style={{ marginTop: '8px', fontSize: '.85rem', color: 'var(--text-secondary)' }}>No overdue balances after allocation.</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header"><h3>Recent Activity</h3></div>
          {data.recentActivity.length > 0 ? (
            <div>
              {data.recentActivity.map((log) => (
                <div className="activity-item" key={log.id}>
                  <div className="activity-dot"></div>
                  <div style={{ flex: 1 }}>
                    <div className="activity-text"><strong>{log.user?.name || 'System'}</strong> - {log.action} {log.entityType}</div>
                    <div className="activity-time">{formatDate(log.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-light)', fontSize: '.85rem' }}>
              No activity recorded yet.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
