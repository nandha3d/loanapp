import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { collectFromAgentInTx, getAgentBalance } from '@/lib/wallet';

type Tx = Prisma.TransactionClient;

/**
 * Agent cash settlement — the ONE way field cash reaches the office (STRUCT-3).
 *
 * Every button that records an agent handing cash to an admin (Wallet →
 * collect handover, Wallet → collect from agent, Collection → collect cash,
 * approval of a cash-handover request, route-run reconciliation by an admin)
 * calls `settleAgentCashInTx`. Before this, each wrote a different subset of
 * float / cash book / GL, so the same rupee was recorded differently depending
 * on which button was pressed.
 *
 *  1. Agent float −amount, branch pool +amount (hard-blocked on held float).
 *  2. The agent's pending CASH collections are verified oldest-first while the
 *     amount fully covers them. Each verified entry gets its cash-book
 *     `collection` row, stamped with the loan's module and branch (SCOPE-7).
 *  3. Whatever is left over is unused float coming back — a cash↔cash transfer
 *     with no cash-book or GL effect (same as release-to-agent).
 *
 * The GL for each verified entry is posted by the caller after commit through
 * `postSettledCollections` (ACC-7: GL failure never rolls back the money).
 */

export class CashSettlementError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'CashSettlementError';
  }
}

export type SettlementActor = {
  tenantId: string;
  appType: string;
  userId: string;
  /** Caller's ACTIVE branch; null = All Branches. The agent must be in it. */
  branchId: string | null;
};

export type SettledEntry = {
  entryId: string;
  loanId: string;
  loanCode: string;
  amount: number;
  branchId: string | null;
  appType: string;
};

export type SettlementResult = {
  branchId: string;
  agentBalance: number;
  branchBalance: number;
  verified: SettledEntry[];
  collectionTotal: number;
  floatReturned: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/** The agent row an actor may settle with: same tenant, module and branch scope. */
export async function findSettleableAgent(db: Tx | typeof prisma, actor: SettlementActor, agentId: string) {
  return db.user.findFirst({
    where: {
      id: agentId,
      tenantId: actor.tenantId,
      appType: actor.appType,
      role: 'agent',
      ...(actor.branchId ? { branchId: actor.branchId } : {}),
    },
    select: { id: true, name: true, branchId: true },
  });
}

/**
 * Pure selection rule, exported for tests: verify pending entries oldest-first
 * while the settled amount fully covers each one; stop at the first that does
 * not fit so collections are always cleared in the order they were taken.
 */
export function selectEntriesToVerify<T extends { receivedAmount: unknown }>(entries: T[], amount: number): T[] {
  const picked: T[] = [];
  let remaining = round2(amount);
  for (const entry of entries) {
    const value = round2(Number(entry.receivedAmount));
    if (value > remaining) break;
    picked.push(entry);
    remaining = round2(remaining - value);
  }
  return picked;
}

export async function settleAgentCashInTx(
  tx: Tx,
  actor: SettlementActor,
  input: { agentId: string; amount: number; note?: string | null; routeId?: string | null },
): Promise<SettlementResult> {
  const amount = round2(Number(input.amount));
  if (!(amount > 0)) throw new CashSettlementError('A positive amount is required', 400);

  const agent = await findSettleableAgent(tx, actor, input.agentId);
  if (!agent) throw new CashSettlementError('Agent not found', 404);
  if (!agent.branchId) {
    throw new CashSettlementError('This agent has no branch. Assign the agent to a branch before collecting cash.', 409);
  }

  const moved = await collectFromAgentInTx(tx, {
    tenantId: actor.tenantId,
    appType: actor.appType,
    agentId: agent.id,
    branchId: agent.branchId,
    amount,
    byUserId: actor.userId,
    note: input.note ?? 'Cash handover',
  });

  const pending = await tx.collectionEntry.findMany({
    where: {
      tenantId: actor.tenantId,
      agentId: agent.id,
      paymentMode: 'cash',
      verificationStatus: 'pending',
      loan: { tenantId: actor.tenantId, appType: actor.appType },
      ...(input.routeId ? { customer: { routeId: input.routeId } } : {}),
    },
    orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      receivedAmount: true,
      loanId: true,
      loan: { select: { loanCode: true, branchId: true, appType: true } },
    },
  });

  const verified: SettledEntry[] = [];
  for (const entry of selectEntriesToVerify(pending, amount)) {
    // Claim the entry atomically so a concurrent settlement cannot verify —
    // and write the cash book for — the same collection twice (DB-9).
    const claimed = await tx.collectionEntry.updateMany({
      where: { id: entry.id, tenantId: actor.tenantId, verificationStatus: 'pending' },
      data: { verificationStatus: 'verified' },
    });
    if (claimed.count !== 1) continue;
    const value = round2(Number(entry.receivedAmount));
    await tx.accountEntry.create({
      data: {
        tenantId: actor.tenantId,
        appType: entry.loan.appType,
        branchId: entry.loan.branchId,
        entryDate: new Date(),
        type: 'collection',
        category: 'cash',
        amount: value,
        description: `Cash collection for loan ${entry.loan.loanCode}`,
        referenceId: entry.id,
        referenceType: 'payment',
        createdBy: actor.userId,
      },
    });
    verified.push({
      entryId: entry.id,
      loanId: entry.loanId,
      loanCode: entry.loan.loanCode,
      amount: value,
      branchId: entry.loan.branchId,
      appType: entry.loan.appType,
    });
  }

  const collectionTotal = round2(verified.reduce((sum, row) => sum + row.amount, 0));
  return {
    branchId: agent.branchId,
    agentBalance: moved.agentBalance,
    branchBalance: moved.branchBalance,
    verified,
    collectionTotal,
    floatReturned: round2(amount - collectionTotal),
  };
}

