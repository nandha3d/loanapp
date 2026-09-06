import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';
import { COLLECTIBLE_LOAN_STATUSES, isCollectionDay } from '@/lib/collectionPolicy';
import { getSetting } from '@/lib/tenant';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';
import { startOfBusinessToday, startOfBusinessTomorrow } from '@/lib/businessTime';
import { summarizeCollectionWorklist } from '@/lib/collectionSummary';
import { getDistributedInstalmentsAndMetrics } from '@/lib/repayments';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  // Day window in the business timezone (IST), not the server's UTC midnight,
  // so "today" matches the operator's calendar.
  const today = startOfBusinessToday();
  const tomorrow = startOfBusinessTomorrow();

  // AGENTS ONLY are branch-unpinned, per SCOPE-5: they are already scoped to
  // their own customers via buildAgentCustomerAccessWhere (agentId / route
  // assignment), so an extra branch filter only causes false exclusions — a
  // customer's loan can live in a different branch than the agent's own.
  //
  // Superadmin/developer used to be unpinned here too, on the reasoning that
  // they "oversee the whole tenant" and must not be stuck on their token's
  // single HOME branch. That reasoning is stale: ctx.branchId is the ACTIVE
  // branch, resolved by resolveScopeBranchId — null when "All Branches" is
  // selected, the chosen branch otherwise. Unpinning them made the branch
  // switcher inert on Collection Entry, so selecting Erode listed Head Office's
  // customers and their dues. See SCOPE-15: branch scoping has no role
  // exemption; "sees everything" is expressed by SELECTING All Branches.
  const branchUnpinned = ctx.role === 'agent';
  const branchScope = !branchUnpinned && ctx.branchId ? { branchId: ctx.branchId } : {};

  try {
    let customerIds: string[];
    let agentRouteIds: string[] = [];

    if (ctx.role === 'agent') {
      agentRouteIds = await getAgentRouteIds(ctx.userId);
      const customers = await prisma.customer.findMany({
        where: {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          ...buildAgentCustomerAccessWhere({ userId: ctx.userId }),
        },
        select: { id: true },
      });
      customerIds = customers.map((customer) => customer.id);
    } else {
      const customers = await prisma.customer.findMany({
        where: {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          ...branchScope,
        },
        select: { id: true },
      });
      customerIds = customers.map((customer) => customer.id);
    }

    const baseLoanWhere = {
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      customerId: { in: customerIds },
      status: { in: [...COLLECTIBLE_LOAN_STATUSES] },
      ...branchScope,
    };

    const includeLoan = {
      loan: {
        include: {
          customer: { include: { route: true, collectionPoints: true } },
        },
      },
      collectionEntry: {
        select: { id: true },
      },
    };

    const [
      todayDueInstalments,
      overdueInstalments,
      paidTodayInstalments,
      agentRoutes,
      paymentsToday,
    ] = await Promise.all([
      prisma.instalment.findMany({
        where: {
          loan: baseLoanWhere,
          dueDate: { gte: today, lt: tomorrow },
        },
        include: includeLoan,
        orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
      }),
      prisma.instalment.findMany({
        where: {
          loan: baseLoanWhere,
          dueDate: { lt: today },
          // Any past-due instalment that isn't fully settled. A status
          // whitelist used to omit 'pending' rows (the default before the
          // missed-marking cron runs), so overdue dues silently disappeared.
          NOT: { status: 'paid' },
        },
        include: includeLoan,
        orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
      }),
      // Past-due instalments that were CLEARED today. Without this, a customer
      // whose overdue was fully settled today vanishes from the agent's list
      // (it's no longer "due" and no longer "overdue"). Keep them visible —
      // grayed-out — so the day's work is auditable at a glance.
      prisma.instalment.findMany({
        where: {
          loan: baseLoanWhere,
          dueDate: { lt: today },
          receivedAt: { gte: today, lt: tomorrow },
        },
        include: includeLoan,
        orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
      }),
      prisma.route.findMany({
        where: {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          status: 'active',
          ...branchScope,
          ...(ctx.role === 'agent' && agentRouteIds.length > 0
            ? { id: { in: agentRouteIds } }
            : ctx.role !== 'agent' ? {} : { id: { in: [] } }),
        },
        orderBy: { name: 'asc' },
      }),
      prisma.payment.findMany({
        where: {
          tenantId: ctx.tenantId,
          paymentDate: { gte: today, lt: tomorrow },
          loan: baseLoanWhere,
        },
        select: { loanId: true, amount: true },
      }),
    ]);

    const dailyCollectionRaw = await prisma.dailyCollection.findFirst({
      where: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        agentId: ctx.userId,
        date: today,
      },
      select: { id: true, status: true, totalCollected: true },
    });

    const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId: ctx.tenantId } });
    const isReceiptPdfAllowed = sub?.receiptPdfAllowed || false;
    const isReceiptPdfActive = await getSetting(ctx.tenantId, 'receipt_pdf_active', 'false') === 'true';
    const receiptPdfEnabled = isReceiptPdfAllowed && isReceiptPdfActive;
    const gpsTrackingEnabled = sub?.gpsTrackingEnabled || false;

    // Frequency-aware worklist: a non-daily loan's overdue backlog only surfaces
    // on its cadence day (weekly → its weekday, monthly → its day-of-month), so
    // the agent isn't told to chase weekly/monthly customers every single day.
    // Daily loans are unaffected. Today's dues and today's collections always show.
    const overdueVisible = overdueInstalments.filter((i) =>
      isCollectionDay(i.loan.frequency, i.dueDate, today),
    );

    // Merge today's dues with past-due-cleared-today. Dedupe by id (a partial
    // paid today can appear in both the overdue and paid-today queries; the
    // client also de-dupes, but keep the payload clean).
    const seen = new Set(todayDueInstalments.map((i) => i.id));
    const todayInstalments = [
      ...todayDueInstalments,
      ...paidTodayInstalments.filter((i) => !seen.has(i.id)),
    ];

    // Compute distributed instalments and metrics
    const allLoanIds = Array.from(new Set([
      ...todayInstalments.map((i) => i.loanId),
      ...overdueVisible.map((i) => i.loanId),
    ]));

    const allInstalmentsForLoans = await prisma.instalment.findMany({
      where: { loanId: { in: allLoanIds } },
      orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
    });

    const { distributedInstalments, metricsByLoan } = getDistributedInstalmentsAndMetrics(
      allInstalmentsForLoans,
      today,
      paymentsToday,
    );

    const distributedMap = new Map(distributedInstalments.map((i) => [i.id, i]));

    const mappedToday = todayInstalments.map((i) => {
      const dist = distributedMap.get(i.id);
      if (dist) {
        return {
          ...i,
          receivedAmount: dist.receivedAmount,
          outstandingAmount: dist.outstandingAmount,
          overdueAmount: dist.overdueAmount,
          status: dist.status,
        };
      }
      return i;
    });

    const mappedOverdue = overdueVisible.map((i) => {
      const dist = distributedMap.get(i.id);
      if (dist) {
        return {
          ...i,
          receivedAmount: dist.receivedAmount,
          outstandingAmount: dist.outstandingAmount,
          overdueAmount: dist.overdueAmount,
          status: dist.status,
        };
      }
      return i;
    });

    const todayExpected = mappedToday.reduce((sum, row) => sum + Number(row.dueAmount), 0);
    const todayCollected = mappedToday.reduce(
      (sum, row) => sum + Math.min(Number(row.receivedAmount), Number(row.dueAmount)),
      0,
    );
    const todayOutstanding = mappedToday.reduce(
      (sum, row) => sum + Math.max(0, Number(row.dueAmount) - Number(row.receivedAmount)),
      0,
    );
    const todayPendingCount = mappedToday.filter(
      (row) => Math.max(0, Number(row.dueAmount) - Number(row.receivedAmount)) > 0
    ).length;
    const todayPaidCount = mappedToday.filter(
      (row) => Math.max(0, Number(row.dueAmount) - Number(row.receivedAmount)) <= 0 && Number(row.receivedAmount) > 0
    ).length;

    // Overdue Outstanding comes from the visible overdue rows in distributed view
    const overdueOutstanding = mappedOverdue.reduce(
      (sum, row) => sum + Math.max(0, Number(row.dueAmount) - Number(row.receivedAmount)),
      0,
    );
    const overdueCollectedToday = Array.from(metricsByLoan.values()).reduce(
      (sum, m) => sum + m.overdueCollectedToday,
      0,
    );
    const overduePendingCount = mappedOverdue.filter(
      (row) => Math.max(0, Number(row.dueAmount) - Number(row.receivedAmount)) > 0
    ).length;

    const collectionSummary = {
      todayExpected,
      todayCollected,
      todayOutstanding,
      todayPendingCount,
      todayPaidCount,
      overdueTotalTillToday: overdueOutstanding + overdueCollectedToday,
      overdueCollectedToday,
      overdueOutstanding,
      overduePendingCount,
    };

    return ok({
      todayInstalments: mappedToday,
      overdueInstalments: mappedOverdue,
      collectionSummary,
      routes: agentRoutes,
      dailyCollection: dailyCollectionRaw ? {
        id: dailyCollectionRaw.id,
        status: dailyCollectionRaw.status,
        totalCollected: Number(dailyCollectionRaw.totalCollected),
      } : null,
      receiptPdfEnabled,
      gpsTrackingEnabled,
    });
  } catch (e: any) {
    console.error('[/api/v1/collection/dashboard GET]', e);
    return fail(e?.message ?? 'Collection dashboard failed', 500);
  }
}
