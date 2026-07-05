import assert from 'node:assert/strict';
import {
  routeRequest,
  expectOk,
  type Envelope,
  routes,
} from './helpers/apiClient';
import { issueMobileTokenForSetup } from './helpers/authTokens';
import { assertMoneyEqual, money } from './helpers/assertMoney';
import {
  assertCsvExport,
  assertExcelExport,
  assertPdfExport,
  assertReportTotal,
  sumMoney,
} from './helpers/assertReports';
import { cleanupRunData } from './helpers/cleanup';
import { writeKnownGapsReport } from './helpers/evidenceWriter';
import { knownGap, test, run } from './helpers/harness';
import { knownGapCatalog } from './helpers/knownGaps';
import {
  createCustomerFixture,
  createLoanFixture,
  phoneForRun,
  seedLoanTrackScenario,
  type LoanTrackScenario,
} from './helpers/seedLoanTrack';
import { APP_TYPE, disconnectTestDb, getPrisma, getRunId } from './helpers/testDb';

process.env.TZ = 'UTC';

let scenario: LoanTrackScenario;
let adminToken = '';
let agentToken = '';
let adminA2Token = '';

const fixture: Partial<{
  customerId: string;
  customerName: string;
  loanId: string;
  loanCode: string;
  collectionEntryId: string;
  dailyCollectionId: string;
  otherBranchLoanCode: string;
  tenantBLoanCode: string;
  overdueLoanId: string;
  npaLoanCode: string;
}> = {};

function localDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function wideFromDate() {
  return '2026-01-01';
}

function dbStartOfToday() {
  return new Date(`${localDateString()}T00:00:00.000Z`);
}

function dbEndOfToday() {
  return new Date(`${localDateString()}T23:59:59.999Z`);
}

function loanBody(customerId: string, key: string, principal = 10_000) {
  return {
    customerId,
    principal,
    interestRate: 0,
    deduction: 0,
    deductionType: 'upfront_fixed',
    tenure: 10,
    frequency: 'daily',
    startDate: localDateString(),
    penaltyRate: 0,
    loanType: 'cheque',
    voucherRef: `${scenario.runId}-REP-V-${key}`,
  };
}

async function setCashBalances() {
  await getPrisma().branchCashAccount.update({
    where: {
      tenantId_appType_branchId: {
        tenantId: scenario.tenantA.id,
        appType: APP_TYPE,
        branchId: scenario.branchA1.id,
      },
    },
    data: { balance: 100_000 },
  });
  await getPrisma().agentAccount.update({
    where: {
      tenantId_appType_agentId: {
        tenantId: scenario.tenantA.id,
        appType: APP_TYPE,
        agentId: scenario.users.agentA1.id,
      },
    },
    data: { balance: 0 },
  });
}

async function branchCash(branchId = scenario.branchA1.id) {
  const account = await getPrisma().branchCashAccount.findUnique({
    where: { tenantId_appType_branchId: { tenantId: scenario.tenantA.id, appType: APP_TYPE, branchId } },
  });
  return money(account?.balance);
}

async function agentCash(agentId = scenario.users.agentA1.id) {
  const account = await getPrisma().agentAccount.findUnique({
    where: { tenantId_appType_agentId: { tenantId: scenario.tenantA.id, appType: APP_TYPE, agentId } },
  });
  return money(account?.balance);
}

async function createCustomerViaApi(key: string, phoneOffset: number) {
  const response = await routeRequest<Envelope<any>>({
    importPath: routes.customers,
    method: 'POST',
    path: '/api/v1/customers',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body: {
      name: `${scenario.runId} Report Customer ${key}`,
      phone: phoneForRun(scenario.runId, phoneOffset),
      address: `${scenario.runId} Report Address ${key}`,
      routeId: scenario.routeA1.id,
      preferredCollectionTime: 'morning',
    },
  });
  return expectOk<any>(response, `create customer ${key}`);
}

async function createLoanViaApi(customerId: string, key: string, principal = 10_000) {
  const response = await routeRequest<Envelope<any>>({
    importPath: routes.loans,
    method: 'POST',
    path: '/api/v1/loans',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body: loanBody(customerId, key, principal),
  });
  return expectOk<any>(response, `create loan ${key}`);
}

