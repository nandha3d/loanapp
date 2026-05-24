import assert from 'node:assert/strict';
import { buildForeclosureCalculation, type ForeclosureLoanSnapshot } from './foreclosure';

const activeLoan: ForeclosureLoanSnapshot = {
  id: 'loan_1',
  loanCode: 'LN001',
  status: 'active',
  principal: 10000,
  totalCollected: 3500,
  totalInstalments: 10,
  customer: {
    name: 'Priya Kumar',
    customerCode: 'C001',
    phone: '9999999999',
  },
  instalments: [
    { status: 'paid' },
    { status: 'partial' },
    { status: 'missed' },
    { status: 'upcoming' },
    { status: 'upcoming' },
  ],
  penalties: [
    { grossPenalty: 500, settledAmount: 100, waivedAmount: 50 },
    { grossPenalty: 125, settledAmount: 0, waivedAmount: 25 },
  ],
};

const calc = buildForeclosureCalculation(activeLoan, 9000, new Date('2026-05-23T10:00:00.000Z'));

assert.equal(calc.canForeclose, true);
assert.equal(calc.principalOutstanding, 6500);
assert.equal(calc.netPenaltyDue, 450);
assert.equal(calc.discount, 6950);
assert.equal(calc.totalSettlementAmount, 0);
assert.equal(calc.paidInstalments, 2);
assert.equal(calc.missedInstalments, 1);
assert.equal(calc.remainingInstalments, 2);
assert.equal(calc.lineItems.at(-1)?.label, 'Total settlement amount');
assert.equal(calc.calculatedAt, '2026-05-23T10:00:00.000Z');

const closedCalc = buildForeclosureCalculation(
  {
    ...activeLoan,
    id: 'loan_closed',
    status: 'closed',
  },
  0,
  new Date('2026-05-23T10:00:00.000Z'),
);

assert.equal(closedCalc.canForeclose, false);
assert.equal(closedCalc.reason, 'This loan is already closed.');
assert.equal(closedCalc.totalSettlementAmount, 0);

console.log('foreclosure calculation tests passed');
