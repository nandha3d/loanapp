import assert from 'node:assert/strict';
import {
  routeRequest,
  expectOk,
  expectError,
  routes,
  type Envelope,
} from './helpers/apiClient';
import { borrowerLoginAndVerify, loginMobile } from './helpers/authTokens';
import { cleanupRunData } from './helpers/cleanup';
import { skip, test, run } from './helpers/harness';
import {
  createCustomerFixture,
  createLoanFixture,
  seedLoanTrackScenario,
  type LoanTrackScenario,
} from './helpers/seedLoanTrack';
import { APP_TYPE, disconnectTestDb, getPrisma, getRunId } from './helpers/testDb';

let scenario: LoanTrackScenario;
let adminToken = '';
let agentToken = '';

test('AUTH-001 admin login returns token, active user, and tenant slug', async () => {
  const login = await loginMobile({
    username: scenario.users.adminA1.username,
    password: scenario.password,
    tenantSlug: scenario.tenantA.slug,
  });
  adminToken = login.token;
  assert.equal(login.user.role, 'admin');
  assert.equal(login.user.status ?? 'active', 'active');
  assert.equal(login.user.tenantSlug, scenario.tenantA.slug);

  const dbUser = await getPrisma().user.findUnique({ where: { id: login.user.id } });
  assert.equal(dbUser?.tenantId, scenario.tenantA.id);
  assert.equal(dbUser?.status, 'active');
});

test('AUTH-001B admin can log in with email', async () => {
  const login = await loginMobile({
    username: `${scenario.users.adminA1.username}@example.test`,
    password: scenario.password,
    tenantSlug: scenario.tenantA.slug,
  });
  assert.equal(login.user.id, scenario.users.adminA1.id);
  assert.equal(login.user.tenantSlug, scenario.tenantA.slug);
});

test('AUTH-001C admin can log in with phone', async () => {
  const login = await loginMobile({
    username: scenario.users.adminA1.phone,
    password: scenario.password,
    tenantSlug: scenario.tenantA.slug,
  });
  assert.equal(login.user.id, scenario.users.adminA1.id);
  assert.equal(login.user.tenantSlug, scenario.tenantA.slug);
});

test('AUTH-002 agent login returns token and role agent', async () => {
  const login = await loginMobile({
    username: scenario.users.agentA1.username,
    password: scenario.password,
    tenantSlug: scenario.tenantA.slug,
  });
  agentToken = login.token;
  assert.equal(login.user.role, 'agent');
  assert.equal(login.user.branchId, scenario.branchA1.id);
});

test('AUTH-003 invalid login is blocked', async () => {
  const response = await routeRequest<Envelope<unknown>>({
    importPath: routes.authLogin,
    method: 'POST',
    path: '/api/v1/auth/login',
    tenantSlug: scenario.tenantA.slug,
    body: { username: scenario.users.adminA1.username, password: 'wrong-password' },
  });
  expectError(response, [401], 'invalid password');
});

test('AUTH-004 disabled user login is blocked', async () => {
  const response = await routeRequest<Envelope<unknown>>({
    importPath: routes.authLogin,
    method: 'POST',
    path: '/api/v1/auth/login',
    tenantSlug: scenario.tenantA.slug,
    body: { username: scenario.users.disabledA1.username, password: scenario.password },
  });
  expectError(response, [401], 'disabled user login');
});

test('AUTH-005 missing and invalid tokens are blocked on protected APIs', async () => {
  const missing = await routeRequest<Envelope<unknown>>({
    importPath: routes.authMe,
    method: 'GET',
    path: '/api/v1/auth/me',
  });
  expectError(missing, [401], 'missing token');

  const invalid = await routeRequest<Envelope<unknown>>({
    importPath: routes.authMe,
    method: 'GET',
    path: '/api/v1/auth/me',
    token: 'not-a-valid-token',
  });
  expectError(invalid, [401], 'invalid token');
});

test('AUTH-008 agent cannot access admin-only user API', async () => {
  assert.ok(agentToken, 'agent token should be created by AUTH-002');
  const response = await routeRequest<Envelope<unknown>>({
    importPath: routes.adminUsers,
    method: 'GET',
    path: '/api/v1/admin/users',
    token: agentToken,
    tenantSlug: scenario.tenantA.slug,
    appType: APP_TYPE,
  });
  expectError(response, [403], 'agent admin route');
});

