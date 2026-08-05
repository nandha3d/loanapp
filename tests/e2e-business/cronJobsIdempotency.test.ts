import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { routes } from './helpers/apiClient';
import { cronGet, assertCronUnauthorized, expireCronLocks } from './helpers/assertCron';
import { makeFirstInstalmentsOverdue } from './helpers/assertRisk';
import { issueMobileTokenForSetup } from './helpers/authTokens';
import { cleanupRunData } from './helpers/cleanup';
import { writeKnownGapsReport } from './helpers/evidenceWriter';
import { knownGap, run, test } from './helpers/harness';
import { knownGapCatalog } from './helpers/knownGaps';
import { createCustomerFixture, createLoanFixture, seedZoloFundScenario, type ZoloFundScenario } from './helpers/seedZoloFund';
import { APP_TYPE, disconnectTestDb, getPrisma, getRunId } from './helpers/testDb';

process.env.TZ = 'UTC';

let scenario: ZoloFundScenario;
let adminToken = '';
let penaltyLoanId = '';
let npaLoanId = '';

async function createLoan(key: string, phoneOffset: number) {
  const customer = await createCustomerFixture(scenario, { key, phoneOffset, status: 'active' });
  return createLoanFixture(scenario, { key, customerId: customer.id, principal: 8000, status: 'active' });
}

test('CRON-011 cron routes without valid secret are blocked', async () => {
  await assertCronUnauthorized({ importPath: routes.cronAccruePenalties, path: '/api/cron/accrue-penalties' });
  await assertCronUnauthorized({ importPath: routes.cronNpaClassify, path: '/api/cron/npa-classify' });
  await assertCronUnauthorized({ importPath: routes.cronGpsPurge, path: '/api/cron/gps-purge' });
});

test('CRON-001/CRON-002 penalty accrual cron runs twice without duplicate penalties', async () => {
  const loan = await createLoan('cron-penalty', 4201);
  penaltyLoanId = loan.id;
  await makeFirstInstalmentsOverdue(loan.id, 5, 1);
  await getPrisma().appSetting.upsert({
    where: { tenantId_key: { tenantId: scenario.tenantA.id, key: 'default_penalty_per_day' } },
    update: { value: '10', group: 'risk' },
    create: { tenantId: scenario.tenantA.id, key: 'default_penalty_per_day', value: '10', group: 'risk' },
  });

  await expireCronLocks(['penalty_accrual']);
  const first = await cronGet<any>({ importPath: routes.cronAccruePenalties, path: '/api/cron/accrue-penalties' });
  assert.equal(first.status, 200, first.text);
  const firstCount = await getPrisma().penalty.count({ where: { loanId: penaltyLoanId } });

  await expireCronLocks(['penalty_accrual']);
  const second = await cronGet<any>({ importPath: routes.cronAccruePenalties, path: '/api/cron/accrue-penalties' });
  assert.equal(second.status, 200, second.text);
  const secondCount = await getPrisma().penalty.count({ where: { loanId: penaltyLoanId } });
  assert.equal(secondCount, firstCount, 'penalty cron second run should not create duplicate penalty rows');
});

test('CRON-003/CRON-004 NPA classification cron runs twice without duplicate history', async () => {
  const loan = await createLoan('cron-npa', 4202);
  npaLoanId = loan.id;
  await makeFirstInstalmentsOverdue(loan.id, 100, 1);

  await expireCronLocks(['npa_classification']);
  const first = await cronGet<any>({ importPath: routes.cronNpaClassify, path: '/api/cron/npa-classify' });
  assert.equal(first.status, 200, first.text);
  const firstHistory = await getPrisma().npaHistory.count({ where: { loanId: npaLoanId } });
  assert.equal(firstHistory >= 1, true, 'first NPA cron should create transition history');

  await expireCronLocks(['npa_classification']);
  const second = await cronGet<any>({ importPath: routes.cronNpaClassify, path: '/api/cron/npa-classify' });
  assert.equal(second.status, 200, second.text);
  const secondHistory = await getPrisma().npaHistory.count({ where: { loanId: npaLoanId } });
  assert.equal(secondHistory, firstHistory, 'second NPA cron should not duplicate unchanged history');
});

