import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';
import { getDistributedInstalmentsAndMetrics } from '@/lib/repayments';
import { LOAN_PRECLOSE_REQUEST } from '@/lib/loanPreclosePolicy';
import { precloseApprovalVisibility } from '@/lib/loanPrecloseRequests';
import type { Prisma } from '@prisma/client';

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
    // ApprovalRequest has no branchId. Match the v1 approvals queue: agents
    // see their own requests; admins see their branch's requests, with loan
    // preclose requests scoped by the loan's branch rather than the filer.
    const approvalWhere: Prisma.ApprovalRequestWhereInput = {
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      OR: [
        { createdAt: { gte: today, lt: tomorrow } },
        { reviewedAt: { gte: today, lt: tomorrow } },
      ],
    };
    if (isAgent) {
      approvalWhere.requestedById = ctx.userId;
    } else if (ctx.branchId) {
      if (ctx.appType === 'microlending') {
        approvalWhere.AND = [{ OR: [
          { requestType: { not: LOAN_PRECLOSE_REQUEST }, requestedBy: { branchId: ctx.branchId } },
          await precloseApprovalVisibility(ctx.tenantId, ctx.appType, ctx.branchId),
        ] }];
      } else {
        approvalWhere.requestedBy = { branchId: ctx.branchId };
      }
    }

    const [
      activeLoans,
      overdueLoans,
      totalCustomers,
      todayInstalments,
      pendingPenalties,
      activeAgents,
      recentLoans,
      allInstalmentsForTotals,
      overdueDefaulterRows,
      paymentsToday,
      routes,
      recentActivity,
      cashCollectedAgg,
      todayActivityRows,
    ] = await Promise.all([
      prisma.loan.count({ where: { ...baseLoan, status: 'active' } }),
      prisma.loan.count({ where: { ...baseLoan, status: 'overdue' } }),
      prisma.customer.count({ where: { ...baseCustomer, status: { not: 'blacklisted' } } }),
      prisma.instalment.findMany({
        where: { loan: { ...baseLoan, status: { in: ['active', 'overdue'] } }, dueDate: { gte: today, lt: tomorrow } },
        include: {
          loan: {
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                  customerCode: true,
                  profilePhoto: true,
                  phone: true,
                  route: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.penalty.count({ where: { loan: { ...baseLoan, status: { in: ['active', 'overdue'] } }, status: 'pending' } }),
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
        include: { customer: { select: { id: true, customerCode: true, name: true, profilePhoto: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.instalment.findMany({
        where: {
          loan: { ...baseLoan, status: { in: ['active', 'overdue'] } },
          status: { not: 'waived' },
          OR: [
            { dueDate: { lt: today } },
            { receivedAmount: { gt: 0 } },
          ],
        },
        select: {
          id: true,
          loanId: true,
          dueDate: true,
          dueAmount: true,
          receivedAmount: true,
          status: true,
          instalmentNo: true,
          loan: { select: { id: true, frequency: true, status: true, customerId: true } },
        },
      }),
      // Top overdue instalments for defaulter alerts (only need 10).
      prisma.instalment.findMany({
        where: { loan: { ...baseLoan, status: { in: ['active', 'overdue'] } }, dueDate: { lt: today }, status: { in: ['upcoming', 'missed', 'partial'] } },
        select: {
          id: true, dueDate: true, dueAmount: true, receivedAmount: true,
          loan: { select: { id: true, loanCode: true, customer: { select: { id: true, name: true, customerCode: true, profilePhoto: true } } } },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      prisma.payment.findMany({
        where: {
          tenantId: ctx.tenantId,
          paymentDate: { gte: today, lt: tomorrow },
          loan: { ...baseLoan, status: { in: ['active', 'overdue'] } },
        },
        select: { loanId: true, amount: true },
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
          dueAmount: true,
          paymentMode: true,
          submittedAt: true,
          verificationStatus: true,
          source: true,
          customer: {
            select: {
              id: true,
              name: true,
              customerCode: true,
              profilePhoto: true,
              phone: true,
              route: { select: { id: true, name: true } },
            },
          },
          agent: { select: { id: true, name: true } },
          loan: {
            select: {
              id: true,
              loanCode: true,
              frequency: true,
              principal: true,
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
      }),
    ]);

    // Web dashboard parity additions
    const [
      totalLoansAgg,
      topRepayer,
      topLoan,
      pendingUpiCollections,
      pendingCashCollections,
      collectionsByMode,
      todayNewLoans,
      todayNewCustomers,
      todayClosedLoans,
      todayApprovals,
    ] = await Promise.all([
      prisma.loan.aggregate({
        where: { ...baseLoan, status: { in: ['active', 'overdue', 'closed', 'settled'] } },
        _sum: { principal: true, disbursed: true, totalCollected: true },
      }),
      prisma.collectionEntry.groupBy({
        by: ['customerId'],
        where: { tenantId: ctx.tenantId, loan: baseLoan },
        _sum: { receivedAmount: true },
        orderBy: { _sum: { receivedAmount: 'desc' } },
        take: 1,
      }),
      prisma.loan.findFirst({
        where: { ...baseLoan, status: { in: ['active', 'overdue'] } },
        orderBy: { principal: 'desc' },
        include: { customer: { select: { name: true } } },
      }),
      prisma.collectionEntry.findMany({
        where: {
          tenantId: ctx.tenantId,
          paymentMode: 'upi',
          verificationStatus: 'pending',
          loan: baseLoan,
        },
        select: {
          id: true,
          receivedAmount: true,
          paymentMode: true,
          submittedAt: true,
          verificationStatus: true,
          source: true,
          customer: { select: { id: true, name: true, customerCode: true, profilePhoto: true } },
          agent: { select: { id: true, name: true } },
          loan: { select: { loanCode: true } },
        },
        orderBy: { submittedAt: 'desc' },
      }),
      prisma.collectionEntry.findMany({
        where: {
          tenantId: ctx.tenantId,
          paymentMode: 'cash',
          verificationStatus: 'pending',
          loan: baseLoan,
        },
        select: {
          id: true,
          receivedAmount: true,
          paymentMode: true,
          submittedAt: true,
          verificationStatus: true,
          source: true,
          customer: { select: { id: true, name: true, customerCode: true, profilePhoto: true } },
          agent: { select: { id: true, name: true } },
          loan: { select: { loanCode: true } },
        },
        orderBy: { submittedAt: 'desc' },
      }),
      prisma.collectionEntry.groupBy({
        by: ['paymentMode'],
        where: {
          tenantId: ctx.tenantId,
          submittedAt: { gte: today, lt: tomorrow },
          loan: baseLoan,
        },
        _sum: { receivedAmount: true },
      }),
      // New loans created today
      prisma.loan.findMany({
        where: {
          ...baseLoan,
          createdAt: { gte: today, lt: tomorrow },
        },
        select: {
          id: true,
          loanCode: true,
          principal: true,
          frequency: true,
          tenure: true,
          createdAt: true,
          customer: {
            select: {
              id: true,
              name: true,
              customerCode: true,
              phone: true,
              route: { select: { id: true, name: true } },
            },
          },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      // New customers registered today
      prisma.customer.findMany({
        where: {
          ...baseCustomer,
          createdAt: { gte: today, lt: tomorrow },
        },
        select: {
          id: true,
          name: true,
          customerCode: true,
          phone: true,
          createdAt: true,
          route: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      // Loans closed today
      prisma.loan.findMany({
        where: {
          ...baseLoan,
          closedAt: { gte: today, lt: tomorrow },
        },
        select: {
          id: true,
          loanCode: true,
          closureType: true,
          closedAt: true,
          customer: { select: { id: true, name: true, customerCode: true } },
        },
        orderBy: { closedAt: 'desc' },
        take: 15,
      }),
      // Approvals processed today
      prisma.approvalRequest.findMany({
        where: approvalWhere,
        select: {
          id: true,
          requestType: true,
          entityType: true,
          status: true,
          createdAt: true,
          reviewedAt: true,
          requestedBy: { select: { name: true } },
          reviewedBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ]);

    const totalDisbursed = Number(totalLoansAgg._sum.disbursed ?? 0);
    const totalCollectedAllTime = Number(totalLoansAgg._sum.totalCollected ?? 0);

    let bestPayer = '—';
    if (topRepayer.length > 0 && topRepayer[0].customerId) {
      const cust = await prisma.customer.findFirst({
        where: { id: topRepayer[0].customerId, tenantId: ctx.tenantId },
        select: { name: true },
      });
      if (cust) bestPayer = cust.name;
    }
    const highestBorrower = topLoan?.customer?.name ?? '—';

    const todayByMode: Record<string, number> = {};
    for (const c of collectionsByMode) {
      todayByMode[c.paymentMode] = Number(c._sum.receivedAmount ?? 0);
    }

    const todayExpected = todayInstalments.reduce(
      (sum, item) => sum + Number(item.dueAmount),
      0,
    );
    // Scheduled-row progress stays available for detailed due-state views.
    // The dashboard hero's "Collected today" is actual cash submitted today.
    const todayScheduledCollected = todayInstalments.reduce(
      (sum, item) => sum + Math.min(Number(item.receivedAmount || 0), Number(item.dueAmount)),
      0,
    );
    // Actual cash taken today across all instalments (see query note above).
    const cashCollectedToday = Number(cashCollectedAgg._sum.receivedAmount ?? 0);
    const todayCollected = cashCollectedToday;
    const todayProgressCollected = Math.min(cashCollectedToday, todayExpected);
    const todayGap = Math.max(0, todayExpected - todayProgressCollected);
    const hitRate = todayExpected > 0 ? Math.round((todayProgressCollected / todayExpected) * 100) : 0;
    const todayPending = todayGap;

    const outstanding = (item: any) => Math.max(0, Number(item.dueAmount) - Number(item.receivedAmount || 0));

    const { metricsByLoan } = getDistributedInstalmentsAndMetrics(
      allInstalmentsForTotals,
      today,
      paymentsToday,
    );

    let overdueOutstanding = 0;
    let overdueCollectedToday = 0;
    for (const m of metricsByLoan.values()) {
      overdueOutstanding += m.overdueOutstanding;
      overdueCollectedToday += m.overdueCollectedToday;
    }
    const overdueTotalTillToday = overdueOutstanding + overdueCollectedToday;

    // ── Frequency × Status breakdown (web parity) ──────────────────────────
    type FrequencyKey = 'daily' | 'weekly' | 'monthly' | 'custom';
    const zeroSub = () => ({ expected: 0, collected: 0, remaining: 0, loanCount: 0, customerCount: 0, pct: 0 });
    const zeroOverdueSub = () => ({ totalOverdue: 0, collectedToday: 0, remaining: 0, loanCount: 0, customerCount: 0, pct: 0 });
    const mkSets = () => ({ total: new Set<string>(), active: new Set<string>(), inactive: new Set<string>() });

    // Today's Collection breakdown
    const todayLoansByStatus = {
      active: { expected: 0, collected: 0, remaining: 0, loans: new Set<string>(), customers: new Set<string>(), pct: 0 },
      inactive: { expected: 0, collected: 0, remaining: 0, loans: new Set<string>(), customers: new Set<string>(), pct: 0 },
    };
    const todayFrequencyBreakdown: Record<FrequencyKey, { total: ReturnType<typeof zeroSub>; active: ReturnType<typeof zeroSub>; inactive: ReturnType<typeof zeroSub> }> = {
      daily: { total: zeroSub(), active: zeroSub(), inactive: zeroSub() },
      weekly: { total: zeroSub(), active: zeroSub(), inactive: zeroSub() },
      monthly: { total: zeroSub(), active: zeroSub(), inactive: zeroSub() },
      custom: { total: zeroSub(), active: zeroSub(), inactive: zeroSub() },
    };
    const todayFreqLoans: Record<FrequencyKey, ReturnType<typeof mkSets>> = { daily: mkSets(), weekly: mkSets(), monthly: mkSets(), custom: mkSets() };
    const todayFreqCustomers: Record<FrequencyKey, ReturnType<typeof mkSets>> = { daily: mkSets(), weekly: mkSets(), monthly: mkSets(), custom: mkSets() };
    const allTodayLoans = new Set<string>();
    const allTodayCustomers = new Set<string>();

    for (const item of todayInstalments) {
      const rawFreq = ((item as any).loan?.frequency || '').toLowerCase().trim();
      let freq: FrequencyKey = 'daily';
      if (rawFreq === 'weekly' || rawFreq === 'biweekly') {
        freq = 'weekly';
      } else if (rawFreq === 'monthly') {
        freq = 'monthly';
      } else if (
        rawFreq === 'custom' ||
        rawFreq === 'custom_duration' ||
        rawFreq === 'single_payment' ||
        rawFreq === 'bullet' ||
        rawFreq.includes('custom') ||
        rawFreq.includes('single') ||
        ((item as any).loan?.termType || '').toLowerCase() === 'bullet' ||
        (rawFreq !== '' && rawFreq !== 'daily')
      ) {
        freq = 'custom';
      } else {
        freq = 'daily';
      }
      const isActive = ((item as any).loan?.status || '').toLowerCase() === 'active';
      const statusKey: 'active' | 'inactive' = isActive ? 'active' : 'inactive';
      const due = Number(item.dueAmount || 0);
      const rec = Math.min(Number(item.receivedAmount || 0), due);
      const rem = Math.max(0, due - Number(item.receivedAmount || 0));

      todayLoansByStatus[statusKey].expected += due;
      todayLoansByStatus[statusKey].collected += rec;
      todayLoansByStatus[statusKey].remaining += rem;

      if (item.loanId) {
        todayLoansByStatus[statusKey].loans.add(item.loanId);
        allTodayLoans.add(item.loanId);
        todayFreqLoans[freq].total.add(item.loanId);
        todayFreqLoans[freq][statusKey].add(item.loanId);
      }
      const custId = (item as any).loan?.customerId;
      if (custId) {
        todayLoansByStatus[statusKey].customers.add(custId);
        allTodayCustomers.add(custId);
        todayFreqCustomers[freq].total.add(custId);
        todayFreqCustomers[freq][statusKey].add(custId);
      }

      todayFrequencyBreakdown[freq].total.expected += due;
      todayFrequencyBreakdown[freq].total.collected += rec;
      todayFrequencyBreakdown[freq].total.remaining += rem;
      todayFrequencyBreakdown[freq][statusKey].expected += due;
      todayFrequencyBreakdown[freq][statusKey].collected += rec;
      todayFrequencyBreakdown[freq][statusKey].remaining += rem;
    }

    for (const key of ['daily', 'weekly', 'monthly', 'custom'] as FrequencyKey[]) {
      const fb = todayFrequencyBreakdown[key];
      fb.total.loanCount = todayFreqLoans[key].total.size;
      fb.total.customerCount = todayFreqCustomers[key].total.size;
      fb.total.pct = fb.total.expected > 0 ? Math.min(100, Math.round((fb.total.collected / fb.total.expected) * 100)) : 0;
      fb.active.loanCount = todayFreqLoans[key].active.size;
      fb.active.customerCount = todayFreqCustomers[key].active.size;
      fb.active.pct = fb.active.expected > 0 ? Math.min(100, Math.round((fb.active.collected / fb.active.expected) * 100)) : 0;
      fb.inactive.loanCount = todayFreqLoans[key].inactive.size;
      fb.inactive.customerCount = todayFreqCustomers[key].inactive.size;
      fb.inactive.pct = fb.inactive.expected > 0 ? Math.min(100, Math.round((fb.inactive.collected / fb.inactive.expected) * 100)) : 0;
    }

    todayLoansByStatus.active.pct = todayLoansByStatus.active.expected > 0
      ? Math.min(100, Math.round((todayLoansByStatus.active.collected / todayLoansByStatus.active.expected) * 100)) : 0;
    todayLoansByStatus.inactive.pct = todayLoansByStatus.inactive.expected > 0
      ? Math.min(100, Math.round((todayLoansByStatus.inactive.collected / todayLoansByStatus.inactive.expected) * 100)) : 0;

    const todayCollectedPct = todayExpected > 0
      ? Math.min(100, Math.round((todayProgressCollected / todayExpected) * 100))
      : (todayProgressCollected > 0 ? 100 : 0);

    const todayBreakdown = {
      total: { expected: todayExpected, collected: todayProgressCollected, remaining: todayGap, loanCount: allTodayLoans.size, customerCount: allTodayCustomers.size, pct: todayCollectedPct },
      active: { expected: todayLoansByStatus.active.expected, collected: todayLoansByStatus.active.collected, remaining: todayLoansByStatus.active.remaining, loanCount: todayLoansByStatus.active.loans.size, customerCount: todayLoansByStatus.active.customers.size, pct: todayLoansByStatus.active.pct },
      inactive: { expected: todayLoansByStatus.inactive.expected, collected: todayLoansByStatus.inactive.collected, remaining: todayLoansByStatus.inactive.remaining, loanCount: todayLoansByStatus.inactive.loans.size, customerCount: todayLoansByStatus.inactive.customers.size, pct: todayLoansByStatus.inactive.pct },
      breakdown: todayFrequencyBreakdown,
    };

    // Overdue Collection breakdown
    const loanFrequencyMap = new Map<string, FrequencyKey>();
    const loanStatusMap = new Map<string, boolean>();
    const loanCustomerMap = new Map<string, string>();
    for (const item of allInstalmentsForTotals as any[]) {
      const rawFreq = (item.loan?.frequency || '').toLowerCase().trim();
      let freq: FrequencyKey = 'daily';
      if (rawFreq === 'weekly' || rawFreq === 'biweekly') {
        freq = 'weekly';
      } else if (rawFreq === 'monthly') {
        freq = 'monthly';
      } else if (
        rawFreq === 'custom' ||
        rawFreq === 'custom_duration' ||
        rawFreq === 'single_payment' ||
        rawFreq === 'bullet' ||
        rawFreq.includes('custom') ||
        rawFreq.includes('single') ||
        (item.loan?.termType || '').toLowerCase() === 'bullet' ||
        (rawFreq !== '' && rawFreq !== 'daily')
      ) {
        freq = 'custom';
      } else {
        freq = 'daily';
      }
      loanFrequencyMap.set(item.loanId, freq);
      loanStatusMap.set(item.loanId, (item.loan?.status || '').toLowerCase() === 'active');
      if (item.loan?.customerId) loanCustomerMap.set(item.loanId, item.loan.customerId);
    }

    const overdueFrequencyBreakdown: Record<FrequencyKey, { total: ReturnType<typeof zeroOverdueSub>; active: ReturnType<typeof zeroOverdueSub>; inactive: ReturnType<typeof zeroOverdueSub> }> = {
      daily: { total: zeroOverdueSub(), active: zeroOverdueSub(), inactive: zeroOverdueSub() },
      weekly: { total: zeroOverdueSub(), active: zeroOverdueSub(), inactive: zeroOverdueSub() },
      monthly: { total: zeroOverdueSub(), active: zeroOverdueSub(), inactive: zeroOverdueSub() },
      custom: { total: zeroOverdueSub(), active: zeroOverdueSub(), inactive: zeroOverdueSub() },
    };
    const overdueLoansByStatus = {
      active: { totalOverdue: 0, collectedToday: 0, remaining: 0, loans: new Set<string>(), customers: new Set<string>(), pct: 0 },
      inactive: { totalOverdue: 0, collectedToday: 0, remaining: 0, loans: new Set<string>(), customers: new Set<string>(), pct: 0 },
    };
    const overdueFreqLoans: Record<FrequencyKey, ReturnType<typeof mkSets>> = { daily: mkSets(), weekly: mkSets(), monthly: mkSets(), custom: mkSets() };
    const overdueFreqCustomers: Record<FrequencyKey, ReturnType<typeof mkSets>> = { daily: mkSets(), weekly: mkSets(), monthly: mkSets(), custom: mkSets() };
    const allOverdueLoans = new Set<string>();
    const allOverdueCustomers = new Set<string>();

    for (const [loanId, m] of metricsByLoan.entries()) {
      const freq = loanFrequencyMap.get(loanId) || 'daily';
      const isActive = loanStatusMap.get(loanId) ?? true;
      const statusKey: 'active' | 'inactive' = isActive ? 'active' : 'inactive';
      const custId = loanCustomerMap.get(loanId);

      overdueLoansByStatus[statusKey].totalOverdue += m.overdueTotalTillToday;
      overdueLoansByStatus[statusKey].collectedToday += m.overdueCollectedToday;
      overdueLoansByStatus[statusKey].remaining += m.overdueOutstanding;

      if (m.overdueTotalTillToday > 0 || m.overdueOutstanding > 0) {
        overdueLoansByStatus[statusKey].loans.add(loanId);
        allOverdueLoans.add(loanId);
        overdueFreqLoans[freq].total.add(loanId);
        overdueFreqLoans[freq][statusKey].add(loanId);
        if (custId) {
          overdueLoansByStatus[statusKey].customers.add(custId);
          allOverdueCustomers.add(custId);
          overdueFreqCustomers[freq].total.add(custId);
          overdueFreqCustomers[freq][statusKey].add(custId);
        }
      }

      overdueFrequencyBreakdown[freq].total.totalOverdue += m.overdueTotalTillToday;
      overdueFrequencyBreakdown[freq].total.collectedToday += m.overdueCollectedToday;
      overdueFrequencyBreakdown[freq].total.remaining += m.overdueOutstanding;
      overdueFrequencyBreakdown[freq][statusKey].totalOverdue += m.overdueTotalTillToday;
      overdueFrequencyBreakdown[freq][statusKey].collectedToday += m.overdueCollectedToday;
      overdueFrequencyBreakdown[freq][statusKey].remaining += m.overdueOutstanding;
    }

    for (const key of ['daily', 'weekly', 'monthly', 'custom'] as FrequencyKey[]) {
      const fb = overdueFrequencyBreakdown[key];
      fb.total.loanCount = overdueFreqLoans[key].total.size;
      fb.total.customerCount = overdueFreqCustomers[key].total.size;
      fb.total.pct = fb.total.totalOverdue > 0 ? Math.min(100, Math.round((fb.total.collectedToday / fb.total.totalOverdue) * 100)) : 0;
      fb.active.loanCount = overdueFreqLoans[key].active.size;
      fb.active.customerCount = overdueFreqCustomers[key].active.size;
      fb.active.pct = fb.active.totalOverdue > 0 ? Math.min(100, Math.round((fb.active.collectedToday / fb.active.totalOverdue) * 100)) : 0;
      fb.inactive.loanCount = overdueFreqLoans[key].inactive.size;
      fb.inactive.customerCount = overdueFreqCustomers[key].inactive.size;
      fb.inactive.pct = fb.inactive.totalOverdue > 0 ? Math.min(100, Math.round((fb.inactive.collectedToday / fb.inactive.totalOverdue) * 100)) : 0;
    }

    overdueLoansByStatus.active.pct = overdueLoansByStatus.active.totalOverdue > 0
      ? Math.min(100, Math.round((overdueLoansByStatus.active.collectedToday / overdueLoansByStatus.active.totalOverdue) * 100)) : 0;
    overdueLoansByStatus.inactive.pct = overdueLoansByStatus.inactive.totalOverdue > 0
      ? Math.min(100, Math.round((overdueLoansByStatus.inactive.collectedToday / overdueLoansByStatus.inactive.totalOverdue) * 100)) : 0;

    const overduePct = overdueTotalTillToday > 0
      ? Math.min(100, Math.round((overdueCollectedToday / overdueTotalTillToday) * 100)) : 0;

    const overdueBreakdown = {
      total: { totalOverdue: overdueTotalTillToday, collectedToday: overdueCollectedToday, remaining: overdueOutstanding, loanCount: allOverdueLoans.size, customerCount: allOverdueCustomers.size, pct: overduePct },
      active: { totalOverdue: overdueLoansByStatus.active.totalOverdue, collectedToday: overdueLoansByStatus.active.collectedToday, remaining: overdueLoansByStatus.active.remaining, loanCount: overdueLoansByStatus.active.loans.size, customerCount: overdueLoansByStatus.active.customers.size, pct: overdueLoansByStatus.active.pct },
      inactive: { totalOverdue: overdueLoansByStatus.inactive.totalOverdue, collectedToday: overdueLoansByStatus.inactive.collectedToday, remaining: overdueLoansByStatus.inactive.remaining, loanCount: overdueLoansByStatus.inactive.loans.size, customerCount: overdueLoansByStatus.inactive.customers.size, pct: overdueLoansByStatus.inactive.pct },
      breakdown: overdueFrequencyBreakdown,
    };

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
        agentId: route.routeAgents?.[0]?.agentId ?? null,
        agent: route.routeAgents?.map((ra: any) => ra.agent?.name).join(', ') || '-',
        customers: route._count.customers,
        overdue: routeOverdue,
      };
    });

    const todayPendingDues = todayInstalments
      .filter((inst) => outstanding(inst) > 0 && (inst as any).loan?.status !== 'closed')
      .map((inst) => ({
        id: inst.id,
        type: 'pending' as const,
        dueAmount: Number(inst.dueAmount),
        receivedAmount: Number(inst.receivedAmount || 0),
        remainingAmount: outstanding(inst),
        dueDate: inst.dueDate,
        status: (inst.status === 'upcoming' ? 'pending' : inst.status) as 'pending' | 'partial' | 'missed',
        customer: {
          id: (inst as any).loan?.customer?.id ?? '',
          name: (inst as any).loan?.customer?.name ?? 'Customer',
          customerCode: (inst as any).loan?.customer?.customerCode ?? '—',
          phone: (inst as any).loan?.customer?.phone ?? null,
          route: (inst as any).loan?.customer?.route ? { id: (inst as any).loan.customer.route.id, name: (inst as any).loan.customer.route.name } : null,
        },
        loan: {
          id: (inst as any).loan?.id ?? '',
          loanCode: (inst as any).loan?.loanCode ?? '—',
          frequency: (inst as any).loan?.frequency ?? null,
          perInstalment: Number((inst as any).loan?.perInstalment || 0),
        },
      }));

    const todayPaidItems = todayActivityRows.map((e: any) => ({
      id: e.id,
      type: 'paid' as const,
      receivedAmount: Number(e.receivedAmount),
      dueAmount: Number(e.dueAmount || 0),
      paymentMode: e.paymentMode || 'cash',
      submittedAt: e.submittedAt,
      verificationStatus: e.verificationStatus || 'verified',
      customer: {
        id: e.customer?.id || '',
        name: e.customer?.name || 'Customer',
        customerCode: e.customer?.customerCode || '—',
        phone: e.customer?.phone || null,
        route: e.customer?.route ? { id: e.customer.route.id, name: e.customer.route.name } : null,
      },
      loan: {
        id: e.loan?.id || '',
        loanCode: e.loan?.loanCode || '—',
        frequency: e.loan?.frequency || 'daily',
        principal: Number(e.loan?.principal || 0),
      },
      agent: e.agent ? { id: e.agent.id, name: e.agent.name } : null,
    }));

    const todayNewLoanItems = todayNewLoans.map((l: any) => ({
      id: l.id,
      type: 'new_loan' as const,
      loanCode: l.loanCode,
      principal: Number(l.principal),
      frequency: l.frequency,
      tenure: l.tenure,
      createdAt: l.createdAt,
      customer: {
        id: l.customer?.id || '',
        name: l.customer?.name || 'Customer',
        customerCode: l.customer?.customerCode || '—',
        phone: l.customer?.phone || null,
        route: l.customer?.route ? { id: l.customer.route.id, name: l.customer.route.name } : null,
      },
      createdBy: l.createdBy ? { id: l.createdBy.id, name: l.createdBy.name } : null,
    }));

    const todayNewCustomerItems = todayNewCustomers.map((c: any) => ({
      id: c.id,
      type: 'new_customer' as const,
      id_cust: c.id,
      name: c.name,
      customerCode: c.customerCode,
      phone: c.phone || null,
      createdAt: c.createdAt,
      route: c.route ? { id: c.route.id, name: c.route.name } : null,
    }));

    const todayOtherItems = [
      ...todayClosedLoans.map((l: any) => ({
        id: `close-${l.id}`,
        type: 'closed_loan' as const,
        title: `Loan Closed: ${l.loanCode}`,
        description: `Customer: ${l.customer?.name ?? '—'} (${l.customer?.customerCode ?? '—'}) • ${l.closureType || 'Settled'}`,
        timestamp: l.closedAt,
        loanCode: l.loanCode,
        customerCode: l.customer?.customerCode,
      })),
      ...todayApprovals.map((a: any) => ({
        id: `appr-${a.id}`,
        type: 'approval' as const,
        title: `Approval: ${a.requestType.replace('_', ' ')} (${a.entityType})`,
        description: `Status: ${a.status.toUpperCase()} • Requested by: ${a.requestedBy?.name || 'Staff'}${a.reviewedBy ? ` • Reviewed by: ${a.reviewedBy.name}` : ''}`,
        timestamp: a.reviewedAt || a.createdAt,
        status: a.status,
      })),
    ];

    return ok({
      activeLoans,
      overdueLoans,
      totalCustomers,
      todayExpected,
      todayCollected,
      todayScheduledCollected,
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
              customerPhoto: e.customer?.profilePhoto ?? null,
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
      totalDisbursed,
      totalCollectedAllTime,
      bestPayer,
      highestBorrower,
      pendingUpiCollections: pendingUpiCollections.map((e) => ({
        id: e.id,
        amount: Number(e.receivedAmount),
        paymentMode: e.paymentMode,
        submittedAt: e.submittedAt,
        verificationStatus: e.verificationStatus,
        source: e.source,
        customerName: e.customer?.name ?? '—',
        customerCode: e.customer?.customerCode ?? '',
        customerPhoto: e.customer?.profilePhoto ?? null,
        customerId: e.customer?.id ?? '',
        agentName: e.agent?.name ?? '—',
        loanCode: e.loan?.loanCode ?? '',
      })),
      pendingCashCollections: pendingCashCollections.map((e) => ({
        id: e.id,
        amount: Number(e.receivedAmount),
        paymentMode: e.paymentMode,
        submittedAt: e.submittedAt,
        verificationStatus: e.verificationStatus,
        source: e.source,
        customerName: e.customer?.name ?? '—',
        customerCode: e.customer?.customerCode ?? '',
        customerPhoto: e.customer?.profilePhoto ?? null,
        customerId: e.customer?.id ?? '',
        agentName: e.agent?.name ?? '—',
        loanCode: e.loan?.loanCode ?? '',
      })),
      todayByMode,
      todayBreakdown,
      overdueBreakdown,
      todaysActivity: {
        paidItems: todayPaidItems,
        pendingItems: todayPendingDues,
        newLoanItems: todayNewLoanItems,
        newCustomerItems: todayNewCustomerItems,
        otherItems: todayOtherItems,
      },
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Dashboard failed', 500);
  }
}
