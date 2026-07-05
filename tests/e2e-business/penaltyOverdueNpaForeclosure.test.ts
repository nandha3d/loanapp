import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { routeRequest, expectOk, expectError, routes, type Envelope } from './helpers/apiClient';
import { assertMoneyEqual } from './helpers/assertMoney';
import { cronGet, expireCronLocks } from './helpers/assertCron';
import { assertBucket, assertLoanNotActiveCollectible, assertPenaltyNetDue, makeFirstInstalmentsOverdue } from './helpers/assertRisk';
import { issueMobileTokenForSetup } from './helpers/authTokens';
import { cleanupRunData } from './helpers/cleanup';
import { writeKnownGapsReport } from './helpers/evidenceWriter';
import { knownGap, run, test } from './helpers/harness';
import { knownGapCatalog } from './helpers/knownGaps';
import { createCustomerFixture, createLoanFixture, seedLoanTrackScenario, type LoanTrackScenario } from './helpers/seedLoanTrack';
import { APP_TYPE, disconnectTestDb, getPrisma, getRunId } from './helpers/testDb';

process.env.TZ = 'UTC';

let scenario: LoanTrackScenario;
let adminToken = '';
let riskLoanId = '';
let npaLoanId = '';
let precloseLoanId = '';
let penaltyId = '';
let settlePenaltyId = '';

async function createActiveLoan(key: string, phoneOffset: number, principal = 6000) {
  const customer = await createCustomerFixture(scenario, { key, phoneOffset, status: 'active' });
  return createLoanFixture(scenario, { key, customerId: customer.id, principal, status: 'active' });
}

test('RISK-001 overdue instalment is detected by report route', async () => {
  const loan = await createActiveLoan('risk-overdue', 4101);
  riskLoanId = loan.id;
  await makeFirstInstalmentsOverdue(loan.id, 7, 1);
  const response = await routeRequest<Envelope<any>>({
    importPath: routes.overdueReport,
    method: 'GET',
    path: '/api/v1/reports/overdue',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
  });
  const rows = expectOk<any>(response, 'overdue report');
  assert.equal(JSON.stringify(rows).includes(loan.loanCode), true, 'overdue report should include RUN_ID loan');
});

test('RISK-002/RISK-003 penalty cron creates one net penalty and is idempotent', async () => {
  await getPrisma().appSetting.upsert({
    where: { tenantId_key: { tenantId: scenario.tenantA.id, key: 'default_penalty_per_day' } },
    update: { value: '10', group: 'risk' },
    create: { tenantId: scenario.tenantA.id, key: 'default_penalty_per_day', value: '10', group: 'risk' },
  });

  await expireCronLocks(['penalty_accrual']);
  const first = await cronGet<any>({ importPath: routes.cronAccruePenalties, path: '/api/cron/accrue-penalties' });
  assert.equal(first.status, 200, first.text);
  const firstCount = await getPrisma().penalty.count({ where: { loanId: riskLoanId, status: { in: ['pending', 'partial'] } } });
  assert.equal(firstCount, 1, 'first penalty cron should create one active penalty');

  await expireCronLocks(['penalty_accrual']);
  const second = await cronGet<any>({ importPath: routes.cronAccruePenalties, path: '/api/cron/accrue-penalties' });
  assert.equal(second.status, 200, second.text);
  const secondCount = await getPrisma().penalty.count({ where: { loanId: riskLoanId, status: { in: ['pending', 'partial'] } } });
  assert.equal(secondCount, firstCount, 'second penalty cron should not duplicate penalty rows');

  const penalty = await getPrisma().penalty.findFirstOrThrow({ where: { loanId: riskLoanId } });
  penaltyId = penalty.id;
  await assertPenaltyNetDue(riskLoanId, Number(penalty.grossPenalty), 'penalty net due should match DB gross before waiver/settlement');
});

test('RISK-004 penalty waiver updates net due through v1 route', async () => {
  const waive = await routeRequest<Envelope<any>>({
    importPath: routes.penaltyWaive,
    method: 'POST',
    path: `/api/v1/penalties/${penaltyId}/waive`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: penaltyId },
    body: { amount: 10, reason: `${scenario.runId} phase5 waiver` },
  });
  expectOk(waive, 'penalty waiver');
  const waived = await getPrisma().penalty.findUniqueOrThrow({ where: { id: penaltyId } });
  assertMoneyEqual(waived.waivedAmount, 10, 'waived penalty amount');

});

