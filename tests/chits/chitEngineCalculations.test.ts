import assert from 'node:assert/strict';
import {
  CHIT_ENGINE_CATALOG,
  CHIT_ENGINE_TYPES,
  isBiddingEnabledForPeriod,
  parseChitEngineConfig,
} from '../../lib/chits/engineTypes';
import {
  calculateAscaMaturityDistribution,
  calculateBasePlusPremiumCycle,
  calculateChitPeriodEngine,
  calculateForemanCompensation,
  calculateGoldValueMaturity,
  calculateGoldWeightCredit,
  calculateMultiDivisionCycle,
  calculateReserveFloor,
  computeSubscriptionBalances,
  summarizeGoldWeightMember,
} from '../../lib/chits/engineCalculator';
import {
  assertValidPrizeAmount,
  effectiveMinDiscountPct,
  validateChitEngineConfig,
} from '../../lib/chits/validation';
import { assertCanReleasePrizePayout } from '../../lib/chits/security';

function makeMembers(count: number, shareEach = 1) {
  return Array.from({ length: count }, (_, idx) => ({
    memberId: `m-${idx + 1}`,
    memberName: `Member ${idx + 1}`,
    ticketNo: String(idx + 1).padStart(2, '0'),
    ticketShare: shareEach,
    hasWonBeforePeriod: false,
    isActive: true,
    isLateThisPeriod: false,
  }));
}

// 1. All 18 engines exist in catalog and execute cleanly through calculateChitPeriodEngine
assert.equal(CHIT_ENGINE_TYPES.length, 18);
for (const code of CHIT_ENGINE_TYPES) {
  const item = CHIT_ENGINE_CATALOG[code];
  assert.ok(item, `Missing catalog item for ${code}`);
  assert.equal(item.code, code);
  const cfg = parseChitEngineConfig(null, code);
  const members = makeMembers(5);
  const res = calculateChitPeriodEngine({
    engineType: code,
    config: cfg,
    chitValue: 50_000,
    monthlyContrib: 10_000,
    totalMembers: 5,
    periodNumber: 1,
    commissionPct: cfg.foremanCompensation.commissionPct,
    commissionBasis: 'BID_DISCOUNT',
    gstPct: 18,
    dividendPolicy: 'ALL_MEMBERS',
    dividendDistribution: 'ADJUST_NEXT_DUE',
    winnerMemberIds: ['m-1'],
    prizeAmount: code === 'AUCTION_STANDARD' || code === 'AUCTION_RESERVE_PRICE' || code === 'AUCTION_UNCAPPED_ENTERPRISE'
      ? 40_000
      : undefined,
    multiDivisionWinners:
      code === 'AUCTION_MULTI_DIVISION'
        ? [
            { memberId: 'm-1', winType: 'lottery', prizeAmount: 47_500, bidDiscount: 2_500 },
            { memberId: 'm-2', winType: 'auction', prizeAmount: 38_000, bidDiscount: 12_000 },
          ]
        : undefined,
    goldRatePerGram: code === 'GOLD_WEIGHT_ACCUMULATION' || code === 'GOLD_VALUE_ACCUMULATION' ? 7500 : undefined,
    members,
  });

  assert.equal(res.engineType, code);
  assert.equal(Number.isFinite(res.prizeAmount), true, `${code} prizeAmount NaN`);
  assert.equal(Number.isFinite(res.dividendPerTicket), true, `${code} dividendPerTicket NaN`);
  assert.ok(res.prizeAmount > 0, `${code} prizeAmount must be positive`);
  assert.ok(res.dividendPerTicket >= 0, `${code} dividendPerTicket cannot be negative`);
  assert.equal(res.memberBreakdowns.length, 5);
}

