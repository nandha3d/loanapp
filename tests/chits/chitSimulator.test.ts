import assert from 'node:assert/strict';
import { CHIT_ENGINE_TYPES } from '../../lib/chits/engineTypes';
import { PRACTICAL_CHIT_TEMPLATES } from '../../lib/chits/templates';
import {
  buildDefaultSimulationInput,
  simulateChitLifecycle,
} from '../../lib/chits/simulator';

// 1. All 18 templates simulate cleanly with valid finite values and clamped chart bounds
assert.equal(PRACTICAL_CHIT_TEMPLATES.length, 18);
for (const tmpl of PRACTICAL_CHIT_TEMPLATES) {
  const input = buildDefaultSimulationInput(tmpl);
  const res = simulateChitLifecycle(input);

  assert.equal(res.cycles.length, input.totalMembers, `${tmpl.code} cycle count mismatch`);
  assert.equal(res.memberJourneys.length, 3, `${tmpl.code} must have 3 member journeys`);
  assert.equal(res.consolidated.totalCycles, input.totalMembers);
  assert.equal(Number.isFinite(res.consolidated.totalNetCollections), true);
  assert.equal(Number.isFinite(res.consolidated.totalPrizePayouts), true);
  assert.equal(Number.isFinite(res.consolidated.totalForemanEarnings), true);

  for (const c of res.cycles) {
    assert.ok(c.potSplitPct.payoutPct >= 0 && c.potSplitPct.payoutPct <= 100);
    assert.ok(c.potSplitPct.dividendPct >= 0 && c.potSplitPct.dividendPct <= 100);
    assert.ok(c.potSplitPct.commissionPct >= 0 && c.potSplitPct.commissionPct <= 100);
    assert.ok(c.payoutBarPct >= 0 && c.payoutBarPct <= 100);
    assert.ok(c.netDueBarPct >= 0 && c.netDueBarPct <= 100);
  }
  for (const j of res.memberJourneys) {
    assert.ok(j.paidBarPct >= 0 && j.paidBarPct <= 100);
    assert.ok(j.receivedBarPct >= 0 && j.receivedBarPct <= 100);
  }
}

// Verify all 18 canonical engine types are covered
const simulatedEngines = new Set(PRACTICAL_CHIT_TEMPLATES.map((t) => t.engineType));
for (const eng of CHIT_ENGINE_TYPES) {
  assert.ok(simulatedEngines.has(eng), `Missing template for engine ${eng}`);
}

// 2. AUCTION_STANDARD: exact bid override, commission basis switch (CHIT_VALUE vs BID_DISCOUNT) & zero-leakage balance
{
  const tmpl = PRACTICAL_CHIT_TEMPLATES.find((t) => t.engineType === 'AUCTION_STANDARD')!;
  const baseInput = buildDefaultSimulationInput(tmpl);
  baseInput.cycleOverrides = { 1: { bidDiscount: 25_000 } };

  const chitBasisRes = simulateChitLifecycle({ ...baseInput, commissionBasis: 'CHIT_VALUE' });
  const c1 = chitBasisRes.cycles[0]!;
  assert.equal(c1.prizeAmount, 75_000);
  assert.equal(c1.bidDiscount, 25_000);
  assert.equal(c1.commission, 5_000); // 5% of ₹1,00,000
  assert.equal(c1.distributableDividend, 20_000);
  assert.equal(c1.dividendPerTicket, 2_000); // ₹20,000 / 10
  assert.equal(c1.nextCycleNetDueNonPrized, 8_000); // ₹10,000 - ₹2,000
  assert.equal(chitBasisRes.consolidated.balanceCheck.isBalanced, true);

  const bidBasisRes = simulateChitLifecycle({ ...baseInput, commissionBasis: 'BID_DISCOUNT' });
  const c1Bid = bidBasisRes.cycles[0]!;
  assert.equal(c1Bid.commission, 1_250); // 5% of ₹25,000 bid discount
  assert.equal(c1Bid.distributableDividend, 23_750);
  assert.equal(c1Bid.dividendPerTicket, 2_375);
  assert.equal(c1Bid.nextCycleNetDueNonPrized, 7_625);
  assert.equal(bidBasisRes.consolidated.balanceCheck.isBalanced, true);
}

