import type { Prisma, PrismaClient } from '@prisma/client';

export type AllocationInputInstalment = {
  id: string;
  instalmentNo: number;
  dueDate: Date | string;
  dueAmount: number | Prisma.Decimal | string;
  status?: string;
};

export type AllocatedInstalment = AllocationInputInstalment & {
  dueAmount: number;
  receivedAmount: number;
  outstandingAmount: number;
  overdueAmount: number;
  daysOverdue: number;
  status: 'paid' | 'partial' | 'missed' | 'upcoming' | 'waived';
};

export type ReallocationSummary = {
  paidCount: number;
  totalCollected: number;
  totalDue: number;
  outstandingAmount: number;
  overdueAmount: number;
  overdueCount: number;
  loanStatus: 'active' | 'overdue' | 'closed';
  allocations: AllocatedInstalment[];
};

type PrismaTransaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

function startOfDay(value: Date): Date {
  const d = new Date(value);
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
  } else {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
  }
}

function asNumber(value: number | Prisma.Decimal | string): number {
  return Number(value);
}

/**
 * Checks if a loan has any associated financial activity (e.g. CollectionEntry records).
 * This acts as a guard to prevent modification of schedules that have already been paid against.
 */
export async function hasFinancialActivity(loanId: string): Promise<boolean> {
  // Use dynamic import to avoid circular dependency issues at the module level
  const { default: prismaDb } = await import('@/lib/db');
  const count = await prismaDb.collectionEntry.count({
    where: { loanId },
  });
  return count > 0;
}

function compareInstalments(a: AllocationInputInstalment, b: AllocationInputInstalment): number {
  const dueDelta = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  if (dueDelta !== 0) return dueDelta;
  return a.instalmentNo - b.instalmentNo;
}

export function getInstalmentOutstanding(instalment: Pick<AllocatedInstalment, 'dueAmount' | 'receivedAmount'>): number {
  return Math.max(0, Number(instalment.dueAmount) - Number(instalment.receivedAmount));
}

/**
 * Fill order for a loan-level collection: TODAY'S DUE FIRST, then overdue
 * (oldest first), then future (soonest first). A payment always settles the
 * current day's instalment before any excess starts reducing the arrears —
 * so paying today's amount keeps today clean even when a backlog exists.
 * `now` is the collection's business day.
 */
export function orderInstalmentsForCollectionFill<
  T extends { dueDate: Date | string; instalmentNo: number },
>(instalments: T[], now = new Date()): T[] {
  const today = startOfDay(now).getTime();
  const bucket = (item: T): number => {
    const day = startOfDay(new Date(item.dueDate)).getTime();
    if (day === today) return 0; // today's due
    if (day < today) return 1;   // overdue backlog
    return 2;                    // future (advance payment)
  };
  return [...instalments].sort((a, b) => {
    const delta = bucket(a) - bucket(b);
    if (delta !== 0) return delta;
    const dueDelta = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (dueDelta !== 0) return dueDelta;
    return a.instalmentNo - b.instalmentNo;
  });
}

export function allocatePaymentsAcrossInstalments(
  instalments: AllocationInputInstalment[],
  totalCollected: number,
  now = new Date(),
): AllocatedInstalment[] {
  let remaining = Math.max(0, totalCollected);
  const today = startOfDay(now);
  const sorted = [...instalments].sort(compareInstalments);

  return sorted.map((instalment) => {
    const dueAmount = asNumber(instalment.dueAmount);
    const receivedAmount = Math.min(dueAmount, remaining);
    remaining = Math.max(0, remaining - receivedAmount);

    const outstandingAmount = Math.max(0, dueAmount - receivedAmount);
    const dueDate = startOfDay(new Date(instalment.dueDate));
    const daysOverdue = Math.max(
      0,
      Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)),
    );
    const isPastDue = dueDate.getTime() < today.getTime();
    const status = instalment.status === 'waived'
      ? 'waived'
      : receivedAmount >= dueAmount
        ? 'paid'
        : receivedAmount > 0
          ? 'partial'
          : isPastDue
            ? 'missed'
            : 'upcoming';

    return {
      ...instalment,
      dueAmount,
      receivedAmount,
      outstandingAmount,
      overdueAmount: isPastDue ? outstandingAmount : 0,
      daysOverdue,
      status,
    };
  });
}

