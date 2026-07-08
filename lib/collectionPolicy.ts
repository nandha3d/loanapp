export const COLLECTIBLE_LOAN_STATUSES = ['active', 'overdue'] as const;

export function canCollectForLoanStatus(status: string | null | undefined): boolean {
  return COLLECTIBLE_LOAN_STATUSES.includes(status as (typeof COLLECTIBLE_LOAN_STATUSES)[number]);
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istDateParts(d: Date) {
  const x = new Date(d.getTime() + IST_OFFSET_MS);
  const y = x.getUTCFullYear();
  const m = x.getUTCMonth();
  const day = x.getUTCDate();
  return { y, m, day, ms: Date.UTC(y, m, day) };
}

/**
 * Is `today` a collection day for an instalment of the given frequency?
 *
 * Daily loans are collected every day. Weekly/biweekly/monthly loans are only
 * collected on their cadence date — so an overdue weekly customer resurfaces in
 * the agent's worklist once a week (on their weekday), NOT every single day.
 * Without this the agent would be told to chase every non-daily customer daily.
 *
 * Anchored on the instalment's own due date, so all of a loan's overdue
 * instalments (which share a weekday / day-of-month) surface together on the
 * cadence day. `today` is the IST-midnight instant from `startOfBusinessToday`.
 */
export function isCollectionDay(
  frequency: string | null | undefined,
  dueDate: Date,
  today: Date,
): boolean {
  const f = (frequency || 'daily').toLowerCase();
  if (f === 'daily') return true;

  const due = istDateParts(dueDate);
  const tod = istDateParts(today);
  const diffDays = Math.round((tod.ms - due.ms) / 86_400_000);
  // Due today (or a future-dated anchor) always shows.
  if (diffDays <= 0) return true;

  if (f === 'weekly') return diffDays % 7 === 0;
  if (f === 'biweekly') return diffDays % 14 === 0;
  if (f === 'monthly') {
    const lastDayThisMonth = new Date(Date.UTC(tod.y, tod.m + 1, 0)).getUTCDate();
    // Same day-of-month, or month-end clamp when the due day exceeds this month.
    return tod.day === due.day || (tod.day === lastDayThisMonth && due.day > lastDayThisMonth);
  }
  return true;
}

/**
 * Loan-level collectibility — does the loan's status permit any collection?
 * Used by the loan-distribution path, which spreads one payment across many
 * instalments, so the per-instalment "already collected" check doesn't apply.
 */
export function getLoanCollectionBlockReason(status: string | null | undefined): string | null {
  if (status === 'pending_review') {
    return 'Loan is pending approval';
  }

  if (status === 'closed' || status === 'foreclosed' || status === 'settled') {
    return 'Loan is closed';
  }

  if (!canCollectForLoanStatus(status)) {
    return 'Loan is not active for collection';
  }

  return null;
}

export function getCollectionSubmissionBlockReason(input: {
  loanStatus: string | null | undefined;
  dueAmount: number;
  receivedAmount: number;
}): string | null {
  const loanBlock = getLoanCollectionBlockReason(input.loanStatus);
  if (loanBlock) return loanBlock;

  if (input.receivedAmount >= input.dueAmount) {
    return 'Instalment is already fully collected';
  }

  return null;
}

function normalizeAmount(value: number): string {
  return Number(value).toFixed(2);
}

export function buildCollectionIdempotencyKey(input: {
  tenantId: string;
  agentId: string;
  instalmentId: string;
  receivedAmount: number;
  paymentMode: string;
  collectionDate: Date | string;
}): string {
  const date = input.collectionDate instanceof Date
    ? input.collectionDate.toISOString().slice(0, 10)
    : String(input.collectionDate).slice(0, 10);
  return [
    input.tenantId,
    input.agentId,
    input.instalmentId,
    normalizeAmount(input.receivedAmount),
    input.paymentMode.trim().toLowerCase(),
    date,
  ].join(':');
}