// 2. All 6 foreman compensation modes
{
  const pctDiscount = calculateForemanCompensation({
    chitValue: 100_000,
    bidDiscount: 20_000,
    periodNumber: 2,
    mode: 'PERCENTAGE_COMMISSION',
    commissionBasis: 'BID_DISCOUNT',
    commissionPct: 5,
    gstPct: 18,
  });
  assert.equal(pctDiscount.commission, 1000);
  assert.equal(pctDiscount.gstAmount, 180);

  const pctPot = calculateForemanCompensation({
    chitValue: 100_000,
    bidDiscount: 20_000,
    periodNumber: 2,
    mode: 'PERCENTAGE_COMMISSION',
    commissionBasis: 'CHIT_VALUE',
    commissionPct: 5,
    gstPct: 18,
  });
  assert.equal(pctPot.commission, 5000);
  assert.equal(pctPot.gstAmount, 900);

  const free1Cycle1 = calculateForemanCompensation({
    chitValue: 100_000,
    bidDiscount: 0,
    periodNumber: 1,
    mode: 'FREE_TICKET_CYCLE_1',
    commissionBasis: 'CHIT_VALUE',
    commissionPct: 5,
  });
  assert.equal(free1Cycle1.commission, 0);
  assert.equal(free1Cycle1.isReservedForemanCycle, true);

  const free2Cycle2 = calculateForemanCompensation({
    chitValue: 100_000,
    bidDiscount: 10_000,
    periodNumber: 2,
    mode: 'FREE_TICKET_CYCLE_2',
    commissionBasis: 'CHIT_VALUE',
    commissionPct: 5,
  });
  assert.equal(free2Cycle2.commission, 0);
  assert.equal(free2Cycle2.isReservedForemanCycle, true);

  const flat = calculateForemanCompensation({
    chitValue: 100_000,
    bidDiscount: 10_000,
    periodNumber: 3,
    mode: 'FLAT_FEE',
    commissionBasis: 'CHIT_VALUE',
    commissionPct: 0,
    flatFeeAmount: 750,
    gstPct: 0,
  });
  assert.equal(flat.commission, 750);

  const hybridReserved = calculateForemanCompensation({
    chitValue: 100_000,
    bidDiscount: 10_000,
    periodNumber: 1,
    mode: 'HYBRID',
    commissionBasis: 'CHIT_VALUE',
    commissionPct: 3,
    reservedForemanCycles: [1],
  });
  assert.equal(hybridReserved.commission, 0);
  assert.equal(hybridReserved.isReservedForemanCycle, true);

  const hybridAuction = calculateForemanCompensation({
    chitValue: 100_000,
    bidDiscount: 10_000,
    periodNumber: 3,
    mode: 'HYBRID',
    commissionBasis: 'CHIT_VALUE',
    commissionPct: 3,
    reservedForemanCycles: [1],
  });
  assert.equal(hybridAuction.commission, 3000);

  const zero = calculateForemanCompensation({
    chitValue: 100_000,
    bidDiscount: 15_000,
    periodNumber: 3,
    mode: 'ZERO_COMMISSION',
    commissionBasis: 'CHIT_VALUE',
    commissionPct: 5,
  });
  assert.equal(zero.commission, 0);
}

// 3. AUCTION_RESERVE_PRICE declining floor R_t = (x% * V) * (N - t + 1)
{
  const t1 = calculateReserveFloor({
    chitValue: 100_000,
    totalPeriods: 10,
    periodNumber: 1,
    reservePriceStepPct: 1.5,
    maxDiscountPct: 40,
  });
  assert.equal(t1.remainingCycles, 10);
  assert.equal(t1.reserveFloorAmount, 15_000);
  assert.equal(t1.reserveFloorPct, 15);

  const t10 = calculateReserveFloor({
    chitValue: 100_000,
    totalPeriods: 10,
    periodNumber: 10,
    reservePriceStepPct: 1.5,
    maxDiscountPct: 40,
  });
  assert.equal(t10.remainingCycles, 1);
  assert.equal(t10.reserveFloorAmount, 1_500);
  assert.equal(t10.reserveFloorPct, 1.5);

  const effMin = effectiveMinDiscountPct({
    minDiscountPct: 5,
    reserveFloorPct: t1.reserveFloorPct,
  });
  assert.equal(effMin, 15);

  assert.throws(() =>
    assertValidPrizeAmount({
      chitValue: 100_000,
      prizeAmount: 90_000, // 10% < 15% reserve floor
      minDiscountPct: 5,
      reserveFloorPct: 15,
      maxDiscountPct: 40,
    }),
  );
  assert.doesNotThrow(() =>
    assertValidPrizeAmount({
      chitValue: 100_000,
      prizeAmount: 85_000, // exactly 15%
      minDiscountPct: 5,
      reserveFloorPct: 15,
      maxDiscountPct: 40,
    }),
  );
}

