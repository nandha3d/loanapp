import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding pricing catalog...');

  // ── 1. Clear existing catalog data ──────────────────────────────────────────
  await prisma.subscriptionPlanCatalog.deleteMany({});
  await prisma.modulePriceCatalog.deleteMany({});
  await prisma.addonCatalog.deleteMany({});
  console.log('🗑️  Cleared existing pricing catalog');

  // ── 2. Seed Subscription Plans ──────────────────────────────────────────────
  const plans = [
    {
      plan: 'free',
      displayName: 'Free',
      description: 'Test out LoanTrack features for free',
      monthlyPrice: 0,
      maxBranches: 1,
      maxAgents: 1,
      maxActiveLoans: 25,
      features: JSON.stringify([
        'Single branch',
        '1 agent',
        '25 active loans',
        'Basic reporting'
      ]),
      sortOrder: 0
    },
    {
      plan: 'basic',
      displayName: 'Basic',
      description: 'Essential tools for small lending businesses',
      monthlyPrice: 999,
      maxBranches: 2,
      maxAgents: 10,
      maxActiveLoans: 200,
      features: JSON.stringify([
        'Up to 2 branches',
        'Up to 10 agents',
        '200 active loans',
        'Standard reporting',
        'WhatsApp notifications',
        'Basic accounting'
      ]),
      sortOrder: 1
    },
    {
      plan: 'business',
      displayName: 'Business',
      description: 'Advanced capabilities for growing operations',
      monthlyPrice: 1999,
      maxBranches: 5,
      maxAgents: 50,
      maxActiveLoans: 1000,
      features: JSON.stringify([
        'Up to 5 branches',
        'Up to 50 agents',
        '1000 active loans',
        'Advanced reporting',
        'Priority support',
        'MFA security',
        'Custom branding'
      ]),
      sortOrder: 2
    },
    {
      plan: 'enterprise',
      displayName: 'Enterprise',
      description: 'Unlimited access for large-scale financial institutions',
      monthlyPrice: 2999,
      maxBranches: 999,
      maxAgents: 999,
      maxActiveLoans: 999999,
      features: JSON.stringify([
        'Unlimited branches',
        'Unlimited agents',
        'Unlimited loans',
        '24/7 Dedicated Support',
        'Custom integrations',
        'MFA enforcement',
        'Dedicated server options'
      ]),
      sortOrder: 3
    }
  ];

  for (const planData of plans) {
    await prisma.subscriptionPlanCatalog.create({ data: planData });
  }
  console.log('✅ Seeded subscription plans catalog');

  // ── 3. Seed Modules Pricing ──────────────────────────────────────────────────
  const modules = [
    {
      module: 'microlending',
      displayName: 'Micro Lending',
      description: 'Manage micro loans, daily collections, routes, and agents',
      monthlyPrice: 0,
      sortOrder: 0
    },
    {
      module: 'autofinance',
      displayName: 'Auto Finance',
      description: 'Vehicle financing, hire purchase, collateral tracking, and hypothecation',
      monthlyPrice: 0,
      sortOrder: 1
    },
    {
      module: 'goldloan',
      displayName: 'Gold Loan',
      description: 'Gold-backed lending, valuation, LTV, packets, pledges, and release tracking',
      monthlyPrice: 0,
      sortOrder: 2
    },
    {
      module: 'chitfunds',
      displayName: 'Chit Funds',
      description: 'Organize chit groups, auctions, dividend distribution, and member entries',
      monthlyPrice: 0,
      sortOrder: 3
    }
  ];

  for (const moduleData of modules) {
    await prisma.modulePriceCatalog.create({ data: moduleData });
  }
  console.log('✅ Seeded vertical bases catalog');

  // ── 4. Seed Addons Pricing ───────────────────────────────────────────────────
  const addons = [
    {
      addon: 'whatsapp_sms',
      displayName: 'WhatsApp & SMS Alerts',
      description: 'Send automated payment reminders, OTPs, and customer alerts',
      monthlyPrice: 299, // High demand
      sortOrder: 0
    },
    {
      addon: 'kyc',
      displayName: 'Digital Aadhaar & Video KYC',
      description: 'Instant verification of customer identity with photo matching',
      monthlyPrice: 399, // High complexity
      sortOrder: 1
    },
    {
      addon: 'gps_tracking',
      displayName: 'Agent Route GPS Tracking',
      description: 'Real-time GPS coordinates verification for collection entries',
      monthlyPrice: 199, // Medium demand
      sortOrder: 2
    },
    {
      addon: 'premium_accounting',
      displayName: 'Premium Accounting & GST',
      description: 'Double-entry ledger book, P&L, Balance Sheet, GST summaries, and budget mapping',
      monthlyPrice: 599, // Very high complexity
      sortOrder: 3
    },
    {
      addon: 'bureau',
      displayName: 'Credit Bureau Integration',
      description: 'Query CRIF/CIBIL credit history directly for applicants',
      monthlyPrice: 199, // Medium complexity
      sortOrder: 4
    }
  ];

  for (const addonData of addons) {
    await prisma.addonCatalog.create({ data: addonData });
  }
  console.log('✅ Seeded addons pricing catalog');

  console.log('🎉 Pricing catalog seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
