'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { releaseToAgent, injectBranchCash, collectFromAgent, getAgentBalance } from '@/lib/wallet';
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
  const appType = await getUserAppType();
  return { role, userId, tenantId, appType };
}

async function requireAgent() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId || role !== 'agent') throw new Error('Forbidden');
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  return { userId, tenantId, appType };
}

export async function releaseFundsAction(formData: FormData) {
  const { userId, tenantId, appType } = await requirePrivileged();
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
    appType,
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

  revalidatePath(modulePath(appType, '/wallet'));
}

export async function injectBranchAction(formData: FormData) {
  const { userId, tenantId, appType } = await requirePrivileged();
  const branchId = String(formData.get('branchId') || '');
  const amount = Number(formData.get('amount'));
  const note = (String(formData.get('note') || '') || null) as string | null;
  if (!branchId || !(amount > 0)) throw new Error('branchId and a positive amount are required');

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId },
    select: { id: true },
  });
  if (!branch) throw new Error('Branch not found');

  await injectBranchCash({ tenantId, appType, branchId, amount, byUserId: userId, note });
  await writeAudit({
    tenantId,
    userId,
    action: 'wallet_inject',
    entityType: 'branch_cash_account',
    entityId: branchId,
    newValue: { amount },
  });

  revalidatePath(modulePath(appType, '/wallet'));
}

// ── Two-sided cash handover (agent ⇄ admin) ─────────────────────────────────

/** Agent requests to hand over field cash. Creates a pending CashHandover; no
 *  float movement yet — the admin settles it on collect. */
export async function requestFloatHandoverAction(formData: FormData) {
  const { userId, tenantId, appType } = await requireAgent();
  const amount = Number(formData.get('amount'));
  const remarks = (String(formData.get('note') || '') || null) as string | null;
  if (!(amount > 0)) throw new Error('A positive amount is required');

  const balance = await getAgentBalance(tenantId, appType, userId);
  if (amount > balance) throw new Error('Amount exceeds your float balance');

  // Avoid stacking duplicate pending requests.
  const pending = await prisma.cashHandover.count({ where: { tenantId, agentId: userId, status: 'pending' } });
  if (pending >= 5) throw new Error('You already have pending handover requests awaiting collection');

  await prisma.cashHandover.create({
    data: { tenantId, agentId: userId, amount, status: 'pending', remarks },
  });

  const agent = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, branchId: true } });
  const { notifyApprovers } = await import('@/lib/notify/approvers');
  await notifyApprovers({
    tenantId,
    branchId: agent?.branchId ?? null,
    appType,
    type: 'cash_handover',
    icon: 'payments',
    title: 'Cash handover to collect',
    message: `${agent?.name ?? 'An agent'} is handing over ₹${amount.toLocaleString('en-IN')}.`,
    link: modulePath(appType, '/wallet'),
  });
  revalidatePath(modulePath(appType, '/wallet'));
}

/** Admin collects/settles a pending handover: debits the agent float, credits
 *  the branch pool, marks the handover confirmed. */
export async function collectHandoverAction(formData: FormData) {
  const { userId, tenantId, appType } = await requirePrivileged();
  const handoverId = String(formData.get('handoverId') || '');
  if (!handoverId) throw new Error('handoverId is required');

  const ho = await prisma.cashHandover.findFirst({
    where: { id: handoverId, tenantId, status: 'pending' },
    include: { agent: { select: { id: true, branchId: true } } },
  });
  if (!ho) throw new Error('Handover not found or already settled');

  await collectFromAgent({
    tenantId,
    appType,
    agentId: ho.agentId,
    branchId: ho.agent.branchId,
    amount: Number(ho.amount),
    byUserId: userId,
    note: ho.remarks || 'Cash handover',
  });
  await prisma.cashHandover.update({
    where: { id: ho.id },
    data: { status: 'confirmed', adminId: userId, collectedAt: new Date(), confirmedAt: new Date() },
  });
  await writeAudit({
    tenantId,
    userId,
    action: 'wallet_handover_collect',
    entityType: 'cash_handover',
    entityId: ho.id,
    newValue: { amount: Number(ho.amount) },
  });

  revalidatePath(modulePath(appType, '/wallet'));
}

/** Admin rejects a pending handover request (no cash movement). */
export async function rejectHandoverAction(formData: FormData) {
  const { userId, tenantId, appType } = await requirePrivileged();
  const handoverId = String(formData.get('handoverId') || '');
  if (!handoverId) throw new Error('handoverId is required');

  const updated = await prisma.cashHandover.updateMany({
    where: { id: handoverId, tenantId, status: 'pending' },
    data: { status: 'rejected', adminId: userId, confirmedAt: new Date() },
  });
  if (updated.count === 0) throw new Error('Handover not found or already settled');

  revalidatePath(modulePath(appType, '/wallet'));
}

/** Admin-initiated direct collection from an agent (no prior request), e.g. the
 *  agent hands cash over in person. Settles immediately and records it. */
export async function collectFromAgentAction(formData: FormData) {
  const { userId, tenantId, appType } = await requirePrivileged();
  const agentId = String(formData.get('agentId') || '');
  const amount = Number(formData.get('amount'));
  const note = (String(formData.get('note') || '') || null) as string | null;
  if (!agentId || !(amount > 0)) throw new Error('agentId and a positive amount are required');

  const agent = await prisma.user.findFirst({
    where: { id: agentId, tenantId, role: 'agent' },
    select: { id: true, branchId: true },
  });
  if (!agent) throw new Error('Agent not found');

  await collectFromAgent({ tenantId, appType, agentId, branchId: agent.branchId, amount, byUserId: userId, note });
  await prisma.cashHandover.create({
    data: {
      tenantId,
      agentId,
      adminId: userId,
      amount,
      status: 'confirmed',
      collectedAt: new Date(),
      confirmedAt: new Date(),
      remarks: note,
    },
  });
  await writeAudit({
    tenantId,
    userId,
    action: 'wallet_collect',
    entityType: 'agent_account',
    entityId: agentId,
    newValue: { amount },
  });

  revalidatePath(modulePath(appType, '/wallet'));
}
