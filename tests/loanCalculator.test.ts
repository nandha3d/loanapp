import assert from 'node:assert/strict';
import {
  calculateLoanPreview,
  distributeInstalmentAmounts,
} from '../lib/loanCalculator';

// ── distributeInstalmentAmounts ───────────────────────────────────────────────

// Even split
assert.deepEqual(distributeInstalmentAmounts(1000, 4), [250, 250, 250, 250]);

// Remainder goes to the last instalment
assert.deepEqual(distributeInstalmentAmounts(1000, 3), [333, 333, 334]);

// Sum always equals total
{
  const amounts = distributeInstalmentAmounts(99_999, 7);
  assert.equal(amounts.reduce((s, a) => s + a, 0), 99_999);
  assert.equal(amounts.length, 7);
}

// ── upfront_fixed ─────────────────────────────────────────────────────────────

{
  const r = calculateLoanPreview({
    principal: 10_000,
    interestType: 'upfront_fixed',
    interestRate: 1_000, // flat deduction in rupees
    tenure: 10,
    frequency: 'daily',
    startDate: '2026-06-01',
  });
  assert.equal(r.principal, 10_000);
  assert.equal(r.deduction, 1_000);
  assert.equal(r.disbursedAmount, 9_000);
  assert.equal(r.totalPayable, 10_000);
  assert.equal(r.perInstalment, 1_000);
  assert.equal(r.schedule.length, 10);
  assert.equal(r.schedule.reduce((s, i) => s + i.dueAmount, 0), 10_000);
}

// ── upfront_percentage ────────────────────────────────────────────────────────

{
  const r = calculateLoanPreview({
    principal: 50_000,
    interestType: 'upfront_percentage',
    interestRate: 10,
    tenure: 50,
    frequency: 'daily',
  });
  assert.equal(r.deduction, 5_000);
  assert.equal(r.disbursedAmount, 45_000);
  assert.equal(r.totalPayable, 50_000);
  assert.equal(r.perInstalment, 1_000);
}

// ── emi_flat ──────────────────────────────────────────────────────────────────

{
  const r = calculateLoanPreview({
    principal: 100_000,
    interestType: 'emi_flat',
    interestRate: 12, // 12% flat on principal for the tenure
    tenure: 12,
    frequency: 'monthly',
  });
  assert.equal(r.disbursedAmount, 100_000);
  assert.equal(r.totalPayable, 112_000);
  // base instalment 9333, last absorbs the rounding remainder
  assert.equal(r.schedule.length, 12);
  assert.equal(r.schedule.reduce((s, i) => s + i.dueAmount, 0), 112_000);
}

// ── emi_floating (reducing balance) ───────────────────────────────────────────

{
  // 100k @ 12% p.a. monthly for 12 months — standard EMI ≈ 8,884.88/month
  const r = calculateLoanPreview({
    principal: 100_000,
    interestType: 'emi_floating',
    interestRate: 12,
    tenure: 12,
    frequency: 'monthly',
  });
  assert.equal(r.disbursedAmount, 100_000);
  // totalPayable = round(EMI) * 12 = 8885 * 12 = 106,620
  assert.equal(r.totalPayable, 106_620);
}

{
  // zero rate floating → totalPayable = principal
  const r = calculateLoanPreview({
    principal: 60_000,
    interestType: 'emi_floating',
    interestRate: 0,
    tenure: 12,
    frequency: 'monthly',
  });
  assert.equal(r.totalPayable, 60_000);
  assert.equal(r.perInstalment, 5_000);
}

// ── interest_only (Check/Gold Base) ───────────────────────────────────────────

