import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { disconnectTestDb, getPrisma, getRunId } from './helpers/testDb';
import { cleanupRunData } from './helpers/cleanup';
import { createCustomerFixture, createLoanFixture, seedLoanTrackScenario, type LoanTrackScenario } from './helpers/seedLoanTrack';
import { issueMobileTokenForSetup } from './helpers/authTokens';
import { routeRequest, expectOk, routes, type Envelope } from './helpers/apiClient';
import { assertMoneyEqual } from './helpers/assertMoney';
import { knownGap, run, test } from './helpers/harness';
import { writeKnownGapEvidence } from './helpers/evidenceWriter';
import { knownGapCatalog } from './helpers/knownGaps';

const runId = getRunId();
const prisma = getPrisma();

let scenario: LoanTrackScenario;
let chitAdminToken = '';
let vehicleAdminToken = '';
let chitCustomerIds: string[] = [];
let chitGroupId = '';
let firstMemberId = '';
let firstSubscriptionId = '';
let vehicleCustomerId = '';
let vehicleId = '';
let productLoanId = '';

async function createSpecialCustomer(key: string, appType: string, offset: number) {
  return createCustomerFixture(scenario, { key, phoneOffset: offset, status: 'active', appType });
}

test('MOD-001 chits group creation uses actual v1 route and creates member schedules', async () => {
  const customers = await Promise.all([
    createSpecialCustomer('chit-1', 'chitfunds', 1010),
    createSpecialCustomer('chit-2', 'chitfunds', 1011),
  ]);
  chitCustomerIds = customers.map((customer) => customer.id);

  const created = await routeRequest<Envelope<{ id: string; status: string }>>({
    importPath: routes.chits,
    method: 'POST',
    path: '/api/v1/chits',
    token: chitAdminToken,
    tenantSlug: scenario.tenantA.slug,
    appType: 'chitfunds',
    body: {
      name: `${runId}-Chit`,
      chitValue: 100000,
      monthlyContrib: 5000,
      totalMembers: 2,
      durationMonths: 2,
      commissionPct: 5,
      startDate: '2026-01-01',
      memberIds: chitCustomerIds,
    },
  });
  const group = expectOk(created);
  chitGroupId = group.id;
  assert.equal(group.status, 'active');

  const members = await routeRequest<Envelope<Array<{ id: string; subscriptions: Array<{ id: string; periodNumber: number }> }>>>({
    importPath: routes.chitMembers,
    method: 'GET',
    path: `/api/v1/chits/${chitGroupId}/members`,
    token: chitAdminToken,
    tenantSlug: scenario.tenantA.slug,
    appType: 'chitfunds',
    params: { id: chitGroupId },
  });
  const rows = expectOk(members);
  assert.equal(rows.length, 2);
  firstMemberId = rows[0]!.id;
  firstSubscriptionId = rows[0]!.subscriptions[0]!.id;
});

