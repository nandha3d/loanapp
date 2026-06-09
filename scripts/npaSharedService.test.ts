import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

function source(path: string): string {
  assert.equal(existsSync(path), true, `${path} exists`);
  return readFileSync(path, 'utf8');
}

const service = source('lib/npa/npaService.ts');
const webRoutes = [
  'app/api/npa/summary/route.ts',
  'app/api/npa/loans/route.ts',
  'app/api/npa/history/route.ts',
  'app/api/npa/upgrade/route.ts',
];
const mobileRoutes = [
  'app/api/v1/npa/summary/route.ts',
  'app/api/v1/npa/loans/route.ts',
  'app/api/v1/npa/history/route.ts',
  'app/api/v1/npa/upgrade/route.ts',
];

for (const fn of [
  'getNpaSummary',
  'listNpaLoans',
  'getNpaHistory',
  'getNpaUpgradeEligibility',
  'upgradeNpaLoan',
  'assertNpaAccess',
]) {
  assert.match(service, new RegExp(`export async function ${fn}`), `shared NPA service exports ${fn}`);
}

for (const routePath of webRoutes) {
  const route = source(routePath);
  assert.match(route, /from '@\/lib\/npa\/npaService'/, `${routePath} imports shared NPA service`);
  assert.doesNotMatch(route, /getTenantProvisioningSummary|grossNpaRatio|prisma\.loan\.findMany|prisma\.npaHistory\.findMany/, `${routePath} does not own NPA business queries`);
}

for (const routePath of mobileRoutes) {
  const route = source(routePath);
  assert.match(route, /requireMobileContext/, `${routePath} uses mobile JWT auth`);
  assert.match(route, /from '@\/lib\/api\/v1-envelope'/, `${routePath} uses v1 envelope helpers`);
  assert.match(route, /from '@\/lib\/npa\/npaService'/, `${routePath} imports shared NPA service`);
  assert.match(route, /\bok\(|\bfail\(/, `${routePath} returns v1 ok/fail responses`);
}

console.log('NPA shared service architecture checks passed');
