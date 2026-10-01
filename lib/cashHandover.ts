import prisma from '@/lib/db';
import { collectFromAgent, getAgentBalance } from '@/lib/wallet';
import { writeAudit } from '@/lib/audit';
import { modulePath } from '@/types/modules';

/** Carries the HTTP status the v1 route should answer with (API-4: 409 for money conflicts). */
export class HandoverRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'HandoverRequestError';
  }
}

const MAX_PENDING_HANDOVERS = 5;

/**
 * Agent asks to hand field cash to the office (MON-01). Creates a PENDING
 * CashHandover only — no float moves until an admin collects it from the
 * wallet screen. Shared by the web action and POST /api/v1/wallet/deposit so
 * both clients record the same thing.
 */
export async function requestCashHandover(
  agent: { tenantId: string; appType: string; userId: string },
  input: { amount: number; note?: string | null },
) {
  const amount = Number(input.amount);
  if (!(amount > 0)) throw new HandoverRequestError('A positive amount is required', 400);

  const balance = await getAgentBalance(agent.tenantId, agent.appType, agent.userId);
  if (amount > balance) throw new HandoverRequestError('Amount exceeds your float balance', 409);

  // Avoid stacking duplicate pending requests.
  const pending = await prisma.cashHandover.count({
    where: { tenantId: agent.tenantId, agentId: agent.userId, status: 'pending' },
  });
  if (pending >= MAX_PENDING_HANDOVERS) {
    throw new HandoverRequestError('You already have pending handover requests awaiting collection', 409);
  }

  const handover = await prisma.cashHandover.create({
    data: { tenantId: agent.tenantId, agentId: agent.userId, amount, status: 'pending', remarks: input.note ?? null },
  });

  const user = await prisma.user.findUnique({ where: { id: agent.userId }, select: { name: true, branchId: true } });
  const { notifyApprovers } = await import('@/lib/notify/approvers');
  await notifyApprovers({
    tenantId: agent.tenantId,
    branchId: user?.branchId ?? null,
    appType: agent.appType,
    type: 'cash_handover',
    icon: 'payments',
    title: 'Cash handover to collect',
    message: `${user?.name ?? 'An agent'} is handing over ₹${amount.toLocaleString('en-IN')}.`,
    link: modulePath(agent.appType, '/wallet'),
  });

  return handover;
}

export type HandoverActor = { tenantId: string; appType: string; userId: string; branchId: string | null };

function pendingHandoverWhere(actor: HandoverActor, handoverId: string) {
  return {
    id: handoverId,
    tenantId: actor.tenantId,
    status: 'pending',
    agent: { appType: actor.appType, ...(actor.branchId ? { branchId: actor.branchId } : {}) },
  };
}

/**
 * WAL-01: admin collects a pending handover — agent float down, branch pool up,
 * handover confirmed. Shared by the web wallet action and the v1 route.
 */
export async function collectCashHandover(actor: HandoverActor, handoverId: string) {
  const ho = await prisma.cashHandover.findFirst({
    where: pendingHandoverWhere(actor, handoverId),
    include: { agent: { select: { id: true, branchId: true } } },
  });
  if (!ho) throw new HandoverRequestError('Handover not found or already settled', 404);

  await collectFromAgent({
    tenantId: actor.tenantId,
    appType: actor.appType,
    agentId: ho.agentId,
    branchId: ho.agent.branchId,
    amount: Number(ho.amount),
    byUserId: actor.userId,
    note: ho.remarks || 'Cash handover',
  });
  await prisma.cashHandover.update({
    where: { id: ho.id },
    data: { status: 'confirmed', adminId: actor.userId, collectedAt: new Date(), confirmedAt: new Date() },
  });
  await writeAudit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    action: 'wallet_handover_collect',
    entityType: 'cash_handover',
    entityId: ho.id,
    newValue: { amount: Number(ho.amount) },
  });
}

/** WAL-01: admin rejects a pending handover (no cash movement). */
export async function rejectCashHandover(actor: HandoverActor, handoverId: string) {
  const ho = await prisma.cashHandover.findFirst({ where: pendingHandoverWhere(actor, handoverId), select: { id: true } });
  if (!ho) throw new HandoverRequestError('Handover not found or already settled', 404);
  const updated = await prisma.cashHandover.updateMany({
    where: { id: ho.id, tenantId: actor.tenantId, status: 'pending' },
    data: { status: 'rejected', adminId: actor.userId, confirmedAt: new Date() },
  });
  if (updated.count === 0) throw new HandoverRequestError('Handover not found or already settled', 409);
}

/** WAL-01: admin collects cash from an agent in person (no prior request). */
export async function collectCashFromAgent(
  actor: HandoverActor,
  input: { agentId: string; amount: number; note?: string | null },
) {
  const amount = Number(input.amount);
  if (!input.agentId || !(amount > 0)) throw new HandoverRequestError('agentId and a positive amount are required', 400);
  const agent = await prisma.user.findFirst({
    where: {
      id: input.agentId,
      tenantId: actor.tenantId,
      role: 'agent',
      status: 'active',
      appType: actor.appType,
      ...(actor.branchId ? { branchId: actor.branchId } : {}),
    },
    select: { id: true, branchId: true },
  });
  if (!agent) throw new HandoverRequestError('Agent not found', 404);

  const note = input.note ?? null;
  await collectFromAgent({ tenantId: actor.tenantId, appType: actor.appType, agentId: agent.id, branchId: agent.branchId, amount, byUserId: actor.userId, note });
  await prisma.cashHandover.create({
    data: {
      tenantId: actor.tenantId,
      agentId: agent.id,
      adminId: actor.userId,
      amount,
      status: 'confirmed',
      collectedAt: new Date(),
      confirmedAt: new Date(),
      remarks: note,
    },
  });
  await writeAudit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    action: 'wallet_collect',
    entityType: 'agent_account',
    entityId: agent.id,
    newValue: { amount },
  });
}

/**
 * WAL-01: handovers for the wallet screens — staff see their scope's agents,
 * an agent sees only their own history.
 */
export async function listCashHandovers(
  actor: HandoverActor & { role: string },
  input: { status?: string | null; limit?: number } = {},
) {
  return prisma.cashHandover.findMany({
    where: {
      tenantId: actor.tenantId,
      ...(input.status ? { status: input.status } : {}),
      ...(actor.role === 'agent'
        ? { agentId: actor.userId }
        : { agent: { appType: actor.appType, ...(actor.branchId ? { branchId: actor.branchId } : {}) } }),
    },
    orderBy: { requestedAt: 'desc' },
    take: Math.min(Math.max(1, input.limit ?? 50), 200),
    include: { agent: { select: { name: true, phone: true } } },
  });
}
