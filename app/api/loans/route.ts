import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { auth } from '@/lib/auth';
import { getActiveBranchId } from '@/lib/branch';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return apiError('Unauthorized', 401);

    const role = (session.user as any)?.role;
    // Resolved, not read off the session: the session copy goes stale when an
    // admin is moved, and it ignores the superadmin branch switcher entirely.
    const branchId = await getActiveBranchId();

    // Agents are not allowed to access loans API
    if (role === 'agent') return apiError('Forbidden', 403);

    if (!['admin', 'superadmin', 'developer'].includes(role)) {
      return apiError('Forbidden', 403);
    }

    const tenantId = await getDefaultTenantId();
    const appType = await getUserAppType();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = { tenantId, appType };
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;

    // Branch isolation. getActiveBranchId already returns null for developers
    // and for a superadmin on "All Branches", so those stay tenant-wide.
    if (branchId) {
      where.branchId = branchId;
    }

    const [total, loans] = await Promise.all([
      prisma.loan.count({ where }),
      prisma.loan.findMany({
        where,
        include: {
          customer: { select: { name: true, phone: true } },
          instalments: {
            where: { dueDate: { lte: new Date() }, status: 'upcoming' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
    ]);

    return apiSuccess({ loans, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
