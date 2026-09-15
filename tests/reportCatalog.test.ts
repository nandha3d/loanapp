import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHIT_REPORT_SLUGS } from '../lib/chits/reports';
import { reportRegistry } from '../lib/reports/registry';
import { classifyCashFlowEntryType } from '../lib/reports/builders/cash-flow';
import {
  getReportDefinitionForAppType,
  getReportsForAppType,
  reportDefinitions,
} from '../lib/reports/catalog';

const visibleChitSlugs = getReportsForAppType('chitfunds').map((report) => report.slug).sort();
const expectedChitSlugs = [...CHIT_REPORT_SLUGS, 'cash-flow', 'wallet-float-ledger'].sort();

assert.deepEqual(
  visibleChitSlugs,
  expectedChitSlugs,
  'chitfunds should expose exactly the canonical chit reports plus scoped cash-flow and wallet reports',
);

assert.equal(getReportDefinitionForAppType('chitfunds', 'loan-register'), undefined);
assert.equal(getReportDefinitionForAppType('chitfunds', 'npa-classification-report'), undefined);
assert.equal(getReportDefinitionForAppType('property', 'property-collateral-register')?.slug, 'property-collateral-register');
assert.equal(getReportDefinitionForAppType('property', 'product-finance-register'), undefined);
assert.equal(getReportDefinitionForAppType('productfinance', 'product-finance-register')?.slug, 'product-finance-register');
assert.equal(getReportDefinitionForAppType('autofinance', 'property-collateral-register'), undefined);
for (const slug of ['vehicle-hypothecation-report', 'insurance-expiry-report', 'seizure-repo-report']) {
  assert.equal(getReportDefinitionForAppType('autofinance', slug)?.slug, slug);
  assert.equal(getReportDefinitionForAppType('microlending', slug), undefined);
}
assert.equal(classifyCashFlowEntryType('collection'), 'inflow');
assert.equal(classifyCashFlowEntryType('chit_payout'), 'outflow');
assert.equal(classifyCashFlowEntryType('chit_dividend_payout'), 'outflow');

const definitionSlugs = reportDefinitions.map((definition) => definition.slug);
assert.equal(new Set(definitionSlugs).size, definitionSlugs.length, 'report slugs must be defined once');
assert.deepEqual(
  [...definitionSlugs].sort(),
  Object.keys(reportRegistry).sort(),
  'every registered report slug, including compatibility aliases, must have catalog metadata',
);

for (const relativePath of [
  'app/api/v1/reports/[slug]/route.ts',
  'app/api/v1/reports/[slug]/export/route.ts',
]) {
  const source = readFileSync(join(process.cwd(), relativePath), 'utf8');
  assert.match(source, /getReportDefinitionForAppType/, `${relativePath} must enforce module-aware report access`);
  assert.doesNotMatch(source, /reportRegistry\[slug\]/, `${relativePath} must not bypass the catalog`);
}

const analyticsSource = readFileSync(
  join(process.cwd(), 'app/(dashboard)/[module]/analytics/page.tsx'),
  'utf8',
);
assert.match(analyticsSource, /getReportsForAppType/, 'analytics must render its report center from the catalog');
assert.doesNotMatch(analyticsSource, /moduleReportsByAppType/, 'analytics must not maintain a second report matrix');

console.log('reportCatalog tests passed');
