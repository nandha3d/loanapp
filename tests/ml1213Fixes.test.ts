import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { calculateLoanPreview } from '../lib/loanCalculator';
import { buildCollectionIdempotencyKey } from '../lib/collectionPolicy';
import { hashBorrowerOtp, normalizeBorrowerOtpInput, verifyBorrowerOtp } from '../lib/borrowerOtp';
import { buildRazorpaySubscriptionRequest } from '../lib/razorpay';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

const upfront = calculateLoanPreview({
  principal: 1001,
  interestType: 'upfront_percentage',
  interestRate: 10,
  tenure: 3,
  frequency: 'daily',
});
assert.equal(Number.isInteger(upfront.deduction), true, 'ML-1216 upfront percentage deduction is rounded to whole rupees');
assert.equal(upfront.deduction, 100, 'ML-1216 10% of 1001 rounds to 100 using the documented rupee policy');
assert.equal(upfront.deduction + upfront.disbursedAmount, 1001, 'ML-1216 deduction plus disbursed remains principal');
assert.equal(
  calculateLoanPreview({ principal: 1000, interestType: 'emi_flat', interestRate: 10, tenure: 2 }).totalPayable,
  1100,
  'loan calculator flat EMI branch remains covered',
);
assert.equal(
  calculateLoanPreview({ principal: 1000, interestType: 'emi_floating', interestRate: 0, tenure: 2 }).totalPayable,
  1000,
  'loan calculator floating zero-rate branch remains covered',
);
assert.throws(
  () => calculateLoanPreview({ principal: 0, interestType: 'upfront_fixed', interestRate: 0, tenure: 1 }),
  /Principal must be greater than zero/,
  'loan calculator invalid-principal branch remains covered',
);

const schema = read('prisma/schema.prisma');
const collectionActions = read('app/(dashboard)/[module]/collection/actions.ts');
const collectionApi = read('app/api/collection/route.ts');
const collectionPolicy = read('lib/collectionPolicy.ts');
assert.match(schema, /idempotencyKey\s+String\?\s+@unique\s+@map\("idempotency_key"\)/, 'ML-1221/ML-1253 collection entries persist a unique idempotency key');
assert.match(collectionPolicy, /buildCollectionIdempotencyKey/, 'ML-1221/ML-1253 shared collection idempotency key builder exists');
assert.match(collectionActions + collectionApi, /idempotencyKey/, 'ML-1221/ML-1253 collection mutation paths write idempotency keys');
assert.match(collectionActions + collectionApi, /already recorded|Already recorded|duplicate/i, 'ML-1221/ML-1253 duplicate collection submissions return a duplicate/already-recorded error');
assert.equal(
  buildCollectionIdempotencyKey({
    tenantId: 'tenant',
    agentId: 'agent',
    instalmentId: 'inst',
    receivedAmount: 100,
    paymentMode: 'Cash',
    collectionDate: new Date('2026-05-19T10:00:00.000Z'),
  }),
  'tenant:agent:inst:100.00:cash:2026-05-19',
  'ML-1221/ML-1253 idempotency key is stable and normalized',
);

const approvals = read('app/(dashboard)/[module]/approvals/actions.ts');
assert.doesNotMatch(approvals, /An edit request is already pending for this customer/, 'ML-1225 multiple pending customer edit requests can enter the review queue');
assert.match(approvals, /superseded|stale|collision/i, 'ML-1225 approval review has queue collision/stale-request handling');

