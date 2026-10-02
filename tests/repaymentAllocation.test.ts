import assert from 'node:assert/strict';
import {
  allocatePaymentsAcrossInstalments,
  getInstalmentOutstanding,
} from '../lib/repayments';

const base = new Date('2026-04-14T00:00:00.000Z');
const instalments = Array.from({ length: 8 }, (_, index) => ({
  id: `inst_${index + 1}`,
  instalmentNo: index + 1,
  dueDate: new Date(base.getTime() + index * 24 * 60 * 60 * 1000),
  dueAmount: 110,
}));

const allocated = allocatePaymentsAcrossInstalments(instalments, 44 + 110 + 500, new Date('2026-04-16T12:00:00.000Z'));

assert.deepEqual(
  allocated.map((item) => ({
    no: item.instalmentNo,
    received: item.receivedAmount,
    status: item.status,
    outstanding: item.outstandingAmount,
  })),
  [
    { no: 1, received: 110, status: 'paid', outstanding: 0 },
    { no: 2, received: 110, status: 'paid', outstanding: 0 },
    { no: 3, received: 110, status: 'paid', outstanding: 0 },
    { no: 4, received: 110, status: 'paid', outstanding: 0 },
    { no: 5, received: 110, status: 'paid', outstanding: 0 },
    { no: 6, received: 104, status: 'partial', outstanding: 6 },
    { no: 7, received: 0, status: 'upcoming', outstanding: 110 },
    { no: 8, received: 0, status: 'upcoming', outstanding: 110 },
  ],
);

assert.equal(getInstalmentOutstanding(allocated[5]), 6);

const overdue = allocatePaymentsAcrossInstalments(instalments.slice(0, 3), 100, new Date('2026-04-18T00:00:00.000Z'));
assert.equal(overdue[0].status, 'partial');
assert.equal(overdue[0].daysOverdue, 4);
assert.equal(overdue[0].overdueAmount, 10);
assert.equal(overdue[1].status, 'missed');
assert.equal(overdue[1].overdueAmount, 110);
assert.equal(overdue[2].status, 'missed');
assert.equal(overdue[2].overdueAmount, 110);

// --- Tests for getDistributedInstalmentsAndMetrics (MONEY-22 & MONEY-10) ---
import { getDistributedInstalmentsAndMetrics, distributeScheduleView, distributeExtendedRowsView } from '../lib/repayments';

const todayDate = new Date('2026-09-24T00:00:00.000Z');

// Scenario 1: Historical collections exist, but cToday == 0 (The user defect case)
// Borrower paid #1, #2, #3. Missed #4 (yesterday). Today is #5. Zero collected today.
const testInstalments = [
  { id: 'i1', loanId: 'L1', instalmentNo: 1, dueDate: '2026-09-21T00:00:00.000Z', dueAmount: 300, receivedAmount: 300, status: 'paid' },
  { id: 'i2', loanId: 'L1', instalmentNo: 2, dueDate: '2026-09-22T00:00:00.000Z', dueAmount: 300, receivedAmount: 300, status: 'paid' },
  { id: 'i3', loanId: 'L1', instalmentNo: 3, dueDate: '2026-09-22T00:00:00.000Z', dueAmount: 300, receivedAmount: 300, status: 'paid' },
  { id: 'i4', loanId: 'L1', instalmentNo: 4, dueDate: '2026-09-23T00:00:00.000Z', dueAmount: 300, receivedAmount: 0, status: 'missed' },
  { id: 'i5', loanId: 'L1', instalmentNo: 5, dueDate: '2026-09-24T00:00:00.000Z', dueAmount: 300, receivedAmount: 0, status: 'upcoming' },
];

const resNoPaymentToday = getDistributedInstalmentsAndMetrics(testInstalments, todayDate, []);
const todayRow = resNoPaymentToday.distributedInstalments.find((i) => i.id === 'i5')!;
const missedRow = resNoPaymentToday.distributedInstalments.find((i) => i.id === 'i4')!;

