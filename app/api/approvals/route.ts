import prisma from '@/lib/db';
import { AUTHENTICATED_API_ROLES, isApiError, requireApiContext } from '@/lib/apiAuth';
import { apiError, apiSuccess } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const authResult = await requireApiContext(AUTHENTICATED_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    const where: any = { tenantId: context.tenantId, appType: context.appType };
    if (status) where.status = status;
    if (context.role === 'agent') where.requestedById = context.userId;

    const approvals = await prisma.approvalRequest.findMany({
      where,
      include: {
        requestedBy: { select: { id: true, name: true, role: true } },
        reviewedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess(approvals);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
