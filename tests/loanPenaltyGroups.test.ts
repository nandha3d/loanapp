import assert from 'node:assert/strict';
import { groupPenaltiesByLoan } from '../lib/penalties';

// DEC-03 (B): two loans of one customer keep separate totals — each loan's
// penalty comes from that loan's own missed dates, never pooled across loans.
const at = (d: string) => new Date(`${d}T00:00:00.000Z`);
const cust = { id: 'c1', name: 'A', customerCode: 'C1', routeId: null, route: null };
const groups = groupPenaltiesByLoan([
  { id: 'p1', loanId: 'L1', status: 'pending', missedDays: 3, createdAt: at('2026-09-01'), grossPenalty: 300, settledAmount: 0, waivedAmount: 0, loan: { loanCode: 'L1' }, customer: cust },
  { id: 'p2', loanId: 'L2', status: 'partial', missedDays: 2, createdAt: at('2026-09-02'), grossPenalty: 200, settledAmount: 50, waivedAmount: 0, loan: { loanCode: 'L2' }, customer: cust },
  { id: 'p3', loanId: 'L1', status: 'settled', missedDays: 5, createdAt: at('2026-08-01'), grossPenalty: 100, settledAmount: 100, waivedAmount: 0, loan: { loanCode: 'L1' }, customer: cust },
]);
const byLoan = Object.fromEntries(groups.map((g) => [g.loanId, g]));
assert.equal(groups.length, 2);
assert.deepEqual([byLoan.L1.gross, byLoan.L1.settled, byLoan.L1.net, byLoan.L1.missedDays, byLoan.L1.status], [400, 100, 300, 5, 'pending']);
assert.deepEqual([byLoan.L2.gross, byLoan.L2.net, byLoan.L2.status], [200, 150, 'partial']);
assert.deepEqual(byLoan.L1.penalties.map((p) => p.id), ['p3', 'p1'], 'rows oldest first');
console.log('loan penalty grouping passed');
