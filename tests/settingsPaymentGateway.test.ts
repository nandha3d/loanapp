import {
  assertAnyContains,
  assertContains,
  assertRoute,
  printSummary,
  runLiveChecks,
} from './newModulesApiHarness';

const settings = assertRoute('app/api/v1/settings/route.ts');
assertContains(settings, ['tenantId'], 'settings tenant scope');
assertAnyContains(settings, ['GET', 'POST', 'PATCH'], 'settings methods');

const gateway = assertRoute('app/api/v1/settings/payment-gateway/route.ts');
assertContains(gateway, ['tenantId'], 'payment gateway tenant scope');
assertAnyContains(gateway, ['razorpay', 'upi', 'gateway', 'payment'], 'payment gateway fields');

const pricing = assertRoute('app/api/v1/pricing/route.ts');
assertAnyContains(pricing, ['plans', 'modules', 'addons', 'pricing'], 'pricing catalog response');

async function main() {
  const live = await runLiveChecks([
    { name: 'settings', path: '/api/v1/settings' },
    { name: 'payment gateway', path: '/api/v1/settings/payment-gateway' },
    { name: 'pricing', path: '/api/v1/pricing' },
  ]);

  printSummary('settingsPaymentGateway', {
    checked: 3,
    live,
    status: 'Passed static settings/payment checks',
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
