import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';
import { COLLECTIBLE_LOAN_STATUSES } from '@/lib/collectionPolicy';
import { getSetting } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    let customerIds: string[];
    let agentRouteIds: string[] = [];

    if (ctx.role === 'agent') {
      agentRouteIds = await getAgentRouteIds(ctx.userId);
      const customers = await prisma.customer.findMany({
        where: { tenantId: ctx.tenantId, appType: ctx.appType, routeId: { in: agentRouteIds } },
        select: { id: true },
      });
      customerIds = customers.map((customer) => customer.id);
    } else {
      const customers = await prisma.customer.findMany({
        where: {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
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
      ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
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
          status: { in: ['upcoming', 'missed', 'partial'] },
        },
        include: includeLoan,
        orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
      }),
      prisma.route.findMany({
        where: {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          status: 'active',
          ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
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