async function buildDailyCollectionReport(params: Record<string, unknown> = {}) {
  const { buildDailyCollection } = await import('../../lib/reports/builders/daily-collection');
  return buildDailyCollection({
    tenantId: scenario.tenantA.id,
    appType: APP_TYPE,
    from: localDateString(),
    to: localDateString(),
    branchId: scenario.branchA1.id,
    ...params,
  });
}

async function setupReportFixture() {
  await setCashBalances();
  const customer = await createCustomerViaApi('core', 1001);
  fixture.customerId = customer.id;
  fixture.customerName = customer.name;

  const loan = await createLoanViaApi(customer.id, 'core');
  fixture.loanId = loan.id;
  fixture.loanCode = loan.loanCode;

  const loanWithInstalments = await getPrisma().loan.findUnique({
    where: { id: loan.id },
    include: { instalments: { orderBy: { instalmentNo: 'asc' } } },
  });
  assert.ok(loanWithInstalments, 'route-created loan exists in DB');
  const firstInstalment = loanWithInstalments.instalments[0];
  assert.ok(firstInstalment, 'route-created loan has an instalment');
  const daily = await getPrisma().dailyCollection.create({
    data: {
      tenantId: scenario.tenantA.id,
      appType: APP_TYPE,
      agentId: scenario.users.agentA1.id,
      branchId: scenario.branchA1.id,
      routeId: scenario.routeA1.id,
      date: dbStartOfToday(),
      totalExpected: 1000,
      totalCollected: 1000,
      entriesCount: 1,
      status: 'open',
    },
  });
  const entry = await getPrisma().collectionEntry.create({
    data: {
      tenantId: scenario.tenantA.id,
      collectionId: daily.id,
      customerId: customer.id,
      loanId: loan.id,
      dueAmount: 1000,
      receivedAmount: 1000,
      paymentMode: 'cash',
      remarks: `${scenario.runId} report EMI`,
      agentId: scenario.users.agentA1.id,
      submittedAt: new Date(),
      idempotencyKey: `${scenario.runId}-REP-COLLECT-001:${firstInstalment.id}`,
      verificationStatus: 'pending',
    },
  });
  await getPrisma().instalment.update({
    where: { id: firstInstalment.id },
    data: { receivedAmount: 1000, receivedAt: new Date(), status: 'paid' },
  });
  await getPrisma().loan.update({
    where: { id: loan.id },
    data: { totalCollected: 1000, paidCount: 1 },
  });
  await getPrisma().agentAccount.update({
    where: {
      tenantId_appType_agentId: {
        tenantId: scenario.tenantA.id,
        appType: APP_TYPE,
        agentId: scenario.users.agentA1.id,
      },
    },
    data: { balance: 1000 },
  });
  await getPrisma().walletTransaction.create({
    data: {
      tenantId: scenario.tenantA.id,
      appType: APP_TYPE,
      accountKind: 'agent',
      agentId: scenario.users.agentA1.id,
      type: 'collection',
      amount: 1000,
      balanceAfter: 1000,
      refType: 'collection_entry',
      refId: entry.id,
      createdById: scenario.users.agentA1.id,
    },
  });
  fixture.collectionEntryId = entry.id;
  fixture.dailyCollectionId = entry.collectionId;

  const otherBranchCustomer = await createCustomerFixture(scenario, {
    key: 'rep-other-branch',
    branchId: scenario.branchA2.id,
    routeId: scenario.routeA2.id,
    agentId: scenario.users.agentA2.id,
    phoneOffset: 1002,
  });
  const otherBranchLoan = await createLoanFixture(scenario, {
    key: 'rep-other-branch',
    customerId: otherBranchCustomer.id,
    branchId: scenario.branchA2.id,
    createdById: scenario.users.adminA2.id,
    principal: 5000,
  });
  fixture.otherBranchLoanCode = otherBranchLoan.loanCode;

  const tenantBCustomer = await createCustomerFixture(scenario, {
    key: 'rep-tenant-b',
    tenantId: scenario.tenantB.id,
    branchId: scenario.branchB1.id,
    routeId: scenario.routeB1.id,
    agentId: scenario.users.agentB1.id,
    phoneOffset: 1003,
  });
  const tenantBLoan = await createLoanFixture(scenario, {
    key: 'rep-tenant-b',
    tenantId: scenario.tenantB.id,
    customerId: tenantBCustomer.id,
    branchId: scenario.branchB1.id,
    createdById: scenario.users.adminB1.id,
    principal: 7000,
  });
  fixture.tenantBLoanCode = tenantBLoan.loanCode;

  for (const status of ['pending_review', 'rejected', 'closed']) {
    const customerForStatus = await createCustomerFixture(scenario, {
      key: `rep-${status}`,
      phoneOffset: status === 'pending_review' ? 1004 : status === 'rejected' ? 1005 : 1006,
    });
    await createLoanFixture(scenario, {
      key: `rep-${status}`,
      customerId: customerForStatus.id,
      status,
      principal: status === 'closed' ? 3000 : 4000,
    });
  }

  const overdueCustomer = await createCustomerFixture(scenario, { key: 'rep-overdue', phoneOffset: 1007 });
  const overdueLoan = await createLoanFixture(scenario, {
    key: 'rep-overdue',
    customerId: overdueCustomer.id,
    status: 'overdue',
    principal: 6000,
  });
  await getPrisma().instalment.update({
    where: { id: overdueLoan.instalments[0].id },
    data: {
      dueDate: new Date(Date.now() - 3 * 86400000),
      status: 'missed',
    },
  });
  fixture.overdueLoanId = overdueLoan.id;

  const npaCustomer = await createCustomerFixture(scenario, { key: 'rep-npa', phoneOffset: 1008 });
  const npaLoan = await createLoanFixture(scenario, {
    key: 'rep-npa',
    customerId: npaCustomer.id,
    status: 'overdue',
    principal: 8000,
  });
  await getPrisma().loan.update({
    where: { id: npaLoan.id },
    data: {
      npaStatus: 'substandard',
      npaDaysOverdue: 95,
      provisioningCategory: 'substandard',
      provisioningRate: 15,
      provisioningAmount: 1200,
    },
  });
  fixture.npaLoanCode = npaLoan.loanCode;
}

