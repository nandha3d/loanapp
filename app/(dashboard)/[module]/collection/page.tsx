import { serverFetch } from '@/lib/api-client/server';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';

// Collection data is live (today's dues change constantly). Force dynamic
// rendering so a stale full-route/RSC cache can never show an empty list.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getAgentRouteIds } from '@/lib/access';
import CollectionClient from './CollectionClient';
import ChitCollectionClient from './ChitCollectionClient';
import prisma from '@/lib/db';
import { getDictionary } from '@/lib/i18n';
import { getActiveBranchId } from '@/lib/branch';
import { COLLECTIBLE_LOAN_STATUSES } from '@/lib/collectionPolicy';
import { startOfBusinessToday } from '@/lib/businessTime';
import { summarizeCollectionWorklist } from '@/lib/collectionSummary';

function startOfToday() {
  // IST day boundary (server runs UTC) so overdue/today classification matches
  // the operator's calendar.
  return startOfBusinessToday();
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

  // ── Chitfunds: contribution collection, NOT loan instalments ───────────────
  // Chit collects members' monthly subscriptions. Render a chit-specific
  // worklist and return before any loan-collection logic runs below.
  if (appType === 'chitfunds') {
    return renderChitCollection({ tenantId, appType, activeBranchId, today, tomorrow, currencySymbol, dict });
  }

  // serverFetch returns the raw v1 envelope { data, error, pagination }; the
  // payload lives under `.data` (this was the empty-collection bug — fields
  // were read off the envelope root and came back undefined).
  const res = await serverFetch<any>('/collection/dashboard');
  const payload = res?.data ?? res ?? {};
  const todayInstalments = payload.todayInstalments || [];
  const overdueInstalments = payload.overdueInstalments || [];
  const collectionSummary = payload.collectionSummary || summarizeCollectionWorklist({
    todayRows: todayInstalments.filter((item: any) => {
      const due = new Date(item.dueDate);
      return due >= today && due < tomorrow;
    }),
    overdueRows: overdueInstalments,
    overdueCollectedToday: 0,
  });
  const agentRoutes = payload.routes || [];
  const dailyCollection = payload.dailyCollection || null;
  const receiptPdfEnabled = payload.receiptPdfEnabled || false;
  const gpsTrackingEnabled = payload.gpsTrackingEnabled || false;

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
      collectionSummary={collectionSummary}
      receiptPdfEnabled={receiptPdfEnabled}
      gpsTrackingEnabled={gpsTrackingEnabled}
    />
  );
}

// ── Chitfunds contribution collection ────────────────────────────────────────
// Worklist of chit subscriptions (members' monthly contributions) due today and
// overdue, across the active branch's chit groups. Collect action reuses the
// existing recordChitPayment server action. Entirely separate from the loan
// collection path above.
async function renderChitCollection(args: {
  tenantId: string;
  appType: string;
  activeBranchId: string | null;
  today: Date;
  tomorrow: Date;
  currencySymbol: string;
  dict: any;
}) {
  const { tenantId, appType, activeBranchId, today, tomorrow, currencySymbol, dict } = args;
  const branchFilter = activeBranchId ? { branchId: activeBranchId } : {};

  const groupWhere = { tenantId, appType, ...branchFilter };

  const [dueToday, overdue] = await Promise.all([
    prisma.chitSubscription.findMany({
      where: {
        status: { not: 'paid' },
        dueDate: { gte: today, lt: tomorrow },
        member: { chitGroup: groupWhere },
      },
      include: { member: { include: { customer: true, chitGroup: true } } },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.chitSubscription.findMany({
      where: {
        status: { not: 'paid' },
        dueDate: { lt: today },
        member: { chitGroup: groupWhere },
      },
      include: { member: { include: { customer: true, chitGroup: true } } },
      orderBy: { dueDate: 'asc' },
    }),
  ]);

  const toRow = (s: any, bucket: 'today' | 'overdue') => ({
    id: s.id,
    memberId: s.memberId,
    periodNumber: s.periodNumber,
    customerName: s.member?.customer?.name ?? 'Member',
    customerPhone: s.member?.customer?.phone ?? '',
    groupName: s.member?.chitGroup?.name ?? 'Chit Group',
    baseContribution: Number(s.baseDueAmount ?? Number(s.dueAmount) + Number(s.dividendAmount || 0)),
    dividendAdjustment: Number(s.dividendAmount || 0),
    penalty: Number(s.penaltyAmount || 0),
    netDue: Number(s.dueAmount) + Number(s.penaltyAmount || 0),
    dueAmount: Number(s.dueAmount),
    paidAmount: Number(s.paidAmount),
    outstanding: Math.max(0, Number(s.dueAmount) + Number(s.penaltyAmount || 0) - Number(s.paidAmount)),
    dueDate: s.dueDate.toISOString(),
    status: s.status,
    bucket,
  });

  const rows = [
    ...dueToday.map((s) => toRow(s, 'today')),
    ...overdue.map((s) => toRow(s, 'overdue')),
  ];

  return (
    <ChitCollectionClient
      rows={rows}
      currencySymbol={currencySymbol}
      dict={dict}
    />
  );
}
