import type { Prisma } from '@prisma/client';
import prisma from './db';
import { startOfBusinessDayUtc } from './businessTime';
import { computeExtendedSchedule, pairEntriesWithInstalments, pastTermMissedDays } from './restructure';
import { buildAgentCustomerAccessWhere } from './loanPolicy';
import { creditPenaltyCollection } from './wallet';
import { autoPostPenaltyCollection } from './accounting/autoPost';

export function penaltyListWhere(scope: {
  tenantId: string;
  appType: string;
  branchId?: string | null;
  status?: string | null;
  routeId?: string | null;
  q?: string | null;
}) {
  const loan = {
    tenantId: scope.tenantId,
    appType: scope.appType,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
  };
  const q = scope.q?.trim();
  return {
    loan,
    ...(scope.status && scope.status !== 'all' ? { status: scope.status } : {}),
    ...(scope.routeId ? { customer: { routeId: scope.routeId } } : {}),
    ...(q ? { OR: [
      { loan: { loanCode: { contains: q } } },
      { customer: { name: { contains: q } } },
      { customer: { customerCode: { contains: q } } },
    ] } : {}),
  };
}

const ACTIVE_PENALTY_STATUSES = ['pending', 'partial'];

type PenaltySyncScope = {
  tenantId?: string;
  appType?: string;
  branchId?: string;
  routeId?: string;
  loanId?: string;
};

type PenaltySyncResult = {
  loansChecked: number;
  penaltiesCreated: number;
  penaltiesUpdated: number;
};

