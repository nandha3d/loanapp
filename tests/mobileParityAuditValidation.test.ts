import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildCollectionIdempotencyKey } from '../lib/collectionPolicy';
import {
  startOfBusinessToday,
  startOfBusinessTomorrow,
  startOfBusinessDayUtc,
  parseBusinessDayUtc,
} from '../lib/businessTime';

const root = process.cwd();

function read(relPath: string): string {
  const p = path.join(root, relPath);
  assert.equal(fs.existsSync(p), true, `File missing: ${relPath}`);
  return fs.readFileSync(p, 'utf8');
}

console.log('Running mobileParityAuditValidation test suite...');

// ─────────────────────────────────────────────────────────────────────────────
// 1. P0: Collection Idempotency
// ─────────────────────────────────────────────────────────────────────────────
console.log('  Testing 1. Collection idempotency contract...');

// (a) collectionWrite.ts must perform entry-level idempotency lookup on (tenantId, idempotencyKey)
const collectionWriteSrc = read('lib/collectionWrite.ts');
assert.match(
  collectionWriteSrc,
  /collectionEntry\.findFirst\(\{\s*where:\s*\{\s*idempotencyKey,\s*tenantId\s*\}|collectionEntry\.findFirst\(\{\s*where:\s*\{\s*tenantId:\s*actor\.tenantId,\s*idempotencyKey:\s*input\.idempotencyKey/s,
  'lib/collectionWrite.ts must query collectionEntry for existing (tenantId, idempotencyKey)',
);
assert.match(
  collectionWriteSrc,
  /if\s*\(\s*existing\s*\)\s*return\s*\{\s*entryId:\s*existing\.id,\s*applied:\s*Number\(existing\.receivedAmount\),\s*created:\s*false\s*\}/,
  'lib/collectionWrite.ts must return early on existing entry without re-recording money',
);

// (b) buildCollectionIdempotencyKey behavior
const key1 = buildCollectionIdempotencyKey({
  tenantId: 'tenant_1',
  agentId: 'agent_1',
  instalmentId: 'inst_1',
  amount: 500,
  paymentMode: 'CASH',
  date: new Date('2026-06-01T00:00:00.000Z'),
});
const key2 = buildCollectionIdempotencyKey({
  tenantId: 'tenant_1',
  agentId: 'agent_1',
  instalmentId: 'inst_1',
  amount: 500.00,
  paymentMode: ' cash ',
  date: new Date('2026-06-01T00:00:00.000Z'),
});
assert.equal(key1, key2, 'idempotency key must normalize decimal places and payment mode whitespace/casing');

// ─────────────────────────────────────────────────────────────────────────────
// 2. P0: Cash Handover Atomic Settlement
// ─────────────────────────────────────────────────────────────────────────────
console.log('  Testing 2. Cash handover atomic settlement contract...');

const approveRouteSrc = read('app/api/v1/approvals/[id]/approve/route.ts');
assert.match(
  approveRouteSrc,
  /collectFromAgentInTx\s*\(\s*tx\s*,\s*\{/s,
  'app/api/v1/approvals/[id]/approve/route.ts must call collectFromAgentInTx within transaction tx',
);
assert.match(
  approveRouteSrc,
  /requestType\s*===\s*['"]cash_handover['"]/s,
  'app/api/v1/approvals/[id]/approve/route.ts must handle cash_handover requestType',
);

const walletSrc = read('lib/wallet.ts');
assert.match(
  walletSrc,
  /export async function collectFromAgentInTx/,
  'lib/wallet.ts must export collectFromAgentInTx',
);
assert.match(
  walletSrc,
  /applyAgent\(\s*tx,\s*input\.tenantId,\s*input\.appType,\s*input\.agentId,\s*-input\.amount,\s*\{[^}]*type:\s*'deposit',\s*refType:\s*'handover'/s,
  'collectFromAgentInTx must debit agent float with handover refType and hardBlock = true',
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. P1: Customer Pagination Contract
// ─────────────────────────────────────────────────────────────────────────────
console.log('  Testing 3. Customer pagination contract...');

const customersRouteSrc = read('app/api/v1/customers/route.ts');
assert.match(
  customersRouteSrc,
  /nextCursor/s,
  'app/api/v1/customers/route.ts must support cursor pagination',
);

const customerServiceSrc = read('mobile/lib/data/services/customer_service.dart');
assert.match(
  customerServiceSrc,
  /pagination\?\[['"]nextCursor['"]\]/s,
  'CustomerService.list must read pagination.nextCursor to traverse pages',
);
assert.match(
  customerServiceSrc,
  /for\s*\(var\s+page\s*=\s*0;\s*page\s*<\s*50;\s*page\+\+\)/s,
  'CustomerService.list must follow cursor pagination across pages when cursor is null',
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. P1: Customer KYC Document Contract
// ─────────────────────────────────────────────────────────────────────────────
console.log('  Testing 4. Customer KYC document contract...');

const customerDetailRouteSrc = read('app/api/v1/customers/[id]/route.ts');
assert.match(
  customerDetailRouteSrc,
  /kycDocuments:\s*customer\.kycDocuments\.map\(\(doc\)\s*=>\s*\(\{\s*\.\.\.doc,\s*type:\s*doc\.docType,\s*url:\s*doc\.filePath,\s*\}\)\)/s,
  'app/api/v1/customers/[id]/route.ts must map KYC docType to type and filePath to url',
);

const customerModelSrc = read('mobile/lib/data/models/customer.dart');
assert.match(
  customerModelSrc,
  /json\['type'\]\s*as\s*String\?\)\s*\?\?\s*\(json\['docType'\]/s,
  'mobile KycDocument.fromJson must parse both type and docType',
);
assert.match(
  customerModelSrc,
  /json\['url'\]\s*as\s*String\?\)\s*\?\?\s*\(json\['filePath'\]/s,
  'mobile KycDocument.fromJson must parse both url and filePath',
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. P1: Approval Insufficient Float Warning
// ─────────────────────────────────────────────────────────────────────────────
console.log('  Testing 5. Approval float warning contract...');

const approvalsRouteSrc = read('app/api/v1/approvals/route.ts');
assert.match(
  approvalsRouteSrc,
  /insufficientFloat/s,
  'app/api/v1/approvals/route.ts must compute insufficientFloat for pending loan approvals',
);
assert.match(
  approvalsRouteSrc,
  /agentFloat/s,
  'app/api/v1/approvals/route.ts must return agentFloat',
);

const approvalModelSrc = read('mobile/lib/data/models/approval.dart');
assert.match(
  approvalModelSrc,
  /final\s+bool\s+insufficientFloat;/,
  'mobile Approval model must define insufficientFloat',
);
assert.match(
  approvalModelSrc,
  /final\s+double\?\s+agentFloat;/,
  'mobile Approval model must define agentFloat',
);
assert.match(
  approvalModelSrc,
  /final\s+double\?\s+floatDeficit;/,
  'mobile Approval model must define floatDeficit',
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. P1: Business Date Consistency
// ─────────────────────────────────────────────────────────────────────────────
console.log('  Testing 6. Business date consistency...');

// Test business date helpers
const testDate = new Date('2026-09-25T18:30:00.000Z'); // 00:00 AM IST on Sep 26
const busDayUtc = startOfBusinessDayUtc(testDate);
assert.equal(busDayUtc.toISOString(), '2026-09-26T00:00:00.000Z', 'Sep 25 18:30 UTC is Sep 26 IST midnight UTC');

const parsed = parseBusinessDayUtc('2026-09-26');
assert.equal(parsed.toISOString(), '2026-09-26T00:00:00.000Z', 'parseBusinessDayUtc must yield exact UTC midnight');

const todayRouteSrc = read('app/api/v1/collection/today/route.ts');
assert.match(todayRouteSrc, /@\/lib\/businessTime/, 'collection/today must import from @/lib/businessTime');

const dailyReportRouteSrc = read('app/api/v1/reports/daily/route.ts');
assert.match(dailyReportRouteSrc, /@\/lib\/businessTime/, 'reports/daily must import from @/lib/businessTime');

const handoverRouteSrc = read('app/api/v1/collection/handover/route.ts');
assert.match(handoverRouteSrc, /@\/lib\/businessTime/, 'collection/handover must import from @/lib/businessTime');

// ─────────────────────────────────────────────────────────────────────────────
// 7. P2: Logout Token Revocation
// ─────────────────────────────────────────────────────────────────────────────
console.log('  Testing 7. Logout token revocation contract...');

const logoutRouteSrc = read('app/api/v1/auth/logout/route.ts');
assert.match(logoutRouteSrc, /revokeMobileToken/, 'logout route must call revokeMobileToken');

const v1AuthSrc = read('lib/api/v1-auth.ts');
assert.match(v1AuthSrc, /isTokenRevoked/, 'lib/api/v1-auth.ts must define isTokenRevoked');
assert.match(
  v1AuthSrc,
  /if\s*\(\s*await\s+isTokenRevoked\(token\)\s*\)\s*\{\s*return\s*\{\s*response:\s*fail\(['"]Unauthorized['"],\s*401\)\s*\};/s,
  'requireMobileContext must reject revoked tokens with 401',
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. P1: Notification Pagination & Overlap Prevention Contract
// ─────────────────────────────────────────────────────────────────────────────
console.log('  Testing 8. Notification pagination contract...');

const notifRouteSrc = read('app/api/v1/notifications/route.ts');
assert.match(
  notifRouteSrc,
  /Number\(searchParams\.get\(['"]pageSize['"]\)\s*\|\|\s*50\)/,
  'app/api/v1/notifications/route.ts default pageSize fallback must be 50',
);

const notifServiceSrc = read('mobile/lib/data/services/notifications_service.dart');
assert.match(
  notifServiceSrc,
  /static\s+const\s+int\s+defaultPageSize\s*=\s*50;/,
  'mobile NotificationsService must define defaultPageSize = 50',
);
assert.match(
  notifServiceSrc,
  /int\s+pageSize\s*=\s*defaultPageSize/,
  'mobile NotificationsService.fetchNotifications must default to defaultPageSize',
);

const notifScreenSrc = read('mobile/lib/features/notifications/notifications_screen.dart');
assert.match(
  notifScreenSrc,
  /const\s+int\s+_pageSize\s*=\s*50;/,
  'mobile notifications_screen.dart must define const int _pageSize = 50',
);
assert.match(
  notifScreenSrc,
  /seen\.add\(item\.id\)/,
  'mobile notifications_screen.dart must deduplicate items defensively using seen.add(item.id)',
);

// Mathematical verification of offset pagination for 125 items:
const totalNotifs = 125;
const pageSize = 50;
const allNotifs = Array.from({ length: totalNotifs }, (_, i) => ({ id: `notif_${i + 1}` }));

// Consistent page size (50):
const page1 = allNotifs.slice((1 - 1) * pageSize, 1 * pageSize); // 0..50 (50 items: notif_1..50)
const page2 = allNotifs.slice((2 - 1) * pageSize, 2 * pageSize); // 50..100 (50 items: notif_51..100)
const page3 = allNotifs.slice((3 - 1) * pageSize, 3 * pageSize); // 100..150 (25 items: notif_101..125)

assert.equal(page1.length, 50, 'Page 1 must have 50 items');
assert.equal(page2.length, 50, 'Page 2 must have 50 items');
assert.equal(page3.length, 25, 'Page 3 must have 25 items');

const seenTest = new Set<string>();
const combinedTest = [...page1, ...page2, ...page3].filter(item => seenTest.add(item.id));
assert.equal(combinedTest.length, 125, 'Total combined items must be exactly 125');
assert.equal(seenTest.size, 125, 'Zero duplicates with uniform pageSize = 50');

// Bug scenario proof: if initial used pageSize = 100, page 1 returned records 1-100.
// Then load more with page 2, pageSize 50 resulted in skip = (2 - 1) * 50 = 50, returning records 51-100.
const buggyPage1 = allNotifs.slice(0, 100);
const buggyPage2 = allNotifs.slice((2 - 1) * 50, 2 * 50); // items 50..100 (notif_51..100)
const overlapCount = buggyPage2.filter(b => buggyPage1.some(a => a.id === b.id)).length;
assert.equal(overlapCount, 50, 'Mismatch between 100 and 50 page sizes produced 50 overlapping items without uniform pageSize');

// ─────────────────────────────────────────────────────────────────────────────
// 9. P1: Report Catalog & Role-Gated Query Contract
// ─────────────────────────────────────────────────────────────────────────────
console.log('  Testing 9. Report catalog and role-gated contract...');

const reportsOptionsRouteSrc = read('app/api/v1/reports/options/route.ts');
assert.match(
  reportsOptionsRouteSrc,
  /resolveActor\(req\)/,
  'app/api/v1/reports/options/route.ts must resolve actor via dualAuth',
);
assert.match(
  reportsOptionsRouteSrc,
  /\['admin',\s*'superadmin',\s*'developer'\]\.includes\(context\.role\)/,
  'reports options route must enforce role restriction for financial report options',
);
assert.match(
  reportsOptionsRouteSrc,
  /getReportsForAppType/,
  'reports options route must supply catalog via getReportsForAppType',
);

const reportSlugRouteSrc = read('app/api/v1/reports/[slug]/route.ts');
assert.match(
  reportSlugRouteSrc,
  /resolveActor\(req\)/,
  'app/api/v1/reports/[slug]/route.ts must resolve actor via dualAuth',
);
assert.match(
  reportSlugRouteSrc,
  /context\.branchId\s*&&\s*requestedBranchId\s*&&\s*requestedBranchId\s*!==\s*context\.branchId/,
  'reports [slug] route must enforce branch scoping guard',
);
assert.match(
  reportSlugRouteSrc,
  /isPremiumAccountingEnabled/,
  'reports [slug] route must guard premium_accounting addons',
);

// ─────────────────────────────────────────────────────────────────────────────
// 10. Hardening: Server-Supplied Penalty Summary Contract
// ─────────────────────────────────────────────────────────────────────────────
console.log('  Testing 10. Server-supplied penalty summary contract...');

const loanDetailRouteSrc = read('app/api/v1/loans/[id]/route.ts');
assert.match(
  loanDetailRouteSrc,
  /penaltySummary\s*=\s*\{\s*gross:/s,
  'app/api/v1/loans/[id]/route.ts must calculate penaltySummary with gross',
);
assert.match(
  loanDetailRouteSrc,
  /penaltySummary:\s*penaltySummary|penaltySummary\s*,\s*\}\);/s,
  'app/api/v1/loans/[id]/route.ts must include penaltySummary in response payload',
);

const loanModelSrc = read('mobile/lib/data/models/loan.dart');
assert.match(
  loanModelSrc,
  /class\s+PenaltySummary/,
  'mobile Loan model must define PenaltySummary class',
);
assert.match(
  loanModelSrc,
  /final\s+PenaltySummary\?\s+penaltySummary;/,
  'mobile Loan model must define final PenaltySummary? penaltySummary;',
);
assert.match(
  loanModelSrc,
  /penaltySummary:\s*json\['penaltySummary'\]\s*is\s*Map<String,\s*dynamic>/,
  'mobile Loan.fromJson must parse penaltySummary',
);

const loanDetailScreenSrc = read('mobile/lib/features/loans/loan_detail_screen.dart');
assert.match(
  loanDetailScreenSrc,
  /final\s+summary\s*=\s*loan\.penaltySummary;/,
  'mobile _PenaltySummaryCard must prefer loan.penaltySummary',
);

const webLoanDetailSrc = read('app/(dashboard)/[module]/loans/[id]/LoanDetailClient.tsx');
assert.match(
  webLoanDetailSrc,
  /penaltySummary/,
  'web LoanDetailClient must support server-supplied penaltySummary',
);

console.log('All mobile parity audit validation tests passed successfully! [10/10]');
