import assert from 'node:assert/strict';
import {
  routeRequest,
  expectOk,
  expectError,
  routes,
  type Envelope,
} from './helpers/apiClient';
import { issueMobileTokenForSetup } from './helpers/authTokens';
import { cleanupRunData } from './helpers/cleanup';
import { writeKnownGapsReport } from './helpers/evidenceWriter';
import { knownGap, test, run } from './helpers/harness';
import { knownGapCatalog } from './helpers/knownGaps';
import {
  createCustomerFixture,
  phoneForRun,
  seedLoanTrackScenario,
  type LoanTrackScenario,
} from './helpers/seedLoanTrack';
import { APP_TYPE, disconnectTestDb, getPrisma, getRunId } from './helpers/testDb';

let scenario: LoanTrackScenario;
let adminToken = '';
let agentToken = '';
let tenantBAdminToken = '';

const securityFixture: Partial<{
  customerA1Id: string;
  customerA2Id: string;
  customerB1Id: string;
  pendingCustomerId: string;
  uploadedFileName: string;
}> = {};

function customerBody(key: string, phoneOffset: number, extra: Record<string, unknown> = {}) {
  return {
    name: `${scenario.runId} Security Customer ${key}`,
    phone: phoneForRun(scenario.runId, phoneOffset),
    address: `${scenario.runId} Security Address ${key}`,
    routeId: scenario.routeA1.id,
    preferredCollectionTime: 'morning',
    ...extra,
  };
}

async function setupSecurityFixture() {
  const customerA1 = await createCustomerFixture(scenario, {
    key: 'sec-a1',
    phoneOffset: 1201,
  });
  securityFixture.customerA1Id = customerA1.id;

  const customerA2 = await createCustomerFixture(scenario, {
    key: 'sec-a2',
    branchId: scenario.branchA2.id,
    routeId: scenario.routeA2.id,
    agentId: scenario.users.agentA2.id,
    phoneOffset: 1202,
  });
  securityFixture.customerA2Id = customerA2.id;

  const customerB1 = await createCustomerFixture(scenario, {
    key: 'sec-b1',
    tenantId: scenario.tenantB.id,
    branchId: scenario.branchB1.id,
    routeId: scenario.routeB1.id,
    agentId: scenario.users.agentB1.id,
    phoneOffset: 1203,
  });
  securityFixture.customerB1Id = customerB1.id;

  const pending = await createCustomerFixture(scenario, {
    key: 'sec-pending-agent',
    status: 'pending_review',
    phoneOffset: 1204,
  });
  securityFixture.pendingCustomerId = pending.id;
}

test('SEC-001/SEC-002 missing and invalid bearer tokens are blocked', async () => {
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
    token: `${scenario.runId}-not-a-token`,
  });
  expectError(invalid, [401], 'invalid token');
});

test('SEC-003 agent cannot access admin endpoint', async () => {
  const response = await routeRequest<Envelope<unknown>>({
    importPath: routes.adminUsers,
    method: 'GET',
    path: '/api/v1/admin/users',
    token: agentToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
  });
  expectError(response, [403], 'agent admin users');
});

test('SEC-004 agent cannot approve customer or loan approval requests', async () => {
  assert.ok(securityFixture.pendingCustomerId, 'pending customer exists');
  const response = await routeRequest<Envelope<unknown>>({
    importPath: routes.approvalApprove,
    method: 'PATCH',
    path: `/api/v1/approvals/${securityFixture.pendingCustomerId}/approve`,
    token: agentToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: securityFixture.pendingCustomerId },
    body: { note: `${scenario.runId} forbidden agent approval` },
  });
  expectError(response, [403], 'agent approval attempt');
});

test('SEC-005 branch user cannot access another branch customer by ID', async () => {
  assert.ok(securityFixture.customerA2Id, 'other branch customer exists');
  const response = await routeRequest<Envelope<unknown>>({
    importPath: routes.customerById,
    method: 'GET',
    path: `/api/v1/customers/${securityFixture.customerA2Id}`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: securityFixture.customerA2Id },
  });
  expectError(response, [403, 404], 'branch ID tampering');
});

