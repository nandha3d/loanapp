import assert from 'node:assert/strict';
import { orderInstalmentsForCollectionFill } from '../lib/repayments';

// Scenario from the collection convention: ₹800 overdue (8 days) + ₹100 due
// today + future days. A loan-level payment must fill TODAY'S DUE FIRST, then
// the overdue backlog oldest-first, then future instalments.
const day = 24 * 60 * 60 * 1000;
const today = new Date('2026-07-06T00:00:00.000Z');

const instalments = Array.from({ length: 12 }, (_, index) => ({
  id: `inst_${index + 1}`,
  instalmentNo: index + 1,
  // instalments 1-8 overdue, 9 due today, 10-12 future
  dueDate: new Date(today.getTime() + (index - 8) * day),
}));

const ordered = orderInstalmentsForCollectionFill(instalments, today);

assert.deepEqual(
  ordered.map((i) => i.instalmentNo),
  // today's due (#9) first, then overdue oldest-first (#1..#8), then future
  [9, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12],
);

// No today's due (already paid/absent): overdue oldest-first, then future.
const noToday = orderInstalmentsForCollectionFill(
  instalments.filter((i) => i.instalmentNo !== 9),
  today,
);
assert.deepEqual(
  noToday.map((i) => i.instalmentNo),
  [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12],
);

// All future (fresh loan): soonest first.
const fresh = orderInstalmentsForCollectionFill(
  instalments.filter((i) => i.instalmentNo > 9),
  today,
);
assert.deepEqual(fresh.map((i) => i.instalmentNo), [10, 11, 12]);

// Same-day tie falls back to instalmentNo.
const tie = orderInstalmentsForCollectionFill(
  [
    { id: 'b', instalmentNo: 2, dueDate: today },
    { id: 'a', instalmentNo: 1, dueDate: today },
  ],
  today,
);
assert.deepEqual(tie.map((i) => i.instalmentNo), [1, 2]);

console.log('today-first collection fill order tests passed');
