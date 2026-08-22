import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildSystemNotificationWhere,
  type NotificationVisibilityInput,
} from '../lib/notificationVisibility';
import { branchScopeWhere } from '../lib/branchScope';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

const baseInput: NotificationVisibilityInput = {
  tenantId: 'tenant-1',
  appType: 'microlending',
  userId: 'admin-creator',
  userRole: 'admin',
  activeBranchId: 'branch-1',
};

assert.deepEqual(
  buildSystemNotificationWhere(baseInput),
  {
    tenantId: 'tenant-1',
    appType: 'microlending',
    OR: [
      { targetUserId: 'admin-creator' },
      {
        targetUserId: null,
        targetRole: 'admin',
        OR: [{ branchId: 'branch-1' }, { branchId: null }],
      },
    ],
  },
  'admin notification list includes notifications targeted to the creator admin and generic branch admin notifications',
);

assert.deepEqual(
  buildSystemNotificationWhere({ ...baseInput, unreadOnly: true }),
  {
    tenantId: 'tenant-1',
    appType: 'microlending',
    isRead: false,
    OR: [
      { targetUserId: 'admin-creator' },
      {
        targetUserId: null,
        targetRole: 'admin',
        OR: [{ branchId: 'branch-1' }, { branchId: null }],
      },
    ],
  },
  'unread notification count uses the same targeted visibility scope',
);

