import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getBranding, getUserAppType } from '@/lib/tenant';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from '@/components/layout/DashboardLink';
import { redirect } from 'next/navigation';
import { getActiveBranchId } from '@/lib/branch';
import { CollectCashButton, VerifyUpiButton, BulkVerifyUpiButton } from './DashboardActions';
import CollectionTrendChart from './CollectionTrendChart';
import { ensurePendingPenaltiesForMissedLoans } from '@/lib/penalties';
import { getDictionary } from '@/lib/i18n';

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

function getLocalDateString(date: Date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function getDashboardData(tenantId: string, appType: string, branchId?: string | null) {
  const today = startOfDay();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);
  // Trend window: pull 30 days so the client range filter can slice 7/14/30 days
  // without re-querying the DB.
  const trendStart = new Date(today);
  trendStart.setDate(trendStart.getDate() - 29);

  const branchFilter = branchId ? { branchId } : {};
  const loanWhere: any = { tenantId, appType, ...branchFilter };
  const customerWhere: any = { tenantId, appType, ...branchFilter };

  // Sync penalties in real-time on dashboard load
  await ensurePendingPenaltiesForMissedLoans({
    tenantId,
    appType,
    branchId: branchId || undefined,
  });

  const [
    totalCustomers,
    recentLoans,
    pendingApprovals,
    routes,
    todayInstalments,
    overdueInstalmentsRaw,
    overdueInstalmentsForTotals,
    weekInstalments,
    pendingPenalties,
    recentActivity,
    accountEntries,
    todayCollectionEntries,
    highestBorrowerResult,
    bestPayer,
    pendingUpiCollections,
    pendingCashCollections,
  ] = await Promise.all([
    prisma.customer.count({ where: { ...customerWhere, status: 'active' } }),
    prisma.loan.count({
      where: {
        ...loanWhere,
        createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) },
      },
    }),
    // Count all "things waiting for admin attention":
    //   1. ApprovalRequest rows with status=pending
    //   2. Loans with status=pending_review (shown in /approvals)
    //   3. Customers with status=pending_review (shown in /approvals)
    // This matches what the /approvals page actually displays so the
    // KPI never disagrees with the page the user clicks through to.
    Promise.all([
      prisma.approvalRequest.count({
        where: {
          tenantId,
          appType,
          status: 'pending',
          ...(branchId ? { requestedBy: { branchId } } : {}),
        },
      }),
      prisma.loan.count({
        where: { tenantId, appType, status: 'pending_review', ...(branchId ? { branchId } : {}) },
      }),
      prisma.customer.count({
        where: { tenantId, appType, status: 'pending_review', ...(branchId ? { branchId } : {}) },
      }),
    ]).then(([approvalReqs, pendingLoans, pendingCustomers]) =>
      approvalReqs + pendingLoans + pendingCustomers,
    ),
    prisma.route.findMany({
      where: { tenantId, appType, status: 'active', ...(branchId ? { branchId } : {}) },
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
    // Full overdue set (no take limit) so the KPI totals — Overdue Customers,
    // Total Overdue Amount — are accurate even when more than 10 instalments
    // are overdue. The take:10 query above only feeds the dashboard table.
    prisma.instalment.findMany({
      where: {
        loan: { ...loanWhere, status: { in: ['active', 'overdue'] } },
        dueDate: { lt: today },
        status: { in: ['upcoming', 'missed', 'partial'] },
      },
      select: {
        dueAmount: true,
        receivedAmount: true,
        loan: { select: { customerId: true } },
      },
    }),
    prisma.instalment.findMany({
      where: {
        loan: { ...loanWhere },
        dueDate: { gte: trendStart, lt: tomorrow },
      },
      select: { dueDate: true, dueAmount: true, receivedAmount: true },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.penalty.aggregate({
      where: { loan: { ...loanWhere }, status: { in: ['pending', 'partial'] } },
      _sum: { grossPenalty: true, settledAmount: true, waivedAmount: true },
      _count: true,
    }),
    prisma.auditLog.findMany({
      where: { tenantId, user: { role: { not: 'developer' }, ...(branchId ? { branchId } : {}) } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { user: true },
    }),
    // Capital KPI
    prisma.accountEntry.findMany({
      where: { tenantId, appType, ...(branchId ? { branchId } : {}) },
      select: { type: true, amount: true },
    }),
    // Feature 6 & 8: Today's collection entries for cash/UPI split + route-wise.
    // Scope by loan.appType so a chitfunds collection never bleeds into the
    // microlending dashboard (and vice-versa).
    prisma.collectionEntry.findMany({
      where: {
        tenantId,
        submittedAt: { gte: today, lt: tomorrow },
        loan: {
          appType,
          ...(branchId ? { branchId } : {}),
        },
      },
      select: {
        receivedAmount: true,
        paymentMode: true,
        customer: { select: { routeId: true } },
      },
    }),
    prisma.loan.groupBy({
      by: ['customerId'],
      where: { tenantId, appType, status: 'active', ...(branchId ? { branchId } : {}) },
      _sum: { principal: true },
      orderBy: { _sum: { principal: 'desc' } },
      take: 1
    }),
    prisma.customer.findFirst({
      where: {
        tenantId,
        appType,
        status: 'active',
        ...(branchId ? { branchId } : {}),
        loans: { some: { paidCount: { gt: 0 }, instalments: { none: { status: 'missed' } } } }
      },
      include: { loans: true },
    }),
    prisma.collectionEntry.findMany({
      where: {
        tenantId,
        paymentMode: { in: ['upi', 'online'] },
        verificationStatus: 'pending',
        loan: { appType, ...(branchId ? { branchId } : {}) },
      },
      include: { customer: true, loan: true, agent: true },
    }),
    prisma.collectionEntry.findMany({
      where: {
        tenantId,
        paymentMode: 'cash',
        verificationStatus: 'pending',
        submittedAt: { gte: today, lt: tomorrow },
        loan: { appType, ...(branchId ? { branchId } : {}) },
      },
      select: { receivedAmount: true, agentId: true, customer: { select: { routeId: true } } }
    })
  ]);

  const todayExpected = todayInstalments.reduce((sum, item) => sum + Number(item.dueAmount), 0);
  // Today's Collected = money applied to TODAY's instalments only. Overdue recovery
  // collected today is reported separately on the Overdue card — the two are NEVER
  // merged. This keeps the card internally consistent (collected + remaining =
  // expected) and matches the mobile app, which sums today's instalment receipts.
  const todayCollected = todayInstalments.reduce(
    (sum, item) => sum + Math.min(Number(item.receivedAmount || 0), Number(item.dueAmount)),
    0,
  );
  // Today's Outstanding = remaining due on today's instalments only. Even if the
  // agent collected more than today's expected (because money also went toward
  // overdue), today's specific instalment can still be unpaid.
  const todayGap = todayInstalments.reduce((sum, item) => sum + outstanding(item), 0);

  const overdueInstalments = overdueInstalmentsRaw
    .map((item) => {
      const dueDate = startOfDay(item.dueDate);
      const overdueAmount = outstanding(item);
      const daysOverdue = daysBetween(dueDate, today);
      return { ...item, overdueAmount, daysOverdue };
    })
    .filter((item) => item.overdueAmount > 0);

  // Totals are computed from the FULL (un-limited) overdue set so KPIs stay
  // correct even when the table-feed query is capped at 10 rows.
  const overdueForTotals = overdueInstalmentsForTotals.filter(
    (item: any) => outstanding(item) > 0,
  );
  const overdueAmount = overdueForTotals.reduce(
    (sum: number, item: any) => sum + outstanding(item),
    0,
  );
  const overdueCustomerCount = new Set(
    overdueForTotals.map((item: any) => item.loan.customerId),
  ).size;
  // Overdue collection — a DAILY snapshot that resets each day:
  //   • Today Collected = today's payments that landed on PAST-DUE instalments.
  //   • Remaining       = overdue outstanding right now (overdueAmount).
  //   • Total till today = what was overdue at the START of today
  //                        = remaining now + what we already recovered today.
  // Tomorrow this naturally re-bases: today's payments drop out of the "today"
  // window, and whatever is still outstanding becomes the fresh total overdue.
  const overduePaidTodayAllocations = await prisma.paymentAllocation.findMany({
    where: {
      payment: { tenantId, paymentDate: { gte: today, lt: tomorrow }, loan: { ...loanWhere } },
      instalment: { dueDate: { lt: today } },
    },
    select: { amount: true },
  });
  const overdueCollectedToday = overduePaidTodayAllocations.reduce(
    (sum: number, a: any) => sum + Number(a.amount),
    0,
  );
  const overdueTotalTillToday = overdueAmount + overdueCollectedToday;
  const pendingPenaltyTotal = Math.max(
    0,
    Number(pendingPenalties._sum.grossPenalty || 0) -
      Number(pendingPenalties._sum.settledAmount || 0) -
      Number(pendingPenalties._sum.waivedAmount || 0)
  );

  const trend = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(trendStart);
    date.setDate(trendStart.getDate() + index);
    const dateKey = getLocalDateString(date);
    const rows = weekInstalments.filter((item) => getLocalDateString(item.dueDate) === dateKey);
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

  let highestBorrower = null;
  if (highestBorrowerResult.length > 0) {
    highestBorrower = await prisma.customer.findUnique({
      where: { id: highestBorrowerResult[0].customerId },
      include: { loans: true }
    });
  }

  // Total Disbursed KPI = GROSS loan book (principal), not the net cash that left
  // (principal − upfront fee). The `loan_disburse` AccountEntry stays net for the
  // capital balance; this is a separate, gross figure for the headline KPI.
  const grossDisbursedAgg = await prisma.loan.aggregate({
    where: loanWhere,
    _sum: { principal: true },
  });
  const grossDisbursed = Number(grossDisbursedAgg._sum.principal || 0);

  return {
    totalCustomers,
    recentLoans,
    pendingApprovals,
    todayExpected,
    todayCollected,
    todayGap,
    overdueAmount,
    overdueCollectedToday,
    overdueTotalTillToday,
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
    // Money in the field that has NOT yet hit the books (capital):
    // pending cash awaiting handover + pending UPI awaiting verification.
    pendingFieldFloat: (() => {
      const pendingUpiAmount = pendingUpiCollections.reduce(
        (sum: number, e: any) => sum + Number(e.receivedAmount || 0),
        0,
      );
      const pendingCashAmount = pendingCashCollections.reduce(
        (sum: number, e: any) => sum + Number(e.receivedAmount || 0),
        0,
      );
      return pendingUpiAmount + pendingCashAmount;
    })(),
    routeCollections: routes.map((route: any) => {
      const collected = todayCollectionEntries
        .filter((e: any) => e.customer?.routeId === route.id)
        .reduce((sum: number, e: any) => sum + Number(e.receivedAmount), 0);
      return { routeId: route.id, collected };
    }),
    highestBorrower,
    bestPayer,
    pendingUpiCollections,
    pendingCashCollections,
    totalDisbursed: grossDisbursed,
    totalCollectedAllTime: accountEntries
      .filter((e) => e.type === 'collection')
      .reduce((sum, e) => sum + Number(e.amount), 0),
    todayByMode: (() => {
      const modes: Record<string, number> = {};
      for (const e of todayCollectionEntries) {
        const mode = (e.paymentMode as string) || 'other';
        modes[mode] = (modes[mode] || 0) + Number(e.receivedAmount || 0);
      }
      return modes;
    })(),
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
  // Today's Collected = money applied to TODAY's instalments only (not overdue
  // recovery), so collected + remaining = expected and it matches the mobile app.
  const todayCollected = todayInstalments.reduce(
    (sum, item) => sum + Math.min(Number(item.receivedAmount || 0), Number(item.dueAmount)),
    0,
  );
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
    const dateKey = getLocalDateString(date);
    const rows = weekInstalments.filter((item) => getLocalDateString(item.dueDate) === dateKey);
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
  const dict = await getDictionary(tenantId);
  const d = dict.dashboard;

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
              <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.8)' }}>{dict.chits.activeGroups}</div>
            </div>
          </div>

          <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', color: '#fff' }}>
            <div className="kpi-icon" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              <span className="material-icons-outlined">groups</span>
            </div>
            <div>
              <div className="kpi-value" style={{ color: '#fff' }}>{chitData.totalMembers}</div>
              <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.8)' }}>{dict.chits.totalMembers}</div>
            </div>
          </div>

          <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', color: '#fff' }}>
            <div className="kpi-icon" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              <span className="material-icons-outlined">event</span>
            </div>
            <div>
              <div className="kpi-value" style={{ color: '#fff' }}>{chitData.auctionsThisMonth}</div>
              <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.8)' }}>{dict.chits.auctionsDone}</div>
            </div>
          </div>

          <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)', color: '#fff' }}>
            <div className="kpi-icon" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              <span className="material-icons-outlined">approval</span>
            </div>
            <div>
              <div className="kpi-value" style={{ color: '#fff' }}>{chitData.pendingApprovals}</div>
              <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.8)' }}>{d.pendingApprovals}</div>
            </div>
          </div>
        </div>

        {/* Collection & Expected stats */}
        <div className="kpi-grid" style={{ marginTop: '20px' }}>
          <div className="kpi-card">
            <div className="kpi-icon green"><span className="material-icons-outlined">trending_up</span></div>
            <div>
              <div className="kpi-value">{formatCurrency(chitData.todayExpected, branding.currencySymbol)}</div>
              <div className="kpi-label">{d.expectedCollection}</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon orange"><span className="material-icons-outlined">account_balance_wallet</span></div>
            <div>
              <div className="kpi-value">{formatCurrency(chitData.todayCollected, branding.currencySymbol)}</div>
              <div className="kpi-label">{d.actualCollected}</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon red"><span className="material-icons-outlined">trending_down</span></div>
            <div>
              <div className="kpi-value">{formatCurrency(chitData.todayGap, branding.currencySymbol)}</div>
              <div className="kpi-label">{d.collectionGap}</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon red"><span className="material-icons-outlined">warning</span></div>
            <div>
              <div className="kpi-value">{formatCurrency(chitData.totalOverdueAmount, branding.currencySymbol)}</div>
              <div className="kpi-label">{d.totalOverdueAmount}</div>
            </div>
          </div>
        </div>

        {/* Dynamic content grid */}
        <div className="grid-60-40" style={{ marginTop: '20px' }}>
          <div className="card">
            <div className="card-header">
              <h3>{d.defaulterAlerts}</h3>
              <Link href="/chits" className="btn btn-ghost btn-sm">{d.viewAll}</Link>
            </div>
            {chitData.overdueSubscriptions.length > 0 ? (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>{dict.chits.member}</th>
                      <th>{dict.chits.chitFundGroups}</th>
                      <th>{dict.collection.dueDate}</th>
                      <th>{dict.loansList.overdue}</th>
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
                <p style={{ marginTop: '8px', fontSize: '.85rem', color: 'var(--text-secondary)' }}>{d.noDefaulters}</p>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <h3>{dict.chits.activeGroups}</h3>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>{dict.chits.name}</th>
                    <th style={{ textAlign: 'center' }}>{dict.chits.members}</th>
                    <th style={{ textAlign: 'right' }}>{dict.chits.chitValue}</th>
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
          <div className="card-header"><h3>{d.recentActivity}</h3></div>
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
              <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.8)' }}>{d.myExpected}</div>
            </div>
          </div>

          <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', color: '#fff' }}>
            <div className="kpi-icon" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              <span className="material-icons-outlined">payments</span>
            </div>
            <div>
              <div className="kpi-value" style={{ color: '#fff' }}>{formatCurrency(agentData.todayCollected, branding.currencySymbol)}</div>
              <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.8)' }}>{d.myCollected}</div>
            </div>
          </div>

          <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', color: '#fff' }}>
            <div className="kpi-icon" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              <span className="material-icons-outlined">hourglass_empty</span>
            </div>
            <div>
              <div className="kpi-value" style={{ color: '#fff' }}>{formatCurrency(agentData.todayGap, branding.currencySymbol)}</div>
              <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.8)' }}>{d.myRemaining}</div>
            </div>
          </div>

          <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #EC4899 0%, #BE185D 100%)', color: '#fff' }}>
            <div className="kpi-icon" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              <span className="material-icons-outlined">people</span>
            </div>
            <div>
              <div className="kpi-value" style={{ color: '#fff' }}>{agentData.totalCustomers}</div>
              <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.8)' }}>{d.myActiveCustomers}</div>
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
                  <span style={{ fontWeight: 600, color: '#475569', fontSize: '0.9rem' }}>{d.todayCollection}</span>
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
                {d.routePerformance}
              </h3>
            </div>
            <div className="table-wrapper" style={{ padding: '10px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontWeight: 600 }}>{dict.reports.route}</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#64748b', fontWeight: 600 }}>{dict.sidebar.customers}</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', color: '#64748b', fontWeight: 600 }}>{d.totalOverdue}</th>
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
                {dict.approvals.generalRequests}
              </h3>
              <Link href="/approvals" className="btn btn-ghost btn-sm" style={{ color: '#3B82F6' }}>{d.viewAll}</Link>
            </div>
            <div className="table-wrapper">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b' }}>{dict.approvals.entityType}</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#64748b' }}>{dict.approvals.date}</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#64748b' }}>{dict.approvals.status}</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b' }}>{dict.approvals.reviewNotes}</th>
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
                {d.overdueAlerts}
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
                  <p style={{ marginTop: '8px', fontSize: '0.85rem', fontWeight: 600 }}>{d.noDefaulters}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  const data = await getDashboardData(tenantId, appType, activeBranchId);

  const collectedPct = data.todayExpected > 0 ? Math.min(100, Math.round((data.todayCollected / data.todayExpected) * 100)) : (data.todayCollected > 0 ? 100 : 0);
  const remainingPct = 100 - collectedPct;
  const overduePct = data.overdueTotalTillToday > 0 ? Math.min(100, Math.round((data.overdueCollectedToday / data.overdueTotalTillToday) * 100)) : 0;
  const overdueRemainingPct = 100 - overduePct;
  // Total for the split = the sum of what each payment mode actually collected
  // today (today's dues + overdue recovery). Using today's-dues-only here made
  // the % overshoot (e.g. cash 14000 / 450 = 3111%); the denominator must be the
  // same population as the bars it scales.
  const totalSplit = Object.values(data.todayByMode).reduce((s: number, a) => s + Number(a || 0), 0);
  const modeConfig: Record<string, { label: string; icon: string; color: string; bg: string }> = {
    cash:   { label: 'Cash',   icon: 'payments',        color: '#16a34a', bg: '#f0fdf4' },
    upi:    { label: 'UPI',    icon: 'qr_code_scanner', color: '#7c3aed', bg: '#f5f3ff' },
    online: { label: 'Online', icon: 'language',        color: '#2563eb', bg: '#eff6ff' },
    cheque: { label: 'Cheque', icon: 'receipt_long',    color: '#b45309', bg: '#fffbeb' },
    other:  { label: 'Other',  icon: 'more_horiz',      color: '#475569', bg: '#f8fafc' },
  };
  const activeModes = Object.entries(data.todayByMode).filter(([, amt]) => amt > 0);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '12px' }}>
      {/* Combined Today's Collection Progress Card */}
      <Link href="/collection" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        <div className="card" style={{ height: '100%', padding: '20px 24px', background: 'linear-gradient(135deg, #f8faff 0%, #fff 100%)', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-icons-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>today</span>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>{d.todayCollection}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: collectedPct >= 100 ? '#dcfce7' : collectedPct > 50 ? '#fef3c7' : '#fee2e2', padding: '4px 12px', borderRadius: '20px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '14px', color: collectedPct >= 100 ? '#16a34a' : collectedPct > 50 ? '#d97706' : '#dc2626' }}>
                {collectedPct >= 100 ? 'check_circle' : 'schedule'}
              </span>
              <span style={{ fontWeight: 700, fontSize: '.85rem', color: collectedPct >= 100 ? '#16a34a' : collectedPct > 50 ? '#d97706' : '#dc2626' }}>
                {collectedPct}% collected
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '14px 16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '16px', color: '#64748b' }}>trending_up</span>
                <span style={{ fontSize: '.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{dict.reports.expected}</span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(data.todayExpected, branding.currencySymbol)}</div>
            </div>
            <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '14px 16px', border: '1px solid #bbf7d0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '16px', color: '#16a34a' }}>check_circle</span>
                <span style={{ fontSize: '.72rem', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{dict.reports.collected}</span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#15803d' }}>{formatCurrency(data.todayCollected, branding.currencySymbol)}</div>
            </div>
            <div style={{ background: data.todayGap > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: '12px', padding: '14px 16px', border: `1px solid ${data.todayGap > 0 ? '#fecaca' : '#bbf7d0'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '16px', color: data.todayGap > 0 ? '#dc2626' : '#16a34a' }}>
                  {data.todayGap > 0 ? 'pending' : 'check_circle'}
                </span>
                <span style={{ fontSize: '.72rem', color: data.todayGap > 0 ? '#dc2626' : '#16a34a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{dict.loanDetail.remaining}</span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: data.todayGap > 0 ? '#b91c1c' : '#15803d' }}>{formatCurrency(data.todayGap, branding.currencySymbol)}</div>
            </div>
          </div>

          <div>
            <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '8px', overflow: 'hidden', display: 'flex' }}>
              {collectedPct > 0 && (
                <div style={{ width: `${collectedPct}%`, height: '100%', background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)', borderRadius: collectedPct >= 100 ? '8px' : '8px 0 0 8px', transition: 'width 0.5s ease' }} />
              )}
              {remainingPct > 0 && collectedPct > 0 && (
                <div style={{ width: `${remainingPct}%`, height: '100%', background: '#fecaca' }} />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '.68rem', color: '#94a3b8' }}>
              <span>{branding.currencySymbol}0</span>
              <span style={{ color: '#10B981', fontWeight: 600 }}>{formatCurrency(data.todayCollected, branding.currencySymbol)} collected</span>
              <span>{formatCurrency(data.todayExpected, branding.currencySymbol)}</span>
            </div>
          </div>
        </div>
      </Link>

      {/* Overdue Collection Card — past-due instalments only (yesterday & earlier) */}
      <Link href="/collection?tab=overdue" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        <div className="card" style={{ height: '100%', padding: '20px 24px', background: 'linear-gradient(135deg, #fff7f7 0%, #fff 100%)', border: '1px solid #fecaca' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-icons-outlined" style={{ color: '#dc2626', fontSize: '20px' }}>warning_amber</span>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>{d.overdueCollection}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: overduePct >= 100 ? '#dcfce7' : '#fee2e2', padding: '4px 12px', borderRadius: '20px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '14px', color: overduePct >= 100 ? '#16a34a' : '#dc2626' }}>
                {overduePct >= 100 ? 'check_circle' : 'history'}
              </span>
              <span style={{ fontWeight: 700, fontSize: '.85rem', color: overduePct >= 100 ? '#16a34a' : '#dc2626' }}>
                {overduePct}% recovered today
              </span>
            </div>
          </div>
          {/* Plain-language explainer so the card is self-explanatory */}
          <div style={{ fontSize: '.72rem', color: '#94a3b8', marginBottom: '14px' }}>
            Past dues only (not today&apos;s). &quot;Total&quot; is what was overdue at the start of today; it re-bases tomorrow as anything unpaid rolls over.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '14px 16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '16px', color: '#64748b' }}>receipt_long</span>
                <span style={{ fontSize: '.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{d.totalOverdue}</span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(data.overdueTotalTillToday, branding.currencySymbol)}</div>
            </div>
            <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '14px 16px', border: '1px solid #bbf7d0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '16px', color: '#16a34a' }}>check_circle</span>
                <span style={{ fontSize: '.72rem', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{d.collectedToday}</span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#15803d' }}>{formatCurrency(data.overdueCollectedToday, branding.currencySymbol)}</div>
            </div>
            <div style={{ background: data.overdueAmount > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: '12px', padding: '14px 16px', border: `1px solid ${data.overdueAmount > 0 ? '#fecaca' : '#bbf7d0'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '16px', color: data.overdueAmount > 0 ? '#dc2626' : '#16a34a' }}>
                  {data.overdueAmount > 0 ? 'pending' : 'check_circle'}
                </span>
                <span style={{ fontSize: '.72rem', color: data.overdueAmount > 0 ? '#dc2626' : '#16a34a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{dict.loanDetail.remaining}</span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: data.overdueAmount > 0 ? '#b91c1c' : '#15803d' }}>{formatCurrency(data.overdueAmount, branding.currencySymbol)}</div>
            </div>
          </div>

          <div>
            <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '8px', overflow: 'hidden', display: 'flex' }}>
              {overduePct > 0 && (
                <div style={{ width: `${overduePct}%`, height: '100%', background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)', borderRadius: overduePct >= 100 ? '8px' : '8px 0 0 8px', transition: 'width 0.5s ease' }} />
              )}
              {overdueRemainingPct > 0 && overduePct > 0 && (
                <div style={{ width: `${overdueRemainingPct}%`, height: '100%', background: '#fecaca' }} />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '.68rem', color: '#94a3b8' }}>
              <span>{branding.currencySymbol}0</span>
              <span style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(data.overdueAmount, branding.currencySymbol)} still due</span>
              <span>{formatCurrency(data.overdueTotalTillToday, branding.currencySymbol)}</span>
            </div>
          </div>
        </div>
      </Link>
      </div>

      <div className="kpi-grid" style={{ marginTop: '12px' }}>
        <Link href="/customers?status=active" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="kpi-icon blue"><span className="material-icons-outlined">groups</span></div>
          <div>
            <div className="kpi-value">{data.totalCustomers}</div>
            <div className="kpi-label">{d.activeCustomers}</div>
          </div>
        </Link>
        <Link href="/collection?tab=overdue" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="kpi-icon red"><span className="material-icons-outlined">warning</span></div>
          <div>
            <div className="kpi-value">{data.overdueCustomerCount}</div>
            <div className="kpi-label">{d.overdueCustomers}</div>
          </div>
        </Link>
        <Link href="/collection?tab=overdue" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="kpi-icon red"><span className="material-icons-outlined">currency_rupee</span></div>
          <div>
            <div className="kpi-value">{formatCurrency(data.overdueAmount, branding.currencySymbol)}</div>
            <div className="kpi-label">{d.totalOverdueAmount}</div>
          </div>
        </Link>
        <Link href="/penalties?status=pending" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="kpi-icon purple"><span className="material-icons-outlined">gavel</span></div>
          <div>
            <div className="kpi-value">{formatCurrency(data.pendingPenaltyTotal, branding.currencySymbol)}</div>
            <div className="kpi-label">{d.penaltyAccumulated}</div>
          </div>
        </Link>
      </div>

      <div className="kpi-grid" style={{ marginTop: '12px' }}>
        <Link href="/approvals?status=pending" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="kpi-icon blue"><span className="material-icons-outlined">approval</span></div>
          <div>
            <div className="kpi-value">{data.pendingApprovals}</div>
            <div className="kpi-label">{d.pendingApprovals}</div>
          </div>
        </Link>
        <Link href="/accounting" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className={`kpi-icon ${data.currentCapital >= 0 ? 'green' : 'red'}`}><span className="material-icons-outlined">savings</span></div>
          <div>
            <div className="kpi-value">{formatCurrency(data.currentCapital, branding.currencySymbol)}</div>
            <div className="kpi-label">{dict.analytics.capitalBalance}</div>
            {data.pendingFieldFloat > 0 && (
              <div style={{ fontSize: '.7rem', color: 'var(--warning)', marginTop: '2px', fontWeight: 600 }}>
                + {formatCurrency(data.pendingFieldFloat, branding.currencySymbol)} pending field float
              </div>
            )}
          </div>
        </Link>
        <Link href="/accounting" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="kpi-icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#dc2626' }}>
            <span className="material-icons-outlined">account_balance</span>
          </div>
          <div>
            <div className="kpi-value">{formatCurrency(data.totalDisbursed, branding.currencySymbol)}</div>
            <div className="kpi-label">{dict.analytics.totalDisbursed}</div>
          </div>
        </Link>
        <Link href="/accounting" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="kpi-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
            <span className="material-icons-outlined">move_to_inbox</span>
          </div>
          <div>
            <div className="kpi-value">{formatCurrency(data.totalCollectedAllTime, branding.currencySymbol)}</div>
            <div className="kpi-label">{d.totalCollectedAllTime}</div>
          </div>
        </Link>
      </div>

      {/* Today's Collection Split — modern payment mode breakdown */}
      <div className="card" style={{ marginTop: '12px', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>donut_small</span>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>{d.collectionSplit}</span>
          </div>
          <div style={{ background: '#f1f5f9', padding: '4px 12px', borderRadius: '20px', fontSize: '.82rem', fontWeight: 700, color: '#475569' }}>
            Total: {formatCurrency(totalSplit, branding.currencySymbol)}
          </div>
        </div>
        {/* This is ALL cash physically collected today by mode (today's dues +
            overdue recovery) — i.e. the day's handover total, not today's-dues only. */}
        <div style={{ fontSize: '.72rem', color: '#94a3b8', marginBottom: '16px' }}>
          All money collected today by payment mode (today&apos;s dues + overdue recovery).
        </div>

        {activeModes.length > 0 ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(activeModes.length, 4)}, 1fr)`, gap: '12px', marginBottom: '16px' }}>
              {activeModes.map(([mode, amt]) => {
                const cfg = modeConfig[mode] || modeConfig.other;
                const pct = totalSplit > 0 ? Math.round((amt / totalSplit) * 100) : 0;
                return (
                  <div key={mode} style={{ background: cfg.bg, borderRadius: '12px', padding: '14px 16px', border: `1px solid ${cfg.color}22`, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-icons-outlined" style={{ fontSize: '20px', color: cfg.color }}>{cfg.icon}</span>
                      <span style={{ fontSize: '.78rem', fontWeight: 600, color: cfg.color, textTransform: 'uppercase', letterSpacing: '.05em' }}>{cfg.label}</span>
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(amt, branding.currencySymbol)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ flex: 1, height: '4px', background: `${cfg.color}22`, borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: cfg.color, borderRadius: '2px' }} />
                      </div>
                      <span style={{ fontSize: '.72rem', fontWeight: 700, color: cfg.color }}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            {(['cash', 'upi', 'online'] as const).map((mode) => {
              const cfg = modeConfig[mode];
              return (
                <div key={mode} style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px 16px', border: '1px solid #e2e8f0', opacity: 0.6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '20px', color: '#94a3b8' }}>{cfg.icon}</span>
                    <span style={{ fontSize: '.78rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>{cfg.label}</span>
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#cbd5e1' }}>{formatCurrency(0, branding.currencySymbol)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="kpi-grid" style={{ marginTop: '20px' }}>
        {data.bestPayer && (
          <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: 'white', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '32px', opacity: 0.9 }}>star</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '.85rem', opacity: 0.9, fontWeight: 500 }}>{d.bestPayer}</h4>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '4px' }}>{data.bestPayer.name}</div>
                <div style={{ fontSize: '.75rem', opacity: 0.8 }}>{data.bestPayer.customerCode} • {data.bestPayer.loans?.length || 0} Loans</div>
              </div>
            </div>
          </div>
        )}
        
        {data.highestBorrower && (
          <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', color: 'white', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '32px', opacity: 0.9 }}>account_balance</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '.85rem', opacity: 0.9, fontWeight: 500 }}>{d.highestBorrower}</h4>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '4px' }}>{data.highestBorrower.name}</div>
                <div style={{ fontSize: '.75rem', opacity: 0.8 }}>{data.highestBorrower.customerCode} • {data.highestBorrower.loans?.length || 0} Loans</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid-60-40" style={{ marginTop: '20px' }}>
        <div className="card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-icons-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>insights</span>
              {d.recentCollections}
            </h3>
          </div>
          <div style={{ padding: '8px 4px 0' }}>
            <CollectionTrendChart data={data.trend} currencySymbol={branding.currencySymbol} />
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{d.collectionDetails}</h3></div>
          {data.routePerformance.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>{dict.reports.route}</th>
                    <th>{dict.reports.agent}</th>
                    <th>{dict.sidebar.customers}</th>
                    <th>{d.collectedToday}</th>
                    <th>{dict.loansList.overdue}</th>
                    <th>{dict.customersList.action}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.routePerformance.map((route) => {
                    const routeCol = data.routeCollections?.find((rc: any) => rc.routeId === route.id);
                    const agentId = data.pendingCashCollections?.find((p: any) => p.customer?.routeId === route.id)?.agentId;
                    const pendingCash = data.pendingCashCollections
                      ?.filter((p: any) => p.customer?.routeId === route.id)
                      .reduce((sum: number, p: any) => sum + Number(p.receivedAmount), 0) || 0;

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
                        <td>
                          {agentId && pendingCash > 0 ? (
                            <CollectCashButton
                              routeId={route.id}
                              agentId={agentId}
                              pendingAmount={pendingCash}
                              currencySymbol={branding.currencySymbol}
                            />
                          ) : (
                            <span style={{ color: 'var(--text-light)', fontSize: '.8rem' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '24px', textAlign: 'center' }}>
              <span className="material-icons-outlined" style={{ fontSize: '36px', color: 'var(--text-light)' }}>route</span>
              <p style={{ marginTop: '8px', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
                No active routes for this branch.
              </p>
              <Link href="/settings" className="btn btn-ghost btn-sm" style={{ marginTop: '8px' }}>
                Set Up Routes
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="grid-60-40" style={{ marginTop: '20px' }}>
        <div className="card">
          <div className="card-header">
            <h3>{d.overdueAlerts}</h3>
            <Link href="/collection" className="btn btn-ghost btn-sm">{d.viewAll}</Link>
          </div>
          {data.overdueInstalments.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>{dict.loansList.customer}</th>
                    <th>{dict.reports.route}</th>
                    <th>{dict.collection.dueDate}</th>
                    <th>{dict.loansList.overdue}</th>
                    <th>{dict.customersList.action}</th>
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
                      <td><Link href={`/customers/${item.loan.customer.customerCode}`} className="btn btn-ghost btn-sm">{dict.loansList.view}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '24px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '36px', color: 'var(--success)' }}>check_circle</span>
              <p style={{ marginTop: '8px', fontSize: '.85rem', color: 'var(--text-secondary)' }}>{d.noOverdue}</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>{d.pendingUpiVerifications}</h3>
            {data.pendingUpiCollections && data.pendingUpiCollections.length > 0 && (
              <BulkVerifyUpiButton
                entryIds={data.pendingUpiCollections.map((upi: any) => upi.id)}
                totalAmount={data.pendingUpiCollections.reduce((sum: number, upi: any) => sum + Number(upi.receivedAmount), 0)}
                currencySymbol={branding.currencySymbol}
              />
            )}
          </div>
          {data.pendingUpiCollections && data.pendingUpiCollections.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>{dict.loansList.customer}</th>
                    <th>{dict.reports.agent}</th>
                    <th>{dict.accounting.amount}</th>
                    <th>{dict.customersList.action}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingUpiCollections.map((upi: any) => (
                    <tr key={upi.id}>
                      <td>
                        <strong>{upi.customer.name}</strong>
                        <br />
                        <span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{upi.loan.loanCode}</span>
                      </td>
                      <td>{upi.agent.name}</td>
                      <td style={{ color: 'var(--primary)', fontWeight: 700 }}>{formatCurrency(upi.receivedAmount, branding.currencySymbol)}</td>
                      <td>
                        <VerifyUpiButton entryId={upi.id} amount={Number(upi.receivedAmount)} currencySymbol={branding.currencySymbol} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '24px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '36px', color: 'var(--success)' }}>verified</span>
              <p style={{ marginTop: '8px', fontSize: '.85rem', color: 'var(--text-secondary)' }}>{d.noPendingUpi}</p>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header"><h3>{d.recentActivity}</h3></div>
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
    </>
  );
}
