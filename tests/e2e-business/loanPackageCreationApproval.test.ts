import assert from 'node:assert/strict';
import {
  routeRequest,
  expectOk,
  expectError,
  routes,
  type Envelope,
} from './helpers/apiClient';
import { loginMobile } from './helpers/authTokens';
import { assertInstalmentSum, assertMoneyEqual, money } from './helpers/assertMoney';
import { cleanupRunData } from './helpers/cleanup';
import { skip, skipNow, test, run } from './helpers/harness';
import {
  createCustomerFixture,
  seedZoloFundScenario,
  type ZoloFundScenario,
} from './helpers/seedZoloFund';
import { APP_TYPE, disconnectTestDb, getPrisma, getRunId } from './helpers/testDb';

let scenario: ZoloFundScenario;
let adminToken = '';
let agentToken = '';

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

function loanBody(customerId: string, key: string, extra: Record<string, unknown> = {}) {
  return {
    customerId,
    principal: 9000,
    interestRate: 0,
    deduction: 0,
    deductionType: 'upfront_fixed',
    tenure: 9,
    frequency: 'daily',
    startDate: '2026-01-01',
    penaltyRate: 0,
    loanType: 'cheque',
    voucherRef: `${scenario.runId}-V-${key}`,
    ...extra,
  };
}

async function createPendingAgentLoan(key: string, phoneOffset: number) {
  const customer = await createCustomerFixture(scenario, { key: `loan-${key}`, phoneOffset });
  const response = await routeRequest<Envelope<any>>({
    importPath: routes.loans,
    method: 'POST',
    path: '/api/v1/loans',
    token: agentToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body: loanBody(customer.id, key),
  });
  return expectOk<any>(response, `create pending agent loan ${key}`);
}

test('LOAN-001 loan package fixture is visible through actual supported v1 packages route', async () => {
  const response = await routeRequest<Envelope<any[]>>({
    importPath: routes.packages,
    method: 'GET',
    path: '/api/v1/packages',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
  });
  const packages = expectOk(response, 'package list');
  assert.equal(packages.some((pkg) => pkg.id === scenario.packageA.id), true);
});

test('LOAN-003 calculate repayment schedule is deterministic', async () => {
  const response = await routeRequest<Envelope<any>>({
    importPath: routes.loanCalculate,
    method: 'POST',
    path: '/api/v1/loans/calculate',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body: {
      principal: 1001,
      interestType: 'upfront_fixed',
      interestRate: 0,
      tenure: 3,
      frequency: 'daily',
      startDate: '2026-01-01',
    },
  });
  const preview = expectOk<any>(response, 'loan calculate');
  assert.equal(preview.schedule.length, 3);
  assert.deepEqual(preview.schedule.map((row: any) => money(row.dueAmount)), [333, 333, 335]);
  assertInstalmentSum(preview.schedule, 1001, 'calculated schedule sums to total payable');
});

test('LOAN-006 admin creates active loan for approved customer and instalments are generated', async () => {
  const customer = await createCustomerFixture(scenario, { key: 'admin-active-loan', phoneOffset: 301 });
  const response = await routeRequest<Envelope<any>>({
    importPath: routes.loans,
    method: 'POST',
    path: '/api/v1/loans',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body: loanBody(customer.id, 'admin-active'),
  });
  const loan = expectOk<any>(response, 'admin loan create');
  assert.equal(loan.status, 'active');
  assert.equal(loan.instalments.length, 9);

  const dbLoan = await getPrisma().loan.findUnique({
    where: { id: loan.id },
    include: { instalments: { orderBy: { instalmentNo: 'asc' } } },
  });
  assert.equal(dbLoan?.status, 'active');
  assert.equal(dbLoan?.instalments.length, 9);
  assertInstalmentSum(dbLoan?.instalments ?? [], dbLoan?.totalPayable ?? 0, 'DB instalments sum to total payable');
});

test('LOAN-008 agent-created loan goes to pending_review', async () => {
  const loan = await createPendingAgentLoan('agent-pending', 302);
  assert.equal(loan.status, 'pending_review');

  const dbLoan = await getPrisma().loan.findUnique({ where: { id: loan.id } });
  assert.equal(dbLoan?.createdById, scenario.users.agentA1.id);
  assert.equal(dbLoan?.status, 'pending_review');
});

test('LOAN-009 admin approves pending agent loan and audit log exists', async () => {
  const loan = await createPendingAgentLoan('approve', 303);
  const approval = await routeRequest<Envelope<{ status: string }>>({
    importPath: routes.approvalApprove,
    method: 'PATCH',
    path: `/api/v1/approvals/${loan.id}/approve`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: loan.id },
    body: { note: `${scenario.runId} approve loan` },
  });
  assert.equal(expectOk(approval, 'approve loan').status, 'approved');

  const dbLoan = await getPrisma().loan.findUnique({ where: { id: loan.id } });
  assert.equal(dbLoan?.status, 'active');
  const audit = await getPrisma().auditLog.findFirst({
    where: { tenantId: scenario.tenantA.id, entityType: 'loan', entityId: loan.id, action: 'approve' },
  });
  assert.ok(audit);
});

