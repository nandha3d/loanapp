import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ROLE-6 Developer credentials isolation tests
const adminUsersApi = readFileSync('app/api/v1/admin/users/route.ts', 'utf8');
const adminUsersIdApi = readFileSync('app/api/v1/admin/users/[id]/route.ts', 'utf8');
const adminUsersPage = readFileSync('app/admin/users/page.tsx', 'utf8');
const adminActions = readFileSync('app/admin/actions.ts', 'utf8');
const teamManagementMobile = readFileSync('mobile/lib/features/admin/team_management_screen.dart', 'utf8');
const engRef = readFileSync('ENGINEERING_REFERENCE.md', 'utf8');
const mcollectSpec = readFileSync('MCOLLECT_SPEC.md', 'utf8');

// 1. Backend v1 API excludes developer users for non-developer roles
assert.match(
  adminUsersApi,
  /role:\s*\{\s*notIn:\s*\[['"]developer['"],\s*['"]DEVELOPER['"]\]\s*\}/,
  'GET /api/v1/admin/users must filter out developer accounts for non-developer callers',
);

// 2. Backend v1 API rejects assigning developer role by non-developers
assert.match(
  adminUsersApi,
  /Forbidden: Only developers can create or assign developer role/,
  'POST /api/v1/admin/users must reject developer role assignment by non-developers',
);

// 3. Backend v1 PATCH API blocks modifying developer accounts
assert.match(
  adminUsersIdApi,
  /Forbidden: Cannot modify developer accounts/,
  'PATCH /api/v1/admin/users/:id must block non-developers from modifying developer accounts',
);

// 4. Web admin users page excludes developer users for non-developers
assert.match(
  adminUsersPage,
  /role:\s*\{\s*notIn:\s*\[['"]developer['"],\s*['"]DEVELOPER['"]\]\s*\}/,
  'app/admin/users/page.tsx must filter out developer accounts for non-developers',
);

// 5. Admin server actions forbid non-developers from managing developer accounts
assert.match(
  adminActions,
  /Only a developer can manage developer accounts/,
  'admin actions must forbid non-developers from creating or managing developer accounts',
);

// 6. Mobile team management screen filters out developer role for non-developer accounts
assert.match(
  teamManagementMobile,
  /if \(!isDeveloper && role == 'developer'\) return false;/,
  'mobile TeamManagementScreen must hide developer accounts from non-developer users',
);

// 7. Normative reference documentation contains ROLE-6 and X-24
assert.match(
  engRef,
  /ROLE-6/,
  'ENGINEERING_REFERENCE.md must document ROLE-6 developer credentials isolation',
);

assert.match(
  engRef,
  /X-24/,
  'ENGINEERING_REFERENCE.md must document X-24 forbidden pattern',
);

assert.match(
  mcollectSpec,
  /Developer accounts & platform credentials are isolated above tenant boundaries/,
  'MCOLLECT_SPEC.md must document developer credentials isolation in user management',
);

console.log('✅ Developer credentials isolation tests passed (ROLE-6, X-24)');
