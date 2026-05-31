/**
 * Restructured-rate calculation — single server-side source of truth so every
 * client shows identical figures (no client recomputation).
 *
 * Model: keep paying the normal per-period instalment, and spread ONLY the
 * backlog (dues pending up to today) evenly across the remaining periods:
 *
 *     rate = perInstalment + (overdueTillDate / remainingPeriods)
 *
 *   • Paid on schedule → overdueTillDate = 0 → rate = perInstalment (no change).
 *   • Fell behind      → rate slightly above the normal due, so the borrower
 *                        clears the backlog by the original end date.
 * Frequency-agnostic: "periods" are days/weeks/months per the schedule.
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
  let overdueTillDate = 0; // outstanding on instalments due ON/BEFORE today
  let remainingPeriods = 0; // unpaid instalments due AFTER today (the days left)
  let perInstalment = 0; // representative normal due (a future unpaid instalment)
  let outstanding = 0;

  for (const i of instalments) {
    const due = Number(i.dueAmount);
    const received = Number(i.receivedAmount ?? 0);
    const out = Math.max(0, due - received);
    if (out <= 0) continue;
    outstanding += out;
    const dueDay = startOfDay(new Date(i.dueDate));
    if (dueDay.getTime() < today.getTime()) {
      // Strictly BEFORE today = backlog (dues pending). Today itself is a
      // remaining day the borrower still pays.
      overdueTillDate += out;
    } else {
      remainingPeriods += 1;
      if (perInstalment === 0) perInstalment = due;
    }
  }

  // No future periods left (term elapsed): nothing to spread into — fall back to
  // an even split of whatever is still outstanding.
  if (remainingPeriods === 0) {
    const rate = overdueTillDate > 0 ? overdueTillDate : 0;
    return {
      restructuredRate: Math.round(rate * 100) / 100,
      outstanding,
      remainingPeriods: overdueTillDate > 0 ? 1 : 0,
      overdueTillDate,
    };
  }

  const restructuredRate =
    Math.round((perInstalment + overdueTillDate / remainingPeriods) * 100) / 100;
  return { restructuredRate, outstanding, remainingPeriods, overdueTillDate };
}

/**
 * Per-instalment amount to display when "restructured rate" is on: the spread
 * rate for unpaid instalments due AFTER today (the remaining periods you'll
 * actually pay at the new rate); other rows keep their own due amount.
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
  const remainingUnpaid = dueDay.getTime() >= today.getTime() && received < due;
  return remainingUnpaid && restructuredRate > 0 ? restructuredRate : due;
}