test('REP-001 daily collection report API and builder totals match DB', async () => {
  assert.ok(fixture.collectionEntryId, 'fixture collection exists');
  const dbEntries = await getPrisma().collectionEntry.findMany({
    where: {
      tenantId: scenario.tenantA.id,
      collection: { branchId: scenario.branchA1.id },
      submittedAt: { gte: dbStartOfToday(), lte: dbEndOfToday() },
    },
  });
  const dbCollected = sumMoney(dbEntries, (entry) => entry.receivedAmount);
  const dbDue = sumMoney(dbEntries, (entry) => entry.dueAmount);

  const api = await routeRequest<Envelope<any>>({
    importPath: routes.dailyReport,
    method: 'GET',
    path: `/api/v1/reports/daily?date=${localDateString()}`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
  });
  const apiData = expectOk<any>(api, 'daily report API');
  assertMoneyEqual(apiData.totalCollected, dbCollected, 'daily report API totalCollected matches DB');
  assertMoneyEqual(apiData.totalExpected, dbDue, 'daily report API totalExpected matches DB');
  assert.equal(apiData.entryCount, dbEntries.length);

  const report = await buildDailyCollectionReport();
  assertReportTotal(report, 'receivedAmount', dbCollected, 'daily collection builder receivedAmount');
  assertReportTotal(report, 'dueAmount', dbDue, 'daily collection builder dueAmount');
});

