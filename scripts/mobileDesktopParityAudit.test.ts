import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

function source(path: string): string {
  assert.equal(existsSync(path), true, `${path} exists`);
  return readFileSync(path, 'utf8');
}

const parityDoc = source('docs/parity/mobile-vs-desktop.md');

const npaMobileFiles = [
  'mobile/lib/data/models/npa.dart',
  'mobile/lib/data/services/npa_service.dart',
  'mobile/lib/features/npa/npa_screen.dart',
  'app/api/v1/npa/summary/route.ts',
  'app/api/v1/npa/loans/route.ts',
  'app/api/v1/npa/history/route.ts',
  'app/api/v1/npa/upgrade/route.ts',
];

for (const path of npaMobileFiles) {
  source(path);
}

for (const endpoint of ['npaSummary', 'npaLoans', 'npaHistory', 'npaUpgrade']) {
  assert.match(source('mobile/lib/shared/constants/endpoints.dart'), new RegExp(endpoint), `mobile endpoint ${endpoint} exists`);
}

assert.match(source('mobile/lib/core/router/app_router.dart'), /path: '\/npa'/, 'mobile has /npa route');
assert.match(source('mobile/lib/core/router/app_router.dart'), /location\.startsWith\('\/npa'\)/, 'mobile route guard blocks /npa');
assert.match(source('mobile/lib/features/settings/settings_detail_screen.dart'), /type: 'npa'|npa_threshold_days|npa_penalty_rate/, 'NPA settings remains config-only');

const premiumRoutes = [
  'cashflow',
  'approvals',
  'budget',
  'tax',
  'vendors',
  'export',
  'settings',
];

for (const route of premiumRoutes) {
  const path = `app/api/v1/accounting/${route}/route.ts`;
  const routeSource = source(path);
  assert.match(routeSource, /requireMobileContext/, `${path} uses mobile auth`);
  assert.match(routeSource, /from '@\/lib\/api\/v1-envelope'/, `${path} uses v1 envelope`);
  assert.match(routeSource, /premiumMobileService/, `${path} delegates to shared premium service`);
  assert.match(routeSource, /\bok\(|\bfail\(/, `${path} returns ok/fail`);
}

const premiumService = source('lib/accounting/premiumMobileService.ts');
for (const fn of [
  'assertPremiumAccountingAccess',
  'getPremiumCashflow',
  'listPremiumApprovals',
  'reviewPremiumApproval',
  'listPremiumBudgets',
  'getPremiumTaxSummary',
  'listPremiumVendors',
  'getPremiumAccountingSettings',
  'listPremiumExportRuns',
]) {
  assert.match(premiumService, new RegExp(`export async function ${fn}`), `shared premium service exports ${fn}`);
}

const accountingScreen = source('mobile/lib/features/accounting/accounting_screen.dart');
for (const label of ['Cash Flow', 'Approvals', 'Budget', 'Tax & GST', 'Vendors', 'Export Runs', 'Premium Settings']) {
  assert.match(accountingScreen, new RegExp(label.replace(/[&]/g, '&')), `accounting screen exposes ${label}`);
}

for (const phrase of [
  'NPA summary, loans, history, upgrade',
  'Premium CoA',
  'Accounting approvals',
  'Budget',
  'Tax & GST',
  'Vendors/AP bills',
  'Cron jobs',
  'Borrower portal',
]) {
  assert.match(parityDoc, new RegExp(phrase.replace(/[/*]/g, '.')), `parity report includes ${phrase}`);
}

console.log('Mobile/desktop parity audit checks passed');