// 4. AUCTION_MULTI_DIVISION pooled discount sharing (KSFE style)
{
  const md = calculateMultiDivisionCycle({
    chitValue: 100_000,
    commissionPerTicket: 5_000,
    gstPct: 18,
    lotteryWinnersCount: 1,
    auctionDiscounts: [20_000, 15_000, 10_000],
    eligibleTicketUnits: 20,
    dividendRounding: 0,
  });
  assert.equal(md.lotteryPayoutPerWinner, 95_000);
  // net pool = (20k-5k) + (15k-5k) + (10k-5k) = 15k + 10k + 5k = 30k
  assert.equal(md.distributableDividend, 30_000);
  assert.equal(md.dividendPerTicket, 1_500);
  assert.equal(md.totalCommission, 20_000); // 4 winners * 5k
  assert.equal(md.gstAmount, 3_600);
  assert.equal(md.roundingIncome, 0);
}

// 5. AUCTION_UNCAPPED_ENTERPRISE >40% discount allowed iff uncapped === true
{
  assert.throws(() =>
    assertValidPrizeAmount({
      chitValue: 1_000_000,
      prizeAmount: 450_000, // 55% discount
      maxDiscountPct: 40,
      uncapped: false,
    }),
  );
  assert.doesNotThrow(() =>
    assertValidPrizeAmount({
      chitValue: 1_000_000,
      prizeAmount: 450_000, // 55% discount
      maxDiscountPct: 40,
      uncapped: true,
    }),
  );
}

// 6. BASE_PLUS_PREMIUM exact pool math B*N + P*k = W
{
  const bp = calculateBasePlusPremiumCycle({
    baseInstalment: 5_000,
    prizedPremiumAmount: 1_000,
    totalTicketUnits: 10,
    alreadyPrizedTicketUnits: 3,
    payoutAmount: 50_000,
    commission: 0,
  });
  assert.equal(bp.nonPrizedInstalment, 5_000);
  assert.equal(bp.prizedInstalment, 6_000);
  assert.equal(bp.collectedPool, 53_000);
  assert.equal(bp.poolSurplus, 3_000);

  const cfg = parseChitEngineConfig(
    { differentialInstalment: { enabled: true, baseInstalment: 5_000, prizedPremiumAmount: 1_000 } },
    'BASE_PLUS_PREMIUM',
  );
  const members = makeMembers(4);
  members[0].hasWonBeforePeriod = true; // already prized before cycle 2
  const periodRes = calculateChitPeriodEngine({
    engineType: 'BASE_PLUS_PREMIUM',
    config: cfg,
    chitValue: 20_000,
    monthlyContrib: 5_000,
    totalMembers: 4,
    periodNumber: 2,
    commissionPct: 5,
    winnerMemberIds: ['m-2'],
    prizeAmount: 19_000,
    members,
  });
  const m1Row = periodRes.memberBreakdowns.find((r) => r.memberId === 'm-1')!;
  const m2Row = periodRes.memberBreakdowns.find((r) => r.memberId === 'm-2')!;
  const m3Row = periodRes.memberBreakdowns.find((r) => r.memberId === 'm-3')!;
  assert.equal(m1Row.premiumAdded, 1_000);
  assert.equal(m2Row.premiumAdded, 1_000); // won this period -> prized for period 3
  assert.equal(m3Row.premiumAdded, 0);
  assert.equal(m2Row.netPayableNextPeriod, 6_000);
  assert.equal(m3Row.netPayableNextPeriod, 5_000);
}

