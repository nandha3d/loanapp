import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { disconnectTestDb, getPrisma, getRunId } from './helpers/testDb';
import { cleanupRunData } from './helpers/cleanup';
import { createCustomerFixture, createLoanFixture, seedLoanTrackScenario, type LoanTrackScenario } from './helpers/seedLoanTrack';
import { loginMobile } from './helpers/authTokens';
import { routeRequest, expectOk, routes, type Envelope } from './helpers/apiClient';
import { assertMoneyEqual } from './helpers/assertMoney';
import { mobileRequest, type MobileClient } from './helpers/mobileApiClient';
import { knownGap, run, test } from './helpers/harness';
import { writeKnownGapEvidence } from './helpers/evidenceWriter';
import { knownGapCatalog } from './helpers/knownGaps';

const runId = getRunId();
const prisma = getPrisma();

let scenario: LoanTrackScenario;
let agent: MobileClient;
let agentLoanId = '';
let otherBranchLoanId = '';
let otherTenantLoanId = '';
let agentCustomerId = '';
let collectionInstalmentId = '';

test('MOB-001 agent login returns bearer token and scoped mobile identity', async () => {
  const login = await loginMobile({
    username: scenario.users.agentA1.username,
    password: scenario.password,
    tenantSlug: scenario.tenantA.slug,
  });
  agent = {
    token: login.token,
    tenantSlug: scenario.tenantA.slug,
    appType: 'microlending',
    branchId: scenario.branchA1.id,
  };
  assert.equal(login.user.role, 'agent');
  assert.equal(login.user.branchId, scenario.branchA1.id);
});

test('MOB-002 dashboard/customer/loan lists respect agent branch and tenant scope', async () => {
  const ownCustomer = await createCustomerFixture(scenario, {
    key: 'mob-own',
    phoneOffset: 910,
    status: 'active',
  });
  const ownLoan = await createLoanFixture(scenario, {
    key: 'mob-own',
    customerId: ownCustomer.id,
    createdById: scenario.users.agentA1.id,
    principal: 5000,
    tenure: 5,
  });
  const branchCustomer = await createCustomerFixture(scenario, {
    key: 'mob-branch2',
    branchId: scenario.branchA2.id,
    routeId: scenario.routeA2.id,
    agentId: scenario.users.agentA2.id,
    phoneOffset: 911,
    status: 'active',
  });
  const branchLoan = await createLoanFixture(scenario, {
    key: 'mob-branch2',
    customerId: branchCustomer.id,
    branchId: scenario.branchA2.id,
    createdById: scenario.users.agentA2.id,
    principal: 5000,
    tenure: 5,
  });
  const tenantCustomer = await createCustomerFixture(scenario, {
    key: 'mob-tenant-b',
    tenantId: scenario.tenantB.id,
    branchId: scenario.branchB1.id,
    routeId: scenario.routeB1.id,
    agentId: scenario.users.agentB1.id,
    phoneOffset: 912,
    status: 'active',
  });
  const tenantLoan = await createLoanFixture(scenario, {
    key: 'mob-tenant-b',
    tenantId: scenario.tenantB.id,
    customerId: tenantCustomer.id,
    branchId: scenario.branchB1.id,
    createdById: scenario.users.agentB1.id,
    principal: 5000,
    tenure: 5,
  });
  agentLoanId = ownLoan.id;
  agentCustomerId = ownCustomer.id;
  collectionInstalmentId = ownLoan.instalments[0]!.id;
  otherBranchLoanId = branchLoan.id;
  otherTenantLoanId = tenantLoan.id;

  const dashboard = await mobileRequest<any>(agent, { importPath: routes.dashboard, method: 'GET', path: '/api/v1/dashboard' });
  const dash = expectOk(dashboard);
  assert.equal(Number(dash.totalCustomers) >= 1, true);

  const customers = await mobileRequest<Array<{ id: string }>>(agent, { importPath: routes.customers, method: 'GET', path: '/api/v1/customers?limit=100' });
  const customerRows = expectOk(customers);
  assert.equal(customerRows.some((row) => row.id === agentCustomerId), true);
  assert.equal(customerRows.some((row) => row.id === branchCustomer.id), false, 'agent must not see another branch customer');
  assert.equal(customerRows.some((row) => row.id === tenantCustomer.id), false, 'agent must not see another tenant customer');

  const loans = await mobileRequest<Array<{ id: string }>>(agent, { importPath: routes.loans, method: 'GET', path: '/api/v1/loans?limit=100' });
  const loanRows = expectOk(loans);
  assert.equal(loanRows.some((row) => row.id === agentLoanId), true);
  assert.equal(loanRows.some((row) => row.id === otherBranchLoanId), false, 'agent must not see another branch loan');
  assert.equal(loanRows.some((row) => row.id === otherTenantLoanId), false, 'agent must not see another tenant loan');
});

test('MOB-003 branch/tenant ID tampering is blocked on detail routes', async () => {
  const branchLoan = await mobileRequest<Envelope<unknown>>(
    agent,
    { importPath: routes.loanById, method: 'GET', path: `/api/v1/loans/${otherBranchLoanId}`, params: { id: otherBranchLoanId } },
  );
  assert.equal([403, 404].includes(branchLoan.status), true, branchLoan.text);

  const tenantLoan = await mobileRequest<Envelope<unknown>>(
    agent,
    { importPath: routes.loanById, method: 'GET', path: `/api/v1/loans/${otherTenantLoanId}`, params: { id: otherTenantLoanId } },
  );
  assert.equal([403, 404].includes(tenantLoan.status), true, tenantLoan.text);
});

