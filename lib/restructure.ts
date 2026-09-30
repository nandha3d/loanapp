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

export type ExtendedScheduleRow = {
  no: number;
  date: Date;
  amount: number;
  receivedAmount: number;
  status: 'paid' | 'partial' | 'missed' | 'due today' | 'projected';
  receivedAt?: Date | string | null;
  collectionEntryId?: string | null;
  paymentMode?: string | null;
};

export type ExtendedScheduleResult = {
  outstanding: number;
  remainingPayments: number;
  finalPartial: number;
  projectedDates: Date[];
  projectedEndDate: Date;
  extraPeriods: number;
  extendedRows: ExtendedScheduleRow[];
};

function toBusinessDayStr(value: Date | string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(ist.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
 * When the original schedule finish date is reached or passed:
 * Continuous calendar periods extend past the scheduled date finish until the
 * loan is settled. Elapsed past dates without collection are marked 'missed' (Overdue),
 * today is marked 'due today' (Overdue / Pay button), future dates are 'projected',
 * and any extended date with a collection is marked 'paid'.
 */
export function computeExtendedSchedule(
  instalments: RInstalment[],
  perInstalment: number,
  frequency: string,
  now = new Date(),
  collections: Array<{
    id?: string;
    receivedAmount: unknown;
    submittedAt?: Date | string | null;
    collectionDate?: Date | string | null;
    dueDate?: Date | string | null;
    paymentMode?: string | null;
  }> = [],
): ExtendedScheduleResult {
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
  let lastScheduledDate: Date | null = null;

  for (const i of instalments) {
    const due = Number(i.dueAmount);
    const received = Number(i.receivedAmount ?? 0);
    totalDue += due;
    totalReceived += received;
    const dueDay = startOfDay(new Date(i.dueDate));
    if (!lastScheduledDate || dueDay.getTime() > lastScheduledDate.getTime()) {
      lastScheduledDate = dueDay;
    }
    if (due - received > 0 && dueDay.getTime() >= today.getTime()) {
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
  const isScheduleFinished = lastScheduledDate ? lastScheduledDate.getTime() < today.getTime() : false;

  function addStep(base: Date, k: number): Date {
    const d = new Date(base);
    if (frequency === 'monthly') d.setMonth(d.getMonth() + k);
    else d.setDate(d.getDate() + k * step);
    return startOfDay(d);
  }

  const projectedDates: Date[] = [];
  if (outstanding > 0) {
    if (isScheduleFinished && lastScheduledDate) {
      // 1. Elapsed periods past the scheduled finish date up to today
      let cur = addStep(lastScheduledDate, 1);
      while (cur.getTime() < today.getTime()) {
        projectedDates.push(new Date(cur));
        cur = addStep(cur, 1);
      }
      // 2. Today and future payments needed from today onward to settle outstanding balance
      for (let k = 0; k < remainingPayments; k++) {
        projectedDates.push(addStep(today, k));
      }
    } else if (lastScheduledDate) {
      // Schedule is still ongoing. Only extra periods needed past the scheduled end are projected.
      const extraPeriods = Math.max(0, remainingPayments - futureUnpaid);
      for (let k = 1; k <= extraPeriods; k++) {
        projectedDates.push(addStep(lastScheduledDate, k));
      }
    }
  }

  const projectedEndDate = projectedDates.length
    ? projectedDates[projectedDates.length - 1]
    : (lastScheduledDate ?? today);

  // Build extended rows with accurate status, amounts, and collection links
  const startNo = instalments.length + 1;
  const extendedRows: ExtendedScheduleRow[] = [];

  for (let idx = 0; idx < projectedDates.length; idx++) {
    const date = projectedDates[idx];
    const rowAmt = (idx === projectedDates.length - 1 && finalPartial > 0) ? finalPartial : per;
    const dateKey = toBusinessDayStr(date);

    // Match collections received on this extended date
    const coll = collections.find((c) => {
      const cDate = c.submittedAt || c.collectionDate || c.dueDate;
      return cDate ? toBusinessDayStr(cDate) === dateKey : false;
    });

    let status: ExtendedScheduleRow['status'] = 'projected';
    let recAmt = 0;
    let recAt: Date | string | null = null;
    let collId: string | null = null;
    let mode: string | null = null;

    if (coll && Number(coll.receivedAmount || 0) > 0) {
      recAmt = Number(coll.receivedAmount);
      status = recAmt >= rowAmt ? 'paid' : 'partial';
      recAt = coll.submittedAt || coll.collectionDate || null;
      collId = coll.id || null;
      mode = coll.paymentMode || null;
    } else {
      const dateTime = startOfDay(date).getTime();
      if (dateTime < today.getTime()) {
        status = 'missed';
      } else if (dateTime === today.getTime()) {
        status = 'due today';
      } else {
        status = 'projected';
      }
    }

    extendedRows.push({
      no: startNo + idx,
      date,
      amount: rowAmt,
      receivedAmount: recAmt,
      status,
      receivedAt: recAt,
      collectionEntryId: collId,
      paymentMode: mode,
    });
  }

  return {
    outstanding: Math.round(outstanding * 100) / 100,
    remainingPayments,
    finalPartial,
    projectedDates,
    projectedEndDate,
    extraPeriods: isScheduleFinished ? projectedDates.length : Math.max(0, remainingPayments - futureUnpaid),
    extendedRows,
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

