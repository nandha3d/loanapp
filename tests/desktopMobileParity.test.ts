import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

function source(path: string): string {
  assert.equal(existsSync(path), true, `File must exist: ${path}`);
  return readFileSync(path, 'utf8');
}

console.log('--- Running Desktop vs Mobile Architectural Parity Test Suite ---');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Tenant Scoping (SCOPE-1, SCOPE-2, AUTH-1, AUTH-2)
// ─────────────────────────────────────────────────────────────────────────────
console.log('1. Verifying Tenant Scoping on Auth & Dashboard...');

// app/api/v1/auth/login/route.ts
const authLoginSrc = source('app/api/v1/auth/login/route.ts');
assert.match(
  authLoginSrc,
  /TENANT_REQUIRED/,
  'Login must detect ambiguous credentials across tenants and return 409 TENANT_REQUIRED',
);
assert.match(
  authLoginSrc,
  /body\.tenantSlug/,
  'Login must accept tenantSlug from body',
);
assert.match(
  authLoginSrc,
  /user\.tenant\.status !== 'active'/,
  'Login must ensure tenant is active before issuing token',
);

// app/api/v1/dashboard/route.ts
const dashboardSrc = source('app/api/v1/dashboard/route.ts');
assert.match(
  dashboardSrc,
  /where:\s*\{\s*id:\s*topRepayer\[0\]\.customerId,\s*tenantId:\s*ctx\.tenantId\s*\}/,
  'Dashboard bestPayer lookup must include tenantId: ctx.tenantId to prevent cross-tenant leak',
);

// mobile Auth Service & Repo
const mobileAuthService = source('mobile/lib/data/services/auth_service.dart');
assert.match(
  mobileAuthService,
  /String\?\s*tenantSlug/,
  'mobile auth service must support tenantSlug parameter',
);