// MONEY-22: Today's instalment must NOT steal from historical payments!
assert.equal(todayRow.receivedAmount, 0, 'Today receivedAmount must be 0 when cToday is 0');
assert.equal(todayRow.outstandingAmount, 300, 'Today outstanding must be 300');
assert.notEqual(todayRow.status, 'paid', 'Today must not be marked paid when cToday is 0');
assert.equal(missedRow.receivedAmount, 0, 'Yesterday row must stay unpaid');
assert.equal(missedRow.status, 'missed', 'Yesterday row must stay missed');

const metricsL1 = resNoPaymentToday.metricsByLoan.get('L1')!;
assert.equal(metricsL1.overdueCollectedToday, 0, 'Overdue collected today must be 0');
assert.equal(metricsL1.overdueOutstanding, 300, 'Overdue outstanding must be 300');

// Scenario 2: Borrower actually pays ₹300 today (cToday == 300)
// Following MONEY-10: Today's due is filled FIRST
const testInstalmentsWithPayment = [
  ...testInstalments.slice(0, 4),
  { id: 'i5', loanId: 'L1', instalmentNo: 5, dueDate: '2026-09-24T00:00:00.000Z', dueAmount: 300, receivedAmount: 300, status: 'paid' },
];
const resWithTodayPayment = getDistributedInstalmentsAndMetrics(
  testInstalmentsWithPayment,
  todayDate,
  [{ loanId: 'L1', amount: 300 }],
);
const todayRowPaid = resWithTodayPayment.distributedInstalments.find((i) => i.id === 'i5')!;
assert.equal(todayRowPaid.receivedAmount, 300, 'Today receivedAmount is 300 when paid today');
assert.equal(todayRowPaid.outstandingAmount, 0, 'Today outstanding is 0');
assert.equal(todayRowPaid.status, 'paid', 'Today status is paid');

// Scenario 3: Borrower pays ₹500 today (covers today's ₹300 + ₹200 towards ₹300 arrears)
const testInstalmentsWith500 = [
  ...testInstalments.slice(0, 4),
  { id: 'i5', loanId: 'L1', instalmentNo: 5, dueDate: '2026-09-24T00:00:00.000Z', dueAmount: 300, receivedAmount: 500, status: 'paid' },
];
const resWith500Payment = getDistributedInstalmentsAndMetrics(
  testInstalmentsWith500,
  todayDate,
  [{ loanId: 'L1', amount: 500 }],
);
const todayRow500 = resWith500Payment.distributedInstalments.find((i) => i.id === 'i5')!;
const arrearsRow500 = resWith500Payment.distributedInstalments.find((i) => i.id === 'i4')!;
assert.equal(todayRow500.receivedAmount, 300, 'Today gets ₹300 first per MONEY-10');
assert.equal(todayRow500.status, 'paid', 'Today is paid');
assert.equal(arrearsRow500.receivedAmount, 200, 'Arrears gets excess ₹200');
assert.equal(arrearsRow500.status, 'partial', 'Arrears becomes partial');
const metrics500 = resWith500Payment.metricsByLoan.get('L1')!;
assert.equal(metrics500.overdueCollectedToday, 200, 'Overdue collected today is ₹200');
assert.equal(metrics500.overdueOutstanding, 100, 'Overdue outstanding is remaining ₹100');

// Scenario 4: Borrower has lifetime collections exceeding all past arrears, but cToday == 0.
// Under MONEY-22, historical collections must NEVER spill over into today's due date when cToday == 0.
const testInstalmentsWithExcessHistorical = [
  { id: 'i1', loanId: 'L2', instalmentNo: 1, dueDate: '2026-09-21T00:00:00.000Z', dueAmount: 300, receivedAmount: 300, status: 'paid' },
  { id: 'i2', loanId: 'L2', instalmentNo: 2, dueDate: '2026-09-22T00:00:00.000Z', dueAmount: 300, receivedAmount: 300, status: 'paid' },
  { id: 'i3', loanId: 'L2', instalmentNo: 3, dueDate: '2026-09-23T00:00:00.000Z', dueAmount: 300, receivedAmount: 300, status: 'paid' },
  { id: 'i4', loanId: 'L2', instalmentNo: 4, dueDate: '2026-09-24T00:00:00.000Z', dueAmount: 300, receivedAmount: 300, status: 'paid' }, // today
];
// cTotal is 1200 across the loan, but 0 was collected today.
const resExcessNoPaymentToday = getDistributedInstalmentsAndMetrics(testInstalmentsWithExcessHistorical, todayDate, []);
const todayRowExcess = resExcessNoPaymentToday.distributedInstalments.find((i) => i.id === 'i4')!;
assert.equal(todayRowExcess.receivedAmount, 0, 'Today receivedAmount must strictly be 0 when cToday is 0 even with historical surplus');
assert.equal(todayRowExcess.outstandingAmount, 300, 'Today outstanding must be full due amount 300');
assert.notEqual(todayRowExcess.status, 'paid', 'Today status must NOT be paid when cToday is 0');

