import { serverFetch } from '@/lib/api-client/server';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserAppType } from '@/lib/tenant';
import { formatCurrency, formatDate } from '@/lib/utils';
import { modulePath } from '@/types/modules';
import RunsListClient from './RunsListClient';

export default async function CollectionRunsPage() {
  const session = await auth();
  if (!session) redirect('/login');
  const appType = await getUserAppType();

  let runData: any = null;
  try {
    const res = await serverFetch<any>('/collection/run');
    runData = res?.data;
  } catch (err) {
    // Handle error
  }

  const routes = runData?.routes || [];
  const runs = runData?.runs || [];

  const routeName = new Map(routes.map((r: any) => [r.id, r.name]));
  const rows = runs.map((r: any) => ({
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

