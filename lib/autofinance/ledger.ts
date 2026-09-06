/**
 * Due-chart row building for the Customer 360° ledger tab.
 *
 * The HP convention the blueprint asks for is a three-colour chart:
 *   white  — settled money
 *   red    — money that is past its due date and still outstanding
 *   green  — a future instalment
 *
 * A partially paid instalment is shown as TWO rows: a white row for what was
 * collected and a red row for the balance still owed on the same due date.
 */

export type LedgerInstalment = {
  id: string;
  instalmentNo: number;
  dueDate: Date | string;
  dueAmount: number;
  receivedAmount: number;
  receivedAt?: Date | string | null;
  status?: string | null;
  paymentMode?: string | null;
  /** Receipt / voucher reference to print in the chart. */
  receiptNo?: string | null;
  /** Split of the instalment, from the origination schedule. */
  principalComponent?: number | null;
  interestComponent?: number | null;
  /** Penalty still outstanding on this row. */
  penaltyOutstanding?: number | null;
};

export type LedgerTone = 'paid' | 'overdue' | 'upcoming';

export type LedgerRow = {
  key: string;
  instalmentId: string;
  instalmentNo: number;
  dueDate: Date;
  tone: LedgerTone;
  /** True when this row is the paid half of a split instalment. */
  isSplit: boolean;
  /** 'paid' | 'balance' | 'full' — which half of a split row this is. */
  segment: 'paid' | 'balance' | 'full';
  amount: number;
  principal: number;
  interest: number;
  penalty: number;
  receiptNo: string | null;
  paidDate: Date | null;
  paymentMode: string | null;
  /** Loan principal still outstanding after this row, when known. */
  runningBalance: number;
};

function startOfDay(value: Date | string): Date {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Splits an instalment's principal/interest pro-rata for a partial payment. */
function proRate(component: number, part: number, whole: number): number {
  if (whole <= 0) return 0;
  return round2((component * part) / whole);
}

export function buildLedgerRows(
  instalments: LedgerInstalment[],
  options: { asOf?: Date; openingBalance?: number } = {},
): LedgerRow[] {
  const asOf = startOfDay(options.asOf ?? new Date()).getTime();
  const ordered = [...instalments].sort((a, b) => {
    const delta = startOfDay(a.dueDate).getTime() - startOfDay(b.dueDate).getTime();
    return delta !== 0 ? delta : a.instalmentNo - b.instalmentNo;
  });

  let balance = Number(options.openingBalance ?? 0)
    || ordered.reduce((sum, row) => sum + Number(row.dueAmount), 0);

  const rows: LedgerRow[] = [];

  for (const inst of ordered) {
    const dueDate = startOfDay(inst.dueDate);
    const dueAmount = round2(Number(inst.dueAmount) || 0);
    const received = round2(Math.min(dueAmount, Math.max(0, Number(inst.receivedAmount) || 0)));
    const outstanding = round2(dueAmount - received);
    const isPastDue = dueDate.getTime() < asOf;
    const penalty = round2(Number(inst.penaltyOutstanding ?? 0) || 0);
    const principal = round2(Number(inst.principalComponent ?? 0) || 0);
    const interest = round2(Number(inst.interestComponent ?? 0) || 0);
    const paidDate = inst.receivedAt ? new Date(inst.receivedAt) : null;
    const receiptNo = inst.receiptNo ?? null;

    // Waived rows are informational only — no money, no colour weighting.
    if (inst.status === 'waived') {
      balance = round2(balance - dueAmount);
      rows.push({
        key: `${inst.id}:waived`,
        instalmentId: inst.id,
        instalmentNo: inst.instalmentNo,
        dueDate,
        tone: 'paid',
        isSplit: false,
        segment: 'full',
        amount: 0,
        principal: 0,
        interest: 0,
        penalty: 0,
        receiptNo,
        paidDate,
        paymentMode: inst.paymentMode ?? null,
        runningBalance: Math.max(0, balance),
      });
      continue;
    }

    const isPartial = received > 0 && outstanding > 0;

    if (isPartial) {
      // White half — what was actually collected.
      balance = round2(balance - received);
      rows.push({
        key: `${inst.id}:paid`,
        instalmentId: inst.id,
        instalmentNo: inst.instalmentNo,
        dueDate,
        tone: 'paid',
        isSplit: true,
        segment: 'paid',
        amount: received,
        principal: proRate(principal, received, dueAmount),
        interest: proRate(interest, received, dueAmount),
        penalty: 0,
        receiptNo,
        paidDate,
        paymentMode: inst.paymentMode ?? null,
        runningBalance: Math.max(0, balance),
      });

      // Red (or green) half — the balance still riding on the same due date.
      balance = round2(balance - outstanding);
      rows.push({
        key: `${inst.id}:balance`,
        instalmentId: inst.id,
        instalmentNo: inst.instalmentNo,
        dueDate,
        tone: isPastDue ? 'overdue' : 'upcoming',
        isSplit: true,
        segment: 'balance',
        amount: outstanding,
        principal: proRate(principal, outstanding, dueAmount),
        interest: proRate(interest, outstanding, dueAmount),
        penalty,
        receiptNo: null,
        paidDate: null,
        paymentMode: null,
        runningBalance: Math.max(0, balance),
      });
      continue;
    }

    const tone: LedgerTone = outstanding === 0
      ? 'paid'
      : isPastDue
        ? 'overdue'
        : 'upcoming';

    balance = round2(balance - dueAmount);
    rows.push({
      key: `${inst.id}:full`,
      instalmentId: inst.id,
      instalmentNo: inst.instalmentNo,
      dueDate,
      tone,
      isSplit: false,
      segment: 'full',
      amount: dueAmount,
      principal,
      interest,
      penalty: tone === 'paid' ? 0 : penalty,
      receiptNo,
      paidDate,
      paymentMode: inst.paymentMode ?? null,
      runningBalance: Math.max(0, balance),
    });
  }

  return rows;
}

export type LedgerTotals = {
  totalDue: number;
  totalPaid: number;
  totalOverdue: number;
  totalUpcoming: number;
  totalPenalty: number;
  overdueRows: number;
};

export function summarizeLedger(rows: LedgerRow[]): LedgerTotals {
  const totals: LedgerTotals = {
    totalDue: 0,
    totalPaid: 0,
    totalOverdue: 0,
    totalUpcoming: 0,
    totalPenalty: 0,
    overdueRows: 0,
  };
  for (const row of rows) {
    totals.totalDue = round2(totals.totalDue + row.amount);
    totals.totalPenalty = round2(totals.totalPenalty + row.penalty);
    if (row.tone === 'paid') totals.totalPaid = round2(totals.totalPaid + row.amount);
    else if (row.tone === 'overdue') {
      totals.totalOverdue = round2(totals.totalOverdue + row.amount);
      totals.overdueRows += 1;
    } else totals.totalUpcoming = round2(totals.totalUpcoming + row.amount);
  }
  return totals;
}
