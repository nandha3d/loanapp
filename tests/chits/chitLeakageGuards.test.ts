import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { calculateChitPeriodEngine } from '../../lib/chits/engineCalculator';
import { parseChitEngineConfig } from '../../lib/chits/engineTypes';
import { nextPeriodDate, parseFrequency } from '../../lib/chits/frequency';
import { calculateChitAccountingMetrics } from '../../lib/accounting/chitSummary';
import { getSettingsTabsForAppType, isLendingAppType } from '../../lib/moduleCapabilities';
import { isRouteEnabledForModules } from '../../types/modules';

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

// ── 1. Module & route isolation checks ────────────────────────────────────────
assert.equal(isLendingAppType('chitfunds'), false);
assert.equal(getSettingsTabsForAppType('chitfunds').includes('features'), false);
assert.equal(getSettingsTabsForAppType('chitfunds').includes('chittypes'), true);

for (const blockedPath of [
  '/loans',
  '/loans/new',
  '/approvals',
  '/penalties',
  '/agent-dashboard',
  '/route-tracker',
  '/settings/gold-master',
  '/settings/payment-gateway',
  '/collection/runs',
  '/collection/self-pay',
  '/reports/agents',
  '/vehicles',
  '/pending-tasks',
  '/finance-partners',
]) {
  assert.equal(
    isRouteEnabledForModules(blockedPath, ['chitfunds']),
    false,
    `Expected ${blockedPath} to be blocked under chitfunds`,
  );
}
for (const allowedPath of ['/chits', '/chits/new', '/collection', '/customers', '/accounting', '/settings']) {
  assert.equal(
    isRouteEnabledForModules(allowedPath, ['chitfunds']),
    true,
    `Expected ${allowedPath} to remain allowed under chitfunds`,
  );
}

// ── 2. Engine fixes: F5 (explicit commissionPct), F7 (>chitValue), F9 (0 eligible)
{
  const members = Array.from({ length: 5 }, (_, idx) => ({
    memberId: `m-${idx + 1}`,
    memberName: `Member ${idx + 1}`,
    ticketNo: String(idx + 1),
    ticketShare: 1,
    hasWonBeforePeriod: false,
    isActive: true,
    isLateThisPeriod: false,
  }));

  // F5: explicit input.commissionPct (3%) overrides default config 5%
  const stdCfg = parseChitEngineConfig(null, 'AUCTION_STANDARD');
  const f5 = calculateChitPeriodEngine({
    engineType: 'AUCTION_STANDARD',
    config: stdCfg,
    chitValue: 100_000,
    monthlyContrib: 20_000,
    totalMembers: 5,
    periodNumber: 1,
    commissionPct: 3,
    commissionBasis: 'CHIT_VALUE',
    winnerMemberIds: ['m-1'],
    prizeAmount: 85_000,
    members,
  });
  assert.equal(f5.commissionPct, 3);
  assert.equal(f5.commission, 3_000);

  // F7: bonus payout above chitValue in FIXED_CHART_ESCALATING is not truncated
  const chartCfg = parseChitEngineConfig(
    { escalatingPayouts: [{ period: 5, payoutAmount: 108_000 }] },
    'FIXED_CHART_ESCALATING',
  );
  const f7 = calculateChitPeriodEngine({
    engineType: 'FIXED_CHART_ESCALATING',
    config: chartCfg,
    chitValue: 100_000,
    monthlyContrib: 20_000,
    totalMembers: 5,
    periodNumber: 5,
    commissionPct: 0,
    winnerMemberIds: ['m-5'],
    members,
  });
  assert.equal(f7.prizeAmount, 108_000);
  assert.equal(f7.bidDiscount, 0);

  // F9: 0 eligible members under NON_PRIZED_ONLY returns 0 dividend instead of NaN / fallback N-1
  const allPrized = members.map((m) => ({ ...m, hasWonBeforePeriod: true }));
  const f9Cfg = parseChitEngineConfig({ dividendDistributionMode: 'NON_PRIZED_ONLY' }, 'AUCTION_STANDARD');
  const f9 = calculateChitPeriodEngine({
    engineType: 'AUCTION_STANDARD',
    config: f9Cfg,
    chitValue: 100_000,
    monthlyContrib: 20_000,
    totalMembers: 5,
    periodNumber: 5,
    commissionPct: 5,
    dividendPolicy: 'NON_PRIZED_ONLY',
    winnerMemberIds: ['m-5'],
    prizeAmount: 85_000,
    members: allPrized,
  });
  assert.equal(f9.dividendEligibleTickets, 0);
  assert.equal(f9.dividendPerTicket, 0);
  assert.equal(f9.distributableDividend, 0);
  assert.equal(Number.isFinite(f9.dividendPerTicket), true);
}

