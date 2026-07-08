import assert from 'node:assert/strict';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
import { NextRequest } from 'next/server';
import { requireTestDatabaseUrl } from './testDb';

const shimPath = fileURLToPath(new URL('./serverOnlyShim.cjs', import.meta.url));
const moduleGlobal = globalThis as typeof globalThis & { __businessE2eServerOnlyShim?: boolean };
if (!moduleGlobal.__businessE2eServerOnlyShim) {
  const originalResolve = (Module as any)._resolveFilename;
  (Module as any)._resolveFilename = function resolveBusinessE2eShim(request: string, ...args: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return shimPath;
    return originalResolve.call(this, request, ...args);
  };
  moduleGlobal.__businessE2eServerOnlyShim = true;
}

export type ApiResponse<T = unknown> = {
  status: number;
  headers: Headers;
  body: T;
  text: string;
};

type RequestOptions = {
  importPath: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  token?: string;
  tenantSlug?: string | null;
  branchId?: string | null;
  appType?: string | null;
  body?: unknown;
  rawBody?: string;
  params?: Record<string, string | string[]>;
  headers?: Record<string, string>;
};

function buildRequest(options: RequestOptions) {
  const headers = new Headers(options.headers ?? {});
  if (options.token) headers.set('authorization', `Bearer ${options.token}`);
  if (options.tenantSlug) headers.set('x-tenant-slug', options.tenantSlug);
  if (options.branchId) headers.set('x-branch-id', options.branchId);
  if (options.appType) headers.set('x-app-type', options.appType);

  let body: BodyInit | undefined;
  if (options.rawBody !== undefined) {
    body = options.rawBody;
  } else if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers.set('content-type', 'application/json');
  }

  return new NextRequest(new URL(options.path, 'http://localhost:3000'), {
    method: options.method,
    headers,
    body,
  });
}

export async function routeRequest<T = unknown>(options: RequestOptions): Promise<ApiResponse<T>> {
  requireTestDatabaseUrl();
  const mod = await import(options.importPath);
  const handler = mod[options.method] as Function | undefined;
  assert.equal(typeof handler, 'function', `${options.importPath} does not export ${options.method}`);

  const req = buildRequest(options);
  const response: Response = options.params
    ? await handler(req, { params: Promise.resolve(options.params) })
    : await handler(req);

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { status: response.status, headers: response.headers, body: body as T, text };
}

export type Envelope<T> = {
  data: T | null;
  error: string | null;
  pagination: unknown | null;
};

export function expectOk<T>(response: ApiResponse<Envelope<T>>, message?: string): T {
  const label = message ? `${message}: ${response.text}` : response.text;
  assert.equal(response.status >= 200 && response.status < 300, true, label);
  assert.equal(response.body.error, null, label);
  assert.notEqual(response.body.data, null, label);
  return response.body.data as T;
}

export function expectError(response: ApiResponse<Envelope<unknown>>, statuses: number[], label: string) {
  assert.equal(
    statuses.includes(response.status),
    true,
    `${label}: expected ${statuses.join('/')} but got ${response.status}: ${response.text}`,
  );
  assert.notEqual(response.body.error, null, `${label}: expected envelope error`);
}