test('SEC-006 tenant user cannot access another tenant customer by ID', async () => {
  assert.ok(securityFixture.customerB1Id, 'tenant B customer exists');
  const response = await routeRequest<Envelope<unknown>>({
    importPath: routes.customerById,
    method: 'GET',
    path: `/api/v1/customers/${securityFixture.customerB1Id}`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: securityFixture.customerB1Id },
  });
  expectError(response, [403, 404], 'tenant ID tampering');
  assert.equal(response.text.includes(String(securityFixture.customerB1Id)), false);
});

test('SEC-007 file/KYC URL requires auth and enforces tenant isolation', async () => {
  const formData = new FormData();
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
  formData.set('file', new File([pngBytes], `${scenario.runId}-kyc.png`, { type: 'image/png' }));
  const upload = await routeRequest<Envelope<{ url: string; filename: string }>>({
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
  const uploaded = expectOk(upload, 'valid KYC-style upload');
  securityFixture.uploadedFileName = uploaded.filename;
  assert.equal(uploaded.url.startsWith(`/api/files/${scenario.tenantA.id}/`), true);

  const { isTenantFileAccessAllowed } = await import('../../lib/fileAccessPolicy');
  assert.equal(isTenantFileAccessAllowed({
    role: 'admin',
    requestedTenantId: scenario.tenantA.id,
    sessionTenantId: scenario.tenantA.id,
  }), true);
  assert.equal(isTenantFileAccessAllowed({
    role: 'admin',
    requestedTenantId: scenario.tenantA.id,
    sessionTenantId: scenario.tenantB.id,
  }), false);
});

test('SEC-008 Aadhaar is masked on customer detail responses', async () => {
  assert.ok(securityFixture.customerA1Id, 'customer exists');
  const fullAadhaar = '123456789012';
  const update = await routeRequest<Envelope<any>>({
    importPath: routes.customerById,
    method: 'PATCH',
    path: `/api/v1/customers/${securityFixture.customerA1Id}`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: securityFixture.customerA1Id },
    body: { aadharNumber: fullAadhaar },
  });
  const updated = expectOk<any>(update, 'update Aadhaar');
  assert.equal(updated.aadharNumber.includes(fullAadhaar), false);

  const detail = await routeRequest<Envelope<any>>({
    importPath: routes.customerById,
    method: 'GET',
    path: `/api/v1/customers/${securityFixture.customerA1Id}`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: securityFixture.customerA1Id },
  });
  const customer = expectOk<any>(detail, 'customer detail Aadhaar masking');
  assert.equal(customer.aadharNumber.includes(fullAadhaar), false);
  assert.equal(detail.text.includes(fullAadhaar), false);
});

test('SEC-009 SQL-injection-style input remains scoped and does not leak data', async () => {
  assert.ok(securityFixture.customerB1Id, 'tenant B customer exists');
  const response = await routeRequest<Envelope<any[]>>({
    importPath: routes.customers,
    method: 'GET',
    path: `/api/v1/customers?page=1&limit=200&q=${encodeURIComponent("' OR 1=1 --")}`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
  });
  const rows = expectOk(response, 'SQL-like search');
  assert.equal(rows.some((row) => row.id === securityFixture.customerB1Id), false);
});

test('SEC-010 XSS payload remains JSON data and does not become executable HTML', async () => {
  assert.ok(securityFixture.customerA1Id, 'customer exists');
  const payload = `<script>window.${scenario.runId.replace(/-/g, '_')}=1</script>`;
  const update = await routeRequest<Envelope<any>>({
    importPath: routes.customerById,
    method: 'PATCH',
    path: `/api/v1/customers/${securityFixture.customerA1Id}`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    branchId: scenario.branchA1.id,
    appType: APP_TYPE,
    params: { id: securityFixture.customerA1Id },
    body: { name: payload },
  });
  const updated = expectOk<any>(update, 'XSS customer update');
  assert.equal(updated.name, payload);
  assert.equal(update.headers.get('content-type')?.includes('application/json'), true);
  assert.equal(update.headers.get('content-type')?.includes('text/html'), false);
});

