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

console.log('repayment allocation tests passed');
