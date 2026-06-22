import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';

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

  // Agent scoping — restrict to the agent's OWN customers via linkage (direct
  // agentId or route assignment), NOT by branch. A branch pin falsely excluded
  // their customers/loans with a null or different branchId. Admins stay
  // branch-scoped; superadmin/developer see the whole tenant.
  const isAgent = ctx.role === 'agent';
  const agentAccess = isAgent ? buildAgentCustomerAccessWhere({ userId: ctx.userId }) : null;

  const baseLoan: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    ...(isAgent ? { customer: agentAccess } : scopedBranchWhere(ctx)),
  };
  const baseCustomer: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    ...(isAgent ? agentAccess : scopedBranchWhere(ctx)),
  };

  try {
    const [
      activeLoans,
      overdueLoans,
      totalCustomers,
      todayInstalments,
      pendingPenalties,
      activeAgents,
      recentLoans,
      overdueForTotalsAgg,
      overdueDefaulterRows,
      overduePaidTodayAllocations,
      routes,
      recentActivity,
      cashCollectedAgg,
      todayActivityRows,
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
      // Overdue totals — aggregate avoids loading every instalment row.
      prisma.instalment.aggregate({
        where: { loan: baseLoan, dueDate: { lt: today }, status: { in: ['upcoming', 'missed', 'partial'] } },
        _sum: { dueAmount: true, receivedAmount: true },
      }),
      // Top overdue instalments for defaulter alerts (only need 10).
      prisma.instalment.findMany({
        where: { loan: baseLoan, dueDate: { lt: today }, status: { in: ['upcoming', 'missed', 'partial'] } },
        select: {
          id: true, dueDate: true, dueAmount: true, receivedAmount: true,
          loan: { select: { id: true, loanCode: true, customer: { select: { id: true, name: true, customerCode: true } } } },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
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
      // Today's activity feed — every collection recorded today, newest first,
      // with the customer collected from, the agent who collected, the amount,
      // and the time. Lets the dashboard show "what was done today" at a glance.
      prisma.collectionEntry.findMany({
        where: {
          tenantId: ctx.tenantId,
          submittedAt: { gte: today, lt: tomorrow },
          loan: baseLoan,
        },
        select: {
          id: true,
          receivedAmount: true,
          paymentMode: true,
          submittedAt: true,
          verificationStatus: true,
          source: true,
          customer: { select: { id: true, name: true, customerCode: true } },
          agent: { select: { id: true, name: true } },
          loan: { select: { loanCode: true } },
        },
        orderBy: { submittedAt: 'desc' },
        take: 100,
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

    // Overdue totals come from the DB aggregate — no large row set in memory.
    const overdueDueTotal = Number(overdueForTotalsAgg._sum.dueAmount ?? 0);
    const overdueReceivedTotal = Number(overdueForTotalsAgg._sum.receivedAmount ?? 0);
    const overdueOutstanding = Math.max(0, overdueDueTotal - overdueReceivedTotal);
    const overdueCollectedToday = overduePaidTodayAllocations.reduce(
      (sum, a) => sum + Number(a.amount),
      0,
    );
    const overdueTotalTillToday = overdueOutstanding + overdueCollectedToday;

    const defaulterAlerts = overdueDefaulterRows
      .map((item) => ({ ...item, overdueAmount: outstanding(item) }))
      .filter((item) => item.overdueAmount > 0);

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
      // Group the raw entries into one activity line per collection action: a
      // single payment is distributed into many instalment rows (all written in
      // the same instant), so we fold them by customer+agent+loan+minute and
      // sum the amount — the feed shows one tidy line, newest first.
      todayActivity: (() => {
        const groups = new Map<string, any>();
        for (const e of todayActivityRows) {
          const minute = new Date(e.submittedAt);
          minute.setSeconds(0, 0);
          const key = `${e.customer?.id ?? ''}|${e.agent?.id ?? ''}|${e.loan?.loanCode ?? ''}|${minute.getTime()}`;
          const existing = groups.get(key);
          if (existing) {
            existing.amount += Number(e.receivedAmount);
            existing.count += 1;
            if (new Date(e.submittedAt) > new Date(existing.submittedAt)) {
              existing.submittedAt = e.submittedAt;
            }
          } else {
            groups.set(key, {
              id: e.id,
              amount: Number(e.receivedAmount),
              count: 1,
              paymentMode: e.paymentMode,
              submittedAt: e.submittedAt,
              verificationStatus: e.verificationStatus,
              source: e.source,
              customerName: e.customer?.name ?? '—',
              customerCode: e.customer?.customerCode ?? '',
              customerId: e.customer?.id ?? '',
              agentName: e.agent?.name ?? '—',
              loanCode: e.loan?.loanCode ?? '',
            });
          }
        }
        return Array.from(groups.values()).sort(
          (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
        );
      })(),
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Dashboard failed', 500);
  }
}
