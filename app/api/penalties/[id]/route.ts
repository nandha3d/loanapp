import prisma from '@/lib/db';
import { ADMIN_API_ROLES, isApiError, requireApiContext, scopedBranchWhere } from '@/lib/apiAuth';
import { apiError, apiSuccess } from '@/lib/utils';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const { id } = await params;

    const penalty = await prisma.penalty.findFirst({
      where: { id, loan: { tenantId: context.tenantId, appType: context.appType, ...scopedBranchWhere(context) } },
      include: {
        loan: {
          select: {
            id: true,
            loanCode: true,
            customer: { select: { id: true, customerCode: true, name: true } },
          },
        },
      },
    });
    if (!penalty) return apiError('Penalty not found', 404);
    return apiSuccess(penalty);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const { id } = await params;
    const body = await request.json();

    const penalty = await prisma.penalty.findFirst({
      where: { id, loan: { tenantId: context.tenantId, appType: context.appType, ...scopedBranchWhere(context) } },
    });
    if (!penalty) return apiError('Penalty not found', 404);

    if (body.action !== 'settle' && body.action !== 'waive') {
      return apiError('Invalid action', 400);
    }

    const settledAt = new Date();
    const data = body.action === 'settle'
      ? {
          status: 'settled',
          settledAmount: Number(body.settledAmount ?? penalty.grossPenalty),
          settledById: context.userId,
          settledAt,
        }
      : {
          status: 'waived',
          settledAmount: 0,
          waivedAmount: Number(penalty.grossPenalty),
          settledById: context.userId,
          settledAt,
        };

    const updated = await prisma.penalty.update({ where: { id }, data });
    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        userId: context.userId,
        action: body.action,
        entityType: 'penalty',
        entityId: id,
        oldValue: JSON.stringify(penalty),
        newValue: JSON.stringify(data),
      },
    });

    return apiSuccess(updated);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
