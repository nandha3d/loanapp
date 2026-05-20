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
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
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

  const today = startOfDay(now);
  
  // Calculate total collected across all instalments
  const totalCollected = instalments.reduce((sum, inst) => sum + asNumber(inst.receivedAmount), 0);

  // Preserve ACTUAL allocations instead of forcing chronological redistribution
  const allocations = instalments.map((inst) => {
    const dueAmount = asNumber(inst.dueAmount);
    const receivedAmount = asNumber(inst.receivedAmount);
    const outstandingAmount = Math.max(0, dueAmount - receivedAmount);
    const dueDate = startOfDay(new Date(inst.dueDate));
    const daysOverdue = Math.max(
      0,
      Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)),
    );
    const isPastDue = dueDate.getTime() < today.getTime();
    
    // Recalculate status based on actual received amount
    const status = inst.status === 'waived'
      ? 'waived'
      : receivedAmount >= dueAmount
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

  summary.loanStatus = (summary.paidCount + instalments.filter(i => i.status === 'waived').length) === instalments.length && instalments.length > 0
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
