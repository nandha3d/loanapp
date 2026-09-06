import assert from 'node:assert/strict';
import {
  routeRequest,
  expectOk,
  expectError,
  routes,
  type Envelope,
} from './helpers/apiClient';
import { loginMobile } from './helpers/authTokens';
import { cleanupRunData } from './helpers/cleanup';
import { skip, test, run } from './helpers/harness';
import {
  createCustomerFixture,
  phoneForRun,
  seedZoloFundScenario,
  type ZoloFundScenario,
} from './helpers/seedZoloFund';
import { APP_TYPE, disconnectTestDb, getPrisma, getRunId } from './helpers/testDb';

let scenario: ZoloFundScenario;
let adminToken = '';
let agentToken = '';

function customerBody(key: string, phoneOffset: number, extra: Record<string, unknown> = {}) {
  return {
    name: `${scenario.runId} API Customer ${key}`,
    phone: phoneForRun(scenario.runId, phoneOffset),
    address: `${scenario.runId} API Address ${key}`,
    routeId: scenario.routeA1.id,
    preferredCollectionTime: 'morning',
    ...extra,
  };
}

test('CUST-001 admin creates customer and DB row is active in branch/tenant/app scope', async () => {
  const response = await routeRequest<Envelope<any>>({
    importPath: routes.customers,
    method: 'POST',
    path: '/api/v1/customers',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body: customerBody('admin-create', 201),
  });
  const customer = expectOk<any>(response, 'admin customer create');
  assert.equal(customer.status, 'active');
  assert.equal(customer.tenantId, scenario.tenantA.id);
  assert.equal(customer.branchId, scenario.branchA1.id);

  const dbCustomer = await getPrisma().customer.findUnique({ where: { id: customer.id } });
  assert.equal(dbCustomer?.name.startsWith(scenario.runId), true);
  assert.equal(dbCustomer?.status, 'active');
  assert.equal(dbCustomer?.appType, APP_TYPE);
});

test('CUST-002 agent creates customer and status becomes pending_review', async () => {
  const response = await routeRequest<Envelope<any>>({
    importPath: routes.customers,
    method: 'POST',
    path: '/api/v1/customers',
    token: agentToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body: customerBody('agent-pending', 202),
  });
  const customer = expectOk<any>(response, 'agent customer create');
  assert.equal(customer.status, 'pending_review');
  assert.equal(customer.agentId, scenario.users.agentA1.id);

  const dbCustomer = await getPrisma().customer.findUnique({ where: { id: customer.id } });
  assert.equal(dbCustomer?.status, 'pending_review');
});

test('CUST-003 admin approves agent customer and audit log exists', async () => {
  const pending = await routeRequest<Envelope<any>>({
    importPath: routes.customers,
    method: 'POST',
    path: '/api/v1/customers',
    token: agentToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body: customerBody('approve-me', 203),
  });
  const customer = expectOk<any>(pending, 'pending customer for approval');

  const approval = await routeRequest<Envelope<{ status: string }>>({
    importPath: routes.approvalApprove,
    method: 'PATCH',
    path: `/api/v1/approvals/${customer.id}/approve`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: customer.id },
    body: { note: `${scenario.runId} approve customer` },
  });
  assert.equal(expectOk(approval, 'approve customer').status, 'approved');

  const dbCustomer = await getPrisma().customer.findUnique({ where: { id: customer.id } });
  assert.equal(dbCustomer?.status, 'active');
  const audit = await getPrisma().auditLog.findFirst({
    where: { tenantId: scenario.tenantA.id, entityType: 'customer', entityId: customer.id, action: 'approve' },
  });
  assert.ok(audit);
});

test('CUST-004 admin rejects agent customer and DB status is rejected', async () => {
  const pending = await routeRequest<Envelope<any>>({
    importPath: routes.customers,
    method: 'POST',
    path: '/api/v1/customers',
    token: agentToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body: customerBody('reject-me', 204),
  });
  const customer = expectOk<any>(pending, 'pending customer for rejection');

  const rejection = await routeRequest<Envelope<{ status: string }>>({
    importPath: routes.approvalReject,
    method: 'PATCH',
    path: `/api/v1/approvals/${customer.id}/reject`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: customer.id },
    body: { note: `${scenario.runId} reject customer` },
  });
  assert.equal(expectOk(rejection, 'reject customer').status, 'rejected');

  const dbCustomer = await getPrisma().customer.findUnique({ where: { id: customer.id } });
  assert.equal(dbCustomer?.status, 'rejected');
});

