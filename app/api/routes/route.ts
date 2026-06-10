import prisma from '@/lib/db';
import { ADMIN_API_ROLES, isApiError, requireApiContext, scopedBranchWhere } from '@/lib/apiAuth';
import { apiCreated, apiError, apiSuccess } from '@/lib/utils';

function routeBranchScope(context: { branchId: string | null }) {
  const branchWhere = scopedBranchWhere(context as any);
  if (!branchWhere.branchId) return {};
  return { OR: [{ branchId: branchWhere.branchId }, { branchId: null }] };
}

export async function GET() {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;

    const routes = await prisma.route.findMany({
      where: { tenantId: context.tenantId, appType: context.appType, ...routeBranchScope(context) },
      include: { assignedAgent: { select: { id: true, name: true, phone: true } }, _count: { select: { customers: true } } },
      orderBy: { name: 'asc' },
    });

    return apiSuccess(routes);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const body = await request.json();

    if (!body.name?.trim()) return apiError('Route name is required', 400);

    const route = await prisma.route.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.role === 'admin' ? context.branchId : body.branchId || context.branchId || null,
        name: body.name.trim(),
        assignedAgentId: body.assignedAgentId || null,
        appType: context.appType,
        status: 'active',
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'create',
        entityType: 'route',
        entityId: route.id,
        newValue: JSON.stringify(route),
      },
    });

    return apiCreated(route);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