test('REP-002 agent-wise collection report matches DB and agent filter', async () => {
  const dbDaily = await getPrisma().dailyCollection.findMany({
    where: {
      tenantId: scenario.tenantA.id,
      appType: APP_TYPE,
      branchId: scenario.branchA1.id,
      agentId: scenario.users.agentA1.id,
      date: { gte: dbStartOfToday(), lte: dbEndOfToday() },
    },
  });
  const dbCollected = sumMoney(dbDaily, (row) => row.totalCollected);

  const api = await routeRequest<Envelope<any>>({
    importPath: routes.agentReport,
    method: 'GET',
    path: `/api/v1/reports/agent?from=${localDateString()}&to=${localDateString()}&agentId=${scenario.users.agentA1.id}`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
  });
  const data = expectOk<any>(api, 'agent report API');
  assert.equal(data.agents.length, 1);
  assert.equal(data.agents[0].agentId, scenario.users.agentA1.id);
  assertMoneyEqual(data.agents[0].collected, dbCollected, 'agent report API collected matches DB');

  const { buildAgentWiseCollection } = await import('../../lib/reports/builders/agent-wise-collection');
  const report = await buildAgentWiseCollection({
    tenantId: scenario.tenantA.id,
    appType: APP_TYPE,
    from: localDateString(),
    to: localDateString(),
    branchId: scenario.branchA1.id,
    agentId: scenario.users.agentA1.id,
  });
  assertReportTotal(report, 'collected', dbCollected, 'agent-wise builder collected');
});

test('REP-003/REP-004 loan register and outstanding reports match DB totals and statuses', async () => {
  const { buildLoanRegister } = await import('../../lib/reports/builders/loan-register');
  const loanRegister = await buildLoanRegister({
    tenantId: scenario.tenantA.id,
    appType: APP_TYPE,
    from: wideFromDate(),
    to: localDateString(),
    branchId: scenario.branchA1.id,
  });
  const dbLoans = await getPrisma().loan.findMany({
    where: {
      tenantId: scenario.tenantA.id,
      appType: APP_TYPE,
      branchId: scenario.branchA1.id,
      startDate: { gte: new Date(`${wideFromDate()}T00:00:00.000Z`), lte: dbEndOfToday() },
    },
  });
  assert.equal(loanRegister.rows.length, dbLoans.length);
  assertReportTotal(loanRegister, 'principal', sumMoney(dbLoans, (loan) => loan.principal), 'loan register principal');
  assertReportTotal(loanRegister, 'outstanding', dbLoans.reduce((sum, loan) => sum + Math.max(0, money(loan.totalPayable) - money(loan.totalCollected)), 0), 'loan register outstanding');
  for (const status of ['active', 'pending_review', 'rejected', 'closed', 'overdue']) {
    const dbCount = dbLoans.filter((loan) => loan.status === status).length;
    const reportCount = loanRegister.rows.filter((row) => row.status === status).length;
    assert.equal(reportCount, dbCount, `loan register ${status} count`);
  }

  const { buildOutstandingBalance } = await import('../../lib/reports/builders/outstanding-balance');
  const outstanding = await buildOutstandingBalance({
    tenantId: scenario.tenantA.id,
    appType: APP_TYPE,
    from: wideFromDate(),
    to: localDateString(),
    branchId: scenario.branchA1.id,
  });
  const activeLoans = dbLoans.filter((loan) => ['active', 'overdue'].includes(loan.status));
  const dbOutstanding = activeLoans.reduce((sum, loan) => sum + Math.max(0, money(loan.totalPayable) - money(loan.totalCollected)), 0);
  assertReportTotal(outstanding, 'totalOut', dbOutstanding, 'outstanding report totalOut');
});

test('REP-005/REP-006 overdue and NPA reports use actual current-code routes/builders', async () => {
  assert.ok(fixture.overdueLoanId, 'overdue fixture loan exists');
  const overdueApi = await routeRequest<Envelope<Array<{ loanId: string; overdueAmount: number }>>>({
    importPath: routes.overdueReport,
    method: 'GET',
    path: '/api/v1/reports/overdue?page=1&pageSize=100',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
  });
  const overdueRows = expectOk(overdueApi, 'overdue report API');
  assert.equal(overdueRows.some((row) => row.loanId === fixture.overdueLoanId), true);
  assert.equal(overdueRows.every((row) => row.overdueAmount > 0), true);

  const { buildAging } = await import('../../lib/reports/builders/aging');
  const aging = await buildAging({
    tenantId: scenario.tenantA.id,
    appType: APP_TYPE,
    from: wideFromDate(),
    to: localDateString(),
    branchId: scenario.branchA1.id,
  });
  assert.equal(money(aging.totals?.outstanding) > 0, true, 'aging report should include overdue outstanding');

  const { buildNpaClassificationReport } = await import('../../lib/reports/builders/npa-classification-report');
  const npa = await buildNpaClassificationReport({
    tenantId: scenario.tenantA.id,
    appType: APP_TYPE,
    from: wideFromDate(),
    to: localDateString(),
    branchId: scenario.branchA1.id,
  });
  assert.equal(npa.rows.some((row) => row.loanCode === fixture.npaLoanCode), true);
  assertReportTotal(npa, 'provisioningAmount', 1200, 'NPA provisioning amount');
});