export const routes = {
  authLogin: '../../../app/api/v1/auth/login/route.ts',
  authMe: '../../../app/api/v1/auth/me/route.ts',
  authLogout: '../../../app/api/v1/auth/logout/route.ts',
  adminUsers: '../../../app/api/v1/admin/users/route.ts',
  borrowerLogin: '../../../app/api/v1/borrower/auth/login/route.ts',
  borrowerVerify: '../../../app/api/v1/borrower/auth/verify/route.ts',
  borrowerLoans: '../../../app/api/v1/borrower/loans/route.ts',
  customers: '../../../app/api/v1/customers/route.ts',
  customerById: '../../../app/api/v1/customers/[id]/route.ts',
  approvals: '../../../app/api/v1/approvals/route.ts',
  approvalApprove: '../../../app/api/v1/approvals/[id]/approve/route.ts',
  approvalReject: '../../../app/api/v1/approvals/[id]/reject/route.ts',
  kycQueue: '../../../app/api/v1/kyc/queue/route.ts',
  kycReview: '../../../app/api/v1/kyc/[customerId]/review/route.ts',
  upload: '../../../app/api/v1/upload/route.ts',
  packages: '../../../app/api/v1/packages/route.ts',
  loanCalculate: '../../../app/api/v1/loans/calculate/route.ts',
  loans: '../../../app/api/v1/loans/route.ts',
  loanById: '../../../app/api/v1/loans/[id]/route.ts',
  loanInstalments: '../../../app/api/v1/loans/[id]/instalments/route.ts',
  loanStatement: '../../../app/api/v1/loans/[id]/statement/route.ts',
  collectionCollect: '../../../app/api/v1/collection/collect/route.ts',
  collectionEntry: '../../../app/api/v1/collection/entry/route.ts',
  collectionHandover: '../../../app/api/v1/collection/handover/route.ts',
  collectionDashboard: '../../../app/api/v1/collection/dashboard/route.ts',
  dailyReport: '../../../app/api/v1/reports/daily/route.ts',
  agentReport: '../../../app/api/v1/reports/agent/route.ts',
  overdueReport: '../../../app/api/v1/reports/overdue/route.ts',
  genericReport: '../../../app/api/v1/reports/[slug]/route.ts',
  genericReportExport: '../../../app/api/v1/reports/[slug]/export/route.ts',
  accounting: '../../../app/api/v1/accounting/route.ts',
  receipt: '../../../app/api/v1/receipts/[entryId]/route.ts',
  files: '../../../app/api/files/[...path]/route.ts',
  forgotPassword: '../../../app/api/v1/auth/forgot-password/route.ts',
  resetPassword: '../../../app/api/v1/auth/reset-password/route.ts',
  dashboard: '../../../app/api/v1/dashboard/route.ts',
  penalties: '../../../app/api/v1/penalties/route.ts',
  penaltyWaive: '../../../app/api/v1/penalties/[id]/waive/route.ts',
  penaltySettle: '../../../app/api/v1/penalties/[id]/settle/route.ts',
  loanPreclose: '../../../app/api/v1/loans/[id]/preclose/route.ts',
  loanClose: '../../../app/api/v1/loans/[id]/close/route.ts',
  foreclosureCalc: '../../../app/api/loans/[id]/foreclosure-calc/route.ts',
  cronAccruePenalties: '../../../app/api/cron/accrue-penalties/route.ts',
  cronNpaClassify: '../../../app/api/cron/npa-classify/route.ts',
  cronSendReminders: '../../../app/api/cron/send-reminders/route.ts',
  cronReports: '../../../app/api/cron/reports/route.ts',
  cronSubscriptionReminders: '../../../app/api/cron/subscription-reminders/route.ts',
  cronGpsPurge: '../../../app/api/cron/gps-purge/route.ts',
  cronNachPresent: '../../../app/api/cron/nach-present/route.ts',
  cronRecomputeBalances: '../../../app/api/cron/recompute-balances/route.ts',
  npaSummary: '../../../app/api/v1/npa/summary/route.ts',
  npaLoans: '../../../app/api/v1/npa/loans/route.ts',
  npaHistory: '../../../app/api/v1/npa/history/route.ts',
  goldMaster: '../../../app/api/v1/gold/master/route.ts',
  goldRate: '../../../app/api/v1/gold/rate/route.ts',
  goldConfig: '../../../app/api/v1/gold/config/route.ts',
  goldReports: '../../../app/api/v1/gold/reports/route.ts',
  goldServicing: '../../../app/api/v1/gold/loans/[id]/servicing/route.ts',
  goldRepledge: '../../../app/api/v1/gold/loans/[id]/repledge/route.ts',
  goldReceipt: '../../../app/api/loans/[id]/gold-receipt/route.ts',
  borrowerPay: '../../../app/api/v1/borrower/pay/route.ts',
  collectionSelfPay: '../../../app/api/v1/collection/self-pay/route.ts',
  collectionSelfPayLink: '../../../app/api/v1/collection/self-pay/link/route.ts',
  webhookRazorpayCollections: '../../../app/api/webhooks/razorpay/collections/route.ts',
  webhookRazorpayNach: '../../../app/api/webhooks/razorpay/nach/route.ts',
  nachMandate: '../../../app/api/v1/nach/mandate/route.ts',
  nachMandateById: '../../../app/api/v1/nach/mandate/[id]/route.ts',
  nachPresent: '../../../app/api/v1/nach/present/route.ts',
  nachLoan: '../../../app/api/v1/nach/loan/[loanId]/route.ts',
  gpsPing: '../../../app/api/v1/gps/ping/route.ts',
  walletMe: '../../../app/api/v1/wallet/me/route.ts',
  vehicles: '../../../app/api/v1/vehicles/route.ts',
  vehicleById: '../../../app/api/v1/vehicles/[id]/route.ts',
  productRepossession: '../../../app/api/v1/loans/[id]/product-repossession/route.ts',
  chits: '../../../app/api/v1/chits/route.ts',
  chitById: '../../../app/api/v1/chits/[id]/route.ts',
  chitActivate: '../../../app/api/v1/chits/[id]/activate/route.ts',
  chitMembers: '../../../app/api/v1/chits/[id]/members/route.ts',
  chitMemberById: '../../../app/api/v1/chits/[id]/members/[memberId]/route.ts',
  chitMemberAgreement: '../../../app/api/v1/chits/[id]/members/[memberId]/agreement/route.ts',
  chitAuctions: '../../../app/api/v1/chits/[id]/auctions/route.ts',
  chitAuctionBids: '../../../app/api/v1/chits/[id]/auctions/[auctionId]/bids/route.ts',
  chitAuctionAttendance: '../../../app/api/v1/chits/[id]/auctions/[auctionId]/attendance/route.ts',
  chitAuctionConfirm: '../../../app/api/v1/chits/[id]/auctions/[auctionId]/confirm/route.ts',
  chitAuctionDraw: '../../../app/api/v1/chits/[id]/auctions/[auctionId]/draw/route.ts',
  chitAuctionLive: '../../../app/api/v1/chits/[id]/auctions/[auctionId]/live/route.ts',
  chitAuctionRoom: '../../../app/api/v1/chits/[id]/auctions/[auctionId]/room/route.ts',
  chitAuctionSecurity: '../../../app/api/v1/chits/[id]/auctions/[auctionId]/security/route.ts',
  chitAuctionPayout: '../../../app/api/v1/chits/[id]/auctions/[auctionId]/payout/route.ts',
  chitPayments: '../../../app/api/v1/chits/[id]/payments/route.ts',
  chitCancel: '../../../app/api/v1/chits/[id]/cancel/route.ts',
  chitSubscriptions: '../../../app/api/v1/chits/[id]/subscriptions/route.ts',
  chitMiss: '../../../app/api/v1/chits/subscriptions/[id]/miss/route.ts',
  chitPenalties: '../../../app/api/v1/chits/[id]/penalties/route.ts',
  chitPenaltyPay: '../../../app/api/v1/chits/[id]/penalties/[penaltyId]/pay/route.ts',
  chitPenaltyWaive: '../../../app/api/v1/chits/[id]/penalties/[penaltyId]/waive/route.ts',
  chitReceiptReverse: '../../../app/api/v1/chits/receipts/[receiptId]/reverse/route.ts',
};