const schema = read('prisma/schema.prisma');
assert.match(schema, /targetUserId\s+String\?\s+@map\("target_user_id"\)/, 'notifications can target one approving admin user');
assert.match(schema, /@@index\(\[targetUserId/, 'targeted notifications are indexed by target user');

// Loan/customer creation notifies approvers through notifyApprovers, which fans
// out one row PER admin and superadmin. The web form posts to the same /api/v1
// route the mobile app uses, so the fan-out lives there rather than in the
// server action.
const loansRoute = read('app/api/v1/loans/route.ts');
assert.match(loansRoute, /notifyApprovers/, 'loan submission notifies approvers');
assert.match(loansRoute, /requesterBranchId: ctx\.branchId/, 'loan approval reaches the filing agent\'s branch admins too');

const customersRoute = read('app/api/v1/customers/route.ts');
assert.match(customersRoute, /notifyApprovers/, 'customer submission notifies approvers');
assert.match(customersRoute, /requesterBranchId: ctx\.branchId/, 'customer approval reaches the filing agent\'s branch admins too');

// Every request filed through the generic approvals endpoint is announced, not
// only customer edits. Gating the fan-out on one entity type left collection
// and loan edit requests pending with no admin ever told (NOTIF-6).
const approvalsRoute = read('app/api/v1/approvals/route.ts');
assert.match(approvalsRoute, /notifyApprovers/, 'generic approval requests notify approvers');
assert.doesNotMatch(
  approvalsRoute,
  /if \(entityType === 'customer'\)[\s\S]{0,600}notifyApprovers/,
  'the approval fan-out must not be gated on a single entity type',
);
assert.match(
  approvalsRoute,
  /requesterBranchId: ctx\.branchId/,
  'generic approvals reach the filing agent\'s branch admins too',
);
assert.match(
  approvalsRoute,
  /resolveApprovalTarget/,
  'the record branch is resolved per entity type so approvals reach its own branch admins',
);

// A route-run cash variance is an approval like any other — raising the request
// without announcing it left a cash discrepancy nobody was told about.
const collectionRun = read('lib/collectionRun.ts');
assert.match(collectionRun, /run_reconcile_variance/, 'a reconcile variance raises an approval request');
assert.match(collectionRun, /notifyApprovers/, 'a reconcile variance notifies approvers');

// The web edit-request action passes BOTH branches rather than collapsing them
// to one with `||`, or the admin of whichever branch lost the coin toss is
// never told.
const approvalsActions = read('app/(dashboard)/[module]/approvals/actions.ts');
assert.match(
  approvalsActions,
  /requesterBranchId: agentBranchId/,
  'customer edit requests reach the filing agent\'s branch admins too',
);
assert.doesNotMatch(
  approvalsActions,
  /agentBranchId \|\| customer\.branchId/,
  'the two branches must not be collapsed into one recipient branch',
);

const approvers = read('lib/notify/approvers.ts');
assert.match(approvers, /includeUnassignedBranch: true/, 'unbranched admins can review every branch');
assert.match(
  approvers,
  /recipientBranchIds: \[input\.branchId, agentBranchId\]/,
  'approvers are resolved from the record branch AND the filing AGENT branch',
);

// The filer's branch only widens the fan-out when the filer is an AGENT. An
// admin or superadmin files for every branch — a superadmin sits on one branch
// and works all of them — so honouring their branch pinged that one branch's
// admin about every branch's approvals, none of which their queue (scoped to
// the record's own branch) would let them open.
assert.match(
  approvers,
  /requesterRole === 'agent' \? requesterBranchId : null/,
  "a non-agent filer's branch must not widen the fan-out",
);
for (const [file, pattern] of [
  ['app/api/v1/customers/route.ts', /requesterRole: ctx\.role/],
  ['app/api/v1/loans/route.ts', /requesterRole: ctx\.role/],
  ['app/api/v1/loans/[id]/route.ts', /requesterRole: ctx\.role/],
  ['app/api/v1/approvals/route.ts', /requesterRole: ctx\.role/],
  ['app/api/v1/vehicles/route.ts', /requesterRole: ctx\.role/],
  ['app/api/v1/collection/handover/route.ts', /requesterRole: ctx\.role/],
  ['app/(dashboard)/[module]/approvals/actions.ts', /requesterRole: userRole/],
  ['app/(dashboard)/[module]/vehicles/actions.ts', /requesterRole: role/],
  ['lib/collectionRun.ts', /requesterRole: actor\.role/],
] as Array<[string, RegExp]>) {
  assert.match(read(file), pattern, `${file} must declare the filer's role alongside their branch`);
}

// No all-admin fallback. Spraying every branch when nobody matched leaked a
// customer's name and amounts to branches with no claim to them; the tenant's
// superadmins are notified on every call, so nothing is dropped by removing it.
assert.doesNotMatch(
  approvers,
  /if \(reached === 0\)\s*\{\s*await notifyUser/,
  'a zero-reach approval must not fan out to every admin in the tenant',
);
assert.match(approvers, /if \(reached === 0\)[\s\S]{0,200}console\.warn/, 'zero reach is logged instead');

// …and an empty branch list must not become "everyone" through the back door.
// A branchless record has no branch to aim at; broadcasting it to every admin
// is the same tenant-wide spray, just reached from the other side.
const userNotify = read('lib/notify/userNotify.ts');
assert.match(
  userNotify,
  /\} else if \(input\.includeUnassignedBranch\) \{[\s\S]{0,600}branchScope = \{ branchId: null \};/,
  'a branch-aware broadcast with no target branch reaches unbranched users only',
);

// NOTIFYING an admin is not the same as letting them SEE the record. A record
// takes the branch of its ROUTE, so the filing agent's admin may be pinged
// about a loan on another branch — but the approvals queue itself stays pinned
// to the record's own branch, or one branch could approve another's records.
assert.deepEqual(
  branchScopeWhere('branch-1'),
  { branchId: 'branch-1' },
  'the approvals queue is scoped to the record branch alone',
);
assert.deepEqual(branchScopeWhere(null), {}, 'no active branch stays tenant-wide');

const approvalsPage = read('app/(dashboard)/[module]/approvals/page.tsx');
assert.doesNotMatch(
  approvalsPage,
  /ReachWhere|branchOrUnassignedWhere/,
  'the approvals queue must not widen past the record branch',
);

console.log('approval notification tests passed');