knownGap('RISK-GAP-004 penalty settlement route writes non-schema paymentMode field', {
  id: 'RISK-GAP-004',
  classification: 'P1',
  currentBehavior: 'PATCH /api/v1/penalties/[id]/settle attempts prisma.penalty.update({ paymentMode }) even though Penalty has no paymentMode field in prisma/schema.prisma.',
  expectedBehavior: 'Penalty settlement should persist status, settledAmount, settledAt, and optional settlement metadata using fields that exist in the Prisma model/schema.',
  evidenceSource: 'app/api/v1/penalties/[id]/settle/route.ts; prisma/schema.prisma model Penalty',
  businessImpact: 'Admins cannot settle penalties through the v1 route, leaving penalty dues open after payment.',
  fixedAssertion: 'Calling the settle route returns 2xx and the DB penalty row has status=settled and settledAmount equal to the API amount.',
}, async () => {
  const loan = await getPrisma().loan.findUniqueOrThrow({ where: { id: riskLoanId } });
  const settlePenalty = await getPrisma().penalty.create({
    data: {
      loanId: riskLoanId,
      customerId: loan.customerId,
      missedDays: 1,
      grossPenalty: 25,
      status: 'pending',
      notes: `${scenario.runId} settle fixture`,
    },
  });
  settlePenaltyId = settlePenalty.id;
  const settle = await routeRequest<Envelope<any>>({
    importPath: routes.penaltySettle,
    method: 'PATCH',
    path: `/api/v1/penalties/${settlePenalty.id}/settle`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: settlePenalty.id },
    body: { action: 'settle', amount: 25, paymentMode: 'cash' },
  });
  expectOk(settle, 'penalty settlement');
  const settled = await getPrisma().penalty.findUniqueOrThrow({ where: { id: settlePenaltyId } });
  assert.equal(settled.status, 'settled');
  assertMoneyEqual(settled.settledAmount, 25, 'settled penalty amount');
});

test('RISK-006/RISK-010 NPA classification, history, summary, and provisioning match DB', async () => {
  const loan = await createActiveLoan('risk-npa', 4102, 10000);
  npaLoanId = loan.id;
  await makeFirstInstalmentsOverdue(loan.id, 95, 1);
  const { runNpaClassification } = await import('../../lib/npa/npaClassifier');
  const result = await runNpaClassification(scenario.tenantA.id, 'phase5_e2e');
  assert.equal(result.processed >= 1, true, JSON.stringify(result));

  const dbLoan = await getPrisma().loan.findUniqueOrThrow({ where: { id: loan.id } });
  assertBucket(dbLoan.npaStatus, 'sub_standard', 'NPA bucket after 95 overdue days');
  assert.equal(dbLoan.status, 'npa');

  const history = await routeRequest<Envelope<any[]>>({
    importPath: routes.npaHistory,
    method: 'GET',
    path: `/api/v1/npa/history?loanId=${loan.id}`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
  });
  assert.equal(expectOk(history, 'NPA history').some((row) => row.toCategory === 'sub_standard'), true);

  const summary = await routeRequest<Envelope<any>>({
    importPath: routes.npaSummary,
    method: 'GET',
    path: '/api/v1/npa/summary',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
  });
  const summaryData = expectOk<any>(summary, 'NPA summary');
  const provisioning = await getPrisma().loanProvisioning.findFirstOrThrow({ where: { loanId: loan.id } });
  assert.equal(summaryData.total.count >= 1, true, 'summary should include provisioning snapshot');
  assertMoneyEqual(provisioning.provisioningAmt, dbLoan.provisioningAmount, 'loan provisioning vs snapshot');
});

test('RISK-011/RISK-013 foreclosure calculation and preclose closure are enforced', async () => {
  const loan = await createActiveLoan('risk-preclose', 4103, 5000);
  precloseLoanId = loan.id;
  const { calculateForeclosure } = await import('../../lib/foreclosure');
  const calc = await calculateForeclosure(loan.id, scenario.tenantA.id, 100);
  assert.equal(calc.canForeclose, true);
  assertMoneyEqual(calc.discount, 100, 'foreclosure discount');

  const preclose = await routeRequest<Envelope<any>>({
    importPath: routes.loanPreclose,
    method: 'POST',
    path: `/api/v1/loans/${loan.id}/preclose`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: loan.id },
    body: { amount: calc.totalSettlementAmount, paymentMode: 'cash', remarks: `${scenario.runId} preclose` },
  });
  expectOk(preclose, 'loan preclose');
  await assertLoanNotActiveCollectible(loan.id);

  const again = await routeRequest<Envelope<any>>({
    importPath: routes.loanPreclose,
    method: 'POST',
    path: `/api/v1/loans/${loan.id}/preclose`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: loan.id },
    body: { amount: 1, paymentMode: 'cash' },
  });
  expectError(again, [400, 409, 500], 'closed loan cannot be preclosed again');
});

knownGap(
  'RISK-015 written-off loan should be excluded from active collectible loans',
  {
    id: 'RISK-GAP-003',
    classification: 'P2',
    currentBehavior: 'No dedicated v1 write-off route was found in the current backend route surface.',
    expectedBehavior: 'A supported write-off route/service should mark the loan written_off and remove it from active collectible reports.',
    evidenceSource: 'app/api/v1/loans/[id]/close and /preclose exist; no app/api/v1/loans/[id]/write-off route is present.',
    businessImpact: 'Write-off regression coverage cannot be route-level until the backend exposes a supported write-off behavior.',
    fixedAssertion: 'After write-off, the loan is absent from active collectible loan/report queries and audit/provisioning state is written.',
  },
  async () => {
    assert.equal(
      existsSync(path.join(process.cwd(), 'app', 'api', 'v1', 'loans', '[id]', 'write-off', 'route.ts')),
      true,
      'write-off route should exist for route-level regression coverage',
    );
  },
);

async function main() {
  const runId = getRunId();
  try {
    scenario = await seedLoanTrackScenario(runId);
    adminToken = await issueMobileTokenForSetup(scenario.users.adminA1);
    const summary = await run();
    writeKnownGapsReport({
      runId,
      source: 'tests/e2e-business/penaltyOverdueNpaForeclosure.test.ts',
      knownGaps: summary.knownGapResults,
      summary,
    });
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