export function summarizeAllocations(allocations: AllocatedInstalment[]): ReallocationSummary {
  const paidCount = allocations.filter((item) => item.status === 'paid').length;
  const totalCollected = allocations.reduce((sum, item) => sum + item.receivedAmount, 0);
  const totalDue = allocations.reduce((sum, item) => sum + item.dueAmount, 0);
  const outstandingAmount = allocations.reduce((sum, item) => sum + item.outstandingAmount, 0);
  const overdueAmount = allocations.reduce((sum, item) => sum + item.overdueAmount, 0);
  const overdueCount = allocations.filter((item) => item.overdueAmount > 0).length;
  const loanStatus = paidCount === allocations.length && allocations.length > 0
    ? 'closed'
    : overdueAmount > 0
      ? 'overdue'
      : 'active';

  return {
    paidCount,
    totalCollected,
    totalDue,
    outstandingAmount,
    overdueAmount,
    overdueCount,
    loanStatus,
    allocations,
  };
}

export async function reallocateLoanRepayments(
  tx: PrismaTransaction,
  loanId: string,
  now = new Date(),
): Promise<ReallocationSummary> {
  const [instalments] = await Promise.all([
    tx.instalment.findMany({
      where: { loanId },
      orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
      select: { id: true, instalmentNo: true, dueDate: true, dueAmount: true, receivedAmount: true, receivedAt: true, status: true },
    }),
  ]);

  // Preserve ACTUAL per-instalment payments — money stays on the row it was
  // recorded against (the loan page's "Actual" view and the DB agree; the
  // "Distributed" toggle remains a display-only projection). Loan-level
  // collection writes now preserve that actual row amount; this function only
  // recomputes statuses,
  // overdue figures and the loan status from what each row actually holds.
  const today = startOfDay(now);
  const waived = instalments.filter((i) => i.status === 'waived');
  const payable = instalments.filter((i) => i.status !== 'waived');
  const allocations: AllocatedInstalment[] = payable.map((inst) => {
    const dueAmount = asNumber(inst.dueAmount);
    const receivedAmount = asNumber(inst.receivedAmount);
    const outstandingAmount = Math.max(0, dueAmount - receivedAmount);
    const dueDate = startOfDay(new Date(inst.dueDate));
    const daysOverdue = Math.max(
      0,
      Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)),
    );
    const isPastDue = dueDate.getTime() < today.getTime();
    const status = receivedAmount >= dueAmount
      ? 'paid'
      : receivedAmount > 0
        ? 'partial'
        : isPastDue
          ? 'missed'
          : 'upcoming';

    return {
      ...inst,
      dueAmount,
      receivedAmount,
      outstandingAmount,
      overdueAmount: isPastDue ? outstandingAmount : 0,
      daysOverdue,
      status,
    };
  });

  const summary = {
    paidCount: 0,
    totalCollected: 0,
    totalDue: instalments.reduce((sum, i) => sum + Number(i.dueAmount), 0),
    outstandingAmount: 0,
    overdueAmount: 0,
    overdueCount: 0,
    loanStatus: 'active' as 'active' | 'overdue' | 'closed',
    allocations: [] as AllocatedInstalment[],
  };

  for (const alloc of allocations) {
    const originalInst = instalments.find((i) => i.id === alloc.id)!;
    const receivedAt = alloc.receivedAmount > 0 ? (originalInst.receivedAt || now) : null;

    await tx.instalment.update({
      where: { id: alloc.id },
      data: {
        receivedAmount: alloc.receivedAmount,
        status: alloc.status,
        receivedAt,
      },
    });

    if (alloc.status === 'paid') summary.paidCount++;
    summary.totalCollected += alloc.receivedAmount;
    summary.outstandingAmount += alloc.outstandingAmount;
    if (alloc.overdueAmount > 0) {
      summary.overdueAmount += alloc.overdueAmount;
      summary.overdueCount++;
    }

    summary.allocations.push({
      ...originalInst,
      dueAmount: alloc.dueAmount,
      receivedAmount: alloc.receivedAmount,
      outstandingAmount: alloc.outstandingAmount,
      overdueAmount: alloc.overdueAmount,
      daysOverdue: alloc.daysOverdue,
      status: alloc.status as "upcoming" | "missed" | "partial" | "paid" | "waived",
    });
  }

  summary.loanStatus = (summary.paidCount + waived.length) === instalments.length && instalments.length > 0
    ? 'closed'
    : summary.overdueAmount > 0
      ? 'overdue'
      : 'active';

  await tx.loan.update({
    where: { id: loanId },
    data: {
      paidCount: summary.paidCount,
      totalCollected: summary.totalCollected,
      status: summary.loanStatus,
      closedAt: summary.loanStatus === 'closed' ? now : null,
    },
  });

  return summary;
}

