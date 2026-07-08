import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkFixedWindowLimit, createFixedWindowStore } from '../lib/rateLimit';
import { apiError } from '../lib/utils';
import { decryptAadharNumber, encryptAadharNumber } from '../lib/pii';
import { verifyRazorpayWebhookSignature } from '../lib/razorpay';
import { calculatePenaltyAccrual, shouldUpdatePenaltyGross } from '../lib/penalties';
import { getRouteDeletionBlockReason } from '../lib/routePolicy';
import { validateGuarantorPhone } from '../lib/guarantorPolicy';
import { canCollectForLoanStatus, COLLECTIBLE_LOAN_STATUSES, getCollectionSubmissionBlockReason } from '../lib/collectionPolicy';
import { isTenantFileAccessAllowed } from '../lib/fileAccessPolicy';
import { allocatePaymentsAcrossInstalments } from '../lib/repayments';
import { calculateLoanPreview, distributeInstalmentAmounts } from '../lib/loanCalculator';
import { GET as accruePenaltiesCron } from '../app/api/cron/accrue-penalties/route';

function utcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

const cappedPenalty = calculatePenaltyAccrual({
  overdueInstalments: [{ dueDate: utcDate('2026-05-09') }],
  asOf: utcDate('2026-05-19'),
  penaltyPerDay: 1_000,
  gracePeriodDays: 0,
  maxCap: 500,
});
assert.equal(cappedPenalty.missedDays, 10, 'ML-1206 counts missed days before cap');
assert.equal(cappedPenalty.grossPenalty, 500, 'ML-1206/ML-1305 caps gross penalty at maxCap');

const gracePenalty = calculatePenaltyAccrual({
  overdueInstalments: [{ dueDate: utcDate('2026-05-17') }],
  asOf: utcDate('2026-05-19'),
  penaltyPerDay: 100,
  gracePeriodDays: 3,
  maxCap: 0,
});
assert.equal(gracePenalty.missedDays, 0, 'ML-1207 grace period removes effective overdue days');
assert.equal(gracePenalty.grossPenalty, 0, 'ML-1207 no penalty inside grace period');
assert.equal(shouldUpdatePenaltyGross(500, 500), false, 'ML-1208 same-day penalty accrual is idempotent when gross has not grown');
assert.equal(shouldUpdatePenaltyGross(500, 700), true, 'ML-1208 penalty accrual updates only when gross grows');

const instalmentAmounts = distributeInstalmentAmounts(10_001, 10);
assert.equal(instalmentAmounts.reduce((sum, amount) => sum + amount, 0), 10_001, 'ML-1301 instalment sum equals total payable exactly');
assert.equal(
  calculateLoanPreview({
    principal: 30_000,
    interestType: 'upfront_fixed',
    interestRate: 3_000,
    tenure: 100,
    frequency: 'daily',
  }).disbursedAmount,
  27_000,
  'ML-1306 upfront deduction produces correct disbursed amount',
);

const threePartialInstalments = [
  { id: 'i1', instalmentNo: 1, dueDate: utcDate('2026-05-01'), dueAmount: 300 },
  { id: 'i2', instalmentNo: 2, dueDate: utcDate('2026-05-02'), dueAmount: 300 },
  { id: 'i3', instalmentNo: 3, dueDate: utcDate('2026-05-03'), dueAmount: 300 },
];
const threePartialPayments = [125, 175, 260];
let outstandingAfterPartials = threePartialInstalments.reduce((sum, item) => sum + item.dueAmount, 0);
for (const amount of threePartialPayments) {
  const allocation = allocatePaymentsAcrossInstalments(
    [{ id: 'open', instalmentNo: 1, dueDate: utcDate('2026-05-01'), dueAmount: outstandingAfterPartials }],
    amount,
    utcDate('2026-05-19'),
  );
  outstandingAfterPartials = allocation[0].outstandingAmount;
}
assert.equal(outstandingAfterPartials, 340, 'ML-1307 outstanding amount equals total payable minus three partial payments');

assert.equal(getRouteDeletionBlockReason({ activeCustomerCount: 1 }), 'Cannot delete route with active customers.');
assert.equal(getRouteDeletionBlockReason({ activeCustomerCount: 0 }), null, 'ML-1501 route can delete only when no active customers remain');

