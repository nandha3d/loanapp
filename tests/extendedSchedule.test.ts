import assert from 'node:assert/strict';
import { computeExtendedSchedule } from '../lib/restructure';

function run() {
  console.log('--- Running Extended Schedule Tests ---');

  // Scenario matching user's case:
  // Daily loan of ₹20,000, 10 days, ₹2,000/day.
  // Schedule: 16 Sep to 25 Sep 2026.
  // Today: 27 Sep 2026.
  // 2 days paid (₹4,000), ₹16,000 outstanding balance.
  const instalments = [
    { dueDate: new Date('2026-09-16T00:00:00Z'), dueAmount: 2000, receivedAmount: 2000 },
    { dueDate: new Date('2026-09-17T00:00:00Z'), dueAmount: 2000, receivedAmount: 2000 },
    { dueDate: new Date('2026-09-18T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-09-19T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-09-20T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-09-21T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-09-22T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-09-23T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-09-24T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-09-25T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
  ];

  const today = new Date('2026-09-27T00:00:00Z');

  // Test 1: Schedule finished (last date 25 Sep < today 27 Sep) without collections on extended dates
  const res1 = computeExtendedSchedule(instalments, 2000, 'daily', today);
  assert.equal(res1.outstanding, 16000, 'Outstanding must be 16,000');
  assert.equal(res1.remainingPayments, 8, 'Remaining payments must be 8 (16,000 / 2,000)');

  // Must have 1 elapsed day (26 Sep) + 8 days (27 Sep to 4 Oct) = 9 extended rows
  assert.equal(res1.extendedRows.length, 9, 'Should have 9 extended rows');

  // Row 11: 26 Sep (elapsed, not collected -> missed)
  const row11 = res1.extendedRows[0];
  assert.equal(row11.no, 11);
  assert.equal(row11.status, 'missed', '26 Sep must be missed');
  assert.equal(row11.receivedAmount, 0);

  // Row 12: 27 Sep (today, not yet collected -> due today)
  const row12 = res1.extendedRows[1];
  assert.equal(row12.no, 12);
  assert.equal(row12.status, 'due today', '27 Sep (today) must be due today');
  assert.equal(row12.receivedAmount, 0);

  // Row 13: 28 Sep (future -> projected)
  const row13 = res1.extendedRows[2];
  assert.equal(row13.no, 13);
  assert.equal(row13.status, 'projected', '28 Sep must be projected');

  // Test 2: Collection recorded on 27 Sep (today)
  const collections = [
    {
      id: 'coll-entry-27sep',
      receivedAmount: 2000,
      submittedAt: new Date('2026-09-27T10:30:00Z'),
      paymentMode: 'cash',
    },
  ];

  const res2 = computeExtendedSchedule(instalments, 2000, 'daily', today, collections);
  const row12Collected = res2.extendedRows[1];
  assert.equal(row12Collected.status, 'paid', '27 Sep with collection must be paid');
  assert.equal(row12Collected.receivedAmount, 2000);
  assert.equal(row12Collected.collectionEntryId, 'coll-entry-27sep');
  assert.equal(row12Collected.paymentMode, 'cash');

  // Test 3: Next day arrives (28 Sep) - 27 Sep was collected so it remains paid
  const tomorrow = new Date('2026-09-28T00:00:00Z');
  // When reallocated, instalments reflect total received (now ₹6,000 paid)
  const updatedInstalments = [
    { dueDate: new Date('2026-09-16T00:00:00Z'), dueAmount: 2000, receivedAmount: 2000 },
    { dueDate: new Date('2026-09-17T00:00:00Z'), dueAmount: 2000, receivedAmount: 2000 },
    { dueDate: new Date('2026-09-18T00:00:00Z'), dueAmount: 2000, receivedAmount: 2000 }, // allocated
    { dueDate: new Date('2026-09-19T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-09-20T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-09-21T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-09-22T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-09-23T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-09-24T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-09-25T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
  ];

  const res3 = computeExtendedSchedule(updatedInstalments, 2000, 'daily', tomorrow, collections);
  assert.equal(res3.outstanding, 14000, 'Outstanding reduced to 14,000');
  assert.equal(res3.remainingPayments, 7, 'Remaining payments reduced to 7');

  // Elapsed 26 Sep (missed)
  assert.equal(res3.extendedRows[0].status, 'missed');
  // Elapsed 27 Sep with collection (paid)
  assert.equal(res3.extendedRows[1].status, 'paid');
  // Today 28 Sep (due today)
  assert.equal(res3.extendedRows[2].status, 'due today');
  // Test 4: Schedule is still active (ends 18 Nov, today is 29 Sep) and 0 missed payments
  const weeklyInstalments = [
    { dueDate: new Date('2026-09-23T00:00:00Z'), dueAmount: 2000, receivedAmount: 2000 },
    { dueDate: new Date('2026-09-30T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-10-07T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-10-14T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-10-21T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-10-28T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-11-04T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-11-11T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-11-18T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
  ];
  const todaySep29 = new Date('2026-09-29T00:00:00Z');
  const res4 = computeExtendedSchedule(weeklyInstalments, 2000, 'weekly', todaySep29);
  assert.equal(res4.extraPeriods, 0, 'No extra periods needed when on schedule');
  assert.equal(res4.extendedRows.length, 0, 'No extended rows when loan is on schedule');

  // Test 5: Schedule is still active, but 1 payment was missed (23 Sep missed, 0 received)
  const weeklyWithMiss = [
    { dueDate: new Date('2026-09-23T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-09-30T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-10-07T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-10-14T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-10-21T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-10-28T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-11-04T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-11-11T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
    { dueDate: new Date('2026-11-18T00:00:00Z'), dueAmount: 2000, receivedAmount: 0 },
  ];
  const res5 = computeExtendedSchedule(weeklyWithMiss, 2000, 'weekly', todaySep29);
  assert.equal(res5.extraPeriods, 1, '1 extra period needed for missed payment');
  assert.equal(res5.extendedRows.length, 1, 'Exactly 1 extended row should be generated');
  assert.equal(res5.extendedRows[0].no, 10, 'Extended row should be #10');
  const extDate = new Date(res5.extendedRows[0].date);
  assert.equal(extDate.getDate(), 25, 'Day must be 25 Nov');
  assert.equal(extDate.getMonth(), 10, 'Month must be Nov (10)');
  assert.equal(res5.extendedRows[0].status, 'projected');

  console.log('✓ All Extended Schedule Tests passed successfully');
}

run();