test('MOD-002 chit auction/payment/miss/cancel routes update DB and money rows', async () => {
  const auction = await routeRequest<Envelope<{ id: string; status: string; prizeAmount: unknown }>>({
    importPath: routes.chitAuctions,
    method: 'POST',
    path: `/api/v1/chits/${chitGroupId}/auctions`,
    token: chitAdminToken,
    tenantSlug: scenario.tenantA.slug,
    appType: 'chitfunds',
    params: { id: chitGroupId },
    body: {
      periodNumber: 1,
      winnerMemberId: firstMemberId,
      prizeAmount: 90000,
      bidDiscount: 10000,
    },
  });
  const auctionData = expectOk(auction);
  assert.equal(auctionData.status, 'completed');

  const payment = await routeRequest<Envelope<{ id: string; status: string; paidAmount: number; delta: number }>>({
    importPath: routes.chitPayments,
    method: 'POST',
    path: `/api/v1/chits/${chitGroupId}/payments`,
    token: chitAdminToken,
    tenantSlug: scenario.tenantA.slug,
    appType: 'chitfunds',
    params: { id: chitGroupId },
    body: {
      memberId: firstMemberId,
      periodNumber: 1,
      paidAmount: 5000,
    },
  });
  const paymentData = expectOk(payment);
  assert.equal(paymentData.status, 'paid');
  assertMoneyEqual(paymentData.delta, 5000, 'first chit payment delta');
  const sub = await prisma.chitSubscription.findUniqueOrThrow({ where: { id: paymentData.id } });
  assert.equal(sub.status, 'paid');

  const secondMember = await prisma.chitMember.findFirstOrThrow({
    where: { chitGroupId, id: { not: firstMemberId } },
    include: { subscriptions: { orderBy: { periodNumber: 'asc' } } },
  });
  const miss = await routeRequest<Envelope<{ id: string; status: string }>>({
    importPath: routes.chitMiss,
    method: 'POST',
    path: `/api/v1/chits/subscriptions/${secondMember.subscriptions[0]!.id}/miss`,
    token: chitAdminToken,
    tenantSlug: scenario.tenantA.slug,
    appType: 'chitfunds',
    params: { id: secondMember.subscriptions[0]!.id },
  });
  assert.equal(expectOk(miss).status, 'missed');

  const cancel = await routeRequest<Envelope<{ id: string; status: string }>>({
    importPath: routes.chitCancel,
    method: 'POST',
    path: `/api/v1/chits/${chitGroupId}/cancel`,
    token: chitAdminToken,
    tenantSlug: scenario.tenantA.slug,
    appType: 'chitfunds',
    params: { id: chitGroupId },
  });
  assert.equal(expectOk(cancel).status, 'cancelled');
});

test('MOD-003 vehicle create/detail/edit routes work for autofinance app type', async () => {
  const customer = await createSpecialCustomer('vehicle', 'autofinance', 1020);
  vehicleCustomerId = customer.id;
  const created = await routeRequest<Envelope<{ id: string; registrationNo: string; status: string }>>({
    importPath: routes.vehicles,
    method: 'POST',
    path: '/api/v1/vehicles',
    token: vehicleAdminToken,
    tenantSlug: scenario.tenantA.slug,
    appType: 'autofinance',
    body: {
      customerId: vehicleCustomerId,
      registrationNo: `${runId}-TN01AA01`.toUpperCase().slice(0, 20),
      make: 'TestMake',
      model: 'TestModel',
      year: 2026,
      color: 'white',
      vehicleType: 'two_wheeler',
    },
  });
  const vehicle = expectOk(created);
  vehicleId = vehicle.id;
  assert.equal(vehicle.status, 'active');

  const detail = await routeRequest<Envelope<{ id: string; customer: { id: string } }>>({
    importPath: routes.vehicleById,
    method: 'GET',
    path: `/api/v1/vehicles/${vehicleId}`,
    token: vehicleAdminToken,
    tenantSlug: scenario.tenantA.slug,
    appType: 'autofinance',
    params: { id: vehicleId },
  });
  assert.equal(expectOk(detail).customer.id, vehicleCustomerId);

  const patched = await routeRequest<Envelope<{ id: string; color: string }>>({
    importPath: routes.vehicleById,
    method: 'PATCH',
    path: `/api/v1/vehicles/${vehicleId}`,
    token: vehicleAdminToken,
    tenantSlug: scenario.tenantA.slug,
    appType: 'autofinance',
    params: { id: vehicleId },
    body: { color: 'blue' },
  });
  assert.equal(expectOk(patched).color, 'blue');
});