test('REP-007 cash book and accounting summaries reconcile to DB state', async () => {
  const { buildCashBook } = await import('../../lib/reports/builders/cash-book');
  const cashBook = await buildCashBook({
    tenantId: scenario.tenantA.id,
    appType: APP_TYPE,
    from: wideFromDate(),
    to: localDateString(),
    branchId: scenario.branchA1.id,
  });
  const journalLines = await getPrisma().journalLine.findMany({
    where: {
      account: { tenantId: scenario.tenantA.id, isCash: true },
      entry: {
        tenantId: scenario.tenantA.id,
        branchId: scenario.branchA1.id,
        entryDate: { gte: new Date(`${wideFromDate()}T00:00:00.000Z`), lte: dbEndOfToday() },
      },
    },
  });
  assertReportTotal(cashBook, 'receipt', sumMoney(journalLines, (line) => line.debit), 'cash book receipts');
  assertReportTotal(cashBook, 'payment', sumMoney(journalLines, (line) => line.credit), 'cash book payments');

  const accounting = await routeRequest<Envelope<any>>({
    importPath: routes.accounting,
    method: 'GET',
    path: '/api/v1/accounting',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
  });
  const summary = expectOk<any>(accounting, 'accounting API summary');
  assertMoneyEqual(summary.branchCashAvailable, await branchCash(), 'accounting branch cash matches DB');
  assertMoneyEqual(summary.agentFloat, await agentCash(), 'accounting agent float matches DB');
});

test('REP-008/REP-009/REP-010/REP-014/REP-015 report filters enforce branch, agent, date, and tenant scope', async () => {
  const todayReport = await buildDailyCollectionReport();
  assert.equal(todayReport.rows.some((row) => row.customerName === fixture.customerName), true);

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const yesterdayReport = await buildDailyCollectionReport({ from: yesterday, to: yesterday });
  assert.equal(yesterdayReport.rows.some((row) => row.customerName === fixture.customerName), false);

  const { buildLoanRegister } = await import('../../lib/reports/builders/loan-register');
  const branchA1 = await buildLoanRegister({
    tenantId: scenario.tenantA.id,
    appType: APP_TYPE,
    from: wideFromDate(),
    to: localDateString(),
    branchId: scenario.branchA1.id,
  });
  assert.equal(branchA1.rows.some((row) => row.loanCode === fixture.loanCode), true);
  assert.equal(branchA1.rows.some((row) => row.loanCode === fixture.otherBranchLoanCode), false);
  assert.equal(branchA1.rows.some((row) => row.loanCode === fixture.tenantBLoanCode), false);

  const branchA2 = await buildLoanRegister({
    tenantId: scenario.tenantA.id,
    appType: APP_TYPE,
    from: wideFromDate(),
    to: localDateString(),
    branchId: scenario.branchA2.id,
  });
  assert.equal(branchA2.rows.some((row) => row.loanCode === fixture.otherBranchLoanCode), true);
  assert.equal(branchA2.rows.some((row) => row.loanCode === fixture.loanCode), false);

  const tenantB = await buildLoanRegister({
    tenantId: scenario.tenantB.id,
    appType: APP_TYPE,
    from: wideFromDate(),
    to: localDateString(),
    branchId: scenario.branchB1.id,
  });
  assert.equal(tenantB.rows.some((row) => row.loanCode === fixture.tenantBLoanCode), true);
  assert.equal(tenantB.rows.some((row) => row.loanCode === fixture.loanCode), false);
});

test('REP-011/REP-012/REP-013 CSV, Excel, and PDF export utilities produce downloadable report payloads', async () => {
  const report = await buildDailyCollectionReport();
  const expectedText = String(fixture.customerName);
  assertCsvExport(report, expectedText);
  await assertExcelExport(report, expectedText);
  await assertPdfExport(report, expectedText);
});