export function calculatePenaltyAccrual(input: {
  overdueInstalments: Array<{ dueDate: Date | string }>;
  asOf?: Date;
  penaltyPerDay: number;
  gracePeriodDays: number;
  maxCap: number;
}): { missedDays: number; grossPenalty: number } {
  const today = new Date(input.asOf || new Date());
  today.setHours(0, 0, 0, 0);

  const missedDays = input.overdueInstalments.reduce((total, instalment) => {
    const dueDate = new Date(instalment.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return total + Math.max(0, daysOverdue - input.gracePeriodDays);
  }, 0);

  let grossPenalty = missedDays * input.penaltyPerDay;
  if (input.maxCap > 0) {
    grossPenalty = Math.min(grossPenalty, input.maxCap);
  }

  return { missedDays, grossPenalty };
}

export function shouldUpdatePenaltyGross(existingGrossPenalty: number, nextGrossPenalty: number): boolean {
  return nextGrossPenalty > existingGrossPenalty;
}

/**
 * Missed days for the pending accrual. While the term runs: instalments marked
 * missed. Once the last scheduled due is behind today (EXT-1): rows missed at
 * the end of the term plus extended days missed since — the same count the
 * loan page's penalty summary shows (`pastTermMissedDays`).
 */
async function penaltyMissedDays(
  loan: {
    id: string;
    perInstalment: unknown;
    frequency: string;
    instalments: Array<{ id: string; dueDate: Date; dueAmount: unknown; receivedAmount: unknown; status: string; instalmentNo: number; collectionEntryId: string | null }>;
  },
  today: Date,
): Promise<number> {
  const missedRows = loan.instalments.filter((i) => i.status === 'missed').length;
  const lastDue = loan.instalments.reduce((max, i) => Math.max(max, new Date(i.dueDate).getTime()), 0);
  if (!lastDue || lastDue >= today.getTime()) return missedRows;

  const detail = await prisma.loan.findUnique({
    where: { id: loan.id },
    select: {
      collectionEntries: {
        orderBy: { submittedAt: 'asc' },
        select: {
          id: true,
          receivedAmount: true,
          paymentMode: true,
          submittedAt: true,
          collection: { select: { date: true } },
        },
      },
      payments: {
        select: {
          amount: true,
          paymentMode: true,
          createdAt: true,
          allocations: { select: { instalmentId: true } },
        },
      },
    },
  });
  const entries = pairEntriesWithInstalments(detail?.collectionEntries ?? [], detail?.payments ?? [])
    .map((c) => ({ ...c, collectionDate: c.collection?.date ?? c.submittedAt }));
  const ext = computeExtendedSchedule(loan.instalments, Number(loan.perInstalment), loan.frequency, today, entries);
  return pastTermMissedDays(ext) ?? missedRows;
}

export async function ensurePendingPenaltiesForMissedLoans(
  scope: PenaltySyncScope
): Promise<PenaltySyncResult> {
  const loanWhere: any = {
    status: { in: ['active', 'overdue'] },
    instalments: { some: { status: 'missed' } },
  };

  if (scope.tenantId) loanWhere.tenantId = scope.tenantId;
  if (scope.appType) loanWhere.appType = scope.appType;
  if (scope.branchId) loanWhere.branchId = scope.branchId;
  if (scope.loanId) loanWhere.id = scope.loanId;
  if (scope.routeId) loanWhere.customer = { routeId: scope.routeId };

  const loans = await prisma.loan.findMany({
    where: loanWhere,
    select: {
      id: true,
      customerId: true,
      penaltyRate: true,
      perInstalment: true,
      frequency: true,
      instalments: {
        orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
        select: {
          id: true,
          instalmentNo: true,
          dueDate: true,
          dueAmount: true,
          receivedAmount: true,
          status: true,
          collectionEntryId: true,
        },
      },
    },
  });
  const today = startOfBusinessDayUtc();

  let penaltiesCreated = 0;
  let penaltiesUpdated = 0;

  for (const loan of loans) {
    const missedDays = await penaltyMissedDays(loan, today);
    const liveGrossPenalty = missedDays * Number(loan.penaltyRate);
    if (missedDays === 0 || liveGrossPenalty <= 0) continue;

    // Use an interactive transaction to prevent race-condition duplicates
    await prisma.$transaction(async (tx) => {
      // Re-fetch penalties inside the transaction for consistency
      const penalties = await tx.penalty.findMany({
        where: { loanId: loan.id },
        select: {
          id: true,
          missedDays: true,
          grossPenalty: true,
          settledAmount: true,
          waivedAmount: true,
          status: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      const recordedGross = penalties.reduce(
        (sum, penalty) => sum + Number(penalty.grossPenalty),
        0
      );
      const resolvedTotal = penalties.reduce(
        (sum, penalty) =>
          sum + Number(penalty.settledAmount) + Number(penalty.waivedAmount),
        0
      );
      const activePenalty = penalties.find((penalty) =>
        ACTIVE_PENALTY_STATUSES.includes(penalty.status)
      );
      const outstandingPenalty =
        Math.max(recordedGross, liveGrossPenalty) - resolvedTotal;

      if (outstandingPenalty <= 0) return;

      if (activePenalty) {
        const grossShortfall = Math.max(0, liveGrossPenalty - recordedGross);
        const nextGrossPenalty =
          Number(activePenalty.grossPenalty) + grossShortfall;
        const shouldUpdate =
          grossShortfall > 0 || activePenalty.missedDays !== missedDays;

        if (shouldUpdate) {
          await tx.penalty.update({
            where: { id: activePenalty.id },
            data: {
              grossPenalty: nextGrossPenalty,
              missedDays,
            },
          });
          penaltiesUpdated++;
        }
        return;
      }

      await tx.penalty.create({
        data: {
          loanId: loan.id,
          customerId: loan.customerId,
          missedDays,
          grossPenalty: outstandingPenalty,
          status: 'pending',
        },
      });
      penaltiesCreated++;
    }, { maxWait: 5000, timeout: 10000 });
  }

  return {
    loansChecked: loans.length,
    penaltiesCreated,
    penaltiesUpdated,
  };
}

/** DEC-03 (B): a penalty row's net due — the one formula both clients render. */
export function penaltyNet(p: { grossPenalty: unknown; settledAmount: unknown; waivedAmount: unknown }): number {
  return Math.max(0, Number(p.grossPenalty) - Number(p.settledAmount) - Number(p.waivedAmount));
}

/** DEC-06: payment modes a penalty can be collected in (same list on web and mobile). */
export const PENALTY_PAYMENT_MODES = ['cash', 'upi', 'bank_transfer', 'cheque'] as const;

/** Cash-book category for a penalty payment — the buckets a loan collection uses. */
export function penaltyCashBookCategory(paymentMode: string): 'cash' | 'upi' | 'bank' {
  return paymentMode === 'cash' ? 'cash' : paymentMode === 'upi' ? 'upi' : 'bank';
}

type SettleTxInput = {
  tenantId: string;
  appType: string;
  userId: string;
  penaltyId: string;
  amount: number;
  paymentMode: string;
  collectedById: string;
  notes?: string | null;
  loan: { branchId: string | null; loanCode: string };
};

/**
 * The money part of a penalty settle, inside the caller's transaction (MONEY-18).
 * Re-reads the row and writes it conditionally so concurrent settles cannot both
 * pass the remaining check (MONEY-28). Returns the cash-book row; the caller posts
 * the GL after commit with `postPenaltyCollection` (ACC-7).
 */
export async function settlePenaltyInTx(tx: Prisma.TransactionClient, input: SettleTxInput) {
  const { tenantId, appType, userId, penaltyId, amount, paymentMode, collectedById, notes, loan } = input;
  const cur = await tx.penalty.findUnique({
    where: { id: penaltyId },
    select: { grossPenalty: true, settledAmount: true, waivedAmount: true },
  });
  if (!cur) throw new Error('Penalty not found');
  const curGross = Number(cur.grossPenalty);
  const curSettled = Number(cur.settledAmount);
  const curWaived = Number(cur.waivedAmount);
  const curRemaining = curGross - curSettled - curWaived;
  if (!(amount > 0) || amount > curRemaining + 0.005) {
    throw new Error(`Invalid settle amount: must be > 0 and <= ${curRemaining}`);
  }

  const nextSettled = curSettled + amount;
  const isFullySettled = (nextSettled + curWaived) >= curGross - 0.005;
  const nextStatus = isFullySettled ? 'settled' : 'partial';

  const moved = await tx.penalty.updateMany({
    where: { id: penaltyId, settledAmount: cur.settledAmount, waivedAmount: cur.waivedAmount },
    data: {
      settledAmount: nextSettled,
      status: nextStatus,
      settledById: userId,
      settledAt: isFullySettled ? new Date() : null,
      notes: notes ?? undefined,
    },
  });
  if (moved.count !== 1) throw new Error('Invalid settle amount: penalty changed, please retry');

  const updated = await tx.penalty.findUnique({ where: { id: penaltyId }, include: { loan: true } });

  // DEC-06: a penalty collection is money in — cash book now, float for cash
  // (MONEY-17), GL after commit (ACC-6/ACC-7). Loan totals are not touched.
  const category = penaltyCashBookCategory(paymentMode);
  const accountEntry = await tx.accountEntry.create({
    data: {
      tenantId,
      appType,
      branchId: loan.branchId,
      entryDate: new Date(),
      type: 'penalty_collection',
      category,
      amount,
      description: `Penalty collected — ${loan.loanCode}`,
      referenceType: 'penalty',
      referenceId: penaltyId,
      createdBy: userId,
    },
  });

  // Same rule and same best-effort guard as a loan collection's float credit.
  if (paymentMode === 'cash') {
    try {
      await creditPenaltyCollection(tx, { tenantId, appType, agentId: collectedById, amount, accountEntryId: accountEntry.id });
    } catch (err) {
      console.error('[wallet] penalty collection credit failed:', err);
    }
  }

  await tx.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'settle',
      entityType: 'penalty',
      entityId: penaltyId,
      newValue: JSON.stringify({
        action: 'settle',
        amount,
        settledAmount: nextSettled,
        status: nextStatus,
        paymentMode,
        collectedById,
        accountEntryId: accountEntry.id,
      }),
    },
  });

  return { updated, accountEntry: { ...accountEntry, loanCode: loan.loanCode } };
}

/** GL for a settled penalty, after the transaction commits (ACC-7). */
export async function postPenaltyCollection(
  tenantId: string,
  appType: string,
  userId: string,
  entry: { id: string; amount: unknown; entryDate: Date; branchId: string | null; category: string; loanCode: string },
) {
  await autoPostPenaltyCollection({
    tenantId,
    appType,
    entryId: entry.id,
    loanCode: entry.loanCode,
    amount: Number(entry.amount),
    date: entry.entryDate,
    branchId: entry.branchId,
    createdById: userId,
    paymentMode: entry.category,
  });
}

export async function settlePenalty(input: {
  tenantId: string;
  appType: string;
  branchId?: string | null;
  userId: string;
  role: string;
  penaltyId: string;
  amount: number;
  paymentMode: string;
  /** Whose float receives cash; defaults to the acting user. */
  collectedById?: string | null;
  notes?: string | null;
}): Promise<any> {
  const { tenantId, appType, branchId, userId, role, penaltyId, amount, paymentMode, notes } = input;
  const collectedById = input.collectedById || userId;

  if (!(PENALTY_PAYMENT_MODES as readonly string[]).includes(paymentMode)) {
    throw new Error(`Invalid settle amount: unknown payment mode ${paymentMode}`);
  }

  const penalty = await prisma.penalty.findUnique({
    where: { id: penaltyId },
    include: { loan: true },
  });
  if (!penalty || penalty.loan.tenantId !== tenantId || penalty.loan.appType !== appType) {
    throw new Error('Penalty not found');
  }

  if (role === 'agent') {
    const hasAccess = await prisma.loan.findFirst({
      where: {
        id: penalty.loanId,
        tenantId,
        appType,
        customer: buildAgentCustomerAccessWhere({ userId }),
      },
      select: { id: true },
    });
    if (!hasAccess) {
      throw new Error('Penalty not found');
    }
  } else if (branchId) {
    if (penalty.loan.branchId !== branchId) {
      throw new Error('Penalty not found');
    }
  }

  const gross = Number(penalty.grossPenalty);
  const settled = Number(penalty.settledAmount);
  const waived = Number(penalty.waivedAmount);
  const remaining = gross - settled - waived;

  if (amount <= 0 || amount > remaining) {
    throw new Error(`Invalid settle amount: must be > 0 and <= ${remaining}`);
  }

  const { updated, accountEntry } = await prisma.$transaction((tx) =>
    settlePenaltyInTx(tx, {
      tenantId, appType, userId, penaltyId, amount, paymentMode, collectedById, notes,
      loan: { branchId: penalty.loan.branchId, loanCode: penalty.loan.loanCode },
    }),
  );

  await postPenaltyCollection(tenantId, appType, userId, accountEntry);

  return updated;
}

/** DEC-01: how the pending penalty is resolved during a preclose. */
export type PenaltyResolution = { action: 'paid' | 'discount' | 'waived'; amount: number; paymentMode?: string | null };

export class PenaltyResolutionError extends Error {
  constructor(message: string, public status: number = 400) { super(message); }
}

/**
 * Validates a preclose penalty resolution against the penalty due:
 * paid → amount = due; discount → 0 < amount < due; waived → amount = 0;
 * a payment mode is required whenever money is collected.
 */
export function validatePenaltyResolution(raw: unknown, penaltyDue: number): PenaltyResolution | null {
  if (!(penaltyDue > 0)) return null;
  if (!raw || typeof raw !== 'object') throw new PenaltyResolutionError('penalty_resolution_required');
  const r = raw as Record<string, unknown>;
  const action = r.action;
  const amount = Math.round(Number(r.amount ?? 0) * 100) / 100;
  const due = Math.round(penaltyDue * 100) / 100;
  const paymentMode = typeof r.paymentMode === 'string' ? r.paymentMode : null;
  const ok =
    (action === 'paid' && Math.abs(amount - due) < 0.005) ||
    (action === 'discount' && amount > 0 && amount < due) ||
    (action === 'waived' && amount === 0);
  if (!ok) throw new PenaltyResolutionError('penalty_resolution_invalid');
  if (amount > 0 && !(paymentMode && (PENALTY_PAYMENT_MODES as readonly string[]).includes(paymentMode))) {
    throw new PenaltyResolutionError('penalty_resolution_invalid');
  }
  return { action, amount, paymentMode } as PenaltyResolution;
}

/**
 * Applies a validated resolution inside the preclose transaction: collect the
 * amount across the loan's open penalties oldest-first (DEC-06 money posting),
 * then waive what is left. Returns the outcome and the cash-book rows whose GL
 * the caller posts after commit.
 */
export async function resolvePreclosePenaltiesInTx(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    appType: string;
    userId: string;
    role: string;
    loan: { id: string; branchId: string | null; loanCode: string };
    resolution: PenaltyResolution;
  },
) {
  const { tenantId, appType, userId, role, loan, resolution } = input;
  const open = (await tx.penalty.findMany({ where: { loanId: loan.id }, orderBy: { createdAt: 'asc' } }))
    .map((p) => ({ id: p.id, net: Number(p.grossPenalty) - Number(p.settledAmount) - Number(p.waivedAmount) }))
    .filter((p) => p.net > 0.005);
  const due = open.reduce((s, p) => s + p.net, 0);

  const entries: Array<Awaited<ReturnType<typeof settlePenaltyInTx>>['accountEntry']> = [];
  let toCollect = resolution.amount;
  for (const p of open) {
    if (toCollect <= 0.005) break;
    const pay = Math.round(Math.min(toCollect, p.net) * 100) / 100;
    const { accountEntry } = await settlePenaltyInTx(tx, {
      tenantId, appType, userId, penaltyId: p.id, amount: pay,
      paymentMode: resolution.paymentMode || 'cash', collectedById: userId,
      notes: 'Preclose penalty collected', loan,
    });
    entries.push(accountEntry);
    p.net -= pay;
    toCollect -= pay;
  }

  let waived = 0;
  const reason = resolution.action === 'waived' ? 'preclose_waived' : 'preclose_discount';
  for (const p of open) {
    if (p.net <= 0.005) continue;
    await waivePenalty({ tenantId, appType, userId, role, penaltyId: p.id, reason, prismaClient: tx });
    waived += p.net;
  }

  const paid = Math.round((resolution.amount - Math.max(0, toCollect)) * 100) / 100;
  const outcome = {
    due: Math.round(due * 100) / 100,
    paid,
    discount: resolution.action === 'discount' ? Math.round(waived * 100) / 100 : 0,
    waived: resolution.action === 'waived' ? Math.round(waived * 100) / 100 : 0,
    action: resolution.action,
  };
  return { outcome, entries };
}

