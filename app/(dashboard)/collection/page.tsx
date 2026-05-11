import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { getAgentRouteIds } from '@/lib/access';
import CollectionClient from './CollectionClient';

export default async function CollectionPage() {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');

  const userId = (session?.user as any)?.id;
  const userRole = (session?.user as any)?.role;
  const userName = session?.user?.name || 'Agent';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // For agents: resolve all route IDs they are assigned to (primary + shared RouteAgent).
  // For admins: all customers in the tenant/appType.
  let customerIds: string[];
  let agentRouteIds: string[] = [];

  if (userRole === 'agent' && userId) {
    agentRouteIds = await getAgentRouteIds(userId);
    const customers = await prisma.customer.findMany({
      where: { tenantId, appType, routeId: { in: agentRouteIds } },
      select: { id: true },
    });
    customerIds = customers.map((c) => c.id);
  } else {
    const customers = await prisma.customer.findMany({
      where: { tenantId, appType },
      select: { id: true },
    });
    customerIds = customers.map((c) => c.id);
  }

  // Get today's due instalments for these customers
  const todayInstalments = await prisma.instalment.findMany({
    where: {
      loan: {
        tenantId,
        appType,
        customerId: { in: customerIds },
        status: { in: ['active', 'overdue'] },
      },
      dueDate: { gte: today, lt: tomorrow },
    },
    include: {
      loan: {
        include: {
          customer: { include: { route: true } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  // Also get missed instalments (past due, not paid)
  const missedInstalments = await prisma.instalment.findMany({
    where: {
      loan: {
        tenantId,
        appType,
        customerId: { in: customerIds },
        status: { in: ['active', 'overdue'] },
      },
      dueDate: { lt: today },
      status: { in: ['upcoming', 'missed'] },
    },
    include: {
      loan: {
        include: {
          customer: { include: { route: true } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
    take: 20,
  });

  // Combine: missed first, then today's
  const allInstalments = [...missedInstalments, ...todayInstalments];

  // Get agent's route info (primary + shared)
  const agentRoutes = await prisma.route.findMany({
    where: {
      tenantId,
      appType,
      status: 'active',
      ...(userRole === 'agent' && agentRouteIds.length > 0
        ? { id: { in: agentRouteIds } }
        : userRole !== 'agent' ? {} : { id: { in: [] } }),
    },
  });

  const routeName = agentRoutes.map((r) => r.name).join(', ') || 'All Routes';

  // Serialize for client
  const serialized = JSON.parse(JSON.stringify(allInstalments));

  return (
    <CollectionClient
      instalments={serialized}
      agentName={userName}
      agentRole={userRole || 'agent'}
      routeName={routeName}
      currencySymbol={currencySymbol}
    />
  );
}
