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

/** DEC-06: payment modes a penalty can be collected in (same list on web and mobile). */
export const PENALTY_PAYMENT_MODES = ['cash', 'upi', 'bank_transfer', 'cheque'] as const;

/** Cash-book category for a penalty payment — the buckets a loan collection uses. */
export function penaltyCashBookCategory(paymentMode: string): 'cash' | 'upi' | 'bank' {
  return paymentMode === 'cash' ? 'cash' : paymentMode === 'upi' ? 'upi' : 'bank';
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

  const category = penaltyCashBookCategory(paymentMode);

  const { updated, accountEntry } = await prisma.$transaction(async (tx) => {
    // Re-read inside the transaction and guard the write on what was read, so
    // two concurrent settles cannot both pass the remaining check (MONEY-28).
    const cur = await tx.penalty.findUnique({
      where: { id: penaltyId },
      select: { grossPenalty: true, settledAmount: true, waivedAmount: true },
    });
    if (!cur) throw new Error('Penalty not found');
    const curGross = Number(cur.grossPenalty);
    const curSettled = Number(cur.settledAmount);
    const curWaived = Number(cur.waivedAmount);
    const curRemaining = curGross - curSettled - curWaived;
    if (amount > curRemaining) {
      throw new Error(`Invalid settle amount: must be > 0 and <= ${curRemaining}`);
    }

    const nextSettled = curSettled + amount;
    const isFullySettled = (nextSettled + curWaived) >= curGross;
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

    const row = await tx.penalty.findUnique({ where: { id: penaltyId }, include: { loan: true } });

    // DEC-06: a penalty collection is money in — cash book now, float for cash
    // (MONEY-17), GL after commit (ACC-6/ACC-7). Loan totals are not touched.
    const entry = await tx.accountEntry.create({
      data: {
        tenantId,
        appType,
        branchId: penalty.loan.branchId,
        entryDate: new Date(),
        type: 'penalty_collection',
        category,
        amount,
        description: `Penalty collected — ${penalty.loan.loanCode}`,
        referenceType: 'penalty',
        referenceId: penaltyId,
        createdBy: userId,
      },
    });

    // Same rule and same best-effort guard as a loan collection's float credit.
    if (paymentMode === 'cash') {
      try {
        await creditPenaltyCollection(tx, { tenantId, appType, agentId: collectedById, amount, accountEntryId: entry.id });
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
          accountEntryId: entry.id,
        }),
      },
    });

    return { updated: row, accountEntry: entry };
  });

  await autoPostPenaltyCollection({
    tenantId,
    appType,
    entryId: accountEntry.id,
    loanCode: penalty.loan.loanCode,
    amount,
    date: accountEntry.entryDate,
    branchId: penalty.loan.branchId,
    createdById: userId,
    paymentMode: category,
  });

  return updated;
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

