import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { disconnectTestDb, getPrisma, getRunId } from './helpers/testDb';
import { cleanupRunData } from './helpers/cleanup';
import { borrowerLoginAndVerify, issueMobileTokenForSetup } from './helpers/authTokens';
import { createCustomerFixture, createLoanFixture, seedZoloFundScenario, type ZoloFundScenario } from './helpers/seedZoloFund';
import { routeRequest, expectOk, routes, type Envelope } from './helpers/apiClient';
import { assertMoneyEqual } from './helpers/assertMoney';
import { configureTenantWebhookSecret, collectionPaidPayload, nachPayload, signedRazorpayPayload } from './helpers/webhookFixtures';
import { knownGap, run, test } from './helpers/harness';
import { writeKnownGapEvidence } from './helpers/evidenceWriter';
import { knownGapCatalog } from './helpers/knownGaps';

const runId = getRunId();
const prisma = getPrisma();
const webhookSecret = `${runId}-webhook-secret`;

let scenario: ZoloFundScenario;
let adminToken = '';
let borrowerToken = '';
let loanId = '';
let otherLoanId = '';
let firstInstalmentId = '';
let paymentToken = '';
let providerRef = '';
let mandateId = '';
let presentationId = '';

async function postSignedWebhook(importPath: string, pathName: string, payload: unknown, eventId: string) {
  const signed = signedRazorpayPayload(payload, webhookSecret);
  return routeRequest<any>({
    importPath,
    method: 'POST',
    path: pathName,
    rawBody: signed.rawBody,
    headers: {
      'content-type': 'application/json',
      'x-razorpay-signature': signed.signature,
      'x-razorpay-event-id': eventId,
    },
  });
}

test('PAY-001/PAY-002 borrower OTP login and own-loan scope use actual borrower routes', async () => {
  const borrowerCustomer = await createCustomerFixture(scenario, {
    key: 'pay-borrower',
    phoneOffset: 810,
    status: 'active',
  });
  const borrowerLoan = await createLoanFixture(scenario, {
    key: 'pay-borrower',
    customerId: borrowerCustomer.id,
    principal: 5000,
    tenure: 5,
  });
  const otherCustomer = await createCustomerFixture(scenario, {
    key: 'pay-other',
    phoneOffset: 811,
    status: 'active',
  });
  const otherLoan = await createLoanFixture(scenario, {
    key: 'pay-other',
    customerId: otherCustomer.id,
    principal: 7000,
    tenure: 7,
  });

  loanId = borrowerLoan.id;
  otherLoanId = otherLoan.id;
  firstInstalmentId = borrowerLoan.instalments[0]!.id;
  const borrower = await borrowerLoginAndVerify({ phone: borrowerCustomer.phone, tenantSlug: scenario.tenantA.slug });
  borrowerToken = borrower.token;
  assert.equal(borrower.customerId, borrowerCustomer.id);
  assert.equal(borrower.loanId, loanId);

  const loans = await routeRequest<Envelope<Array<{ id: string; instalments: any[] }>>>({
    importPath: routes.borrowerLoans,
    method: 'GET',
    path: '/api/v1/borrower/loans',
    token: borrowerToken,
    tenantSlug: scenario.tenantA.slug,
    appType: 'borrower',
  });
  const rows = expectOk(loans);
  assert.equal(rows.some((loan) => loan.id === loanId), true);
  assert.equal(rows.some((loan) => loan.id === otherLoanId), false, 'borrower must not see another borrower loan');
});

test('PAY-004 staff creates self-pay link without live Razorpay when gateway disabled', async () => {
  const response = await routeRequest<Envelope<{ token: string; payUrl: string; amount: number; mock: boolean }>>({
    importPath: routes.collectionSelfPayLink,
    method: 'POST',
    path: '/api/v1/collection/self-pay/link',
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    body: { instalmentId: firstInstalmentId, amount: 1000, channel: 'upi' },
  });
  const link = expectOk(response);
  paymentToken = link.token;
  providerRef = link.payUrl.split('/').pop() || `${runId}-provider`;
  assert.equal(link.amount, 1000);
  assert.equal(link.mock, true, 'test gateway is disabled, so self-pay link should use mock/internal mode');

  const dbToken = await prisma.clientPaymentToken.findUniqueOrThrow({ where: { token: paymentToken } });
  assert.equal(dbToken.status, 'active');
  assertMoneyEqual(dbToken.amount, 1000, 'self-pay token amount persisted');
});