assert.deepEqual(
  validateGuarantorPhone({ customerPhone: '91000 00001', guarantorPhone: '9100000001' }),
  { valid: false, error: 'Guarantor phone cannot match customer phone.' },
  'ML-1211 matching guarantor/customer phone is blocked',
);
assert.deepEqual(
  validateGuarantorPhone({ customerPhone: '9100000001', guarantorPhone: '9100000002' }),
  { valid: true },
  'ML-1211 different guarantor/customer phone is allowed',
);

assert.deepEqual(COLLECTIBLE_LOAN_STATUSES, ['active', 'overdue']);
assert.equal(canCollectForLoanStatus('closed'), false, 'ML-1509 closed loans are excluded from collection');
assert.equal(canCollectForLoanStatus('active'), true, 'ML-1509 active loans remain collectible');
assert.equal(
  getCollectionSubmissionBlockReason({ loanStatus: 'active', dueAmount: 300, receivedAmount: 300 }),
  'Instalment is already fully collected',
  'ML-1607 duplicate collection submit is blocked once an instalment is fully collected',
);

const collectionRouteSource = readFileSync('app/api/collection/route.ts', 'utf8');
assert.match(collectionRouteSource, /checkRateLimit\(routeKey\('collection:post'/, 'ML-1606 collection POST is rate limited');
assert.match(collectionRouteSource, /'Retry-After'/, 'ML-1606 rate-limit response includes Retry-After header');

const authSource = readFileSync('lib/auth.ts', 'utf8');
assert.match(authSource, /action: 'login'/, 'ML-1809 successful login writes an audit action');
assert.match(authSource, /entityType: 'auth'/, 'ML-1809 login audit uses auth entityType');
assert.doesNotMatch(authSource, /newValue: JSON\.stringify\(\{[\s\S]*?password/, 'ML-1805/ML-1809 login audit does not serialize password');

assert.equal(isTenantFileAccessAllowed({ role: 'admin', requestedTenantId: 'tenant-b', sessionTenantId: 'tenant-a' }), false, 'ML-1507 branch/tenant user cannot read another tenant file');
assert.equal(isTenantFileAccessAllowed({ role: 'developer', requestedTenantId: 'tenant-b', sessionTenantId: 'tenant-a' }), true, 'ML-1507 developer can read support files across tenants');

const rateStore = createFixedWindowStore();
assert.equal(checkFixedWindowLimit(rateStore, 'collection-api', 1, 1_000, 0).allowed, true);
assert.equal(checkFixedWindowLimit(rateStore, 'collection-api', 1, 1_000, 1).allowed, false);
assert.equal(checkFixedWindowLimit(rateStore, 'collection-api', 1, 1_000, 1_001).allowed, true, 'ML-1807 rate limit resets after the window');

const piiKey = '0123456789abcdef0123456789abcdef';
const encrypted = encryptAadharNumber('123456789012', piiKey);
assert.notEqual(encrypted, '123456789012', 'ML-1506 Aadhaar is encrypted, not stored as plaintext');
assert.equal(decryptAadharNumber(encrypted, piiKey), '123456789012', 'ML-1810 persistent key decrypts Aadhaar across calls');

const invalidWebhookSignature = verifyRazorpayWebhookSignature(
  '{"event":"subscription.charged"}',
  'webhook-secret',
  'bad-signature',
);
assert.equal(invalidWebhookSignature, false, 'ML-1804 invalid Razorpay webhook signature is rejected');

async function runAsyncAssertions() {
  const errorResponse = await apiError('Unauthorized', 401).json();
  assert.deepEqual(errorResponse, { success: false, error: 'Unauthorized' }, 'ML-1612 apiError response shape is consistent');

  process.env.CRON_SECRET = 'cron-secret';
  const cronResponse = await accruePenaltiesCron(
    new Request('http://localhost/api/cron/accrue-penalties', { headers: { authorization: 'Bearer wrong' } }) as Parameters<typeof accruePenaltiesCron>[0],
  );
  assert.equal(cronResponse.status, 401, 'ML-1801 cron endpoint rejects unauthenticated requests');
  assert.deepEqual(await cronResponse.json(), { success: false, error: 'Unauthorized' }, 'ML-1801 cron 401 uses consistent error shape');
}

runAsyncAssertions().then(() => {
  console.log('remaining ML blocked/not-run automation tests passed');
});
