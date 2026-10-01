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

import { settlePenalty, waivePenalty } from '@/lib/penalties';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const { id } = await params;
    const body = await request.json();

    if (body.action !== 'settle' && body.action !== 'waive') {
      return apiError('Invalid action', 400);
    }

    if (body.action === 'settle') {
      const penalty = await prisma.penalty.findFirst({
        where: { id, loan: { tenantId: context.tenantId, appType: context.appType, ...scopedBranchWhere(context) } },
      });
      if (!penalty) return apiError('Penalty not found', 404);
      const gross = Number(penalty.grossPenalty);
      const settled = Number(penalty.settledAmount);
      const waived = Number(penalty.waivedAmount);
      const remaining = gross - settled - waived;
      const amount = body.settledAmount !== undefined ? Number(body.settledAmount) : remaining;

      const updated = await settlePenalty({
        tenantId: context.tenantId,
        appType: context.appType,
        branchId: context.branchId,
        userId: context.userId,
        role: context.role,
        penaltyId: id,
        amount,
        paymentMode: body.paymentMode ? String(body.paymentMode) : 'cash',
        notes: body.notes ? String(body.notes) : null,
      });
      return apiSuccess(updated);
    } else {
      const updated = await waivePenalty({
        tenantId: context.tenantId,
        appType: context.appType,
        branchId: context.branchId,
        userId: context.userId,
        role: context.role,
        penaltyId: id,
        reason: body.notes ? String(body.notes) : null,
      });
      return apiSuccess(updated);
    }
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