knownGap(
  'generic NextAuth-backed report/export routes need a web-session harness',
  knownGapCatalog.genericReportExportNeedsWebSessionHarness,
  async () => {
    const response = await routeRequest({
      importPath: routes.genericReportExport,
      method: 'GET',
      path: `/api/v1/reports/daily-collection/export?from=${localDateString()}&to=${localDateString()}&format=csv`,
      token: adminToken,
      tenantSlug: scenario.tenantA.slug,
      branchId: scenario.branchA1.id,
      appType: APP_TYPE,
      params: { slug: 'daily-collection' },
    });
    assert.equal(response.status, 200, response.text);
    assert.equal(response.headers.get('content-type')?.includes('text/csv'), true);
  },
);

knownGap(
  'collection dashboard should reconcile with report and DB totals for the same business date',
  knownGapCatalog.dashboardBusinessDayMismatch,
  async () => {
    assert.ok(fixture.dailyCollectionId, 'fixture daily collection exists');
    const dbDaily = await getPrisma().dailyCollection.findUnique({ where: { id: fixture.dailyCollectionId } });
    assert.ok(dbDaily, 'DB daily collection exists');
    const report = await routeRequest<Envelope<any>>({
      importPath: routes.dailyReport,
      method: 'GET',
      path: `/api/v1/reports/daily?date=${localDateString()}`,
      token: adminToken,
      tenantSlug: scenario.tenantA.slug,
      branchId: scenario.branchA1.id,
      appType: APP_TYPE,
    });
    const reportData = expectOk<any>(report, 'known-gap daily report');
    const dashboard = await routeRequest<Envelope<any>>({
      importPath: routes.collectionDashboard,
      method: 'GET',
      path: '/api/v1/collection/dashboard',
      token: agentToken,
      tenantSlug: scenario.tenantA.slug,
      branchId: scenario.branchA1.id,
      appType: APP_TYPE,
    });
    const dashboardData = expectOk<any>(dashboard, 'known-gap dashboard');
    assertMoneyEqual(reportData.totalCollected, dbDaily.totalCollected, 'daily report should match DB');
    assertMoneyEqual(dashboardData.dailyCollection?.totalCollected ?? 0, dbDaily.totalCollected, 'dashboard should match DB daily total');
  },
);

knownGap(
  'branch-cash loans should support separate approval before money moves',
  knownGapCatalog.separateLoanApprovalBeforeDisbursement,
  async () => {
    const beforeCash = await branchCash();
    const customer = await createCustomerViaApi('gap-approval-before-money', 1101);
    const loan = await createLoanViaApi(customer.id, 'gap-approval-before-money', 5000);
    assert.equal(loan.status, 'pending_review', 'loan should wait for approval before branch cash disbursement');
    assertMoneyEqual(await branchCash(), beforeCash, 'branch cash should not move until approval');
  },
);

knownGap(
  'handover approval route should settle wallet balances without a separate service call',
  knownGapCatalog.handoverApprovalDoesNotSettleWallet,
  async () => {
    assert.ok(fixture.dailyCollectionId, 'fixture daily collection exists');
    await getPrisma().dailyCollection.update({ where: { id: fixture.dailyCollectionId }, data: { status: 'open' } });
    const request = await routeRequest<Envelope<{ success: boolean }>>({
      importPath: routes.collectionHandover,
      method: 'POST',
      path: '/api/v1/collection/handover',
      token: agentToken,
      tenantSlug: scenario.tenantA.slug,
      branchId: scenario.branchA1.id,
      appType: APP_TYPE,
    });
    assert.equal(expectOk(request, 'handover request').success, true);
    const approval = await getPrisma().approvalRequest.findFirst({
      where: { tenantId: scenario.tenantA.id, entityId: fixture.dailyCollectionId, requestType: 'cash_handover', status: 'pending' },
    });
    assert.ok(approval, 'handover approval exists');
    const beforeAgentCash = await agentCash();
    const beforeBranchCash = await branchCash();
    const approve = await routeRequest<Envelope<{ status: string }>>({
      importPath: routes.approvalApprove,
      method: 'PATCH',
      path: `/api/v1/approvals/${approval.id}/approve`,
      token: adminToken,
      tenantSlug: scenario.tenantA.slug,
      branchId: scenario.branchA1.id,
      appType: APP_TYPE,
      params: { id: approval.id },
      body: { note: `${scenario.runId} report known-gap handover approval` },
    });
    assert.equal(expectOk(approve, 'handover approve').status, 'approved');
    assertMoneyEqual(await agentCash(), beforeAgentCash - 1000, 'approval should reduce agent cash');
    assertMoneyEqual(await branchCash(), beforeBranchCash + 1000, 'approval should increase branch cash');
  },
);

