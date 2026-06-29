import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import ReportsClient from './ReportsClient';
import GoldReportsPanel from './GoldReportsPanel';
import { serverFetch } from '@/lib/api-client/server';
import { getDictionary } from '@/lib/i18n';
import { getActiveBranchId } from '@/lib/branch';
import { modulePath } from '@/types/modules';
import { buildReportData } from '@/lib/reports/data';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const branchId = await getActiveBranchId();
  const appType = await getUserAppType();
  if (userRole === 'agent') redirect(modulePath(appType, '/collection'));

  const tenantId = await getDefaultTenantId();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const dict = await getDictionary(tenantId);

  // Parse date range
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1); // First day of month

  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const resolvedParams = await searchParams;
  const fromStr = resolvedParams.from || getLocalDateString(defaultFrom);
  const toStr = resolvedParams.to || getLocalDateString(now);
  const routeId = resolvedParams.routeId || '';
  const agentId = resolvedParams.agentId || '';

  const {
    collectionEfficiency,
    agingBuckets,
    penaltyReport,
    disbursement,
    agentPerformance,
    agents,
  } = await buildReportData({
    tenantId,
    appType,
    from: fromStr,
    to: toStr,
    routeId,
    agentId,
    branchId,
  });

  // Routes and agents for filters
  const allRoutes = await prisma.route.findMany({
    where: { tenantId, appType, status: 'active', ...(branchId ? { branchId } : {}) },
    orderBy: { name: 'asc' },
  });

  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId }
  });

  // Gold pledge reports (summary / pending / ornaments) for the gold module.
  let goldSummary: any = null, goldPending: any = null, goldOrnaments: any = null;
  if (appType === 'goldloan') {
    try {
      const [s, p, o] = await Promise.all([
        serverFetch<any>('/gold/reports?type=summary').catch(() => null),
        serverFetch<any>('/gold/reports?type=pending').catch(() => null),
        serverFetch<any>('/gold/reports?type=ornaments').catch(() => null),
      ]);
      goldSummary = s?.data ?? null;
      goldPending = p?.data ?? null;
      goldOrnaments = o?.data ?? null;
    } catch { /* tolerate pre-migration */ }
  }

  return (
    <>
    {appType === 'goldloan' && (
      <GoldReportsPanel summary={goldSummary} pending={goldPending} ornaments={goldOrnaments} currencySymbol={currencySymbol} />
    )}
    <ReportsClient
      collectionEfficiency={collectionEfficiency}
      agingBuckets={agingBuckets}
      penaltyReport={penaltyReport}
      disbursement={disbursement}
      agentPerformance={agentPerformance}
      routes={allRoutes}
      agents={agents}
      currencySymbol={currencySymbol}
      filters={{ from: fromStr, to: toStr, routeId, agentId }}
      dict={dict}
      subscription={subscription}
    />
    </>
  );
}
