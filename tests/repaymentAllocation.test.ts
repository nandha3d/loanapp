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
import { getDistributedInstalmentsAndMetrics } from '../lib/repayments';

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

console.log('repayment allocation tests passed');
