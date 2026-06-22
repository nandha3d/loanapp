import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import { getBranchAccounts, getAgentBalance, getAgentStatement } from '@/lib/wallet';
import WalletClient from './WalletClient';
import AgentWalletClient from './AgentWalletClient';

export default async function WalletPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id as string | undefined;

  const tenantId = await getDefaultTenantId();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');

  // Agents see their OWN cash float (cash held in the field) + ledger — not the
  // branch/oversight view. Cash handover stays on the collection page.
  if (role === 'agent' && userId) {
    const [balance, txns] = await Promise.all([
      getAgentBalance(tenantId, userId),
      getAgentStatement(tenantId, userId, 50),
    ]);
    const transactions = txns.map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      balanceAfter: Number(t.balanceAfter),
      note: t.note ?? null,
      refType: t.refType ?? null,
      createdAt: t.createdAt.toISOString(),
    }));
    return (
      <AgentWalletClient
        agentName={(session?.user as any)?.name || 'Agent'}
        balance={balance}
        transactions={transactions}
        currencySymbol={currencySymbol}
      />
    );
  }

  const branchId = await getActiveBranchId();
  const seesAll = role === 'superadmin' || role === 'developer';
  const branchScope = branchId && !seesAll ? branchId : null;

  // Branch cash pools (scoped) + balances.
  const branches = await prisma.branch.findMany({
    where: { tenantId, ...(branchScope ? { id: branchScope } : {}) },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const branchAccounts = await getBranchAccounts(tenantId, branches.map((b) => b.id));
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
      accountKind: 'branch',
      type: 'release',
      ...(branchScope ? { branchId: branchScope } : {}),
    },
    _sum: { amount: true },
  });
  const releasedToAgents = Math.abs(Number(releaseAgg._sum.amount ?? 0));

  // Agents (scoped) + float balances.
  const agents = await prisma.user.findMany({
    where: { tenantId, role: 'agent', status: 'active', ...(branchScope ? { branchId: branchScope } : {}) },
    select: { id: true, name: true, phone: true },
    orderBy: { name: 'asc' },
  });
  const accts = await prisma.agentAccount.findMany({
    where: { tenantId, agentId: { in: agents.map((a) => a.id) } },
    select: { agentId: true, balance: true },
  });
  const balByAgent = new Map(accts.map((a) => [a.agentId, Number(a.balance)]));
  const agentRows = agents.map((a) => ({
    agentId: a.id,
    name: a.name,
    phone: a.phone,
    balance: balByAgent.get(a.id) ?? 0,
  }));
  const totalFloat = agentRows.reduce((sum, agent) => sum + agent.balance, 0);

  return (
    <WalletClient
      pools={pools}
      agents={agentRows}
      currencySymbol={currencySymbol}
      summary={{
        accountingCapital: accountingCapitalIn - accountingCapitalOut,
        releasedToAgents,
        branchCashAvailable: totalPool,
        agentFloat: totalFloat,
      }}
    />
  );
}
