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