console.log('repayment allocation tests passed');

// DEC-03 (B) Distributed view past the term (EXT-1): 10 days × ₹2000 from
// 16 Sep, days 1–6 paid on time, then ₹2000 taken on extended day 27 Sep.
// The whole ₹14000 is laid over the original rows first, so the 27 Sep cash
// fills day 7 and the extended day itself shows nothing received.
{
  const days = Array.from({ length: 10 }, (_, i) => ({
    dueDate: new Date(Date.UTC(2026, 8, 16 + i)),
    dueAmount: 2000,
    status: 'missed',
  }));
  const receipts = [
    ...Array.from({ length: 6 }, (_, i) => ({ amount: 2000, at: `2026-09-${16 + i}T04:00:00.000Z` })),
    { amount: 2000, at: '2026-09-27T03:53:00.000Z' },
  ];
  const ext = ['2026-09-26', '2026-09-27', '2026-10-02', '2026-10-03'].map((d, i) => ({
    no: 11 + i,
    date: new Date(`${d}T00:00:00.000Z`),
    amount: 2000,
    receivedAmount: d === '2026-09-27' ? 2000 : 0,
    status: d === '2026-09-27' ? 'paid' : 'missed',
    receivedAt: d === '2026-09-27' ? '2026-09-27T03:53:00.000Z' : null,
    collectionEntryId: d === '2026-09-27' ? 'ce7' : null,
    paymentMode: d === '2026-09-27' ? 'cash' : null,
    editInstalmentId: d === '2026-09-27' ? 'inst7' : null,
  }));

  const rows = distributeScheduleView(days, 14000, '2026-10-02', receipts);
  assert.deepEqual(rows.map((r) => r.status), ['paid', 'paid', 'paid', 'paid', 'paid', 'paid', 'paid', 'missed', 'missed', 'missed']);
  assert.equal((rows[6] as any).receivedAt, '2026-09-27T03:53:00.000Z', 'day 7 is stamped with the 27 Sep collection');
  assert.equal((rows[0] as any).receivedAt, '2026-09-16T04:00:00.000Z');
  assert.equal((rows[7] as any).receivedAt, null, 'an unfilled row has no received time');

  const extRows = distributeExtendedRowsView(ext, days, 14000, '2026-10-02', receipts);
  assert.deepEqual(
    extRows.map((r) => [r.receivedAmount, r.status, r.receivedAt, r.editInstalmentId]),
    [[0, 'missed', null, null], [0, 'missed', null, null], [0, 'due today', null, null], [0, 'projected', null, null]],
    'extended-day cash is already on the original rows — the days are zeroed',
  );

  // Only cash beyond the whole original schedule reaches the extended days.
  const over = distributeExtendedRowsView(ext, days, 23000, '2026-10-02');
  assert.deepEqual(over.map((r) => [r.receivedAmount, r.status]), [[2000, 'paid'], [1000, 'partial'], [0, 'due today'], [0, 'projected']]);

  // Without receipts the existing view is unchanged (no receivedAt added).
  const plain = distributeScheduleView([{ dueDate: days[9].dueDate, dueAmount: 2000, status: 'missed' }], 0, '2026-10-02');
  assert.equal('receivedAt' in plain[0], false);
}

console.log('distributed view tests passed');