test('MOD-004 product repossession/reactivation route updates product-finance item', async () => {
  const loan = await createLoanFixture(scenario, {
    key: 'product',
    customerId: vehicleCustomerId,
    principal: 40000,
    tenure: 8,
  });
  productLoanId = loan.id;
  await prisma.loan.update({
    where: { id: loan.id },
    data: { appType: 'autofinance', loanType: 'product_finance' },
  });
  await prisma.productFinanceItem.create({
    data: {
      tenantId: scenario.tenantA.id,
      branchId: scenario.branchA1.id,
      loanId: loan.id,
      customerId: vehicleCustomerId,
      category: `${runId}-Appliance`,
      productName: `${runId}-Product`,
      brand: 'Brand',
      modelNo: 'Model',
      serialNo: `${runId}-SERIAL`,
      invoiceNo: `${runId}-INV`,
      invoiceAmount: 50000,
      downPayment: 10000,
      financedAmount: 40000,
      tenureMonths: 8,
    },
  });

  for (const status of ['repossessed', 'active']) {
    const response = await routeRequest<Envelope<{ success: boolean; status: string }>>({
      importPath: routes.productRepossession,
      method: 'POST',
      path: `/api/v1/loans/${productLoanId}/product-repossession`,
      token: vehicleAdminToken,
      tenantSlug: scenario.tenantA.slug,
      appType: 'autofinance',
      params: { id: productLoanId },
      body: { status, reason: `${runId} ${status}` },
    });
    assert.equal(expectOk(response).status, status);
    const item = await prisma.productFinanceItem.findUniqueOrThrow({ where: { loanId: productLoanId } });
    assert.equal(item.repossessionStatus, status);
  }
});

test('MOD-005 optional module route rejects wrong tenant data tampering', async () => {
  const wrongToken = await issueMobileTokenForSetup({ ...scenario.users.adminB1, appType: 'autofinance' });
  const response = await routeRequest<Envelope<unknown>>({
    importPath: routes.vehicleById,
    method: 'GET',
    path: `/api/v1/vehicles/${vehicleId}`,
    token: wrongToken,
    tenantSlug: scenario.tenantB.slug,
    appType: 'autofinance',
    params: { id: vehicleId },
  });
  assert.equal([403, 404].includes(response.status), true, response.text);
});

knownGap('MOD-GAP-001 backend module-disabled gating is not enforced consistently', knownGapCatalog.optionalModuleBackendMissing, async () => {
  const chitsSource = readFileSync(path.join(process.cwd(), 'app', 'api', 'v1', 'chits', 'route.ts'), 'utf8');
  const vehiclesSource = readFileSync(path.join(process.cwd(), 'app', 'api', 'v1', 'vehicles', 'route.ts'), 'utf8');
  assert.equal(/enabledModules|tenantSubscription/i.test(chitsSource + vehiclesSource), true, 'module routes do not enforce enabled-module gating at API boundary');
});

knownGap('MOD-GAP-002 product repossession route is tenant-scoped but not appType/branch-scoped', {
  id: 'MOD-GAP-002',
  classification: 'P1',
  currentBehavior: 'Product repossession loads loan by id and tenantId only, without appType or branch scoping.',
  expectedBehavior: 'Product repossession should require the caller appType/branch scope to match the target loan.',
  evidenceSource: 'app/api/v1/loans/[id]/product-repossession/route.ts findFirst({ id, tenantId })',
  businessImpact: 'A privileged caller in the tenant but wrong branch/module can alter product-finance repossession state.',
  fixedAssertion: 'Wrong appType or wrong branch token receives 403/404 and productFinanceItem.repossessionStatus remains unchanged.',
}, async () => {
  const source = readFileSync(path.join(process.cwd(), 'app', 'api', 'v1', 'loans', '[id]', 'product-repossession', 'route.ts'), 'utf8');
  assert.equal(/appType|scopedBranchWhere/.test(source), true, 'route does not scope by appType/branch');
});

async function main() {
  try {
    scenario = await seedLoanTrackScenario(runId);
    chitAdminToken = await issueMobileTokenForSetup({ ...scenario.users.adminA1, appType: 'chitfunds' });
    vehicleAdminToken = await issueMobileTokenForSetup({ ...scenario.users.adminA1, appType: 'autofinance' });
    const summary = await run();
    await writeKnownGapEvidence(runId, summary, 'tests/e2e-business/chitsVehicleSpecialModules.test.ts');
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
