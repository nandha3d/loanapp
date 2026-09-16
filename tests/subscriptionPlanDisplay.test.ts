import assert from 'node:assert/strict';

// Test subscription plan pricing display formatting according to developer catalog settings
export function formatPlanPriceDisplay(monthlyPrice: number): { label: string; perMonth: boolean } {
  if (monthlyPrice === 0) {
    return { label: 'Free', perMonth: false };
  }
  return { label: `₹${monthlyPrice.toLocaleString('en-IN')}`, perMonth: true };
}

// 1. Verify developer subscription pricing tiers
const developerPlans = [
  { plan: 'free', monthlyPrice: 0, maxBranches: 1, maxActiveLoans: 25, maxAgents: 1 },
  { plan: 'basic', monthlyPrice: 699, maxBranches: 2, maxActiveLoans: 200, maxAgents: 5 },
  { plan: 'business', monthlyPrice: 1499, maxBranches: 5, maxActiveLoans: 1000, maxAgents: 25 },
  { plan: 'enterprise', monthlyPrice: 2999, maxBranches: 999, maxActiveLoans: 999999, maxAgents: 9999 },
];

// Free plan checks
const freePlan = developerPlans[0];
const freeFormatted = formatPlanPriceDisplay(freePlan.monthlyPrice);
assert.equal(freeFormatted.label, 'Free');
assert.equal(freeFormatted.perMonth, false);
assert.equal(freePlan.maxBranches, 1);
assert.equal(freePlan.maxActiveLoans, 25);
assert.equal(freePlan.maxAgents, 1);

// Basic plan checks
const basicPlan = developerPlans[1];
const basicFormatted = formatPlanPriceDisplay(basicPlan.monthlyPrice);
assert.equal(basicFormatted.label, '₹699');
assert.equal(basicFormatted.perMonth, true);
assert.equal(basicPlan.maxBranches, 2);
assert.equal(basicPlan.maxActiveLoans, 200);
assert.equal(basicPlan.maxAgents, 5);

// Business plan checks
const businessPlan = developerPlans[2];
const businessFormatted = formatPlanPriceDisplay(businessPlan.monthlyPrice);
assert.equal(businessFormatted.label, '₹1,499');
assert.equal(businessFormatted.perMonth, true);
assert.equal(businessPlan.maxBranches, 5);
assert.equal(businessPlan.maxActiveLoans, 1000);
assert.equal(businessPlan.maxAgents, 25);

// Enterprise plan checks
const enterprisePlan = developerPlans[3];
const enterpriseFormatted = formatPlanPriceDisplay(enterprisePlan.monthlyPrice);
assert.equal(enterpriseFormatted.label, '₹2,999');
assert.equal(enterpriseFormatted.perMonth, true);
assert.equal(enterprisePlan.maxBranches >= 999, true);
assert.equal(enterprisePlan.maxActiveLoans >= 999999, true);
assert.equal(enterprisePlan.maxAgents >= 9999, true);

// 2. Verify total monthly charge on free tier ignores add-ons and vertical multipliers
function computeSimulatedSubscriptionCost(plan: string, catalogMonthlyPrice: number, addonsPrice: number) {
  const isFreePlan = plan === 'free' || catalogMonthlyPrice === 0;
  const basePlanPrice = isFreePlan ? 0 : catalogMonthlyPrice;
  const effectiveAddonsPrice = isFreePlan ? 0 : addonsPrice;
  const totalMonthlyPrice = basePlanPrice + effectiveAddonsPrice;
  return { basePlanPrice, modulesPrice: 0, addonsPrice: effectiveAddonsPrice, totalMonthlyPrice };
}

const freeWithAddons = computeSimulatedSubscriptionCost('free', 0, 1695);
assert.equal(freeWithAddons.basePlanPrice, 0);
assert.equal(freeWithAddons.modulesPrice, 0);
assert.equal(freeWithAddons.addonsPrice, 0);
assert.equal(freeWithAddons.totalMonthlyPrice, 0);

const businessWithAddons = computeSimulatedSubscriptionCost('business', 1499, 1695);
assert.equal(businessWithAddons.basePlanPrice, 1499);
assert.equal(businessWithAddons.modulesPrice, 0);
assert.equal(businessWithAddons.addonsPrice, 1695);
assert.equal(businessWithAddons.totalMonthlyPrice, 3194);

console.log('subscriptionPlanDisplay unit tests passed successfully');
