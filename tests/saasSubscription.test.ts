import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRazorpaySubscriptionRequest, normalizeBillingCycle } from '../lib/razorpay';
import { yearlySavingsPercent } from '../lib/pricing';
import { planFeatureUpdate, parseFeatureKeys } from '../lib/planFeatures';
import { planLimitActions } from '../lib/planLimits';
import {
  getEffectiveTrialEndsAt,
  isUnpaidExpiredTrial,
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
  false,
  'the Free plan is permanent: it never hits the paywall, however old',
);
assert.equal(
  getEffectiveTrialEndsAt({
    plan: 'free',
    status: 'active',
    createdAt: new Date('2026-07-25T00:00:00.000Z'),
  }),
  null,
  'the Free plan has no trial clock',
);
assert.equal(
  getTenantSubscriptionAccessState({ plan: 'free', status: 'cancelled' }, now).blocked,
  true,
  'a cancelled subscription is still blocked, even on Free',
);

// Unpaid expired trials are moved to Free (lib/trialExpiry.ts), not blocked.
const unpaidTrial = { plan: 'basic', status: 'active', trialEndsAt: new Date('2026-07-20T00:00:00.000Z') };
assert.equal(isUnpaidExpiredTrial(unpaidTrial, now), true, 'an unpaid expired trial is downgraded');
assert.equal(
  isUnpaidExpiredTrial({ ...unpaidTrial, trialEndsAt: new Date('2026-08-05T00:00:00.000Z') }, now),
  false,
  'a trial still running is left alone',
);
assert.equal(
  isUnpaidExpiredTrial({ ...unpaidTrial, currentPeriodEnd: new Date('2026-08-20T00:00:00.000Z') }, now),
  false,
  'a trial that converted to a paid period is left alone',
);
assert.equal(
  isUnpaidExpiredTrial({ ...unpaidTrial, status: 'authenticated' }, now),
  false,
  'an authorised Razorpay mandate is waiting to charge, so no downgrade',
);
assert.equal(isUnpaidExpiredTrial({ ...unpaidTrial, plan: 'free' }, now), false, 'Free is never downgraded');
assert.equal(isUnpaidExpiredTrial({ ...unpaidTrial, plan: 'lifetime' }, now), false, 'lifetime is never downgraded');

// Plan-bundled features.
const planChecklists = {
  basic: JSON.stringify(['kyc', 'foreclosure', 'receipt_pdf']),
  enterprise: JSON.stringify(['kyc', 'foreclosure', 'receipt_pdf', 'whatsapp_sms', 'gps_tracking', 'bureau', 'nach', 'premium_accounting', 'npa']),
};
const basicUpdate = planFeatureUpdate({ plan: 'basic', includedFeatures: planChecklists.basic }, { plan: 'free' });
assert.ok(basicUpdate, 'a configured plan produces a feature update');
assert.equal(basicUpdate.kycEnabled, true);
assert.equal(basicUpdate.receiptPdfAllowed, true);
assert.equal(basicUpdate.gpsTrackingEnabled, false, 'Basic does not include GPS');
assert.equal(basicUpdate.nachEnabled, false, 'Basic does not include eNACH');
assert.equal(
  planFeatureUpdate({ plan: 'basic', includedFeatures: null }, { plan: 'free' }),
  null,
  'a plan with no checklist leaves tenant flags untouched',
);
const freeUpdate = planFeatureUpdate({ plan: 'free', includedFeatures: '[]' }, { plan: 'enterprise', grandfatheredFeatures: '["gps_tracking"]' });
assert.ok(freeUpdate && Object.values(freeUpdate).every((v) => v === false || v === null), 'moving to Free clears every feature and the grandfathered list');
// Grandfathering: extras survive a renewal on the same plan, and are dropped on a plan change.
const renew = planFeatureUpdate({ plan: 'basic', includedFeatures: planChecklists.basic }, { plan: 'basic', grandfatheredFeatures: '["gps_tracking"]' });
assert.equal(renew?.gpsTrackingEnabled, true, 'a grandfathered extra survives a renewal');
assert.equal(renew?.grandfatheredFeatures, '["gps_tracking"]');
const upgrade = planFeatureUpdate({ plan: 'enterprise', includedFeatures: planChecklists.enterprise }, { plan: 'basic', grandfatheredFeatures: '["gps_tracking"]' });
assert.equal(upgrade?.nachEnabled, true, 'Enterprise includes eNACH');
assert.equal(upgrade?.grandfatheredFeatures, null, 'grandfathered extras are cleared when the plan changes');
assert.deepEqual(parseFeatureKeys('["kyc","not_a_feature","kyc"]'), ['kyc'], 'unknown and duplicate keys are dropped');

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

assert.deepEqual(
  buildRazorpaySubscriptionRequest('basic', 'tenant-1', {
    razorpayPlanId: 'plan_yearly',
    billingCycle: 'yearly',
  }),
  {
    plan_id: 'plan_yearly',
    total_count: 10,
    customer_notify: 1,
    notes: { tenant_id: 'tenant-1', loantrack_plan: 'basic', loantrack_cycle: 'yearly' },
  },
  'yearly checkout spans the same period in years and records the cycle in notes',
);
assert.equal(normalizeBillingCycle('yearly'), 'yearly');
assert.equal(normalizeBillingCycle('anything-else'), 'monthly', 'unknown cycles fall back to monthly');
assert.equal(yearlySavingsPercent(799, 7689), 20, 'yearly saving is whole-percent vs 12 monthly payments');
assert.equal(yearlySavingsPercent(799, 9999), 0, 'no saving is reported when yearly is not cheaper');

// Plan limits: earliest-created survive, later ones lock, upgrades unlock earliest first.
const agentsByAge = [
  { id: 'a1', status: 'active' },
  { id: 'a2', status: 'active' },
  { id: 'a3', status: 'active' },
];
assert.deepEqual(planLimitActions(agentsByAge, 1), { toLock: ['a2', 'a3'], toUnlock: [] }, 'only the earliest agent survives a limit of 1');
assert.deepEqual(
  planLimitActions([{ id: 'a1', status: 'active' }, { id: 'a2', status: 'plan_locked' }, { id: 'a3', status: 'plan_locked' }], 2),
  { toLock: [], toUnlock: ['a2'] },
  'an upgrade to 2 unlocks the earliest locked agent only',
);
assert.deepEqual(planLimitActions(agentsByAge, 3), { toLock: [], toUnlock: [] }, 'nothing changes when within the limit');

const checkoutAction = readFileSync('app/portal/billing/actions.ts', 'utf8');
const webhook = readFileSync('app/api/webhooks/razorpay/route.ts', 'utf8');
const registration = readFileSync('app/api/register/email/route.ts', 'utf8');
assert.match(checkoutAction, /data:\s*\{ razorpaySubId: subscription\.id \}/, 'checkout persists the Razorpay subscription ID');
assert.match(checkoutAction, /redirect\(checkoutUrl\)/, 'checkout redirects to Razorpay');
assert.match(webhook, /subscription\.notes\?\.tenant_id/, 'webhook can recover tenant linkage from signed notes');
assert.match(webhook, /status: 'processing'/, 'webhook reserves an idempotency record before billing mutations');
assert.match(registration, /monthlyPrice < 0/, 'SaaS registration validates active plan catalog pricing');

console.log('SaaS subscription lifecycle regression checks passed');
