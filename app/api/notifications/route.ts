import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { auth } from '@/lib/auth';
import { getActiveBranchId } from '@/lib/branch';
import { NextResponse } from 'next/server';
import { buildSystemNotificationWhere } from '@/lib/notificationVisibility';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ count: 0 }, { status: 401 });

    const tenantId = await getDefaultTenantId();
    const appType = await getUserAppType();
    const userRole = (session?.user as any)?.role;
    const userId = session.user.id;
    const activeBranchId = await getActiveBranchId();

    const where = buildSystemNotificationWhere({
      tenantId,
      appType,
      userId,
      userRole,
      activeBranchId,
      unreadOnly: true,
    });

    const [count, items] = await Promise.all([
      prisma.systemNotification.count({ where }),
      prisma.systemNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, type: true, icon: true, title: true, message: true, link: true, createdAt: true, isRead: true },
      }),
    ]);
    return NextResponse.json({ count, items });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
