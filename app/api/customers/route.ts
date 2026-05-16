import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { auth } from '@/lib/auth';
import { getAgentRouteIds } from '@/lib/access';
import { getActiveBranchId } from '@/lib/branch';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return apiError('Unauthorized', 401);

    const role = (session.user as any)?.role;
    const branchId = await getActiveBranchId();
    const userId = session.user?.id;

    const tenantId = await getDefaultTenantId();
    const appType = await getUserAppType();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    const where: any = { tenantId, appType };

    if (branchId) {
      where.branchId = branchId;
    }

    // Agent can only see customers from their assigned/shared routes
    if (role === 'agent' && userId) {
      const routeIds = await getAgentRouteIds(userId);
      if (routeIds.length === 0) {
        return apiSuccess([]);
      }
      where.routeId = { in: routeIds };
    }

    // Block non-admin, non-superadmin, non-developer, non-agent
    if (!['admin', 'superadmin', 'developer', 'agent'].includes(role)) {
      return apiError('Forbidden', 403);
    }

    if (q) {
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { customerCode: { contains: q } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        route: { select: { name: true } },
        loans: {
          where: { status: 'active' },
          select: { id: true, principal: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess(customers);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
