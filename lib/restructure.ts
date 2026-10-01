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
 * ceil(days/30)). `outstanding` here is Σ(due − received) over the
 * instalments, not totalPayable − totalCollected; the web loan-detail page
 * renders these server figures instead of computing its own (LD-02).
 */

export type RInstalment = {
  dueDate: Date | string;
  dueAmount: unknown;
  receivedAmount: unknown;
  status?: string;
  instalmentNo?: number;
  id?: string;
  collectionEntryId?: string | null;
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

  // The restructured rate spreads the balance over the tenure only. Once the
  // last scheduled due is behind today there is no tenure left to spread over:
  // the loan runs on extended days at the normal rate (EXT-1), so the
  // restructured rate is off in the calculation and in the UI.
  const lastDue = instalments.length
    ? Math.max(...instalments.map((i) => startOfDay(new Date(i.dueDate)).getTime()))
    : null;
  const available = lastDue === null || lastDue >= today.getTime();

  const divisor = actualRemainingCount || 1;
  const restructuredRate = available ? Math.round((outstanding / divisor) * 100) / 100 : 0;

  return {
    restructuredRate,
    outstanding,
    remainingPeriods: available ? actualRemainingCount : 0,
    available,
    /** Periods left to loan.endDate by calendar (not gated by `available`). */
    actualRemainingCount,
  };
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
  /**
   * Instalment whose payment correction edits exactly this day's payment:
   * the day is one collection entry, it is that row's linked entry, and it is
   * the only cash on the row (a correction rewrites the row total and its
   * linked entry). Null when the day is several payments or shares its row.
   */
  editInstalmentId?: string | null;
};

export type TenureLedgerRow = {
  receivedAmount: number;
  status: 'paid' | 'partial' | 'missed' | 'waived';
};

export type ExtendedScheduleResult = {
  outstanding: number;
  remainingPayments: number;
  finalPartial: number;
  projectedDates: Date[];
  projectedEndDate: Date;
  extraPeriods: number;
  extendedRows: ExtendedScheduleRow[];
  /** The original schedule's last due date is behind today. */
  scheduleFinished: boolean;
  /** Tenure-end view of the original rows, aligned to the input; null while the term runs. */
  ledger: TenureLedgerRow[] | null;
};

