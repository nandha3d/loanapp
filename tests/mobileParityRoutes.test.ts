import { assertRoute, printSummary } from './newModulesApiHarness';

const mobileV1Routes = [
  'app/api/v1/auth/login/route.ts',
  'app/api/v1/auth/2fa/route.ts',
  'app/api/v1/auth/forgot-password/route.ts',
  'app/api/v1/auth/register/route.ts',
  'app/api/v1/dashboard/route.ts',
  'app/api/v1/customers/route.ts',
  'app/api/v1/customers/[id]/route.ts',
  'app/api/v1/loans/route.ts',
  'app/api/v1/loans/calculate/route.ts',
  'app/api/v1/collection/today/route.ts',
  'app/api/v1/collection/entry/route.ts',
  'app/api/v1/collection/proof/photo/route.ts',
  'app/api/v1/collection/proof/qr/route.ts',
  'app/api/v1/collection/run/route.ts',
  'app/api/v1/collection/run/open/route.ts',
  'app/api/v1/collection/self-pay/link/route.ts',
  'app/api/v1/gps/ping/route.ts',
  'app/api/v1/gps/live/route.ts',
  'app/api/v1/kyc/queue/route.ts',
  'app/api/v1/penalties/route.ts',
  'app/api/v1/approvals/route.ts',
  'app/api/v1/analytics/summary/route.ts',
  'app/api/v1/chits/route.ts',
  'app/api/v1/reports/daily/route.ts',
  'app/api/v1/wallet/me/route.ts',
  'app/api/v1/wallet/agents/route.ts',
  'app/api/v1/vehicles/route.ts',
  'app/api/v1/notifications/route.ts',
  'app/api/v1/settings/route.ts',
  'app/api/v1/settings/payment-gateway/route.ts',
];

for (const route of mobileV1Routes) {
  assertRoute(route);
}

printSummary('mobileParityRoutes', {
  checked: mobileV1Routes.length,
  status: 'Passed static route contract checks',
});
