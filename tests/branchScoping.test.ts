import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scopedBranchReachWhere } from '../lib/api/v1-auth';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

const HQ = 'branch-hq';

// ── Superadmins and developers stay tenant-wide ──────────────────────────
assert.deepEqual(
  scopedBranchReachWhere({ role: 'superadmin', branchId: HQ } as any, 'agent'),
  {},
  'superadmins are never branch-filtered',
);
assert.deepEqual(
  scopedBranchReachWhere({ role: 'developer', branchId: HQ } as any, 'agent'),
  {},
  'developers are never branch-filtered',
);
assert.deepEqual(
  scopedBranchReachWhere({ role: 'admin', branchId: null } as any, 'agent'),
  {},
  'an unbranched admin sees the whole tenant',
);

// ── A branch admin reaches three things ──────────────────────────────────
// This is the actual defect: a customer inherits the branch of its ROUTE, so an
// agent on HQ working a route in another branch files customers onto THAT
// branch. Matching the record branch alone hid them from the HQ admin who
// manages that very agent, while superadmins saw everything.
assert.deepEqual(
  scopedBranchReachWhere({ role: 'admin', branchId: HQ } as any, 'agent'),
  {
    OR: [
      { branchId: HQ },
      { branchId: null },
      { agent: { branchId: HQ } },
    ],
  },
  'admin reaches own branch, unbranched records, and records filed by own-branch staff',
);

assert.deepEqual(
  scopedBranchReachWhere({ role: 'admin', branchId: HQ } as any, 'createdBy'),
  {
    OR: [
      { branchId: HQ },
      { branchId: null },
      { createdBy: { branchId: HQ } },
    ],
  },
  'loans use createdBy as the filer relation',
);

// ── The clause must be ANDed, never spread ───────────────────────────────
// Every detail lookup matches on `OR: [{id}, {code}]`. Spreading a second OR
// over that object silently REPLACES the id match and would return the wrong
// record (or none). These call sites must use AND.
for (const file of [
  'app/api/v1/customers/[id]/route.ts',
  'app/api/v1/loans/[id]/route.ts',
  'app/api/customers/[id]/route.ts',
]) {
  const src = read(file);
  assert.ok(
    !/\.\.\.scopedBranchReachWhere\([^)]*\)[^}]*\n\s*\};/.test(src) ||
      /where\.AND\s*=|AND:\s*\[/.test(src),
    `${file} must AND the reach clause, not spread it over an existing OR`,
  );
}

// List and detail must agree, or a listed row 404s when opened.
const v1Customers = read('app/api/v1/customers/route.ts');
const v1CustomerDetail = read('app/api/v1/customers/[id]/route.ts');
assert.match(v1Customers, /scopedBranchReachWhere\(ctx, 'agent'\)/, 'customer list uses reach scope');
assert.match(v1CustomerDetail, /scopedBranchReachWhere\(ctx, 'agent'\)/, 'customer detail uses the same scope');

const v1Loans = read('app/api/v1/loans/route.ts');
const v1LoanDetail = read('app/api/v1/loans/[id]/route.ts');
assert.match(v1Loans, /scopedBranchReachWhere\(ctx, 'createdBy'\)/, 'loan list uses reach scope');
assert.match(v1LoanDetail, /scopedBranchReachWhere\(ctx, 'createdBy'\)/, 'loan detail uses the same scope');

// Tenant isolation is NOT relaxed by any of this.
const v1Auth = read('lib/api/v1-auth.ts');
assert.ok(
  !/scopedBranchReachWhere[\s\S]{0,600}tenantId/.test(v1Auth) ||
    /claims\.role === 'superadmin'/.test(v1Auth),
  'reach scoping never widens beyond the caller tenant',
);

console.log('branch scoping tests passed');
