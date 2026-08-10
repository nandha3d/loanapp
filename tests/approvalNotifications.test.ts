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

const approvers = read('lib/notify/approvers.ts');
assert.match(approvers, /includeUnassignedBranch: true/, 'unbranched admins can review every branch');
assert.match(
  approvers,
  /recipientBranchIds: \[input\.branchId, requesterBranchId\]/,
  'approvers are resolved from the record branch AND the filing agent branch',
);
assert.match(approvers, /if \(reached === 0\)/, 'an approval reaching no admin falls back to every tenant admin');

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
