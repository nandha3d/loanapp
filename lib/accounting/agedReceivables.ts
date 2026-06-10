import prisma from '@/lib/db';

export type AgedBucket = 'current' | '1_30' | '31_60' | '61_90' | '91_180' | 'over_180';

export interface AgedReceivableRow {
  customerId: string;
  customerName: string;
  loanId: string;
  loanCode: string;
  dueDate: Date;
  daysOverdue: number;
  outstanding: number;
  bucket: AgedBucket;
}

export type AgedSummary = Record<AgedBucket, { count: number; amount: number }>;

function getBucket(daysOverdue: number): AgedBucket {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return '1_30';
  if (daysOverdue <= 60) return '31_60';
  if (daysOverdue <= 90) return '61_90';
  if (daysOverdue <= 180) return '91_180';
  return 'over_180';
}

/**
 * Aged receivables: outstanding instalment amounts bucketed by days overdue.
 * Buckets follow RBI SMA/NPA-relevant cut-offs (30/60/90/180).
 */
export async function getAgedReceivables(params: {
  tenantId: string;
  asOfDate?: Date;
  branchId?: string | null;
}): Promise<{ rows: AgedReceivableRow[]; summary: AgedSummary; asOf: Date }> {
  const asOf = params.asOfDate ?? new Date();

  const instalments = await prisma.instalment.findMany({
    where: {
      dueDate: { lte: asOf },
      status: { in: ['upcoming', 'partial', 'missed'] },
      loan: {
        tenantId: params.tenantId,
        status: { in: ['active', 'overdue'] },
        deletedAt: null,
        ...(params.branchId ? { branchId: params.branchId } : {}),
      },
    },
    select: {
      dueDate: true,
      dueAmount: true,
      receivedAmount: true,
      loan: {
        select: {
          id: true,
          loanCode: true,
          customer: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
    take: 50_000,
  });

  const rows: AgedReceivableRow[] = [];
  for (const inst of instalments) {
    const outstanding = Number(inst.dueAmount) - Number(inst.receivedAmount);
    if (outstanding <= 0.01) continue;

    const daysOverdue = Math.max(
      0,
      Math.floor((asOf.getTime() - inst.dueDate.getTime()) / 86_400_000),
    );

    rows.push({
      customerId: inst.loan.customer.id,
      customerName: inst.loan.customer.name,
      loanId: inst.loan.id,
      loanCode: inst.loan.loanCode ?? inst.loan.id,
      dueDate: inst.dueDate,
      daysOverdue,
      outstanding,
      bucket: getBucket(daysOverdue),
    });
  }

  const empty = () => ({ count: 0, amount: 0 });
  const summary: AgedSummary = {
    current: empty(),
    '1_30': empty(),
    '31_60': empty(),
    '61_90': empty(),
    '91_180': empty(),
    over_180: empty(),
  };
  for (const row of rows) {
    summary[row.bucket].count += 1;
    summary[row.bucket].amount += row.outstanding;
  }

  return { rows, summary, asOf };
}