export async function waivePenalty(input: {
  tenantId: string;
  appType: string;
  branchId?: string | null;
  userId: string;
  role: string;
  penaltyId: string;
  amount?: number;
  reason?: string | null;
  prismaClient?: any;
}): Promise<any> {
  const { tenantId, appType, branchId, userId, role, penaltyId, amount, reason, prismaClient } = input;

  if (!['admin', 'superadmin', 'developer'].includes(role)) {
    throw new Error('Forbidden: Agents cannot waive penalties');
  }

  const db = prismaClient ?? prisma;

  const penalty = await db.penalty.findUnique({
    where: { id: penaltyId },
    include: { loan: true },
  });
  if (!penalty || penalty.loan.tenantId !== tenantId || penalty.loan.appType !== appType) {
    throw new Error('Penalty not found');
  }

  if (branchId) {
    if (penalty.loan.branchId !== branchId) {
      throw new Error('Penalty not found');
    }
  }

  const gross = Number(penalty.grossPenalty);
  const settled = Number(penalty.settledAmount);
  const existingWaived = Number(penalty.waivedAmount);
  const remaining = gross - settled - existingWaived;

  const waiveAmt = amount !== undefined ? amount : remaining;
  if (waiveAmt <= 0 || waiveAmt > remaining) {
    throw new Error(`Invalid waive amount: must be > 0 and <= ${remaining}`);
  }

  const nextWaived = existingWaived + waiveAmt;
  const isFullyWaived = (settled + nextWaived) >= gross;
  const nextStatus = isFullyWaived ? 'waived' : 'partial';

  const applyWaiver = async (tx: any) => {
    const res = await tx.penalty.update({
      where: { id: penaltyId },
      data: {
        waivedAmount: nextWaived,
        status: nextStatus,
        settledById: userId,
        settledAt: new Date(),
        notes: reason ?? undefined,
      },
      include: { loan: true },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'waive',
        entityType: 'penalty',
        entityId: penaltyId,
        newValue: JSON.stringify({
          action: 'waive',
          amount: waiveAmt,
          waivedAmount: nextWaived,
          status: nextStatus,
          reason,
        }),
      },
    });

    return res;
  };

  const updated = prismaClient ? await applyWaiver(prismaClient) : await prisma.$transaction(applyWaiver);

  try {
    await prisma.systemNotification.create({
      data: {
        tenantId,
        type: 'success',
        icon: 'money_off',
        title: 'Penalty Waived',
        message: `Penalty of ${gross} waived for loan ${penalty.loan.loanCode} by admin.`,
        link: `/loans/${penalty.loan.loanCode}`,
      },
    });
  } catch (err) {
    console.error('Failed to create penalty waiver notification:', err);
  }

  return updated;
}

