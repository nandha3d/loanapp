import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import NotificationsClient from './NotificationsClient';
import { getDictionary } from '@/lib/i18n';
import { auth } from '@/lib/auth';
import { getActiveBranchId } from '@/lib/branch';
import { buildSystemNotificationWhere } from '@/lib/notificationVisibility';

export default async function NotificationsPage() {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const dict = await getDictionary(tenantId);
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const userId = session?.user?.id;
  const activeBranchId = await getActiveBranchId();

  const notifications = await prisma.systemNotification.findMany({
    where: buildSystemNotificationWhere({
      tenantId,
      appType,
      userId,
      userRole,
      activeBranchId,
    }),
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const serialized = JSON.parse(JSON.stringify(notifications));

  return <NotificationsClient notifications={serialized} dict={dict} />;
}