/** GL for every collection a settlement verified. Idempotent per entry (DB-10). */
export async function postSettledCollections(actor: SettlementActor, result: SettlementResult) {
  if (result.verified.length === 0) return;
  const { autoPostCollectionEntry } = await import('@/lib/accounting/autoPost');
  await Promise.all(
    result.verified.map((row) =>
      autoPostCollectionEntry({ tenantId: actor.tenantId, entryId: row.entryId, createdById: actor.userId }),
    ),
  );
}

/** Admin collects cash directly from an agent (no prior request). */
export async function collectFromAgentDirect(
  actor: SettlementActor,
  input: { agentId: string; amount: number; note?: string | null; routeId?: string | null },
) {
  const result = await prisma.$transaction(async (tx) => {
    const settled = await settleAgentCashInTx(tx, actor, input);
    await tx.cashHandover.create({
      data: {
        tenantId: actor.tenantId,
        appType: actor.appType,
        branchId: settled.branchId,
        agentId: input.agentId,
        adminId: actor.userId,
        routeId: input.routeId ?? null,
        amount: Number(input.amount),
        status: 'confirmed',
        collectedAt: new Date(),
        confirmedAt: new Date(),
        remarks: input.note ?? null,
      },
    });
    return settled;
  });
  await postSettledCollections(actor, result);
  return result;
}

/** Scope for handover rows the actor may see or act on. */
export function handoverScopeWhere(actor: SettlementActor): Prisma.CashHandoverWhereInput {
  return {
    tenantId: actor.tenantId,
    appType: actor.appType,
    ...(actor.branchId ? { branchId: actor.branchId } : {}),
  };
}

/** Admin settles a pending handover request. The claim and the money move commit together. */
export async function collectCashHandover(actor: SettlementActor, handoverId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const handover = await tx.cashHandover.findFirst({
      where: { id: handoverId, status: 'pending', ...handoverScopeWhere(actor) },
    });
    if (!handover) throw new CashSettlementError('Handover not found or already settled', 404);
    const claimed = await tx.cashHandover.updateMany({
      where: { id: handover.id, status: 'pending' },
      data: { status: 'confirmed', adminId: actor.userId, collectedAt: new Date(), confirmedAt: new Date() },
    });
    if (claimed.count !== 1) throw new CashSettlementError('Handover not found or already settled', 404);
    const settled = await settleAgentCashInTx(tx, actor, {
      agentId: handover.agentId,
      amount: Number(handover.amount),
      note: handover.remarks || 'Cash handover',
      routeId: handover.routeId,
    });
    return { handover, settled };
  });
  await postSettledCollections(actor, result.settled);
  return result;
}

export async function rejectCashHandover(actor: SettlementActor, handoverId: string) {
  const updated = await prisma.cashHandover.updateMany({
    where: { id: handoverId, status: 'pending', ...handoverScopeWhere(actor) },
    data: { status: 'rejected', adminId: actor.userId, confirmedAt: new Date() },
  });
  if (updated.count === 0) throw new CashSettlementError('Handover not found or already settled', 404);
}

/** Pending requests an agent may have open at once (read from settings, never hardcoded at call sites). */
export async function getMaxPendingHandovers(tenantId: string): Promise<number> {
  const { getSetting } = await import('@/lib/tenant');
  const raw = Number(await getSetting(tenantId, 'max_pending_handovers', '5'));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 5;
}

/**
 * Agent asks to hand cash to the office. Nothing moves until an admin collects
 * it: an agent can never verify their own collections (Q7, 2026-09-30).
 */
export async function requestCashHandover(
  agent: { tenantId: string; appType: string; userId: string },
  input: { amount: number; note?: string | null; routeId?: string | null },
) {
  const amount = round2(Number(input.amount));
  if (!(amount > 0)) throw new CashSettlementError('A positive amount is required', 400);
  const user = await prisma.user.findFirst({
    where: { id: agent.userId, tenantId: agent.tenantId, role: 'agent' },
    select: { name: true, branchId: true },
  });
  if (!user) throw new CashSettlementError('Agent not found', 404);
  if (!user.branchId) throw new CashSettlementError('No branch assigned to hand cash to', 409);

  const balance = await getAgentBalance(agent.tenantId, agent.appType, agent.userId);
  if (amount > balance) throw new CashSettlementError('Amount exceeds your float balance', 409);

  const pending = await prisma.cashHandover.count({
    where: { tenantId: agent.tenantId, appType: agent.appType, agentId: agent.userId, status: 'pending' },
  });
  if (pending >= await getMaxPendingHandovers(agent.tenantId)) {
    throw new CashSettlementError('You already have pending handover requests awaiting collection', 409);
  }

  const handover = await prisma.cashHandover.create({
    data: {
      tenantId: agent.tenantId,
      appType: agent.appType,
      branchId: user.branchId,
      agentId: agent.userId,
      routeId: input.routeId ?? null,
      amount,
      status: 'pending',
      remarks: input.note ?? null,
    },
  });

  // NOTIF-9 / X-19: notify after the write, never inside a money transaction,
  // and never let a notification failure fail the request.
  try {
    const [{ notifyApprovers }, { modulePath }] = await Promise.all([
      import('@/lib/notify/approvers'),
      import('@/types/modules'),
    ]);
    await notifyApprovers({
      tenantId: agent.tenantId,
      branchId: user.branchId,
      appType: agent.appType,
      type: 'cash_handover',
      icon: 'payments',
      title: 'Cash handover to collect',
      message: `${user.name ?? 'An agent'} is handing over ₹${amount.toLocaleString('en-IN')}.`,
      link: modulePath(agent.appType, '/wallet'),
    });
  } catch (error) {
    console.error('[cashSettlement] handover notification failed:', error);
  }

  return handover;
}
