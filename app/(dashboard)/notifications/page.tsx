import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import NotificationsClient from './NotificationsClient';
import { getDictionary } from '@/lib/i18n';
import { auth } from '@/lib/auth';
import { getActiveBranchId } from '@/lib/branch';

export default async function NotificationsPage() {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const dict = await getDictionary(tenantId);
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const activeBranchId = await getActiveBranchId();

  const where: any = { tenantId, appType };

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

  const notifications = await prisma.systemNotification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const serialized = JSON.parse(JSON.stringify(notifications));

  return <NotificationsClient notifications={serialized} dict={dict} />;
}
