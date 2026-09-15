/**
 * Bulk amount allocation ("waterfall") for the Auto Finance EMI receipt.
 *
 * An agent types one lump sum and the system decides where it lands:
 *   1. oldest overdue instalments first — penalty on the row, then the due
 *   2. then upcoming instalments in date order
 *   3. anything left over is reported as an unapplied advance
 *
 * Pure and synchronous so the receipt modal can render a live preview of the
 * same plan the server will commit.
 */

export type WaterfallInstalment = {
  id: string;
  instalmentNo: number;
  dueDate: Date | string;
  dueAmount: number;
  receivedAmount: number;
  status?: string | null;
  /** Unsettled penalty accrued against this row. Pass 0 to waive it. */
  penaltyOutstanding?: number;
};

export type WaterfallBucket = 'penalty' | 'due';

export type WaterfallLine = {
  instalmentId: string;
  instalmentNo: number;
  dueDate: Date;
  bucket: WaterfallBucket;
  /** True when this row was already past its due date on the receipt date. */
  overdue: boolean;
  outstandingBefore: number;
  applied: number;
  outstandingAfter: number;
  /** Whether this bucket is fully settled by the payment. */
  cleared: boolean;
};

export type WaterfallPlan = {
  /** The amount that was offered. */
  amount: number;
  lines: WaterfallLine[];
  penaltyPaid: number;
  duePaid: number;
  /** Money left after every outstanding row is settled — an advance. */
  unapplied: number;
  instalmentsCleared: number;
  penaltiesCleared: number;
  /** Outstanding across all rows once this payment is applied. */
  remainingOutstanding: number;
};

function startOfDay(value: Date | string): Date {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Orders rows the way a recovery desk works a ledger: everything already
 * overdue, oldest first, then the future dues in date order.
 */
function orderForWaterfall(
  instalments: WaterfallInstalment[],
  asOf: Date,
): Array<WaterfallInstalment & { overdue: boolean }> {
  const today = startOfDay(asOf).getTime();
  return instalments
    .filter((row) => row.status !== 'waived')
    .map((row) => ({ ...row, overdue: startOfDay(row.dueDate).getTime() < today }))
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const delta = startOfDay(a.dueDate).getTime() - startOfDay(b.dueDate).getTime();
      if (delta !== 0) return delta;
      return a.instalmentNo - b.instalmentNo;
    });
}

export function planWaterfallAllocation(
  instalments: WaterfallInstalment[],
  amount: number,
  asOf: Date = new Date(),
): WaterfallPlan {
  let remaining = Math.max(0, round2(Number(amount) || 0));
  const lines: WaterfallLine[] = [];
  let penaltyPaid = 0;
  let duePaid = 0;
  let penaltiesCleared = 0;
  let instalmentsCleared = 0;
  let remainingOutstanding = 0;

  for (const row of orderForWaterfall(instalments, asOf)) {
    const dueOutstanding = round2(Math.max(0, Number(row.dueAmount) - Number(row.receivedAmount)));
    const penaltyOutstanding = round2(Math.max(0, Number(row.penaltyOutstanding ?? 0)));
    const dueDate = startOfDay(row.dueDate);

    // Penalty on the row is cleared before the instalment itself.
    if (penaltyOutstanding > 0) {
      const applied = round2(Math.min(penaltyOutstanding, remaining));
      remaining = round2(remaining - applied);
      const after = round2(penaltyOutstanding - applied);
      penaltyPaid = round2(penaltyPaid + applied);
      if (after === 0) penaltiesCleared += 1;
      remainingOutstanding = round2(remainingOutstanding + after);
      if (applied > 0 || after > 0) {
        lines.push({
          instalmentId: row.id,
          instalmentNo: row.instalmentNo,
          dueDate,
          bucket: 'penalty',
          overdue: row.overdue,
          outstandingBefore: penaltyOutstanding,
          applied,
          outstandingAfter: after,
          cleared: after === 0,
        });
      }
    }

    if (dueOutstanding > 0) {
      const applied = round2(Math.min(dueOutstanding, remaining));
      remaining = round2(remaining - applied);
      const after = round2(dueOutstanding - applied);
      duePaid = round2(duePaid + applied);
      if (after === 0) instalmentsCleared += 1;
      remainingOutstanding = round2(remainingOutstanding + after);
      lines.push({
        instalmentId: row.id,
        instalmentNo: row.instalmentNo,
        dueDate,
        bucket: 'due',
        overdue: row.overdue,
        outstandingBefore: dueOutstanding,
        applied,
        outstandingAfter: after,
        cleared: after === 0,
      });
    }
  }

  return {
    amount: round2(Number(amount) || 0),
    lines,
    penaltyPaid,
    duePaid,
    unapplied: remaining,
    instalmentsCleared,
    penaltiesCleared,
    remainingOutstanding,
  };
}