// 7. FIXED_CHART_ESCALATING, FIXED_DIVIDEND, FIXED_PAYOUT_VARIABLE_PAY, HYBRID_SPLIT_PHASE, CUSTOM_MANUAL_SCHEDULE
{
  const escCfg = parseChitEngineConfig(
    { escalatingPayouts: [{ period: 1, payoutAmount: 42_000 }, { period: 2, payoutAmount: 48_000 }] },
    'FIXED_CHART_ESCALATING',
  );
  const escRes = calculateChitPeriodEngine({
    engineType: 'FIXED_CHART_ESCALATING',
    config: escCfg,
    chitValue: 50_000,
    monthlyContrib: 5_000,
    totalMembers: 10,
    periodNumber: 2,
    commissionPct: 0,
    winnerMemberIds: ['m-1'],
    members: makeMembers(10),
  });
  assert.equal(escRes.prizeAmount, 48_000);

  const fdCfg = parseChitEngineConfig(
    { fixedDividends: [{ period: 1, dividendPerTicket: 1_200 }] },
    'FIXED_DIVIDEND',
  );
  const fdRes = calculateChitPeriodEngine({
    engineType: 'FIXED_DIVIDEND',
    config: fdCfg,
    chitValue: 50_000,
    monthlyContrib: 5_000,
    totalMembers: 10,
    periodNumber: 1,
    commissionPct: 5,
    dividendPolicy: 'ALL_MEMBERS',
    dividendDistribution: 'ADJUST_NEXT_DUE',
    winnerMemberIds: ['m-1'],
    members: makeMembers(10),
  });
  assert.equal(fdRes.dividendPerTicket, 1_200);
  assert.equal(fdRes.memberBreakdowns[0].netPayableNextPeriod, 3_800);

  const vpCfg = parseChitEngineConfig(
    { variableInstalments: [{ period: 2, nonPrizedDue: 4_500, prizedDue: 6_200 }] },
    'FIXED_PAYOUT_VARIABLE_PAY',
  );
  const vpMembers = makeMembers(5);
  vpMembers[0].hasWonBeforePeriod = true;
  const vpRes = calculateChitPeriodEngine({
    engineType: 'FIXED_PAYOUT_VARIABLE_PAY',
    config: vpCfg,
    chitValue: 50_000,
    monthlyContrib: 5_000,
    totalMembers: 5,
    periodNumber: 1,
    commissionPct: 0,
    winnerMemberIds: ['m-2'],
    members: vpMembers,
  });
  assert.equal(vpRes.memberBreakdowns[0].baseInstalment, 6_200);
  assert.equal(vpRes.memberBreakdowns[1].baseInstalment, 6_200);
  assert.equal(vpRes.memberBreakdowns[2].baseInstalment, 4_500);

  const hyCfg = parseChitEngineConfig(
    {
      biddingMode: 'OPEN_MANUAL',
      foremanCompensation: { mode: 'HYBRID', commissionPct: 3, flatFeeAmount: 0, reservedForemanCycles: [1] },
      hybridSplitPhase: { reservedCyclesCount: 2, reservedDiscountPct: 5 },
    },
    'HYBRID_SPLIT_PHASE',
  );
  assert.equal(
    isBiddingEnabledForPeriod({ chitEngineType: 'HYBRID_SPLIT_PHASE', engineConfig: JSON.stringify(hyCfg) }, 1),
    false,
  );
  assert.equal(
    isBiddingEnabledForPeriod({ chitEngineType: 'HYBRID_SPLIT_PHASE', engineConfig: JSON.stringify(hyCfg) }, 2),
    false,
  );
  assert.equal(
    isBiddingEnabledForPeriod({ chitEngineType: 'HYBRID_SPLIT_PHASE', engineConfig: JSON.stringify(hyCfg) }, 3),
    true,
  );

  const custCfg = parseChitEngineConfig(
    {
      customSchedule: [
        { period: 1, instalmentNonPrized: 4_000, instalmentPrized: 5_000, payoutAmount: 45_000, commission: 1_000, dividendPerTicket: 800 },
        { period: 2, instalmentNonPrized: 4_200, instalmentPrized: 5_300, payoutAmount: 47_000, commission: 1_000, dividendPerTicket: 500 },
      ],
    },
    'CUSTOM_MANUAL_SCHEDULE',
  );
  const custRes = calculateChitPeriodEngine({
    engineType: 'CUSTOM_MANUAL_SCHEDULE',
    config: custCfg,
    chitValue: 50_000,
    monthlyContrib: 5_000,
    totalMembers: 5,
    periodNumber: 1,
    commissionPct: 0,
    winnerMemberIds: ['m-1'],
    members: makeMembers(5),
  });
  assert.equal(custRes.prizeAmount, 45_000);
  assert.equal(custRes.commission, 1_000);
  assert.equal(custRes.dividendPerTicket, 800);
  assert.equal(custRes.memberBreakdowns[0].baseInstalment, 5_300); // winner m-1 pays prized next period
  assert.equal(custRes.memberBreakdowns[1].baseInstalment, 4_200); // non-winner m-2 pays nonPrized
}

