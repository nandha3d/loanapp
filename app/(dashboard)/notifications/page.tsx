import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import NotificationsClient from './NotificationsClient';

export default async function NotificationsPage() {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();

  const notifications = await prisma.systemNotification.findMany({
    where: { tenantId, appType },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const serialized = JSON.parse(JSON.stringify(notifications));

  return <NotificationsClient notifications={serialized} />;
}
