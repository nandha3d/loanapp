import assert from 'node:assert/strict';
import { calculateDynamicOverdueAmount } from '../lib/repayments';

console.log('Testing calculateDynamicOverdueAmount...');

// ── Test 1: User's Scenario ──────────────────────────────────────────
// 22nd June paid 1000, 23rd & 24th unpaid, 25th pays 3000
// Overdue must be recalculated to 0.
{
  const instalments = [
    { instalmentNo: 1, dueDate: '2026-06-22T00:00:00.000Z', dueAmount: 1000, receivedAmount: 1000 },
    { instalmentNo: 2, dueDate: '2026-06-23T00:00:00.000Z', dueAmount: 1000, receivedAmount: 0 },
    { instalmentNo: 3, dueDate: '2026-06-24T00:00:00.000Z', dueAmount: 1000, receivedAmount: 0 },
    { instalmentNo: 4, dueDate: '2026-06-25T00:00:00.000Z', dueAmount: 1000, receivedAmount: 3000 },
    { instalmentNo: 5, dueDate: '2026-06-26T00:00:00.000Z', dueAmount: 1000, receivedAmount: 0 },
  ];

  const now = new Date('2026-06-25T14:30:00.000Z');
  const totalCollected = 4000;
  const outstanding = 1000; // 5000 - 4000

  const overdue = calculateDynamicOverdueAmount(instalments, totalCollected, outstanding, now);
  assert.equal(overdue, 0, 'June 25th with 3000 paid must recalculate overdue to 0');
  console.log('✓ Test 1 Passed: User scenario (catch-up on 25th June) yields overdue = 0');
}

// ── Test 2: Partial Catch-up ─────────────────────────────────────────
// 22nd June paid 1000, 23rd & 24th unpaid, 25th pays 2000
// 1000 covers today (25th), 1000 covers 23rd, 24th remains overdue (1000).
{
  const instalments = [
    { instalmentNo: 1, dueDate: '2026-06-22T00:00:00.000Z', dueAmount: 1000, receivedAmount: 1000 },
    { instalmentNo: 2, dueDate: '2026-06-23T00:00:00.000Z', dueAmount: 1000, receivedAmount: 0 },
    { instalmentNo: 3, dueDate: '2026-06-24T00:00:00.000Z', dueAmount: 1000, receivedAmount: 0 },
    { instalmentNo: 4, dueDate: '2026-06-25T00:00:00.000Z', dueAmount: 1000, receivedAmount: 2000 },
    { instalmentNo: 5, dueDate: '2026-06-26T00:00:00.000Z', dueAmount: 1000, receivedAmount: 0 },
  ];

  const now = new Date('2026-06-25T14:30:00.000Z');
  const totalCollected = 3000;
  const outstanding = 2000;

  const overdue = calculateDynamicOverdueAmount(instalments, totalCollected, outstanding, now);
  assert.equal(overdue, 1000, 'Partial catch-up on 25th June must yield overdue = 1000');
  console.log('✓ Test 2 Passed: Partial catch-up yields overdue = 1000');
}

// ── Test 3: Day After Catch-up (June 26th) ──────────────────────────
// On 26th June, 22nd–25th are all past due (4000 total). 4000 collected.
{
  const instalments = [
    { instalmentNo: 1, dueDate: '2026-06-22T00:00:00.000Z', dueAmount: 1000, receivedAmount: 1000 },
    { instalmentNo: 2, dueDate: '2026-06-23T00:00:00.000Z', dueAmount: 1000, receivedAmount: 0 },
    { instalmentNo: 3, dueDate: '2026-06-24T00:00:00.000Z', dueAmount: 1000, receivedAmount: 0 },
    { instalmentNo: 4, dueDate: '2026-06-25T00:00:00.000Z', dueAmount: 1000, receivedAmount: 3000 },
    { instalmentNo: 5, dueDate: '2026-06-26T00:00:00.000Z', dueAmount: 1000, receivedAmount: 0 },
  ];

  const now = new Date('2026-06-26T09:00:00.000Z');
  const totalCollected = 4000;
  const outstanding = 1000;

  const overdue = calculateDynamicOverdueAmount(instalments, totalCollected, outstanding, now);
  assert.equal(overdue, 0, 'Day after catch-up must yield overdue = 0 (26th is due today, not overdue)');
  console.log('✓ Test 3 Passed: Day after catch-up yields overdue = 0');
}

// ── Test 4: Closed / Fully Paid Loan (DL00001 screenshot) ────────────
// 100 instalments of 1000. 84 instalments had 0 received on their date.
// Total collected = 100,000. Outstanding = 0.
{
  const instalments = Array.from({ length: 100 }, (_, i) => ({
    instalmentNo: i + 1,
    dueDate: new Date(new Date('2026-06-22T00:00:00.000Z').getTime() + i * 86400000),
    dueAmount: 1000,
    receivedAmount: i < 16 ? 0 : 0, // majority 0 on row
  }));
  // Last instalment has lump payment
  instalments[99].receivedAmount = 100000;

  const now = new Date('2026-09-16T12:00:00.000Z');
  const totalCollected = 100000;
  const outstanding = 0;

  const overdue = calculateDynamicOverdueAmount(instalments, totalCollected, outstanding, now);
  assert.equal(overdue, 0, 'Fully paid loan with outstanding 0 must yield overdue = 0');
  console.log('✓ Test 4 Passed: Closed loan yields overdue = 0');
}

// ── Test 5: Advance Payment ──────────────────────────────────────────
// Borrower pays 5000 on day 1 (advance payment).
{
  const instalments = [
    { instalmentNo: 1, dueDate: '2026-06-22T00:00:00.000Z', dueAmount: 1000, receivedAmount: 5000 },
    { instalmentNo: 2, dueDate: '2026-06-23T00:00:00.000Z', dueAmount: 1000, receivedAmount: 0 },
    { instalmentNo: 3, dueDate: '2026-06-24T00:00:00.000Z', dueAmount: 1000, receivedAmount: 0 },
  ];

  const now = new Date('2026-06-22T10:00:00.000Z');
  const totalCollected = 5000;
  const outstanding = 0;

  const overdue = calculateDynamicOverdueAmount(instalments, totalCollected, outstanding, now);
  assert.equal(overdue, 0, 'Advance payment must yield overdue = 0');
  console.log('✓ Test 5 Passed: Advance payment yields overdue = 0');
}

console.log('All dynamic overdue tests passed successfully!');
