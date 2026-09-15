export type VerticalBaseCatalogItem = {
  id: string;
  module: string;
  displayName: string;
  description: string | null;
  monthlyPrice: number;
  isActive: boolean;
  sortOrder: number;
};

export const STANDARD_VERTICAL_BASES: VerticalBaseCatalogItem[] = [
  {
    id: '',
    module: 'microlending',
    displayName: 'Micro Lending',
    description: 'Manage micro loans, daily collections, routes, and agents',
    monthlyPrice: 0,
    isActive: true,
    sortOrder: 0,
  },
  {
    id: '',
    module: 'autofinance',
    displayName: 'Auto Finance',
    description: 'Vehicle financing, hire purchase, collateral tracking, and hypothecation',
    monthlyPrice: 0,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: '',
    module: 'chitfunds',
    displayName: 'Chit Funds',
    description: 'Organize chit groups, auctions, dividend distribution, and member entries',
    monthlyPrice: 0,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: '',
    module: 'goldloan',
    displayName: 'Gold Loan',
    description: 'Gold-backed lending, valuation, LTV, packets, pledges, and release tracking',
    monthlyPrice: 0,
    isActive: true,
    sortOrder: 3,
  },
  {
    id: '',
    module: 'property',
    displayName: 'Property Loan',
    description: 'Property-backed lending, mortgage documents, valuation, and release tracking',
    monthlyPrice: 0,
    isActive: true,
    sortOrder: 4,
  },
  {
    id: '',
    module: 'productfinance',
    displayName: 'Product Finance',
    description: 'Consumer-durable and product financing with dealer and EMI tracking',
    monthlyPrice: 0,
    isActive: true,
    sortOrder: 5,
  },
];

export function withStandardVerticalBases<T extends VerticalBaseCatalogItem>(modules: T[]) {
  const moduleKeys = new Set(modules.map((item) => item.module));
  const missingModules = STANDARD_VERTICAL_BASES.filter((item) => !moduleKeys.has(item.module));
  return [...modules, ...missingModules].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function normalizeSelectedModules(selectedModules: unknown): string[] {
  if (!Array.isArray(selectedModules)) return ['microlending'];

  const modules = selectedModules
    .map((module) => String(module).trim())
    .filter(Boolean);

  return modules.length > 0 ? Array.from(new Set(modules)) : ['microlending'];
}

export function calculateVerticalSubscriptionPricing(
  planMonthlyPrice: number,
  selectedModules: string[],
  addonsPrice = 0
) {
  const verticalCount = Math.max(selectedModules.length, 1);
  const basePlanPrice = planMonthlyPrice;
  const modulesPrice = planMonthlyPrice * Math.max(verticalCount - 1, 0);
  const totalMonthlyPrice = basePlanPrice + modulesPrice + addonsPrice;

  return {
    basePlanPrice,
    modulesPrice,
    addonsPrice,
    totalMonthlyPrice,
    verticalCount,
  };
}

export function addonKeysFromSubscriptionFlags(flags: {
  whatsappSmsEnabled?: boolean;
  bureauEnabled?: boolean;
  kycEnabled?: boolean;
  gpsTrackingEnabled?: boolean;
  premiumAccountingEnabled?: boolean;
}) {
  const selectedAddons: string[] = [];
  if (flags.whatsappSmsEnabled) selectedAddons.push('whatsapp_sms');
  if (flags.bureauEnabled) selectedAddons.push('bureau');
  if (flags.kycEnabled) selectedAddons.push('kyc');
  if (flags.gpsTrackingEnabled) selectedAddons.push('gps_tracking');
  if (flags.premiumAccountingEnabled) selectedAddons.push('premium_accounting');
  return selectedAddons;
}
