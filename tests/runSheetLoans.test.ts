import assert from 'node:assert/strict';
import { groupRunSheetByLoan, splitLoanAmount } from '../lib/collectionRun';

// DEC-03 (B): a loan-level amount is split over that loan's own dues in sheet
// order (today first, then overdue oldest-first — MONEY-10), on the server.
const split = splitLoanAmount([
  { instalmentId: 'today', outstanding: 100 },
  { instalmentId: 'old', outstanding: 100 },
  { instalmentId: 'older', outstanding: 50.5 },
], 220.25);
assert.deepEqual(split.parts, [
  { instalmentId: 'today', amount: 100 },
  { instalmentId: 'old', amount: 100 },
  { instalmentId: 'older', amount: 20.25 },
]);
assert.equal(split.unapplied, 0);
assert.equal(splitLoanAmount([{ instalmentId: 'a', outstanding: 10 }], 15).unapplied, 5);

// Two loans of one customer stay separate: each total is that loan's dues only.
const row = (loanId: string, instalmentId: string, outstanding: number, daysOverdue: number) => ({
  stopSeq: 1, customerId: 'c1', customerCode: 'C1', name: 'A', phone: null, lat: null, lng: null,
  loanId, loanCode: loanId.toUpperCase(), instalmentId, instalmentNo: 1, dueDate: new Date(),
  dueAmount: outstanding, receivedAmount: 0, outstanding, overdue: daysOverdue > 0, daysOverdue,
});
const loans = groupRunSheetByLoan([row('l1', 'a', 100, 0), row('l2', 'b', 40, 3), row('l1', 'c', 60, 5)]);
assert.equal(loans.length, 2);
assert.deepEqual(loans.map((l) => [l.loanId, l.totalOutstanding, l.dueCount, l.maxDaysOverdue, l.firstInstalmentId]),
  [['l1', 160, 2, 5, 'a'], ['l2', 40, 1, 3, 'b']]);

console.log('run sheet loan grouping and split passed');