// ── DEC-03 (B): per-loan penalty figures and actions, server-side ─────────────
// Each loan's penalty comes from that loan's own missed dates; rows of one loan
// are summed here (never across loans) so no client adds or splits amounts.

type LoanPenaltyActor = { tenantId: string; appType: string; branchId?: string | null; userId: string; role: string };

/** The loan the actor may act on (agent: linked customer; staff: active branch). */
async function loanForPenaltyAction(actor: LoanPenaltyActor, loanId: string) {
  const loan = await prisma.loan.findFirst({
    where: {
      id: loanId,
      tenantId: actor.tenantId,
      appType: actor.appType,
      ...(actor.role === 'agent'
        ? { customer: buildAgentCustomerAccessWhere({ userId: actor.userId }) }
        : actor.branchId ? { branchId: actor.branchId } : {}),
    },
    select: { id: true, loanCode: true, branchId: true },
  });
  if (!loan) throw new Error('Penalty not found');
  return loan;
}

/** Open penalty rows of one loan, oldest first, with their net due. */
async function openLoanPenalties(db: Prisma.TransactionClient, loanId: string) {
  return (await db.penalty.findMany({ where: { loanId }, orderBy: { createdAt: 'asc' } }))
    .map((p) => ({ id: p.id, net: penaltyNet(p) }))
    .filter((p) => p.net > 0.005);
}