test('CUST-005 duplicate phone is blocked without creating a second customer', async () => {
  const body = customerBody('duplicate-phone', 205);
  const first = await routeRequest<Envelope<any>>({
    importPath: routes.customers,
    method: 'POST',
    path: '/api/v1/customers',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body,
  });
  expectOk(first, 'first duplicate-phone customer');

  const second = await routeRequest<Envelope<unknown>>({
    importPath: routes.customers,
    method: 'POST',
    path: '/api/v1/customers',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    body: { ...body, name: `${scenario.runId} Duplicate Phone Copy` },
  });
  expectError(second, [409], 'duplicate phone');

  const count = await getPrisma().customer.count({
    where: { tenantId: scenario.tenantA.id, appType: APP_TYPE, phone: body.phone as string },
  });
  assert.equal(count, 1);
});

test('CUST-009/CUST-010 KYC queue, review, and invalid upload validation use actual routes', async () => {
  const customer = await createCustomerFixture(scenario, { key: 'kyc-review', phoneOffset: 206 });

  const queue = await routeRequest<Envelope<any[]>>({
    importPath: routes.kycQueue,
    method: 'GET',
    path: '/api/v1/kyc/queue',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
  });
  const queueRows = expectOk(queue, 'kyc queue');
  assert.equal(queueRows.some((row) => row.id === customer.id), true);

  const review = await routeRequest<Envelope<{ id: string; kycStatus: string }>>({
    importPath: routes.kycReview,
    method: 'POST',
    path: `/api/v1/kyc/${customer.id}/review`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { customerId: customer.id },
    body: { decision: 'verified' },
  });
  assert.equal(expectOk(review, 'kyc review').kycStatus, 'verified');

  const previousTrustProxy = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = 'true';
  try {
    const formData = new FormData();
    formData.set('file', new File(['plain text'], `${scenario.runId}-bad.txt`, { type: 'text/plain' }));
    const upload = await routeRequest<Envelope<unknown>>({
      importPath: routes.upload,
      method: 'POST',
      path: '/api/v1/upload',
      token: adminToken,
      tenantSlug: scenario.tenantA.slug,
      branchId: scenario.branchA1.id,
      appType: APP_TYPE,
      headers: { 'x-forwarded-for': scenario.runId },
      body: formData,
    });
    expectError(upload, [400], 'unsupported upload mime');
  } finally {
    if (previousTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previousTrustProxy;
  }
});

test('CUST-014 customer list respects branch and tenant scope', async () => {
  const branchCustomer = await createCustomerFixture(scenario, { key: 'list-a1', phoneOffset: 207 });
  const otherBranchCustomer = await createCustomerFixture(scenario, {
    key: 'list-a2',
    branchId: scenario.branchA2.id,
    routeId: scenario.routeA2.id,
    agentId: scenario.users.agentA2.id,
    phoneOffset: 208,
  });
  const tenantBCustomer = await createCustomerFixture(scenario, {
    key: 'list-b1',
    tenantId: scenario.tenantB.id,
    branchId: scenario.branchB1.id,
    routeId: scenario.routeB1.id,
    agentId: scenario.users.agentB1.id,
    phoneOffset: 209,
  });

  const list = await routeRequest<Envelope<any[]>>({
    importPath: routes.customers,
    method: 'GET',
    path: '/api/v1/customers?page=1&limit=200',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
  });
  const rows = expectOk(list, 'scoped customer list');
  assert.equal(rows.some((row) => row.id === branchCustomer.id), true);
  assert.equal(rows.some((row) => row.id === otherBranchCustomer.id), false);
  assert.equal(rows.some((row) => row.id === tenantBCustomer.id), false);
});

test('CUST-014 ID tampering is blocked without leaking forbidden customer data', async () => {
  const otherBranchCustomer = await createCustomerFixture(scenario, {
    key: 'tamper-a2',
    branchId: scenario.branchA2.id,
    routeId: scenario.routeA2.id,
    agentId: scenario.users.agentA2.id,
    phoneOffset: 210,
  });

  const response = await routeRequest<Envelope<unknown>>({
    importPath: routes.customerById,
    method: 'GET',
    path: `/api/v1/customers/${otherBranchCustomer.id}`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: otherBranchCustomer.id },
  });
  expectError(response, [403, 404], 'customer ID tampering');
  assert.equal(response.text.includes(otherBranchCustomer.phone), false);
});

skip(
  'CUST-006 duplicate Aadhaar/PAN blocked',
  'Current Customer schema has no unique Aadhaar/PAN constraint and /api/v1/customers create only blocks duplicate phone.',
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
