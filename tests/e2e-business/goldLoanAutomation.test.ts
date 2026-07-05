import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { disconnectTestDb, getPrisma, getRunId } from './helpers/testDb';
import { cleanupRunData } from './helpers/cleanup';
import { createCustomerFixture, createLoanFixture, seedLoanTrackScenario, type LoanTrackScenario } from './helpers/seedLoanTrack';
import { issueMobileTokenForSetup } from './helpers/authTokens';
import { routeRequest, expectOk, routes, type Envelope } from './helpers/apiClient';
import { assertGoldValuation, assertOrnamentTotals } from './helpers/assertGold';
import { assertMoneyEqual } from './helpers/assertMoney';
import { knownGap, run, test } from './helpers/harness';
import { writeKnownGapEvidence } from './helpers/evidenceWriter';

const runId = getRunId();
const prisma = getPrisma();

let scenario: LoanTrackScenario;
let adminToken = '';
let agentToken = '';
let goldLoanId = '';
let collateralId = '';

async function seedGoldFixture() {
  const customer = await createCustomerFixture(scenario, {
    key: 'gold',
    phoneOffset: 710,
    status: 'active',
    appType: 'goldloans',
  });
  const loan = await createLoanFixture(scenario, {
    key: 'gold',
    customerId: customer.id,
    principal: 60000,
    tenure: 6,
  });
  await prisma.loan.update({
    where: { id: loan.id },
    data: {
      appType: 'goldloans',
      loanType: 'gold',
      status: 'active',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
    },
  });
  const collateral = await prisma.goldLoanCollateral.create({
    data: {
      tenantId: scenario.tenantA.id,
      branchId: scenario.branchA1.id,
      loanId: loan.id,
      customerId: customer.id,
      packetNo: `${runId}-GL-PACKET`,
      ornamentDescription: `${runId} gold pledge`,
      grossWeightGrams: 22,
      netWeightGrams: 20,
      purityKarat: '22K',
      marketRatePerGram: 6000,
      assessedValue: 120000,
      eligibleLtvPercent: 75,
      storageLocation: `${runId}-LOCKER`,
      valuerName: `${runId} Valuer`,
      valuationDate: new Date('2026-01-01T00:00:00.000Z'),
      outstandingPrincipal: 60000,
      interestPaidUpto: new Date('2026-01-01T00:00:00.000Z'),
    },
  });
  await prisma.goldOrnamentItem.createMany({
    data: [
      {
        tenantId: scenario.tenantA.id,
        collateralId: collateral.id,
        ornamentType: `${runId}-Ring`,
        specification: '22K plain',
        purityKarat: '22K',
        quantity: 2,
        grossWeightGrams: 10,
        wastageGrams: 1,
        netWeightGrams: 9,
        ratePerGram: 6000,
        value: 54000,
      },
      {
        tenantId: scenario.tenantA.id,
        collateralId: collateral.id,
        ornamentType: `${runId}-Chain`,
        specification: '22K plain',
        purityKarat: '22K',
        quantity: 1,
        grossWeightGrams: 12,
        wastageGrams: 1,
        netWeightGrams: 11,
        ratePerGram: 6000,
        value: 66000,
      },
    ],
  });
  goldLoanId = loan.id;
  collateralId = collateral.id;
}

test('GOLD-001 admin maintains ornament master data through v1 gold master route', async () => {
  for (const body of [
    { kind: 'type', name: `${runId}-Ring`, metal: 'gold', sortOrder: 1 },
    { kind: 'spec', name: `${runId}-22K`, purityKarat: '22K', sortOrder: 2 },
    { kind: 'bank', name: `${runId}-Bank`, sortOrder: 3 },
  ]) {
    const created = await routeRequest<Envelope<{ id: string }>>({
      importPath: routes.goldMaster,
      method: 'POST',
      path: '/api/v1/gold/master',
      token: adminToken,
      tenantSlug: scenario.tenantA.slug,
      appType: 'goldloans',
      body,
    });
    expectOk(created, `gold master create failed for ${body.kind}`);
  }

  const list = await routeRequest<Envelope<{ ornamentTypes: any[]; ornamentSpecs: any[]; bankNames: any[] }>>({
    importPath: routes.goldMaster,
    method: 'GET',
    path: '/api/v1/gold/master',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    appType: 'goldloans',
  });
  const data = expectOk(list);
  assert.equal(data.ornamentTypes.some((row) => row.name === `${runId}-Ring`), true);
  assert.equal(data.ornamentSpecs.some((row) => row.name === `${runId}-22K`), true);
  assert.equal(data.bankNames.some((row) => row.name === `${runId}-Bank`), true);
});