/**
 * Settle `amount` across one loan's open penalties, oldest first, in one
 * transaction (MONEY-28, MONEY-32). Rejects an amount above the loan's net due.
 */
export async function settleLoanPenalties(
  actor: LoanPenaltyActor,
  input: { loanId: string; amount: number; paymentMode: string; notes?: string | null },
) {
  if (!(PENALTY_PAYMENT_MODES as readonly string[]).includes(input.paymentMode)) {
    throw new Error(`Invalid settle amount: unknown payment mode ${input.paymentMode}`);
  }
  const amount = Math.round(Number(input.amount) * 100) / 100;
  const loan = await loanForPenaltyAction(actor, input.loanId);
  const entries = await prisma.$transaction(async (tx) => {
    const open = await openLoanPenalties(tx, loan.id);
    const due = Math.round(open.reduce((s, p) => s + p.net, 0) * 100) / 100;
    if (!(amount > 0) || amount > due + 0.005) {
      throw new Error(`Invalid settle amount: must be > 0 and <= ${due}`);
    }
    const posted: Array<Awaited<ReturnType<typeof settlePenaltyInTx>>['accountEntry']> = [];
    let remaining = amount;
    for (const p of open) {
      if (remaining <= 0.005) break;
      const pay = Math.round(Math.min(remaining, p.net) * 100) / 100;
      const { accountEntry } = await settlePenaltyInTx(tx, {
        tenantId: actor.tenantId, appType: actor.appType, userId: actor.userId, penaltyId: p.id,
        amount: pay, paymentMode: input.paymentMode, collectedById: actor.userId,
        notes: input.notes ?? null, loan: { branchId: loan.branchId, loanCode: loan.loanCode },
      });
      posted.push(accountEntry);
      remaining = Math.round((remaining - pay) * 100) / 100;
    }
    return posted;
  });
  for (const entry of entries) await postPenaltyCollection(actor.tenantId, actor.appType, actor.userId, entry);
  return { success: true, loanId: loan.id, settled: amount };
}

