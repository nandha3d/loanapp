import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

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
        select: { dueAmount: true, receivedAmount: true },
      }),
      // Today's payments that landed on PAST-DUE instalments = overdue recovered today.
      prisma.paymentAllocation.findMany({
        where: {
          payment: { tenantId: ctx.tenantId, paymentDate: { gte: today, lt: tomorrow }, loan: baseLoan },
          instalment: { dueDate: { lt: today } },
        },
        select: { amount: true },
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
    const todayGap = Math.max(0, todayExpected - todayCollected);

    // Overdue collection — daily snapshot that re-bases each day:
    //   Remaining = overdue still outstanding now; Collected today = today's
    //   payments on past-due instalments; Total = what was overdue at start of today.
    const overdueOutstanding = overdueForTotalsRaw.reduce(
      (sum, i) => sum + Math.max(0, Number(i.dueAmount) - Number(i.receivedAmount || 0)),
      0,
    );
    const overdueCollectedToday = overduePaidTodayAllocations.reduce(
      (sum, a) => sum + Number(a.amount),
      0,
    );
    const overdueTotalTillToday = overdueOutstanding + overdueCollectedToday;

    return ok({
      activeLoans,
      overdueLoans,
      totalCustomers,
      todayExpected,
      todayCollected,
      todayGap,
      overdueOutstanding,
      overdueCollectedToday,
      overdueTotalTillToday,
      pendingPenalties,
      activeAgents,
      recentLoans,
      todayInstalments,
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Dashboard failed', 500);
  }
}