const mobileAuthRepo = source('mobile/lib/data/repositories/auth_repository.dart');
assert.match(
  mobileAuthRepo,
  /String\?\s*tenantSlug/,
  'mobile auth repository must support tenantSlug parameter',
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Module Isolation (SCOPE-3, SCOPE-4, SCOPE-14)
// ─────────────────────────────────────────────────────────────────────────────
console.log('2. Verifying Module Isolation across Customers, Penalties, and NPA...');

// app/api/v1/customers/route.ts
const customersSrc = source('app/api/v1/customers/route.ts');
assert.match(
  customersSrc,
  /tenantId:\s*ctx\.tenantId,\s*appType:\s*ctx\.appType/s,
  'Customer loan stats groupBy must scope by tenantId AND appType',
);
assert.match(
  customersSrc,
  /id:\s*resolvedRouteId,\s*tenantId:\s*ctx\.tenantId,\s*appType:\s*ctx\.appType/,
  'Customer route assignment must verify route belongs to ctx.appType',
);

// app/api/v1/customers/[id]/route.ts
const customerDetailSrc = source('app/api/v1/customers/[id]/route.ts');
assert.match(
  customerDetailSrc,
  /id:\s*data\.routeId,\s*tenantId:\s*ctx\.tenantId,\s*appType:\s*ctx\.appType/,
  'Customer route update must verify target route belongs to ctx.appType',
);

// app/api/v1/penalties/route.ts
const penaltiesSrc = source('app/api/v1/penalties/route.ts');
assert.match(
  penaltiesSrc,
  /appType:\s*ctx\.appType,\s*\.\.\.scopedBranchWhere\(ctx\)/,
  'Penalty origination must scope target loan by appType and scopedBranchWhere',
);
assert.match(
  penaltiesSrc,
  /if\s*\(!\['admin',\s*'superadmin',\s*'developer'\]\.includes\(ctx\.role\)\)\s*\{\s*return fail\('Forbidden',\s*403\);\s*\}/,
  'Penalties GET must restrict access to admin, superadmin, developer roles (ROLE-4)',
);

// lib/npa/npaService.ts
const npaServiceSrc = source('lib/npa/npaService.ts');
assert.match(
  npaServiceSrc,
  /const NPA_ROLES = new Set\(\['admin', 'superadmin', 'developer'\]\);/,
  'NPA_ROLES must include developer (ROLE-1)',
);
assert.match(
  npaServiceSrc,
  /if\s*\(actor\.appType\)\s*\{\s*where\.appType = actor\.appType;\s*\}/,
  'NPA list and loan assertions must enforce actor.appType',
);
assert.match(
  npaServiceSrc,
  /if\s*\(actor\.branchId && actor\.role !== 'superadmin' && actor\.role !== 'developer'\)\s*\{\s*where\.branchId = actor\.branchId;\s*\}/,
  'NPA list and loan assertions must enforce branch scoping for branch admins',
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Branch Isolation & Write Stamping (SCOPE-3, SCOPE-7, SCOPE-11, SCOPE-13)
// ─────────────────────────────────────────────────────────────────────────────
console.log('3. Verifying Branch Isolation & Subject-Route Write Stamping...');

// app/api/v1/loans/[id]/route.ts
const loanDetailSrc = source('app/api/v1/loans/[id]/route.ts');
assert.match(
  loanDetailSrc,
  /buildAgentCustomerAccessWhere\(\{ userId: ctx\.userId \}\)/,
  'Loan PATCH must use customer linkage for agents',
);
assert.match(
  loanDetailSrc,
  /where:\s*\{\s*id:\s*loanId,\s*tenantId:\s*ctx\.tenantId,\s*appType:\s*ctx\.appType,\s*\.\.\.scopedBranchWhere\(ctx\)\s*\}/,
  'Loan PUT must enforce scopedBranchWhere(ctx)',
);

// app/api/v1/wallet/release/route.ts
const walletReleaseSrc = source('app/api/v1/wallet/release/route.ts');
assert.match(
  walletReleaseSrc,
  /where:\s*\{\s*id:\s*agentId,\s*tenantId:\s*ctx\.tenantId,\s*role:\s*'agent',\s*status:\s*'active',\s*\.\.\.scopedBranchWhere\(ctx\)\s*\}/,
  'Wallet float release must verify recipient agent belongs to scopedBranchWhere(ctx)',
);

// app/api/v1/wallet/branch/route.ts
const walletBranchSrc = source('app/api/v1/wallet/branch/route.ts');
assert.match(
  walletBranchSrc,
  /where:\s*\{\s*id:\s*branchId,\s*tenantId:\s*ctx\.tenantId,\s*\.\.\.scopedBranchWhere\(ctx\)\s*\}/,
  'Wallet branch cash injection must verify target branch matches scopedBranchWhere(ctx)',
);

// app/api/v1/approvals/[id]/approve/route.ts & reject/route.ts
const approveSrc = source('app/api/v1/approvals/[id]/approve/route.ts');
assert.match(
  approveSrc,
  /status:\s*'pending_review',\s*\.\.\.scopedBranchWhere\(ctx\)/,
  'Approvals approve must scope pending customer and loan by scopedBranchWhere(ctx)',
);
assert.match(
  approveSrc,
  /requestWhere\.requestedBy = \{\s*branchId:\s*ctx\.branchId\s*\}/,
  'Approvals approve must scope general approval requests by branch for admin',
);

const rejectSrc = source('app/api/v1/approvals/[id]/reject/route.ts');
assert.match(
  rejectSrc,
  /status:\s*'pending_review',\s*\.\.\.scopedBranchWhere\(ctx\)/,
  'Approvals reject must scope pending customer and loan by scopedBranchWhere(ctx)',
);

// app/api/v1/routes/route.ts
const routesSrc = source('app/api/v1/routes/route.ts');
assert.doesNotMatch(
  routesSrc,
  /routeBranchScope/,
  'routeBranchScope widening { OR: [{ branchId }, { branchId: null }] } must be removed (X-3)',
);
assert.match(
  routesSrc,
  /Object\.assign\(where,\s*scopedBranchWhere\(ctx\)\)/,
  'Routes GET must cleanly scope by scopedBranchWhere(ctx)',
);

// app/api/v1/gps/live/route.ts & history/[id]/route.ts
const gpsLiveSrc = source('app/api/v1/gps/live/route.ts');
assert.match(
  gpsLiveSrc,
  /if\s*\(ctx\.branchId && ctx\.role === 'admin'\)\s*\{\s*agentWhere\.branchId = ctx\.branchId;\s*\}/,
  'Live GPS must scope agents by branch for branch admins',
);

const gpsHistorySrc = source('app/api/v1/gps/history/[id]/route.ts');
assert.match(
  gpsHistorySrc,
  /if\s*\(auth\.context\.branchId && auth\.context\.role === 'admin'\)\s*\{\s*const targetAgent = await prisma\.user\.findFirst/,
  'GPS history must verify target agent belongs to branch for branch admins',
);

// lib/collectionRun.ts
const collectionRunSrc = source('lib/collectionRun.ts');
assert.match(
  collectionRunSrc,
  /branchId:\s*route\?\.branchId \?\? actor\.branchId \?\? null/,
  'collectionRun.create must stamp route.branchId per SCOPE-7 and SCOPE-13',
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Agent Customer Linkage (SCOPE-5)
// ─────────────────────────────────────────────────────────────────────────────
console.log('4. Verifying Agent Customer Linkage on Loan Origination...');

// app/api/v1/loans/route.ts
const loansSrc = source('app/api/v1/loans/route.ts');
assert.match(
  loansSrc,
  /customerWhere\.AND = \[buildAgentCustomerAccessWhere\(\{ userId: ctx\.userId \}\)\]/,
  'Loan origination must use buildAgentCustomerAccessWhere for agents instead of forcing branch scope',
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. Role Hierarchy & Agent Restrictions (ROLE-1, ROLE-4, API-4)
// ─────────────────────────────────────────────────────────────────────────────
console.log('5. Verifying Role Gating on Reports, Analytics, Accounting, and Penalties...');

// app/api/v1/reports/agent/route.ts
const reportsAgentSrc = source('app/api/v1/reports/agent/route.ts');
assert.match(
  reportsAgentSrc,
  /if\s*\(ctx\.role === 'agent'\)\s*\{\s*return fail\('Forbidden',\s*403\);\s*\}/,
  'Agent report must reject agents with 403',
);

// app/api/v1/reports/daily/route.ts
const reportsDailySrc = source('app/api/v1/reports/daily/route.ts');
assert.match(
  reportsDailySrc,
  /if\s*\(ctx\.role === 'agent'\)\s*\{\s*return fail\('Forbidden',\s*403\);\s*\}/,
  'Daily collections report must reject agents with 403',
);

// app/api/v1/analytics/summary/route.ts
const analyticsSummarySrc = source('app/api/v1/analytics/summary/route.ts');
assert.match(
  analyticsSummarySrc,
  /if\s*\(ctx\.role === 'agent'\)\s*\{\s*return fail\('Forbidden',\s*403\);\s*\}/,
  'Analytics summary must reject agents with 403',
);

// app/api/v1/accounting/route.ts
const accountingSrc = source('app/api/v1/accounting/route.ts');
assert.match(
  accountingSrc,
  /if\s*\(!\['admin',\s*'superadmin',\s*'developer'\]\.includes\(ctx\.role\)\)\s*\{\s*return fail\('Forbidden',\s*403\);\s*\}/,
  'Accounting GET must reject agents with 403',
);

// mobile/lib/features/more/more_screen.dart
const moreScreenSrc = source('mobile/lib/features/more/more_screen.dart');
assert.match(
  moreScreenSrc,
  /route:\s*'\/penalties',\s*moduleKey:\s*'penalties',\s*minRole:\s*UserRole\.admin/,
  'Penalties tile in More screen must require penalties moduleKey and admin minRole',
);
assert.doesNotMatch(
  moreScreenSrc,
  /dailyWorkRoutes\s*=\s*\{[^}]*\/penalties[^}]*\}/,
  'Penalties must NOT be present in dailyWorkRoutes',
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. API Contract Parity (API-1, API-2, API-3)
// ─────────────────────────────────────────────────────────────────────────────
console.log('6. Verifying API Contract Parity in Reports Route...');

// app/api/v1/reports/[slug]/route.ts
const reportSlugSrc = source('app/api/v1/reports/[slug]/route.ts');
assert.doesNotMatch(
  reportSlugSrc,
  /requireApiContext/,
  'reports/[slug] must not use NextAuth cookie-only requireApiContext',
);
assert.match(
  reportSlugSrc,
  /resolveActor/,
  'reports/[slug] must use resolveActor to support both Bearer JWT and web session',
);
assert.match(
  reportSlugSrc,
  /if\s*\(context\.role === 'agent'\)\s*\{\s*return fail\('Forbidden',\s*403\);\s*\}/,
  'reports/[slug] must block agent role with 403',
);
assert.match(
  reportSlugSrc,
  /\bok\(payload\)|\bfail\(/,
  'reports/[slug] must return standard v1 envelope (ok/fail)',
);

console.log('--- ALL DESKTOP VS MOBILE PARITY CHECKS PASSED (24/24) ---');
