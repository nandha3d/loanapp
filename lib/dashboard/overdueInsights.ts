// Dashboard overdue insights: ageing buckets and top overdue customers.
//
// Pure presentation aggregation over the distribution-adjusted overdue rows the
// dashboard already computes (getDistributedInstalmentsAndMetrics, MONEY-22), so
// the chart totals always equal the Overdue card's "Remaining" figure. No money
// arithmetic happens here — only grouping and summing of `overdueAmount`.

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Same default as the Aging report (`lib/reports/builders/aging.ts`). */
export const DEFAULT_AGEING_BUCKETS = '7,15,30,60,90';

export type OverdueRow = {
  dueDate: Date | string;
  overdueAmount: number;
  customerId: string;
};

export type AgeingBucket = {
  /** Inclusive lower bound in days overdue. */
  from: number;
  /** Inclusive upper bound; null for the open-ended last bucket. */
  to: number | null;
  amount: number;
  count: number;
};

export type TopOverdueCustomer = {
  customerId: string;
  amount: number;
  count: number;
  maxDaysOverdue: number;
};

/** Business (IST) calendar date of an instalment/as-of instant, as a UTC-midnight ms value. */
function businessDayMs(input: Date | string): number {
  const d = typeof input === 'string' ? new Date(input) : input;
  // dueDates are stored as UTC midnight of the business day — take them as-is.
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
}

/** Whole business days between a due date and "now" (0 when due today or later). */
export function daysOverdue(dueDate: Date | string, now: Date = new Date()): number {
  return Math.max(0, Math.round((businessDayMs(now) - businessDayMs(dueDate)) / DAY_MS));
}

/**
 * Parses the `report_aging_buckets` setting ("7,15,30,60,90") into ascending,
 * de-duplicated positive edges. Falls back to the report's default when the
 * setting is empty or unparseable.
 */
export function parseAgeingEdges(setting: string | null | undefined): number[] {
  const parse = (value: string) =>
    Array.from(
      new Set(
        value
          .split(',')
          .map((part) => Number(part.trim()))
          .filter((n) => Number.isInteger(n) && n > 0),
      ),
    ).sort((a, b) => a - b);
  const edges = parse(setting ?? '');
  return edges.length > 0 ? edges : parse(DEFAULT_AGEING_BUCKETS);
}

/** Buckets overdue rows by days past due: 1–e0, e0+1–e1, …, eN+ . */
export function buildOverdueAgeing(rows: OverdueRow[], edges: number[], now: Date = new Date()): AgeingBucket[] {
  const buckets: AgeingBucket[] = edges.map((edge, i) => ({
    from: i === 0 ? 1 : edges[i - 1] + 1,
    to: edge,
    amount: 0,
    count: 0,
  }));
  buckets.push({ from: (edges[edges.length - 1] ?? 0) + 1, to: null, amount: 0, count: 0 });

  for (const row of rows) {
    if (!(row.overdueAmount > 0)) continue;
    const days = Math.max(1, daysOverdue(row.dueDate, now));
    const bucket = buckets.find((b) => b.to === null || days <= b.to)!;
    bucket.amount += row.overdueAmount;
    bucket.count += 1;
  }
  return buckets;
}

/** Customers ranked by total overdue amount (desc), ties broken by oldest due. */
export function topOverdueCustomers(rows: OverdueRow[], limit: number, now: Date = new Date()): TopOverdueCustomer[] {
  const byCustomer = new Map<string, TopOverdueCustomer>();
  for (const row of rows) {
    if (!(row.overdueAmount > 0) || !row.customerId) continue;
    const entry = byCustomer.get(row.customerId) ?? {
      customerId: row.customerId,
      amount: 0,
      count: 0,
      maxDaysOverdue: 0,
    };
    entry.amount += row.overdueAmount;
    entry.count += 1;
    entry.maxDaysOverdue = Math.max(entry.maxDaysOverdue, daysOverdue(row.dueDate, now));
    byCustomer.set(row.customerId, entry);
  }
  return Array.from(byCustomer.values())
    .sort((a, b) => b.amount - a.amount || b.maxDaysOverdue - a.maxDaysOverdue)
    .slice(0, Math.max(0, limit));
}
