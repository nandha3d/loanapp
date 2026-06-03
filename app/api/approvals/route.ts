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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = { tenantId: context.tenantId, appType: context.appType };
    if (status) where.status = status;
    if (context.role === 'agent') where.requestedById = context.userId;

    const [total, approvals] = await Promise.all([
      prisma.approvalRequest.count({ where }),
      prisma.approvalRequest.findMany({
        where,
        include: {
          requestedBy: { select: { id: true, name: true, role: true } },
          reviewedBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
    ]);

    return apiSuccess({ approvals, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