// 8. Gold Weight, Gold Value & ASCA Revolving Pool math
{
  const g1 = calculateGoldWeightCredit({ paymentAmount: 7_500, goldRatePerGram: 7_500 });
  const g2 = calculateGoldWeightCredit({ paymentAmount: 7_500, goldRatePerGram: 8_000 });
  assert.equal(g1, 1);
  assert.equal(g2, 0.9375);
  const sumGold = summarizeGoldWeightMember([
    { paidAmount: 7_500, gramsCredited: g1 },
    { paidAmount: 7_500, gramsCredited: g2 },
  ]);
  assert.equal(sumGold.totalPaid, 15_000);
  assert.equal(sumGold.totalGrams, 1.9375);
  assert.equal(sumGold.weightedAvgRate, 7741.94);

  const gv = calculateGoldValueMaturity({
    totalInstalmentsPaid: 55_000,
    monthlyContrib: 5_000,
    bonusMonths: 1,
    goldRatePerGram: 7_500,
  });
  assert.equal(gv.bonusAmount, 5_000);
  assert.equal(gv.totalRedemptionValue, 60_000);
  assert.equal(gv.indicativeGrams, 8);

  const asca = calculateAscaMaturityDistribution({
    members: [
      { memberId: 'a', ticketShare: 1, totalContributed: 12_000 },
      { memberId: 'b', ticketShare: 1, totalContributed: 12_000 },
      { memberId: 'c', ticketShare: 0.5, totalContributed: 6_000 },
    ],
    totalInterestEarned: 3_000,
    totalAdminExpenses: 500,
  });
  assert.equal(asca.netProfit, 2_500);
  assert.equal(asca.memberShares[0].profitDividendShare, 1_000);
  assert.equal(asca.memberShares[1].totalPayout, 13_000);
  assert.equal(asca.memberShares[2].profitDividendShare, 500);
}

// 9. Late-payer forfeiture, DEFERRED_BONUS_POOL, NON_PRIZED_ONLY
{
  const cfgForfeit = parseChitEngineConfig(
    {
      dividendDistributionMode: 'NON_PRIZED_ONLY',
      defaultRules: { forfeitDividendOnLate: true, lateFeeType: 'NONE', lateFeeValue: 0, substitutionCutoffPct: 70 },
    },
    'AUCTION_STANDARD',
  );
  const members = makeMembers(5);
  members[0].hasWonBeforePeriod = true; // m-1 previously prized -> excluded
  members[2].isLateThisPeriod = true; // m-3 late -> forfeited
  const res = calculateChitPeriodEngine({
    engineType: 'AUCTION_STANDARD',
    config: cfgForfeit,
    chitValue: 50_000,
    monthlyContrib: 10_000,
    totalMembers: 5,
    periodNumber: 2,
    commissionPct: 5,
    commissionBasis: 'BID_DISCOUNT',
    dividendPolicy: 'NON_PRIZED_ONLY',
    dividendDistribution: 'ADJUST_NEXT_DUE',
    winnerMemberIds: ['m-2'], // m-2 wins now -> excluded
    prizeAmount: 40_000,
    members,
  });
  // Eligible: m-3, m-4, m-5 (3 tickets); bidDiscount=10k, comm=500 -> distributable=9500 -> per ticket = 3166.67 (rounded 0 -> 3166.67)
  assert.equal(res.dividendEligibleTickets, 3);
  assert.equal(res.memberBreakdowns[0].dividendEarned, 0);
  assert.equal(res.memberBreakdowns[1].dividendEarned, 0);
  assert.equal(res.memberBreakdowns[2].roleThisPeriod, 'forfeited_late');
  assert.equal(res.memberBreakdowns[2].dividendEarned, 0);
  assert.ok(res.memberBreakdowns[2].forfeitedDividend > 3000);
  assert.equal(res.memberBreakdowns[3].dividendEarned, res.dividendPerTicket);

  const defCfg = parseChitEngineConfig(
    { dividendDistributionMode: 'DEFERRED_BONUS_POOL' },
    'AUCTION_STANDARD',
  );
  const defRes = calculateChitPeriodEngine({
    engineType: 'AUCTION_STANDARD',
    config: defCfg,
    chitValue: 50_000,
    monthlyContrib: 10_000,
    totalMembers: 5,
    periodNumber: 1,
    commissionPct: 5,
    commissionBasis: 'BID_DISCOUNT',
    winnerMemberIds: ['m-1'],
    prizeAmount: 40_000,
    members: makeMembers(5),
  });
  assert.equal(defRes.dividendDistribution, 'DEFERRED_BONUS_POOL');
  assert.ok(defRes.memberBreakdowns[1].deferredDividend > 0);
  assert.equal(defRes.memberBreakdowns[1].nextDueDividendCredit, 0);
}