/**
 * Collapses a plan into the per-instalment totals a write path needs, so the
 * server action does not have to re-walk the line items.
 */
export function summarizeWaterfallByInstalment(
  plan: WaterfallPlan,
): Array<{ instalmentId: string; dueApplied: number; penaltyApplied: number }> {
  const byId = new Map<string, { instalmentId: string; dueApplied: number; penaltyApplied: number }>();
  for (const line of plan.lines) {
    if (line.applied <= 0) continue;
    const entry = byId.get(line.instalmentId)
      ?? { instalmentId: line.instalmentId, dueApplied: 0, penaltyApplied: 0 };
    if (line.bucket === 'due') entry.dueApplied = round2(entry.dueApplied + line.applied);
    else entry.penaltyApplied = round2(entry.penaltyApplied + line.applied);
    byId.set(line.instalmentId, entry);
  }
  return [...byId.values()];
}

/**
 * Full settlement figure for the closure modal: everything still owed, with
 * optional flat discounts on interest and penalty before closing.
 */
export type SettlementQuoteInput = {
  principalOutstanding: number;
  interestOutstanding: number;
  penaltyOutstanding: number;
  /** Charges advanced on the hand-loan ledger (seizing, insurance, RTO). */
  chargesOutstanding?: number;
  interestDiscount?: number;
  penaltyDiscount?: number;
};

export type SettlementQuote = {
  principalOutstanding: number;
  interestOutstanding: number;
  penaltyOutstanding: number;
  chargesOutstanding: number;
  interestDiscount: number;
  penaltyDiscount: number;
  totalDiscount: number;
  finalSettlementAmount: number;
};

export function calculateSettlementQuote(input: SettlementQuoteInput): SettlementQuote {
  const principalOutstanding = round2(Math.max(0, Number(input.principalOutstanding) || 0));
  const interestOutstanding = round2(Math.max(0, Number(input.interestOutstanding) || 0));
  const penaltyOutstanding = round2(Math.max(0, Number(input.penaltyOutstanding) || 0));
  const chargesOutstanding = round2(Math.max(0, Number(input.chargesOutstanding) || 0));

  // A discount can never exceed the head it is applied against.
  const interestDiscount = round2(
    Math.min(Math.max(0, Number(input.interestDiscount) || 0), interestOutstanding),
  );
  const penaltyDiscount = round2(
    Math.min(Math.max(0, Number(input.penaltyDiscount) || 0), penaltyOutstanding),
  );

  const totalDiscount = round2(interestDiscount + penaltyDiscount);
  const finalSettlementAmount = round2(
    principalOutstanding
    + interestOutstanding
    + penaltyOutstanding
    + chargesOutstanding
    - totalDiscount,
  );

  return {
    principalOutstanding,
    interestOutstanding,
    penaltyOutstanding,
    chargesOutstanding,
    interestDiscount,
    penaltyDiscount,
    totalDiscount,
    finalSettlementAmount,
  };
}
