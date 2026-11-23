import { getSetting, setSetting } from '@/lib/tenant';
import {
  CHIT_ENGINE_CATALOG,
  CHIT_ENGINE_TYPES,
  DEFAULT_ENABLED_CHIT_ENGINE_TYPES,
  isChitEngineType,
  parseChitEngineConfig,
  type ChitEngineConfig,
  type ChitEngineType,
} from './engineTypes';
import { validateChitEngineConfig } from './validation';

/**
 * Per-tenant Chit Fund Type enablement & configurable default rules.
 * Stored in AppSetting (never hardcoded — STABLE-4, CFG-1).
 *
 * Untouched tenants default to DEFAULT_ENABLED_CHIT_ENGINE_TYPES so existing
 * behavior is preserved byte-for-byte (STABLE-2).
 */
export const CHIT_SETTING_KEYS = {
  enabledTypes: 'chit_enabled_types',
  typeDefaults: 'chit_type_defaults',
} as const;

export type ChitTypeDefaultsMap = Partial<Record<ChitEngineType, ChitEngineConfig>>;

export type ChitTypeSettingsState = {
  enabledTypes: ChitEngineType[];
  typeDefaults: Record<ChitEngineType, ChitEngineConfig>;
};

export function resolveChitTypeSettingsFromRaw(
  enabledRaw: string | null | undefined,
  defaultsRaw: string | null | undefined,
): ChitTypeSettingsState {
  let enabledTypes: ChitEngineType[] = [...DEFAULT_ENABLED_CHIT_ENGINE_TYPES];
  if (enabledRaw && enabledRaw.trim()) {
    try {
      const parsed = JSON.parse(enabledRaw);
      if (Array.isArray(parsed)) {
        const filtered = Array.from(new Set(parsed.filter(isChitEngineType)));
        if (filtered.length > 0) enabledTypes = filtered;
      }
    } catch {
      enabledTypes = [...DEFAULT_ENABLED_CHIT_ENGINE_TYPES];
    }
  }

  let rawOverrides: Record<string, unknown> = {};
  if (defaultsRaw && defaultsRaw.trim()) {
    try {
      const parsed = JSON.parse(defaultsRaw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        rawOverrides = parsed as Record<string, unknown>;
      }
    } catch {
      rawOverrides = {};
    }
  }

  const typeDefaults = {} as Record<ChitEngineType, ChitEngineConfig>;
  for (const code of CHIT_ENGINE_TYPES) {
    const override = rawOverrides[code];
    typeDefaults[code] = parseChitEngineConfig(
      override && typeof override === 'object' ? (override as Record<string, unknown>) : null,
      code,
    );
  }

  return { enabledTypes, typeDefaults };
}

export async function getChitTypeSettings(tenantId: string): Promise<ChitTypeSettingsState> {
  const [enabledRaw, defaultsRaw] = await Promise.all([
    getSetting(tenantId, CHIT_SETTING_KEYS.enabledTypes, ''),
    getSetting(tenantId, CHIT_SETTING_KEYS.typeDefaults, ''),
  ]);
  return resolveChitTypeSettingsFromRaw(enabledRaw, defaultsRaw);
}

export async function isChitEngineTypeEnabled(tenantId: string, engineType: ChitEngineType): Promise<boolean> {
  const state = await getChitTypeSettings(tenantId);
  return state.enabledTypes.includes(engineType);
}

export async function assertChitEngineTypeEnabled(tenantId: string, engineType: string): Promise<ChitEngineType> {
  if (!isChitEngineType(engineType)) {
    throw new Error(`Invalid chit type: ${engineType}`);
  }
  const enabled = await isChitEngineTypeEnabled(tenantId, engineType);
  if (!enabled) {
    const label = CHIT_ENGINE_CATALOG[engineType].name;
    throw new Error(`Chit type "${label}" (${engineType}) is disabled in Settings -> Chit Types`);
  }
  return engineType;
}

export function validateAndNormalizeChitTypeSettingsInput(input: {
  enabledTypes: unknown;
  typeDefaults?: unknown;
}): { enabledTypes: ChitEngineType[]; typeDefaults: ChitTypeDefaultsMap } {
  if (!Array.isArray(input.enabledTypes)) {
    throw new Error('enabledTypes must be an array');
  }
  const enabled: ChitEngineType[] = [];
  for (const item of input.enabledTypes) {
    if (!isChitEngineType(item)) {
      throw new Error(`Unknown chit type: ${String(item)}`);
    }
    if (!enabled.includes(item)) enabled.push(item);
  }
  if (enabled.length === 0) {
    throw new Error('At least one chit type must remain enabled');
  }

  const normalizedDefaults: ChitTypeDefaultsMap = {};
  if (input.typeDefaults && typeof input.typeDefaults === 'object' && !Array.isArray(input.typeDefaults)) {
    for (const [key, rawCfg] of Object.entries(input.typeDefaults as Record<string, unknown>)) {
      if (!isChitEngineType(key)) {
        throw new Error(`Unknown chit type in typeDefaults: ${key}`);
      }
      const parsedCfg = parseChitEngineConfig(
        rawCfg && typeof rawCfg === 'object' ? (rawCfg as Record<string, unknown>) : null,
        key,
      );
      validateChitEngineConfig(key, parsedCfg, { requireScheduleRows: false });
      normalizedDefaults[key] = parsedCfg;
    }
  }

  return { enabledTypes: enabled, typeDefaults: normalizedDefaults };
}

export async function saveChitTypeSettings(
  tenantId: string,
  input: {
    enabledTypes: ChitEngineType[] | unknown;
    typeDefaults?: Record<string, Partial<ChitEngineConfig>> | unknown;
  },
): Promise<ChitTypeSettingsState> {
  const normalized = validateAndNormalizeChitTypeSettingsInput(input);
  await Promise.all([
    setSetting(tenantId, CHIT_SETTING_KEYS.enabledTypes, JSON.stringify(normalized.enabledTypes), 'chits'),
    ...(input.typeDefaults !== undefined
      ? [setSetting(tenantId, CHIT_SETTING_KEYS.typeDefaults, JSON.stringify(normalized.typeDefaults), 'chits')]
      : []),
  ]);
  return getChitTypeSettings(tenantId);
}
