import prisma from '@/lib/db';
import { AUTHENTICATED_API_ROLES, isApiError, requireApiContext, scopedBranchWhere } from '@/lib/apiAuth';
import { getAgentRouteIds } from '@/lib/access';
import { apiCreated, apiError, apiSuccess } from '@/lib/utils';
import {
  allocatePaymentsAcrossInstalments,
  describeAllocationForPayment,
  reallocateLoanRepayments,
} from '@/lib/repayments';

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

    const today = parseDay(null);
    const entry = await prisma.$transaction(async (tx) => {
      let dailyCollection = await tx.dailyCollection.findFirst({
        where: { agentId: context.userId, date: today, tenantId: context.tenantId },
      });
      if (!dailyCollection) {
        dailyCollection = await tx.dailyCollection.create({
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

      const [loanInstalments] = await Promise.all([
        tx.instalment.findMany({
          where: { loanId: instalment.loanId },
          orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
          select: { id: true, instalmentNo: true, dueDate: true, dueAmount: true, receivedAmount: true },
        }),
      ]);

      const allocationRemark = `Direct payment for instalment #${instalment.instalmentNo} (+₹${receivedAmount})`;
      const mergedRemarks = [remarks, allocationRemark].filter(Boolean).join(' | ');

      const created = await tx.collectionEntry.create({
        data: {
          collectionId: dailyCollection.id,
          customerId: instalment.loan.customerId,
          loanId: instalment.loanId,
          dueAmount: Number(instalment.dueAmount),
          receivedAmount,
          paymentMode,
          remarks: mergedRemarks,
          agentId: context.userId,
        },
      });

      // Directly update the instalment receivedAmount
      await tx.instalment.update({
        where: { id: instalment.id },
        data: { 
          receivedAmount: { increment: receivedAmount },
          receivedAt: new Date()
        }
      });

      await reallocateLoanRepayments(tx, instalment.loanId);

      const allEntries = await tx.collectionEntry.findMany({ where: { collectionId: dailyCollection.id } });
      await tx.dailyCollection.update({
        where: { id: dailyCollection.id },
        data: {
          totalCollected: allEntries.reduce((sum, item) => sum + Number(item.receivedAmount), 0),
          totalExpected: allEntries.reduce((sum, item) => sum + Number(item.dueAmount), 0),
          entriesCount: allEntries.length,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'create',
          entityType: 'collection',
          entityId: created.id,
          newValue: JSON.stringify({ instalmentId, receivedAmount, paymentMode, allocation: allocationRemark }),
        },
      });

      return created;
    });

    return apiCreated(entry);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
