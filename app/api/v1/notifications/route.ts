import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { buildSystemNotificationWhere } from '@/lib/notificationVisibility';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || 50)));
  const unreadOnly = searchParams.get('unreadOnly') === 'true';

  const where = buildSystemNotificationWhere({
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    userId: ctx.userId,
    userRole: ctx.role,
    activeBranchId: ctx.branchId,
    unreadOnly,
  });

  try {
    const [total, rows] = await Promise.all([
      prisma.systemNotification.count({ where }),
      prisma.systemNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          type: true,
          icon: true,
          title: true,
          message: true,
          link: true,
          isRead: true,
          createdAt: true,
        },
      }),
    ]);

    return ok({ data: rows, total }, { page, pageSize, total });
  } catch (e: any) {
    return fail(e?.message ?? 'Notifications list failed', 500);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const body = await req.json().catch(() => ({})) as { notificationId?: string };

  try {
    if (body?.notificationId) {
      // Mark single notification as read — scoped via visibility helper (SEC-10)
      const res = await prisma.systemNotification.updateMany({
        where: {
          id: body.notificationId,
          ...buildSystemNotificationWhere({
            tenantId: ctx.tenantId,
            appType: ctx.appType,
            userId: ctx.userId,
            userRole: ctx.role,
            activeBranchId: ctx.branchId,
          }),
        },
        data: { isRead: true, readAt: new Date() },
      });
      if (res.count === 0) return fail('Notification not found', 404);
    } else {
      // Mark all matching notifications as read.
      const where = buildSystemNotificationWhere({
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        userId: ctx.userId,
        userRole: ctx.role,
        activeBranchId: ctx.branchId,
        unreadOnly: true,
      });
      await prisma.systemNotification.updateMany({
        where,
        data: { isRead: true, readAt: new Date() },
      });
    }

    return ok({ success: true });
  } catch (e: any) {
    return fail(e?.message ?? 'Mark read failed', 500);
  }
}
