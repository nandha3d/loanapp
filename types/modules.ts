export const ALL_MODULES = [
  'microlending',
  'autofinance',
  'chitfunds',
] as const;

export type ModuleKey = (typeof ALL_MODULES)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  microlending: 'Micro Lending',
  autofinance: 'Auto Finance',
  chitfunds: 'Chit Funds',
};

export const MODULE_ROUTES: Record<ModuleKey, string[]> = {
  microlending: ['/loans', '/customers', '/collection', '/penalties', '/reports'],
  autofinance: ['/vehicles', '/loans', '/customers', '/collection', '/penalties', '/reports'],
  chitfunds: ['/chits', '/customers'],
};

export function normalizeModuleList(value: unknown): ModuleKey[] {
  // DB stores modules as JSON strings in LongText columns — parse them first
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return []; }
  }
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ModuleKey =>
    typeof item === 'string' && (ALL_MODULES as readonly string[]).includes(item),
  );
}

export function moduleForRoute(path: string): ModuleKey | null {
  for (const module of ALL_MODULES) {
    if (MODULE_ROUTES[module].some((route) => path === route || path.startsWith(`${route}/`))) {
      return module;
    }
  }
  return null;
}

export function isRouteEnabledForModules(path: string, modules: readonly string[]): boolean {
  const activeModules = normalizeModuleList([...modules]);
  // Check if at least one enabled module supports this route
  for (const module of activeModules) {
    if (MODULE_ROUTES[module]?.some((route) => path === route || path.startsWith(`${route}/`))) {
      return true;
    }
  }
  
  // If the path is not restricted by ANY module, it's enabled by default
  const isRestrictedByAny = Object.values(MODULE_ROUTES).some((routes) =>
    routes.some((route) => path === route || path.startsWith(`${route}/`))
  );
  return !isRestrictedByAny;
}