// 10. computeSubscriptionBalances does NOT double-subtract ADJUST_NEXT_DUE dividend
{
  const adj = computeSubscriptionBalances(
    {
      dueAmount: 8_500, // already net of 1,500 dividend (base 10,000)
      baseDueAmount: 10_000,
      dividendAmount: 1_500,
      premiumAmount: 0,
      interestAmount: 0,
      penaltyAmount: 200,
      paidAmount: 2_000,
    },
    'ADJUST_NEXT_DUE',
  );
  assert.equal(adj.baseDueAmount, 10_000);
  assert.equal(adj.netDue, 8_700);
  assert.equal(adj.outstanding, 6_700);

  const legacyInfer = computeSubscriptionBalances(
    {
      dueAmount: 9_000, // net when baseDueAmount missing + ADJUST_NEXT_DUE
      dividendAmount: 1_000,
      penaltyAmount: 0,
      paidAmount: 0,
    },
    'ADJUST_NEXT_DUE',
  );
  assert.equal(legacyInfer.baseDueAmount, 10_000);
  assert.equal(legacyInfer.netDue, 9_000);

  const cashPayout = computeSubscriptionBalances(
    {
      dueAmount: 11_000,
      baseDueAmount: 10_000,
      dividendAmount: 1_500,
      premiumAmount: 1_000,
      interestAmount: 0,
      penaltyAmount: 0,
      paidAmount: 0,
    },
    'CASH_PAYOUT',
  );
  assert.equal(cashPayout.netDue, 11_000);
  assert.equal(cashPayout.outstanding, 11_000);
}

// 11. Jameen internal guarantor lock in assertCanReleasePrizePayout
{
  assert.throws(
    () =>
      assertCanReleasePrizePayout({
        auctionStatus: 'confirmed',
        payoutStatus: 'ready',
        securityStatus: 'approved',
        winnerMemberId: 'm-1',
        prizeAmount: 90_000,
        activeGuaranteeLock: {
          guaranteedMemberName: 'Ramesh',
          guaranteedTicketNo: '04',
          unpaidPeriods: 2,
        },
      }),
    /Jameen guarantor hold/i,
  );
  assert.doesNotThrow(() =>
    assertCanReleasePrizePayout({
      auctionStatus: 'confirmed',
      payoutStatus: 'ready',
      securityStatus: 'approved',
      winnerMemberId: 'm-1',
      prizeAmount: 90_000,
      activeGuaranteeLock: {
        guaranteedMemberName: 'Ramesh',
        guaranteedTicketNo: '04',
        unpaidPeriods: 0,
      },
    }),
  );
}

// 12. validateChitEngineConfig rejects invalid config combinations
{
  const badMinMax = parseChitEngineConfig(
    { discountRules: { minDiscountPct: 35, maxDiscountPct: 20, uncapped: false } },
    'AUCTION_STANDARD',
  );
  assert.throws(() => validateChitEngineConfig('AUCTION_STANDARD', badMinMax));

  const badReserve = parseChitEngineConfig(
    { discountRules: { reservePriceStepPct: 0 } },
    'AUCTION_RESERVE_PRICE',
  );
  assert.throws(() => validateChitEngineConfig('AUCTION_RESERVE_PRICE', badReserve));

  const badMulti = parseChitEngineConfig(
    { multiDivision: { enabled: true, lotteryWinnersPerCycle: 3, auctionWinnersPerCycle: 3 } },
    'AUCTION_MULTI_DIVISION',
  );
  assert.throws(() => validateChitEngineConfig('AUCTION_MULTI_DIVISION', badMulti, { totalMembers: 5 }));

  const badHybrid = parseChitEngineConfig(
    { hybridSplitPhase: { reservedCyclesCount: 5, reservedDiscountPct: 0 } },
    'HYBRID_SPLIT_PHASE',
  );
  assert.throws(() => validateChitEngineConfig('HYBRID_SPLIT_PHASE', badHybrid, { totalMembers: 5 }));

  const badCustom = parseChitEngineConfig({ customSchedule: [] }, 'CUSTOM_MANUAL_SCHEDULE');
  assert.throws(() => validateChitEngineConfig('CUSTOM_MANUAL_SCHEDULE', badCustom, { requireScheduleRows: true }));
}

console.log('chitEngineCalculations tests passed');
