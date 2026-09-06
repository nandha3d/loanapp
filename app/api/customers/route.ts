import { sanitizeCustomers } from '@/lib/api/sanitizeCustomer';
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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

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

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        include: {
          route: { select: { name: true } },
          loans: {
            where: { status: 'active' },
            select: { id: true, principal: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
    ]);

    return apiSuccess({ customers: sanitizeCustomers(customers), total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
