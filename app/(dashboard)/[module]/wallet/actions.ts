'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { releaseToAgent, injectBranchCash } from '@/lib/wallet';
import { writeAudit } from '@/lib/audit';
import { modulePath } from '@/types/modules';

async function requirePrivileged() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId || !['admin', 'superadmin', 'developer'].includes(role)) {
    throw new Error('Forbidden');
  }
  const tenantId = await getDefaultTenantId();
  return { role, userId, tenantId };
}

export async function releaseFundsAction(formData: FormData) {
  const { userId, tenantId } = await requirePrivileged();
  const agentId = String(formData.get('agentId') || '');
  const amount = Number(formData.get('amount'));
  const note = (String(formData.get('note') || '') || null) as string | null;
  if (!agentId || !(amount > 0)) throw new Error('agentId and a positive amount are required');

  const agent = await prisma.user.findFirst({
    where: { id: agentId, tenantId, role: 'agent' },
    select: { id: true, branchId: true },
  });
  if (!agent) throw new Error('Agent not found');

  await releaseToAgent({
    tenantId,
    agentId,
    branchId: agent.branchId,
    amount,
    byUserId: userId,
    note,
  });
  await writeAudit({
    tenantId,
    userId,
    action: 'wallet_release',
    entityType: 'agent_account',
    entityId: agentId,
    newValue: { amount },
  });

  const appType = await getUserAppType();
  revalidatePath(modulePath(appType, '/wallet'));
}

export async function injectBranchAction(formData: FormData) {
  const { userId, tenantId } = await requirePrivileged();
  const branchId = String(formData.get('branchId') || '');
  const amount = Number(formData.get('amount'));
  const note = (String(formData.get('note') || '') || null) as string | null;
  if (!branchId || !(amount > 0)) throw new Error('branchId and a positive amount are required');

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId },
    select: { id: true },
  });
  if (!branch) throw new Error('Branch not found');

  await injectBranchCash({ tenantId, branchId, amount, byUserId: userId, note });
  await writeAudit({
    tenantId,
    userId,
    action: 'wallet_inject',
    entityType: 'branch_cash_account',
    entityId: branchId,
    newValue: { amount },
  });

  const appType = await getUserAppType();
  revalidatePath(modulePath(appType, '/wallet'));
}
