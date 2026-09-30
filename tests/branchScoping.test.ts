import assert from 'node:assert/strict';
import { branchScopeWhere, resolveUnbranchedAdminBranch, UNBRANCHED_ADMIN_ERROR } from '../lib/branchScope';
import { scopedBranchWhere } from '../lib/api/v1-auth';
import { buildLoanDetailWhere, loanAccessWhere } from '../lib/loanPolicy';
import { gpsAgentWhere } from '../lib/gps/routeProgress';

/**
 * Branch scoping must have NO role exemption.
 *
 * The active branch is resolved before these helpers run — null means "All
 * Branches", a value means the branch the caller selected. Exempting
 * superadmin/developer here threw that answer away and ran every read
 * tenant-wide, so the branch switcher did nothing for the only role that has
 * one: selecting Erode showed Head Office's customers, loans, agents, wallet
 * pools and collection sheets. 63 v1 routes share scopedBranchWhere, and the
 * web dashboard reaches them through serverFetch, so the leak was identical on
 * web and mobile.
 */

const BRANCH = 'branch-erode';

// --- branchScopeWhere: a record belongs to exactly one branch ---
assert.deepEqual(branchScopeWhere(BRANCH), { branchId: BRANCH });
assert.deepEqual(branchScopeWhere(null), {}, 'null = All Branches = tenant-wide');
assert.deepEqual(branchScopeWhere(undefined), {});

// --- scopedBranchWhere: identical for EVERY role ---
for (const role of ['agent', 'staff', 'admin', 'superadmin', 'developer']) {
  assert.deepEqual(
    scopedBranchWhere({ role, branchId: BRANCH } as any),
    { branchId: BRANCH },
    `role "${role}" must not be exempt from branch scoping`,
  );
  assert.deepEqual(
    scopedBranchWhere({ role, branchId: null } as any),
    {},
    `role "${role}" with All Branches selected must be tenant-wide`,
  );
}

// --- buildLoanDetailWhere: same rule on the loan-detail path ---
for (const role of ['agent', 'admin', 'superadmin', 'developer']) {
  const where = buildLoanDetailWhere({
    loanId: 'DL00007',
    tenantId: 't1',
    appType: 'microlending',
    branchId: BRANCH,
    role,
    userId: 'u1',
  } as any);
  assert.equal(
    (where as any).branchId,
    BRANCH,
    `role "${role}" must not be able to open another branch's loan`,
  );
}
const allBranches = buildLoanDetailWhere({
  loanId: 'DL00007',
  tenantId: 't1',
  appType: 'microlending',
  branchId: null,
  role: 'superadmin',
  userId: 'u1',
} as any);
assert.ok(!('branchId' in (allBranches as any)), 'All Branches must not pin a branch');

// GPS agent lists are scoped to the selected module and branch for every role.
assert.deepEqual(gpsAgentWhere({ tenantId: 't1', appType: 'microlending', branchId: BRANCH }), {
  tenantId: 't1', appType: 'microlending', role: 'agent', status: 'active', branchId: BRANCH,
});
assert.deepEqual(gpsAgentWhere({ tenantId: 't1', appType: 'microlending', branchId: null }), {
  tenantId: 't1', appType: 'microlending', role: 'agent', status: 'active',
});

// --- loanAccessWhere: by-id loan lookups (repossession, NACH, receipts, foreclosure) ---
for (const role of ['admin', 'superadmin', 'developer']) {
  assert.deepEqual(
    loanAccessWhere({ tenantId: 't1', appType: 'goldloan', branchId: BRANCH, role, userId: 'u1' }),
    { tenantId: 't1', appType: 'goldloan', branchId: BRANCH },
    `role "${role}" must not reach another branch's loan by id`,
  );
}
assert.deepEqual(
  loanAccessWhere({ tenantId: 't1', appType: 'goldloan', branchId: null, role: 'superadmin', userId: 'u1' }),
  { tenantId: 't1', appType: 'goldloan' },
  'All Branches = whole module, never another module',
);
const agentLoan = loanAccessWhere({ tenantId: 't1', appType: 'goldloan', branchId: BRANCH, role: 'agent', userId: 'a1' });
assert.ok(!('branchId' in agentLoan), 'agents scope by customer linkage, not branch (SCOPE-5)');
assert.ok('customer' in agentLoan);

// --- resolveUnbranchedAdminBranch: an unbranched admin never becomes "All Branches" ---
const fakeDb = (ids: string[]) => ({ branch: { findMany: async () => ids.map((id) => ({ id })) } });

Promise.all([
  resolveUnbranchedAdminBranch(fakeDb([]), 't1').then((b) => assert.equal(b, null, 'no branches yet → nothing to scope')),
  resolveUnbranchedAdminBranch(fakeDb([BRANCH]), 't1').then((b) => assert.equal(b, BRANCH, 'single branch → that branch')),
  resolveUnbranchedAdminBranch(fakeDb([BRANCH, 'branch-salem']), 't1').then(
    () => assert.fail('several branches must fail closed'),
    (e: Error) => assert.equal(e.message, UNBRANCHED_ADMIN_ERROR),
  ),
]).then(
  () => console.log('branch scoping tests passed'),
  (e) => { console.error(e); process.exit(1); },
);
