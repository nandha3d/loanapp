import assert from 'node:assert/strict';
import {
  monthlyInterestFor,
  toAprPercent,
  summarizeInterestOnlyLoan,
  type InterestOnlyLoanSnapshot,
} from '../lib/interestOnly';
import { resolveLoanStatus } from '../lib/repayments';
import { applyPartPayment } from '../lib/gold/pledgeInterest';
import { buildForeclosureCalculation, type ForeclosureLoanSnapshot } from '../lib/foreclosure';

// ── rate helpers ──────────────────────────────────────────────────────────────

assert.equal(monthlyInterestFor(1_000_000, 2.5), 25_000);
assert.equal(monthlyInterestFor(800_000, 2.5), 20_000);
assert.equal(monthlyInterestFor(0, 2.5), 0);
assert.equal(monthlyInterestFor(1_000_000, 0), 0);
// Negative inputs are clamped rather than producing a negative due.
assert.equal(monthlyInterestFor(-5_000, 2.5), 0);
assert.equal(monthlyInterestFor(1_000_000, -1), 0);

assert.equal(toAprPercent(2.5), 30, '2.5%/month → 30% APR');
assert.equal(toAprPercent(3), 36);
assert.equal(toAprPercent(0), 0);

// ── loan summary ──────────────────────────────────────────────────────────────

function loan(overrides: Partial<InterestOnlyLoanSnapshot> = {}): InterestOnlyLoanSnapshot {
  return {
    id: 'loan-1',
    loanCode: 'ML00001',
    status: 'active',
    principal: 1_000_000,
    interestRate: 2.5,
    outstandingPrincipal: 1_000_000,
    instalments: [],
    ...overrides,
  };
}

const inst = (status: string, dueAmount = 25_000, receivedAmount = 0) => ({
  status,
  dueAmount,
  receivedAmount,
});

{
  // Three months of interest collected. The principal has NOT moved — that is the
  // whole point of the model, and what the generic outstanding rule gets wrong.
  const s = summarizeInterestOnlyLoan(
    loan({
      instalments: [
        inst('paid', 25_000, 25_000),
        inst('paid', 25_000, 25_000),
        inst('paid', 25_000, 25_000),
        ...Array.from({ length: 9 }, () => inst('upcoming')),
      ],
    }),
  );
  assert.equal(s.outstandingPrincipal, 1_000_000);
  assert.equal(s.monthlyInterest, 25_000);
  assert.equal(s.aprPercent, 30);
  assert.equal(s.interestCollected, 75_000);
  assert.equal(s.paidInstalments, 3);
  assert.equal(s.upcomingInstalments, 9);
  assert.equal(s.interestDueNow, 0, 'upcoming interest is not yet payable');
  assert.equal(s.totalDueToClose, 1_000_000, 'closing today costs the principal only');
}

{
  // A missed month and a partly-paid month are both already due, so they are
  // collected on exit; future months are not.
  const s = summarizeInterestOnlyLoan(
    loan({
      instalments: [
        inst('paid', 25_000, 25_000),
        inst('missed', 25_000, 0),
        inst('partial', 25_000, 10_000),
        inst('upcoming'),
      ],
    }),
  );
  assert.equal(s.interestDueNow, 40_000, '25,000 missed + 15,000 short on the partial');
  assert.equal(s.totalDueToClose, 1_040_000);
}

{
  // A loan that predates servicing has no outstandingPrincipal recorded — the full
  // principal is still owed rather than zero.
  const s = summarizeInterestOnlyLoan(loan({ outstandingPrincipal: null }));
  assert.equal(s.outstandingPrincipal, 1_000_000);
}

// ── part-payment re-prices the remaining dues ─────────────────────────────────

{
  const outstandingBefore = 1_000_000;
  const outstandingAfter = applyPartPayment(outstandingBefore, 200_000);
  assert.equal(outstandingAfter, 800_000);
  assert.equal(monthlyInterestFor(outstandingAfter, 2.5), 20_000, 'dues drop with the principal');

  // Settled history keeps its original amount; only upcoming rows are re-priced.
  const s = summarizeInterestOnlyLoan(
    loan({
      outstandingPrincipal: outstandingAfter,
      instalments: [
        inst('paid', 25_000, 25_000),
        inst('upcoming', 20_000),
        inst('upcoming', 20_000),
      ],
    }),
  );
  assert.equal(s.interestCollected, 25_000);
  assert.equal(s.monthlyInterest, 20_000);
  assert.equal(s.totalDueToClose, 800_000);
}

// A part-payment can never drive the principal negative.
assert.equal(applyPartPayment(100_000, 250_000), 0);

// ── the loan must not auto-close while principal is outstanding ───────────────

{
  const allInterestPaid = {
    paidCount: 12,
    waivedCount: 0,
    totalInstalments: 12,
    overdueAmount: 0,
  };

  // Regression guard: without the principal check this returns 'closed' and a ₹10L
  // bullet silently disappears.
  assert.equal(
    resolveLoanStatus({ ...allInterestPaid, principalOutstanding: 1_000_000 }),
    'active',
  );
  assert.equal(
    resolveLoanStatus({ ...allInterestPaid, principalOutstanding: 0 }),
    'closed',
    'principal settled → the loan may close',
  );
  // Every other model passes no principal and keeps its existing behaviour.
  assert.equal(resolveLoanStatus(allInterestPaid), 'closed');
  assert.equal(
    resolveLoanStatus({ ...allInterestPaid, paidCount: 10, overdueAmount: 25_000 }),
    'overdue',
  );
  assert.equal(
    resolveLoanStatus({ paidCount: 0, waivedCount: 0, totalInstalments: 0, overdueAmount: 0 }),
    'active',
    'a loan with no schedule is not closed',
  );
}

// ── foreclosure math must not net interest off the principal ──────────────────

function foreclosureLoan(overrides: Partial<ForeclosureLoanSnapshot> = {}): ForeclosureLoanSnapshot {
  return {
    id: 'loan-1',
    loanCode: 'ML00001',
    status: 'active',
    principal: 1_000_000,
    totalCollected: 75_000,
    totalInstalments: 12,
    customer: { name: 'Test', customerCode: 'CUS0001', phone: '9700000001' },
    instalments: [],
    penalties: [],
    ...overrides,
  };
}

{
  // Interest-Only: 75,000 of interest collected leaves the principal untouched.
  const c = buildForeclosureCalculation(
    foreclosureLoan({ deductionType: 'interest_only', outstandingPrincipal: 1_000_000 }),
  );
  assert.equal(c.principalOutstanding, 1_000_000);
  assert.equal(c.totalSettlementAmount, 1_000_000);

  // After a part-payment it follows the recorded balance.
  const afterPart = buildForeclosureCalculation(
    foreclosureLoan({ deductionType: 'interest_only', outstandingPrincipal: 800_000 }),
  );
  assert.equal(afterPart.principalOutstanding, 800_000);
}

{
  // Every other model is unchanged: collections still repay the principal.
  const c = buildForeclosureCalculation(foreclosureLoan({ deductionType: 'upfront_fixed' }));
  assert.equal(c.principalOutstanding, 925_000);
  assert.equal(c.totalSettlementAmount, 925_000);
}

console.log('interest-only tests passed');