test('PAY-005/PAY-006/PAY-007 signed Razorpay collection webhook posts once and duplicate replay is idempotent', async () => {
  const beforeEntries = await prisma.collectionEntry.count({ where: { loanId, source: 'self_pay_upi' } });
  const beforeLedgers = await prisma.journalEntry.count({ where: { tenantId: scenario.tenantA.id } }).catch(() => 0);
  const payload = collectionPaidPayload({
    runId,
    tenantId: scenario.tenantA.id,
    token: paymentToken,
    providerRef,
    paymentId: `${runId}-rzp-pay-1`,
    amountPaise: 100000,
  });

  const invalid = await routeRequest<any>({
    importPath: routes.webhookRazorpayCollections,
    method: 'POST',
    path: '/api/webhooks/razorpay/collections',
    rawBody: JSON.stringify(payload),
    headers: {
      'content-type': 'application/json',
      'x-razorpay-signature': 'bad-signature',
      'x-razorpay-event-id': `${runId}-collection-event-1-invalid`,
    },
  });
  assert.equal(invalid.status, 401, invalid.text);

  const first = await postSignedWebhook(
    routes.webhookRazorpayCollections,
    '/api/webhooks/razorpay/collections',
    payload,
    `${runId}-collection-event-1`,
  );
  assert.equal(first.status, 200, first.text);
  assert.equal(first.body.ok, true);

  const afterFirstEntries = await prisma.collectionEntry.count({ where: { loanId, source: 'self_pay_upi' } });
  assert.equal(afterFirstEntries, beforeEntries + 1, 'first webhook creates one self-pay collection entry');
  const paidToken = await prisma.clientPaymentToken.findUniqueOrThrow({ where: { token: paymentToken } });
  assert.equal(paidToken.status, 'paid');

  const duplicate = await postSignedWebhook(
    routes.webhookRazorpayCollections,
    '/api/webhooks/razorpay/collections',
    payload,
    `${runId}-collection-event-1`,
  );
  assert.equal(duplicate.status, 200, duplicate.text);
  assert.equal(duplicate.body.duplicate, true);

  assert.equal(await prisma.collectionEntry.count({ where: { loanId, source: 'self_pay_upi' } }), afterFirstEntries);
  assert.equal(
    (await prisma.journalEntry.count({ where: { tenantId: scenario.tenantA.id } }).catch(() => beforeLedgers)) >= beforeLedgers,
    true,
  );
});

test('PAY-008/PAY-009 NACH mandate detail/cancel path is safe when no provider token exists', async () => {
  const mandate = await prisma.nachMandate.create({
    data: {
      tenantId: scenario.tenantA.id,
      loanId,
      customerId: (await prisma.loan.findUniqueOrThrow({ where: { id: loanId } })).customerId,
      razorpayOrderId: `${runId}-nach-auth-order`,
      accountHolderName: `${runId} Borrower`,
      accountNumber: `${runId}000111222`,
      accountType: 'savings',
      ifscCode: 'HDFC0001234',
      bankName: `${runId}-Bank`,
      maxAmount: 5000,
      status: 'pending_auth',
      createdById: scenario.users.adminA1.id,
    },
  });
  mandateId = mandate.id;

  const detail = await routeRequest<any>({
    importPath: routes.nachMandateById,
    method: 'GET',
    path: `/api/v1/nach/mandate/${mandate.id}`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    params: { id: mandate.id },
  });
  assert.equal(detail.status, 200, detail.text);
  assert.equal(detail.body.data.id, mandate.id);

  const cancel = await routeRequest<any>({
    importPath: routes.nachMandateById,
    method: 'DELETE',
    path: `/api/v1/nach/mandate/${mandate.id}`,
    token: adminToken,
    tenantSlug: scenario.tenantA.slug,
    params: { id: mandate.id },
    body: { reason: `${runId} cancel test` },
  });
  assert.equal(cancel.status, 200, cancel.text);
  const dbMandate = await prisma.nachMandate.findUniqueOrThrow({ where: { id: mandate.id } });
  assert.equal(dbMandate.status, 'cancelled');
});

