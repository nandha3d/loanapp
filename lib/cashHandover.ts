import prisma from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import {
  CashSettlementError,
  collectCashHandover as settleHandover,
  collectFromAgentDirect,
  handoverScopeWhere,
  rejectCashHandover as rejectHandover,
  requestCashHandover as requestHandover,
} from '@/lib/cashSettlement';

/**
 * Wallet handover entry points used by the web wallet actions and the v1 wallet
 * routes (MON-01, WAL-01). The money rules live in ONE place —
 * lib/cashSettlement.ts (STRUCT-3, MON-02): float → branch pool, the agent's
 * pending cash collections verified oldest-first, GL after commit.
 */

/** Carries the HTTP status the v1 route should answer with (API-4: 409 for money conflicts). */
export { CashSettlementError as HandoverRequestError };

export type HandoverActor = { tenantId: string; appType: string; userId: string; branchId: string | null };

/** Agent asks to hand field cash to the office — pending until an admin collects it. */
export function requestCashHandover(
  agent: { tenantId: string; appType: string; userId: string },
  input: { amount: number; note?: string | null },
) {
  return requestHandover(agent, input);
}

/** Admin collects a pending handover. */
export async function collectCashHandover(actor: HandoverActor, handoverId: string) {
  const { handover } = await settleHandover(actor, handoverId);
  await writeAudit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    action: 'wallet_handover_collect',
    entityType: 'cash_handover',
    entityId: handover.id,
    newValue: { amount: Number(handover.amount) },
  });
}

/** Admin rejects a pending handover (no cash movement). */
export function rejectCashHandover(actor: HandoverActor, handoverId: string) {
  return rejectHandover(actor, handoverId);
}

/** Admin collects cash from an agent in person (no prior request). */
export async function collectCashFromAgent(
  actor: HandoverActor,
  input: { agentId: string; amount: number; note?: string | null },
) {
  const amount = Number(input.amount);
  if (!input.agentId || !(amount > 0)) throw new CashSettlementError('agentId and a positive amount are required', 400);
  await collectFromAgentDirect(actor, { agentId: input.agentId, amount, note: input.note ?? null });
  await writeAudit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    action: 'wallet_collect',
    entityType: 'agent_account',
    entityId: input.agentId,
    newValue: { amount },
  });
}

/** Handovers for the wallet screens — staff see their scope, an agent only their own. */
export async function listCashHandovers(
  actor: HandoverActor & { role: string },
  input: { status?: string | null; limit?: number } = {},
) {
  return prisma.cashHandover.findMany({
    where: {
      ...(actor.role === 'agent'
        ? { tenantId: actor.tenantId, appType: actor.appType, agentId: actor.userId }
        : handoverScopeWhere(actor)),
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: { requestedAt: 'desc' },
    take: Math.min(Math.max(1, input.limit ?? 50), 200),
    include: { agent: { select: { name: true, phone: true } } },
  });
}
