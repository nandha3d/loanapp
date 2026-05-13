import prisma from '@/lib/db';
import { ADMIN_API_ROLES, isApiError, requireApiContext, scopedBranchWhere } from '@/lib/apiAuth';
import { apiError, apiSuccess } from '@/lib/utils';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const { id } = await params;

    const instalment = await prisma.instalment.findFirst({
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

    if (!instalment) return apiError('Instalment not found', 404);
    return apiSuccess(instalment);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireApiContext(['admin', 'superadmin', 'developer']);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    if (context.role !== 'admin' && context.role !== 'superadmin' && context.role !== 'developer') {
      return apiError('Forbidden', 403);
    }

    const { id } = await params;
    const body = await request.json();
    const instalment = await prisma.instalment.findFirst({
      where: { id, loan: { tenantId: context.tenantId, appType: context.appType, ...scopedBranchWhere(context) } },
    });
    if (!instalment) return apiError('Instalment not found', 404);

    const data: any = {};
    if (body.status) data.status = body.status;
    if (body.receivedAmount !== undefined) data.receivedAmount = Number(body.receivedAmount);
    if (body.status === 'paid' || body.status === 'partial') data.receivedAt = new Date();

    const updated = await prisma.instalment.update({ where: { id }, data });
    return apiSuccess(updated);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
