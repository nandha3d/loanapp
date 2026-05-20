import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import ReportsClient from './ReportsClient';
import { getDictionary } from '@/lib/i18n';
import { getActiveBranchId } from '@/lib/branch';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const branchId = await getActiveBranchId();
  if (userRole === 'agent') redirect('/collection');

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
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

  const dateFrom = new Date(fromStr);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(toStr);
  dateTo.setHours(23, 59, 59, 999);

  const loanBase: any = { tenantId, appType };
  if (branchId) loanBase.branchId = branchId;

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
  const nowTime = now.getTime();
  const customerSet = { short: new Set<string>(), medium: new Set<string>(), long: new Set<string>() };

  for (const loan of overdueLoans) {
    if (loan.instalments.length === 0) continue;
    
    // Optimize: use Math.min with mapped timestamps to find oldest date
    const oldestMissedTime = Math.min(...loan.instalments.map(i => new Date(i.dueDate).getTime()));
    const daysMissed = Math.floor((nowTime - oldestMissedTime) / 86400000);
    
    // Optimize: inline sum instead of reduce
    let penaltyTotal = 0;
    for (const p of loan.penalties) {
      penaltyTotal += Number(p.grossPenalty);
    }
    
    const name = loan.customer.name;
    let bucket: keyof typeof agingBuckets;

    if (daysMissed <= 7) {
      bucket = 'short';
    } else if (daysMissed <= 30) {
      bucket = 'medium';
    } else {
      bucket = 'long';
    }

    agingBuckets[bucket].count++;
    agingBuckets[bucket].penalty += penaltyTotal;
    customerSet[bucket].add(name);
  }

  // Convert sets to arrays
  agingBuckets.short.customers = Array.from(customerSet.short);
  agingBuckets.medium.customers = Array.from(customerSet.medium);
  agingBuckets.long.customers = Array.from(customerSet.long);

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
    where: { tenantId, appType, role: 'agent', status: 'active', ...(branchId ? { branchId } : {}) },
    select: { id: true, name: true },
  });

  // Batch queries instead of N+1: get all data for all agents in one go
  const [agentCustomerCounts, allAgentInstalments, agentRoutes] = await Promise.all([
    // Query 1: Customer counts per agent
    prisma.customer.groupBy({
      by: ['agentId'],
      where: { ...loanBase },
      _count: true,
    }),
    // Query 2: All instalments for all agents in date range
    prisma.instalment.findMany({
      where: {
        loan: { ...loanBase, customer: { agentId: { in: agents.map(a => a.id) } } },
        dueDate: { gte: dateFrom, lte: dateTo },
      },
      select: {
        dueAmount: true,
        receivedAmount: true,
        status: true,
        loan: { select: { customer: { select: { agentId: true } } } },
      },
    }),
    // Query 3: All routes for all agents
    prisma.routeAgent.findMany({
      where: {
        agentId: { in: agents.map(a => a.id) },
        route: { tenantId, appType, status: 'active' },
      },
      select: {
        agentId: true,
        route: { select: { name: true } },
      },
    }),
  ]);

  // Create lookup maps for O(1) access
  const customerCountMap = new Map(agentCustomerCounts.map(c => [c.agentId, c._count]));
  const instalmentsByAgent = new Map<string, typeof allAgentInstalments>();
  const routesByAgent = new Map<string, string[]>();

  // Group instalments by agent
  for (const instalment of allAgentInstalments) {
    const agentId = instalment.loan.customer.agentId;
    if (!instalmentsByAgent.has(agentId)) instalmentsByAgent.set(agentId, []);
    instalmentsByAgent.get(agentId)!.push(instalment);
  }

  // Group routes by agent
  for (const routeAgent of agentRoutes) {
    if (!routesByAgent.has(routeAgent.agentId)) routesByAgent.set(routeAgent.agentId, []);
    routesByAgent.get(routeAgent.agentId)!.push(routeAgent.route.name);
  }

  // Map agents to performance data (no async calls, all data already fetched)
  const agentPerformance = agents.map((agent) => {
    const agentCustomers = customerCountMap.get(agent.id) || 0;
    const agentInstalments = instalmentsByAgent.get(agent.id) || [];

    const expected = agentInstalments.reduce((s, i) => s + Number(i.dueAmount), 0);
    const collected = agentInstalments
      .filter((i) => i.status === 'paid' || i.status === 'partial')
      .reduce((s, i) => s + Number(i.receivedAmount), 0);
    const hitRate = expected > 0 ? Math.round((collected / expected) * 100) : 0;

    const routes = routesByAgent.get(agent.id) || [];

    return {
      id: agent.id,
      name: agent.name,
      route: routes.join(', ') || '—',
      customers: agentCustomers,
      expected,
      collected,
      hitRate,
    };
  });

  // Routes and agents for filters
  const allRoutes = await prisma.route.findMany({
    where: { tenantId, appType, status: 'active', ...(branchId ? { branchId } : {}) },
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