knownGap(
  'duplicate loan-level collection replay should be idempotent and not double-count money',
  knownGapCatalog.duplicateCollectionReplayDoubleCounts,
  async () => {
    const customer = await createCustomerFixture(scenario, {
      key: 'rep-gap-duplicate-collection',
      phoneOffset: 1102,
    });
    const loan = await createLoanFixture(scenario, {
      key: 'rep-gap-duplicate-collection',
      customerId: customer.id,
      principal: 6000,
      tenure: 6,
    });
    const key = `${scenario.runId}-REP-GAP-DUPLICATE-COLLECT`;
    const first = await routeRequest<Envelope<any>>({
      importPath: routes.collectionCollect,
      method: 'POST',
      path: '/api/v1/collection/collect',
      token: agentToken,
      tenantSlug: scenario.tenantA.slug,
      branchId: scenario.branchA1.id,
      appType: APP_TYPE,
      body: { loanId: loan.id, amount: 1000, paymentMode: 'cash', idempotencyKey: key },
    });
    expectOk<any>(first, 'first duplicate collection');
    const beforeLoan = await getPrisma().loan.findUnique({ where: { id: loan.id } });
    const beforeEntries = await getPrisma().collectionEntry.count({ where: { loanId: loan.id } });
    const beforePayments = await getPrisma().payment.count({ where: { loanId: loan.id } });
    const beforeWalletCredits = await getPrisma().walletTransaction.count({
      where: { tenantId: scenario.tenantA.id, accountKind: 'agent', agentId: scenario.users.agentA1.id, type: 'collection' },
    });
    const replay = await routeRequest<Envelope<any>>({
      importPath: routes.collectionCollect,
      method: 'POST',
      path: '/api/v1/collection/collect',
      token: agentToken,
      tenantSlug: scenario.tenantA.slug,
      branchId: scenario.branchA1.id,
      appType: APP_TYPE,
      body: { loanId: loan.id, amount: 1000, paymentMode: 'cash', idempotencyKey: key },
    });
    expectOk<any>(replay, 'duplicate collection replay');
    const afterLoan = await getPrisma().loan.findUnique({ where: { id: loan.id } });
    assert.equal(await getPrisma().collectionEntry.count({ where: { loanId: loan.id } }), beforeEntries, 'duplicate replay should not create another receipt row');
    assert.equal(await getPrisma().payment.count({ where: { loanId: loan.id } }), beforePayments, 'duplicate replay should not create another payment row');
    assert.equal(await getPrisma().walletTransaction.count({
      where: { tenantId: scenario.tenantA.id, accountKind: 'agent', agentId: scenario.users.agentA1.id, type: 'collection' },
    }), beforeWalletCredits, 'duplicate replay should not create another wallet credit');
    assertMoneyEqual(afterLoan?.totalCollected, beforeLoan?.totalCollected, 'duplicate replay should not change loan collected total');
  },
);

async function main() {
  const runId = getRunId();
  try {
    scenario = await seedLoanTrackScenario(runId);
    adminToken = await issueMobileTokenForSetup(scenario.users.adminA1);
    agentToken = await issueMobileTokenForSetup(scenario.users.agentA1);
    adminA2Token = await issueMobileTokenForSetup(scenario.users.adminA2);
    assert.ok(adminA2Token, 'branch A2 admin token is available for fixture setup');
    await setupReportFixture();
    const summary = await run();
    writeKnownGapsReport({
      runId,
      source: 'tests/e2e-business/reportsExports.test.ts',
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
