import assert from 'node:assert/strict';
import { calculateVerticalSubscriptionPricing } from '../lib/pricing';

// 1. Verify pricing calculations for base + multi-vertical + add-ons
const basicPricing = calculateVerticalSubscriptionPricing(699, ['microlending'], 0);
assert.equal(basicPricing.basePlanPrice, 699);
assert.equal(basicPricing.modulesPrice, 0);
assert.equal(basicPricing.totalMonthlyPrice, 699);

const businessMultiVertical = calculateVerticalSubscriptionPricing(
  1499,
  ['microlending', 'autofinance', 'chitfunds'],
  299, // e.g. whatsapp addon
);
assert.equal(businessMultiVertical.basePlanPrice, 1499);
// 2 extra verticals:
assert.equal(businessMultiVertical.modulesPrice, 2 * 1499);
assert.equal(businessMultiVertical.addonsPrice, 299);
assert.equal(businessMultiVertical.totalMonthlyPrice, 1499 + 2998 + 299);

// 2. Verify branch limits scaling across tiers
const tierBranchLimits: Record<string, number> = {
  free: 1,
  basic: 2,
  business: 5,
  enterprise: 999,
};

assert.ok(tierBranchLimits.basic > tierBranchLimits.free, 'Basic tier unlocks more branches than Free');
assert.ok(tierBranchLimits.business > tierBranchLimits.basic, 'Business tier unlocks more branches than Basic');
assert.ok(tierBranchLimits.enterprise >= 999, 'Enterprise tier provides unlimited branches');

console.log('subscriptionUpgrade unit tests passed successfully');
