/* eslint-disable */
// Seeds modules + addons into catalog tables. Safe to re-run (upsert).
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const modules = [
  {
    module: 'microlending',
    displayName: 'Micro Lending',
    description: 'Core daily/weekly collection, instalment loans, route management, field agent tracking.',
    monthlyPrice: 0, // included in all plans
    isActive: true,
    sortOrder: 1,
  },
  {
    module: 'autofinance',
    displayName: 'Auto Finance',
    description: 'Vehicle-backed loans — two-wheeler, four-wheeler, commercial. RC, insurance & chassis tracking.',
    monthlyPrice: 499,
    isActive: true,
    sortOrder: 2,
  },
  {
    module: 'chitfunds',
    displayName: 'Chit Funds',
    description: 'Group savings chit management — member enrolment, monthly auctions, dividend calculation.',
    monthlyPrice: 499,
    isActive: true,
    sortOrder: 3,
  },
  {
    module: 'goldloan',
    displayName: 'Gold Loan',
    description: 'Gold-backed lending — purity grade, weight, valuation, per-gram rate, collateral tracking.',
    monthlyPrice: 499,
    isActive: true,
    sortOrder: 4,
  },
];

const addons = [
  {
    addon: 'gps_tracking',
    displayName: 'GPS Agent Tracking',
    description: 'Live agent location map, geofenced collection validation, route progress, daily trail history.',
    monthlyPrice: 299,
    isActive: true,
    sortOrder: 1,
  },
  {
    addon: 'kyc',
    displayName: 'KYC Verification',
    description: 'Aadhaar OTP + video-based KYC via Digio. Admin review queue with approve/reject workflow.',
    monthlyPrice: 499,
    isActive: true,
    sortOrder: 2,
  },
  {
    addon: 'premium_accounting',
    displayName: 'Premium Accounting',
    description: 'Full double-entry CoA, P&L, balance sheet, cashflow, tax (GSTR/TDS), budget, bank reconciliation, period lock.',
    monthlyPrice: 999,
    isActive: true,
    sortOrder: 3,
  },
  {
    addon: 'bureau',
    displayName: 'Credit Bureau Pulls',
    description: 'CIBIL & CRIF credit report pulls for borrowers. 50 pulls/month included; additional pulls billed per use.',
    monthlyPrice: 799,
    isActive: true,
    sortOrder: 4,
  },
  {
    addon: 'whatsapp_sms',
    displayName: 'WhatsApp & SMS Notifications',
    description: 'Automated customer notifications via WhatsApp and SMS — payment reminders, receipts, overdue alerts.',
    monthlyPrice: 299,
    isActive: true,
    sortOrder: 5,
  },
];

(async () => {
  console.log('── Modules ──────────────────────────');
  for (const m of modules) {
    await p.modulePriceCatalog.upsert({
      where: { module: m.module },
      create: m,
      update: {
        displayName: m.displayName,
        description: m.description,
        monthlyPrice: m.monthlyPrice,
        sortOrder: m.sortOrder,
      },
    });
    const price = m.monthlyPrice === 0 ? 'Included' : `₹${m.monthlyPrice}/mo`;
    console.log(`  ✓ ${m.module.padEnd(14)} ${price}`);
  }

  console.log('\n── Add-ons ──────────────────────────');
  for (const a of addons) {
    await p.addonCatalog.upsert({
      where: { addon: a.addon },
      create: a,
      update: {
        displayName: a.displayName,
        description: a.description,
        monthlyPrice: a.monthlyPrice,
        sortOrder: a.sortOrder,
      },
    });
    console.log(`  ✓ ${a.addon.padEnd(22)} ₹${a.monthlyPrice}/mo`);
  }

  console.log('\nDone — 4 modules + 5 add-ons seeded.');
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
