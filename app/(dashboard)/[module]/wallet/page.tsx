import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import { getBranchAccounts } from '@/lib/wallet';
import { modulePath } from '@/types/modules';
import WalletClient from './WalletClient';

export default async function WalletPage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const { module } = await params;
  const appType = await getUserAppType();
  if (role === 'agent') redirect(modulePath(module, '/collection'));

  const tenantId = await getDefaultTenantId();
  const branchId = await getActiveBranchId();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
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

  return (
    <WalletClient pools={pools} agents={agentRows} currencySymbol={currencySymbol} />
  );
}
