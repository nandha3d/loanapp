import {
  assertAnyContains,
  assertContains,
  assertRoute,
  printSummary,
  runLiveChecks,
} from './newModulesApiHarness';

const vehicleSource = assertRoute('app/api/v1/vehicles/route.ts');
assertContains(vehicleSource, ['registrationNo', 'tenantId'], 'vehicles route');
assertAnyContains(vehicleSource, ['POST', 'export async function POST'], 'vehicle create method');

const walletRoutes = [
  ['wallet me', 'app/api/v1/wallet/me/route.ts'],
  ['wallet agents', 'app/api/v1/wallet/agents/route.ts'],
  ['wallet release', 'app/api/v1/wallet/release/route.ts'],
  ['wallet branch', 'app/api/v1/wallet/branch/route.ts'],
  ['wallet deposit', 'app/api/v1/wallet/deposit/route.ts'],
] as const;

for (const [label, route] of walletRoutes) {
  const source = assertRoute(route);
  assertAnyContains(source, ['auth', 'session', 'role', 'tenantId'], label);
}

const notifications = assertRoute('app/api/v1/notifications/route.ts');
assertAnyContains(notifications, ['buildSystemNotificationWhere', 'tenantId'], 'notifications visibility');

async function main() {
  const live = await runLiveChecks([
    { name: 'vehicles', path: '/api/v1/vehicles' },
    { name: 'wallet me', path: '/api/v1/wallet/me' },
    { name: 'notifications', path: '/api/v1/notifications' },
  ]);

  printSummary('vehiclesWalletNotifications', {
    checkedWalletRoutes: walletRoutes.length,
    live,
    status: 'Passed static contract checks',
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
