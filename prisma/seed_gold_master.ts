import { PrismaClient } from '@prisma/client';
import { GOLD_SETTING_KEYS } from '../lib/gold/settings';

const prisma = new PrismaClient();

// Default gold/silver master data + settings. Idempotent (upsert). Seeds every
// tenant so the pledge dropdowns work out of the box; admins then edit them in
// the gold settings page. These are SEED DEFAULTS only — not app hardcoding.

const ORNAMENT_TYPES = [
  '3 ROW CHAIN MUGAPPU', 'BRACELATES', 'CHAIN', 'MATTAL', 'NECKLES',
  'ONE ROW CHAIN', 'ONE ROW CHAIN WITH FISH DOOLAR', 'RING', 'STUD',
  'STUD MALE', 'STUD MATTAL', 'THALI', 'TWO ROW MUGAPU CHAIN',
];
const ORNAMENT_SPECS: Array<{ name: string; purityKarat?: string }> = [
  { name: '916 22K', purityKarat: '22K' },
  { name: '22K', purityKarat: '22K' },
  { name: '21K', purityKarat: '21K' },
  { name: '18K', purityKarat: '18K' },
  { name: '24K', purityKarat: '24K' },
];
const BANK_NAMES = ['SELF LOCKER', 'BOI', 'BOM', 'IOB', 'SBI'];

const DEFAULT_SETTINGS: Record<string, string> = {
  [GOLD_SETTING_KEYS.goldPureRate]: '7500',
  [GOLD_SETTING_KEYS.silverRate]: '75',
  [GOLD_SETTING_KEYS.goldInterestPercent]: '2',
  [GOLD_SETTING_KEYS.silverInterestPercent]: '4',
  [GOLD_SETTING_KEYS.interestSchemeMonths]: '1',
  [GOLD_SETTING_KEYS.processingFeeDefault]: '0',
  [GOLD_SETTING_KEYS.processingFeePercentageBased]: 'false',
  [GOLD_SETTING_KEYS.autoRateKaratBased]: 'false',
  [GOLD_SETTING_KEYS.defaultLtvPercent]: '75',
  [GOLD_SETTING_KEYS.billPrefix]: 'A',
};

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  if (tenants.length === 0) {
    console.log('No tenants found — nothing to seed.');
    return;
  }

  for (const { id: tenantId } of tenants) {
    for (let i = 0; i < ORNAMENT_TYPES.length; i++) {
      await prisma.ornamentType.upsert({
        where: { tenantId_name: { tenantId, name: ORNAMENT_TYPES[i] } },
        update: {},
        create: { tenantId, name: ORNAMENT_TYPES[i], metal: 'gold', sortOrder: i },
      });
    }
    for (let i = 0; i < ORNAMENT_SPECS.length; i++) {
      const s = ORNAMENT_SPECS[i];
      await prisma.ornamentSpecification.upsert({
        where: { tenantId_name: { tenantId, name: s.name } },
        update: {},
        create: { tenantId, name: s.name, purityKarat: s.purityKarat ?? null, sortOrder: i },
      });
    }
    for (let i = 0; i < BANK_NAMES.length; i++) {
      await prisma.bankName.upsert({
        where: { tenantId_name: { tenantId, name: BANK_NAMES[i] } },
        update: {},
        create: { tenantId, name: BANK_NAMES[i], sortOrder: i },
      });
    }
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await prisma.appSetting.upsert({
        where: { tenantId_key: { tenantId, key } },
        update: {}, // don't clobber an admin's edited value
        create: { tenantId, key, value, group: 'gold' },
      });
    }
  }
  console.log(`Seeded gold master data + settings for ${tenants.length} tenant(s).`);
}

main()
  .catch((e) => {
    console.error('Gold master seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
