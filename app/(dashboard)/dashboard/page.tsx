import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getBranding, getUserAppType } from '@/lib/tenant';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getActiveBranchId } from '@/lib/branch';

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

async function getDashboardData(tenantId: string, appType: string, branchId?: string | null) {
  const today = startOfDay();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);

  const branchFilter = branchId ? { branchId } : {};
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
    accountEntries,
    todayCollectionEntries,
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
        routeAgents: { include: { agent: true } },
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
    // Capital KPI
    prisma.accountEntry.findMany({
      where: { tenantId },
      select: { type: true, amount: true },
    }),
    // Feature 6 & 8: Today's collection entries for cash/UPI split + route-wise
    prisma.collectionEntry.findMany({
      where: {
        tenantId,
        submittedAt: { gte: today, lt: tomorrow },
      },
      select: {
        receivedAmount: true,
        paymentMode: true,
        customer: { select: { routeId: true } },
      },
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
      agent: route.routeAgents?.map((ra: any) => ra.agent?.name).join(', ') || '-',
      customers: route._count.customers,
      overdue: routeOverdue,
    };
  });

  // Capital calculation from accounting entries
  let currentCapital = 0;
  for (const entry of accountEntries) {
    const amt = Number(entry.amount);
    if (entry.type === 'capital_add') currentCapital += amt;
    else if (entry.type === 'capital_withdraw') currentCapital -= amt;
    else if (entry.type === 'loan_disburse') currentCapital -= amt;
    else if (entry.type === 'collection') currentCapital += amt;
    else if (entry.type === 'expense') currentCapital -= amt;
  }

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
    currentCapital,
    todayCashCollected: todayCollectionEntries
      .filter((e: any) => e.paymentMode === 'cash')
      .reduce((sum: number, e: any) => sum + Number(e.receivedAmount), 0),
    todayUpiCollected: todayCollectionEntries
      .filter((e: any) => e.paymentMode === 'upi' || e.paymentMode === 'online')
      .reduce((sum: number, e: any) => sum + Number(e.receivedAmount), 0),
    routeCollections: routes.map((route: any) => {
      const collected = todayCollectionEntries
        .filter((e: any) => e.customer?.routeId === route.id)
        .reduce((sum: number, e: any) => sum + Number(e.receivedAmount), 0);
      return { routeId: route.id, collected };
    }),
  };
}

