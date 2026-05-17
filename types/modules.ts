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
  autofinance: ['/vehicles'],
  chitfunds: ['/chits'],
};

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
  for (const module of ALL_MODULES) {
    if (MODULE_ROUTES[module].some((route) => path === route || path.startsWith(`${route}/`))) {
      return module;
    }
  }
  return null;
}

export function isRouteEnabledForModules(path: string, modules: readonly string[]): boolean {
  const requiredModule = moduleForRoute(path);
  if (!requiredModule) return true;
  return normalizeModuleList([...modules]).includes(requiredModule);
}