knownGap('PAY-GAP-005 signed NACH success webhook uses invalid system actor for collection posting', {
  id: 'PAY-GAP-005',
  classification: 'P0',
  currentBehavior: 'NACH payment.captured webhook delegates to handlePresentationSuccess, which calls submitCollectionEntry with userId/agentId "system"; DailyCollection.agentId is a User FK.',
  expectedBehavior: 'NACH success should post one collection using a valid tenant/system actor or accounting path and duplicate replay should be idempotent.',
  evidenceSource: 'app/api/webhooks/razorpay/nach/route.ts; lib/nach.ts handlePresentationSuccess; lib/collectionWrite.ts recordCollection',
  businessImpact: 'Successful NACH debits can be acknowledged by webhook but fail to create the collection/allocation when no system user exists, leaving money unreconciled.',
  fixedAssertion: 'First signed NACH success creates exactly one collection/allocation and duplicate replay leaves all money rows unchanged.',
}, async () => {
  const activeMandate = await prisma.nachMandate.update({
    where: { id: mandateId },
    data: {
      status: 'active',
      razorpayTokenId: `${runId}-nach-token`,
      razorpayOrderId: `${runId}-nach-order`,
      razorpayPaymentId: `${runId}-nach-auth-payment`,
      activatedAt: new Date(),
    },
  });
  const instalment = await prisma.instalment.findFirstOrThrow({ where: { loanId, status: { not: 'paid' } } });
  const presentation = await prisma.nachPresentation.create({
    data: {
      tenantId: scenario.tenantA.id,
      mandateId: activeMandate.id,
      loanId,
      instalmentId: instalment.id,
      amount: 1000,
      status: 'submitted',
      razorpayOrderId: `${runId}-nach-present-order-1`,
      razorpayPaymentId: `${runId}-nach-present-payment-1`,
    },
  });
  presentationId = presentation.id;

  const beforeEntries = await prisma.collectionEntry.count({ where: { loanId } });
  const successPayload = nachPayload({
    runId,
    tenantId: scenario.tenantA.id,
    event: 'payment.captured',
    paymentId: `${runId}-nach-present-payment-1`,
    orderId: `${runId}-nach-present-order-1`,
    amountPaise: 100000,
    tokenId: `${runId}-nach-token`,
  });
  const success = await postSignedWebhook(
    routes.webhookRazorpayNach,
    '/api/webhooks/razorpay/nach',
    successPayload,
    `${runId}-nach-success-1`,
  );
  assert.equal(success.status, 200, success.text);
  const afterSuccessEntries = await prisma.collectionEntry.count({ where: { loanId } });
  assert.equal(afterSuccessEntries, beforeEntries + 1, 'NACH success creates one collection entry');
  const duplicateSuccess = await postSignedWebhook(
    routes.webhookRazorpayNach,
    '/api/webhooks/razorpay/nach',
    successPayload,
    `${runId}-nach-success-1`,
  );
  assert.equal(duplicateSuccess.status, 200, duplicateSuccess.text);
  assert.equal(await prisma.collectionEntry.count({ where: { loanId } }), afterSuccessEntries);

});