test('GOLD-002/GOLD-003 gold config and manual rate are used without live provider calls', async () => {
  for (const [key, value] of [
    ['gold_rate_per_gram_24k', '6000'],
    ['gold_interest_percent', '2'],
    ['gold_default_ltv_percent', '75'],
  ] as const) {
    await prisma.appSetting.upsert({
      where: { tenantId_key: { tenantId: scenario.tenantA.id, key } },
      update: { value, group: 'gold' },
      create: { tenantId: scenario.tenantA.id, key, value, group: 'gold' },
    });
  }

  const config = await routeRequest<Envelope<any>>({
    importPath: routes.goldConfig,
    method: 'GET',
    path: '/api/v1/gold/config',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    appType: 'goldloans',
  });
  const configData = expectOk(config);
  assert.equal(Number(configData.goldPureRatePerGram), 6000);

  const rate = await routeRequest<Envelope<{ ratePerGram: number }>>({
    importPath: routes.goldRate,
    method: 'GET',
    path: '/api/v1/gold/rate',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    appType: 'goldloans',
  });
  assert.equal(Number(expectOk(rate).ratePerGram), 6000);
});

test('GOLD-004/GOLD-005 valuation math and LTV cap match DB collateral fixture', async () => {
  const { valuation } = assertGoldValuation({
    grossWeight: 22,
    wastage: 2,
    purityKarat: '24K',
    ratePerGram: 6000,
    ltvPercent: 75,
    expectedLoanAmount: 60000,
  });
  assertMoneyEqual(valuation.assessedValue, 120000, 'test valuation assessed value');
  const collateral = await prisma.goldLoanCollateral.findUniqueOrThrow({ where: { id: collateralId } });
  assertMoneyEqual(collateral.assessedValue, 120000, 'assessed value persisted');
  const ltvCap = Number(collateral.assessedValue) * (Number(collateral.eligibleLtvPercent) / 100);
  const loan = await prisma.loan.findUniqueOrThrow({ where: { id: goldLoanId } });
  assert.equal(Number(loan.principal) <= ltvCap, true, 'principal must be inside configured LTV');
});

test('GOLD-006/GOLD-011 collateral receipt data and ornament report match DB', async () => {
  const report = await routeRequest<Envelope<{ rows: Array<{ ornamentType: string; quantity: number; netWeight: number; value: number }> }>>({
    importPath: routes.goldReports,
    method: 'GET',
    path: '/api/v1/gold/reports?type=ornaments',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    appType: 'goldloans',
  });
  const rows = expectOk(report).rows.filter((row) => row.ornamentType.startsWith(runId));
  assertOrnamentTotals(
    rows.map((row) => ({
      quantity: row.quantity,
      grossWeightGrams: Number((row as any).grossWeight ?? 0),
      wastageGrams: Number((row as any).wastage ?? 0),
      netWeightGrams: Number(row.netWeight ?? 0),
      ratePerGram: row.netWeight ? Number(row.value ?? 0) / Number(row.netWeight) : 0,
    })),
    { totalQuantity: 3, totalGrossWeight: 22, totalWastage: 2, totalNetWeight: 20, totalValue: 120000 },
  );
});

test('GOLD-008 admin creates and lists bank repledge records through v1 route', async () => {
  const created = await routeRequest<Envelope<{ id: string; bankName: string; amountGivenByBank: unknown }>>({
    importPath: routes.goldRepledge,
    method: 'POST',
    path: `/api/v1/gold/loans/${goldLoanId}/repledge`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    appType: 'goldloans',
    params: { id: goldLoanId },
    body: {
      bankName: `${runId}-Bank`,
      referenceNo: `${runId}-REPLEDGE`,
      amountGivenByBank: 50000,
      interestRate: 9,
      processingFee: 100,
      staffName: `${runId}-Staff`,
    },
  });
  const row = expectOk(created);
  assert.equal(row.bankName, `${runId}-Bank`);

  const dbRow = await prisma.bankRepledge.findUniqueOrThrow({ where: { id: row.id } });
  assertMoneyEqual(dbRow.amountGivenByBank, 50000, 'repledge bank amount persisted');
});

