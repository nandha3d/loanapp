import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveWriteBranchId, scopedBranchWhere } from '../lib/api/v1-auth';
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

// ── The master-data exception stays an exception ─────────────────────────
// `branchOrSharedWhere` deliberately ORs in `{ branchId: null }` — the exact
// arm banned above — because a catalogue row has a real "every branch sells
// this" state (SCOPE-11). It lives in its own file so the ban on the
// transactional path stays literal, and it must not spread past loan packages.
{
  const { branchOrSharedWhere } = require('../lib/masterDataScope');
  assert.deepEqual(branchOrSharedWhere(null), {}, 'no active branch stays tenant-wide');
  assert.deepEqual(
    branchOrSharedWhere(HQ),
    { OR: [{ branchId: HQ }, { branchId: null }] },
    'a branch sees its own products plus the tenant-wide ones',
  );

  const callers = [
    'app/api/packages/route.ts',
    'app/api/v1/packages/route.ts',
    'app/(dashboard)/[module]/settings/page.tsx',
  ];
  for (const file of callers) {
    assert.match(
      code(file),
      /prisma\.loanPackage\./,
      `${file} may only use branchOrSharedWhere for loanPackage`,
    );
  }
  // Anything outside that list reaching for it is the exception spreading.
  const strays = SCOPED_READS.map(([f]) => f).filter((f) => /branchOrSharedWhere/.test(code(f)));
  assert.deepEqual(strays, [], 'transactional reads must use branchScopeWhere, not the master-data helper');
}

// Tenant isolation is NOT relaxed by any of this.
const v1Auth = read('lib/api/v1-auth.ts');
assert.match(v1Auth, /claims\.role === 'superadmin'/, 'only owners bypass branch scoping');

// ── A record is stamped with the branch of its SUBJECT ───────────────────
// Scoping reads by the record's own branch only works if that branch is right
// to begin with. A loan took `ctx.branchId ?? customer.branchId`, so every loan
// a superadmin raised landed on the SUPERADMIN's branch: that branch's admin
// saw loans belonging to other branches, and the branch that owned the customer
// lost both the loan and its approval notification.
async function assertWriteBranchOrder() {
  assert.deepEqual(
    await resolveWriteBranchId({ branchId: HQ, homeBranchId: HQ } as any, OTHER),
    OTHER,
    'the subject branch wins over the caller branch',
  );
  assert.deepEqual(
    await resolveWriteBranchId({ branchId: OTHER, homeBranchId: HQ } as any, null),
    OTHER,
    'a subject with no branch falls back to the ACTIVE branch',
  );
  assert.deepEqual(
    await resolveWriteBranchId({ branchId: null, homeBranchId: HQ } as any, null),
    HQ,
    'and only then to the caller home branch',
  );
}

const v1LoansSrc = read('app/api/v1/loans/route.ts');
assert.match(
  v1LoansSrc,
  /resolveWriteBranchId\(ctx, customer\.branchId\)/,
  "a loan inherits its customer's branch",
);
assert.doesNotMatch(
  code('app/api/v1/loans/route.ts'),
  /branchId: ctx\.branchId \?\? customer\.branchId/,
  "the raiser's branch must not win over the customer's",
);
assert.match(
  read('app/api/v1/customers/route.ts'),
  /resolveWriteBranchId\(ctx, routeBranchId\)/,
  "a customer inherits its route's branch, then the active branch",
);

// ── The web dashboard drives v1 with the ACTIVE branch ───────────────────
// Sending the session's home branch instead made a superadmin's branch switcher
// inert on every v1 call: their writes were stamped with their own branch no
// matter which branch was selected.
const apiClientServer = read('lib/api-client/server.ts');
assert.match(apiClientServer, /getActiveBranchId\(\)/, 'server fetches forward the active branch');
assert.doesNotMatch(
  code('lib/api-client/server.ts'),
  /branchId: session\?\.user\?\.branchId/,
  'the home branch must not be forwarded as the scope branch',
);

// Only an owner may steer the scope branch by header, and only to a branch of
// their own tenant — otherwise X-Branch-Id is a cross-tenant read primitive.
assert.match(
  v1Auth,
  /if \(!privileged\) return claims\.branchId;/,
  'an agent/admin header can never change their branch',
);
assert.match(
  v1Auth,
  /findFirst\(\{\s*where: \{ id: requestedBranchId, tenantId: claims\.tenantId \}/,
  'a requested branch is validated against the caller tenant',
);

assertWriteBranchOrder()
  .then(() => console.log('branch scoping tests passed'))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
