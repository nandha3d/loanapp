import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';
import { getDistributedInstalmentsAndMetrics } from '@/lib/repayments';
import { LOAN_PRECLOSE_REQUEST } from '@/lib/loanPreclosePolicy';
import { precloseApprovalVisibility } from '@/lib/loanPrecloseRequests';
import type { Prisma } from '@prisma/client';
import { startOfBusinessToday, startOfBusinessTomorrow, startOfBusinessDayUtc } from '@/lib/businessTime';
import { getDueMetricsForRange, startOfBusinessMonth } from '@/lib/dashboard/todayMetrics';
import { getDashboardBookTotals } from '@/lib/dashboard/bookTotals';
import { ensurePendingPenaltiesForMissedLoans } from '@/lib/penalties';
import { buildOverdueAgeing, parseAgeingEdges, topOverdueCustomers, DEFAULT_AGEING_BUCKETS } from '@/lib/dashboard/overdueInsights';
import { COLLECTIBLE_LOAN_STATUSES } from '@/lib/collectionPolicy';
import { getSetting } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const today = startOfBusinessToday();
  const tomorrow = startOfBusinessTomorrow();

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
    // MONEY-14: the pending-penalty accrual still runs on every dashboard load.
    // It writes only Penalty rows, so only the penalty aggregate waits for it;
    // every other read below runs alongside instead of queueing behind it.
    const penaltySweep = isAgent
      ? Promise.resolve()
      : ensurePendingPenaltiesForMissedLoans({
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          branchId: ctx.branchId || undefined,
        });
    // Preclose approvals are scoped by the loan's branch (SCOPE-18). Shared by
    // today's approval feed and the pending-approvals count.
    const precloseVisibility: Promise<Prisma.ApprovalRequestWhereInput | null> = !isAgent && ctx.branchId && ctx.appType === 'microlending'
      ? precloseApprovalVisibility(ctx.tenantId, ctx.appType, ctx.branchId)
      : Promise.resolve(null);

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
    } else if (ctx.branchId && ctx.appType !== 'microlending') {
      approvalWhere.requestedBy = { branchId: ctx.branchId };
    }
    const withPrecloseScope = (
      where: Prisma.ApprovalRequestWhereInput,
      visibility: Prisma.ApprovalRequestWhereInput | null,
    ): Prisma.ApprovalRequestWhereInput => visibility
      ? { ...where, AND: [{ OR: [
          { requestType: { not: LOAN_PRECLOSE_REQUEST }, requestedBy: { branchId: ctx.branchId } },
          visibility,
        ] }] }
      : where;

    const routeWhere = { tenantId: ctx.tenantId, appType: ctx.appType, status: 'active', ...scopedBranchWhere(ctx) };
    const bizTodayUtc = startOfBusinessDayUtc();
    const cashFlowMonths = Array.from({ length: 6 }, (_, i) => {
      const offset = 5 - i;
      const start = new Date(Date.UTC(bizTodayUtc.getUTCFullYear(), bizTodayUtc.getUTCMonth() - offset, 1));
      const end = new Date(Date.UTC(bizTodayUtc.getUTCFullYear(), bizTodayUtc.getUTCMonth() - offset + 1, 1));
      return { start, end, label: start.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }) };
    });

    // Every independent read in one round trip wave — the route used to run
    // these in five sequential waves.
    const [
      activeLoans,
      overdueLoans,
      totalCustomers,
      todayInstalments,
      pendingPenaltiesAgg,
      activeAgents,
      recentLoans,
      allInstalmentsForMetrics,
      overdueDefaulterRows,
      paymentsToday,
      routes,
      routeOverdueRows,
      recentActivity,
      cashCollectedAgg,
      todayActivityRows,
      totalLoansAgg,
      topRepayer,
      topBorrower,
      pendingUpiCollections,
      pendingCashCollections,
      collectionsByMode,
      todayNewLoans,
      todayNewCustomers,
      todayClosedLoans,
      todayApprovals,
      staffBookTotals,
      pendingApprovals,
      ageingSetting,
      collectibleLoanCount,
      cashFlowGroups,
      upiManualVerifySetting,
    ] = await Promise.all([
      prisma.loan.count({ where: { ...baseLoan, status: 'active' } }),
      prisma.loan.count({ where: { ...baseLoan, status: 'overdue' } }),
      prisma.customer.count({ where: { ...baseCustomer, status: 'active' } }),
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
      isAgent
        ? Promise.resolve({ _sum: { grossPenalty: 0, settledAmount: 0, waivedAmount: 0 }, _count: 0 })
        : penaltySweep.then(() => prisma.penalty.aggregate({
            where: { loan: { ...baseLoan, status: { in: ['active', 'overdue'] } }, status: { in: ['pending', 'partial'] } },
            _sum: { grossPenalty: true, settledAmount: true, waivedAmount: true },
            _count: true,
          })),
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
      // Full schedules of every loan with an instalment due today or an
      // overdue / part-paid one — the input to repayment distribution. One
      // query: this used to fetch those instalment rows only to collect their
      // loan ids, then fetch the schedules by id in a second round trip.
      prisma.instalment.findMany({
        where: {
          loan: {
            ...baseLoan,
            status: { in: ['active', 'overdue'] },
            instalments: {
              some: {
                OR: [
                  { dueDate: { gte: today, lt: tomorrow } },
                  {
                    status: { not: 'waived' },
                    OR: [
                      { dueDate: { lt: today } },
                      { receivedAmount: { gt: 0 } },
                    ],
                  },
                ],
              },
            },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
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
        where: routeWhere,
        select: {
          id: true,
          name: true,
          routeAgents: { select: { agentId: true, agent: { select: { name: true } } } },
          _count: { select: { customers: true } },
        },
      }),
      // Route performance overdue: the past-due unpaid instalments of active /
      // overdue loans of every customer on those routes, as flat rows. Replaces
      // a nested routes → customers → loans → instalments include that loaded
      // every customer and loan on every route.
      prisma.instalment.findMany({
        where: {
          dueDate: { lt: today },
          status: { in: ['upcoming', 'missed', 'partial'] },
          loan: { status: { in: ['active', 'overdue'] }, customer: { route: routeWhere } },
        },
        select: { dueAmount: true, receivedAmount: true, loan: { select: { customer: { select: { routeId: true } } } } },
      }),
      prisma.auditLog.findMany({
        where: { tenantId: ctx.tenantId, user: { role: { not: 'developer' }, ...scopedBranchWhere(ctx) } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { user: { select: { name: true } } },
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
              preferredCollectionTime: true,
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
      // Web dashboard parity additions
      isAgent ? prisma.loan.aggregate({
        where: { ...baseLoan, status: { in: ['active', 'overdue', 'closed', 'settled'] } },
        _sum: { principal: true, disbursed: true, totalCollected: true },
      }) : Promise.resolve(null),
      prisma.collectionEntry.groupBy({
        by: ['customerId'],
        where: { tenantId: ctx.tenantId, loan: baseLoan },
        _sum: { receivedAmount: true },
        orderBy: { _sum: { receivedAmount: 'desc' } },
        take: 1,
      }),
      // DASH-07: highest borrower = max Σ principal of active+overdue loans per customer (same as web).
      prisma.loan.groupBy({
        by: ['customerId'],
        where: { ...baseLoan, status: { in: ['active', 'overdue'] } },
        _sum: { principal: true },
        orderBy: { _sum: { principal: 'desc' } },
        take: 1,
      }),
      prisma.collectionEntry.findMany({
        where: {
          tenantId: ctx.tenantId,
          paymentMode: { in: ['upi', 'online'] },
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
        take: 20,
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
        take: 20,
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
        take: 10,
      }),
      // Approvals processed today
      precloseVisibility.then((visibility) => prisma.approvalRequest.findMany({
        where: withPrecloseScope(approvalWhere, visibility),
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
        take: 10,
      })),
      isAgent ? Promise.resolve(null) : getDashboardBookTotals(ctx.tenantId, ctx.appType, ctx.branchId),
      // Things waiting for admin attention — matches the /approvals page and the web KPI.
      isAgent
        ? Promise.resolve(0)
        : Promise.all([
            precloseVisibility.then((visibility) => prisma.approvalRequest.count({
              where: withPrecloseScope({
                tenantId: ctx.tenantId,
                appType: ctx.appType,
                status: 'pending',
                ...(ctx.branchId && ctx.appType !== 'microlending' ? { requestedBy: { branchId: ctx.branchId } } : {}),
              }, visibility),
            })),
            prisma.loan.count({ where: { ...baseLoan, status: 'pending_review' } }),
            prisma.customer.count({ where: { ...baseCustomer, status: 'pending_review' } }),
          ]).then(([a, l, c]) => a + l + c),
      getSetting(ctx.tenantId, 'report_aging_buckets', DEFAULT_AGEING_BUCKETS),
      prisma.loan.count({ where: { ...baseLoan, status: { in: [...COLLECTIBLE_LOAN_STATUSES] } } }),
      Promise.all(
        cashFlowMonths.map((m) =>
          prisma.accountEntry.groupBy({
            by: ['type'],
            where: {
              tenantId: ctx.tenantId,
              appType: ctx.appType,
              ...scopedBranchWhere(ctx),
              type: { in: ['loan_disburse', 'collection'] },
              entryDate: { gte: m.start, lt: m.end },
            },
            _sum: { amount: true },
          }),
        ),
      ),
      getSetting(ctx.tenantId, 'upi_manual_verification', 'false'),
    ]);

    const totalDisbursed = staffBookTotals?.totalDisbursed ?? Number(totalLoansAgg?._sum.disbursed ?? 0);
    const totalCollectedAllTime = staffBookTotals?.totalCollectedAllTime ?? Number(totalLoansAgg?._sum.totalCollected ?? 0);

    const todayByMode: Record<string, number> = {};
    for (const c of collectionsByMode) {
      todayByMode[c.paymentMode] = Number(c._sum.receivedAmount ?? 0);
    }

    const pendingPenaltyGross = Number(pendingPenaltiesAgg._sum?.grossPenalty || 0);
    const pendingPenaltySettled = Number(pendingPenaltiesAgg._sum?.settledAmount || 0);
    const pendingPenaltyWaived = Number(pendingPenaltiesAgg._sum?.waivedAmount || 0);
    const pendingPenaltyTotal = isAgent
      ? 0
      : Math.max(0, pendingPenaltyGross - pendingPenaltySettled - pendingPenaltyWaived);
    const pendingPenalties = isAgent ? 0 : (pendingPenaltiesAgg._count ?? 0);

    const { distributedInstalments, metricsByLoan } = getDistributedInstalmentsAndMetrics(
      allInstalmentsForMetrics as any,
      today,
      paymentsToday,
    );
    const distributedById = new Map(distributedInstalments.map((item) => [item.id, item]));
    const mappedTodayInstalments = todayInstalments.map((item) => {
      const distributed = distributedById.get(item.id);
      return distributed
        ? {
            ...item,
            receivedAmount: distributed.receivedAmount,
            outstandingAmount: distributed.outstandingAmount,
            overdueAmount: distributed.overdueAmount,
            status: distributed.status,
          }
        : item;
    });
    const todayDue = getDueMetricsForRange(mappedTodayInstalments, today, tomorrow);
    // DEC-05: month-to-date with the same rows and maths as today's figures.
    const mtd = getDueMetricsForRange(distributedInstalments as any, startOfBusinessMonth(today), tomorrow);
    const monthToDate = { expected: mtd.expected, collected: mtd.collected, pct: mtd.pct };
    const todayExpected = todayDue.expected;
    const todayScheduledCollected = todayDue.collected;
    // Actual cash taken today across all instalments (see query note above).
    const cashCollectedToday = Number(cashCollectedAgg._sum.receivedAmount ?? 0);
    const todayCollected = todayDue.collected;
    const todayProgressCollected = todayCollected;
    const todayGap = todayDue.remaining;
    const hitRate = todayDue.pct;
    const todayPending = todayGap;

    const outstanding = (item: any) => Math.max(0, Number(item.dueAmount) - Number(item.receivedAmount || 0));

    let overdueOutstanding = 0;
    let overdueCollectedToday = 0;
    for (const m of metricsByLoan.values()) {
      overdueOutstanding += m.overdueOutstanding;
      overdueCollectedToday += m.overdueCollectedToday;
    }
    const overdueTotalTillToday = overdueOutstanding + overdueCollectedToday;

    const overdueForTotals = distributedInstalments.filter(
      (item: any) => item.overdueAmount > 0,
    );
    // DASH-06: same definitions as web dashboard/page.tsx.
    const overdueCustomerCount = new Set(overdueForTotals.map((item: any) => item.loan?.customerId)).size;
    const pendingFieldFloat = [...pendingUpiCollections, ...pendingCashCollections].reduce(
      (sum: number, e: any) => sum + Number(e.receivedAmount || 0),
      0,
    );

    // ── Dashboard charts (DASH-05 parity with web page.tsx) ───────────────
    let overdueAgeing: any[] = [];
    let topOverdueCustomersView: any[] = [];
    let portfolioHealth = { withOverdue: 0, onTrack: 0 };
    let cashFlow: any[] = [];

    const overdueRows = overdueForTotals.map((item: any) => ({
      dueDate: item.dueDate,
      overdueAmount: Number(item.overdueAmount),
      customerId: item.loan?.customerId ?? '',
    }));
    const topOverdue = topOverdueCustomers(overdueRows, 6);

    // Second (last) wave: names for the ids the first wave produced.
    const customerName = (customerId: string | null | undefined) => customerId
      ? prisma.customer.findFirst({ where: { id: customerId, tenantId: ctx.tenantId }, select: { name: true } })
      : Promise.resolve(null);
    const [bestPayerRow, highestBorrowerRow, topOverdueCustomerRows] = await Promise.all([
      customerName(topRepayer[0]?.customerId),
      customerName(topBorrower[0]?.customerId),
      topOverdue.length > 0
        ? prisma.customer.findMany({
            where: { tenantId: ctx.tenantId, appType: ctx.appType, id: { in: topOverdue.map((c) => c.customerId) } },
            select: { id: true, name: true, customerCode: true, route: { select: { name: true } } },
          })
        : Promise.resolve([]),
    ]);
    const bestPayer = bestPayerRow?.name ?? '—';
    const highestBorrower = highestBorrowerRow?.name ?? '—';
    const upiManualVerification = upiManualVerifySetting === 'true';

    overdueAgeing = buildOverdueAgeing(overdueRows, parseAgeingEdges(ageingSetting));
    const topCustomerById = new Map(topOverdueCustomerRows.map((c) => [c.id, c]));
    topOverdueCustomersView = topOverdue
      .filter((c) => topCustomerById.has(c.customerId))
      .map((c) => {
        const customer = topCustomerById.get(c.customerId)!;
        return { ...c, name: customer.name, customerCode: customer.customerCode, routeName: customer.route?.name ?? null };
      });
    const loansWithOverdue = new Set(
      overdueForTotals
        .filter((item: any) => (COLLECTIBLE_LOAN_STATUSES as readonly string[]).includes(item.loan?.status))
        .map((item: any) => item.loanId),
    ).size;
    portfolioHealth = {
      withOverdue: loansWithOverdue,
      onTrack: Math.max(0, collectibleLoanCount - loansWithOverdue),
    };
    cashFlow = cashFlowMonths.map((m, i) => {
      const sumOf = (type: string) => Number(cashFlowGroups[i].find((g) => g.type === type)?._sum.amount ?? 0);
      return { label: m.label, disbursed: sumOf('loan_disburse'), collected: sumOf('collection') };
    });

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

    for (const item of mappedTodayInstalments) {
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
    for (const item of allInstalmentsForMetrics as any[]) {
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
      }
      if (m.overdueOutstanding > 0 && custId) {
        overdueLoansByStatus[statusKey].customers.add(custId);
        allOverdueCustomers.add(custId);
        overdueFreqCustomers[freq].total.add(custId);
        overdueFreqCustomers[freq][statusKey].add(custId);
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

    const overdueByRoute = new Map<string, number>();
    for (const item of routeOverdueRows) {
      const routeId = item.loan.customer.routeId;
      if (routeId) overdueByRoute.set(routeId, (overdueByRoute.get(routeId) ?? 0) + outstanding(item));
    }
    const routePerformance = routes.map((route) => {
      const routeOverdue = overdueByRoute.get(route.id) ?? 0;
      return {
        id: route.id,
        name: route.name,
        agentId: route.routeAgents?.[0]?.agentId ?? null,
        agent: route.routeAgents?.map((ra: any) => ra.agent?.name).join(', ') || '-',
        customers: route._count.customers,
        overdue: routeOverdue,
      };
    });

    // DASH-10: cash collected today per route (web dashboard routeCollections).
    const routeCollections = routes.map((route) => ({
      routeId: route.id,
      collected: todayActivityRows
        .filter((e: any) => e.customer?.route?.id === route.id)
        .reduce((sum: number, e: any) => sum + Number(e.receivedAmount), 0),
    }));

    const todayPendingDues = mappedTodayInstalments
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
        preferredCollectionTime: e.customer?.preferredCollectionTime ?? null,
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
      pendingPenaltyTotal,
      overdueCustomerCount,
      pendingApprovals,
      pendingFieldFloat,
      // DASH-08: the pending UPI panel shows only when the tenant opted into manual review.
      upiManualVerification,
      activeAgents,
      recentLoans,
      todayInstalments: mappedTodayInstalments,
      defaulterAlerts,
      routePerformance,
      routeCollections,
      monthToDate,
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
      currentCapital: staffBookTotals?.currentCapital ?? null,
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
      overdueAgeing,
      topOverdueCustomers: topOverdueCustomersView,
      portfolioHealth,
      cashFlow,
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