test('AUTH-009 branch-scoped admins and agents cannot list another branch customer', async () => {
  assert.ok(adminToken, 'admin token should be created by AUTH-001');
  assert.ok(agentToken, 'agent token should be created by AUTH-002');

  const customerA1 = await createCustomerFixture(scenario, { key: 'auth-a1', phoneOffset: 101 });
  const customerA2 = await createCustomerFixture(scenario, {
    key: 'auth-a2',
    branchId: scenario.branchA2.id,
    routeId: scenario.routeA2.id,
    agentId: scenario.users.agentA2.id,
    phoneOffset: 102,
  });

  const adminList = await routeRequest<Envelope<any[]>>({
    importPath: routes.customers,
    method: 'GET',
    path: '/api/v1/customers?page=1&limit=100',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
  });
  const adminRows = expectOk(adminList, 'admin customer list');
  assert.equal(adminRows.some((row) => row.id === customerA1.id), true);
  assert.equal(adminRows.some((row) => row.id === customerA2.id), false);

  const agentList = await routeRequest<Envelope<any[]>>({
    importPath: routes.customers,
    method: 'GET',
    path: '/api/v1/customers?page=1&limit=100',
    token: agentToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
  });
  const agentRows = expectOk(agentList, 'agent customer list');
  assert.equal(agentRows.some((row) => row.id === customerA1.id), true);
  assert.equal(agentRows.some((row) => row.id === customerA2.id), false);
});

test('AUTH-010 agent cannot read another branch customer by ID', async () => {
  const otherBranchCustomer = await createCustomerFixture(scenario, {
    key: 'auth-other-branch',
    branchId: scenario.branchA2.id,
    routeId: scenario.routeA2.id,
    agentId: scenario.users.agentA2.id,
    phoneOffset: 103,
  });

  const response = await routeRequest<Envelope<unknown>>({
    importPath: routes.customerById,
    method: 'GET',
    path: `/api/v1/customers/${otherBranchCustomer.id}`,
    token: agentToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: otherBranchCustomer.id },
  });
  expectError(response, [403, 404], 'agent other-branch customer detail');
  assert.equal(response.text.includes(otherBranchCustomer.phone), false);
});

test('AUTH-011 tenant A token cannot read tenant B data by ID', async () => {
  const customerB = await createCustomerFixture(scenario, {
    key: 'auth-tenant-b',
    tenantId: scenario.tenantB.id,
    branchId: scenario.branchB1.id,
    routeId: scenario.routeB1.id,
    agentId: scenario.users.agentB1.id,
    phoneOffset: 104,
  });

  const response = await routeRequest<Envelope<unknown>>({
    importPath: routes.customerById,
    method: 'GET',
    path: `/api/v1/customers/${customerB.id}`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: customerB.id },
  });
  expectError(response, [403, 404], 'cross-tenant customer detail');
  assert.equal(response.text.includes(customerB.phone), false);
});

test('AUTH-013 borrower token sees only own loans', async () => {
  const borrowerCustomer = await createCustomerFixture(scenario, {
    key: 'borrower-own',
    phoneOffset: 105,
  });
  const otherCustomer = await createCustomerFixture(scenario, {
    key: 'borrower-other',
    phoneOffset: 106,
  });
  const ownLoan = await createLoanFixture(scenario, {
    key: 'borrower-own',
    customerId: borrowerCustomer.id,
  });
  const otherLoan = await createLoanFixture(scenario, {
    key: 'borrower-other',
    customerId: otherCustomer.id,
  });

  const borrower = await borrowerLoginAndVerify({
    phone: borrowerCustomer.phone,
    tenantSlug: scenario.tenantA.slug,
  });
  const response = await routeRequest<Envelope<Array<{ id: string }>>>({
    importPath: routes.borrowerLoans,
    method: 'GET',
    path: '/api/v1/borrower/loans',
    token: borrower.token,
    tenantSlug: scenario.tenantA.slug,
  });
  const rows = expectOk(response, 'borrower loans');
  assert.equal(rows.some((row) => row.id === ownLoan.id), true);
  assert.equal(rows.some((row) => row.id === otherLoan.id), false);
});

skip(
  'AUTH-012 module-disabled API access',
  'Current v1 route layer scopes by JWT appType but does not enforce branch/subscription module-disabled access; module gating is implemented in web layout/session paths.',
);

async function main() {
  const runId = getRunId();
  try {
    scenario = await seedLoanTrackScenario(runId);
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
