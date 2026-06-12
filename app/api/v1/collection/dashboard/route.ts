import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';
import { COLLECTIBLE_LOAN_STATUSES } from '@/lib/collectionPolicy';
import { getSetting } from '@/lib/tenant';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Superadmin/developer oversee the whole tenant (the web shows "All
  // Branches/All Routes"), so they must NOT be pinned to their token's single
  // home branch — that left their collection list empty whenever a loan lived
  // in another branch. Only branch admins stay branch-scoped.
  const seesAllBranches = ctx.role === 'superadmin' || ctx.role === 'developer';
  const branchScope = !seesAllBranches && ctx.branchId ? { branchId: ctx.branchId } : {};

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

    const [todayInstalments, overdueInstalments, agentRoutes] = await Promise.all([
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

    return ok({
      todayInstalments,
      overdueInstalments,
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
