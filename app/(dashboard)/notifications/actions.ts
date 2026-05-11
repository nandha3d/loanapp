'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';

export async function markNotificationRead(id: string) {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();

  await prisma.systemNotification.updateMany({
    where: { id, tenantId, appType },
    data: { isRead: true, readAt: new Date() },
  });

  revalidatePath('/notifications');
  return { success: true };
}

export async function markAllNotificationsRead() {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();

  await prisma.systemNotification.updateMany({
    where: { tenantId, appType, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  revalidatePath('/notifications');
  return { success: true };
}
