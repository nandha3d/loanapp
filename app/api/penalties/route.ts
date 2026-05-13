import prisma from '@/lib/db';
import { ADMIN_API_ROLES, isApiError, requireApiContext, scopedBranchWhere } from '@/lib/apiAuth';
import { ensurePendingPenaltiesForMissedLoans } from '@/lib/penalties';
import { apiError, apiSuccess } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const { searchParams } = new URL(request.url);

    const where: any = {
      loan: { tenantId: context.tenantId, appType: context.appType, ...scopedBranchWhere(context) },
    };
    const status = searchParams.get('status');
    const loanId = searchParams.get('loanId');
    const routeId = searchParams.get('routeId');

    await ensurePendingPenaltiesForMissedLoans({
      tenantId: context.tenantId,
      appType: context.appType,
      branchId: context.role === 'admin' ? context.branchId ?? undefined : undefined,
      loanId: loanId ?? undefined,
      routeId: routeId ?? undefined,
    });

    if (status) where.status = status;
    if (loanId) where.loanId = loanId;
    if (routeId) where.loan.customer = { routeId };

    const penalties = await prisma.penalty.findMany({
      where,
      include: {
        loan: {
          select: {
            id: true,
            loanCode: true,
            customer: { select: { id: true, customerCode: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess(penalties);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
