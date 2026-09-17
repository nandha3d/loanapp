import assert from 'node:assert/strict';
import { calculateCreditScore } from '../lib/creditScore';
import { getCreditScoreGaugePresentation } from '../lib/creditScoreGauge';
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES, validateFileBytes } from '../lib/fileUpload';
import { calculateLoanPreview, distributeInstalmentAmounts } from '../lib/loanCalculator';
import { canCreateLoanForRole } from '../lib/loanPolicy';
import { allocatePaymentsAcrossInstalments } from '../lib/repayments';
import { calculateInstalmentDates, formatCurrency } from '../lib/utils';
import { POST as calculateLoanRoute } from '../app/api/loans/calculate/route';

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function postCalculate(body: unknown) {
  const response = await calculateLoanRoute(
    new Request('http://localhost/api/loans/calculate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as Parameters<typeof calculateLoanRoute>[0],
  );
  return {
    status: response.status,
    body: await response.json(),
  };
}

const livePreview = calculateLoanPreview({
  principal: 30_000,
  interestType: 'upfront_fixed',
  interestRate: 3_000,
  tenure: 100,
  frequency: 'daily',
  startDate: '2026-05-19',
});
assert.equal(livePreview.disbursedAmount, 27_000, 'ML-1101 disbursed preview matches upfront deduction');
assert.equal(livePreview.totalPayable, 30_000, 'ML-1101 total payable preview matches principal');
assert.equal(livePreview.perInstalment, 300, 'ML-1101 per-instalment preview updates for tenure=100');
assert.equal(
  calculateLoanPreview({
    principal: 30_000,
    interestType: 'upfront_fixed',
    interestRate: 3_000,
    tenure: 50,
    frequency: 'daily',
  }).perInstalment,
  600,
  'ML-1101 per-instalment preview updates for tenure=50',
);
assert.equal(
  calculateLoanPreview({
    principal: 20_000,
    interestType: 'upfront_fixed',
    interestRate: 3_000,
    tenure: 50,
    frequency: 'daily',
  }).disbursedAmount,
  17_000,
  'ML-1101 disbursed preview updates when principal changes',
);

const excellentGauge = getCreditScoreGaugePresentation(800, 'Excellent');
assert.ok(excellentGauge.rotation > 70 && excellentGauge.rotation <= 90, 'ML-1103 excellent score needle sits near far right');
assert.equal(excellentGauge.color, '#16A34A', 'ML-1103 excellent score uses green');
assert.equal(excellentGauge.ariaLabel, 'Credit score: 800 - Excellent', 'ML-1709 gauge exposes screen-reader label');
assert.ok(getCreditScoreGaugePresentation(420, 'Very Poor').rotation <= -50, 'ML-1103 poor score needle sits left');

const minimumLoan = calculateLoanPreview({
  principal: 1,
  interestType: 'upfront_fixed',
  interestRate: 0,
  tenure: 1,
  frequency: 'daily',
  startDate: '2026-05-19',
});
assert.equal(minimumLoan.schedule.length, 1, 'ML-1201 minimum-principal loan has one instalment');
assert.equal(minimumLoan.schedule[0].dueAmount, 1, 'ML-1201 minimum-principal due amount is finite and positive');
assert.equal(minimumLoan.disbursedAmount, 1, 'ML-1201 disbursed amount is not NaN or Infinity');

const singleInstalment = calculateLoanPreview({
  principal: 10_000,
  interestType: 'upfront_fixed',
  interestRate: 1_000,
  tenure: 1,
  frequency: 'daily',
  startDate: '2026-05-19',
});
assert.equal(singleInstalment.schedule.length, 1, 'ML-1202 tenure=1 creates exactly one instalment');
assert.equal(singleInstalment.schedule[0].dueAmount, 10_000, 'ML-1202 single instalment covers full payable amount');
assert.equal(iso(singleInstalment.schedule[0].dueDate), '2026-05-19', 'ML-1202 single instalment date equals start date');

assert.deepEqual(
  calculateInstalmentDates(new Date('2028-02-01T00:00:00.000Z'), 'monthly', 2).map(iso),
  ['2028-02-01', '2028-03-01'],
  'ML-1203 monthly date generation keeps first-of-month aligned',
);
assert.deepEqual(
  calculateInstalmentDates(new Date('2027-01-31T00:00:00.000Z'), 'monthly', 2).map(iso),
  ['2027-01-31', '2027-02-28'],
  'ML-1203 monthly date generation clamps end-of-month instead of overflowing',
);

const threeOverdue = Array.from({ length: 3 }, (_, index) => ({
  id: `i${index + 1}`,
  instalmentNo: index + 1,
  dueDate: new Date(`2026-05-${10 + index}T00:00:00.000Z`),
  dueAmount: 300,
}));
const partialAllocation = allocatePaymentsAcrossInstalments(threeOverdue, 450, new Date('2026-05-20T00:00:00.000Z'));
assert.deepEqual(
  partialAllocation.map((item) => ({ no: item.instalmentNo, received: item.receivedAmount, status: item.status })),
  [
    { no: 1, received: 300, status: 'paid' },
    { no: 2, received: 150, status: 'partial' },
    { no: 3, received: 0, status: 'missed' },
  ],
  'ML-1204 partial payments allocate oldest instalments first',
);
const overpaymentAllocation = allocatePaymentsAcrossInstalments([threeOverdue[0]], 500, new Date('2026-05-20T00:00:00.000Z'));
assert.equal(overpaymentAllocation[0].receivedAmount, 300, 'ML-1205 overpayment is capped at due amount');
assert.equal(overpaymentAllocation[0].outstandingAmount, 0, 'ML-1205 capped overpayment closes the instalment');

assert.equal(canCreateLoanForRole('agent'), true, 'ML-1210 agent can submit loan applications for admin approval');
assert.equal(canCreateLoanForRole('admin'), true, 'ML-1210 admin can create loans');

const zeroInterest = calculateLoanPreview({
  principal: 10_000,
  interestType: 'emi_flat',
  interestRate: 0,
  tenure: 10,
  frequency: 'daily',
});
assert.equal(zeroInterest.totalPayable, 10_000, 'ML-1212 zero-interest flat EMI keeps total payable at principal');
assert.equal(zeroInterest.perInstalment, 1_000, 'ML-1212 zero-interest flat EMI has finite per-instalment amount');

const closedLoanAllocation = allocatePaymentsAcrossInstalments(threeOverdue, 900, new Date('2026-05-20T00:00:00.000Z'));
assert.equal(closedLoanAllocation.every((item) => item.status === 'paid'), true, 'ML-1308 fully collected loan leaves no unpaid instalment');
assert.equal(closedLoanAllocation.reduce((sum, item) => sum + item.receivedAmount, 0), 900, 'ML-1308 total collected equals total payable');

assert.deepEqual(
  distributeInstalmentAmounts(10_001, 10),
  [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1001],
  'ML-1310 rounding remainder is carried by the last instalment',
);
assert.equal(
  distributeInstalmentAmounts(10_001, 10).reduce((sum, amount) => sum + amount, 0),
  10_001,
  'ML-1310 instalment sum equals total payable exactly',
);

const score = calculateCreditScore([
  {
    principal: 50_000,
    tenure: 2,
    status: 'closed',
    instalments: [
      { status: 'paid', receivedAmount: 25_000 },
      { status: 'paid', receivedAmount: 25_000 },
    ],
  },
]);
assert.equal(score.score, 850, 'ML-1304 perfect closed loan score maps to top of expected range');
assert.equal(score.grade, 'Excellent', 'ML-1304 perfect closed loan grade is Excellent');
assert.equal(calculateCreditScore([]).score, 0, 'ML-1304 new customer score returns safe default');

assert.equal(formatCurrency(100000, 'Rs '), 'Rs 1,00,000', 'ML-1704 currency uses Indian digit grouping');

assert.equal(ALLOWED_UPLOAD_MIME_TYPES.includes('application/pdf'), true, 'ML-1114 PDF MIME type is allowed');
assert.equal(validateFileBytes(Buffer.from('255044462d', 'hex'), 'application/pdf'), true, 'ML-1609 real PDF magic bytes are accepted');
assert.equal(validateFileBytes(Buffer.from('4d5a900003', 'hex'), 'application/pdf'), false, 'ML-1609 spoofed PDF with EXE bytes is rejected');
assert.equal(MAX_UPLOAD_SIZE_BYTES, 5 * 1024 * 1024, 'ML-1610 upload size limit is 5 MB');

async function runApiContractAssertions() {
  assert.deepEqual(await postCalculate({ principal: 'abc', interestRate: 0, tenure: 10 }), {
    status: 400,
    body: { success: false, error: 'Principal must be a valid number.' },
  }, 'ML-1601 loan calculate rejects NaN principal with 400');
  assert.deepEqual(await postCalculate({ principal: 10_000, interestRate: -1, tenure: 10 }), {
    status: 400,
    body: { success: false, error: 'Deduction or interest rate cannot be negative.' },
  }, 'ML-1602 loan calculate rejects negative rate with 400');
  assert.deepEqual(await postCalculate({ principal: 10_000, interestRate: 0, tenure: 0 }), {
    status: 400,
    body: { success: false, error: 'Tenure must be a positive whole number.' },
  }, 'ML-1603 loan calculate rejects zero tenure with 400');
}

runApiContractAssertions().then(() => {
  console.log('ML-1101+ microlending automation tests passed');
});
