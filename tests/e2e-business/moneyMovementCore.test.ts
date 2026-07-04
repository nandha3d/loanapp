import assert from 'node:assert/strict';
import {
  routeRequest,
  expectOk,
  expectError,
  routes,
  type Envelope,
} from './helpers/apiClient';
import { loginMobile } from './helpers/authTokens';
import { assertMoneyEqual, money } from './helpers/assertMoney';
import { cleanupRunData } from './helpers/cleanup';
import { writeKnownGapsReport } from './helpers/evidenceWriter';
import { knownGap, skipNow, test, run } from './helpers/harness';
import { knownGapCatalog } from './helpers/knownGaps';
import {
  phoneForRun,
  seedLoanTrackScenario,
  type LoanTrackScenario,
} from './helpers/seedLoanTrack';
import { APP_TYPE, disconnectTestDb, getPrisma, getRunId } from './helpers/testDb';

process.env.TZ = 'UTC';

let scenario: LoanTrackScenario;
let adminToken = '';
let agentToken = '';

type MoneyFlowState = {
  customerId: string;
  loanId: string;
  collectionEntryId: string;
  dailyCollectionId: string;
  handoverApprovalId: string;
};

const flow: Partial<MoneyFlowState> = {};

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function routeLookupToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function routeLookupDbDate() {
  return new Date(`${routeLookupToday().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function customerBody(key: string, phoneOffset: number) {
  return {
    name: `${scenario.runId} Money Customer ${key}`,
    phone: phoneForRun(scenario.runId, phoneOffset),
    address: `${scenario.runId} Money Address ${key}`,
    routeId: scenario.routeA1.id,
    preferredCollectionTime: 'morning',
  };
}

function loanBody(customerId: string, key: string) {
  return {
    customerId,
    principal: 10_000,
    interestRate: 0,
    deduction: 0,
    deductionType: 'upfront_fixed',
    tenure: 10,
    frequency: 'daily',
    startDate: localDateString(),
    penaltyRate: 0,
    loanType: 'cheque',
    voucherRef: `${scenario.runId}-MM-V-${key}`,
  };
}

async function setOpeningCash() {
  const prisma = getPrisma();
  await prisma.branchCashAccount.update({
    where: {
      tenantId_appType_branchId: {
        tenantId: scenario.tenantA.id,
        appType: APP_TYPE,
        branchId: scenario.branchA1.id,
      },
    },
    data: { balance: 100_000 },
  });
  await prisma.agentAccount.update({
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

async function branchCash() {
  const account = await getPrisma().branchCashAccount.findUnique({
    where: {
      tenantId_appType_branchId: {
        tenantId: scenario.tenantA.id,
        appType: APP_TYPE,
        branchId: scenario.branchA1.id,
      },
    },
  });
  return money(account?.balance);
}

async function agentCash() {
  const account = await getPrisma().agentAccount.findUnique({
    where: {
      tenantId_appType_agentId: {
        tenantId: scenario.tenantA.id,
        appType: APP_TYPE,
        agentId: scenario.users.agentA1.id,
      },
    },
  });
  return money(account?.balance);
}

async function accountingSummary() {
  const response = await routeRequest<Envelope<any>>({
    importPath: routes.accounting,
    method: 'GET',
    path: '/api/v1/accounting',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
  });
  return expectOk<any>(response, 'accounting summary');
}

async function loanWithInstalments(loanId: string) {
  const loan = await getPrisma().loan.findUnique({
    where: { id: loanId },
    include: { instalments: { orderBy: { instalmentNo: 'asc' } } },
  });
  assert.ok(loan, 'loan exists in DB');
  return loan;
}

async function columnExists(tableName: string, columnName: string) {
  const rows = await getPrisma().$queryRaw<Array<{ column_name: string }>>`
    SELECT COLUMN_NAME AS column_name
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
      AND COLUMN_NAME = ${columnName}
  `;
  return rows.length > 0;
}

async function createAdminCustomerAndLoan(key: string, phoneOffset: number) {
  const customerCreate = await routeRequest<Envelope<any>>({
    importPath: routes.customers,
    method: 'POST',
    path: '/api/v1/customers',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body: customerBody(key, phoneOffset),
  });
  const customer = expectOk<any>(customerCreate, `customer create for ${key}`);
  const createLoan = await routeRequest<Envelope<any>>({
    importPath: routes.loans,
    method: 'POST',
    path: '/api/v1/loans',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body: loanBody(customer.id, key),
  });
  const loan = expectOk<any>(createLoan, `loan create for ${key}`);
  return { customer, loan };
}

test('MM-001 creates tenant, branch, users, customer, package, and opening branch cash', async () => {
  await setOpeningCash();

  const pkg = await getPrisma().loanPackage.findUnique({ where: { id: scenario.packageA.id } });
  assert.ok(pkg);
  assert.equal(pkg.name.startsWith(scenario.runId), true);
  assertMoneyEqual(await branchCash(), 100_000, 'opening branch cash is 100000');
  assertMoneyEqual(await agentCash(), 0, 'opening agent cash is zero');

  const customerCreate = await routeRequest<Envelope<any>>({
    importPath: routes.customers,
    method: 'POST',
    path: '/api/v1/customers',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body: customerBody('core', 801),
  });
  const customer = expectOk<any>(customerCreate, 'money-flow customer create');
  assert.equal(customer.status, 'active');
  assert.equal(customer.name.startsWith(scenario.runId), true);
  flow.customerId = customer.id;
});

test('MM-002 creates active 10000 loan, disburses from branch cash, and writes accounting/audit rows', async () => {
  assert.ok(flow.customerId, 'customer created by MM-001');
  const body = loanBody(flow.customerId, 'core');
  const create = await routeRequest<Envelope<any>>({
    importPath: routes.loans,
    method: 'POST',
    path: '/api/v1/loans',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body,
  });
  const loan = expectOk<any>(create, 'money-flow loan create');
  flow.loanId = loan.id;

  assert.equal(loan.status, 'active');
  assert.equal(loan.instalments.length, 10);
  assertMoneyEqual(loan.principal, 10_000, 'API principal');
  assertMoneyEqual(loan.disbursed, 10_000, 'API disbursed');

  const dbLoan = await loanWithInstalments(loan.id);
  assert.equal(dbLoan.status, 'active');
  assertMoneyEqual(dbLoan.totalPayable, 10_000, 'DB total payable');
  assertMoneyEqual(await branchCash(), 90_000, 'branch cash after branch disbursement');

  const disbursementTx = await getPrisma().walletTransaction.findFirst({
    where: {
      tenantId: scenario.tenantA.id,
      accountKind: 'branch',
      branchId: scenario.branchA1.id,
      type: 'disburse',
      refType: 'loan',
      refId: loan.id,
    },
  });
  assert.ok(disbursementTx, 'branch wallet disbursement transaction exists');
  assertMoneyEqual(disbursementTx.amount, -10_000, 'branch wallet disbursement amount');
  assertMoneyEqual(disbursementTx.balanceAfter, 90_000, 'branch wallet disbursement balance');

  const accountEntry = await getPrisma().accountEntry.findFirst({
    where: {
      tenantId: scenario.tenantA.id,
      appType: APP_TYPE,
      branchId: scenario.branchA1.id,
      type: 'loan_disburse',
      referenceId: loan.id,
    },
  });
  assert.ok(accountEntry, 'loan_disburse account entry exists');
  assertMoneyEqual(accountEntry.amount, 10_000, 'loan_disburse account entry amount');

  const audit = await getPrisma().auditLog.findFirst({
    where: { tenantId: scenario.tenantA.id, action: 'create', entityType: 'loan', entityId: loan.id },
  });
  assert.ok(audit, 'loan create audit log exists');

  const accounting = await accountingSummary();
  assertMoneyEqual(accounting.totalDisbursed, 10_000, 'accounting API total disbursed');
  assertMoneyEqual(accounting.branchCashAvailable, 90_000, 'accounting API branch cash');
  assertMoneyEqual(accounting.loanOutstanding, 10_000, 'accounting API outstanding after disbursement');
});

test('MM-003 duplicate voucher disbursement attempt is blocked without changing branch cash', async () => {
  assert.ok(flow.customerId, 'customer created by MM-001');
  const beforeCash = await branchCash();
  const beforeLoanCount = await getPrisma().loan.count({ where: { tenantId: scenario.tenantA.id } });

  const duplicate = await routeRequest<Envelope<unknown>>({
    importPath: routes.loans,
    method: 'POST',
    path: '/api/v1/loans',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body: loanBody(flow.customerId, 'core'),
  });
  expectError(duplicate, [409], 'duplicate voucher loan create');

  assertMoneyEqual(await branchCash(), beforeCash, 'duplicate voucher did not debit branch cash again');
  const afterLoanCount = await getPrisma().loan.count({ where: { tenantId: scenario.tenantA.id } });
  assert.equal(afterLoanCount, beforeLoanCount, 'duplicate voucher did not create a second loan');
});

test('MM-004 collects 1000 EMI as agent, updates instalment/loan/wallet/receipt/daily report', async () => {
  assert.ok(flow.loanId, 'loan created by MM-002');
  const beforeAgentCash = await agentCash();
  const idempotencyKey = `${scenario.runId}-MM-COLLECT-001`;

  const collect = await routeRequest<Envelope<any>>({
    importPath: routes.collectionCollect,
    method: 'POST',
    path: '/api/v1/collection/collect',
    token: agentToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body: {
      loanId: flow.loanId,
      amount: 1_000,
      paymentMode: 'cash',
      remarks: `${scenario.runId} Phase 3 EMI`,
      idempotencyKey,
    },
  });
  const collected = expectOk<any>(collect, 'agent EMI collection');
  assertMoneyEqual(collected.applied, 1_000, 'collection API applied amount');
  assertMoneyEqual(collected.leftover, 0, 'collection API leftover');
  assert.equal(collected.posted.length, 1, 'one instalment was collected');

  const entry = await getPrisma().collectionEntry.findUnique({
    where: { idempotencyKey: `${idempotencyKey}:${collected.posted[0].instalmentId}` },
  });
  assert.ok(entry, 'collection receipt row exists');
  flow.collectionEntryId = entry.id;
  assertMoneyEqual(entry.receivedAmount, 1_000, 'collection entry received amount');

  const payment = await getPrisma().payment.findFirst({
    where: { tenantId: scenario.tenantA.id, loanId: flow.loanId, amount: 1_000 },
    include: { allocations: true },
  });
  assert.ok(payment, 'payment ledger row exists');
  assert.equal(payment.allocations.length, 1, 'payment allocation row exists');
  assertMoneyEqual(payment.allocations[0].amount, 1_000, 'payment allocation amount');

  const dbLoan = await loanWithInstalments(flow.loanId);
  assertMoneyEqual(dbLoan.totalCollected, 1_000, 'loan totalCollected after EMI');
  assertMoneyEqual(money(dbLoan.totalPayable) - money(dbLoan.totalCollected), 9_000, 'loan balance after EMI');
  assert.equal(dbLoan.instalments[0].status, 'paid');
  assertMoneyEqual(dbLoan.instalments[0].receivedAmount, 1_000, 'first instalment paid amount');

  assertMoneyEqual(await agentCash(), beforeAgentCash + 1_000, 'agent wallet increased by EMI cash');
  const collectionTx = await getPrisma().walletTransaction.findFirst({
    where: {
      tenantId: scenario.tenantA.id,
      accountKind: 'agent',
      agentId: scenario.users.agentA1.id,
      type: 'collection',
      refType: 'collection_entry',
      refId: entry.id,
    },
  });
  assert.ok(collectionTx, 'agent collection wallet transaction exists');
  assertMoneyEqual(collectionTx.amount, 1_000, 'agent collection wallet amount');

  const daily = await getPrisma().dailyCollection.findUnique({
    where: {
      id: entry.collectionId,
    },
  });
  assert.ok(daily, 'daily collection rollup exists');
  flow.dailyCollectionId = daily.id;
  assertMoneyEqual(daily.totalCollected, 1_000, 'daily collection DB total');
  await getPrisma().dailyCollection.update({
    where: { id: daily.id },
    data: { date: routeLookupDbDate() },
  });

  const dailyReport = await routeRequest<Envelope<any>>({
    importPath: routes.dailyReport,
    method: 'GET',
    path: `/api/v1/reports/daily?date=${localDateString(routeLookupToday())}`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
  });
  const dailyPayload = expectOk<any>(dailyReport, 'daily collection API report');
  assertMoneyEqual(dailyPayload.totalCollected, 1_000, 'daily report API total collected');
  assert.equal(dailyPayload.entryCount, 1, 'daily report API entry count');

  const receipt = await routeRequest({
    importPath: routes.receipt,
    method: 'GET',
    path: `/api/v1/receipts/${entry.id}`,
    token: agentToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { entryId: entry.id },
  });
  assert.equal(receipt.status, 200, receipt.text);
  assert.equal(receipt.headers.get('content-type'), 'application/pdf');

  const accounting = await accountingSummary();
  assertMoneyEqual(accounting.loanOutstanding, 9_000, 'accounting API outstanding after EMI');
  assertMoneyEqual(accounting.agentFloat, 1_000, 'accounting API agent float after EMI');
  assertMoneyEqual(accounting.branchCashAvailable, 90_000, 'accounting API branch cash after EMI');
});

test('MM-006 creates handover request, approves it, and verifies wallet settlement through existing service path', async () => {
  assert.ok(flow.dailyCollectionId, 'daily collection created by MM-004');
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
    where: {
      tenantId: scenario.tenantA.id,
      appType: APP_TYPE,
      requestType: 'cash_handover',
      entityType: 'daily_collection',
      entityId: flow.dailyCollectionId,
      status: 'pending',
    },
  });
  assert.ok(approval, 'handover approval request exists');
  flow.handoverApprovalId = approval.id;

  const approve = await routeRequest<Envelope<{ status: string }>>({
    importPath: routes.approvalApprove,
    method: 'PATCH',
    path: `/api/v1/approvals/${approval.id}/approve`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: approval.id },
    body: { note: `${scenario.runId} approve handover` },
  });
  assert.equal(expectOk(approve, 'approve handover').status, 'approved');

  const settledDaily = await getPrisma().dailyCollection.findUnique({ where: { id: flow.dailyCollectionId } });
  assert.equal(settledDaily?.status, 'settled');

  const beforeServiceAgentCash = await agentCash();
  const beforeServiceBranchCash = await branchCash();
  assertMoneyEqual(beforeServiceAgentCash, 1_000, 'agent cash before handover service settlement');
  assertMoneyEqual(beforeServiceBranchCash, 90_000, 'branch cash before handover service settlement');

  const { collectFromAgent } = await import('../../lib/wallet');
  const settlement = await collectFromAgent({
    tenantId: scenario.tenantA.id,
    appType: APP_TYPE,
    agentId: scenario.users.agentA1.id,
    branchId: scenario.branchA1.id,
    amount: 1_000,
    byUserId: scenario.users.adminA1.id,
    note: `${scenario.runId} approved handover settlement`,
  });
  assertMoneyEqual(settlement.agentBalance, 0, 'service settlement returns zero agent balance');
  assertMoneyEqual(settlement.branchBalance, 91_000, 'service settlement returns branch balance with handover');
  assertMoneyEqual(await agentCash(), 0, 'agent wallet reduced after handover');
  assertMoneyEqual(await branchCash(), 91_000, 'branch cash increased after handover');

  const agentDepositTx = await getPrisma().walletTransaction.findFirst({
    where: {
      tenantId: scenario.tenantA.id,
      accountKind: 'agent',
      agentId: scenario.users.agentA1.id,
      type: 'deposit',
      refType: 'handover',
    },
  });
  assert.ok(agentDepositTx, 'agent handover wallet transaction exists');
  assertMoneyEqual(agentDepositTx.amount, -1_000, 'agent handover wallet amount');

  const branchDepositTx = await getPrisma().walletTransaction.findFirst({
    where: {
      tenantId: scenario.tenantA.id,
      accountKind: 'branch',
      branchId: scenario.branchA1.id,
      type: 'deposit',
      refType: 'agent',
      refId: scenario.users.agentA1.id,
    },
  });
  assert.ok(branchDepositTx, 'branch handover wallet transaction exists');
  assertMoneyEqual(branchDepositTx.amount, 1_000, 'branch handover wallet amount');
});

test('MM-007 cash/accounting reports and loan statement match DB after money movement', async () => {
  assert.ok(flow.loanId, 'loan created by MM-002');
  const loan = await loanWithInstalments(flow.loanId);
  const outstanding = money(loan.totalPayable) - money(loan.totalCollected);

  const accounting = await accountingSummary();
  assertMoneyEqual(accounting.branchCashAvailable, await branchCash(), 'accounting API branch cash matches DB');
  assertMoneyEqual(accounting.agentFloat, await agentCash(), 'accounting API agent float matches DB');
  assertMoneyEqual(accounting.loanOutstanding, outstanding, 'accounting API outstanding matches DB');

  const { buildDailyCollection } = await import('../../lib/reports/builders/daily-collection');
  const dailyReport = await buildDailyCollection({
    tenantId: scenario.tenantA.id,
    appType: APP_TYPE,
    from: localDateString(),
    to: localDateString(),
    branchId: scenario.branchA1.id,
    agentId: scenario.users.agentA1.id,
  });
  assertMoneyEqual(dailyReport.totals.receivedAmount, 1_000, 'daily collection report builder total matches DB');
  assert.equal(dailyReport.rows.length, 1, 'daily collection report builder entry count');

  const { buildCashBook } = await import('../../lib/reports/builders/cash-book');
  const cashBook = await buildCashBook({
    tenantId: scenario.tenantA.id,
    appType: APP_TYPE,
    from: localDateString(),
    to: localDateString(),
    branchId: scenario.branchA1.id,
  });
  const journalLines = await getPrisma().journalLine.findMany({
    where: {
      account: { tenantId: scenario.tenantA.id, isCash: true },
      entry: {
        tenantId: scenario.tenantA.id,
        branchId: scenario.branchA1.id,
        entryDate: {
          gte: new Date(`${localDateString()}T00:00:00.000Z`),
          lte: new Date(`${localDateString()}T23:59:59.999Z`),
        },
      },
    },
  });
  const dbCashReceipts = journalLines.reduce((sum, line) => sum + money(line.debit), 0);
  const dbCashPayments = journalLines.reduce((sum, line) => sum + money(line.credit), 0);
  assertMoneyEqual(cashBook.totals.receipt, dbCashReceipts, 'cash book receipts match journal DB');
  assertMoneyEqual(cashBook.totals.payment, dbCashPayments, 'cash book payments match journal DB');

  const detail = await routeRequest<Envelope<any>>({
    importPath: routes.loanById,
    method: 'GET',
    path: `/api/v1/loans/${flow.loanId}`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: flow.loanId },
  });
  const apiLoan = expectOk<any>(detail, 'loan detail after money movement');
  assertMoneyEqual(apiLoan.totalCollected, loan.totalCollected, 'loan detail API totalCollected matches DB');
  assertMoneyEqual(money(apiLoan.totalPayable) - money(apiLoan.totalCollected), outstanding, 'loan detail API outstanding matches DB');

  if (!(await columnExists('tenant_subscriptions', 'base_plan_price'))) {
    skipNow('Current QA DB is missing tenant_subscriptions.base_plan_price, and the PDF statement route reads the full TenantSubscription Prisma model.');
  }
  const statement = await routeRequest({
    importPath: routes.loanStatement,
    method: 'GET',
    path: `/api/v1/loans/${flow.loanId}/statement`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: flow.loanId },
  });
  assert.equal(statement.status, 200, statement.text);
  assert.equal(statement.headers.get('content-type'), 'application/pdf');
});

test('MM-008 duplicate handover approval/request attempts do not double-count cash', async () => {
  assert.ok(flow.handoverApprovalId, 'handover approval created by MM-006');
  const beforeAgentCash = await agentCash();
  const beforeBranchCash = await branchCash();
  const beforeDepositCount = await getPrisma().walletTransaction.count({
    where: { tenantId: scenario.tenantA.id, type: 'deposit' },
  });

  const duplicateApproval = await routeRequest<Envelope<unknown>>({
    importPath: routes.approvalApprove,
    method: 'PATCH',
    path: `/api/v1/approvals/${flow.handoverApprovalId}/approve`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: flow.handoverApprovalId },
    body: { note: `${scenario.runId} duplicate handover approval` },
  });
  expectError(duplicateApproval, [404], 'duplicate handover approval');

  const duplicateRequest = await routeRequest<Envelope<unknown>>({
    importPath: routes.collectionHandover,
    method: 'POST',
    path: '/api/v1/collection/handover',
    token: agentToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
  });
  expectError(duplicateRequest, [400], 'duplicate handover request');

  assertMoneyEqual(await agentCash(), beforeAgentCash, 'duplicate handover did not change agent cash');
  assertMoneyEqual(await branchCash(), beforeBranchCash, 'duplicate handover did not change branch cash');
  const afterDepositCount = await getPrisma().walletTransaction.count({
    where: { tenantId: scenario.tenantA.id, type: 'deposit' },
  });
  assert.equal(afterDepositCount, beforeDepositCount, 'duplicate handover did not create more deposit transactions');
});

knownGap(
  'branch-cash loans should support separate approval before money moves',
  knownGapCatalog.separateLoanApprovalBeforeDisbursement,
  async () => {
    const beforeCash = await branchCash();
    const { loan } = await createAdminCustomerAndLoan('gap-approval-before-money', 901);
    const afterCash = await branchCash();
    assert.equal(loan.status, 'pending_review', 'loan should wait for approval before branch cash disbursement');
    assertMoneyEqual(afterCash, beforeCash, 'branch cash should not move until approval');
  },
);

knownGap(
  'collection dashboard should use the same business date as collection report, handover, and DB rollup',
  knownGapCatalog.dashboardBusinessDayMismatch,
  async () => {
    assert.ok(flow.dailyCollectionId, 'main flow daily collection exists');
    const dbDaily = await getPrisma().dailyCollection.findUnique({ where: { id: flow.dailyCollectionId } });
    assert.ok(dbDaily, 'DB daily collection exists');
    const report = await routeRequest<Envelope<any>>({
      importPath: routes.dailyReport,
      method: 'GET',
      path: `/api/v1/reports/daily?date=${localDateString(routeLookupToday())}`,
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
    assert.equal(
      money(dashboardData.dailyCollection?.totalCollected ?? 0),
      money(dbDaily.totalCollected),
      'dashboard should match DB daily total',
    );
  },
);

knownGap(
  'handover approval route should settle wallet balances without a separate service call',
  knownGapCatalog.handoverApprovalDoesNotSettleWallet,
  async () => {
    const adminA2 = (await loginMobile({
      username: scenario.users.adminA2.username,
      password: scenario.password,
      tenantSlug: scenario.tenantA.slug,
    })).token;
    const agentA2 = (await loginMobile({
      username: scenario.users.agentA2.username,
      password: scenario.password,
      tenantSlug: scenario.tenantA.slug,
    })).token;
    await getPrisma().branchCashAccount.update({
      where: {
        tenantId_appType_branchId: {
          tenantId: scenario.tenantA.id,
          appType: APP_TYPE,
          branchId: scenario.branchA2.id,
        },
      },
      data: { balance: 100_000 },
    });
    await getPrisma().agentAccount.update({
      where: {
        tenantId_appType_agentId: {
          tenantId: scenario.tenantA.id,
          appType: APP_TYPE,
          agentId: scenario.users.agentA2.id,
        },
      },
      data: { balance: 0 },
    });

    const customer = await routeRequest<Envelope<any>>({
      importPath: routes.customers,
      method: 'POST',
      path: '/api/v1/customers',
      token: adminA2,
      tenantSlug: scenario.tenantA.slug,
      branchId: scenario.branchA2.id,
      appType: APP_TYPE,
      body: { ...customerBody('gap-handover', 902), routeId: scenario.routeA2.id },
    });
    const customerData = expectOk<any>(customer, 'known-gap handover customer');
    const loan = await routeRequest<Envelope<any>>({
      importPath: routes.loans,
      method: 'POST',
      path: '/api/v1/loans',
      token: adminA2,
      tenantSlug: scenario.tenantA.slug,
      branchId: scenario.branchA2.id,
      appType: APP_TYPE,
      body: loanBody(customerData.id, 'gap-handover'),
    });
    const loanData = expectOk<any>(loan, 'known-gap handover loan');
    const collectKey = `${scenario.runId}-MM-GAP-HANDOVER-COLLECT`;
    const collect = await routeRequest<Envelope<any>>({
      importPath: routes.collectionCollect,
      method: 'POST',
      path: '/api/v1/collection/collect',
      token: agentA2,
      tenantSlug: scenario.tenantA.slug,
      branchId: scenario.branchA2.id,
      appType: APP_TYPE,
      body: { loanId: loanData.id, amount: 1_000, paymentMode: 'cash', idempotencyKey: collectKey },
    });
    expectOk<any>(collect, 'known-gap handover collection');
    const entry = await getPrisma().collectionEntry.findFirst({
      where: { loanId: loanData.id, idempotencyKey: { startsWith: collectKey } },
    });
    assert.ok(entry, 'known-gap handover entry exists');
    await getPrisma().dailyCollection.update({
      where: { id: entry.collectionId },
      data: { date: routeLookupDbDate(), status: 'open' },
    });

    const request = await routeRequest<Envelope<{ success: boolean }>>({
      importPath: routes.collectionHandover,
      method: 'POST',
      path: '/api/v1/collection/handover',
      token: agentA2,
      tenantSlug: scenario.tenantA.slug,
      branchId: scenario.branchA2.id,
      appType: APP_TYPE,
    });
    assert.equal(expectOk(request, 'known-gap handover request').success, true);
    const approval = await getPrisma().approvalRequest.findFirst({
      where: { tenantId: scenario.tenantA.id, entityId: entry.collectionId, requestType: 'cash_handover', status: 'pending' },
    });
    assert.ok(approval, 'known-gap handover approval request exists');
    const beforeAgentCash = money((await getPrisma().agentAccount.findUnique({
      where: { tenantId_appType_agentId: { tenantId: scenario.tenantA.id, appType: APP_TYPE, agentId: scenario.users.agentA2.id } },
    }))?.balance);
    const beforeBranchCash = money((await getPrisma().branchCashAccount.findUnique({
      where: { tenantId_appType_branchId: { tenantId: scenario.tenantA.id, appType: APP_TYPE, branchId: scenario.branchA2.id } },
    }))?.balance);
    const approve = await routeRequest<Envelope<{ status: string }>>({
      importPath: routes.approvalApprove,
      method: 'PATCH',
      path: `/api/v1/approvals/${approval.id}/approve`,
      token: adminA2,
      tenantSlug: scenario.tenantA.slug,
      branchId: scenario.branchA2.id,
      appType: APP_TYPE,
      params: { id: approval.id },
      body: { note: `${scenario.runId} known-gap handover approval` },
    });
    assert.equal(expectOk(approve, 'known-gap approve handover').status, 'approved');
    const afterAgentCash = money((await getPrisma().agentAccount.findUnique({
      where: { tenantId_appType_agentId: { tenantId: scenario.tenantA.id, appType: APP_TYPE, agentId: scenario.users.agentA2.id } },
    }))?.balance);
    const afterBranchCash = money((await getPrisma().branchCashAccount.findUnique({
      where: { tenantId_appType_branchId: { tenantId: scenario.tenantA.id, appType: APP_TYPE, branchId: scenario.branchA2.id } },
    }))?.balance);
    assert.equal(afterAgentCash, beforeAgentCash - 1_000, 'approval should reduce agent cash');
    assert.equal(afterBranchCash, beforeBranchCash + 1_000, 'approval should increase branch cash');
  },
);

knownGap(
  'duplicate loan-level collection replay should be idempotent and not double-count money',
  knownGapCatalog.duplicateCollectionReplayDoubleCounts,
  async () => {
    const { loan } = await createAdminCustomerAndLoan('gap-duplicate-collection', 903);
    const collectKey = `${scenario.runId}-MM-GAP-DUPLICATE-COLLECT`;
    const first = await routeRequest<Envelope<any>>({
      importPath: routes.collectionCollect,
      method: 'POST',
      path: '/api/v1/collection/collect',
      token: agentToken,
      tenantSlug: scenario.tenantA.slug,
      branchId: scenario.branchA1.id,
      appType: APP_TYPE,
      body: { loanId: loan.id, amount: 1_000, paymentMode: 'cash', idempotencyKey: collectKey },
    });
    expectOk<any>(first, 'known-gap first duplicate collection');
    const beforeLoan = await loanWithInstalments(loan.id);
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
      body: { loanId: loan.id, amount: 1_000, paymentMode: 'cash', idempotencyKey: collectKey },
    });
    expectOk<any>(replay, 'known-gap duplicate collection replay');
    const afterLoan = await loanWithInstalments(loan.id);
    const afterEntries = await getPrisma().collectionEntry.count({ where: { loanId: loan.id } });
    const afterPayments = await getPrisma().payment.count({ where: { loanId: loan.id } });
    const afterWalletCredits = await getPrisma().walletTransaction.count({
      where: { tenantId: scenario.tenantA.id, accountKind: 'agent', agentId: scenario.users.agentA1.id, type: 'collection' },
    });
    assert.equal(afterEntries, beforeEntries, 'duplicate replay should not create another receipt row');
    assert.equal(afterPayments, beforePayments, 'duplicate replay should not create another payment ledger row');
    assert.equal(afterWalletCredits, beforeWalletCredits, 'duplicate replay should not create another agent wallet credit');
    assertMoneyEqual(afterLoan.totalCollected, beforeLoan.totalCollected, 'duplicate replay should not change loan collected total');
  },
);

async function main() {
  const runId = getRunId();
  try {
    scenario = await seedLoanTrackScenario(runId);
    adminToken = (await loginMobile({
      username: scenario.users.adminA1.username,
      password: scenario.password,
      tenantSlug: scenario.tenantA.slug,
    })).token;
    agentToken = (await loginMobile({
      username: scenario.users.agentA1.username,
      password: scenario.password,
      tenantSlug: scenario.tenantA.slug,
    })).token;
    const summary = await run();
    writeKnownGapsReport({
      runId,
      source: 'tests/e2e-business/moneyMovementCore.test.ts',
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
