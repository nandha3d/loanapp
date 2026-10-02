import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import NotificationsClient from './NotificationsClient';
import { getDictionary } from '@/lib/i18n';
import { auth } from '@/lib/auth';
import { getActiveBranchId } from '@/lib/branch';
import { buildSystemNotificationWhere } from '@/lib/notificationVisibility';

export default async function NotificationsPage({ searchParams }: { searchParams?: Promise<{ limit?: string }> }) {
  // NOT-04: 'Load more' widens the window 50 at a time.
  const sp = (await searchParams) ?? {};
  const limit = Math.min(1000, Math.max(50, Number(sp.limit) || 50));
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
    take: limit + 1,
  });
  const hasMore = notifications.length > limit;

  const serialized = JSON.parse(JSON.stringify(notifications.slice(0, limit)));

  return <NotificationsClient notifications={serialized} dict={dict} nextLimit={hasMore ? limit + 50 : null} />;
}
