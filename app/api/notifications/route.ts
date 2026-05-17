import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { auth } from '@/lib/auth';
import { getActiveBranchId } from '@/lib/branch';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ count: 0 }, { status: 401 });

    const tenantId = await getDefaultTenantId();
    const appType = await getUserAppType();
    const userRole = (session?.user as any)?.role;
    const activeBranchId = await getActiveBranchId();

    const where: any = { tenantId, appType, isRead: false };

    // Scope by role
    if (userRole === 'agent') {
      where.targetRole = 'agent';
    } else if (userRole === 'admin') {
      where.targetRole = 'admin';
    }

    // Scope by active branch
    if (activeBranchId) {
      where.OR = [
        { branchId: activeBranchId },
        { branchId: null }
      ];
    }

    const count = await prisma.systemNotification.count({
      where,
    });
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