test('LOAN-010 admin rejects pending agent loan', async () => {
  const loan = await createPendingAgentLoan('reject', 304);
  const rejection = await routeRequest<Envelope<{ status: string }>>({
    importPath: routes.approvalReject,
    method: 'PATCH',
    path: `/api/v1/approvals/${loan.id}/reject`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: loan.id },
    body: { note: `${scenario.runId} reject loan` },
  });
  assert.equal(expectOk(rejection, 'reject loan').status, 'rejected');

  const dbLoan = await getPrisma().loan.findUnique({ where: { id: loan.id } });
  assert.equal(dbLoan?.status, 'rejected');
});

test('LOAN-011 loan detail totals match DB and statement route is available when QA schema supports it', async () => {
  const customer = await createCustomerFixture(scenario, { key: 'loan-detail', phoneOffset: 305 });
  const created = await routeRequest<Envelope<any>>({
    importPath: routes.loans,
    method: 'POST',
    path: '/api/v1/loans',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body: loanBody(customer.id, 'detail'),
  });
  const loan = expectOk<any>(created, 'loan for detail totals');

  const detail = await routeRequest<Envelope<any>>({
    importPath: routes.loanById,
    method: 'GET',
    path: `/api/v1/loans/${loan.id}`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: loan.id },
  });
  const apiLoan = expectOk<any>(detail, 'loan detail');

  const dbLoan = await getPrisma().loan.findUnique({
    where: { id: loan.id },
    include: { instalments: { orderBy: { instalmentNo: 'asc' } } },
  });
  assertMoneyEqual(apiLoan.totalPayable, dbLoan?.totalPayable, 'API totalPayable matches DB');
  assertMoneyEqual(apiLoan.principal, dbLoan?.principal, 'API principal matches DB');
  assertInstalmentSum(dbLoan?.instalments ?? [], dbLoan?.totalPayable ?? 0, 'loan detail DB instalments sum');

  if (!(await columnExists('tenant_subscriptions', 'base_plan_price'))) {
    skipNow('Current QA DB is missing tenant_subscriptions.base_plan_price, and the PDF statement route reads the full TenantSubscription Prisma model.');
  }

  const statement = await routeRequest({
    importPath: routes.loanStatement,
    method: 'GET',
    path: `/api/v1/loans/${loan.id}/statement`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: loan.id },
  });
  assert.equal(statement.status, 200, statement.text);
  assert.equal(statement.headers.get('content-type'), 'application/pdf');
});

test('LOAN-012 instalments route returns generated instalments in order', async () => {
  const customer = await createCustomerFixture(scenario, { key: 'instalments', phoneOffset: 306 });
  const created = await routeRequest<Envelope<any>>({
    importPath: routes.loans,
    method: 'POST',
    path: '/api/v1/loans',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body: loanBody(customer.id, 'instalments', { tenure: 5, principal: 5000 }),
  });
  const loan = expectOk<any>(created, 'loan for instalments route');

  const instalments = await routeRequest<Envelope<any[]>>({
    importPath: routes.loanInstalments,
    method: 'GET',
    path: `/api/v1/loans/${loan.id}/instalments`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: loan.id },
  });
  const rows = expectOk(instalments, 'loan instalments');
  assert.deepEqual(rows.map((row) => row.instalmentNo), [1, 2, 3, 4, 5]);
  assertInstalmentSum(rows, 5000, 'instalments route sums to principal');
});

test('LOAN-013 agent cannot approve own pending loan', async () => {
  const loan = await createPendingAgentLoan('self-approve', 307);
  const approval = await routeRequest<Envelope<unknown>>({
    importPath: routes.approvalApprove,
    method: 'PATCH',
    path: `/api/v1/approvals/${loan.id}/approve`,
    token: agentToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: loan.id },
    body: { note: `${scenario.runId} self approve attempt` },
  });
  expectError(approval, [403], 'agent self approval');

  const dbLoan = await getPrisma().loan.findUnique({ where: { id: loan.id } });
  assert.equal(dbLoan?.status, 'pending_review');
});

skip(
  'LOAN-001 create loan package through API',
  'Current v1 package API supports GET only; /api/packages POST requires web NextAuth session context, which this mobile-token business harness intentionally does not fake.',
);

skip(
  'LOAN-014 restricted loan edits after approval',
  'Current v1 loan PATCH creates approval requests and PUT allows admin edits until financial activity exists; collection/repayment activity is outside Phase 1-2 scope.',
);

async function main() {
  const runId = getRunId();
  try {
    scenario = await seedZoloFundScenario(runId);
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
    await run();
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
