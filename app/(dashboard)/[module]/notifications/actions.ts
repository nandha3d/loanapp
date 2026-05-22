'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getActiveBranchId } from '@/lib/branch';
import { buildSystemNotificationWhere } from '@/lib/notificationVisibility';

export async function markNotificationRead(id: string) {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const userId = session?.user?.id;
  const activeBranchId = await getActiveBranchId();

  await prisma.systemNotification.updateMany({
    where: {
      id,
      ...buildSystemNotificationWhere({ tenantId, appType, userId, userRole, activeBranchId }),
    },
    data: { isRead: true, readAt: new Date() },
  });

  revalidatePath('/notifications');
  return { success: true };
}

export async function markAllNotificationsRead() {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const userId = session?.user?.id;
  const activeBranchId = await getActiveBranchId();

  await prisma.systemNotification.updateMany({
    where: buildSystemNotificationWhere({
      tenantId,
      appType,
      userId,
      userRole,
      activeBranchId,
      unreadOnly: true,
    }),
    data: { isRead: true, readAt: new Date() },
  });

  revalidatePath('/notifications');
  return { success: true };
}
