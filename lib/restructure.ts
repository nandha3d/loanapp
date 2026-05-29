/**
 * Restructured-rate calculation — single server-side source of truth so every
 * client shows identical figures (no client recomputation). Mirrors the formula
 * the web loan-detail view uses: spread the loan's OUTSTANDING balance across the
 * instalments still collectable from today onward (due today or later AND not
 * fully paid). Missed past dues stay in `outstanding` but are excluded from the
 * denominator, so they redistribute onto the remaining days — letting the
 * borrower finish by the original end date.
 *   • Paid on schedule → rate equals the original per-instalment (no change).
 *   • Missed some days  → rate > original (catch-up spread evenly).
 */

export type RInstalment = {
  dueDate: Date | string;
  dueAmount: unknown;
  receivedAmount: unknown;
};

function startOfDay(value: Date): Date {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function computeRestructure(instalments: RInstalment[], now = new Date()) {
  const today = startOfDay(now);
  let outstanding = 0;
  let remainingCollectableCount = 0;
  for (const i of instalments) {
    const due = Number(i.dueAmount);
    const received = Number(i.receivedAmount ?? 0);
    if (due - received > 0) outstanding += due - received;
    const dueDay = startOfDay(new Date(i.dueDate));
    if (dueDay.getTime() >= today.getTime() && received < due) {
      remainingCollectableCount += 1;
    }
  }
  const restructuredRate =
    outstanding <= 0
      ? 0
      : Math.round((outstanding / (remainingCollectableCount > 0 ? remainingCollectableCount : 1)) * 100) / 100;
  return { restructuredRate, outstanding, remainingCollectableCount };
}

/**
 * Per-instalment amount to display when "restructured rate" is on: the spread
 * rate for still-collectable (due today/later, unpaid) instalments, otherwise
 * the instalment's own due amount (paid/missed/past rows are unchanged).
 */
export function restructuredAmountFor(
  inst: RInstalment,
  restructuredRate: number,
  now = new Date(),
): number {
  const today = startOfDay(now);
  const due = Number(inst.dueAmount);
  const received = Number(inst.receivedAmount ?? 0);
  const dueDay = startOfDay(new Date(inst.dueDate));
  const collectable = dueDay.getTime() >= today.getTime() && received < due;
  return collectable && restructuredRate > 0 ? restructuredRate : due;
}
