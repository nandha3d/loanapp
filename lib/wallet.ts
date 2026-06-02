import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';

type Tx = Prisma.TransactionClient;

export class InsufficientFloatError extends Error {
  constructor(public available: number, public required: number) {
    super('insufficient_float');
    this.name = 'InsufficientFloatError';
  }
}

type LedgerMeta = {
  type: 'release' | 'disburse' | 'collection' | 'inject' | 'adjustment';
  refType?: string | null;
  refId?: string | null;
  note?: string | null;
  byUserId?: string | null;
};

/**
 * Applies a signed delta to an agent account inside a transaction and writes a
 * ledger row. `hardBlock` throws InsufficientFloatError if the result is
 * negative (used for disbursement — an agent can't pay out cash they don't
 * hold).
 */
async function applyAgent(
  tx: Tx,
  tenantId: string,
  agentId: string,
  delta: number,
  meta: LedgerMeta,
  hardBlock = false,
): Promise<number> {
  const acct = await tx.agentAccount.upsert({
    where: { tenantId_agentId: { tenantId, agentId } },
    create: { tenantId, agentId, balance: 0 },
    update: {},
  });
  const next = Number(acct.balance) + delta;
  if (hardBlock && next < 0) {
    throw new InsufficientFloatError(Number(acct.balance), -delta);
  }
  await tx.agentAccount.update({ where: { id: acct.id }, data: { balance: next } });
  await tx.walletTransaction.create({
    data: {
      tenantId,
      accountKind: 'agent',
      agentId,
      type: meta.type,
      amount: delta,
      balanceAfter: next,
      refType: meta.refType ?? null,
      refId: meta.refId ?? null,
      note: meta.note ?? null,
      createdById: meta.byUserId ?? null,
    },
  });
  return next;
}

async function applyBranch(
  tx: Tx,
  tenantId: string,
  branchId: string,
  delta: number,
  meta: LedgerMeta,
): Promise<number> {
  const acct = await tx.branchCashAccount.upsert({
    where: { tenantId_branchId: { tenantId, branchId } },
    create: { tenantId, branchId, balance: 0 },
    update: {},
  });
  const next = Number(acct.balance) + delta;
  await tx.branchCashAccount.update({ where: { id: acct.id }, data: { balance: next } });
  await tx.walletTransaction.create({
    data: {
      tenantId,
      accountKind: 'branch',
      branchId,
      type: meta.type,
      amount: delta,
      balanceAfter: next,
      refType: meta.refType ?? null,
      refId: meta.refId ?? null,
      note: meta.note ?? null,
      createdById: meta.byUserId ?? null,
    },
  });
  return next;
}

/** Admin releases company cash to an agent. Debits branch pool, credits agent. */
export async function releaseToAgent(input: {
  tenantId: string;
  agentId: string;
  branchId?: string | null;
  amount: number;
  byUserId: string;
  note?: string | null;
}): Promise<{ agentBalance: number }> {
  if (!(input.amount > 0)) throw new Error('amount must be positive');
  return prisma.$transaction(async (tx) => {
    if (input.branchId) {
      await applyBranch(tx, input.tenantId, input.branchId, -input.amount, {
        type: 'release',
        refType: 'agent',
        refId: input.agentId,
        note: input.note,
        byUserId: input.byUserId,
      });
    }
    const agentBalance = await applyAgent(tx, input.tenantId, input.agentId, input.amount, {
      type: 'release',
      refType: 'manual',
      note: input.note,
      byUserId: input.byUserId,
    });
    return { agentBalance };
  });
}

/** Adds capital to a branch cash pool (so it can fund releases/disbursements). */
export async function injectBranchCash(input: {
  tenantId: string;
  branchId: string;
  amount: number;
  byUserId: string;
  note?: string | null;
}): Promise<{ branchBalance: number }> {
  if (!(input.amount > 0)) throw new Error('amount must be positive');
  return prisma.$transaction(async (tx) => {
    const branchBalance = await applyBranch(tx, input.tenantId, input.branchId, input.amount, {
      type: 'inject',
      refType: 'manual',
      note: input.note,
      byUserId: input.byUserId,
    });
    return { branchBalance };
  });
}

/**
 * Debits an agent's float for a loan disbursement (hard block on low balance).
 * Call inside the loan-activation transaction.
 */
export async function disburseFromAgent(
  tx: Tx,
  input: { tenantId: string; agentId: string; amount: number; loanId: string; byUserId?: string | null },
): Promise<number> {
  if (!(input.amount > 0)) return 0;
  return applyAgent(
    tx,
    input.tenantId,
    input.agentId,
    -input.amount,
    { type: 'disburse', refType: 'loan', refId: input.loanId, byUserId: input.byUserId },
    true,
  );
}

/** Debits a branch cash pool for an admin/superadmin direct disbursement. */
export async function disburseFromBranch(
  tx: Tx,
  input: { tenantId: string; branchId: string; amount: number; loanId: string; byUserId?: string | null },
): Promise<number> {
  if (!(input.amount > 0)) return 0;
  return applyBranch(tx, input.tenantId, input.branchId, -input.amount, {
    type: 'disburse',
    refType: 'loan',
    refId: input.loanId,
    byUserId: input.byUserId,
  });
}

/** Credits an agent's float when they collect a repayment (cash now in hand). */
export async function creditCollection(
  tx: Tx,
  input: { tenantId: string; agentId: string; amount: number; entryId: string },
): Promise<number> {
  if (!(input.amount > 0)) return 0;
  return applyAgent(tx, input.tenantId, input.agentId, input.amount, {
    type: 'collection',
    refType: 'collection_entry',
    refId: input.entryId,
  });
}

export async function getAgentBalance(tenantId: string, agentId: string): Promise<number> {
  const a = await prisma.agentAccount.findUnique({
    where: { tenantId_agentId: { tenantId, agentId } },
  });
  return Number(a?.balance ?? 0);
}

export async function getAgentStatement(tenantId: string, agentId: string, limit = 50) {
  return prisma.walletTransaction.findMany({
    where: { tenantId, accountKind: 'agent', agentId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
