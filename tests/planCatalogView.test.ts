import assert from 'node:assert/strict';
import { buildPlanCatalogView, type PlanCatalogRow } from '../lib/planCatalogView';

const row = (over: Partial<PlanCatalogRow>): PlanCatalogRow => ({
  plan: 'x',
  displayName: 'X',
  description: null,
  monthlyPrice: 0,
  yearlyPrice: null,
  razorpayYearlyPlanId: null,
  maxBranches: 1,
  maxAgents: 1,
  maxActiveLoans: 25,
  features: '[]',
  includedFeatures: null,
  sortOrder: 0,
  ...over,
});

const catalog: PlanCatalogRow[] = [
  row({ plan: 'business', displayName: 'Business', monthlyPrice: 2999, sortOrder: 2, yearlyPrice: 29990, razorpayYearlyPlanId: 'plan_abc', includedFeatures: '["kyc","gps_tracking"]', features: '["5 branches"]' }),
  row({ plan: 'free', displayName: 'Free', monthlyPrice: 0, sortOrder: 0 }),
  row({ plan: 'basic', displayName: 'Basic', monthlyPrice: 999, sortOrder: 1, yearlyPrice: 9990, razorpayYearlyPlanId: null, includedFeatures: '["kyc"]' }),
];

const cards = buildPlanCatalogView(catalog, 'Basic');

assert.deepEqual(cards.map((c) => c.plan), ['free', 'basic', 'business'], 'ordered by the developer sortOrder');
assert.deepEqual(cards.map((c) => c.monthlyPrice), [0, 999, 2999], 'prices come from the catalog row');
assert.deepEqual(cards.map((c) => c.isCurrent), [false, true, false], 'current plan matched case-insensitively');

const [free, basic, business] = cards;
assert.equal(basic.yearlyPrice, null, 'yearly hidden without a Razorpay yearly plan');
assert.equal(business.yearlyPrice, 29990, 'yearly offered when price and Razorpay plan are set');
assert.equal(business.yearlySavingsPercent, 17, 'savings computed on the server');
assert.equal(free.includesPlan, null, 'free plan names no lower plan');
assert.equal(basic.includesPlan, null, 'cheapest paid plan names no lower plan');
assert.equal(business.includesPlan, 'Basic', 'higher plan names the next-cheaper paid plan');
assert.deepEqual(business.includedFeatures, ['kyc', 'gps_tracking']);
assert.deepEqual(business.features, ['5 branches']);

const unl = buildPlanCatalogView([row({ plan: 'ent', maxBranches: 999, maxAgents: 998, maxActiveLoans: 999999 })], 'ent')[0];
assert.deepEqual(unl.unlimited, { branches: true, agents: false, activeLoans: true }, 'unlimited flags decided on the server');

assert.equal(buildPlanCatalogView(catalog, null).some((c) => c.isCurrent), false, 'no subscription = no current plan');
assert.deepEqual(buildPlanCatalogView([], 'basic'), [], 'empty catalog = no plans');

console.log('planCatalogView: ok');
