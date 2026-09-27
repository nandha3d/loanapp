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
