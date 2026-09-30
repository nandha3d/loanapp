import assert from 'node:assert/strict';
import {
  buildOverdueAgeing,
  daysOverdue,
  parseAgeingEdges,
  topOverdueCustomers,
  DEFAULT_AGEING_BUCKETS,
} from '../lib/dashboard/overdueInsights';

// "Now" = 30 Sep 2026, 10:00 IST (04:30 UTC). Due dates are stored as UTC
// midnight of the business day.
const now = new Date('2026-09-30T04:30:00.000Z');
const due = (day: string) => new Date(`${day}T00:00:00.000Z`);

// --- daysOverdue: business-day difference, IST-aware ---
assert.equal(daysOverdue(due('2026-09-17'), now), 13, '17 Sep → 13 days on 30 Sep');
assert.equal(daysOverdue(due('2026-09-29'), now), 1, 'yesterday → 1 day');
assert.equal(daysOverdue(due('2026-09-30'), now), 0, 'due today → 0');
assert.equal(daysOverdue(due('2026-10-02'), now), 0, 'future → clamped to 0');
// 00:30 IST on 1 Oct is still "1 Oct" in business time even though UTC says 30 Sep.
assert.equal(daysOverdue(due('2026-09-30'), new Date('2026-09-30T19:00:00.000Z')), 1, 'IST day flip');

// --- parseAgeingEdges: setting parsing with safe fallback ---
assert.deepEqual(parseAgeingEdges('7,15,30,60,90'), [7, 15, 30, 60, 90]);
assert.deepEqual(parseAgeingEdges(' 30, 7 ,7, x, -3, 0, 15 '), [7, 15, 30], 'sorted, de-duplicated, invalid dropped');
assert.deepEqual(parseAgeingEdges(''), parseAgeingEdges(DEFAULT_AGEING_BUCKETS), 'empty → report default');
assert.deepEqual(parseAgeingEdges(null), [7, 15, 30, 60, 90], 'null → report default');

// --- buildOverdueAgeing: every overdue rupee lands in exactly one bucket ---
const rows = [
  { dueDate: due('2026-09-29'), overdueAmount: 300, customerId: 'a' }, // 1d
  { dueDate: due('2026-09-23'), overdueAmount: 1000, customerId: 'a' }, // 7d (edge, inclusive)
  { dueDate: due('2026-09-22'), overdueAmount: 2000, customerId: 'b' }, // 8d
  { dueDate: due('2026-06-01'), overdueAmount: 500, customerId: 'c' }, // 121d → open bucket
  { dueDate: due('2026-09-20'), overdueAmount: 0, customerId: 'd' }, // fully paid → ignored
];
const ageing = buildOverdueAgeing(rows, [7, 15, 30, 60, 90], now);
assert.equal(ageing.length, 6, 'N edges → N+1 buckets');
assert.deepEqual(ageing.map((b) => [b.from, b.to]), [[1, 7], [8, 15], [16, 30], [31, 60], [61, 90], [91, null]]);
assert.deepEqual(ageing.map((b) => b.amount), [1300, 2000, 0, 0, 0, 500]);
assert.deepEqual(ageing.map((b) => b.count), [2, 1, 0, 0, 0, 1]);
assert.equal(
  ageing.reduce((s, b) => s + b.amount, 0),
  rows.reduce((s, r) => s + r.overdueAmount, 0),
  'ageing total equals overdue total',
);

// --- topOverdueCustomers: aggregated per customer, ranked by amount ---
const top = topOverdueCustomers(rows, 2, now);
assert.deepEqual(top.map((t) => t.customerId), ['b', 'a'], 'ranked by amount, limited');
assert.deepEqual(top[1], { customerId: 'a', amount: 1300, count: 2, maxDaysOverdue: 7 });
assert.equal(topOverdueCustomers(rows, 0, now).length, 0);

console.log('dashboardOverdueInsights: all assertions passed');
