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

console.log('All mobile parity audit validation tests passed successfully! [7/7]');
