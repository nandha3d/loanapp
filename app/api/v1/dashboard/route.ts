import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  // Anchor "today" to IST (UTC+5:30) so the business day boundary is correct
  // regardless of the server's timezone (VPS often runs UTC). Without this, a
  // collection made in the evening IST could fall on the wrong calendar day.
  const IST_OFFSET_MS = 330 * 60 * 1000;
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const istMidnightUtcMs =
    Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) -
    IST_OFFSET_MS;
  const today = new Date(istMidnightUtcMs);
  const tomorrow = new Date(istMidnightUtcMs + 24 * 60 * 60 * 1000);

  const baseLoan: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    ...scopedBranchWhere(ctx),
  };
  const baseCustomer: any = { ...baseLoan };

  // Agent scoping — restrict to customers/loans in agent's assigned routes.
  if (ctx.role === 'agent') {
    const routeIds = await getAgentRouteIds(ctx.userId);
    if (routeIds.length === 0) {
      return ok({
        activeLoans: 0,
        overdueLoans: 0,
        totalCustomers: 0,
        todayExpected: 0,
        todayCollected: 0,
        cashCollectedToday: 0,
        todayGap: 0,
        overdueOutstanding: 0,
        overdueCollectedToday: 0,
        overdueTotalTillToday: 0,
        pendingPenalties: 0,
        activeAgents: 0,
        recentLoans: [],
        todayInstalments: [],
      });
    }
    baseCustomer.routeId = { in: routeIds };
    baseLoan.customer = { routeId: { in: routeIds } };
  }

  try {
    const [
      activeLoans,
      overdueLoans,
      totalCustomers,
      todayInstalments,
      pendingPenalties,
      activeAgents,
      recentLoans,
      overdueForTotalsRaw,
      overduePaidTodayAllocations,
      routes,
      recentActivity,
      cashCollectedAgg,
    ] = await Promise.all([
      prisma.loan.count({ where: { ...baseLoan, status: 'active' } }),
      prisma.loan.count({ where: { ...baseLoan, status: 'overdue' } }),
      prisma.customer.count({ where: { ...baseCustomer, status: { not: 'blacklisted' } } }),
      prisma.instalment.findMany({
        where: { loan: baseLoan, dueDate: { gte: today, lt: tomorrow } },
        include: { loan: { include: { customer: { select: { id: true, name: true, customerCode: true } } } } },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.penalty.count({ where: { loan: baseLoan, status: 'pending' } }),
      prisma.user.count({
        where: {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          role: 'agent',
          status: 'active',
          ...scopedBranchWhere(ctx),
        },
      }),
      prisma.loan.findMany({
        where: baseLoan,
        include: { customer: { select: { id: true, customerCode: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Overdue (past-due, still-open) instalments — for the overdue card totals.
      prisma.instalment.findMany({
        where: { loan: baseLoan, dueDate: { lt: today }, status: { in: ['upcoming', 'missed', 'partial'] } },
        include: { loan: { include: { customer: { select: { id: true, name: true, customerCode: true } } } } },
        orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
      }),
      // Today's payments that landed on PAST-DUE instalments = overdue recovered today.
      prisma.paymentAllocation.findMany({
        where: {
          payment: { tenantId: ctx.tenantId, paymentDate: { gte: today, lt: tomorrow }, loan: baseLoan },
          instalment: { dueDate: { lt: today } },
        },
        select: { amount: true },
      }),
      prisma.route.findMany({
        where: { tenantId: ctx.tenantId, appType: ctx.appType, status: 'active', ...scopedBranchWhere(ctx) },
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
      prisma.auditLog.findMany({
        where: { tenantId: ctx.tenantId, user: { role: { not: 'developer' }, ...scopedBranchWhere(ctx) } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { user: true },
      }),
      // Actual cash collected today — ALL collection entries submitted today,
      // regardless of which instalment (today's, overdue, or future) they hit.
      // This is the real "money taken today" figure for the hero card.
      prisma.collectionEntry.aggregate({
        where: {
          tenantId: ctx.tenantId,
          submittedAt: { gte: today, lt: tomorrow },
          loan: baseLoan,
        },
        _sum: { receivedAmount: true },
      }),
    ]);

    const todayExpected = todayInstalments.reduce(
      (sum, item) => sum + Number(item.dueAmount),
      0,
    );
    // Today's Collected = money applied to TODAY's instalments only (matches the
    // web dashboard). Overdue recovery is reported separately below — never merged.
    const todayCollected = todayInstalments.reduce(
      (sum, item) => sum + Math.min(Number(item.receivedAmount || 0), Number(item.dueAmount)),
      0,
    );
    // Actual cash taken today across all instalments (see query note above).
    const cashCollectedToday = Number(cashCollectedAgg._sum.receivedAmount ?? 0);
    const todayGap = Math.max(0, todayExpected - todayCollected);
    const hitRate = todayExpected > 0 ? Math.round((todayCollected / todayExpected) * 100) : 0;
    const todayPending = todayGap;

    const outstanding = (item: any) => Math.max(0, Number(item.dueAmount) - Number(item.receivedAmount || 0));

    // Overdue collection — daily snapshot that re-bases each day:
    //   Remaining = overdue still outstanding now; Collected today = today's
    //   payments on past-due instalments; Total = what was overdue at start of today.
    const overdueOutstanding = overdueForTotalsRaw.reduce(
      (sum, i) => sum + outstanding(i),
      0,
    );
    const overdueCollectedToday = overduePaidTodayAllocations.reduce(
      (sum, a) => sum + Number(a.amount),
      0,
    );
    const overdueTotalTillToday = overdueOutstanding + overdueCollectedToday;

    const defaulterAlerts = overdueForTotalsRaw
      .map((item) => ({ ...item, overdueAmount: outstanding(item) }))
      .filter((item) => item.overdueAmount > 0)
      .slice(0, 10);

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

    return ok({
      activeLoans,
      overdueLoans,
      totalCustomers,
      todayExpected,
      todayCollected,
      cashCollectedToday,
      todayGap,
      hitRate,
      todayPending,
      overdueOutstanding,
      overdueCollectedToday,
      overdueTotalTillToday,
      pendingPenalties,
      activeAgents,
      recentLoans,
      todayInstalments,
      defaulterAlerts,
      routePerformance,
      recentActivity,
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Dashboard failed', 500);
  }
}