async function getChitFundsDashboardData(tenantId: string, branchId?: string | null) {
  const today = startOfDay();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const branchFilter = branchId ? { branchId } : {};

  // Fetch active chit groups count
  const totalChitGroups = await prisma.chitGroup.count({
    where: { tenantId, appType: 'chitfunds', ...branchFilter, status: 'active' }
  });

  // Fetch total members count
  const totalMembers = await prisma.chitMember.count({
    where: { chitGroup: { tenantId, appType: 'chitfunds', ...branchFilter } }
  });

  // Fetch count of auctions this month
  const auctionsThisMonth = await prisma.chitAuction.count({
    where: {
      chitGroup: { tenantId, appType: 'chitfunds', ...branchFilter },
      auctionDate: { gte: monthStart, lt: tomorrow }
    }
  });

  // Fetch count of pending approvals for chitfunds
  const pendingApprovals = await prisma.approvalRequest.count({
    where: { tenantId, appType: 'chitfunds', status: 'pending' }
  });

  // Fetch subscriptions due today
  const todaySubscriptions = await prisma.chitSubscription.findMany({
    where: {
      member: { chitGroup: { tenantId, appType: 'chitfunds', ...branchFilter } },
      dueDate: { gte: today, lt: tomorrow }
    },
    select: { dueAmount: true, paidAmount: true }
  });

  const todayExpected = todaySubscriptions.reduce((sum, item) => sum + Number(item.dueAmount), 0);
  const todayCollected = todaySubscriptions.reduce((sum, item) => sum + Number(item.paidAmount), 0);
  const todayGap = Math.max(0, todayExpected - todayCollected);

  // Fetch total overdue subscriptions
  const overdueSubscriptions = await prisma.chitSubscription.findMany({
    where: {
      member: { chitGroup: { tenantId, appType: 'chitfunds', ...branchFilter } },
      dueDate: { lt: today },
      status: { not: 'paid' }
    },
    include: {
      member: {
        include: {
          customer: true,
          chitGroup: true
        }
      }
    },
    orderBy: { dueDate: 'asc' },
    take: 10
  });

  const totalOverdueAmount = overdueSubscriptions.reduce((sum, item) => sum + Math.max(0, Number(item.dueAmount) - Number(item.paidAmount)), 0);
  const overdueMembersCount = new Set(overdueSubscriptions.map(item => item.memberId)).size;

  // Recent activity logs
  const recentActivity = await prisma.auditLog.findMany({
    where: { tenantId, user: { role: { not: 'developer' } } },
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: { user: true }
  });

  // Fetch active chit groups with details for table
  const activeChitGroupsList = await prisma.chitGroup.findMany({
    where: { tenantId, appType: 'chitfunds', ...branchFilter, status: 'active' },
    include: {
      _count: { select: { members: true } }
    },
    take: 5
  });

  return {
    totalChitGroups,
    totalMembers,
    auctionsThisMonth,
    pendingApprovals,
    todayExpected,
    todayCollected,
    todayGap,
    totalOverdueAmount,
    overdueMembersCount,
    overdueSubscriptions: overdueSubscriptions.map(item => ({
      id: item.id,
      customerName: item.member.customer.name,
      customerCode: item.member.customer.customerCode,
      chitGroupName: item.member.chitGroup.name,
      dueDate: item.dueDate,
      overdueAmount: Math.max(0, Number(item.dueAmount) - Number(item.paidAmount)),
      daysOverdue: Math.max(0, Math.floor((today.getTime() - startOfDay(item.dueDate).getTime()) / (24 * 60 * 60 * 1000)))
    })),
    recentActivity,
    activeChitGroupsList
  };
}

