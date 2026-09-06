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
  getClientIp,
} from '../lib/rateLimit';
import { verifyRazorpayWebhookSignature } from '../lib/razorpay';

const piiKey = '0123456789abcdef0123456789abcdef';
const encrypted = encryptAadharNumber('1234 5678 9012', piiKey);
assert.notEqual(encrypted, '1234 5678 9012');
assert.equal(decryptAadharNumber(encrypted, piiKey), '123456789012');
assert.equal(decryptAadharNumber('1234 5678 9012', piiKey), '123456789012');
assert.equal(maskAadharNumber('123456789012'), 'XXXX XXXX 9012');
assert.equal(maskAadharNumber(null), null);

assert.equal(extractTenantSlugFromHost('alpha.zolofund.test:3000', 'zolofund.test'), 'alpha');
assert.equal(extractTenantSlugFromHost('zolofund.test', 'zolofund.test'), null);
assert.equal(extractTenantSlugFromHost('localhost:3000', 'zolofund.test'), null);
assert.equal(extractTenantSlugFromHost('127.0.0.1:3000', 'zolofund.test'), null);

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
}, new Date('2026-01-02T00:00:00.000Z')), true);

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

// ── getClientIp tests ──────────────────────────────────────────────────────
function makeRequest(headers: Record<string, string>, ip?: string): Request {
  // Build a minimal Request-like object that satisfies getClientIp's usage.
  const fakeHeaders = { get(name: string) { return headers[name.toLowerCase()] ?? null; } };
  return { headers: fakeHeaders, ...(ip !== undefined ? { ip } : {}) } as unknown as Request;
}

// TRUST_PROXY=false (default): proxy headers are ignored
delete process.env.TRUST_PROXY;
assert.equal(getClientIp(makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8', 'x-real-ip': '9.9.9.9' })), '0.0.0.0', 'no TRUST_PROXY: should ignore proxy headers');
assert.equal(getClientIp(makeRequest({}, '10.0.0.1')), '10.0.0.1', 'no TRUST_PROXY: falls back to request.ip');
assert.equal(getClientIp(makeRequest({})), '0.0.0.0', 'no TRUST_PROXY: falls back to 0.0.0.0');

// TRUST_PROXY=true: use leftmost (client) IP from XFF chain
process.env.TRUST_PROXY = 'true';
assert.equal(getClientIp(makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.9.9.9' })), '1.2.3.4', 'TRUST_PROXY: uses first XFF entry');
assert.equal(getClientIp(makeRequest({ 'x-forwarded-for': ' 1.2.3.4 ' })), '1.2.3.4', 'TRUST_PROXY: trims XFF entry');
// x-real-ip fallback when no XFF header
assert.equal(getClientIp(makeRequest({ 'x-real-ip': '2.2.2.2' })), '2.2.2.2', 'TRUST_PROXY: falls back to x-real-ip when no XFF');
// x-real-ip should NOT be used when TRUST_PROXY is off
delete process.env.TRUST_PROXY;
assert.equal(getClientIp(makeRequest({ 'x-real-ip': '2.2.2.2' })), '0.0.0.0', 'no TRUST_PROXY: x-real-ip is ignored');
// restore TRUST_PROXY for further isolation
process.env.TRUST_PROXY = 'true';
// request.ip fallback when no proxy headers
assert.equal(getClientIp(makeRequest({}, '10.10.10.10')), '10.10.10.10', 'TRUST_PROXY: request.ip used when no proxy headers');
delete process.env.TRUST_PROXY;

console.log('security helper tests passed');
