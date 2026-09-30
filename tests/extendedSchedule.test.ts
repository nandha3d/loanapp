import assert from 'node:assert/strict';
import { computeExtendedSchedule, computeRestructure, pairEntriesWithInstalments } from '../lib/restructure';

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

  // Test 6: Schedule 16–25 Sep finished; ₹4,000 paid today (30 Sep) and
  // reallocated onto the instalments (now 6 paid, ₹8,000 outstanding).
  // Today's slot is already collected, so the 4 remaining payments must run
  // 1–4 Oct — not re-use today (which finished a day early on 3 Oct).
  const sixPaid = instalments.map((i, idx) => ({ ...i, receivedAmount: idx < 6 ? 2000 : 0 }));
  const todaySep30 = new Date('2026-09-30T00:00:00Z');
  const paidToday = [{ id: 'coll-30sep', receivedAmount: 4000, submittedAt: new Date('2026-09-30T06:00:00Z') }];
  const res6 = computeExtendedSchedule(sixPaid, 2000, 'daily', todaySep30, paidToday);
  assert.equal(res6.remainingPayments, 4, 'Remaining payments must be 4 (8,000 / 2,000)');
  // 26–29 Sep missed + 30 Sep paid + 1–4 Oct projected
  assert.equal(res6.extendedRows.length, 9, 'Should have 9 extended rows');
  assert.deepEqual(res6.extendedRows.slice(0, 4).map((r) => r.status), ['missed', 'missed', 'missed', 'missed']);
  assert.equal(res6.extendedRows[4].status, 'paid', '30 Sep (today, collected) must be paid');
  assert.equal(res6.extendedRows[4].receivedAmount, 4000);
  const projected6 = res6.extendedRows.filter((r) => r.status === 'projected');
  assert.equal(projected6.length, 4, 'All 4 remaining payments must be projected after today');
  assert.equal(new Date(projected6[0].date).getDate(), 1, 'First projected day must be 1 Oct');
  assert.equal(res6.projectedEndDate.getDate(), 4, 'Projected finish must be 4 Oct');
  assert.equal(res6.projectedEndDate.getMonth(), 9, 'Projected finish month must be Oct (9)');
  assert.equal(res6.extraPeriods, 9, 'Extra periods count every extended row');

  // Test 7: Two collections on the same extended day are summed.
  const twoToday = [
    { id: 'coll-a', receivedAmount: 1000, submittedAt: new Date('2026-09-30T05:00:00Z') },
    { id: 'coll-b', receivedAmount: 1000, submittedAt: new Date('2026-09-30T07:00:00Z') },
  ];
  const fiveHalfPaid = instalments.map((i, idx) => ({ ...i, receivedAmount: idx < 5 ? 2000 : 0 }));
  const res7 = computeExtendedSchedule(fiveHalfPaid, 2000, 'daily', todaySep30, twoToday);
  assert.equal(res7.extendedRows[4].receivedAmount, 2000, 'Same-day collections must be summed');
  assert.equal(res7.extendedRows[4].status, 'paid', 'Summed ₹2,000 covers the ₹2,000 slot');

  // Test 8: Loan DL00003 as posted in production. 16–25 Sep, ₹2,000/day.
  // Paid on time 16, 17, 18 Sep; after the term ₹2,000 on 27 Sep (posted on
  // row 3) and ₹4,000 on 30 Sep (posted on row 4). ₹12,000 collected.
  const dl3 = instalments.map((i, idx) => ({
    ...i,
    id: `r${idx + 1}`,
    instalmentNo: idx + 1,
    receivedAmount: idx < 2 ? 2000 : idx < 4 ? 4000 : 0,
  }));
  const dl3Collections = [
    { id: "c16", instalmentId: "r1", receivedAmount: 2000, collectionDate: new Date("2026-09-16T00:00:00Z"), submittedAt: new Date("2026-09-16T09:00:00Z") },
    { id: "c17", instalmentId: "r2", receivedAmount: 2000, collectionDate: new Date("2026-09-17T00:00:00Z"), submittedAt: new Date("2026-09-17T05:45:00Z") },
    { id: "c18", instalmentId: "r3", receivedAmount: 2000, collectionDate: new Date("2026-09-18T00:00:00Z"), submittedAt: new Date("2026-09-18T09:27:00Z") },
    { id: "c27", instalmentId: "r3", receivedAmount: 2000, collectionDate: new Date("2026-09-27T00:00:00Z"), submittedAt: new Date("2026-09-27T09:27:00Z") },
    { id: "c30", instalmentId: "r4", receivedAmount: 4000, collectionDate: new Date("2026-09-30T00:00:00Z"), submittedAt: new Date("2026-09-30T13:02:00Z") },
  ];
  const res8 = computeExtendedSchedule(dl3, 2000, "daily", todaySep30, dl3Collections);
  assert.equal(res8.outstanding, 8000);
  assert.equal(res8.scheduleFinished, true);
  // Original rows stay as they were at the end of the term: 1–3 paid, 4–10 missed.
  assert.ok(res8.ledger, "Past-term loan must carry a ledger");
  assert.deepEqual(res8.ledger!.map((r) => r.status),
    ["paid", "paid", "paid", "missed", "missed", "missed", "missed", "missed", "missed", "missed"]);
  // After-term cash is shown once, on its extended day — no double count.
  const shown = res8.ledger!.reduce((s, r) => s + r.receivedAmount, 0)
    + res8.extendedRows.reduce((s, r) => s + r.receivedAmount, 0);
  assert.equal(shown, 12000, "Everything shown must add up to cash collected");
  // Extended days: 26 missed, 27 paid, 28–29 missed, 30 paid, 1–4 Oct projected.
  assert.deepEqual(res8.extendedRows.map((r) => r.status),
    ["missed", "paid", "missed", "missed", "paid", "projected", "projected", "projected", "projected"]);
  assert.equal(res8.extendedRows[1].receivedAmount, 2000);
  assert.equal(res8.extendedRows[4].receivedAmount, 4000);
  assert.equal(res8.projectedEndDate.getDate(), 4, "Finish 4 Oct");

  // Test 8b: the extend-days rule. 16–25 Sep, days 1–4 paid, 5–10 missed.
  const fourPaid = instalments.map((i, idx) => ({ ...i, id: `r${idx + 1}`, receivedAmount: idx < 4 ? 2000 : 0 }));
  // Day 11 (26 Sep), nothing paid yet: the 6 missed dues project onto days 11–16.
  const d11 = computeExtendedSchedule(fourPaid, 2000, "daily", new Date("2026-09-26T00:00:00Z"));
  assert.deepEqual(d11.ledger!.map((r) => r.status).slice(4), ["missed", "missed", "missed", "missed", "missed", "missed"]);
  assert.equal(d11.extendedRows.length, 6);
  assert.equal(d11.projectedEndDate.getDate(), 1, "Day 16 = 1 Oct");
  // Missed day 11, paid ₹2,000 on day 12 (posted on row 5): finish slides to day 17.
  const pay12 = { instalmentId: "r5", receivedAmount: 2000, collectionDate: new Date("2026-09-27T00:00:00Z") };
  const after12 = fourPaid.map((i, idx) => (idx === 4 ? { ...i, receivedAmount: 2000 } : i));
  const d12 = computeExtendedSchedule(after12, 2000, "daily", new Date("2026-09-27T00:00:00Z"), [pay12]);
  assert.equal(d12.ledger![4].status, "missed", "Row 5 stays missed — the payment belongs to day 12");
  assert.deepEqual(d12.extendedRows.slice(0, 2).map((r) => r.status), ["missed", "paid"]);
  assert.equal(d12.projectedEndDate.getDate(), 2, "Day 17 = 2 Oct");
  // Paid ₹6,000 (3 days) on day 13: 2 payments left, finish comes in to day 15.
  const pay13 = { instalmentId: "r6", receivedAmount: 6000, collectionDate: new Date("2026-09-28T00:00:00Z") };
  const after13 = after12.map((i, idx) => (idx === 5 ? { ...i, receivedAmount: 6000 } : i));
  const d13 = computeExtendedSchedule(after13, 2000, "daily", new Date("2026-09-28T00:00:00Z"), [pay12, pay13]);
  assert.equal(d13.remainingPayments, 2);
  assert.deepEqual(d13.extendedRows.map((r) => r.status), ["missed", "paid", "paid", "projected", "projected"]);
  assert.equal(d13.extendedRows[2].receivedAmount, 6000);
  assert.equal(d13.projectedEndDate.getDate(), 30, "Day 15 = 30 Sep");

  // Test 8c: the restructured rate is for the tenure only.
  const during = computeRestructure(fourPaid, "daily", new Date("2026-09-25T00:00:00Z"), new Date("2026-09-20T00:00:00Z"));
  assert.equal(during.available, true);
  assert.ok(during.restructuredRate > 0);
  const afterTerm = computeRestructure(fourPaid, "daily", new Date("2026-09-25T00:00:00Z"), todaySep30);
  assert.equal(afterTerm.available, false, "Off once the term is over");
  assert.equal(afterTerm.restructuredRate, 0);

  // Test 8d: entries are paired to the row their Payment allocation hit.
  const paired = pairEntriesWithInstalments(
    [
      { id: 'e1', receivedAmount: 2000, paymentMode: 'cash', submittedAt: new Date('2026-09-27T09:27:00.100Z') },
      { id: 'e2', receivedAmount: 4000, paymentMode: 'cash', submittedAt: new Date('2026-09-30T13:02:00.050Z') },
      { id: 'e3', receivedAmount: 500, paymentMode: 'upi', submittedAt: new Date('2026-09-30T14:00:00Z') },
    ],
    [
      { amount: '4000.00', paymentMode: 'cash', createdAt: new Date('2026-09-30T13:02:00.120Z'), allocations: [{ instalmentId: 'r4' }] },
      { amount: 2000, paymentMode: 'cash', createdAt: new Date('2026-09-27T09:27:00.180Z'), allocations: [{ instalmentId: 'r3' }] },
      // A correction delta hours later — no entry of its own.
      { amount: 2000, paymentMode: 'cash', createdAt: new Date('2026-09-27T15:00:00Z'), allocations: [{ instalmentId: 'r5' }] },
    ],
  );
  assert.deepEqual(paired.map((e) => e.instalmentId), ['r3', 'r4', null]);

  // Test 9: A payment keyed in today for 27 Sep belongs to 27 Sep, not today.
  const backdated = [{ id: 'late', receivedAmount: 2000, collectionDate: new Date('2026-09-27T00:00:00Z'), submittedAt: new Date('2026-09-30T08:00:00Z') }];
  const res9 = computeExtendedSchedule(fiveHalfPaid, 2000, 'daily', todaySep30, backdated);
  assert.equal(res9.extendedRows[1].status, 'paid', '27 Sep carries the backdated payment');
  assert.equal(res9.extendedRows[4].status, 'due today', 'Today stays due — nothing was collected for today');

  // Test 10: No ledger while the term is still running.
  assert.equal(res4.ledger, null);

  console.log('✓ All Extended Schedule Tests passed successfully');
}

run();
