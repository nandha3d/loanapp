import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import { getAgentBalance, getAgentStatement } from '@/lib/wallet';
import { getWalletSummary } from '@/lib/walletSummary';
import WalletClient from './WalletClient';
import AgentWalletClient from './AgentWalletClient';
import { notFound } from 'next/navigation';

export default async function WalletPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id as string | undefined;

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  if (appType === 'chitfunds') notFound();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');

  // Agents see their OWN cash float (cash held in the field) + ledger — not the
  // branch/oversight view. Cash handover stays on the collection page.
  if (role === 'agent' && userId) {
    const [balance, txns, handoversRaw] = await Promise.all([
      getAgentBalance(tenantId, appType, userId),
      getAgentStatement(tenantId, appType, userId, 50),
      prisma.cashHandover.findMany({
        where: { tenantId, agentId: userId },
        orderBy: { requestedAt: 'desc' },
        take: 20,
      }),
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
    const handovers = handoversRaw.map((h) => ({
      id: h.id,
      amount: Number(h.amount),
      status: h.status,
      requestedAt: h.requestedAt.toISOString(),
      confirmedAt: h.confirmedAt ? h.confirmedAt.toISOString() : null,
      remarks: h.remarks ?? null,
    }));
    return (
      <AgentWalletClient
        agentName={(session?.user as any)?.name || 'Agent'}
        balance={balance}
        transactions={transactions}
        handovers={handovers}
        currencySymbol={currencySymbol}
      />
    );
  }

  const branchId = await getActiveBranchId();
  // No role exemption: getActiveBranchId() already returns null for "All
  // Branches" and the selected branch otherwise. Exempting superadmins here
  // made the branch switcher inert on this page — Erode showed Head Office's
  // pools, agents and float, while Settings > Agents (correctly scoped) showed
  // none. See scopedBranchWhere in lib/api/v1-auth.ts for the same bug.
  const branchScope = branchId;

  // WAL-01: same figures as GET /api/v1/wallet/summary (lib/walletSummary.ts).
  const { pools, agents: agentRows, pendingHandovers, summary } = await getWalletSummary(tenantId, appType, branchScope);

  return (
    <WalletClient
      pools={pools}
      agents={agentRows}
      pendingHandovers={pendingHandovers}
      currencySymbol={currencySymbol}
      appType={appType}
      summary={summary}
    />
  );
}