export function describeAllocationForPayment(
  before: AllocatedInstalment[],
  after: AllocatedInstalment[],
): string {
  // Find which instalment got the payment
  const beforeMap = new Map(before.map((item) => [item.id, item.receivedAmount]));
  const changed = after
    .filter((item) => item.receivedAmount > (beforeMap.get(item.id) || 0))
    .map((item) => {
      const added = item.receivedAmount - (beforeMap.get(item.id) || 0);
      return `#${item.instalmentNo} +₹${added} (Total: ₹${item.receivedAmount}/${item.dueAmount})`;
    });

  return changed.length > 0
    ? `Direct payment applied: ${changed.join(', ')}`
    : 'Payment recorded.';
}

export function getDistributedInstalmentsAndMetrics<
  T extends {
    id: string;
    dueDate: Date | string;
    dueAmount: number | Prisma.Decimal | string;
    receivedAmount: number | Prisma.Decimal | string | null;
    status?: string | null;
    instalmentNo: number;
    loanId: string;
  },
>(
  instalments: T[],
  today: Date,
  paymentsToday: { loanId: string; amount: number | Prisma.Decimal | string }[],
): {
  distributedInstalments: (T & {
    outstandingAmount: number;
    overdueAmount: number;
  })[];
  metricsByLoan: Map<
    string,
    { overdueOutstanding: number; overdueCollectedToday: number; overdueTotalTillToday: number }
  >;
} {
  const waived = instalments.filter((i) => i.status === 'waived');
  const payable = instalments.filter((i) => i.status !== 'waived');

  // Group by loan
  const loanInsts = new Map<string, T[]>();
  for (const inst of payable) {
    if (!loanInsts.has(inst.loanId)) {
      loanInsts.set(inst.loanId, []);
    }
    loanInsts.get(inst.loanId)!.push(inst);
  }

  // Today's date boundary in IST
  const todayStart = startOfDay(today);
  const todayStartTime = todayStart.getTime();
  const todayISO = todayStart.toISOString().slice(0, 10);

  const paymentsTodayMap = new Map<string, number>();
  for (const p of paymentsToday) {
    paymentsTodayMap.set(p.loanId, (paymentsTodayMap.get(p.loanId) ?? 0) + asNumber(p.amount));
  }

  const metricsByLoan = new Map<
    string,
    { overdueOutstanding: number; overdueCollectedToday: number; overdueTotalTillToday: number }
  >();

  const updatedInstalmentsMap = new Map<string, { receivedAmount: number; status: string }>();

  for (const [loanId, insts] of loanInsts.entries()) {
    // Sort: Today's due first, then overdue oldest first, then future.
    insts.sort((a, b) => {
      const bucket = (item: T): number => {
        const itemDate = startOfDay(new Date(item.dueDate)).toISOString().slice(0, 10);
        if (itemDate === todayISO) return 0;
        if (itemDate < todayISO) return 1;
        return 2;
      };
      const delta = bucket(a) - bucket(b);
      if (delta !== 0) return delta;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime() || a.instalmentNo - b.instalmentNo;
    });

    const cToday = paymentsTodayMap.get(loanId) ?? 0;
    const cTotal = insts.reduce((sum, i) => sum + asNumber(i.receivedAmount ?? 0), 0);
    const cYesterday = Math.max(0, cTotal - cToday);

    // Allocate C_yesterday
    let remainingYesterday = cYesterday;
    const beforeAmounts = new Map<string, number>();
    for (const inst of insts) {
      const due = asNumber(inst.dueAmount);
      const rec = Math.min(due, remainingYesterday);
      remainingYesterday = Math.max(0, remainingYesterday - rec);
      beforeAmounts.set(inst.id, rec);
    }

    // Allocate C_total
    let remainingToday = cTotal;
    const afterAmounts = new Map<string, number>();
    for (const inst of insts) {
      const due = asNumber(inst.dueAmount);
      const rec = Math.min(due, remainingToday);
      remainingToday = Math.max(0, remainingToday - rec);
      afterAmounts.set(inst.id, rec);
    }

    let overdueOutstanding = 0;
    let overdueCollectedToday = 0;

    for (const inst of insts) {
      const due = asNumber(inst.dueAmount);
      const before = beforeAmounts.get(inst.id) ?? 0;
      const after = afterAmounts.get(inst.id) ?? 0;

      const dueDate = startOfDay(new Date(inst.dueDate));
      const isPastDue = dueDate.getTime() < todayStartTime;

      if (isPastDue) {
        overdueOutstanding += Math.max(0, due - after);
        overdueCollectedToday += Math.max(0, after - before);
      }

      // Determine in-memory distributed status
      const status = after >= due
        ? 'paid'
        : after > 0
          ? 'partial'
          : isPastDue
            ? 'missed'
            : 'upcoming';

      updatedInstalmentsMap.set(inst.id, { receivedAmount: after, status });
    }

    metricsByLoan.set(loanId, {
      overdueOutstanding,
      overdueCollectedToday,
      overdueTotalTillToday: overdueOutstanding + overdueCollectedToday,
    });
  }

  // Update in-memory instances of all instalments (including waived ones)
  const distributedInstalments = instalments.map((inst) => {
    if (inst.status === 'waived') {
      return {
        ...inst,
        receivedAmount: 0,
        outstandingAmount: 0,
        overdueAmount: 0,
      };
    }
    const update = updatedInstalmentsMap.get(inst.id);
    if (update) {
      const due = asNumber(inst.dueAmount);
      const outstandingAmount = Math.max(0, due - update.receivedAmount);
      const dueDate = startOfDay(new Date(inst.dueDate));
      const isPastDue = dueDate.getTime() < todayStartTime;
      return {
        ...inst,
        receivedAmount: update.receivedAmount,
        outstandingAmount,
        overdueAmount: isPastDue ? outstandingAmount : 0,
        status: update.status,
      };
    }
    const due = asNumber(inst.dueAmount);
    const rec = asNumber(inst.receivedAmount ?? 0);
    const outstandingAmount = Math.max(0, due - rec);
    const dueDate = startOfDay(new Date(inst.dueDate));
    const isPastDue = dueDate.getTime() < todayStartTime;
    return {
      ...inst,
      outstandingAmount,
      overdueAmount: isPastDue ? outstandingAmount : 0,
    };
  });

  return {
    distributedInstalments,
    metricsByLoan,
  };
}
