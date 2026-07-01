/**
 * Restructured-rate calculation — single server-side source of truth so every
 * client shows identical figures (no client recomputation).
 *
 * Model: spread the ENTIRE outstanding balance evenly across the actual
 * remaining periods left until the loan's original end date:
 *
 *     rate = outstanding / actualRemainingCount
 *
 * where actualRemainingCount is derived from calendar days to loan.endDate,
 * bucketed by frequency (daily = days, weekly = ceil(days/7), monthly =
 * ceil(days/30)). Matches the web loan-detail page's "keep tenure, higher
 * rate" calculation exactly.
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

export function computeRestructure(
  instalments: RInstalment[],
  frequency: string,
  endDate: Date | string | null,
  now = new Date(),
) {
  const today = startOfDay(now);

  let outstanding = 0;
  for (const i of instalments) {
    const due = Number(i.dueAmount);
    const received = Number(i.receivedAmount ?? 0);
    outstanding += Math.max(0, due - received);
  }

  // Matches the web page's own fallback when a loan has no endDate.
  const end = startOfDay(endDate ? new Date(endDate) : now);
  const calendarDays = Math.ceil((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  let actualRemainingCount = 0;
  if (calendarDays > 0) {
    if (frequency === 'weekly') {
      actualRemainingCount = Math.max(1, Math.ceil(calendarDays / 7));
    } else if (frequency === 'monthly') {
      actualRemainingCount = Math.max(1, Math.ceil(calendarDays / 30));
    } else {
      actualRemainingCount = Math.max(1, calendarDays);
    }
  }

  const divisor = actualRemainingCount || 1;
  const restructuredRate = Math.round((outstanding / divisor) * 100) / 100;

  return { restructuredRate, outstanding, remainingPeriods: actualRemainingCount };
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
