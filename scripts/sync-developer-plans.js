const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      plan: 'free',
      displayName: 'Free',
      description: 'Test out LoanTrack features for free',
      monthlyPrice: 0,
      yearlyPrice: null,
      maxBranches: 1,
      maxAgents: 1,
      maxActiveLoans: 25,
      trialDays: 0,
      features: JSON.stringify([
        'Single branch',
        '1 agent',
        '25 active loans',
        'Basic reporting',
        'Mobile app access'
      ]),
      includedFeatures: JSON.stringify([]),
      sortOrder: 0,
      isActive: true,
    },
    {
      plan: 'basic',
      displayName: 'Basic',
      description: 'Essential tools for small lending businesses',
      monthlyPrice: 799,
      yearlyPrice: 7689,
      maxBranches: 2,
      maxAgents: 5,
      maxActiveLoans: 200,
      trialDays: 15,
      features: JSON.stringify([
        'Up to 2 branches',
        'Up to 5 agents',
        'Up to 200 active loans',
        '15-day free trial',
        'Aadhaar eKYC & Video KYC',
        'Preclose & Early Settlement',
        'Receipt PDF downloads & thermal printing',
        'Standard collection reporting'
      ]),
      includedFeatures: JSON.stringify(['kyc', 'foreclosure', 'receipt_pdf']),
      sortOrder: 1,
      isActive: true,
    },
    {
      plan: 'business',
      displayName: 'Business',
      description: 'Advanced capabilities for growing operations',
      monthlyPrice: 1499,
      yearlyPrice: 16489,
      maxBranches: 5,
      maxAgents: 25,
      maxActiveLoans: 1000,
      trialDays: 15,
      features: JSON.stringify([
        'Up to 5 branches',
        'Up to 25 agents',
        'Up to 1,000 active loans',
        '15-day free trial',
        'Everything in Basic',
        'WhatsApp & SMS alerts',
        'GPS collection & route tracking',
        'Multi-branch analytics',
        'Priority support'
      ]),
      includedFeatures: JSON.stringify(['kyc', 'foreclosure', 'receipt_pdf', 'whatsapp_sms', 'gps_tracking']),
      sortOrder: 2,
      isActive: true,
    },
    {
      plan: 'enterprise',
      displayName: 'Enterprise',
      description: 'Unlimited access for large-scale financial institutions',
      monthlyPrice: 2999,
      yearlyPrice: 32989,
      maxBranches: 999,
      maxAgents: 9999,
      maxActiveLoans: 999999,
      trialDays: 15,
      features: JSON.stringify([
        'Unlimited branches',
        'Up to 9,999 agents',
        'Unlimited active loans',
        '15-day free trial',
        'Everything in Business',
        'Credit bureau integration',
        'eNACH automated mandates',
        'Premium accounting & GST',
        'NPA classification engine',
        'Dedicated SLA support'
      ]),
      includedFeatures: JSON.stringify(['kyc', 'foreclosure', 'receipt_pdf', 'whatsapp_sms', 'gps_tracking', 'bureau', 'nach', 'premium_accounting', 'npa']),
      sortOrder: 3,
      isActive: true,
    },
  ];

  for (const p of plans) {
    await prisma.subscriptionPlanCatalog.upsert({
      where: { plan: p.plan },
      update: p,
      create: p,
    });
  }

  // Deactivate any legacy collector plan from catalog
  await prisma.subscriptionPlanCatalog.updateMany({
    where: { plan: 'collector' },
    data: { isActive: false }
  });

  console.log('Successfully updated subscription plan catalog to match Developer Portal!');
  const all = await prisma.subscriptionPlanCatalog.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  console.log(all);
}

main().catch(console.error).finally(() => prisma.$disconnect());
