import prisma from '@/lib/db';
import { ADMIN_API_ROLES, isApiError, requireApiContext, scopedBranchWhere } from '@/lib/apiAuth';
import { apiError, apiSuccess } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;

    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get('loanId');
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: any = {
      loan: { tenantId: context.tenantId, appType: context.appType, ...scopedBranchWhere(context) },
    };
    if (loanId) where.loanId = loanId;
    if (status) where.status = status;
    if (from || to) {
      where.dueDate = {};
      if (from) where.dueDate.gte = new Date(from);
      if (to) where.dueDate.lte = new Date(to);
    }

    const instalments = await prisma.instalment.findMany({
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
      orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
    });

    return apiSuccess(instalments);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
