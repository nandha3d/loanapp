import assert from 'node:assert/strict';
import { getTodayDueMetrics } from '../lib/dashboard/todayMetrics';
import { summarizeDashboardBookTotals } from '../lib/dashboard/bookTotals';

assert.deepEqual(getTodayDueMetrics([
  { dueAmount: 100, receivedAmount: 40 },
  { dueAmount: 50, receivedAmount: 70 },
]), { expected: 150, collected: 90, remaining: 60, pct: 60 });
assert.deepEqual(getTodayDueMetrics([{ dueAmount: 100, receivedAmount: 0 }]),
  { expected: 100, collected: 0, remaining: 100, pct: 0 });
console.log('Dashboard today due metrics passed');

assert.deepEqual(summarizeDashboardBookTotals(1500, [
  { type: 'capital_add', _sum: { amount: 2000 } },
  { type: 'loan_disburse', _sum: { amount: 900 } },
  { type: 'collection', _sum: { amount: 350 } },
  { type: 'expense', _sum: { amount: 40 } },
  { type: 'capital_withdraw', _sum: { amount: 100 } },
]), { currentCapital: 1310, totalDisbursed: 1500, totalCollectedAllTime: 350 });
// DEC-06: a penalty collection is cash in.
assert.deepEqual(summarizeDashboardBookTotals(0, [
  { type: 'capital_add', _sum: { amount: 1000 } },
  { type: 'penalty_collection', _sum: { amount: 200 } },
]), { currentCapital: 1200, totalDisbursed: 0, totalCollectedAllTime: 0 });
assert.deepEqual(summarizeDashboardBookTotals(null, []),
  { currentCapital: 0, totalDisbursed: 0, totalCollectedAllTime: 0 });
