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
 * "Extend days" projection (the DEFAULT model): keep paying the normal
 * per-instalment amount, and let the finish date slide out by one period for
 * every unpaid due. Pure/derived from the outstanding balance — no DB mutation.
 *
 *   remainingPayments = ceil(outstanding / perInstalment)   (last one = finalPartial)
 *   projectedEndDate  = today + (remainingPayments - 1) periods
 *   extraPeriods      = remainingPayments - (unpaid instalments dated today-or-later)
 *                       = how many days the term grows beyond the original schedule
 *
 * Paying (full/partial) lowers `outstanding` → fewer remaining payments → finish
 * pulls in. An unpaid day advances `today` → finish slides +1.
 */
export function computeExtendedSchedule(
  instalments: RInstalment[],
  perInstalment: number,
  frequency: string,
  now = new Date(),
) {
  const today = startOfDay(now);
  // Outstanding is CASH-based (total due − total received), not the sum of
  // per-instalment shortfalls. Those differ when a payment overpays one
  // instalment while an older one is still unpaid (e.g. ₹400 booked on today's
  // ₹200 row clears yesterday's miss in cash but leaves that row's shortfall on
  // the books) — the per-row sum would phantom-extend the term by a day even
  // though every due rupee up to now is paid.
  let totalDue = 0;
  let totalReceived = 0;
  let futureUnpaid = 0; // instalments dated today-or-later still short of cash
  for (const i of instalments) {
    const due = Number(i.dueAmount);
    const received = Number(i.receivedAmount ?? 0);
    totalDue += due;
    totalReceived += received;
    if (due - received > 0 && startOfDay(new Date(i.dueDate)).getTime() >= today.getTime()) {
      futureUnpaid += 1;
    }
  }
  const outstanding = Math.max(0, totalDue - totalReceived);

  const per = perInstalment > 0 ? perInstalment : 1;
  const remainingPayments = Math.ceil(outstanding / per);
  const finalPartial = remainingPayments > 0
    ? Math.round((outstanding - (remainingPayments - 1) * per) * 100) / 100
    : 0;

  const step = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : frequency === 'monthly' ? 30 : 1;
  const projectedDates: Date[] = [];
  for (let k = 0; k < remainingPayments; k++) {
    const d = new Date(today);
    if (frequency === 'monthly') d.setMonth(d.getMonth() + k);
    else d.setDate(d.getDate() + k * step);
    projectedDates.push(d);
  }
  const projectedEndDate = projectedDates.length ? projectedDates[projectedDates.length - 1] : today;

  return {
    outstanding: Math.round(outstanding * 100) / 100,
    remainingPayments,
    finalPartial,
    projectedDates,
    projectedEndDate,
    extraPeriods: Math.max(0, remainingPayments - futureUnpaid),
  };
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
