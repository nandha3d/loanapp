import prisma from '@/lib/db';
import { ADMIN_API_ROLES, isApiError, requireApiContext, scopedBranchReachWhere } from '@/lib/apiAuth';
import { apiError, apiSuccess } from '@/lib/utils';

async function findScopedLoan(id: string, context: any) {
  return prisma.loan.findFirst({
    where: { id, tenantId: context.tenantId, appType: context.appType, ...scopedBranchReachWhere(context, 'createdBy') },
    include: {
      customer: true,
      instalments: { orderBy: { instalmentNo: 'asc' } },
      penalties: { orderBy: { createdAt: 'desc' } },
      collaterals: true,
      guarantor: true,
      vehicle: true,
    },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const { id } = await params;

    const loan = await findScopedLoan(id, context);
    if (!loan) return apiError('Loan not found', 404);
    return apiSuccess(loan);
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

    const existing = await findScopedLoan(id, context);
    if (!existing) return apiError('Loan not found', 404);

    const body = await request.json();
    const data: any = {};
    if (body.status !== undefined) data.status = String(body.status);
    if (body.voucherRef !== undefined) data.voucherRef = body.voucherRef ? String(body.voucherRef) : null;

    const updated = await prisma.loan.update({ where: { id }, data });
    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'update',
        entityType: 'loan',
        entityId: id,
        oldValue: JSON.stringify(existing),
        newValue: JSON.stringify(data),
      },
    });

    return apiSuccess(updated);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const { id } = await params;
    const existing = await findScopedLoan(id, context);
    if (!existing) return apiError('Loan not found', 404);
    if (existing.status !== 'pending') return apiError('Only pending loans can be deleted', 409);

    await prisma.loan.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'delete',
        entityType: 'loan',
        entityId: id,
        oldValue: JSON.stringify(existing),
      },
    });

    return apiSuccess({ deleted: true });
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
