import {
  assertAnyContains,
  assertRoute,
  printSummary,
  runLiveChecks,
} from './newModulesApiHarness';

const routes = [
  ['chits', 'app/api/v1/chits/route.ts', ['auth(', 'require', 'session', 'getDefaultTenantId']],
  ['collection runs', 'app/api/v1/collection/run/route.ts', ['auth(', 'require', 'session', 'getDefaultTenantId']],
  ['vehicles', 'app/api/v1/vehicles/route.ts', ['auth(', 'require', 'session', 'getDefaultTenantId']],
  ['wallet agents', 'app/api/v1/wallet/agents/route.ts', ['auth(', 'require', 'session', 'getDefaultTenantId']],
  ['notifications', 'app/api/v1/notifications/route.ts', ['auth(', 'require', 'session', 'getDefaultTenantId']],
  ['reports daily', 'app/api/v1/reports/daily/route.ts', ['auth(', 'require', 'session', 'getDefaultTenantId']],
  ['analytics summary', 'app/api/v1/analytics/summary/route.ts', ['auth(', 'require', 'session', 'getDefaultTenantId']],
  ['approvals', 'app/api/v1/approvals/route.ts', ['auth(', 'require', 'session', 'getDefaultTenantId']],
  ['kyc queue', 'app/api/v1/kyc/queue/route.ts', ['auth(', 'require', 'session', 'getDefaultTenantId']],
  ['pricing', 'app/api/v1/pricing/route.ts', ['plans', 'modules', 'addons', 'pricing']],
] as const;

async function main() {
  for (const [label, route, tokens] of routes) {
    const source = assertRoute(route);
    assertAnyContains(source, tokens, label);
  }

  const live = await runLiveChecks([
    { name: 'v1 dashboard', path: '/api/v1/dashboard' },
    { name: 'v1 notifications', path: '/api/v1/notifications' },
    { name: 'v1 vehicles', path: '/api/v1/vehicles' },
    { name: 'v1 wallet me', path: '/api/v1/wallet/me' },
  ]);

  printSummary('newModulesApi', {
    checked: routes.length,
    live,
    status: 'Passed static checks; live checks may be blocked by env',
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
