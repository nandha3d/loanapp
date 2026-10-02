/**
 * Plan-bundled features.
 *
 * Each gated capability is a boolean flag on TenantSubscription. A plan's
 * `includedFeatures` (SubscriptionPlanCatalog, edited in Developer → Billing →
 * Pricing) lists the keys below that the plan includes; when a plan is
 * activated, the tenant's flags are recomputed from it. Nothing about WHICH plan
 * gets WHICH feature lives in code — only the key ↔ flag mapping.
 */

/** Trial length when a plan has no `trialDays` of its own. */
export const DEFAULT_TRIAL_DAYS = 15;

export const PLAN_FEATURES = [
  { key: 'kyc', flag: 'kycEnabled', label: 'Aadhaar eKYC & Video KYC' },
  { key: 'foreclosure', flag: 'foreclosureEnabled', label: 'Preclose & Early Settlement' },
  { key: 'receipt_pdf', flag: 'receiptPdfAllowed', label: 'Receipt PDF Downloads' },
  { key: 'whatsapp_sms', flag: 'whatsappSmsEnabled', label: 'WhatsApp & SMS Alerts' },
  { key: 'gps_tracking', flag: 'gpsTrackingEnabled', label: 'GPS Collection & Route Tracking' },
  { key: 'bureau', flag: 'bureauEnabled', label: 'Credit Bureau Integration' },
  { key: 'nach', flag: 'nachEnabled', label: 'eNACH Mandates' },
  { key: 'premium_accounting', flag: 'premiumAccountingEnabled', label: 'Premium Accounting & GST' },
  { key: 'npa', flag: 'npaEnabled', label: 'NPA Classification Engine' },
] as const;

export type PlanFeatureKey = (typeof PLAN_FEATURES)[number]['key'];
export type PlanFeatureFlag = (typeof PLAN_FEATURES)[number]['flag'];
export type PlanFeatureFlags = Record<PlanFeatureFlag, boolean>;

const VALID_KEYS = new Set<string>(PLAN_FEATURES.map((f) => f.key));

/** Parses a stored JSON array of feature keys; unknown keys are dropped. */
export function parseFeatureKeys(raw: unknown): PlanFeatureKey[] {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const keys = value.filter((k): k is PlanFeatureKey => typeof k === 'string' && VALID_KEYS.has(k));
  return Array.from(new Set(keys));
}

/** Every flag, true only for the given keys. */
export function featureFlagsFor(keys: readonly string[]): PlanFeatureFlags {
  const on = new Set(keys);
  return Object.fromEntries(PLAN_FEATURES.map((f) => [f.flag, on.has(f.key)])) as PlanFeatureFlags;
}

/** The keys a subscription row currently has switched on. */
export function enabledFeatureKeys(sub: Partial<Record<PlanFeatureFlag, boolean | null>>): PlanFeatureKey[] {
  return PLAN_FEATURES.filter((f) => Boolean(sub[f.flag])).map((f) => f.key);
}

export type FeatureUpdate = PlanFeatureFlags & { grandfatheredFeatures: string | null };

/**
 * The flag update to apply when `catalog`'s plan is (re)activated on a tenant.
 *
 * - A plan with no checklist (`includedFeatures` NULL) is unconfigured: returns
 *   null so the tenant's flags are left exactly as they are.
 * - Same plan as before (renewal, monthly ↔ yearly): grandfathered extras survive.
 * - Different plan: grandfathered extras are dropped; the plan's checklist is the
 *   whole truth.
 */
export function planFeatureUpdate(
  catalog: { plan: string; includedFeatures: string | null },
  current: { plan: string; grandfatheredFeatures?: string | null },
): FeatureUpdate | null {
  if (catalog.includedFeatures === null || catalog.includedFeatures === undefined) return null;
  const samePlan = current.plan === catalog.plan;
  const grandfathered = samePlan ? parseFeatureKeys(current.grandfatheredFeatures) : [];
  const keys = [...parseFeatureKeys(catalog.includedFeatures), ...grandfathered];
  return {
    ...featureFlagsFor(keys),
    grandfatheredFeatures: samePlan ? (current.grandfatheredFeatures ?? null) : null,
  };
}
