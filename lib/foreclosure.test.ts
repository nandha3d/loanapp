import assert from 'node:assert/strict';
import { buildForeclosureCalculation, type ForeclosureLoanSnapshot } from './foreclosure';
import { validatePenaltyResolution, PenaltyResolutionError } from './penalties';

const activeLoan: ForeclosureLoanSnapshot = {
  id: 'loan_1',
  loanCode: 'LN001',
  status: 'active',
  principal: 10000,
  totalPayable: 12000,
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
// DEC-01: payoff = totalPayable − collected; penalty is NOT part of it.
assert.equal(calc.principalOutstanding, 8500);
assert.equal(calc.netPenaltyDue, 450);
assert.equal(calc.penaltyDue, 450);
assert.equal(calc.discount, 8500);
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

// DEC-01: ₹10,000 at 20% emi_flat (totalPayable ₹12,000), ₹3,000 collected → payoff ₹9,000.
const emi = buildForeclosureCalculation(
  { ...activeLoan, totalCollected: 3000, penalties: [{ grossPenalty: 500, settledAmount: 0, waivedAmount: 0, missedDays: 5 }] },
  0,
  new Date('2026-05-23T10:00:00.000Z'),
);
assert.equal(emi.totalSettlementAmount, 9000);
assert.equal(emi.penaltyDue, 500);
assert.equal(emi.penaltyMissedDays, 5);
assert.deepEqual(emi.lineItems.find((l) => l.sign === 'info'), { label: 'Penalty due (settled separately)', amount: 500, sign: 'info' });
assert.equal(buildForeclosureCalculation({ ...activeLoan, totalCollected: 3000 }, 1000).totalSettlementAmount, 8000);

// DEC-01 penalty popup rules.
assert.equal(validatePenaltyResolution(undefined, 0), null);
assert.throws(() => validatePenaltyResolution(undefined, 500), (e: unknown) => e instanceof PenaltyResolutionError && e.message === 'penalty_resolution_required');
assert.deepEqual(validatePenaltyResolution({ action: 'paid', amount: 500, paymentMode: 'cash' }, 500), { action: 'paid', amount: 500, paymentMode: 'cash' });
assert.deepEqual(validatePenaltyResolution({ action: 'discount', amount: 300, paymentMode: 'upi' }, 500), { action: 'discount', amount: 300, paymentMode: 'upi' });
assert.deepEqual(validatePenaltyResolution({ action: 'waived', amount: 0 }, 500), { action: 'waived', amount: 0, paymentMode: null });
assert.throws(() => validatePenaltyResolution({ action: 'paid', amount: 400, paymentMode: 'cash' }, 500));
assert.throws(() => validatePenaltyResolution({ action: 'discount', amount: 500, paymentMode: 'cash' }, 500));
assert.throws(() => validatePenaltyResolution({ action: 'discount', amount: 300 }, 500));
assert.throws(() => validatePenaltyResolution({ action: 'waived', amount: 10 }, 500));

console.log('foreclosure calculation tests passed');
