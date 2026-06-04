import { serverFetch } from '@/lib/api-client/server';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { getAgentRouteIds } from '@/lib/access';
import CollectionClient from './CollectionClient';
import { getDictionary } from '@/lib/i18n';
import { getActiveBranchId } from '@/lib/branch';
import { COLLECTIBLE_LOAN_STATUSES } from '@/lib/collectionPolicy';

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function enrichInstalment(instalment: any, today: Date) {
  const dueAmount = Number(instalment.dueAmount);
  const receivedAmount = Number(instalment.receivedAmount || 0);
  const outstandingAmount = Math.max(0, dueAmount - receivedAmount);
  const dueDate = new Date(instalment.dueDate);
  dueDate.setHours(0, 0, 0, 0);
  const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)));

  return {
    ...instalment,
    dueAmount,
    receivedAmount,
    outstandingAmount,
    overdueAmount: dueDate < today ? outstandingAmount : 0,
    daysOverdue,
    loan: {
      ...instalment.loan,
      totalPayable: Number(instalment.loan.totalPayable),
      totalCollected: Number(instalment.loan.totalCollected),
      principal: Number(instalment.loan.principal),
      totalInstalments: instalment.loan.totalInstalments,
      paidCount: instalment.loan.paidCount,
      perInstalment: Number(instalment.loan.perInstalment),
      frequency: instalment.loan.frequency,
    }
  };
}

export default async function CollectionPage() {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const dict = await getDictionary(tenantId);
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const activeBranchId = await getActiveBranchId();

  const userId = session?.user?.id;
  const userRole = (session?.user as { role?: string })?.role;
  const userName = session?.user?.name || 'Agent';

  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const res = await serverFetch<any>('/collection/dashboard');
  const todayInstalments = res?.todayInstalments || [];
  const overdueInstalments = res?.overdueInstalments || [];
  const agentRoutes = res?.routes || [];
  const dailyCollection = res?.dailyCollection || null;
  const receiptPdfEnabled = res?.receiptPdfEnabled || false;
  const gpsTrackingEnabled = res?.gpsTrackingEnabled || false;

  const routeName = agentRoutes.map((route: any) => route.name).join(', ') || 'All Routes';

  const todayRows = JSON.parse(JSON.stringify(todayInstalments.map((item: any) => enrichInstalment(item, today))));
  const overdueRows = JSON.parse(JSON.stringify(
    overdueInstalments
      .map((item: any) => enrichInstalment(item, today))
      .filter((item: any) => item.outstandingAmount > 0),
  ));
  const routes = JSON.parse(JSON.stringify(agentRoutes));

  return (
    <CollectionClient
      todayInstalments={todayRows}
      overdueInstalments={overdueRows}
      routes={routes}
      agentName={userName}
      agentRole={userRole || 'agent'}
      routeName={routeName}
      currencySymbol={currencySymbol}
      dict={dict}
      dailyCollection={dailyCollection ? {
        id: dailyCollection.id,
        status: dailyCollection.status,
        totalCollected: Number(dailyCollection.totalCollected)
      } : null}
      receiptPdfEnabled={receiptPdfEnabled}
      gpsTrackingEnabled={gpsTrackingEnabled}
    />
  );
}