// ── 3. UTC frequency & chit accounting status regressions ───────────────────────
{
  const monthly = parseFrequency({ auctionFrequency: 'monthly' });
  const start = new Date('2026-01-31T00:00:00.000Z');
  assert.equal(nextPeriodDate(start, 2, monthly).toISOString().slice(0, 10), '2026-02-28');
  assert.equal(nextPeriodDate(start, 3, monthly).toISOString().slice(0, 10), '2026-03-31');

  const summary = calculateChitAccountingMetrics({
    groups: [{ status: 'active', chitValue: 100_000, startDate: '2026-01-01' }],
    subscriptions: [],
    auctions: [
      { auctionDate: '2026-02-01', completedAt: '2026-02-01', status: 'confirmed', prizeAmount: 90_000, dividend: 1_000 },
      { auctionDate: '2026-03-01', completedAt: '2026-03-01', status: 'paid', prizeAmount: 92_000, dividend: 800 },
    ],
  });
  assert.equal(summary.prizePayouts, 182_000);
}

// ── 4. API & schema & MONEY-17 & i18n static contracts ────────────────────────
const schemaSrc = read('prisma/schema.prisma');
assert.equal(
  schemaSrc.includes('@@unique([tenantId, groupCode])'),
  true,
  'ChitGroup.groupCode must be unique per tenant, not globally @unique',
);
assert.equal(
  schemaSrc.includes('groupCode               String?       @unique'),
  false,
  'ChitGroup.groupCode must not carry global @unique',
);

for (const apiRoute of [
  'app/api/v1/loans/route.ts',
  'app/api/v1/loans/[id]/route.ts',
  'app/api/v1/approvals/route.ts',
  'app/api/v1/wallet/summary/route.ts',
  'app/api/v1/penalties/route.ts',
  'app/api/v1/npa/summary/route.ts',
  'app/api/v1/vehicles/route.ts',
  'app/api/v1/gold/master/route.ts',
  'app/api/v1/packages/route.ts',
  'app/api/v1/nach/mandate/route.ts',
  'app/api/v1/collection/today/route.ts',
  'app/api/bureau/pull/route.ts',
]) {
  const src = read(apiRoute);
  const hasGuard =
    src.includes('chitfunds') ||
    (apiRoute.includes('vehicles') && src.includes("!== 'autofinance'")) ||
    (apiRoute.includes('gold/master') && src.includes("!== 'goldloan'"));
  assert.equal(
    hasGuard,
    true,
    `Lending API ${apiRoute} must guard against chitfunds appType`,
  );
}

for (const floatFile of [
  'lib/chits/collections.ts',
  'lib/chits/payout.ts',
  'app/api/v1/chits/receipts/[receiptId]/reverse/route.ts',
  'app/api/v1/chits/[id]/penalties/[penaltyId]/pay/route.ts',
]) {
  const src = read(floatFile);
  assert.equal(
    src.includes("=== 'cash'"),
    true,
    `MONEY-17 cash-only branch float guard missing in ${floatFile}`,
  );
}

const notifySrc = read('lib/notify/events.ts');
assert.equal(notifySrc.includes('சந்தா பெறப்பட்டது'), true, 'Missing native Tamil template in lib/notify/events.ts');
assert.equal(notifySrc.includes('किस्त प्राप्त हुई'), true, 'Missing native Hindi template in lib/notify/events.ts');

const auctionClientSrc = read('app/(dashboard)/[module]/chits/[id]/auctions/[auctionId]/AuctionDetailClient.tsx');
assert.equal(
  auctionClientSrc.includes('submitter'),
  true,
  'AuctionDetailClient security form must forward nativeEvent.submitter into FormData',
);

const settingsActionSrc = read('app/(dashboard)/[module]/settings/chit-types/actions.ts');
const settingsApiSrc = read('app/api/v1/chits/settings/route.ts');
assert.equal(
  settingsActionSrc.includes("['superadmin', 'developer']") && settingsApiSrc.includes("['superadmin', 'developer']"),
  true,
  'Chit type settings write gate must restrict writes to superadmin/developer',
);

console.log('chitLeakageGuards tests passed');
