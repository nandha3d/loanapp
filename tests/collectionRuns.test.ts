import {
  assertAnyContains,
  assertContains,
  assertRoute,
  printSummary,
  runLiveChecks,
} from './newModulesApiHarness';

const runRoutes = [
  ['run list', 'app/api/v1/collection/run/route.ts'],
  ['run open', 'app/api/v1/collection/run/open/route.ts'],
  ['run sheet', 'app/api/v1/collection/run/[id]/sheet/route.ts'],
  ['run collect', 'app/api/v1/collection/run/[id]/collect/route.ts'],
  ['run close', 'app/api/v1/collection/run/[id]/close/route.ts'],
  ['run reconcile', 'app/api/v1/collection/run/[id]/reconcile/route.ts'],
  ['self-pay link', 'app/api/v1/collection/self-pay/link/route.ts'],
] as const;

for (const [label, route] of runRoutes) {
  const source = assertRoute(route);
  assertAnyContains(source, ['tenantId', 'auth', 'session', 'serverFetch'], label);
}

const collectSource = assertRoute('app/api/v1/collection/run/[id]/collect/route.ts');
assertContains(collectSource, ['collectRunLines'], 'run collect service delegation');
assertAnyContains(collectSource, ['skipped', 'Invalid lines are skipped'], 'run collect skipped-line handling');

async function main() {
  const live = await runLiveChecks([
    { name: 'collection run list', path: '/api/v1/collection/run' },
    { name: 'collection today', path: '/api/v1/collection/today' },
  ]);

  printSummary('collectionRuns', {
    checked: runRoutes.length,
    live,
    status: 'Passed collection run static checks',
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
