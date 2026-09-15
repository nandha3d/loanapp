import { PrismaClient } from '@prisma/client';
import { ornamentTotals, resolveOrnamentLine } from '../lib/gold/ornaments';

const prisma = new PrismaClient();

// 15 customers (with real GPS coords) + 15 gold pledges with ornament line
// items — demo data to exercise the live map / geofence on mobile and the gold
// pledge + servicing flows. Idempotent-ish: guarded by a GOLDDEMO code prefix.
// Run AFTER the gated gold migrations are applied:  npx tsx prisma/seed_gold_demo.ts

// Spread around central Bengaluru so points are distinct on the map and some
// fall outside a tight geofence (for deviation-alert testing).
const CENTER = { lat: 12.9716, lng: 77.5946 };
const NAMES = [
  'Karthik Raj', 'Pradheep Raj', 'Santhosh Kumar', 'Pushparaj', 'Govindan',
  'Illayaraja', 'Saraniya', 'Perumal', 'Somashekar', 'Ramakrishnan',
  'Kumar P', 'Munusamy', 'Manikandan', 'Viji Perumal', 'Kasthoori',
];
const ORNAMENTS = ['CHAIN', 'RING', 'BRACELATES', 'NECKLES', 'STUD', 'THALI', 'MATTAL'];

function coord(i: number) {
  // grid offset ~0.004° (~450m) steps, 4 cols
  const row = Math.floor(i / 4);
  const col = i % 4;
  return {
    lat: CENTER.lat + (row - 1.5) * 0.004 + (i % 2) * 0.0011,
    lng: CENTER.lng + (col - 1.5) * 0.004 + (row % 2) * 0.0011,
  };
}

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) { console.error('No tenant found'); return; }
  const tenantId = tenant.id;
  const branch = await prisma.branch.findFirst({ where: { tenantId } });
  const agent = await prisma.user.findFirst({ where: { tenantId, role: 'agent' } })
    ?? await prisma.user.findFirst({ where: { tenantId } });
  const creator = await prisma.user.findFirst({ where: { tenantId } });
  if (!creator) { console.error('No user found'); return; }

  const principals = [75000, 25000, 63000, 55000, 15000, 2000, 40000, 11000, 100000, 142200, 37000, 48500, 9700, 36000, 80300];
  const purities = ['916 22K', '22K', '18K', '21K', '24K'];

  for (let i = 0; i < NAMES.length; i++) {
    const code = `GOLDDEMO${100 + i}`;
    const { lat, lng } = coord(i);
    const customer = await prisma.customer.upsert({
      where: { tenantId_customerCode: { tenantId, customerCode: code } },
      update: { lat, lng, geocodedAt: new Date() },
      create: {
        tenantId,
        branchId: branch?.id ?? null,
        agentId: agent?.id ?? null,
        appType: 'goldloan',
        customerCode: code,
        name: NAMES[i],
        phone: `90000${(10000 + i).toString()}`,
        address: `${i + 1}, MG Road area, Bengaluru`,
        lat, lng, geocodedAt: new Date(),
        status: 'active',
        kycStatus: 'verified',
      },
    });

    // Skip if this demo customer already has a pledge.
    const existing = await prisma.loan.findFirst({ where: { tenantId, customerId: customer.id, appType: 'goldloan' } });
    if (existing) continue;

    // 1–3 ornament line items.
    const n = (i % 3) + 1;
    const itemsInput = Array.from({ length: n }, (_, k) => {
      const gross = 3 + ((i + k) % 6);
      const wastage = Math.round((gross * 0.08) * 100) / 100;
      return {
        ornamentType: ORNAMENTS[(i + k) % ORNAMENTS.length],
        specification: purities[(i + k) % purities.length],
        purityKarat: '22K',
        quantity: 1,
        grossWeightGrams: gross,
        wastageGrams: wastage,
        ratePerGram: 7500,
      };
    });
    const totals = ornamentTotals(itemsInput);
    const principal = principals[i];

    await prisma.loan.create({
      data: {
        tenantId,
        branchId: branch?.id ?? null,
        appType: 'goldloan',
        loanCode: `A${(1000 + i).toString()}`,
        customerId: customer.id,
        loanType: 'gold',
        principal,
        deduction: 0,
        deductionType: 'upfront_fixed',
        disbursed: principal,
        frequency: 'monthly',
        tenure: 12,
        startDate: new Date(),
        perInstalment: principal,
        penaltyRate: 0,
        totalInstalments: 1,
        status: 'active',
        createdById: creator.id,
        goldCollateral: {
          create: {
            tenantId,
            branchId: branch?.id ?? null,
            customerId: customer.id,
            packetNo: `P-${100 + i}`,
            grossWeightGrams: totals.totalGrossWeight,
            netWeightGrams: totals.totalNetWeight,
            purityKarat: '22K',
            marketRatePerGram: 7500,
            assessedValue: totals.totalValue,
            eligibleLtvPercent: 75,
            storageLocation: 'SELF LOCKER',
            outstandingPrincipal: principal,
            interestPaidUpto: new Date(),
            items: {
              create: itemsInput.map((it, idx) => {
                const line = resolveOrnamentLine(it);
                return {
                  tenantId,
                  ornamentType: it.ornamentType,
                  specification: it.specification,
                  purityKarat: it.purityKarat,
                  quantity: line.quantity,
                  grossWeightGrams: line.grossWeightGrams,
                  wastageGrams: line.wastageGrams,
                  netWeightGrams: line.netWeightGrams,
                  ratePerGram: line.ratePerGram,
                  value: line.value,
                  bankName: 'SELF LOCKER',
                  sortOrder: idx,
                };
              }),
            },
          },
        },
      },
    });
  }
  console.log(`Seeded ${NAMES.length} gold-pledge customers with GPS coords + ornament items.`);
}

main()
  .catch((e) => { console.error('Gold demo seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
