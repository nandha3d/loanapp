export type CollectionSummaryInput = {
  dueDate: Date | string;
  dueAmount: number | string | { toString(): string } | null | undefined;
  receivedAmount?: number | string | { toString(): string } | null;
  status?: string | null;
};

export type CollectionSummary = {
  todayExpected: number;
  todayCollected: number;
  todayOutstanding: number;
  todayPendingCount: number;
  todayPaidCount: number;
  overdueTotalTillToday: number;
  overdueCollectedToday: number;
  overdueOutstanding: number;
  overduePendingCount: number;
};

function money(value: CollectionSummaryInput['dueAmount']): number {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function outstanding(row: CollectionSummaryInput): number {
  return Math.max(0, money(row.dueAmount) - money(row.receivedAmount));
}

export function summarizeCollectionWorklist(args: {
  todayRows: CollectionSummaryInput[];
  overdueRows: CollectionSummaryInput[];
  overdueCollectedToday?: number;
}): CollectionSummary {
  const todayExpected = args.todayRows.reduce((sum, row) => sum + money(row.dueAmount), 0);
  const todayCollected = args.todayRows.reduce(
    (sum, row) => sum + Math.min(money(row.receivedAmount), money(row.dueAmount)),
    0,
  );
  const todayOutstanding = args.todayRows.reduce((sum, row) => sum + outstanding(row), 0);
  const todayPendingCount = args.todayRows.filter((row) => outstanding(row) > 0).length;
  const todayPaidCount = args.todayRows.filter((row) => outstanding(row) <= 0 && money(row.receivedAmount) > 0).length;

  const overdueOutstanding = args.overdueRows.reduce((sum, row) => sum + outstanding(row), 0);
  const overdueCollectedToday = Math.max(0, money(args.overdueCollectedToday ?? 0));

  return {
    todayExpected,
    todayCollected,
    todayOutstanding,
    todayPendingCount,
    todayPaidCount,
    overdueTotalTillToday: overdueOutstanding + overdueCollectedToday,
    overdueCollectedToday,
    overdueOutstanding,
    overduePendingCount: args.overdueRows.filter((row) => outstanding(row) > 0).length,
  };
}