// 3. AUCTION_RESERVE_PRICE: declining floor R_1=15,000, R_10=1,500 and below_floor warning
{
  const tmpl = PRACTICAL_CHIT_TEMPLATES.find((t) => t.engineType === 'AUCTION_RESERVE_PRICE')!;
  const input = buildDefaultSimulationInput(tmpl);
  const defRes = simulateChitLifecycle(input);
  assert.equal(defRes.cycles[0]!.reserveFloorAmount, 15_000);
  assert.equal(defRes.cycles[9]!.reserveFloorAmount, 1_500);
  assert.equal(defRes.consolidated.balanceCheck.isBalanced, true);

  const lowBidRes = simulateChitLifecycle({ ...input, cycleOverrides: { 1: { bidDiscount: 10_000 } } });
  assert.equal(lowBidRes.cycles[0]!.warning?.code, 'below_floor');
  assert.equal(lowBidRes.cycles[0]!.warning?.floorAmount, 15_000);
}

// 4. AUCTION_MULTI_DIVISION: KSFE pooled auction discounts shared across 40 syndicate tickets
{
  const tmpl = PRACTICAL_CHIT_TEMPLATES.find((t) => t.engineType === 'AUCTION_MULTI_DIVISION')!;
  const input = buildDefaultSimulationInput(tmpl);
  input.cycleOverrides = { 1: { bidDiscount: 40_000 } };
  const res = simulateChitLifecycle(input);
  const c1 = res.cycles[0]!;
  assert.equal(res.rules.syndicateTicketCount, 40);
  assert.equal(c1.grossPool, 800_000); // 40 * ₹20,000
  assert.equal(c1.lotteryPrizeAmount, 190_000); // ₹2,00,000 - ₹10,000 (5% of 2L)
  assert.equal(c1.commission, 40_000); // 4 * ₹10,000
  // 3 auction winners * (₹40,000 - ₹10,000) = ₹90,000 distributable across 40 tickets = ₹2,250
  assert.equal(c1.distributableDividend, 90_000);
  assert.equal(c1.dividendPerTicket, 2_250);
  assert.equal(res.consolidated.balanceCheck.isBalanced, true);
}

// 5. AUCTION_UNCAPPED_ENTERPRISE: >40% bid permitted without above_cap warning
{
  const tmpl = PRACTICAL_CHIT_TEMPLATES.find((t) => t.engineType === 'AUCTION_UNCAPPED_ENTERPRISE')!;
  const input = buildDefaultSimulationInput(tmpl);
  input.cycleOverrides = { 1: { bidDiscount: 250_000 } }; // 50% on ₹5,00,000
  const res = simulateChitLifecycle(input);
  assert.equal(res.cycles[0]!.warning, null);
  assert.equal(res.cycles[0]!.prizeAmount, 250_000);
  assert.equal(res.consolidated.balanceCheck.isBalanced, true);
}

// 6. BASE_PLUS_PREMIUM: dual due pool growth & early vs mid vs late total paid
{
  const tmpl = PRACTICAL_CHIT_TEMPLATES.find((t) => t.engineType === 'BASE_PLUS_PREMIUM')!;
  const input = buildDefaultSimulationInput(tmpl);
  const res = simulateChitLifecycle(input);
  assert.equal(res.cycles[0]!.grossPool, 90_000); // 10 * 9,000
  assert.equal(res.cycles[9]!.grossPool, 108_000); // 10 * 9,000 + 9 * 2,000
  const early = res.memberJourneys.find((j) => j.role === 'early')!;
  const mid = res.memberJourneys.find((j) => j.role === 'mid')!;
  const late = res.memberJourneys.find((j) => j.role === 'late')!;
  assert.equal(early.totalNetPaid, 108_000); // 90k base + 9 * 2k
  assert.equal(mid.totalNetPaid, 100_000); // Cycle 5 win -> 5 * 2k extra
  assert.equal(late.totalNetPaid, 90_000); // Cycle 10 win -> 0 extra
}

