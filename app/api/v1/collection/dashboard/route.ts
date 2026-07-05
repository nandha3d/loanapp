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

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  // Day window in the business timezone (IST), not the server's UTC midnight,
  // so "today" matches the operator's calendar.
  const today = startOfBusinessToday();
  const tomorrow = startOfBusinessTomorrow();

  // Superadmin/developer oversee the whole tenant (the web shows "All
  // Branches/All Routes"), so they must NOT be pinned to their token's single
  // home branch — that left their collection list empty whenever a loan lived
  // in another branch. Agents are ALSO not branch-pinned: they're already scoped
  // to their own customers via buildAgentCustomerAccessWhere (agentId / route
  // assignment), so an extra branch filter only causes false exclusions —
  // notably for loans created with branchId = null, or a customer's loan that
  // lives in a different branch than the agent's home branch. Only branch admins
  // stay branch-scoped.
  const branchUnpinned =
    ctx.role === 'superadmin' || ctx.role === 'developer' || ctx.role === 'agent';
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
      overduePaidTodayAllocations,
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
      prisma.paymentAllocation.findMany({
        where: {
          payment: {
            tenantId: ctx.tenantId,
            paymentDate: { gte: today, lt: tomorrow },
            loan: baseLoanWhere,
          },
          instalment: { dueDate: { lt: today } },
        },
        select: { amount: true },
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
    const collectionSummary = summarizeCollectionWorklist({
      todayRows: todayDueInstalments,
      overdueRows: overdueVisible,
      overdueCollectedToday: overduePaidTodayAllocations.reduce(
        (sum, row) => sum + Number(row.amount),
        0,
      ),
    });

    return ok({
      todayInstalments,
      overdueInstalments: overdueVisible,
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
