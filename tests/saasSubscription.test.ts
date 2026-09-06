import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRazorpaySubscriptionRequest } from '../lib/razorpay';
import {
  getEffectiveTrialEndsAt,
  getTenantSubscriptionAccessState,
  normalizeRazorpaySubscriptionStatus,
} from '../lib/subscription';

const now = new Date('2026-08-01T12:00:00.000Z');

assert.equal(
  getTenantSubscriptionAccessState({
    plan: 'basic',
    status: 'active',
    trialEndsAt: new Date('2026-08-02T12:00:00.000Z'),
  }, now).blocked,
  false,
  'an active SaaS trial can access the workspace',
);

const expiredTrial = getTenantSubscriptionAccessState({
  plan: 'basic',
  status: 'active',
  trialEndsAt: new Date('2026-07-31T12:00:00.000Z'),
}, now);
assert.equal(expiredTrial.blocked, true, 'an expired SaaS trial is blocked');
assert.equal(expiredTrial.reason, 'trial_expired');

assert.equal(
  getTenantSubscriptionAccessState({
    plan: 'business',
    status: 'past_due',
    currentPeriodEnd: new Date('2026-08-02T12:00:00.000Z'),
  }, now).blocked,
  false,
  'a captured paid period remains available through its period end',
);

assert.equal(
  getTenantSubscriptionAccessState({ plan: 'enterprise', status: 'active' }, now).reason,
  'payment_required',
  'a SaaS row without a trial or paid period fails closed',
);

assert.equal(
  getTenantSubscriptionAccessState({
    plan: 'free',
    status: 'active',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
  }, now).blocked,
  true,
  'a legacy permanent-free SaaS row becomes an expired 14-day trial',
);
assert.ok(
  getEffectiveTrialEndsAt({
    plan: 'free',
    status: 'active',
    createdAt: new Date('2026-07-25T00:00:00.000Z'),
  }),
  'a recent legacy free row receives an effective trial end',
);

assert.equal(
  getTenantSubscriptionAccessState({
    plan: 'free',
    status: 'active',
    createdAt: new Date('2020-01-01T00:00:00.000Z'),
    tenant: { customDomain: 'loans.example.com' },
  }, now).blocked,
  false,
  'custom-domain installations remain lifetime-free',
);
assert.equal(
  getTenantSubscriptionAccessState({ plan: 'lifetime', status: 'active' }, now).blocked,
  false,
  'explicit lifetime installations remain free',
);

assert.equal(normalizeRazorpaySubscriptionStatus('subscription.charged'), 'active');
assert.equal(normalizeRazorpaySubscriptionStatus('subscription.authenticated'), 'authenticated');
assert.equal(normalizeRazorpaySubscriptionStatus('subscription.halted'), 'past_due');
assert.equal(normalizeRazorpaySubscriptionStatus('subscription.completed'), 'expired');

assert.deepEqual(
  buildRazorpaySubscriptionRequest('business', 'tenant-1', {
    razorpayPlanId: 'plan_server_price',
    startAt: 1_800_000_000,
  }),
  {
    plan_id: 'plan_server_price',
    total_count: 120,
    customer_notify: 1,
    start_at: 1_800_000_000,
    notes: { tenant_id: 'tenant-1', loantrack_plan: 'business' },
  },
  'checkout uses the server-created Razorpay plan and a scheduled post-trial start',
);

const checkoutAction = readFileSync('app/portal/billing/actions.ts', 'utf8');
const webhook = readFileSync('app/api/webhooks/razorpay/route.ts', 'utf8');
const registration = readFileSync('app/api/register/email/route.ts', 'utf8');
assert.match(checkoutAction, /data:\s*\{ razorpaySubId: subscription\.id \}/, 'checkout persists the Razorpay subscription ID');
assert.match(checkoutAction, /redirect\(checkoutUrl\)/, 'checkout redirects to Razorpay');
assert.match(webhook, /subscription\.notes\?\.tenant_id/, 'webhook can recover tenant linkage from signed notes');
assert.match(webhook, /status: 'processing'/, 'webhook reserves an idempotency record before billing mutations');
assert.match(registration, /monthlyPrice:\s*\{ gt: 0 \}|monthlyPrice <= 0/, 'SaaS registration rejects permanent-free plans');

console.log('SaaS subscription lifecycle regression checks passed');