{
  // The client scenario: ₹10L at 2.5%/month for 12 months. Full principal is
  // disbursed, each monthly due is one month's interest, and the principal is a
  // bullet settled at closure.
  const r = calculateLoanPreview({
    principal: 1_000_000,
    interestType: 'interest_only',
    interestRate: 2.5,
    tenure: 12,
    frequency: 'monthly',
    startDate: '2026-08-05',
    dueDay: 1,
  });
  assert.equal(r.principal, 1_000_000);
  assert.equal(r.deduction, 0);
  assert.equal(r.disbursedAmount, 1_000_000, 'nothing is netted off at disbursal');
  assert.equal(r.monthlyInterest, 25_000);
  assert.equal(r.aprPercent, 30, '2.5%/month annualises to 30% APR');
  assert.equal(r.principalDueAtClosure, 1_000_000);
  assert.equal(r.perInstalment, 25_000);
  assert.equal(r.totalPayable, 1_300_000, 'principal + 12 months of interest');

  // Every row is the same interest — no remainder dumped on the last one, unlike
  // the other models.
  assert.equal(r.schedule.length, 12);
  r.schedule.forEach((i) => assert.equal(i.dueAmount, 25_000));
  assert.equal(r.schedule.reduce((s, i) => s + i.dueAmount, 0), 300_000);

  // The manually chosen due day drives the schedule.
  r.schedule.forEach((i) => assert.equal(new Date(i.dueDate).getDate(), 1));
}

{
  // The schedule sums to interest only — the principal deliberately sits outside
  // it, which is the invariant every other model holds and this one breaks.
  const r = calculateLoanPreview({
    principal: 500_000,
    interestType: 'interest_only',
    interestRate: 3,
    tenure: 6,
    frequency: 'monthly',
  });
  assert.equal(r.monthlyInterest, 15_000);
  assert.equal(r.schedule.reduce((s, i) => s + i.dueAmount, 0), 90_000);
  assert.notEqual(r.schedule.reduce((s, i) => s + i.dueAmount, 0), r.totalPayable);
}

// A monthly rate has no meaning on a daily/weekly schedule.
for (const frequency of ['daily', 'weekly', 'biweekly']) {
  assert.throws(
    () => calculateLoanPreview({
      principal: 1_000_000,
      interestType: 'interest_only',
      interestRate: 2.5,
      tenure: 12,
      frequency,
    }),
    /monthly frequency/,
    `interest_only must reject ${frequency}`,
  );
}

// Only interest_only carries the servicing extras.
{
  const r = calculateLoanPreview({
    principal: 10_000, interestType: 'upfront_fixed', interestRate: 1_000, tenure: 10,
  });
  assert.equal(r.monthlyInterest, undefined);
  assert.equal(r.aprPercent, undefined);
  assert.equal(r.principalDueAtClosure, undefined);
}

// ── upfront regression: the client's deduction scenario ───────────────────────

{
  // ₹10L at 2.5% → deduct ₹25,000, disburse ₹9,75,000, repay the gross ₹10L.
  const r = calculateLoanPreview({
    principal: 1_000_000,
    interestType: 'upfront_percentage',
    interestRate: 2.5,
    tenure: 12,
    frequency: 'monthly',
  });
  assert.equal(r.deduction, 25_000);
  assert.equal(r.disbursedAmount, 975_000);
  assert.equal(r.totalPayable, 1_000_000);
  assert.equal(r.schedule.reduce((s, i) => s + i.dueAmount, 0), 1_000_000);
}

// ── validation errors ─────────────────────────────────────────────────────────

assert.throws(() => calculateLoanPreview({ principal: 0, tenure: 10 }), /Principal/);
assert.throws(() => calculateLoanPreview({ principal: -5, tenure: 10 }), /Principal/);
assert.throws(() => calculateLoanPreview({ principal: 1000, tenure: 0 }), /Tenure/);
assert.throws(() => calculateLoanPreview({ principal: 1000, tenure: 2.5 }), /Tenure/);
assert.throws(
  () => calculateLoanPreview({ principal: 1000, tenure: 10, interestRate: -1 }),
  /cannot be negative/,
);
assert.throws(
  () => calculateLoanPreview({ principal: 1000, tenure: 10, startDate: 'not-a-date' }),
  /Invalid start date/,
);
assert.throws(
  () => calculateLoanPreview({ principal: NaN, tenure: 10 }),
  /valid number/,
);

console.log('loan calculator tests passed');
