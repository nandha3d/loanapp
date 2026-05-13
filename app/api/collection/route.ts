import prisma from '@/lib/db';
import { AUTHENTICATED_API_ROLES, isApiError, requireApiContext, scopedBranchWhere } from '@/lib/apiAuth';
import { getAgentRouteIds } from '@/lib/access';
import { apiCreated, apiError, apiSuccess } from '@/lib/utils';

function parseDay(value: string | null) {
  const day = value ? new Date(value) : new Date();
  day.setHours(0, 0, 0, 0);
  return day;
}

export async function GET(request: Request) {
  try {
    const authResult = await requireApiContext(AUTHENTICATED_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const { searchParams } = new URL(request.url);

    const date = parseDay(searchParams.get('date'));
    const agentId = searchParams.get('agentId');
    const routeId = searchParams.get('routeId');

    const where: any = {
      tenantId: context.tenantId,
      appType: context.appType,
      date,
      ...scopedBranchWhere(context),
    };
    if (agentId) where.agentId = agentId;
    if (routeId) where.routeId = routeId;

    if (context.role === 'agent') {
      where.agentId = context.userId;
      const routeIds = await getAgentRouteIds(context.userId);
      if (routeIds.length === 0) return apiSuccess([]);
      if (routeId && !routeIds.includes(routeId)) return apiError('Forbidden', 403);
      if (!routeId) where.routeId = { in: routeIds };
    }

    const collections = await prisma.dailyCollection.findMany({
      where,
      include: {
        agent: { select: { id: true, name: true, phone: true } },
        route: true,
        entries: {
          include: {
            customer: { select: { id: true, customerCode: true, name: true, phone: true } },
            loan: { select: { id: true, loanCode: true } },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return apiSuccess(collections);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireApiContext(AUTHENTICATED_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const body = await request.json();

    const instalmentId = String(body.instalmentId || '');
    const receivedAmount = Number(body.receivedAmount);
    const paymentMode = String(body.paymentMode || 'cash');
    const remarks = body.remarks ? String(body.remarks) : null;
    if (!instalmentId || !receivedAmount || receivedAmount <= 0) return apiError('Invalid amount', 400);

    const instalment = await prisma.instalment.findUnique({
      where: { id: instalmentId },
      include: { loan: { include: { customer: true } } },
    });
    if (!instalment || instalment.loan.tenantId !== context.tenantId || instalment.loan.appType !== context.appType) {
      return apiError('Instalment not found', 404);
    }
    if (context.role === 'admin' && context.branchId && instalment.loan.branchId !== context.branchId) {
      return apiError('Forbidden', 403);
    }
    if (context.role === 'agent') {
      const customerRouteId = instalment.loan.customer.routeId;
      const routeIds = await getAgentRouteIds(context.userId);
      if (!customerRouteId || !routeIds.includes(customerRouteId)) return apiError('Forbidden', 403);
    }
    if (instalment.status === 'paid') return apiError('Already paid', 409);

    const dueAmount = Number(instalment.dueAmount);
    const newStatus = receivedAmount >= dueAmount ? 'paid' : 'partial';
    const today = parseDay(null);

    let dailyCollection = await prisma.dailyCollection.findFirst({
      where: { agentId: context.userId, date: today, tenantId: context.tenantId, appType: context.appType },
    });
    if (!dailyCollection) {
      dailyCollection = await prisma.dailyCollection.create({
        data: {
          tenantId: context.tenantId,
          branchId: instalment.loan.branchId,
          agentId: context.userId,
          routeId: instalment.loan.customer.routeId,
          date: today,
          totalExpected: 0,
          totalCollected: 0,
          entriesCount: 0,
          appType: context.appType,
          status: 'open',
        },
      });
    }

    const entry = await prisma.collectionEntry.create({
      data: {
        collectionId: dailyCollection.id,
        customerId: instalment.loan.customerId,
        loanId: instalment.loanId,
        dueAmount,
        receivedAmount,
        paymentMode,
        remarks,
        agentId: context.userId,
      },
    });

    await prisma.instalment.update({
      where: { id: instalmentId },
      data: {
        receivedAmount,
        paymentMode,
        remarks,
        status: newStatus,
        receivedAt: new Date(),
        agentId: context.userId,
        collectionEntryId: entry.id,
      },
    });

    const allInstalments = await prisma.instalment.findMany({ where: { loanId: instalment.loanId } });
    const paidCount = allInstalments.filter((item) => item.id === instalmentId ? newStatus === 'paid' : item.status === 'paid').length;
    const totalCollected = allInstalments.reduce((sum, item) => {
      if (item.id === instalmentId) return sum + receivedAmount;
      return sum + Number(item.receivedAmount);
    }, 0);

    await prisma.loan.update({
      where: { id: instalment.loanId },
      data: {
        paidCount,
        totalCollected,
        ...(paidCount === allInstalments.length ? { status: 'closed', closedAt: new Date() } : {}),
      },
    });

    const allEntries = await prisma.collectionEntry.findMany({ where: { collectionId: dailyCollection.id } });
    await prisma.dailyCollection.update({
      where: { id: dailyCollection.id },
      data: {
        totalCollected: allEntries.reduce((sum, item) => sum + Number(item.receivedAmount), 0),
        totalExpected: allEntries.reduce((sum, item) => sum + Number(item.dueAmount), 0),
        entriesCount: allEntries.length,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'create',
        entityType: 'collection',
        entityId: entry.id,
        newValue: JSON.stringify({ instalmentId, receivedAmount, paymentMode }),
      },
    });

    return apiCreated(entry);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
