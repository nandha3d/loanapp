import type { Prisma, PrismaClient } from '@prisma/client';

export type AllocationInputInstalment = {
  id: string;
  instalmentNo: number;
  dueDate: Date | string;
  dueAmount: number | Prisma.Decimal | string;
};

export type AllocatedInstalment = AllocationInputInstalment & {
  dueAmount: number;
  receivedAmount: number;
  outstandingAmount: number;
  overdueAmount: number;
  daysOverdue: number;
  status: 'paid' | 'partial' | 'missed' | 'upcoming';
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

  return [...instalments].sort(compareInstalments).map((instalment) => {
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
    const status = receivedAmount >= dueAmount
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
  const [instalments, entries] = await Promise.all([
    tx.instalment.findMany({
      where: { loanId },
      orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
      select: { id: true, instalmentNo: true, dueDate: true, dueAmount: true },
    }),
    tx.collectionEntry.findMany({
      where: { loanId },
      select: { receivedAmount: true },
    }),
  ]);

  const totalCollected = entries.reduce((sum, entry) => sum + Number(entry.receivedAmount), 0);
  const allocations = allocatePaymentsAcrossInstalments(instalments, totalCollected, now);
  const summary = summarizeAllocations(allocations);

  for (const allocation of allocations) {
    await tx.instalment.update({
      where: { id: allocation.id },
      data: {
        receivedAmount: allocation.receivedAmount,
        status: allocation.status,
        receivedAt: allocation.receivedAmount > 0 ? now : null,
      },
    });
  }

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
  const beforeMap = new Map(before.map((item) => [item.id, item.receivedAmount]));
  const changed = after
    .filter((item) => item.receivedAmount > (beforeMap.get(item.id) || 0))
    .map((item) => `#${item.instalmentNo} ${item.status} ${item.receivedAmount}/${item.dueAmount}`);

  return changed.length > 0
    ? `Auto-allocated across instalments: ${changed.join(', ')}`
    : 'Payment recorded; no instalment allocation changed.';
}
