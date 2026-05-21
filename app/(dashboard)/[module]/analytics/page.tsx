import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getBranding, getUserAppType, getSetting } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { getActiveBranchId } from '@/lib/branch';
import { getAnalyticsData } from './actions';
import AnalyticsClient from './AnalyticsClient';
import ReportsClient from '../reports/ReportsClient';
import { getDictionary } from '@/lib/i18n';
import { modulePath } from '@/types/modules';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const appType = await getUserAppType();
  if (!role || role === 'agent') redirect(modulePath(appType, '/dashboard'));

  const tenantId = await getDefaultTenantId();
  const branding = await getBranding(tenantId);
  const activeBranchId = await getActiveBranchId();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const dict = await getDictionary(tenantId);

  const data = await getAnalyticsData(tenantId, appType, activeBranchId);
  const serialized = JSON.parse(JSON.stringify(data));

  // --- REPORTS LOGIC ---
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);

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

  const dateFrom = new Date(fromStr);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(toStr);
  dateTo.setHours(23, 59, 59, 999);

  const loanBase: any = { tenantId, appType };
  if (activeBranchId) loanBase.branchId = activeBranchId;

  const instalmentFilter: any = {
    loan: { ...loanBase },
    dueDate: { gte: dateFrom, lte: dateTo },
  };
  if (routeId) {
    instalmentFilter.loan.customer = { routeId };
  }
  if (agentId) {
    instalmentFilter.agentId = agentId;
  }

  const instalments = await prisma.instalment.findMany({
    where: instalmentFilter,
    select: { dueAmount: true, receivedAmount: true, status: true },
  });

  const collectionsFilter: any = {
    tenantId,
    submittedAt: { gte: dateFrom, lte: dateTo },
    loan: { ...loanBase },
  };
  if (routeId) collectionsFilter.customer = { routeId };
  if (agentId) collectionsFilter.agentId = agentId;

  const collections = await prisma.collectionEntry.findMany({
    where: collectionsFilter,
    select: { receivedAmount: true },
  });

  const totalExpected = instalments.reduce((s, i) => s + Number(i.dueAmount), 0);
  const totalCollected = collections.reduce((s, c) => s + Number(c.receivedAmount), 0);
  const efficiency = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 1000) / 10 : 0;

  const overdueLoans = await prisma.loan.findMany({
    where: {
      ...loanBase,
      status: { in: ['active', 'overdue'] },
      ...(routeId ? { customer: { routeId } } : {}),
    },
    include: {
      customer: { select: { name: true, routeId: true } },
      instalments: {
        where: { status: { in: ['missed', 'upcoming'] }, dueDate: { lt: now } },
        select: { dueDate: true },
      },
      penalties: {
        where: { status: 'pending' },
        select: { grossPenalty: true, missedDays: true },
      },
    },
  });

  const agingBuckets = { short: { count: 0, penalty: 0, customers: [] as string[] }, medium: { count: 0, penalty: 0, customers: [] as string[] }, long: { count: 0, penalty: 0, customers: [] as string[] } };

  for (const loan of overdueLoans) {
    if (loan.instalments.length === 0) continue;
    const oldestMissed = loan.instalments.reduce((oldest, i) => {
      const d = new Date(i.dueDate);
      return d < oldest ? d : oldest;
    }, new Date());
    const daysMissed = Math.floor((now.getTime() - oldestMissed.getTime()) / 86400000);
    const penaltyTotal = loan.penalties.reduce((s, p) => s + Number(p.grossPenalty), 0);
    const name = loan.customer.name;

    if (daysMissed <= 7) {
      agingBuckets.short.count++;
      agingBuckets.short.penalty += penaltyTotal;
      if (!agingBuckets.short.customers.includes(name)) agingBuckets.short.customers.push(name);
    } else if (daysMissed <= 30) {
      agingBuckets.medium.count++;
      agingBuckets.medium.penalty += penaltyTotal;
      if (!agingBuckets.medium.customers.includes(name)) agingBuckets.medium.customers.push(name);
    } else {
      agingBuckets.long.count++;
      agingBuckets.long.penalty += penaltyTotal;
      if (!agingBuckets.long.customers.includes(name)) agingBuckets.long.customers.push(name);
    }
  }

  const penaltyAgg = await prisma.penalty.aggregate({
    where: {
      loan: { ...loanBase },
      createdAt: { gte: dateFrom, lte: dateTo },
    },
    _sum: { grossPenalty: true, settledAmount: true, waivedAmount: true },
  });
  const penaltyReport = {
    accrued: Number(penaltyAgg._sum.grossPenalty || 0),
    settled: Number(penaltyAgg._sum.settledAmount || 0),
    waived: Number(penaltyAgg._sum.waivedAmount || 0),
  };

  const loanFilter: any = {
    ...loanBase,
    createdAt: { gte: dateFrom, lte: dateTo },
  };
  if (routeId) loanFilter.customer = { routeId };

  const newLoans = await prisma.loan.findMany({
    where: loanFilter,
    select: { principal: true },
  });
  const disbursement = {
    count: newLoans.length,
    totalPrincipal: newLoans.reduce((s, l) => s + Number(l.principal), 0),
  };

  const agents = await prisma.user.findMany({
    where: { tenantId, appType, role: 'agent', status: 'active' },
    select: { id: true, name: true },
  });

  const agentPerformance = await Promise.all(
    agents.map(async (agent) => {
      const agentCustomers = await prisma.customer.count({
        where: { ...loanBase, agentId: agent.id },
      });

      const agentInstalments = await prisma.instalment.findMany({
        where: {
          loan: { ...loanBase, customer: { agentId: agent.id } },
          dueDate: { gte: dateFrom, lte: dateTo },
        },
        select: { dueAmount: true, receivedAmount: true, status: true },
      });

      const expected = agentInstalments.reduce((s, i) => s + Number(i.dueAmount), 0);
      const collected = agentInstalments
        .filter((i) => i.status === 'paid' || i.status === 'partial')
        .reduce((s, i) => s + Number(i.receivedAmount), 0);
      const hitRate = expected > 0 ? Math.round((collected / expected) * 100) : 0;

      const routes = await prisma.route.findMany({
        where: { tenantId, appType, routeAgents: { some: { agentId: agent.id } }, status: 'active' },
        select: { name: true },
      });

      return {
        id: agent.id,
        name: agent.name,
        route: routes.map((r) => r.name).join(', ') || '—',
        customers: agentCustomers,
        expected,
        collected,
        hitRate,
      };
    })
  );

  const allRoutes = await prisma.route.findMany({
    where: { tenantId, appType, status: 'active' },
    orderBy: { name: 'asc' },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            <span className="material-icons-outlined" style={{ verticalAlign: 'middle', marginRight: '8px', fontSize: '1.4rem' }}>insights</span>
            Reports & Analytics
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
            Portfolio intelligence, risk monitoring, operational insights, and custom reporting.
          </p>
        </div>
      </div>
      
      <AnalyticsClient data={serialized} currencySymbol={branding.currencySymbol} />
      
      <div style={{ marginTop: '40px', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
        <h3 style={{ marginBottom: '20px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-icons-outlined" style={{ color: 'var(--primary)' }}>assessment</span>
          Custom Date Reports
        </h3>
        <ReportsClient
          collectionEfficiency={{ expected: totalExpected, collected: totalCollected, efficiency }}
          agingBuckets={agingBuckets}
          penaltyReport={penaltyReport}
          disbursement={disbursement}
          agentPerformance={agentPerformance}
          routes={allRoutes}
          agents={agents}
          currencySymbol={currencySymbol}
          filters={{ from: fromStr, to: toStr, routeId, agentId }}
          dict={dict}
        />
      </div>
    </div>
  );
}