test('SEC-011 reset-password route rate limit works for repeated attempts', async () => {
  const previousTrustProxy = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = 'true';
  try {
    const email = `${scenario.runId}-rate-limit@example.test`;
    let lastStatus = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await routeRequest<Envelope<unknown>>({
        importPath: routes.resetPassword,
        method: 'POST',
        path: '/api/v1/auth/reset-password',
        headers: { 'x-forwarded-for': scenario.runId },
        body: { email, otp: '000000', newPassword: 'AnotherPass123!' },
      });
      lastStatus = response.status;
    }
    assert.equal(lastStatus, 429, 'fourth reset attempt should be rate limited');
    const rateRows = await getPrisma().rateLimit.findMany({
      where: { key: { contains: scenario.runId } },
    });
    assert.equal(rateRows.length > 0, true, 'rate limit DB rows should use RUN_ID-derived keys');
  } finally {
    if (previousTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previousTrustProxy;
  }
});

test('SEC-013 audit log exists for sensitive customer update', async () => {
  assert.ok(securityFixture.customerA1Id, 'customer exists');
  const audit = await getPrisma().auditLog.findFirst({
    where: {
      tenantId: scenario.tenantA.id,
      entityType: 'customer',
      entityId: securityFixture.customerA1Id,
      action: 'update',
    },
    orderBy: { createdAt: 'desc' },
  });
  assert.ok(audit, 'customer update audit log exists');
  assert.equal(audit.userId, scenario.users.adminA1.id);
});

knownGap(
  'SEC-007 private file route should be directly testable with bearer-token tenant isolation',
  knownGapCatalog.fileRouteNeedsBearerFirstHarness,
  async () => {
    assert.ok(securityFixture.uploadedFileName, 'SEC-007 upload should create a private file first');
    const noToken = await routeRequest({
      importPath: routes.files,
      method: 'GET',
      path: `/api/files/${scenario.tenantA.id}/${securityFixture.uploadedFileName}`,
      params: { path: [scenario.tenantA.id, securityFixture.uploadedFileName] },
    });
    assert.equal(noToken.status, 401, noToken.text);

    const wrongTenant = await routeRequest({
      importPath: routes.files,
      method: 'GET',
      path: `/api/files/${scenario.tenantA.id}/${securityFixture.uploadedFileName}`,
      token: tenantBAdminToken,
      tenantSlug: scenario.tenantB.slug,
      branchId: scenario.branchB1.id,
      appType: APP_TYPE,
      params: { path: [scenario.tenantA.id, securityFixture.uploadedFileName] },
    });
    assert.equal(wrongTenant.status, 403, wrongTenant.text);
  },
);

knownGap(
  'SEC-012 password reset expiry should be observable as a token lifecycle regression test',
  knownGapCatalog.passwordResetExpiryUsesStatelessOtp,
  async () => {
    const resetModule = await import('../../app/api/v1/auth/reset-password/route');
    assert.equal(typeof (resetModule as any).generateOtp, 'function', 'reset OTP generator should be exported for deterministic expiry regression tests');
  },
);

async function main() {
  const runId = getRunId();
  try {
    scenario = await seedLoanTrackScenario(runId);
    adminToken = await issueMobileTokenForSetup(scenario.users.adminA1);
    agentToken = await issueMobileTokenForSetup(scenario.users.agentA1);
    tenantBAdminToken = await issueMobileTokenForSetup(scenario.users.adminB1);
    await setupSecurityFixture();
    const summary = await run();
    writeKnownGapsReport({
      runId,
      source: 'tests/e2e-business/securityAbuse.test.ts',
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
