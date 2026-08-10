import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scopedBranchWhere } from '../lib/api/v1-auth';
import { branchScopeWhere } from '../lib/branchScope';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

/** Source with comments stripped, so prose about the old leak isn't mistaken for it. */
function code(path: string) {
  return read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const HQ = 'branch-hq';
const OTHER = 'branch-other';

// ── Superadmins and developers stay tenant-wide ──────────────────────────
assert.deepEqual(
  scopedBranchWhere({ role: 'superadmin', branchId: HQ } as any),
  {},
  'superadmins are never branch-filtered',
);
assert.deepEqual(
  scopedBranchWhere({ role: 'developer', branchId: HQ } as any),
  {},
  'developers are never branch-filtered',
);
assert.deepEqual(
  scopedBranchWhere({ role: 'admin', branchId: null } as any),
  {},
  'an unbranched admin sees the whole tenant',
);

// ── A branch admin sees their OWN branch and nothing else ────────────────
// A record belongs to exactly one branch: its own branchId. Any extra OR arm
// here shares customers and loans across branches. Two arms used to be here:
//
//   { branchId: null }              → broadcast every unbranched record to ALL
//                                     branches at once.
//   { <filer>: { branchId } }       → matched on the filing staff member's
//                                     CURRENT branch, so branch A's admin saw
//                                     branch B's records whenever the agent who
//                                     filed them sat on A — and transferring an
//                                     agent moved their whole history along.
const adminScope = scopedBranchWhere({ role: 'admin', branchId: HQ } as any);
assert.deepEqual(adminScope, { branchId: HQ }, 'a branch admin is pinned to their own branch');
assert.ok(!('OR' in adminScope), 'branch scope must never widen through an OR');
assert.deepEqual(
  branchScopeWhere(HQ),
  { branchId: HQ },
  'the dependency-free helper agrees with the v1 one',
);
assert.deepEqual(branchScopeWhere(null), {}, 'no active branch stays tenant-wide');
assert.notDeepEqual(branchScopeWhere(HQ), branchScopeWhere(OTHER), 'branches do not overlap');

// ── Every customer/loan read is scoped, and list matches detail ──────────
// If a list and its detail lookup disagree, either a row 404s when opened or a
// row that should be hidden is reachable by guessing its id.
const SCOPED_READS: Array<[string, RegExp]> = [
  ['app/api/v1/customers/route.ts', /scopedBranchWhere\(ctx\)/],
  ['app/api/v1/customers/[id]/route.ts', /scopedBranchWhere\(ctx\)/],
  ['app/api/v1/loans/route.ts', /scopedBranchWhere\(ctx\)/],
  ['app/api/v1/loans/[id]/route.ts', /scopedBranchWhere\(ctx\)/],
  ['app/api/customers/[id]/route.ts', /scopedBranchWhere\(context\)/],
  ['app/api/loans/[id]/route.ts', /scopedBranchWhere\(context\)/],
];
for (const [file, pattern] of SCOPED_READS) {
  assert.match(read(file), pattern, `${file} must branch-scope its query`);
}

// The reach helpers are gone for good — reintroducing either name brings the
// cross-branch leak back with it.
for (const file of [
  'lib/api/v1-auth.ts',
  'lib/apiAuth.ts',
  'lib/branchScope.ts',
  ...SCOPED_READS.map(([f]) => f),
  'app/api/v1/approvals/route.ts',
  'app/(dashboard)/[module]/approvals/page.tsx',
  'app/(dashboard)/[module]/layout.tsx',
]) {
  const src = code(file);
  assert.doesNotMatch(src, /ReachWhere|branchOrUnassignedWhere/, `${file} must not use a widened branch scope`);
  assert.doesNotMatch(
    src,
    /\{\s*branchId:\s*null\s*\}/,
    `${file} must not OR unbranched records into a branch scope`,
  );
}

// Tenant isolation is NOT relaxed by any of this.
const v1Auth = read('lib/api/v1-auth.ts');
assert.match(v1Auth, /claims\.role === 'superadmin'/, 'only owners bypass branch scoping');

console.log('branch scoping tests passed');
