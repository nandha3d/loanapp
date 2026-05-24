import prisma from '@/lib/db';
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

  let customerIds: string[];
  let agentRouteIds: string[] = [];

  if (userRole === 'agent' && userId) {
    agentRouteIds = await getAgentRouteIds(userId);
    const customers = await prisma.customer.findMany({
      where: { tenantId, appType, routeId: { in: agentRouteIds } },
      select: { id: true },
    });
    customerIds = customers.map((customer) => customer.id);
  } else {
    const customers = await prisma.customer.findMany({
      where: { tenantId, appType, ...(activeBranchId ? { branchId: activeBranchId } : {}) },
      select: { id: true },
    });
    customerIds = customers.map((customer) => customer.id);
  }

  const baseLoanWhere = {
    tenantId,
    appType,
    customerId: { in: customerIds },
    status: { in: [...COLLECTIBLE_LOAN_STATUSES] },
    ...(activeBranchId ? { branchId: activeBranchId } : {}),
  };

  const includeLoan = {
    loan: {
      include: {
        customer: { include: { route: true } },
      },
    },
    collectionEntry: {
      select: { id: true },
    },
  };

  const [todayInstalments, overdueInstalments, agentRoutes] = await Promise.all([
    prisma.instalment.findMany({
      where: {
        loan: baseLoanWhere,
        dueDate: { gte: today, lt: tomorrow },
      },
      include: includeLoan,
      orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
    }),
    prisma.instalment.findMany({
      where: {
        loan: baseLoanWhere,
        dueDate: { lt: today },
        status: { in: ['upcoming', 'missed', 'partial'] },
      },
      include: includeLoan,
      orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
    }),
    prisma.route.findMany({
      where: {
        tenantId,
        appType,
        status: 'active',
        ...(activeBranchId ? { branchId: activeBranchId } : {}),
        ...(userRole === 'agent' && agentRouteIds.length > 0
          ? { id: { in: agentRouteIds } }
          : userRole !== 'agent' ? {} : { id: { in: [] } }),
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const dailyCollectionRaw = userId ? await prisma.$queryRaw<{ id: string, status: string, totalCollected: number }[]>`
    SELECT id, status, total_collected as totalCollected FROM daily_collections
     WHERE tenant_id = ${tenantId} AND app_type = ${appType} AND agent_id = ${userId} AND date = CURDATE()
     LIMIT 1
  ` : [];
  const dailyCollection = dailyCollectionRaw[0] || null;

  const routeName = agentRoutes.map((route) => route.name).join(', ') || 'All Routes';

  const todayRows = JSON.parse(JSON.stringify(todayInstalments.map((item) => enrichInstalment(item, today))));
  const overdueRows = JSON.parse(JSON.stringify(
    overdueInstalments
      .map((item) => enrichInstalment(item, today))
      .filter((item) => item.outstandingAmount > 0),
  ));
  const routes = JSON.parse(JSON.stringify(agentRoutes));

  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  const isReceiptPdfAllowed = sub?.receiptPdfAllowed || false;
  const isReceiptPdfActive = await getSetting(tenantId, 'receipt_pdf_active', 'false') === 'true';
  const receiptPdfEnabled = isReceiptPdfAllowed && isReceiptPdfActive;
  const gpsTrackingEnabled = sub?.gpsTrackingEnabled || false;

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