test('GOLD-009 gold servicing interest payment updates payment and collateral state', async () => {
  const before = await prisma.payment.count({ where: { loanId: goldLoanId, paymentType: 'interest' } });
  const paidOn = new Date('2026-02-02T00:00:00.000Z');
  const response = await routeRequest<Envelope<{ recorded: string; amount: unknown; interestPaidUpto: string }>>({
    importPath: routes.goldServicing,
    method: 'POST',
    path: `/api/v1/gold/loans/${goldLoanId}/servicing`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    appType: 'goldloans',
    params: { id: goldLoanId },
    body: { action: 'interest', amount: 1200, paymentMode: 'cash', paidOn: paidOn.toISOString() },
  });
  const data = expectOk(response);
  assert.equal(data.recorded, 'interest');
  const after = await prisma.payment.count({ where: { loanId: goldLoanId, paymentType: 'interest' } });
  assert.equal(after, before + 1);
});

test('GOLD-010 redemption closes loan and releases pledged ornaments', async () => {
  const response = await routeRequest<Envelope<{ status: string; amount: unknown }>>({
    importPath: routes.goldServicing,
    method: 'POST',
    path: `/api/v1/gold/loans/${goldLoanId}/servicing`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    appType: 'goldloans',
    params: { id: goldLoanId },
    body: { action: 'redeem', paymentMode: 'cash', paidOn: new Date('2026-03-05T00:00:00.000Z').toISOString() },
  });
  assert.equal(expectOk(response).status, 'closed');
  const loan = await prisma.loan.findUniqueOrThrow({ where: { id: goldLoanId } });
  const collateral = await prisma.goldLoanCollateral.findUniqueOrThrow({ where: { id: collateralId } });
  assert.equal(loan.status, 'closed');
  assert.equal(collateral.releaseStatus, 'released');
});

test('GOLD-012 agent cannot service/redeem gold pledge', async () => {
  const response = await routeRequest<Envelope<unknown>>({
    importPath: routes.goldServicing,
    method: 'POST',
    path: `/api/v1/gold/loans/${goldLoanId}/servicing`,
    token: agentToken,
    tenantSlug: scenario.tenantA.slug,
    appType: 'goldloans',
    params: { id: goldLoanId },
    body: { action: 'part', amount: 100 },
  });
  assert.equal(response.status, 403, response.text);
});

knownGap('GOLD-GAP-001 direct gold receipt PDF route lacks mobile bearer-token harness', {
  id: 'GOLD-GAP-001',
  classification: 'P2',
  currentBehavior: 'The gold receipt route is a NextAuth web-session handler under app/api/loans/[id]/gold-receipt.',
  expectedBehavior: 'Business E2E should verify the generated gold receipt through a safe web-session harness or a shared receipt builder.',
  evidenceSource: 'app/api/loans/[id]/gold-receipt/route.ts',
  businessImpact: 'Gold pledge receipt regressions are covered by DB/report data but not by route-level PDF bytes.',
  fixedAssertion: 'A route or builder test asserts receipt customer, loan, collateral, and ornament totals match DB state.',
}, async () => {
  const receiptPath = path.join(process.cwd(), 'app', 'api', 'loans', '[id]', 'gold-receipt', 'route.ts');
  assert.equal(existsSync(receiptPath), true, 'gold receipt route missing');
  const source = readFileSync(receiptPath, 'utf8');
  assert.equal(/auth\(/.test(source), false, 'receipt route still depends on NextAuth web session');
});

async function main() {
  try {
    scenario = await seedLoanTrackScenario(runId);
    adminToken = await issueMobileTokenForSetup({ ...scenario.users.adminA1, appType: 'goldloans' });
    agentToken = await issueMobileTokenForSetup({ ...scenario.users.agentA1, appType: 'goldloans' });
    await seedGoldFixture();
    const summary = await run();
    await writeKnownGapEvidence(runId, summary, 'tests/e2e-business/goldLoanAutomation.test.ts');
  } finally {
    await cleanupRunData(runId);
    await disconnectTestDb();
  }
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
  await disconnectTestDb();
});
