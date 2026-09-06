import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';

type Tx = Prisma.TransactionClient;

export class InsufficientFloatError extends Error {
  constructor(public available: number, public required: number) {
    super('insufficient_float');
    this.name = 'InsufficientFloatError';
  }
}

export function calculateFloatBalance(
  available: number,
  delta: number,
  hardBlock: boolean,
): number {
  const next = available + delta;
  if (hardBlock && next < 0) {
    throw new InsufficientFloatError(available, -delta);
  }
  return next;
}

type LedgerMeta = {
  type: 'release' | 'disburse' | 'collection' | 'inject' | 'deposit' | 'adjustment';
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
  appType: string,
  agentId: string,
  delta: number,
  meta: LedgerMeta,
  hardBlock = false,
): Promise<number> {
  const acct = await tx.agentAccount.upsert({
    where: { tenantId_appType_agentId: { tenantId, appType, agentId } },
    create: { tenantId, appType, agentId, balance: 0 },
    update: {},
  });
  const next = calculateFloatBalance(Number(acct.balance), delta, hardBlock);
  await tx.agentAccount.update({ where: { id: acct.id }, data: { balance: next } });
  // Stamp the agent's branch on the ledger row. Without it every agent-side
  // movement is unbranched, and the branch-scoped wallet view (which filters on
  // `branchId`) shows an admin nothing at all for their own agents (SCOPE-3).
  const agentUser = await tx.user.findUnique({
    where: { id: agentId },
    select: { branchId: true },
  });
  await tx.walletTransaction.create({
    data: {
      tenantId,
      appType,
      accountKind: 'agent',
      agentId,
      branchId: agentUser?.branchId ?? null,
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
  appType: string,
  branchId: string,
  delta: number,
  meta: LedgerMeta,
  hardBlock = false,
): Promise<number> {
  const acct = await tx.branchCashAccount.upsert({
    where: { tenantId_appType_branchId: { tenantId, appType, branchId } },
    create: { tenantId, appType, branchId, balance: 0 },
    update: {},
  });
  const next = calculateFloatBalance(Number(acct.balance), delta, hardBlock);
  await tx.branchCashAccount.update({ where: { id: acct.id }, data: { balance: next } });
  await tx.walletTransaction.create({
    data: {
      tenantId,
      appType,
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

/**
 * Mirrors a basic-accounting cash capital entry into the branch cash pool.
 * The AccountEntry remains the GL/accounting source; this only keeps the
 * operational cash float in sync and deliberately does not auto-post a JE.
 */
export async function applyAccountingCashToBranch(
  tx: Tx,
  input: {
    tenantId: string;
    appType: string;
    branchId: string;
    amount: number;
    entryType: 'capital_add' | 'capital_withdraw' | 'expense';
    accountEntryId: string;
    byUserId?: string | null;
    note?: string | null;
  },
): Promise<number> {
  if (!(input.amount > 0)) throw new Error('amount must be positive');
  const isAddition = input.entryType === 'capital_add';
  const defaultNote =
    input.entryType === 'capital_add'
      ? 'Accounting cash capital addition'
      : input.entryType === 'expense'
        ? 'Accounting cash expense'
        : 'Accounting cash capital withdrawal';
  return applyBranch(tx, input.tenantId, input.appType, input.branchId, isAddition ? input.amount : -input.amount, {
    type: isAddition ? 'inject' : 'adjustment',
    refType: 'account_entry',
    refId: input.accountEntryId,
    note: input.note ?? defaultNote,
    byUserId: input.byUserId ?? null,
  });
}

/** Admin releases company cash to an agent. Debits branch pool, credits agent. */
export async function releaseToAgent(input: {
  tenantId: string;
  appType: string;
  agentId: string;
  branchId?: string | null;
  amount: number;
  byUserId: string;
  note?: string | null;
}): Promise<{ agentBalance: number }> {
  if (!(input.amount > 0)) throw new Error('amount must be positive');
  return prisma.$transaction(async (tx) => {
    if (input.branchId) {
      // MONEY-16 — float never goes negative. Releasing more than the pool
      // physically holds must raise InsufficientFloatError (surfaced as 409),
      // not quietly overdraw the branch. Same hard block collectFromAgent uses.
      await applyBranch(
        tx,
        input.tenantId,
        input.appType,
        input.branchId,
        -input.amount,
        {
          type: 'release',
          refType: 'agent',
          refId: input.agentId,
          note: input.note,
          byUserId: input.byUserId,
        },
        true,
      );
    }
    const agentBalance = await applyAgent(tx, input.tenantId, input.appType, input.agentId, input.amount, {
      type: 'release',
      refType: 'manual',
      note: input.note,
      byUserId: input.byUserId,
    });
    return { agentBalance };
  });
}

/**
 * Agent hands field cash back to the branch (handover settlement). Debits the
 * agent float (hard block — they can't hand over more cash than they hold) and
 * credits the branch pool. A net-zero internal cash↔cash transfer, so it is not
 * journaled (mirrors release-to-agent).
 */
export async function collectFromAgent(input: {
  tenantId: string;
  appType: string;
  agentId: string;
  branchId?: string | null;
  amount: number;
  byUserId: string;
  note?: string | null;
}): Promise<{ agentBalance: number; branchBalance: number | null }> {
  if (!(input.amount > 0)) throw new Error('amount must be positive');
  return prisma.$transaction(async (tx) => {
    const agentBalance = await applyAgent(
      tx,
      input.tenantId,
      input.appType,
      input.agentId,
      -input.amount,
      { type: 'deposit', refType: 'handover', note: input.note, byUserId: input.byUserId },
      true,
    );
    let branchBalance: number | null = null;
    if (input.branchId) {
      branchBalance = await applyBranch(tx, input.tenantId, input.appType, input.branchId, input.amount, {
        type: 'deposit',
        refType: 'agent',
        refId: input.agentId,
        note: input.note,
        byUserId: input.byUserId,
      });
    }
    return { agentBalance, branchBalance };
  });
}

/** Adds capital to a branch cash pool (so it can fund releases/disbursements). */
export async function injectBranchCash(input: {
  tenantId: string;
  appType: string;
  branchId: string;
  amount: number;
  byUserId: string;
  note?: string | null;
}): Promise<{ branchBalance: number }> {
  if (!(input.amount > 0)) throw new Error('amount must be positive');
  const result = await prisma.$transaction(async (tx) => {
    const branchBalance = await applyBranch(tx, input.tenantId, input.appType, input.branchId, input.amount, {
      type: 'inject',
      refType: 'manual',
      note: input.note,
      byUserId: input.byUserId,
    });
    return { branchBalance };
  });

  // GL: a branch top-up is real cash entering the business → capital injection
  // (Dr Cash on Hand / Cr Owner's Capital). Release-to-agent and agent-deposit
  // are internal cash↔cash transfers (net-zero in the GL) and are intentionally
  // NOT journaled. Disbursement/collection are journaled at their own events.
  // Fire-and-forget — premium JEs are supplemental and must never block float.
  void import('@/lib/accounting/autoPost').then(({ autoPostCapitalAdd }) =>
    autoPostCapitalAdd({
      tenantId: input.tenantId,
      entryId: `topup-${input.branchId}-${Date.now()}`,
      description: input.note || 'Branch cash top-up',
      amount: input.amount,
      date: new Date(),
      branchId: input.branchId,
      createdById: input.byUserId,
      category: 'cash',
    }),
  ).catch((e) => console.error('[wallet] capital-add JE failed:', e));

  return result;
}

/**
 * Debits an agent's float for a loan disbursement (hard block on low balance).
 * Call inside the loan-activation transaction.
 */
export async function disburseFromAgent(
  tx: Tx,
  input: { tenantId: string; appType: string; agentId: string; amount: number; loanId: string; byUserId?: string | null },
): Promise<number> {
  if (!(input.amount > 0)) return 0;
  return applyAgent(
    tx,
    input.tenantId,
    input.appType,
    input.agentId,
    -input.amount,
    { type: 'disburse', refType: 'loan', refId: input.loanId, byUserId: input.byUserId },
    true,
  );
}

/** Debits a branch cash pool for an admin/superadmin direct disbursement. */
export async function disburseFromBranch(
  tx: Tx,
  input: { tenantId: string; appType: string; branchId: string; amount: number; loanId: string; byUserId?: string | null },
): Promise<number> {
  if (!(input.amount > 0)) return 0;
  return applyBranch(
    tx,
    input.tenantId,
    input.appType,
    input.branchId,
    -input.amount,
    {
      type: 'disburse',
      refType: 'loan',
      refId: input.loanId,
      byUserId: input.byUserId,
    },
    true,
  );
}

/** Chit contribution received into the office — credits the branch cash pool. */
export async function chitContributionToBranch(
  tx: Tx,
  input: { tenantId: string; appType: string; branchId: string; amount: number; refId: string; byUserId?: string | null },
): Promise<number> {
  if (!(input.amount > 0)) return 0;
  return applyBranch(tx, input.tenantId, input.appType, input.branchId, input.amount, {
    type: 'collection',
    refType: 'chit',
    refId: input.refId,
    note: 'Chit contribution',
    byUserId: input.byUserId ?? null,
  });
}

/** Chit prize paid out to the winner — debits the branch cash pool. */
export async function reverseChitContributionFromBranch(
  tx: Tx,
  input: { tenantId: string; appType: string; branchId: string; amount: number; refId: string; byUserId?: string | null },
): Promise<number> {
  if (!(input.amount > 0)) return 0;
  return applyBranch(tx, input.tenantId, input.appType, input.branchId, -input.amount, {
    type: 'adjustment',
    refType: 'chit_receipt',
    refId: input.refId,
    note: 'Chit contribution reversal',
    byUserId: input.byUserId ?? null,
  });
}

/** Chit prize paid out to the winner. */
export async function chitPayoutFromBranch(
  tx: Tx,
  input: { tenantId: string; appType: string; branchId: string; amount: number; refId: string; byUserId?: string | null },
): Promise<number> {
  if (!(input.amount > 0)) return 0;
  return applyBranch(tx, input.tenantId, input.appType, input.branchId, -input.amount, {
    type: 'disburse',
    refType: 'chit',
    refId: input.refId,
    note: 'Chit prize payout',
    byUserId: input.byUserId ?? null,
  });
}

/** Credits an agent's float when they collect a repayment (cash now in hand). */
export async function creditCollection(
  tx: Tx,
  input: { tenantId: string; appType: string; agentId: string; amount: number; entryId: string },
): Promise<number> {
  if (!(input.amount > 0)) return 0;
  return applyAgent(tx, input.tenantId, input.appType, input.agentId, input.amount, {
    type: 'collection',
    refType: 'collection_entry',
    refId: input.entryId,
  });
}

/**
 * Agent hands collected cash back to the office: debits the agent's float
 * (hard block — can't deposit more than held) and credits the branch pool.
 */
export async function depositToOffice(input: {
  tenantId: string;
  appType: string;
  agentId: string;
  branchId: string;
  amount: number;
  byUserId: string;
  note?: string | null;
}): Promise<{ agentBalance: number }> {
  if (!(input.amount > 0)) throw new Error('amount must be positive');
  return prisma.$transaction(async (tx) => {
    const agentBalance = await applyAgent(
      tx,
      input.tenantId,
      input.appType,
      input.agentId,
      -input.amount,
      { type: 'deposit', refType: 'branch', refId: input.branchId, note: input.note, byUserId: input.byUserId },
      true,
    );
    await applyBranch(tx, input.tenantId, input.appType, input.branchId, input.amount, {
      type: 'deposit',
      refType: 'agent',
      refId: input.agentId,
      note: input.note,
      byUserId: input.byUserId,
    });
    return { agentBalance };
  });
}

export async function getBranchAccounts(tenantId: string, appType: string, branchIds?: string[]) {
  return prisma.branchCashAccount.findMany({
    where: { tenantId, appType, ...(branchIds ? { branchId: { in: branchIds } } : {}) },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getBranchStatement(tenantId: string, appType: string, branchId: string, limit = 50) {
  return prisma.walletTransaction.findMany({
    where: { tenantId, appType, accountKind: 'branch', branchId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getAgentBalance(tenantId: string, appType: string, agentId: string): Promise<number> {
  const a = await prisma.agentAccount.findUnique({
    where: { tenantId_appType_agentId: { tenantId, appType, agentId } },
  });
  return Number(a?.balance ?? 0);
}

export async function getAgentStatement(tenantId: string, appType: string, agentId: string, limit = 50) {
  return prisma.walletTransaction.findMany({
    where: { tenantId, appType, accountKind: 'agent', agentId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
