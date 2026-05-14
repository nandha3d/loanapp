import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import ReportsClient from './ReportsClient';
import { getDictionary } from '@/lib/i18n';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const branchId = (session?.user as any)?.branchId as string | undefined;
  if (userRole === 'agent') redirect('/collection');

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const dict = await getDictionary(tenantId);

  // Parse date range
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1); // First day of month
  const resolvedParams = await searchParams;
  const fromStr = resolvedParams.from || defaultFrom.toISOString().split('T')[0];
  const toStr = resolvedParams.to || now.toISOString().split('T')[0];
  const routeId = resolvedParams.routeId || '';
  const agentId = resolvedParams.agentId || '';

  const dateFrom = new Date(fromStr);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(toStr);
  dateTo.setHours(23, 59, 59, 999);

  // Branch-scoped base filter for admin role
  const loanBase: any = { tenantId, appType };
  if (userRole === 'admin' && branchId) loanBase.branchId = branchId;

  // Build instalment filter
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

  // --- Collection Efficiency ---
  const instalments = await prisma.instalment.findMany({
    where: instalmentFilter,
    select: { dueAmount: true, receivedAmount: true, status: true },
  });

  const totalExpected = instalments.reduce((s, i) => s + Number(i.dueAmount), 0);
  const totalCollected = instalments
    .filter((i) => i.status === 'paid' || i.status === 'partial')
    .reduce((s, i) => s + Number(i.receivedAmount), 0);
  const efficiency = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 1000) / 10 : 0;

  // --- Defaulter Aging ---
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

  // --- Penalty Report ---
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

  // --- Loan Disbursement ---
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

  // --- Agent Performance ---
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
        where: { tenantId, appType, assignedAgentId: agent.id, status: 'active' },
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

  // Routes and agents for filters
  const allRoutes = await prisma.route.findMany({
    where: { tenantId, appType, status: 'active' },
    orderBy: { name: 'asc' },
  });

  return (
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
  );
}
