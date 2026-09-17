import { getSetting } from '@/lib/tenant';
import { GOLD_PURE_RATE_KEY, GOLD_DEFAULT_LTV_KEY } from '@/lib/gold/valuation';

/**
 * Gold/Silver pledge settings — read from per-tenant AppSetting, never hardcoded.
 * Defaults here are last-resort fallbacks only; admins override every value in
 * the gold settings page, and can hide/show fields via `gold_field_visibility`.
 */

export const GOLD_SETTING_KEYS = {
  goldPureRate: GOLD_PURE_RATE_KEY,          // ₹/g of pure (24K) gold
  silverRate: 'silver_rate_per_gram',        // ₹/g silver
  goldInterestPercent: 'gold_interest_percent',
  silverInterestPercent: 'silver_interest_percent',
  interestSchemeMonths: 'gold_interest_scheme_months',
  processingFeeDefault: 'gold_processing_fee_default',
  processingFeePercentageBased: 'gold_processing_fee_percentage_based',
  autoRateKaratBased: 'gold_auto_rate_karat_based',
  defaultLtvPercent: GOLD_DEFAULT_LTV_KEY,
  billPrefix: 'gold_bill_prefix',
  fieldVisibility: 'gold_field_visibility', // JSON: { fieldKey: false } hides a field
} as const;

export type GoldConfig = {
  goldPureRatePerGram: number | null;
  silverRatePerGram: number | null;
  goldInterestPercent: number | null;
  silverInterestPercent: number | null;
  interestSchemeMonths: number;
  processingFeeDefault: number;
  processingFeePercentageBased: boolean;
  autoRateKaratBased: boolean;
  defaultLtvPercent: number | null;
  billPrefix: string;
  /** Map of fieldKey → visible. Missing key = visible (default shown). */
  fieldVisibility: Record<string, boolean>;
};

function num(v: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function bool(v: string): boolean {
  return v === 'true' || v === '1';
}

/** Read the full gold/silver pledge config for a tenant (one settings round-trip group). */
export async function getGoldConfig(tenantId: string): Promise<GoldConfig> {
  const K = GOLD_SETTING_KEYS;
  const [
    goldRate, silverRate, goldInt, silverInt, scheme, procFee, procPct, autoRate, ltv, prefix, vis,
  ] = await Promise.all([
    getSetting(tenantId, K.goldPureRate, ''),
    getSetting(tenantId, K.silverRate, ''),
    getSetting(tenantId, K.goldInterestPercent, ''),
    getSetting(tenantId, K.silverInterestPercent, ''),
    getSetting(tenantId, K.interestSchemeMonths, '1'),
    getSetting(tenantId, K.processingFeeDefault, '0'),
    getSetting(tenantId, K.processingFeePercentageBased, 'false'),
    getSetting(tenantId, K.autoRateKaratBased, 'false'),
    getSetting(tenantId, K.defaultLtvPercent, ''),
    getSetting(tenantId, K.billPrefix, 'A'),
    getSetting(tenantId, K.fieldVisibility, ''),
  ]);

  let fieldVisibility: Record<string, boolean> = {};
  if (vis) {
    try {
      const parsed = JSON.parse(vis);
      if (parsed && typeof parsed === 'object') fieldVisibility = parsed;
    } catch {
      fieldVisibility = {};
    }
  }

  return {
    goldPureRatePerGram: num(goldRate),
    silverRatePerGram: num(silverRate),
    goldInterestPercent: num(goldInt),
    silverInterestPercent: num(silverInt),
    interestSchemeMonths: num(scheme) ?? 1,
    processingFeeDefault: num(procFee) ?? 0,
    processingFeePercentageBased: bool(procPct),
    autoRateKaratBased: bool(autoRate),
    defaultLtvPercent: num(ltv),
    billPrefix: prefix || 'A',
    fieldVisibility,
  };
}

/** Metal-aware rate + interest resolver for the pledge form/engine. */
export function metalRate(config: GoldConfig, metal: string): number | null {
  return metal === 'silver' ? config.silverRatePerGram : config.goldPureRatePerGram;
}
export function metalInterest(config: GoldConfig, metal: string): number | null {
  return metal === 'silver' ? config.silverInterestPercent : config.goldInterestPercent;
}

/** Whether a gold form field is visible (admin can hide via settings). */
export function isFieldVisible(config: GoldConfig, fieldKey: string): boolean {
  return config.fieldVisibility[fieldKey] !== false;
}
