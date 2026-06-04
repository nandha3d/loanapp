import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import { getAgentRouteIds } from '@/lib/access';
import { formatCurrency, formatDate } from '@/lib/utils';
import { modulePath } from '@/types/modules';
import RunsListClient from './RunsListClient';

/** mCollect-A — route batch collection runs. */
export default async function CollectionRunsPage() {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const userId = session.user!.id;
  const role = (session.user as { role?: string })?.role || 'agent';
  const activeBranchId = await getActiveBranchId();

  const agentRouteIds = role === 'agent' ? await getAgentRouteIds(userId) : [];

  const routes = await prisma.route.findMany({
    where: {
      tenantId,
      appType,
      status: 'active',
      ...(activeBranchId ? { branchId: activeBranchId } : {}),
      ...(role === 'agent' ? { id: { in: agentRouteIds.length ? agentRouteIds : ['__none__'] } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const runs = await prisma.collectionRun.findMany({
    where: {
      tenantId,
      appType,
      ...(role === 'agent' ? { agentId: userId } : activeBranchId ? { branchId: activeBranchId } : {}),
    },
    orderBy: { date: 'desc' },
    take: 50,
  });

  const routeName = new Map(routes.map((r) => [r.id, r.name]));
  const rows = runs.map((r) => ({
    id: r.id,
    date: formatDate(r.date),
    routeName: r.routeId ? routeName.get(r.routeId) ?? '—' : '—',
    status: r.status,
    expected: formatCurrency(Number(r.expectedTotal)),
    collected: formatCurrency(Number(r.collectedTotal)),
    cash: formatCurrency(Number(r.cashCollected)),
    digital: formatCurrency(Number(r.digitalCollected)),
    stops: `${r.stopsCollected}/${r.stopsExpected}`,
  }));

  return (
    <RunsListClient
      runs={rows}
      routes={routes}
      basePath={modulePath(appType, '/collection/runs')}
    />
  );
}