test('PAY-012 signed NACH failure webhook is idempotent on duplicate replay', async () => {
  const activeMandate = await prisma.nachMandate.findUniqueOrThrow({ where: { id: mandateId } });
  const instalment = await prisma.instalment.findFirstOrThrow({ where: { loanId, status: { not: 'paid' } } });
  const failed = await prisma.nachPresentation.create({
    data: {
      tenantId: scenario.tenantA.id,
      mandateId: activeMandate.id,
      loanId,
      instalmentId: instalment.id,
      amount: 1000,
      status: 'submitted',
      razorpayOrderId: `${runId}-nach-present-order-2`,
      razorpayPaymentId: `${runId}-nach-present-payment-2`,
    },
  });
  const failurePayload = nachPayload({
    runId,
    tenantId: scenario.tenantA.id,
    event: 'payment.failed',
    paymentId: `${runId}-nach-present-payment-2`,
    orderId: `${runId}-nach-present-order-2`,
  });
  const failure = await postSignedWebhook(
    routes.webhookRazorpayNach,
    '/api/webhooks/razorpay/nach',
    failurePayload,
    `${runId}-nach-failure-1`,
  );
  assert.equal(failure.status, 200, failure.text);
  const failedAfter = await prisma.nachPresentation.findUniqueOrThrow({ where: { id: failed.id } });
  assert.equal(failedAfter.status, 'failed');
  const duplicateFailure = await postSignedWebhook(
    routes.webhookRazorpayNach,
    '/api/webhooks/razorpay/nach',
    failurePayload,
    `${runId}-nach-failure-1`,
  );
  assert.equal(duplicateFailure.status, 200, duplicateFailure.text);
  const failedDup = await prisma.nachPresentation.findUniqueOrThrow({ where: { id: failed.id } });
  assert.equal(failedDup.retryCount, failedAfter.retryCount, 'duplicate NACH failure must not increment retry count twice');
});

knownGap('PAY-GAP-001 borrower mobile statement route coverage is missing', {
  id: 'PAY-GAP-003',
  classification: 'P2',
  currentBehavior: 'Borrower statement exists under app/api/borrower/statement and is not wired into the mobile bearer-token v1 harness.',
  expectedBehavior: 'Borrower mobile E2E can fetch a statement and compare totals against DB allocations.',
  evidenceSource: 'app/api/borrower/statement/route.tsx; app/api/v1/borrower/loans/route.ts',
  businessImpact: 'Borrower payment totals are covered by loan scope and DB checks but not by a dedicated borrower statement route assertion.',
  fixedAssertion: 'A borrower bearer-token statement response lists only own loan rows and totals equal DB payment allocations.',
}, async () => {
  const statementPath = path.join(process.cwd(), 'app', 'api', 'v1', 'borrower', 'statement', 'route.ts');
  assert.equal(existsSync(statementPath), true, 'v1 borrower statement route is missing');
});

knownGap('PAY-GAP-002 NACH present route calls live provider without a sandbox handler', knownGapCatalog.providerOnlyLiveRoute, async () => {
  const source = readFileSync(path.join(process.cwd(), 'app', 'api', 'v1', 'nach', 'present', 'route.ts'), 'utf8');
  assert.equal(/presentPayment\(/.test(source), false, 'NACH present route delegates to provider-backed presentPayment');
});

knownGap('PAY-GAP-004 duplicate loan-level collection replay can allocate to the next instalment', knownGapCatalog.duplicateCollectionReplayDoubleCounts, async () => {
  const source = readFileSync(path.join(process.cwd(), 'lib', 'collectionWrite.ts'), 'utf8');
  assert.equal(
    /baseKey.*instalment|idempotencyKey.*instalmentId|distributeCollectionAcrossLoan/s.test(source),
    false,
    'loan-level replay still derives per-instalment idempotency and can advance to the next open instalment',
  );
});

async function main() {
  try {
    scenario = await seedZoloFundScenario(runId);
    await configureTenantWebhookSecret(scenario.tenantA.id, webhookSecret);
    adminToken = await issueMobileTokenForSetup(scenario.users.adminA1);
    const summary = await run();
    await writeKnownGapEvidence(runId, summary, 'tests/e2e-business/borrowerPaymentsNach.test.ts');
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
