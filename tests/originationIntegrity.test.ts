import assert from 'node:assert/strict';
import { buildHpOriginationTerms } from '../lib/autofinance/origination';
import {
  maximumConsumptionLtvPercent,
  validateGoldOrigination,
} from '../lib/gold/origination';

const hp = buildHpOriginationTerms({
  vehicleValue: 100_000,
  downPayment: 20_000,
  interestRate: 12,
  interestMethod: 'flat',
  tenureMonths: 24,
  startDate: '2026-08-10',
  dueDay: 10,
  handLoanAmount: 5_000,
  insuranceCharge: 3_000,
  documentCharge: 1_000,
  brokerCommission: 2_000,
  payoutMode1: 'bank',
  payoutAmount1: 50_000,
  payoutMode2: 'cash',
  payoutAmount2: 29_000,
});

assert.equal(hp.principal, 85_000, 'server finances the vehicle balance and hand-loan advance');
assert.equal(hp.totalInterest, 20_400);
assert.equal(hp.totalPayable, 105_400);
assert.equal(hp.grossPayout, 85_000, 'the financed advance is not added to payout twice');
assert.equal(hp.netPayout, 79_000);
assert.equal(hp.schedule.length, 24);
assert.equal(hp.schedule[0]?.dueDate.toISOString().slice(0, 10), '2026-09-10');
assert.equal(
  Math.round(hp.schedule.reduce((sum, row) => sum + row.principalComponent, 0)),
  hp.principal,
);
assert.equal(
  Math.round(hp.schedule.reduce((sum, row) => sum + row.interestComponent, 0)),
  hp.totalInterest,
);

const reducing = buildHpOriginationTerms({
  vehicleValue: 500_000,
  downPayment: 100_000,
  interestRate: 12,
  interestMethod: 'diminishing',
  tenureMonths: 36,
  startDate: '2026-08-10',
});
assert.equal(reducing.deductionType, 'emi_floating');
assert.equal(reducing.schedule.at(-1)?.balance, 0);
assert.ok(reducing.totalInterest < 144_000, 'reducing interest is below flat interest');

assert.throws(
  () => buildHpOriginationTerms({
    vehicleValue: 100_000,
    downPayment: 20_000,
    interestRate: 12,
    interestMethod: 'flat',
    tenureMonths: 24,
    startDate: '2026-08-10',
    payoutMode1: 'cash',
    payoutAmount1: 70_000,
  }),
  /does not match the payout/i,
);
assert.throws(
  () => buildHpOriginationTerms({
    vehicleValue: 100_000,
    downPayment: 20_000,
    interestRate: 12,
    interestMethod: 'flat',
    tenureMonths: 24,
    startDate: '2026-08-10',
    insuranceCharge: -1,
  }),
  /cannot be negative/i,
);

assert.equal(maximumConsumptionLtvPercent(250_000), 85);
assert.equal(maximumConsumptionLtvPercent(250_000.01), 80);
assert.equal(maximumConsumptionLtvPercent(500_000), 80);
assert.equal(maximumConsumptionLtvPercent(500_000.01), 75);

const gold = validateGoldOrigination({
  assessedValue: 300_000,
  requestedPrincipal: 240_000,
  totalPayableAtMaturity: 250_000,
  repaymentModel: 'bullet',
  requestedLtvPercent: 90,
  borrowerExistingConsumptionExposure: 0,
});
assert.equal(gold.maximumLtvPercent, 85);
assert.equal(gold.appliedLtvPercent, 85, 'tenant setting is capped by statutory tier');
assert.equal(gold.exposureForLtv, 250_000, 'bullet LTV includes total repayable');

assert.throws(
  () => validateGoldOrigination({
    assessedValue: 300_000,
    requestedPrincipal: 250_001,
    totalPayableAtMaturity: 250_001,
    repaymentModel: 'amortizing',
    requestedLtvPercent: 85,
  }),
  /exceeds the eligible collateral amount/i,
);

console.log('origination integrity tests passed');
