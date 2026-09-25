import type { AppType } from '@/lib/appConfig';
import { CHIT_REPORT_SLUGS } from '@/lib/chits/reports';
import { reportRegistry, type ReportBuilder } from './registry';

export type ReportAddon = 'premium_accounting';

export type ReportDefinition = {
  slug: string;
  name: string;
  category: string;
  builder: ReportBuilder;
  allowedAppTypes: readonly AppType[];
  addon?: ReportAddon;
  visible?: boolean;
};

const ALL_APP_TYPES: readonly AppType[] = [
  'microlending',
  'autofinance',
  'chitfunds',
  'goldloan',
  'property',
  'productfinance',
];

const LENDING_APP_TYPES: readonly AppType[] = ALL_APP_TYPES.filter((appType) => appType !== 'chitfunds');

type DefinitionSeed = Omit<ReportDefinition, 'builder'>;

function titleCase(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function seeds(
  category: string,
  slugs: readonly string[],
  allowedAppTypes: readonly AppType[],
  options: Pick<DefinitionSeed, 'addon' | 'visible'> = {},
): DefinitionSeed[] {
  return slugs.map((slug) => ({
    slug,
    name: titleCase(slug),
    category,
    allowedAppTypes,
    ...options,
  }));
}

const lendingSeeds: DefinitionSeed[] = [
  ...seeds('Loan & Portfolio', ['loan-register', 'loan-status-report', 'loan-type-report', 'loan-maturity-report'], LENDING_APP_TYPES),
  ...seeds('Collection Operations', [
    'daily-collection', 'date-wise-collection', 'agent-wise-collection', 'area-wise-collection',
    'customer-collection-history', 'collection-mode-report', 'missed-collection-report',
    'partial-payment-report', 'advance-payment-report', 'collection-efficiency',
  ], LENDING_APP_TYPES),
  ...seeds('Risk & NPA', ['aging', 'high-risk-customers', 'chronic-defaulters', 'npa-classification-report'], LENDING_APP_TYPES),
  ...seeds('EMI', ['emi-schedule', 'upcoming-emi-report', 'todays-emi-report'], LENDING_APP_TYPES),
  ...seeds('Customer Register', ['customer-register', 'customer-loan-history', 'repeat-borrowers', 'inactive-customers', 'top-borrowers'], LENDING_APP_TYPES),
  ...seeds('Agent Operations', ['agent-performance', 'agent-attendance', 'missed-visit-report', 'commission-report'], LENDING_APP_TYPES),
  ...seeds('Financial & Accounting', ['disbursement', 'interest-income', 'penalty-income-report', 'outstanding-balance', 'profit-report'], LENDING_APP_TYPES),
  ...seeds('Branch Monitoring', ['branch-performance', 'branch-comparison'], LENDING_APP_TYPES),
  ...seeds('GPS & Field Tracking', ['gps-route', 'travel-distance', 'customer-visit-history', 'missed-gps-checkin'], LENDING_APP_TYPES),
  ...seeds('System & Audit Logs', ['notification-report', 'audit-activity', 'login-history-report'], LENDING_APP_TYPES),
  ...seeds('Payments & Reconciliations', ['payment-by-mode', 'failed-payments', 'refund-report', 'duplicate-payments', 'cancelled-payments'], LENDING_APP_TYPES),
  ...seeds('Premium Accounting Statements', ['day-book', 'cash-book', 'ledger-report', 'bank-book'], LENDING_APP_TYPES, { addon: 'premium_accounting' }),
];

const moduleSeeds: DefinitionSeed[] = [
  ...seeds('Auto Finance Reports', ['vehicle-hypothecation-report', 'insurance-expiry-report', 'seizure-repo-report'], ['autofinance']),
  ...seeds('Gold Loan Reports', ['gold-pledge-register', 'gold-maturity-auction', 'gold-released-redeemed', 'gold-bank-repledge-report'], ['goldloan']),
  ...seeds('Property Finance Reports', ['property-collateral-register', 'property-mortgage-status'], ['property']),
  ...seeds('Product Finance Reports', ['product-finance-register', 'product-repossession-report'], ['productfinance']),
];

const chitSeeds: DefinitionSeed[] = seeds('Chit Fund Reports', CHIT_REPORT_SLUGS, ['chitfunds']);

const compatibilityAliasSeeds: DefinitionSeed[] = seeds(
  'Chit Fund Reports',
  [
    'auction-bid-history',
    'chit-prized-subscribers',
    'prized-subscriber-report',
    'chit-foreman-commission',
    'chit-defaults-report',
  ],
  ['chitfunds'],
  { visible: false },
);

const neutralSeeds: DefinitionSeed[] = [
  ...seeds('Financial & Accounting', ['cash-flow'], ALL_APP_TYPES),
  ...seeds('Wallet / Float', ['wallet-float-ledger'], ALL_APP_TYPES),
];

const definitionSeeds = [
  ...lendingSeeds,
  ...moduleSeeds,
  ...chitSeeds,
  ...compatibilityAliasSeeds,
  ...neutralSeeds,
];

export const reportDefinitions: ReportDefinition[] = definitionSeeds.map((definition) => {
  const builder = reportRegistry[definition.slug];
  if (!builder) throw new Error(`Report catalog references missing builder '${definition.slug}'`);
  return { ...definition, builder };
});

const reportDefinitionsBySlug = new Map(reportDefinitions.map((definition) => [definition.slug, definition]));

export function getReportDefinitionForAppType(appType: AppType, slug: string): ReportDefinition | undefined {
  const definition = reportDefinitionsBySlug.get(slug);
  return definition?.allowedAppTypes.includes(appType) ? definition : undefined;
}

export function getReportsForAppType(
  appType: AppType,
  options: { premiumAccountingEnabled?: boolean } = {},
): ReportDefinition[] {
  return reportDefinitions.filter((definition) => {
    if (definition.visible === false || !definition.allowedAppTypes.includes(appType)) return false;
    if (definition.addon === 'premium_accounting' && !options.premiumAccountingEnabled) return false;
    return true;
  });
}
