import prisma from '@/lib/db';
import { getAgentBalance } from '@/lib/wallet';
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
