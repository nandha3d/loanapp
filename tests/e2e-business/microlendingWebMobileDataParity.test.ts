import assert from 'node:assert/strict';
import { getPrisma, getRunId, disconnectTestDb } from './helpers/testDb';
import { cleanupRunData } from './helpers/cleanup';
import { createCustomerFixture, createLoanFixture, seedZoloFundScenario } from './helpers/seedZoloFund';
import { loginMobile } from './helpers/authTokens';
import { routes, expectOk } from './helpers/apiClient';
import { mobileRequest, type MobileClient } from './helpers/mobileApiClient';
import { assertMoneyEqual } from './helpers/assertMoney';
import { run, test } from './helpers/harness';

const runId = getRunId();
const prisma = getPrisma();
let tenantA: string;
let tenantB: string;
let branchA1: string;
let branchA2: string;
let branchB1: string;
let a1: MobileClient;
let a2: MobileClient;
let b1: MobileClient;
let agent: MobileClient;

async function dashboard(client: MobileClient) {
  const response = await mobileRequest<{
    currentCapital: number | null; totalDisbursed: number; totalCollectedAllTime: number;
  }>(client, { importPath: routes.dashboard, method: 'GET', path: '/api/v1/dashboard' });
  return expectOk(response);
}

test('Staff web service and mobile API return the same scoped book totals', async () => {
  const { getDashboardBookTotals } = await import('../../lib/dashboard/bookTotals');
  for (const [client, tenantId, branchId, principal, capital, collected] of [
    [a1, tenantA, branchA1, 1500, 3750, 200],
    [a2, tenantA, branchA2, 2200, 7300, 300],
    [b1, tenantB, branchB1, 3300, 11500, 500],
  ] as const) {
    const web = await getDashboardBookTotals(tenantId, 'microlending', branchId);
    const mobile = await dashboard(client);
    assertMoneyEqual(web.totalDisbursed, principal, 'gross principal');
    assertMoneyEqual(web.currentCapital, capital, 'cash-book capital');
    assertMoneyEqual(web.totalCollectedAllTime, collected, 'cash-book collections');
    assertMoneyEqual(mobile.totalDisbursed, web.totalDisbursed, 'web/mobile disbursed');
    assertMoneyEqual(mobile.currentCapital, web.currentCapital, 'web/mobile capital');
    assertMoneyEqual(mobile.totalCollectedAllTime, web.totalCollectedAllTime, 'web/mobile collected');
  }
});

test('Branch, tenant, module, and agent scopes do not expose another book', async () => {
  const { getDashboardBookTotals } = await import('../../lib/dashboard/bookTotals');
  const forgedBranch = await dashboard({ ...a1, branchId: branchA2 });
  assertMoneyEqual(forgedBranch.currentCapital, 3750, 'admin cannot switch branches by header');
  const finance = await getDashboardBookTotals(tenantA, 'autofinance', branchA1);
  assertMoneyEqual(finance.currentCapital, 9400, 'module is isolated');
  assertMoneyEqual(finance.totalCollectedAllTime, 400, 'module collections are isolated');
  const field = await dashboard(agent);
  assert.equal(field.currentCapital, null, 'agent cannot see branch capital');
});

async function main() {
  try {
    const scenario = await seedZoloFundScenario(runId);
    tenantA = scenario.tenantA.id;
    tenantB = scenario.tenantB.id;
    branchA1 = scenario.branchA1.id;
    branchA2 = scenario.branchA2.id;
    branchB1 = scenario.branchB1.id;
    for (const [key, tenantId, branchId, routeId, agentId, userId, principal, phoneOffset] of [
      ['a1', tenantA, branchA1, scenario.routeA1.id, scenario.users.agentA1.id, scenario.users.adminA1.id, 1500, 801],
      ['a2', tenantA, branchA2, scenario.routeA2.id, scenario.users.agentA2.id, scenario.users.adminA2.id, 2200, 802],
      ['b1', tenantB, branchB1, scenario.routeB1.id, scenario.users.agentB1.id, scenario.users.adminB1.id, 3300, 803],
    ] as const) {
      const customer = await createCustomerFixture(scenario, { key, tenantId, branchId, routeId, agentId, phoneOffset });
      await createLoanFixture(scenario, { key, tenantId, branchId, customerId: customer.id, createdById: userId, principal });
    }
    const entryDate = new Date();
    await prisma.accountEntry.createMany({ data: [
      { tenantId: tenantA, appType: 'microlending', branchId: branchA1, entryDate, type: 'capital_add', amount: 5000 },
      { tenantId: tenantA, appType: 'microlending', branchId: branchA1, entryDate, type: 'loan_disburse', amount: 1400 },
      { tenantId: tenantA, appType: 'microlending', branchId: branchA1, entryDate, type: 'collection', amount: 200 },
      { tenantId: tenantA, appType: 'microlending', branchId: branchA1, entryDate, type: 'expense', amount: 50 },
      { tenantId: tenantA, appType: 'microlending', branchId: branchA2, entryDate, type: 'capital_add', amount: 7000 },
      { tenantId: tenantA, appType: 'microlending', branchId: branchA2, entryDate, type: 'collection', amount: 300 },
      { tenantId: tenantA, appType: 'autofinance', branchId: branchA1, entryDate, type: 'capital_add', amount: 9000 },
      { tenantId: tenantA, appType: 'autofinance', branchId: branchA1, entryDate, type: 'collection', amount: 400 },
      { tenantId: tenantB, appType: 'microlending', branchId: branchB1, entryDate, type: 'capital_add', amount: 11000 },
      { tenantId: tenantB, appType: 'microlending', branchId: branchB1, entryDate, type: 'collection', amount: 500 },
    ] });
    const login = async (user: { username: string }, tenantSlug: string, branchId: string): Promise<MobileClient> => ({
      token: (await loginMobile({ username: user.username, password: scenario.password, tenantSlug })).token,
      tenantSlug, appType: 'microlending', branchId,
    });
    a1 = await login(scenario.users.adminA1, scenario.tenantA.slug, branchA1);
    a2 = await login(scenario.users.adminA2, scenario.tenantA.slug, branchA2);
    b1 = await login(scenario.users.adminB1, scenario.tenantB.slug, branchB1);
    agent = await login(scenario.users.agentA1, scenario.tenantA.slug, branchA1);
    await run();
  } finally {
    await cleanupRunData(runId);
    await disconnectTestDb();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
