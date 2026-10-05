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
  type: 'release' | 'disburse' | 'collection' | 'penalty_collection' | 'inject' | 'deposit' | 'adjustment';
  refType?: string | null;
  refId?: string | null;
  note?: string | null;
  byUserId?: string | null;
};

type BalanceModel = {
  update(args: { where: { id: string }; data: { balance: { increment: number } } }): Promise<unknown>;
  updateMany(args: {
    where: { id: string; balance: { gte: number } };
    data: { balance: { increment: number } };
  }): Promise<{ count: number }>;
  findUnique(args: { where: { id: string }; select: { balance: true } }): Promise<{ balance: unknown } | null>;
};

/**
 * Moves a balance by `delta` with a single atomic UPDATE, then reads the row
 * back inside the same transaction. A debit under `hardBlock` is guarded in the
 * WHERE clause (`balance >= amount`), so the database — not a JS read taken
 * before another transaction committed — decides whether the cash is there.
 * The old read-compute-write lost concurrent updates and let two disbursements
 * both pass the float check (MONEY-16).
 */
async function moveBalance(model: BalanceModel, id: string, delta: number, hardBlock: boolean): Promise<number> {
  if (hardBlock && delta < 0) {
    const moved = await model.updateMany({
      where: { id, balance: { gte: -delta } },
      data: { balance: { increment: delta } },
    });
    if (moved.count !== 1) {
      const current = await model.findUnique({ where: { id }, select: { balance: true } });
      throw new InsufficientFloatError(Number(current?.balance ?? 0), -delta);
    }
  } else {
    await model.update({ where: { id }, data: { balance: { increment: delta } } });
  }
  const after = await model.findUnique({ where: { id }, select: { balance: true } });
  return Number(after?.balance ?? 0);
}

function requireBranchId(branchId: string | null | undefined, action: string): string {
  if (!branchId) {
    // An agent's float always has a branch pool on the other side. Without one
    // the movement would create or destroy cash (SCOPE-4: an unbranched agent
    // is a data defect to repair, never a reason to skip the branch leg).
    throw new Error(`A branch is required to ${action}. Assign the agent to a branch first.`);
  }
  return branchId;
}

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
  const next = await moveBalance(tx.agentAccount as unknown as BalanceModel, acct.id, delta, hardBlock);
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
  const next = await moveBalance(tx.branchCashAccount as unknown as BalanceModel, acct.id, delta, hardBlock);
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
  // A withdrawal or cash expense takes physical cash out of the office; it can
  // never take out more than the pool holds (MONEY-16).
  return applyBranch(
    tx,
    input.tenantId,
    input.appType,
    input.branchId,
    isAddition ? input.amount : -input.amount,
    {
      type: isAddition ? 'inject' : 'adjustment',
      refType: 'account_entry',
      refId: input.accountEntryId,
      note: input.note ?? defaultNote,
      byUserId: input.byUserId ?? null,
    },
    !isAddition,
  );
}

/**
 * Checks branch float availability before releasing funds.
 */
export async function checkBranchFloat(params: {
  tenantId: string;
  appType: string;
  branchId?: string | null;
  amount: number;
}): Promise<{ balance: number; shortfall: number; hasShortfall: boolean }> {
  if (!params.branchId) return { balance: Infinity, shortfall: 0, hasShortfall: false };
  const pool = await prisma.branchCashAccount.findUnique({
    where: { tenantId_appType_branchId: { tenantId: params.tenantId, appType: params.appType, branchId: params.branchId } },
    select: { balance: true },
  });
  const balance = Number(pool?.balance ?? 0);
  const shortfall = Math.max(0, Math.round((params.amount - balance) * 100) / 100);
  return { balance, shortfall, hasShortfall: params.amount > balance };
}

type ReleaseInput = {
  tenantId: string;
  appType: string;
  agentId: string;
  branchId?: string | null;
  amount: number;
  byUserId: string;
  note?: string | null;
  hardBlock?: boolean;
};

/** Admin releases company cash to an agent. Debits branch pool, credits agent. */
export async function releaseToAgentInTx(tx: Tx, input: ReleaseInput): Promise<{ agentBalance: number }> {
  if (!(input.amount > 0)) throw new Error('amount must be positive');
  const branchId = requireBranchId(input.branchId, 'release cash to an agent');
  await applyBranch(
    tx,
    input.tenantId,
    input.appType,
    branchId,
    -input.amount,
    {
      type: 'release',
      refType: 'agent',
      refId: input.agentId,
      note: input.note,
      byUserId: input.byUserId,
    },
    input.hardBlock ?? true,
  );
  const agentBalance = await applyAgent(tx, input.tenantId, input.appType, input.agentId, input.amount, {
    type: 'release',
    refType: 'manual',
    note: input.note,
    byUserId: input.byUserId,
  });
  return { agentBalance };
}

export async function releaseToAgent(input: ReleaseInput): Promise<{ agentBalance: number }> {
  return prisma.$transaction((tx) => releaseToAgentInTx(tx, input));
}

