type DueRow = { dueAmount: unknown; receivedAmount: unknown };

export function getTodayDueMetrics(rows: DueRow[]) {
  let expected = 0;
  let collected = 0;
  let remaining = 0;
  for (const row of rows) {
    const due = Number(row.dueAmount);
    const paid = Number(row.receivedAmount || 0);
    expected += due;
    collected += Math.min(paid, due);
    remaining += Math.max(0, due - paid);
  }
  const pct = expected > 0 ? Math.min(100, Math.round(collected / expected * 100)) : 0;
  return { expected, collected, remaining, pct };
}

/**
 * Same maths as getTodayDueMetrics over the rows due in [from, to) (DEC-05).
 * Today's figures are this with [startOfBusinessToday, startOfBusinessTomorrow);
 * month-to-date is [first day of the IST month, startOfBusinessTomorrow).
 */
export function getDueMetricsForRange(rows: Array<DueRow & { dueDate: Date | string }>, from: Date, to: Date) {
  return getTodayDueMetrics(
    rows.filter((row) => {
      const due = new Date(row.dueDate).getTime();
      return due >= from.getTime() && due < to.getTime();
    }),
  );
}

/** 00:00 IST on the first day of the IST month containing `today` (UTC instant). */
export function startOfBusinessMonth(today: Date): Date {
  const ist = new Date(today.getTime() + 330 * 60 * 1000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - 330 * 60 * 1000);
}
