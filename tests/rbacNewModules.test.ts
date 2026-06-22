import {
  assertAnyContains,
  assertContains,
  assertRoute,
  printSummary,
} from './newModulesApiHarness';

const guardedPages = [
  ['reports page', 'app/(dashboard)/[module]/reports/page.tsx', ['agent', 'redirect']],
  ['analytics page', 'app/(dashboard)/[module]/analytics/page.tsx', ['agent', 'redirect']],
  ['kyc review page', 'app/(dashboard)/[module]/kyc-review/page.tsx', ['agent', 'redirect']],
  ['vehicles page', 'app/(dashboard)/[module]/vehicles/page.tsx', ['agent', 'redirect']],
  ['chits page', 'app/(dashboard)/[module]/chits/page.tsx', ['agent', 'redirect']],
] as const;

for (const [label, route, tokens] of guardedPages) {
  const source = assertRoute(route);
  assertContains(source, tokens, label);
}

const walletPage = assertRoute('app/(dashboard)/[module]/wallet/page.tsx');
assertContains(walletPage, ['agent', 'AgentWalletClient'], 'wallet page agent scoped view');

const adminRoutes = [
  ['admin users', 'app/api/v1/admin/users/route.ts'],
  ['admin branches', 'app/api/v1/admin/branches/route.ts'],
  ['admin billing', 'app/api/v1/admin/billing/route.ts'],
  ['developer pricing plans', 'app/api/developer/pricing/plans/route.ts'],
] as const;

for (const [label, route] of adminRoutes) {
  const source = assertRoute(route);
  assertAnyContains(source, ['developer', 'superadmin', 'admin', 'role'], label);
}

printSummary('rbacNewModules', {
  checkedPages: guardedPages.length + 1,
  checkedApiRoutes: adminRoutes.length,
  status: 'Passed static RBAC token checks',
});