async function getAgentDashboardData(tenantId: string, appType: string, agentId: string) {
  const today = startOfDay();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);

  const agentFilter = {
    customer: {
      OR: [
        { route: { routeAgents: { some: { agentId } } } }
      ]
    }
  };

  const [
    totalCustomers,
    recentLoans,
    pendingApprovals,
    routes,
    todayInstalments,
    overdueInstalmentsRaw,
    weekInstalments,
    myApprovals,
  ] = await Promise.all([
    prisma.customer.count({
      where: {
        tenantId,
        appType,
        status: 'active',
        OR: [
          { route: { routeAgents: { some: { agentId } } } }
        ]
      }
    }),
    prisma.loan.count({
      where: {
        tenantId,
        appType,
        status: 'active',
        ...agentFilter,
      }
    }),
    prisma.approvalRequest.count({
      where: {
        tenantId,
        appType,
        requestedById: agentId,
        status: 'pending'
      }
    }),
    prisma.route.findMany({
      where: {
        tenantId,
        routeAgents: { some: { agentId } },
        status: 'active'
      },
      include: {
        _count: { select: { customers: true } },
        customers: {
          select: {
            id: true,
            loans: {
              where: { status: { in: ['active', 'overdue'] } },
              select: {
                instalments: {
                  where: { dueDate: { lt: today }, status: { in: ['upcoming', 'missed', 'partial'] } },
                  select: { dueAmount: true, receivedAmount: true },
                }
              }
            }
          }
        }
      }
    }),
    prisma.instalment.findMany({
      where: {
        loan: {
          tenantId,
          appType,
          status: { in: ['active', 'overdue', 'closed'] },
          ...agentFilter,
        },
        dueDate: { gte: today, lt: tomorrow },
      },
      include: { loan: { include: { customer: { include: { route: true } } } } },
      orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
    }),
    prisma.instalment.findMany({
      where: {
        loan: {
          tenantId,
          appType,
          status: { in: ['active', 'overdue'] },
          ...agentFilter,
        },
        dueDate: { lt: today },
        status: { in: ['upcoming', 'missed', 'partial'] },
      },
      include: { loan: { include: { customer: { include: { route: true } } } } },
      orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
      take: 10,
    }),
    prisma.instalment.findMany({
      where: {
        loan: {
          tenantId,
          appType,
          ...agentFilter,
        },
        dueDate: { gte: weekStart, lt: tomorrow },
      },
      select: { dueDate: true, dueAmount: true, receivedAmount: true },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.approvalRequest.findMany({
      where: {
        tenantId,
        appType,
        requestedById: agentId,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { reviewedBy: { select: { name: true } } }
    }),
  ]);

  const todayExpected = todayInstalments.reduce((sum, item) => sum + Number(item.dueAmount), 0);
  const collectionEntriesToday = await prisma.collectionEntry.findMany({
    where: {
      agentId,
      submittedAt: { gte: today, lt: tomorrow },
    },
    select: { receivedAmount: true }
  });
  const todayCollected = collectionEntriesToday.reduce((sum, item) => sum + Number(item.receivedAmount), 0);
  const todayGap = Math.max(0, todayExpected - todayCollected);

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
    overdueInstalments,
    trend,
    routePerformance,
    myApprovals,
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
  const userRole = (session?.user as { role?: string; id?: string })?.role;
  
  if (!session?.user) {
    redirect('/login');
  }

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();

  const branding = await getBranding(tenantId);

  const activeBranchId = await getActiveBranchId();

  if (appType === 'chitfunds') {
    const chitData = await getChitFundsDashboardData(tenantId, activeBranchId);
    return (
      <>
        {/* KPI Grid */}
        <div className="kpi-grid">
          <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)', color: '#fff' }}>
            <div className="kpi-icon" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              <span className="material-icons-outlined">savings</span>
            </div>
            <div>
              <div className="kpi-value" style={{ color: '#fff' }}>{chitData.totalChitGroups}</div>
              <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Active Chit Groups</div>
            </div>
          </div>

          <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', color: '#fff' }}>
            <div className="kpi-icon" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              <span className="material-icons-outlined">groups</span>
            </div>
            <div>
              <div className="kpi-value" style={{ color: '#fff' }}>{chitData.totalMembers}</div>
              <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Total Subscribers</div>
            </div>
          </div>

          <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', color: '#fff' }}>
            <div className="kpi-icon" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              <span className="material-icons-outlined">event</span>
            </div>
            <div>
              <div className="kpi-value" style={{ color: '#fff' }}>{chitData.auctionsThisMonth}</div>
              <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Auctions This Month</div>
            </div>
          </div>

          <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)', color: '#fff' }}>
            <div className="kpi-icon" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              <span className="material-icons-outlined">approval</span>
            </div>
            <div>
              <div className="kpi-value" style={{ color: '#fff' }}>{chitData.pendingApprovals}</div>
              <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Pending Approvals</div>
            </div>
          </div>
        </div>

        {/* Collection & Expected stats */}
        <div className="kpi-grid" style={{ marginTop: '20px' }}>
          <div className="kpi-card">
            <div className="kpi-icon green"><span className="material-icons-outlined">trending_up</span></div>
            <div>
              <div className="kpi-value">{formatCurrency(chitData.todayExpected, branding.currencySymbol)}</div>
              <div className="kpi-label">Today's Expected Subscriptions</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon orange"><span className="material-icons-outlined">account_balance_wallet</span></div>
            <div>
              <div className="kpi-value">{formatCurrency(chitData.todayCollected, branding.currencySymbol)}</div>
              <div className="kpi-label">Subscriptions Collected Today</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon red"><span className="material-icons-outlined">trending_down</span></div>
            <div>
              <div className="kpi-value">{formatCurrency(chitData.todayGap, branding.currencySymbol)}</div>
              <div className="kpi-label">Today's Balance Due</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon red"><span className="material-icons-outlined">warning</span></div>
            <div>
              <div className="kpi-value">{formatCurrency(chitData.totalOverdueAmount, branding.currencySymbol)}</div>
              <div className="kpi-label">Total Overdue Contributions</div>
            </div>
          </div>
        </div>

        {/* Dynamic content grid */}
        <div className="grid-60-40" style={{ marginTop: '20px' }}>
          <div className="card">
            <div className="card-header">
              <h3>Overdue Chit Subscriptions</h3>
              <Link href="/chits" className="btn btn-ghost btn-sm">View All Groups</Link>
            </div>
            {chitData.overdueSubscriptions.length > 0 ? (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Subscriber</th>
                      <th>Chit Group</th>
                      <th>Due Date</th>
                      <th>Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chitData.overdueSubscriptions.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.customerName}</strong>
                          <br />
                          <span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{item.customerCode}</span>
                        </td>
                        <td>{item.chitGroupName}</td>
                        <td>{formatDate(item.dueDate)} ({item.daysOverdue}d)</td>
                        <td style={{ color: 'var(--danger)', fontWeight: 700 }}>{formatCurrency(item.overdueAmount, branding.currencySymbol)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '24px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '36px', color: 'var(--success)' }}>check_circle</span>
                <p style={{ marginTop: '8px', fontSize: '.85rem', color: 'var(--text-secondary)' }}>All chit subscriptions up to date!</p>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Active Chit Groups</h3>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Group Name</th>
                    <th style={{ textAlign: 'center' }}>Members</th>
                    <th style={{ textAlign: 'right' }}>Chit Value</th>
                  </tr>
                </thead>
                <tbody>
                  {chitData.activeChitGroupsList.map((group) => (
                    <tr key={group.id}>
                      <td><strong>{group.name}</strong></td>
                      <td style={{ textAlign: 'center' }}>{group._count.members} / {group.totalMembers}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                        {formatCurrency(Number(group.chitValue), branding.currencySymbol)}
                      </td>
                    </tr>
                  ))}
                  {chitData.activeChitGroupsList.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        No active chit groups found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div style={{ marginTop: '20px' }} className="card">
          <div className="card-header"><h3>Recent System Activity</h3></div>
          {chitData.recentActivity.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px', padding: '10px 0' }}>
              {chitData.recentActivity.slice(0, 4).map((log) => (
                <div className="activity-item" key={log.id} style={{ borderBottom: 'none', background: '#f8fafc', padding: '12px 16px', borderRadius: '12px' }}>
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
      </>
    );
  }



  if (userRole === 'agent') {
    const agentData = await getAgentDashboardData(tenantId, appType, session.user.id as string);
    const progressPct = agentData.todayExpected > 0 
      ? Math.min(100, Math.round((agentData.todayCollected / agentData.todayExpected) * 100))
      : 100;

    return (
      <>
        {/* Scoped Agent KPI Cards */}
        <div className="kpi-grid">
          <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#fff' }}>
            <div className="kpi-icon" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              <span className="material-icons-outlined">trending_up</span>
            </div>
            <div>
              <div className="kpi-value" style={{ color: '#fff' }}>{formatCurrency(agentData.todayExpected, branding.currencySymbol)}</div>
              <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.8)' }}>My Expected Collection</div>
            </div>
          </div>

          <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', color: '#fff' }}>
            <div className="kpi-icon" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              <span className="material-icons-outlined">payments</span>
            </div>
            <div>
              <div className="kpi-value" style={{ color: '#fff' }}>{formatCurrency(agentData.todayCollected, branding.currencySymbol)}</div>
              <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.8)' }}>My Collected Today</div>
            </div>
          </div>

          <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', color: '#fff' }}>
            <div className="kpi-icon" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              <span className="material-icons-outlined">hourglass_empty</span>
            </div>
            <div>
              <div className="kpi-value" style={{ color: '#fff' }}>{formatCurrency(agentData.todayGap, branding.currencySymbol)}</div>
              <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.8)' }}>My Remaining Balance</div>
            </div>
          </div>

          <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #EC4899 0%, #BE185D 100%)', color: '#fff' }}>
            <div className="kpi-icon" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              <span className="material-icons-outlined">people</span>
            </div>
            <div>
              <div className="kpi-value" style={{ color: '#fff' }}>{agentData.totalCustomers}</div>
              <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.8)' }}>My Active Customers</div>
            </div>
          </div>
        </div>

        {/* Scoped Progress Bar and Routes list */}
        <div className="grid-60-40" style={{ marginTop: '20px' }}>
          <div className="card" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <div className="card-header" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
                <span className="material-icons-outlined" style={{ color: '#3B82F6' }}>analytics</span>
                Collection Trend & Progress
              </h3>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, color: '#475569', fontSize: '0.9rem' }}>Today's Progress</span>
                  <span style={{ fontWeight: 700, color: '#1D4ED8', fontSize: '1rem' }}>{progressPct}% Completed</span>
                </div>
                <div style={{ width: '100%', height: '12px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${progressPct}%`, 
                    height: '100%', 
                    background: 'linear-gradient(90deg, #3B82F6 0%, #1D4ED8 100%)',
                    borderRadius: '6px',
                    transition: 'width 0.5s ease-in-out'
                  }} />
                </div>
              </div>
              <BarChart data={agentData.trend} currencySymbol={branding.currencySymbol} />
            </div>
          </div>

          <div className="card" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <div className="card-header" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
                <span className="material-icons-outlined" style={{ color: '#BE185D' }}>map</span>
                Assigned Routes
              </h3>
            </div>
            <div className="table-wrapper" style={{ padding: '10px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontWeight: 600 }}>Route Name</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#64748b', fontWeight: 600 }}>Customers</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', color: '#64748b', fontWeight: 600 }}>Total Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {agentData.routePerformance.map((route) => (
                    <tr key={route.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 600 }}>{route.name}</td>
                      <td style={{ textAlign: 'center', padding: '12px 16px', color: '#475569' }}>{route.customers}</td>
                      <td style={{ 
                        textAlign: 'right', 
                        padding: '12px 16px', 
                        color: route.overdue > 0 ? 'var(--danger)' : 'var(--success)', 
                        fontWeight: 700 
                      }}>
                        {formatCurrency(route.overdue, branding.currencySymbol)}
                      </td>
                    </tr>
                  ))}
                  {agentData.routePerformance.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        No routes currently assigned.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Approvals Submitted & Overdue alerts */}
        <div className="grid-60-40" style={{ marginTop: '20px' }}>
          <div className="card" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <div className="card-header" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
                <span className="material-icons-outlined" style={{ color: '#F59E0B' }}>verified</span>
                My Recent Edit/Creation Requests
              </h3>
              <Link href="/approvals" className="btn btn-ghost btn-sm" style={{ color: '#3B82F6' }}>View All</Link>
            </div>
            <div className="table-wrapper">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b' }}>Request Type</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#64748b' }}>Submitted At</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#64748b' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b' }}>Reviewer Note</th>
                  </tr>
                </thead>
                <tbody>
                  {agentData.myApprovals.map((req) => (
                    <tr key={req.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 600 }}>
                        <span style={{ textTransform: 'capitalize' }}>{req.entityType.replace('_', ' ')}</span>
                      </td>
                      <td style={{ textAlign: 'center', padding: '12px 16px', color: '#64748b', fontSize: '0.85rem' }}>
                        {formatDate(req.createdAt)}
                      </td>
                      <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                        <span className={`badge ${
                          req.status === 'approved' ? 'badge-success' : req.status === 'pending' ? 'badge-warning' : 'badge-danger'
                        }`} style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: req.status === 'approved' ? '#def7ec' : req.status === 'pending' ? '#fef3c7' : '#fde8e8',
                          color: req.status === 'approved' ? '#03543f' : req.status === 'pending' ? '#92400e' : '#9b1c1c'
                        }}>
                          {req.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem' }}>
                        {req.reviewNotes || (req.reviewedBy ? `Reviewed by ${req.reviewedBy.name}` : 'Waiting for Admin approval...')}
                      </td>
                    </tr>
                  ))}
                  {agentData.myApprovals.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        No pending or reviewed requests submitted yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <div className="card-header" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                <span className="material-icons-outlined">warning</span>
                My Overdue Alerts
              </h3>
            </div>
            <div style={{ padding: '16px 0' }}>
              {agentData.overdueInstalments.slice(0, 5).map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #f8fafc' }}>
                  <div>
                    <strong style={{ display: 'block', color: '#1e293b' }}>{item.loan.customer.name}</strong>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.loan.customer.customerCode} • {item.loan.customer.route?.name || '-'}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'block', color: 'var(--danger)', fontWeight: 700 }}>
                      {formatCurrency(item.overdueAmount, branding.currencySymbol)}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.daysOverdue} days overdue</span>
                  </div>
                </div>
              ))}
              {agentData.overdueInstalments.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--success)' }}>
                  <span className="material-icons-outlined" style={{ fontSize: '36px' }}>check_circle</span>
                  <p style={{ marginTop: '8px', fontSize: '0.85rem', fontWeight: 600 }}>All collections up to date!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  const data = await getDashboardData(tenantId, appType, activeBranchId);

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
        <Link href="/accounting" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className={`kpi-icon ${data.currentCapital >= 0 ? 'green' : 'red'}`}><span className="material-icons-outlined">savings</span></div>
          <div>
            <div className="kpi-value">{formatCurrency(data.currentCapital, branding.currencySymbol)}</div>
            <div className="kpi-label">Capital Balance</div>
          </div>
        </Link>
      </div>

      {/* Feature 6: Cash/UPI Split */}
      {(data.todayCashCollected > 0 || data.todayUpiCollected > 0) && (
        <div className="card" style={{ marginTop: '12px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '.9rem', fontWeight: 700 }}>Today's Collection Split</h4>
            <div style={{ display: 'flex', gap: '20px', fontSize: '.85rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#27AE60' }} />
                Cash: <strong>{formatCurrency(data.todayCashCollected, branding.currencySymbol)}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#8E44AD' }} />
                UPI: <strong>{formatCurrency(data.todayUpiCollected, branding.currencySymbol)}</strong>
              </span>
            </div>
          </div>
          <div style={{ marginTop: '10px', height: '8px', borderRadius: '4px', background: '#E8E8E8', overflow: 'hidden', display: 'flex' }}>
            {data.todayCashCollected > 0 && (
              <div style={{ width: `${(data.todayCashCollected / (data.todayCashCollected + data.todayUpiCollected)) * 100}%`, background: '#27AE60', height: '100%' }} />
            )}
            {data.todayUpiCollected > 0 && (
              <div style={{ width: `${(data.todayUpiCollected / (data.todayCashCollected + data.todayUpiCollected)) * 100}%`, background: '#8E44AD', height: '100%' }} />
            )}
          </div>
        </div>
      )}

      <div className="grid-60-40" style={{ marginTop: '20px' }}>
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
                  <th>Collected Today</th>
                  <th>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {data.routePerformance.map((route) => {
                  const routeCol = data.routeCollections?.find((rc: any) => rc.routeId === route.id);
                  return (
                    <tr key={route.id}>
                      <td><strong>{route.name}</strong></td>
                      <td>{route.agent}</td>
                      <td>{route.customers}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 700 }}>
                        {formatCurrency(routeCol?.collected || 0, branding.currencySymbol)}
                      </td>
                      <td style={{ color: route.overdue > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>
                        {formatCurrency(route.overdue, branding.currencySymbol)}
                      </td>
                    </tr>
                  );
                })}
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