type LedgerCollection = {
  instalmentId?: string | null;
  receivedAmount: unknown;
  submittedAt?: Date | string | null;
  collectionDate?: Date | string | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Which instalment each collection entry was posted on. The entry does not
 * record it (`Instalment.collectionEntryId` keeps only a row's first entry),
 * but `recordCollection` writes every entry in the same transaction as a
 * Payment + PaymentAllocation for the same amount and mode
 * (`recordPaymentLedger`). The pair is found by amount, mode and creation time
 * within a few seconds. Entries with no pair get `instalmentId: null`, and
 * payments with no entry (corrections, preclosure) are left alone.
 */
export function pairEntriesWithInstalments<E extends {
  receivedAmount: unknown;
  paymentMode?: string | null;
  submittedAt?: Date | string | null;
}>(
  entries: E[],
  payments: Array<{
    amount: unknown;
    paymentMode?: string | null;
    createdAt?: Date | string | null;
    allocations?: Array<{ instalmentId: string }>;
  }>,
): (E & { instalmentId: string | null })[] {
  const WINDOW_MS = 10_000;
  const used = new Set<number>();
  return entries.map((e) => {
    const at = e.submittedAt ? new Date(e.submittedAt).getTime() : NaN;
    const amount = round2(Number(e.receivedAmount || 0));
    let best = -1;
    let bestGap = Infinity;
    payments.forEach((p, idx) => {
      if (used.has(idx) || !p.createdAt || !p.allocations?.length) return;
      if (round2(Number(p.amount || 0)) !== amount) return;
      if ((p.paymentMode ?? null) !== (e.paymentMode ?? null)) return;
      const gap = Math.abs(new Date(p.createdAt).getTime() - at);
      if (gap <= WINDOW_MS && gap < bestGap) {
        best = idx;
        bestGap = gap;
      }
    });
    if (best < 0) return { ...e, instalmentId: null };
    used.add(best);
    return { ...e, instalmentId: payments[best].allocations![0].instalmentId };
  });
}

/**
 * Tenure-end view of the original rows (EXT-1). Once the term is over, a row's
 * misses stay as they were: the unpaid dues move on to the extended days
 * instead. A payment taken after the term is still posted on an original row
 * (EXT-1 creates no instalment rows), so each row shows its posted amount less
 * the collections posted to it after the last scheduled date — that cash is
 * shown once, on the extended day it was collected. Display only — posted
 * amounts are untouched. Returns null while the schedule is still running.
 */
export function computeTenureLedger(
  instalments: (RInstalment & { id?: string })[],
  collections: LedgerCollection[],
  now = new Date(),
): TenureLedgerRow[] | null {
  if (instalments.length === 0) return null;
  const today = startOfDay(now);
  const lastDue = Math.max(...instalments.map((i) => startOfDay(new Date(i.dueDate)).getTime()));
  if (lastDue >= today.getTime()) return null;
  const lastDueKey = toBusinessDayStr(new Date(lastDue));

  const afterTermByRow = new Map<string, number>();
  for (const c of collections) {
    const cDate = c.collectionDate || c.submittedAt;
    if (!c.instalmentId || !cDate || toBusinessDayStr(cDate) <= lastDueKey) continue;
    afterTermByRow.set(c.instalmentId, (afterTermByRow.get(c.instalmentId) ?? 0) + Number(c.receivedAmount || 0));
  }

  return instalments.map((inst) => {
    const posted = Number(inst.receivedAmount ?? 0);
    if (inst.status === 'waived') return { receivedAmount: posted, status: 'waived' as const };
    const atTermEnd = round2(Math.max(0, posted - (inst.id ? afterTermByRow.get(inst.id) ?? 0 : 0)));
    const due = Number(inst.dueAmount);
    return {
      receivedAmount: atTermEnd,
      status: atTermEnd >= due ? 'paid' as const : atTermEnd > 0 ? 'partial' as const : 'missed' as const,
    };
  });
}

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
    instalmentId?: string | null;
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

  // Collections grouped by business day — several entries on one day are
  // summed so the day's row reflects everything received that day.
  const collectedByDay = new Map<string, { amount: number; first: (typeof collections)[number]; count: number }>();
  for (const c of collections) {
    // The business collection date wins over the entry's submission time — a
    // payment typed in on the 30th for the 27th belongs to the 27th.
    const cDate = c.collectionDate || c.submittedAt || c.dueDate;
    const amount = Number(c.receivedAmount || 0);
    if (!cDate || amount <= 0) continue;
    const key = toBusinessDayStr(cDate);
    const slot = collectedByDay.get(key);
    if (slot) {
      slot.amount += amount;
      slot.count += 1;
    } else collectedByDay.set(key, { amount, first: c, count: 1 });
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
      // 2. Payments needed to settle the outstanding balance. When today's
      // period is already collected, it is history (a paid row) and the
      // remaining payments start from the next period — otherwise today would
      // count both as paid and as one of the payments still owed.
      const todayCollected = collectedByDay.has(toBusinessDayStr(today));
      if (todayCollected) projectedDates.push(new Date(today));
      const firstK = todayCollected ? 1 : 0;
      for (let k = firstK; k < firstK + remainingPayments; k++) {
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

    // Match collections received on this extended date (summed per day)
    const day = collectedByDay.get(dateKey);

    let status: ExtendedScheduleRow['status'] = 'projected';
    let recAmt = 0;
    let recAt: Date | string | null = null;
    let collId: string | null = null;
    let mode: string | null = null;
    let editInstalmentId: string | null = null;

    if (day) {
      const coll = day.first;
      recAmt = Math.round(day.amount * 100) / 100;
      status = recAmt >= rowAmt ? 'paid' : 'partial';
      recAt = coll.submittedAt || coll.collectionDate || null;
      collId = coll.id || null;
      mode = coll.paymentMode || null;
      if (day.count === 1 && coll.instalmentId && coll.id) {
        const row = instalments.find((i) => i.id === coll.instalmentId);
        if (row && row.collectionEntryId === coll.id
          && round2(Number(row.receivedAmount ?? 0)) === round2(recAmt)) {
          editInstalmentId = row.id!;
        }
      }
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
      editInstalmentId,
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
    scheduleFinished: isScheduleFinished,
    ledger: computeTenureLedger(instalments, collections, now),
  };
}

/**
 * Missed days that carry a penalty once the term is over (EXT-1): original
 * rows still missed at the end of the term plus extended days missed since.
 * Null while the term runs — callers keep their own count of missed rows.
 * Shared by the loan page's penalty summary and the pending-penalty accrual
 * (`ensurePendingPenaltiesForMissedLoans`) so both carry the same figure.
 */
export function pastTermMissedDays(ext: ExtendedScheduleResult): number | null {
  if (!ext.ledger) return null;
  return ext.ledger.filter((r) => r.status === 'missed').length
    + ext.extendedRows.filter((r) => r.status === 'missed').length;
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

