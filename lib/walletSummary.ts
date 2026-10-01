import prisma from '@/lib/db';
import { getBranchAccounts } from '@/lib/wallet';

/**
 * WAL-01: the staff wallet overview — branch pools, agent floats, pending
 * handovers and the four KPI figures. Moved from the web wallet page so the
 * page and GET /api/v1/wallet/summary return the same numbers (API-8).
 * `branchScope` = active branch, or null for All Branches (SCOPE-3).
 */
export async function getWalletSummary(tenantId: string, appType: string, branchScope: string | null) {
  const branches = await prisma.branch.findMany({
    where: { tenantId, ...(branchScope ? { id: branchScope } : {}) },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const branchAccounts = await getBranchAccounts(tenantId, appType, branches.map((b) => b.id));
  const balByBranch = new Map(branchAccounts.map((a) => [a.branchId, Number(a.balance)]));
  const pools = branches.map((b) => ({
    branchId: b.id,
    branchName: b.name,
    balance: balByBranch.get(b.id) ?? 0,
  }));
  const totalPool = pools.reduce((sum, pool) => sum + pool.balance, 0);
  const capitalRows = await prisma.accountEntry.groupBy({
    by: ['type'],
    where: {
      tenantId,
      appType,
      category: 'cash',
      type: { in: ['capital_add', 'capital_withdraw'] },
      ...(branchScope ? { branchId: branchScope } : {}),
    },
    _sum: { amount: true },
  });
  const accountingCapitalIn = Number(capitalRows.find((row) => row.type === 'capital_add')?._sum.amount ?? 0);
  const accountingCapitalOut = Number(capitalRows.find((row) => row.type === 'capital_withdraw')?._sum.amount ?? 0);
  const releaseAgg = await prisma.walletTransaction.aggregate({
    where: {
      tenantId,
      appType,
      accountKind: 'branch',
      type: 'release',
      ...(branchScope ? { branchId: branchScope } : {}),
    },
    _sum: { amount: true },
  });
  const releasedToAgents = Math.abs(Number(releaseAgg._sum.amount ?? 0));

  const agents = await prisma.user.findMany({
    where: { tenantId, appType, role: 'agent', status: 'active', ...(branchScope ? { branchId: branchScope } : {}) },
    select: { id: true, name: true, phone: true, branchId: true },
    orderBy: { name: 'asc' },
  });
  const accts = await prisma.agentAccount.findMany({
    where: { tenantId, appType, agentId: { in: agents.map((a) => a.id) } },
    select: { agentId: true, balance: true },
  });
  const balByAgent = new Map(accts.map((a) => [a.agentId, Number(a.balance)]));
  const agentRows = agents.map((a) => ({
    agentId: a.id,
    name: a.name,
    phone: a.phone,
    branchId: a.branchId,
    balance: balByAgent.get(a.id) ?? 0,
  }));
  const totalFloat = agentRows.reduce((sum, agent) => sum + agent.balance, 0);

  const pendingHandoversRaw = await prisma.cashHandover.findMany({
    where: {
      tenantId,
      status: 'pending',
      agent: {
        appType,
        ...(branchScope ? { branchId: branchScope } : {}),
      },
    },
    orderBy: { requestedAt: 'asc' },
    include: { agent: { select: { name: true } } },
  });
  const pendingHandovers = pendingHandoversRaw.map((h) => ({
    id: h.id,
    agentName: h.agent?.name || 'Agent',
    amount: Number(h.amount),
    requestedAt: h.requestedAt.toISOString(),
    remarks: h.remarks ?? null,
  }));

  return {
    pools,
    agents: agentRows,
    pendingHandovers,
    summary: {
      accountingCapital: accountingCapitalIn - accountingCapitalOut,
      releasedToAgents,
      branchCashAvailable: totalPool,
      agentFloat: totalFloat,
    },
  };
}
