/* eslint-disable */
// Seeds the 4 subscription plans (free/basic/business/enterprise) into
// subscription_plan_catalogs. Safe to re-run — upserts on plan key.
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const plans = [
  {
    plan: 'free',
    displayName: 'Free',
    description: 'Perfect for individuals — always free',
    monthlyPrice: 0,
    maxBranches: 1,
    maxAgents: 1,
    maxActiveLoans: 25,
    trialDays: 0,
    features: JSON.stringify([
      'Up to 25 active loans',
      '1 agent account',
      '1 branch',
      'Micro Lending module',
      'Basic collection tracking',
      'Mobile app access',
    ]),
    razorpayPlanId: null,
    isActive: true,
    sortOrder: 1,
  },
  {
    plan: 'basic',
    displayName: 'Basic',
    description: 'Small NBFC or personal lender',
    monthlyPrice: 999,
    maxBranches: 2,
    maxAgents: 10,
    maxActiveLoans: 200,
    trialDays: 0,
    features: JSON.stringify([
      'Up to 200 active loans',
      '10 agent accounts',
      '2 branches',
      'Micro Lending + Auto Finance',
      'GPS agent tracking',
      'Receipt PDF download',
      'Collection analytics',
    ]),
    razorpayPlanId: null,
    isActive: true,
    sortOrder: 2,
  },
  {
    plan: 'business',
    displayName: 'Business',
    description: 'Growing microfinance operation',
    monthlyPrice: 2999,
    maxBranches: 5,
    maxAgents: 50,
    maxActiveLoans: 1000,
    trialDays: 0,
    features: JSON.stringify([
      'Up to 1,000 active loans',
      '50 agent accounts',
      '5 branches',
      'All modules (Micro Lending, Auto Finance, Chit Funds, Gold Loan)',
      'Premium accounting & P&L',
      'NPA classification & provisioning',
      'Bureau credit pulls (CIBIL/CRIF)',
      'KYC verification',
      'WhatsApp notifications',
    ]),
    razorpayPlanId: null,
    isActive: true,
    sortOrder: 3,
  },
  {
    plan: 'enterprise',
    displayName: 'Enterprise',
    description: 'Unlimited scale — 15-day free trial',
    monthlyPrice: 7999,
    maxBranches: 999,
    maxAgents: 999,
    maxActiveLoans: 999999,
    trialDays: 15,
    features: JSON.stringify([
      'Unlimited active loans',
      'Unlimited agents',
      'Unlimited branches',
      'All modules included',
      'All add-ons included',
      'Dedicated support',
      'Custom branding',
      'SLA guarantee',
      '15-day free trial — no credit card required',
    ]),
    razorpayPlanId: null,
    isActive: true,
    sortOrder: 4,
  },
];

(async () => {
  for (const plan of plans) {
    await p.subscriptionPlanCatalog.upsert({
      where: { plan: plan.plan },
      create: plan,
      update: {
        displayName: plan.displayName,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        maxBranches: plan.maxBranches,
        maxAgents: plan.maxAgents,
        maxActiveLoans: plan.maxActiveLoans,
        trialDays: plan.trialDays,
        features: plan.features,
        sortOrder: plan.sortOrder,
      },
    });
    console.log(`✓ ${plan.plan} — ₹${plan.monthlyPrice}/mo, trial: ${plan.trialDays}d`);
  }
  console.log('\nAll 4 plans seeded.');
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
