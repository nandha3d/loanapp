import assert from 'node:assert/strict';
import {
  allocateArrearsFifo,
  buildChitPayoutAccountingLines,
  type OverdueCycleItem,
} from '@/lib/chits/payout';
import {
  buildDenominationBreakdown,
  validateDenominationBreakdown,
} from '@/lib/chits/denominations';
import { validateRunningChitMigration } from '@/lib/chits/migrateRunningChit';
import { normalizeIndianPhone } from '@/lib/chits/quickAddMembers';
import {
  buildChitMembersTemplateCsv,
  buildChitMembersTemplateXlsx,
  buildPublicChitTrackerWorkbookXlsx,
  buildRunningChitMigrationTemplateXlsx,
} from '@/lib/chits/excelTemplates';
import {
  ChitPlanLimitError,
  assertCanActivateAnotherChitGroup,
  assertCanExportStatutoryRegisters,
  resolveChitPlanQuotas,
} from '@/lib/chits/planEntitlements';
import {
  STATUTORY_DISCLAIMER,
  STATUTORY_REGISTER_TYPES,
  normalizeStateCode,
  resolveStatutoryTemplate,
} from '@/lib/chits/statutory/templates';

async function runTests() {
  // 1. Task 1 — Arrears FIFO Auto-Deduction + Split Payout Accounting Balance
  {
    const overdueCycles: OverdueCycleItem[] = [
      {
        subscriptionId: 'sub-2',
        periodNumber: 2,
        dueDate: new Date('2026-02-01'),
        dueAmount: 5000,
        paidAmount: 0,
        unpaidSubscriptionAmount: 5000,
        pendingPenaltyAmount: 250,
        penalties: [{ penaltyId: 'pen-2', remainingAmount: 250 }],
      },
      {
        subscriptionId: 'sub-3',
        periodNumber: 3,
        dueDate: new Date('2026-03-01'),
        dueAmount: 5000,
        paidAmount: 1000,
        unpaidSubscriptionAmount: 4000,
        pendingPenaltyAmount: 0,
        penalties: [],
      },
    ];

    const fullNet = allocateArrearsFifo({
      grossPrizeAmount: 95000,
      overdueCycles,
      deductArrears: true,
      waivePenalties: false,
    });
    assert.equal(fullNet.arrearsDeductedAmount, 9000);
    assert.equal(fullNet.penaltyDeductedAmount, 250);
    assert.equal(fullNet.netPayableAmount, 85750);
    assert.equal(fullNet.allocations.length, 2);
    assert.equal(fullNet.allocations[0].newStatus, 'paid');

    // Partial custom deduction respects FIFO order across earliest cycle first
    const partialNet = allocateArrearsFifo({
      grossPrizeAmount: 95000,
      overdueCycles,
      deductArrears: true,
      customArrearsAmount: 6000,
      waivePenalties: true,
    });
    assert.equal(partialNet.arrearsDeductedAmount, 6000);
    assert.equal(partialNet.penaltyDeductedAmount, 0);
    assert.equal(partialNet.waivedPenaltyAmount, 250);
    assert.equal(partialNet.allocations[0].subscriptionAllocated, 5000);
    assert.equal(partialNet.allocations[1].subscriptionAllocated, 1000);
    assert.equal(partialNet.allocations[1].newPaidAmount, 2000);
    assert.equal(partialNet.allocations[1].newStatus, 'partial');

    // Zero-net case where arrears exceed gross prize caps deduction at gross
    const cappedNet = allocateArrearsFifo({
      grossPrizeAmount: 6000,
      overdueCycles,
      deductArrears: true,
      waivePenalties: false,
    });
    assert.equal(cappedNet.netPayableAmount, 0);
    assert.equal(cappedNet.totalOffsetAmount, 6000);

    // Split 2-tranche payout balanced accounting check
    const lines = buildChitPayoutAccountingLines({
      grossPrizeAmount: 95000,
      arrearsDeductedAmount: 9000,
      penaltyDeductedAmount: 250,
      disbursedNowAmount: 40000,
      remainingPayableAfterTranche: 45750,
      paymentMode: 'upi',
    });
    const debits = lines.filter((l) => l.side === 'DEBIT').reduce((s, l) => s + l.amount, 0);
    const credits = lines.filter((l) => l.side === 'CREDIT').reduce((s, l) => s + l.amount, 0);
    assert.equal(debits, 95000);
    assert.equal(credits, 95000);
  }

  // 2. Task 2 — Mid-Cycle Running Chit Migration Pure Validation
  {
    const invalidCycle = validateRunningChitMigration({
      name: 'Invalid Series',
      chitValue: 100000,
      monthlyContrib: 5000,
      totalMembers: 10,
      currentActiveCycle: 12,
      startDate: '2026-01-01',
      members: [],
    });
    assert.equal(invalidCycle.valid, false);
    assert.ok(invalidCycle.errors.some((e) => e.toLowerCase().includes('cycle')));

    const validMidCycle = validateRunningChitMigration({
      name: 'Series K-12',
      chitValue: 100000,
      monthlyContrib: 5000,
      totalMembers: 4,
      totalCycles: 12,
      currentActiveCycle: 5,
      startDate: '2026-01-01',
      openingCashBalance: 25000,
      members: [
        {
          name: 'Karthik',
          phone: '+91 98422 11001',
          alreadyPrized: true,
          prizedCycleNumber: 1,
          historicalPrizeAmount: 92000,
          historicalPayoutPendingAmount: 10000,
          openingArrearsAmount: 0,
        },
        {
          name: 'Deepa',
          phone: '9842211002',
          alreadyPrized: false,
          openingArrearsAmount: 5000,
          openingAdvanceAmount: 0,
        },
        {
          name: 'Anitha',
          phone: '09842211003',
          alreadyPrized: false,
          openingArrearsAmount: 0,
          openingAdvanceAmount: 2500,
        },
      ],
    });
    assert.equal(validMidCycle.valid, true);
    assert.equal(validMidCycle.historicalCyclesCount, 4);
    assert.equal(validMidCycle.futureCyclesCount, 8);
    assert.equal(validMidCycle.prizedCount, 1);
    assert.equal(validMidCycle.totalOpeningArrears, 5000);
    assert.equal(validMidCycle.totalOpeningAdvances, 2500);
    assert.equal(validMidCycle.totalHistoricalPayoutPending, 10000);
  }

  // 3. Task 3 — INR Cash Denomination Validator
  {
    const built = buildDenominationBreakdown({ 500: 8, 200: 4, 100: 2 });
    assert.equal(built.computedTotal, 5000);
    assert.equal(built.currency, 'INR');

    const okRequired = validateDenominationBreakdown(
      { counts: { 500: 10 }, computedTotal: 999999 }, // spoofed total ignored
      5000,
      'REQUIRED',
    );
    assert.equal(okRequired.recomputedTotal, 5000);

    assert.throws(() => validateDenominationBreakdown(null, 5000, 'REQUIRED'));
    assert.throws(() => validateDenominationBreakdown({ 500: 9 }, 5000, 'REQUIRED'));
    const skipped = validateDenominationBreakdown({ 500: 1 }, 5000, 'DISABLED');
    assert.equal(skipped.breakdown, null);
  }

  // 4. Task 4 — Phone Normalization & 3 Downloadable Excel/CSV Templates
  {
    assert.equal(normalizeIndianPhone('+91 98422-11001'), '9842211001');
    assert.equal(normalizeIndianPhone('09842211001'), '9842211001');
    assert.equal(normalizeIndianPhone('9842211001'), '9842211001');
    assert.equal(normalizeIndianPhone('12345'), null);

    const csv = buildChitMembersTemplateCsv();
    assert.ok(csv.includes('Full Name,Phone'));

    const membersXlsx = await buildChitMembersTemplateXlsx();
    const migXlsx = await buildRunningChitMigrationTemplateXlsx();
    const leadTrackerXlsx = await buildPublicChitTrackerWorkbookXlsx();
    assert.ok(membersXlsx.byteLength > 2000);
    assert.ok(migXlsx.byteLength > 2000);
    assert.ok(leadTrackerXlsx.byteLength > 3000);
  }

  // 5. Task 5 — Free Tier ("1 Running Chit, Unlimited Members") + Entitlement Gate
  {
    const freeQuotas = resolveChitPlanQuotas({ plan: 'free', monthlyPrice: 0 });
    assert.equal(freeQuotas.maxActiveChitGroups, 1);
    assert.equal(freeQuotas.maxMembersPerChit, null);
    assert.equal(freeQuotas.canExportStatutoryRegisters, false);

    const makeMockDb = (activeCount: number, plan = 'free') => ({
      tenantSubscription: {
        findUnique: async () => ({
          plan,
          basePlanPrice: plan === 'free' ? 0 : 999,
          maxActiveChitGroups: plan === 'free' ? 1 : null,
          maxMembersPerChit: null,
          statutoryRegistersEnabled: plan === 'enterprise',
          grandfatheredFeatures: null,
        }),
      },
      appSetting: { findFirst: async () => null },
      chitGroup: {
        count: async () => activeCount,
      },
    });

    await assertCanActivateAnotherChitGroup(makeMockDb(0, 'free'), 't-1');
    await assert.rejects(
      () => assertCanActivateAnotherChitGroup(makeMockDb(1, 'free'), 't-1'),
      (err: unknown) =>
        err instanceof ChitPlanLimitError &&
        err.statusCode === 402 &&
        err.code === 'CHIT_PLAN_LIMIT_REACHED',
    );
    await assertCanActivateAnotherChitGroup(makeMockDb(10, 'pro'), 't-2');
    await assert.rejects(() => assertCanExportStatutoryRegisters(makeMockDb(0, 'pro'), 't-2'));
    await assertCanExportStatutoryRegisters(makeMockDb(0, 'enterprise'), 't-3');

    // Lifetime / enterprise plans with 0 monthly/base price must never fall back to free tier limits
    const lifetimeQuotas = resolveChitPlanQuotas({ plan: 'lifetime', monthlyPrice: 0 });
    assert.equal(lifetimeQuotas.maxActiveChitGroups, null);
    assert.equal(lifetimeQuotas.maxMembersPerChit, null);
    assert.equal(lifetimeQuotas.canExportStatutoryRegisters, true);
    await assertCanActivateAnotherChitGroup(
      {
        tenantSubscription: {
          findUnique: async () => ({
            plan: 'lifetime',
            basePlanPrice: 0,
            maxActiveChitGroups: null,
            maxMembersPerChit: null,
            statutoryRegistersEnabled: false,
            grandfatheredFeatures: null,
          }),
        },
        appSetting: { findFirst: async () => null },
        chitGroup: { count: async () => 5 },
      },
      't-4',
    );
  }

  // 6. Task 7 — Statutory Register State Templates (TN, DL, GENERIC)
  {
    assert.equal(normalizeStateCode('Tamil Nadu'), 'TN');
    assert.equal(normalizeStateCode('dl'), 'DL');
    assert.equal(normalizeStateCode('KA'), 'GENERIC');
    assert.ok(STATUTORY_DISCLAIMER.length > 20);

    for (const st of ['TN', 'DL', 'GENERIC'] as const) {
      for (const reg of STATUTORY_REGISTER_TYPES) {
        const meta = resolveStatutoryTemplate(st, reg);
        assert.equal(meta.stateCode, st);
        assert.ok(meta.formCode.length > 0);
        assert.ok(meta.title.length > 0);
        assert.ok(meta.signatureBlocks.length >= 1);
      }
    }
  }

  console.log('✓ All chitParityP0P2 tests passed!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