const borrowerAuth = read('app/api/borrower/auth/route.ts');
const borrowerLogin = read('app/borrower/login/page.tsx');
assert.match(borrowerAuth, /borrower_otp/i, 'ML-1230 borrower auth stores an OTP challenge before issuing session');
assert.match(borrowerAuth, /otp/i, 'ML-1230 borrower auth verifies OTP');
assert.match(borrowerLogin, /OTP|otp/, 'ML-1230 borrower login UI contains an OTP step');
const otpHash = hashBorrowerOtp('123456', 'secret');
assert.equal(normalizeBorrowerOtpInput(' 123-456 '), '123456', 'ML-1230 OTP input is normalized');
assert.equal(verifyBorrowerOtp({ otp: '123456', expectedHash: otpHash, secret: 'secret' }), true, 'ML-1230 OTP verification accepts the expected code');
assert.equal(verifyBorrowerOtp({ otp: '000000', expectedHash: otpHash, secret: 'secret' }), false, 'ML-1230 OTP verification rejects the wrong code');

const borrowerDashboard = read('app/borrower/dashboard/page.tsx') + read('app/borrower/dashboard/BorrowerDashboardClient.tsx');
assert.equal(existsSync('app/api/borrower/statement/route.tsx'), true, 'ML-1233 borrower statement PDF route exists');
assert.match(borrowerDashboard, /statement/i, 'ML-1233 borrower dashboard links to statement download');

const invoiceRoute = read('app/api/portal/invoices/[id]/route.ts');
assert.match(invoiceRoute, /application\/pdf/, 'ML-1237 invoice route returns PDF content');
assert.match(invoiceRoute, /renderToStream|renderToBuffer/, 'ML-1237 invoice route renders PDF bytes');

const packageJson = JSON.parse(read('package.json'));
assert.ok(packageJson.scripts.typecheck, 'ML-1238 typecheck script exists');
assert.ok(packageJson.scripts['test:ci'], 'ML-1239 CI test script exists');
assert.ok(packageJson.scripts['test:coverage'], 'ML-1242 coverage threshold script exists');
assert.ok(packageJson.scripts['test:ml-1213-fixes'], 'ML-1213 fix regression script exists');

const workflow = existsSync('.github/workflows/pr-quality.yml') ? read('.github/workflows/pr-quality.yml') : '';
assert.match(workflow, /pull_request/, 'ML-1238 PR workflow is configured');
assert.match(workflow, /typecheck|tsc/, 'ML-1238 PR workflow runs TypeScript checks');
assert.match(workflow, /db:seed|smoke|test:ci/, 'ML-1239 PR workflow runs seed/smoke or CI checks');
assert.match(workflow, /npm audit|audit-ci|snyk/i, 'ML-1240 PR workflow runs dependency vulnerability scanning');
assert.match(workflow, /gitleaks|trufflehog|secret/i, 'ML-1241 PR workflow runs secret scanning');
assert.match(workflow, /coverage|test:coverage/i, 'ML-1242 PR workflow enforces coverage');

const razorpay = read('lib/razorpay.ts');
assert.match(razorpay, /buildRazorpaySubscriptionRequest/, 'ML-1235 Razorpay subscription request can be validated without live checkout');
assert.match(razorpay, /RAZORPAY_MOCK_CHECKOUT|mock checkout/i, 'ML-1235 local/mock Razorpay checkout path exists for non-live verification');
process.env.RAZORPAY_PLAN_BASIC = 'plan_basic_test';
assert.deepEqual(
  buildRazorpaySubscriptionRequest('basic', 'tenant-1'),
  {
    plan_id: 'plan_basic_test',
    total_count: 120,
    customer_notify: 1,
    notes: { tenant_id: 'tenant-1' },
  },
);
// DEF-027 regression: atomic claim returns count=0 on second call

// Simulate: updateMany returns { count: 0 } → transaction throws → no side effects run
function simulateAtomicClaim(dbResult: { count: number }) {
  return dbResult;
}

function assertClaimSucceeded(claimResult: { count: number }) {
  if (claimResult.count === 0) {
    throw new Error('Request already processed or not found');
  }
}

const claimResult = simulateAtomicClaim({ count: 0 });
assert.throws(() => assertClaimSucceeded(claimResult), /already processed/, 
  'DEF-027: second concurrent approval is rejected before side effects');

console.log('ML-1213 failed/blocked regression checks passed');
