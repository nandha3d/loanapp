export const ALL_MODULES = [
  'microlending',
  'autofinance',
  'chitfunds',
  'goldloan',
  'property',
  'productfinance',
] as const;

export type ModuleKey = (typeof ALL_MODULES)[number];

export const MODULE_SLUGS: Record<ModuleKey, string> = {
  microlending: 'microlending',
  autofinance: 'autofinance',
  chitfunds: 'chitfunds',
  goldloan: 'goldloan',
  property: 'property',
  productfinance: 'productfinance',
};

export const MODULE_LABELS: Record<ModuleKey, string> = {
  microlending: 'Micro Lending',
  autofinance: 'Auto Finance',
  chitfunds: 'Chit Funds',
  goldloan: 'Gold Loan',
  property: 'Property Loan',
  productfinance: 'Product Finance',
};

export const MODULE_ROUTES: Record<ModuleKey, string[]> = {
  microlending: ['/loans', '/customers', '/collection', '/route-tracker', '/penalties', '/reports', '/accounting', '/analytics', '/approvals', '/notifications', '/agent-dashboard'],
  autofinance: ['/vehicles', '/loans', '/customers', '/collection', '/route-tracker', '/penalties', '/reports', '/accounting', '/analytics', '/approvals', '/notifications', '/agent-dashboard'],
  chitfunds: ['/chits', '/customers', '/collection', '/accounting', '/reports', '/analytics', '/notifications'],
  goldloan: ['/loans', '/customers', '/collection', '/route-tracker', '/penalties', '/reports', '/accounting', '/analytics', '/approvals', '/notifications', '/agent-dashboard'],
  // Property + product finance reuse the generic loan lifecycle. Their
  // collateral-specific pages (/property, /products) ship with the gated
  // collateral migration — see docs/parity/migrations.
  property: ['/loans', '/customers', '/collection', '/route-tracker', '/penalties', '/reports', '/accounting', '/analytics', '/approvals', '/notifications', '/agent-dashboard'],
  productfinance: ['/loans', '/customers', '/collection', '/route-tracker', '/penalties', '/reports', '/accounting', '/analytics', '/approvals', '/notifications', '/agent-dashboard'],
};

const MODULE_SHARED_ROUTES = ['/dashboard', '/settings', '/subscription', '/profile', '/branch-requests', '/affiliate', '/kyc-review', '/module-requests', '/wallet'];
const DASHBOARD_EXTERNAL_PREFIXES = [
  '/admin',
  '/api',
  '/assets',
  '/borrower',
  '/fonts',
  '/login',
  '/portal',
  '/_next',
];

export function isModuleKey(value: string | null | undefined): value is ModuleKey {
  return typeof value === 'string' && (ALL_MODULES as readonly string[]).includes(value);
}

export function modulePath(module: ModuleKey | string, page: string): string {
  const normalizedPage = page.startsWith('/') ? page : `/${page}`;
  return `/${module}${normalizedPage}`;
}

export function parseModulePath(path: string): { module: ModuleKey | null; page: string } {
  const pathname = path.split(/[?#]/, 1)[0] || '/';
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length > 0 && isModuleKey(parts[0])) {
    const page = parts.length > 1 ? `/${parts.slice(1).join('/')}` : '/dashboard';
    return { module: parts[0], page };
  }
  return { module: null, page: pathname || '/' };
}

export function prefixDashboardHref(href: string, module?: string | null): string {
  if (!href.startsWith('/') || href.startsWith('//') || !module || !isModuleKey(module)) {
    return href;
  }
  if (isModuleKey(href.split('/').filter(Boolean)[0])) {
    return href;
  }
  if (DASHBOARD_EXTERNAL_PREFIXES.some((prefix) => href === prefix || href.startsWith(`${prefix}/`))) {
    return href;
  }
  return modulePath(module, href);
}

function isModuleRouteAllowed(module: ModuleKey, page: string): boolean {
  return (
    MODULE_SHARED_ROUTES.some((route) => page === route || page.startsWith(`${route}/`)) ||
    MODULE_ROUTES[module]?.some((route) => page === route || page.startsWith(`${route}/`))
  );
}

export function normalizeModuleList(value: unknown): ModuleKey[] {
  let parsedValue = value;
  if (typeof value === 'string') {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      parsedValue = value.split(',').map((s) => s.trim());
    }
  }
  if (!Array.isArray(parsedValue)) return [];
  return parsedValue.filter((item): item is ModuleKey =>
    typeof item === 'string' && (ALL_MODULES as readonly string[]).includes(item),
  );
}

export function moduleForRoute(path: string): ModuleKey | null {
  const { page } = parseModulePath(path);
  for (const moduleKey of ALL_MODULES) {
    if (MODULE_ROUTES[moduleKey].some((route) => page === route || page.startsWith(`${route}/`))) {
      return moduleKey;
    }
  }
  return null;
}

export function isRouteEnabledForModules(path: string, modules: readonly string[]): boolean {
  const activeModules = normalizeModuleList([...modules]);
  const { module, page } = parseModulePath(path);
  if (module) {
    return activeModules.includes(module) && isModuleRouteAllowed(module, page);
  }

  // Check if at least one enabled module supports this route
  for (const moduleKey of activeModules) {
    if (MODULE_ROUTES[moduleKey]?.some((route) => page === route || page.startsWith(`${route}/`))) {
      return true;
    }
  }

  // If the path is not restricted by ANY module, it's enabled by default
  const isRestrictedByAny = Object.values(MODULE_ROUTES).some((routes) =>
    routes.some((route) => page === route || page.startsWith(`${route}/`))
  );
  return !isRestrictedByAny;
}

// ─── Add-on keys (feature flags, not full app types) ──────────────────────────
export const ADDON_KEYS = ['premium_accounting'] as const;
export type AddOnKey = (typeof ADDON_KEYS)[number];

export const ADDON_LABELS: Record<AddOnKey, string> = {
  premium_accounting: 'Premium Accounting',
};

export function isAddOnKey(value: string | null | undefined): value is AddOnKey {
  return typeof value === 'string' && (ADDON_KEYS as readonly string[]).includes(value);
}

export function isAddOnEnabled(
  subscription: { premiumAccountingEnabled?: boolean } | null | undefined,
  key: AddOnKey,
): boolean {
  if (!subscription) return false;
  if (key === 'premium_accounting') return Boolean(subscription.premiumAccountingEnabled);
  return false;
}
