import prisma from '../db';

export interface ReportDataParams {
  tenantId: string;
  appType: string;
  from: string;
  to: string;
  routeId?: string;
  agentId?: string;
  branchId?: string | null;
}

export async function buildReportData(params: ReportDataParams) {
  const { tenantId, appType, from, to, routeId, agentId, branchId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
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
        where: { status: { in: ['missed', 'upcoming'] }, dueDate: { lt: new Date() } },
        select: { dueDate: true },
      },
      penalties: {
        where: { status: 'pending' },
        select: { grossPenalty: true, missedDays: true },
      },
    },
  });

  const agingBuckets = { 
    short: { count: 0, penalty: 0, customers: [] as string[] }, 
    medium: { count: 0, penalty: 0, customers: [] as string[] }, 
    long: { count: 0, penalty: 0, customers: [] as string[] } 
  };
  const nowTime = new Date().getTime();
  const customerSet = { short: new Set<string>(), medium: new Set<string>(), long: new Set<string>() };

  for (const loan of overdueLoans) {
    if (loan.instalments.length === 0) continue;
    
    const oldestMissedTime = Math.min(...loan.instalments.map(i => new Date(i.dueDate).getTime()));
    const daysMissed = Math.floor((nowTime - oldestMissedTime) / 86400000);
    
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

  const [agentCustomerCounts, allAgentInstalments, agentRoutes] = await Promise.all([
    prisma.customer.groupBy({
      by: ['agentId'],
      where: { ...loanBase },
      _count: true,
    }),
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

  const customerCountMap = new Map(agentCustomerCounts.map(c => [c.agentId, c._count]));
  const instalmentsByAgent = new Map<string, typeof allAgentInstalments>();
  const routesByAgent = new Map<string, string[]>();

  for (const instalment of allAgentInstalments) {
    const agentId = instalment.loan.customer.agentId;
    if (!agentId) continue;
    if (!instalmentsByAgent.has(agentId)) instalmentsByAgent.set(agentId, []);
    instalmentsByAgent.get(agentId)!.push(instalment);
  }

  for (const routeAgent of agentRoutes) {
    if (!routeAgent.agentId) continue;
    if (!routesByAgent.has(routeAgent.agentId)) routesByAgent.set(routeAgent.agentId, []);
    routesByAgent.get(routeAgent.agentId)!.push(routeAgent.route.name);
  }

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

  return {
    collectionEfficiency: { expected: totalExpected, collected: totalCollected, efficiency },
    agingBuckets,
    penaltyReport,
    disbursement,
    agentPerformance,
    agents,
  };
}