test('CRON-007/CRON-008/CRON-010 report, subscription, and balance cron routes run with valid secret', async () => {
  const report = await cronGet<any>({ importPath: routes.cronReports, path: '/api/cron/reports' });
  assert.equal(report.status, 200, report.text);

  const subscription = await cronGet<any>({ importPath: routes.cronSubscriptionReminders, path: '/api/cron/subscription-reminders' });
  assert.equal(subscription.status, 200, subscription.text);

  const recompute = await cronGet<any>({ importPath: routes.cronRecomputeBalances, path: '/api/cron/recompute-balances' });
  assert.equal(recompute.status, 200, recompute.text);
});

test('CRON-009 GPS purge removes only eligible old RUN_ID data and is idempotent', async () => {
  await getPrisma().appSetting.upsert({
    where: { tenantId_key: { tenantId: scenario.tenantA.id, key: 'gps_retention_days' } },
    update: { value: '1', group: 'gps' },
    create: { tenantId: scenario.tenantA.id, key: 'gps_retention_days', value: '1', group: 'gps' },
  });
  const oldDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const recentDate = new Date();
  await getPrisma().agentLocationPing.createMany({
    data: [
      { tenantId: scenario.tenantA.id, agentId: scenario.users.agentA1.id, routeId: scenario.routeA1.id, lat: 13, lng: 80, capturedAt: oldDate, isOnDuty: true },
      { tenantId: scenario.tenantA.id, agentId: scenario.users.agentA1.id, routeId: scenario.routeA1.id, lat: 13.1, lng: 80.1, capturedAt: recentDate, isOnDuty: true },
    ],
  });

  await expireCronLocks(['gps_purge']);
  const first = await cronGet<any>({ importPath: routes.cronGpsPurge, path: '/api/cron/gps-purge' });
  assert.equal(first.status, 200, first.text);
  const afterFirst = await getPrisma().agentLocationPing.count({ where: { tenantId: scenario.tenantA.id } });
  assert.equal(afterFirst, 1, 'GPS purge should keep recent ping only');

  await expireCronLocks(['gps_purge']);
  const second = await cronGet<any>({ importPath: routes.cronGpsPurge, path: '/api/cron/gps-purge' });
  assert.equal(second.status, 200, second.text);
  const afterSecond = await getPrisma().agentLocationPing.count({ where: { tenantId: scenario.tenantA.id } });
  assert.equal(afterSecond, afterFirst, 'GPS purge second run should have no additional RUN_ID side effects');
});

knownGap(
  'CRON-005/CRON-006 reminder cron should dedupe notifications for the same event',
  knownGapCatalog.reminderCronDuplicateNotifications,
  async () => {
    const source = readFileSync(path.join(process.cwd(), 'app', 'api', 'cron', 'send-reminders', 'route.ts'), 'utf8');
    assert.match(source, /notificationLog\.findFirst|idempotency|dedupe/i, 'reminder cron should visibly dedupe per event/entity/date before notify');
  },
);

knownGap(
  'CRON-NACH provider route should be covered by a sandbox provider harness',
  knownGapCatalog.providerOnlyLiveRoute,
  async () => {
    const source = readFileSync(path.join(process.cwd(), 'lib', 'nach.ts'), 'utf8');
    assert.equal(source.includes('https://api.razorpay.com/v1'), false, 'NACH present route should not call live Razorpay without sandbox mocking');
  },
);

async function main() {
  const runId = getRunId();
  try {
    scenario = await seedZoloFundScenario(runId);
    adminToken = await issueMobileTokenForSetup(scenario.users.adminA1);
    assert.ok(adminToken);
    const summary = await run();
    writeKnownGapsReport({
      runId,
      source: 'tests/e2e-business/cronJobsIdempotency.test.ts',
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