/**
 * Waive one loan's open penalties (all, or `amount` oldest-first) in one
 * transaction. Admin roles only (D6); agents request a waiver instead.
 */
export async function waiveLoanPenalties(
  actor: LoanPenaltyActor,
  input: { loanId: string; amount?: number | null; reason?: string | null },
) {
  if (!['admin', 'superadmin', 'developer'].includes(actor.role)) {
    throw new Error('Forbidden: Agents cannot waive penalties');
  }
  const loan = await loanForPenaltyAction(actor, input.loanId);
  await prisma.$transaction(async (tx) => {
    const open = await openLoanPenalties(tx, loan.id);
    const due = Math.round(open.reduce((s, p) => s + p.net, 0) * 100) / 100;
    let remaining = input.amount == null ? due : Math.round(Number(input.amount) * 100) / 100;
    if (!(remaining > 0) || remaining > due + 0.005) {
      throw new Error(`Invalid waive amount: must be > 0 and <= ${due}`);
    }
    for (const p of open) {
      if (remaining <= 0.005) break;
      const part = Math.round(Math.min(remaining, p.net) * 100) / 100;
      await waivePenalty({
        tenantId: actor.tenantId, appType: actor.appType, userId: actor.userId, role: actor.role,
        penaltyId: p.id, amount: part >= p.net - 0.005 ? undefined : part, reason: input.reason ?? null,
        prismaClient: tx,
      });
      remaining = Math.round((remaining - part) * 100) / 100;
    }
  });
  return { success: true, loanId: loan.id };
}

