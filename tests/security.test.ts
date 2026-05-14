import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  decryptAadharNumber,
  encryptAadharNumber,
  maskAadharNumber,
} from '../lib/pii';
import {
  isTenantTrialExpired,
  normalizeRazorpaySubscriptionStatus,
} from '../lib/subscription';
import {
  extractTenantSlugFromHost,
  isTenantHostAllowedForSession,
} from '../lib/tenant';
import {
  checkFixedWindowLimit,
  createFixedWindowStore,
} from '../lib/rateLimit';
import { verifyRazorpayWebhookSignature } from '../lib/razorpay';

const piiKey = '0123456789abcdef0123456789abcdef';
const encrypted = encryptAadharNumber('1234 5678 9012', piiKey);
assert.notEqual(encrypted, '1234 5678 9012');
assert.equal(decryptAadharNumber(encrypted, piiKey), '123456789012');
assert.equal(decryptAadharNumber('1234 5678 9012', piiKey), '123456789012');
assert.equal(maskAadharNumber('123456789012'), 'XXXX XXXX 9012');
assert.equal(maskAadharNumber(null), null);

assert.equal(extractTenantSlugFromHost('alpha.loantrack.test:3000', 'loantrack.test'), 'alpha');
assert.equal(extractTenantSlugFromHost('loantrack.test', 'loantrack.test'), null);
assert.equal(extractTenantSlugFromHost('localhost:3000', 'loantrack.test'), null);
assert.equal(extractTenantSlugFromHost('127.0.0.1:3000', 'loantrack.test'), null);

assert.equal(isTenantHostAllowedForSession({
  requestedTenantId: 'tenant_1',
  sessionTenantId: 'tenant_1',
  role: 'admin',
}), true);
assert.equal(isTenantHostAllowedForSession({
  requestedTenantId: 'tenant_2',
  sessionTenantId: 'tenant_1',
  role: 'admin',
}), false);
assert.equal(isTenantHostAllowedForSession({
  requestedTenantId: 'tenant_2',
  sessionTenantId: 'tenant_1',
  role: 'developer',
}), true);

assert.equal(isTenantTrialExpired({
  plan: 'trial',
  status: 'active',
  trialEndsAt: new Date('2026-01-01T00:00:00.000Z'),
}, new Date('2026-01-02T00:00:00.000Z')), true);
assert.equal(isTenantTrialExpired({
  plan: 'growth',
  status: 'active',
  trialEndsAt: new Date('2026-01-01T00:00:00.000Z'),
}, new Date('2026-01-02T00:00:00.000Z')), false);

assert.equal(normalizeRazorpaySubscriptionStatus('subscription.activated'), 'active');
assert.equal(normalizeRazorpaySubscriptionStatus('subscription.charged'), 'active');
assert.equal(normalizeRazorpaySubscriptionStatus('subscription.halted'), 'past_due');
assert.equal(normalizeRazorpaySubscriptionStatus('subscription.cancelled'), 'cancelled');

const store = createFixedWindowStore();
assert.equal(checkFixedWindowLimit(store, 'username', 2, 1_000, 0).allowed, true);
assert.equal(checkFixedWindowLimit(store, 'username', 2, 1_000, 1).allowed, true);
assert.equal(checkFixedWindowLimit(store, 'username', 2, 1_000, 2).allowed, false);
assert.equal(checkFixedWindowLimit(store, 'username', 2, 1_000, 1_001).allowed, true);

const body = '{"event":"subscription.activated"}';
const secret = 'webhook-secret';
const validSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');
assert.equal(verifyRazorpayWebhookSignature(body, secret, validSignature), true);
assert.equal(verifyRazorpayWebhookSignature(body, secret, 'bad'), false);

console.log('security helper tests passed');