/**
 * Internal transaction helper for collectFromAgent.
 */
export async function collectFromAgentInTx(
  tx: Tx,
  input: {
    tenantId: string;
    appType: string;
    agentId: string;
    branchId: string;
    amount: number;
    byUserId: string;
    note?: string | null;
  },
): Promise<{ agentBalance: number; branchBalance: number }> {
  if (!(input.amount > 0)) throw new Error('amount must be positive');
  const branchId = requireBranchId(input.branchId, 'collect cash from an agent');
  const agentBalance = await applyAgent(
    tx,
    input.tenantId,
    input.appType,
    input.agentId,
    -input.amount,
    { type: 'deposit', refType: 'handover', note: input.note, byUserId: input.byUserId },
    true,
  );
  const branchBalance = await applyBranch(tx, input.tenantId, input.appType, branchId, input.amount, {
    type: 'deposit',
    refType: 'agent',
    refId: input.agentId,
    note: input.note,
    byUserId: input.byUserId,
  });
  return { agentBalance, branchBalance };
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
  branchId: string;
  amount: number;
  byUserId: string;
  note?: string | null;
}): Promise<{ agentBalance: number; branchBalance: number }> {
  return prisma.$transaction((tx) => collectFromAgentInTx(tx, input));
}

type InjectBranchInput = {
  tenantId: string;
  appType: string;
  branchId: string;
  amount: number;
  byUserId: string;
  note?: string | null;
};

/** Records incoming capital in both the cash book and the branch pool (ACC-6). */
export async function injectBranchCashInTx(tx: Tx, input: InjectBranchInput) {
  if (!(input.amount > 0)) throw new Error('amount must be positive');
  const branchId = requireBranchId(input.branchId, 'add capital');
  const entry = await tx.accountEntry.create({
    data: {
      tenantId: input.tenantId,
      appType: input.appType,
      branchId,
      entryDate: new Date(),
      type: 'capital_add',
      category: 'cash',
      amount: input.amount,
      description: input.note || 'Branch cash top-up',
      createdBy: input.byUserId,
    },
  });
  const branchBalance = await applyAccountingCashToBranch(tx, {
    ...input,
    branchId,
    entryType: 'capital_add',
    accountEntryId: entry.id,
  });
  return { branchBalance, entry };
}

/** Adds capital to a branch cash pool (so it can fund releases/disbursements). */
export async function injectBranchCash(input: InjectBranchInput): Promise<{ branchBalance: number }> {
  const { branchBalance, entry } = await prisma.$transaction((tx) => injectBranchCashInTx(tx, input));

  // GL: a branch top-up is real cash entering the business → capital injection
  // (Dr Cash on Hand / Cr Owner's Capital). Release-to-agent and agent-deposit
  // are internal cash↔cash transfers (net-zero in the GL) and are intentionally
  // NOT journaled. Disbursement/collection are journaled at their own events.
  // Fire-and-forget — premium JEs are supplemental and must never block float.
  void import('@/lib/accounting/autoPost').then(({ autoPostCapitalAdd }) =>
    autoPostCapitalAdd({
      tenantId: input.tenantId,
      appType: input.appType,
      entryId: entry.id,
      description: entry.description || 'Branch cash top-up',
      amount: input.amount,
      date: entry.entryDate,
      branchId: input.branchId,
      createdById: input.byUserId,
      category: 'cash',
    }),
  ).catch((e) => console.error('[wallet] capital-add JE failed:', e));

  return { branchBalance };
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
 * DEC-06: credits the collector's float for a penalty collected in cash —
 * a penalty collection works exactly like a loan collection, then the normal
 * handover. `accountEntryId` is the cash-book `penalty_collection` row.
 */
export async function creditPenaltyCollection(
  tx: Tx,
  input: { tenantId: string; appType: string; agentId: string; amount: number; accountEntryId: string },
): Promise<number> {
  if (!(input.amount > 0)) return 0;
  return applyAgent(tx, input.tenantId, input.appType, input.agentId, input.amount, {
    type: 'penalty_collection',
    refType: 'account_entry',
    refId: input.accountEntryId,
  });
}

/**
 * Agent hands collected cash back to the office: debits the agent's float
 * (hard block — can't deposit more than held) and credits the branch pool.
 */
type DepositInput = {
  tenantId: string;
  appType: string;
  agentId: string;
  branchId: string;
  amount: number;
  byUserId: string;
  note?: string | null;
};

export async function depositToOffice(input: DepositInput): Promise<{ agentBalance: number }> {
  return prisma.$transaction((tx) => depositToOfficeInTx(tx, input));
}

/** MON-02: the deposit inside the caller's transaction (MONEY-18), e.g. run reconciliation. */
export async function depositToOfficeInTx(tx: Tx, input: DepositInput): Promise<{ agentBalance: number }> {
  if (!(input.amount > 0)) throw new Error('amount must be positive');
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