/** One row per loan for the penalties lists (web + mobile). */
export type LoanPenaltyGroup = {
  loanId: string;
  loanCode: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  routeId: string | null;
  routeName: string | null;
  gross: number;
  settled: number;
  waived: number;
  net: number;
  missedDays: number;
  status: 'pending' | 'partial' | 'waived' | 'settled';
  penalties: Array<{ id: string; status: string; net: number; missedDays: number; createdAt: Date }>;
  latestAt: Date;
};

/** Groups penalty rows by loan (each loan's own rows only). */
export function groupPenaltiesByLoan(rows: Array<{
  id: string; loanId: string; status: string; missedDays: number; createdAt: Date;
  grossPenalty: unknown; settledAmount: unknown; waivedAmount: unknown;
  loan: { loanCode: string } | null;
  customer: { id: string; name: string; customerCode: string; routeId: string | null; route: { name: string } | null } | null;
}>): LoanPenaltyGroup[] {
  const byLoan = new Map<string, LoanPenaltyGroup>();
  const r2 = (n: number) => Math.round(n * 100) / 100;
  for (const p of rows) {
    let g = byLoan.get(p.loanId);
    if (!g) {
      g = {
        loanId: p.loanId, loanCode: p.loan?.loanCode ?? '', customerId: p.customer?.id ?? '',
        customerName: p.customer?.name ?? '', customerCode: p.customer?.customerCode ?? '',
        routeId: p.customer?.routeId ?? null, routeName: p.customer?.route?.name ?? null,
        gross: 0, settled: 0, waived: 0, net: 0, missedDays: 0, status: 'settled', penalties: [], latestAt: p.createdAt,
      };
      byLoan.set(p.loanId, g);
    }
    const net = penaltyNet(p);
    g.gross = r2(g.gross + Number(p.grossPenalty));
    g.settled = r2(g.settled + Number(p.settledAmount));
    g.waived = r2(g.waived + Number(p.waivedAmount));
    g.net = r2(g.net + net);
    g.missedDays = Math.max(g.missedDays, p.missedDays);
    if (p.createdAt > g.latestAt) g.latestAt = p.createdAt;
    g.penalties.push({ id: p.id, status: p.status, net, missedDays: p.missedDays, createdAt: p.createdAt });
  }
  for (const g of byLoan.values()) {
    const st = g.penalties.map((p) => p.status);
    g.status = st.includes('pending') ? 'pending' : st.includes('partial') ? 'partial' : st.includes('waived') ? 'waived' : 'settled';
    g.penalties.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  return [...byLoan.values()].sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime());
}
