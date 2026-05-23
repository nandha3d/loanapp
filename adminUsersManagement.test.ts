import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const usersClient = readFileSync('app/admin/users/UsersClient.tsx', 'utf8');
const adminActions = readFileSync('app/admin/actions.ts', 'utf8');
const adminUsersPage = readFileSync('app/admin/users/page.tsx', 'utf8');

assert.equal(
  usersClient.includes('Global Module Access'),
  false,
  'master user modal should expose a single module-access control',
);

assert.equal(
  usersClient.includes('Loan Creation Permission'),
  false,
  'master user modal should not expose direct agent loan creation permission',
);

assert.equal(
  usersClient.includes('toggleCanCreateLoan'),
  false,
  'master user table should not expose direct loan creation toggles',
);

assert.equal(
  adminActions.includes('canCreateLoan'),
  false,
  'master user save should not manage direct agent loan creation permission',
);

assert.match(
  adminUsersPage,
  /branchId:\s*null/,
  'superadmin master users query should include unassigned tenant users',
);

console.log('admin users management tests passed');