// 7. GOLD_VALUE_ACCUMULATION (11+1) & GOLD_WEIGHT_ACCUMULATION (per-cycle editable gold rate)
{
  const gvTmpl = PRACTICAL_CHIT_TEMPLATES.find((t) => t.engineType === 'GOLD_VALUE_ACCUMULATION')!;
  const gvRes = simulateChitLifecycle(buildDefaultSimulationInput(gvTmpl));
  assert.equal(gvRes.cycles[10]!.phase, 'accumulation');
  assert.equal(gvRes.cycles[11]!.phase, 'bonus');
  assert.equal(gvRes.memberJourneys[0]!.totalNetPaid, 110_000);
  assert.equal(gvRes.memberJourneys[0]!.prizeOrMaturityReceived, 120_000);
  assert.equal(gvRes.memberJourneys[0]!.netGainOrCost, 10_000);
  assert.equal(gvRes.consolidated.balanceCheck.isBalanced, true);

  const gwTmpl = PRACTICAL_CHIT_TEMPLATES.find((t) => t.engineType === 'GOLD_WEIGHT_ACCUMULATION')!;
  const gwInput = buildDefaultSimulationInput(gwTmpl);
  gwInput.totalMembers = 2;
  gwInput.chitValue = 20_000;
  gwInput.monthlyContrib = 10_000;
  gwInput.cycleOverrides = { 1: { goldRatePerGram: 5_000 }, 2: { goldRatePerGram: 10_000 } };
  const gwRes = simulateChitLifecycle(gwInput);
  assert.equal(gwRes.cycles[0]!.goldGramsCredited, 2); // 10,000 / 5,000
  assert.equal(gwRes.cycles[1]!.goldGramsCredited, 1); // 10,000 / 10,000
  assert.equal(gwRes.consolidated.totalGoldGramsPerMember, 3);
  assert.equal(gwRes.consolidated.weightedAvgGoldRate, 6666.67);
}

// 8. HYBRID_SPLIT_PHASE, ASCA_SHG_REVOLVING, CUSTOM_MANUAL_SCHEDULE & FIXED_CHART_ESCALATING
{
  const hyTmpl = PRACTICAL_CHIT_TEMPLATES.find((t) => t.engineType === 'HYBRID_SPLIT_PHASE')!;
  const hyInput = buildDefaultSimulationInput(hyTmpl);
  const hyRes = simulateChitLifecycle(hyInput);
  assert.equal(hyRes.cycles[0]!.phase, 'reserved');
  assert.equal(hyRes.cycles[0]!.commission, 0);
  assert.equal(hyRes.cycles[0]!.prizeAmount, 100_000);
  assert.equal(hyRes.cycles[1]!.phase, 'auction');
  assert.equal(hyRes.consolidated.balanceCheck.isBalanced, true);

  const ascaTmpl = PRACTICAL_CHIT_TEMPLATES.find((t) => t.engineType === 'ASCA_SHG_REVOLVING')!;
  const ascaRes = simulateChitLifecycle(buildDefaultSimulationInput(ascaTmpl));
  assert.ok(ascaRes.consolidated.totalMerchantBonusOrInterest > 0);
  assert.ok(ascaRes.memberJourneys[2]!.prizeOrMaturityReceived > ascaRes.memberJourneys[2]!.totalNetPaid);

  const custTmpl = PRACTICAL_CHIT_TEMPLATES.find((t) => t.engineType === 'CUSTOM_MANUAL_SCHEDULE')!;
  const custInput = buildDefaultSimulationInput(custTmpl);
  custInput.cycleOverrides = { 1: { payoutAmount: 88_000, commission: 2_000 } };
  const custRes = simulateChitLifecycle(custInput);
  assert.equal(custRes.cycles[0]!.prizeAmount, 88_000);
  assert.equal(custRes.cycles[0]!.commission, 2_000);
  assert.equal(custRes.cycles[0]!.distributableDividend, 10_000);
  assert.equal(custRes.cycles[0]!.dividendPerTicket, 1_000);
}

// 9. Validation guards reject invalid simulation parameters
{
  const stdInput = buildDefaultSimulationInput(PRACTICAL_CHIT_TEMPLATES[0]!);
  assert.throws(() => simulateChitLifecycle({ ...stdInput, chitValue: 0 }));
  assert.throws(() => simulateChitLifecycle({ ...stdInput, monthlyContrib: -100 }));
  assert.throws(() => simulateChitLifecycle({ ...stdInput, totalMembers: 1 }));
  assert.throws(() => simulateChitLifecycle({ ...stdInput, commissionPct: -1 }));
}

console.log('chitSimulator tests passed');
