import assert from 'node:assert/strict';
import { branchScopeWhere } from '../lib/branchScope';
import { scopedBranchWhere } from '../lib/api/v1-auth';
import { buildLoanDetailWhere } from '../lib/loanPolicy';

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

console.log('branch scoping tests passed');
