import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildSystemNotificationWhere,
  type NotificationVisibilityInput,
} from '../lib/notificationVisibility';

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

const loanActions = read('app/(dashboard)/[module]/loans/actions.ts');
assert.match(loanActions, /targetUserId/, 'loan approval notifications are created for a specific admin target');
assert.match(loanActions, /findApprovalNotificationTarget/, 'loan approval notifications resolve the admin who owns the agent');

console.log('approval notification tests passed');
