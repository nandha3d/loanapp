'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';

export async function markNotificationRead(id: string) {
  const tenantId = await getDefaultTenantId();

  await prisma.systemNotification.update({
    where: { id, tenantId },
    data: { isRead: true, readAt: new Date() },
  });

  revalidatePath('/notifications');
  return { success: true };
}

export async function markAllNotificationsRead() {
  const tenantId = await getDefaultTenantId();

  await prisma.systemNotification.updateMany({
    where: { tenantId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  revalidatePath('/notifications');
  return { success: true };
}