test('MOB-004 mobile/offline collection duplicate payload is accepted once only', async () => {
  const idempotencyKey = `${runId}-offline-sync-1`;
  const beforeEntries = await prisma.collectionEntry.count({ where: { loanId: agentLoanId } });
  const beforeWallet = await prisma.agentAccount.findFirst({
    where: { tenantId: scenario.tenantA.id, appType: 'microlending', agentId: scenario.users.agentA1.id },
  });

  const body = {
    instalmentId: collectionInstalmentId,
    receivedAmount: 1000,
    paymentMode: 'cash',
    remarks: `${runId} offline sync`,
    collectionDate: new Date().toISOString(),
    idempotencyKey,
  };
  const first = await mobileRequest<{ id: string }>(agent, { importPath: routes.collectionEntry, method: 'POST', path: '/api/v1/collection/entry', body });
  const entry = expectOk(first);
  assert.equal(Boolean(entry.id), true);
  const afterFirstEntries = await prisma.collectionEntry.count({ where: { loanId: agentLoanId } });
  assert.equal(afterFirstEntries, beforeEntries + 1);

  const replay = await mobileRequest<unknown>(agent, { importPath: routes.collectionEntry, method: 'POST', path: '/api/v1/collection/entry', body });
  assert.equal([200, 409].includes(replay.status), true, replay.text);
  assert.equal(await prisma.collectionEntry.count({ where: { loanId: agentLoanId } }), afterFirstEntries);

  const instalment = await prisma.instalment.findUniqueOrThrow({ where: { id: collectionInstalmentId } });
  assertMoneyEqual(instalment.receivedAmount, 1000, 'duplicate offline sync does not double-count instalment received amount');
  const afterWallet = await prisma.agentAccount.findFirst({
    where: { tenantId: scenario.tenantA.id, appType: 'microlending', agentId: scenario.users.agentA1.id },
  });
  if (beforeWallet && afterWallet) {
    assertMoneyEqual(Number(afterWallet.balance) - Number(beforeWallet.balance), 1000, 'agent wallet increases once only');
  }
});

test('MOB-005 GPS ping and wallet endpoints work through mobile bearer token', async () => {
  const gps = await mobileRequest<{ accepted: number }>(agent, { importPath: routes.gpsPing, method: 'POST', path: '/api/v1/gps/ping',
    body: {
      lat: 12.9716,
      lng: 77.5946,
      accuracyM: 10,
      routeId: scenario.routeA1.id,
      capturedAt: new Date().toISOString(),
      isMocked: false,
    },
  });
  assert.equal(expectOk(gps).accepted, 1);
  const ping = await prisma.agentLocationPing.findFirstOrThrow({
    where: { tenantId: scenario.tenantA.id, agentId: scenario.users.agentA1.id, routeId: scenario.routeA1.id },
    orderBy: { capturedAt: 'desc' },
  });
  assert.equal(ping.isMocked, false);

  const wallet = await mobileRequest<{ balance: unknown; transactions: unknown[] }>(agent, { importPath: routes.walletMe, method: 'GET', path: '/api/v1/wallet/me' });
  const walletData = expectOk(wallet);
  assert.equal(Number(walletData.balance) >= 0, true);
});

test('MOB-006 logout route responds but token remains stateless until revocation exists', async () => {
  const logout = await mobileRequest<{ ok: boolean }>(agent, { importPath: routes.authLogout, method: 'POST', path: '/api/v1/auth/logout' });
  assert.equal(expectOk(logout).ok, true);
  const me = await mobileRequest<any>(agent, { importPath: routes.authMe, method: 'GET', path: '/api/v1/auth/me' });
  assert.equal(me.status, 200, 'current code keeps JWT valid after logout because there is no server blocklist');
});

knownGap('MOB-GAP-002 logout/token invalidation is stateless', {
  id: 'MOB-GAP-002',
  classification: 'P2',
  currentBehavior: 'POST /api/v1/auth/logout returns ok but does not revoke an already-issued mobile JWT.',
  expectedBehavior: 'Logout should invalidate refresh/mobile tokens server-side when token revocation is a business requirement.',
  evidenceSource: 'app/api/v1/auth/logout/route.ts returns ok and documents stateless JWT behavior.',
  businessImpact: 'A stolen mobile bearer token can remain usable until expiry after logout.',
  fixedAssertion: 'After logout, the same bearer token receives 401 from /api/v1/auth/me.',
}, async () => {
  const source = readFileSync(path.join(process.cwd(), 'app', 'api', 'v1', 'auth', 'logout', 'route.ts'), 'utf8');
  assert.equal(/Stateless JWT|client clears its token|blocklist could be added later/i.test(source), false, 'logout route documents stateless token behavior and no server-side revocation');
});

knownGap('MOB-GAP-001 duplicate loan-level collection replay remains P0 tracked', knownGapCatalog.duplicateCollectionReplayDoubleCounts, async () => {
  const source = readFileSync(path.join(process.cwd(), 'lib', 'collectionWrite.ts'), 'utf8');
  assert.equal(
    /baseKey.*instalment|idempotencyKey.*instalmentId|distributeCollectionAcrossLoan/s.test(source),
    false,
    'loan-level collection replay still derives per-instalment idempotency separately from instalment-level offline sync',
  );
});

async function main() {
  try {
    scenario = await seedLoanTrackScenario(runId);
    const summary = await run();
    await writeKnownGapEvidence(runId, summary, 'tests/e2e-business/mobileAgentApiParity.test.ts');
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
