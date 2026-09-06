/**
 * Gold valuation math — pure and testable, shared by the web loan form and
 * (mirrored) the mobile origination screen.
 *
 * `ratePerGram` is the market rate for ONE gram of pure (24K) gold. The karat
 * purity is converted to a fineness factor and applied, so a 22K ornament is
 * valued at 91.6% of the pure-gold rate. These factors are physical constants,
 * not tunable business values. The *rate* and the *LTV %* ARE tunable and must
 * come from AppSetting (never hardcoded) — see getGoldDefaults().
 */

/** Karat → fineness (fraction of pure gold). */
export const KARAT_FINENESS: Record<string, number> = {
  '24K': 1.0,
  '23K': 0.958,
  '22K': 0.916,
  '21K': 0.875,
  '20K': 0.833,
  '18K': 0.75,
  '14K': 0.585,
  '10K': 0.417,
};

export function finenessFor(purityKarat: string): number {
  const key = (purityKarat ?? '').trim().toUpperCase();
  const known = KARAT_FINENESS[key];
  if (known !== undefined) return known;
  // A karat not in the table must value at ITS OWN fineness (N/24), never
  // silently borrow the 22K constant — a 9K ornament appraised at 22K
  // over-values the pledge by more than half.
  const m = key.match(/^(\d{1,2})\s*(?:K|KT|KARAT)?$/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 24) return Math.round((n / 24) * 1000) / 1000;
  }
  // Truly unrecognised purity ("", "gold", …): refuse by valuing at 0 rather
  // than over-valuing at 22K. computeGoldValuation then yields assessedValue 0.
  return 0;
}

export type GoldValuationInput = {
  netWeightGrams: number;
  purityKarat: string;
  /** Market rate per gram of pure (24K) gold, from AppSetting. */
  ratePerGram: number;
  /** Eligible loan-to-value percent (e.g. 75), from AppSetting/per-loan. */
  ltvPercent: number;
};

export type GoldValuation = {
  /** Appraised value of the ornament's gold content. */
  assessedValue: number;
  /** Maximum sanctionable principal at the given LTV. */
  eligibleAmount: number;
  finenessUsed: number;
};

/** Compute assessed value + eligible loan amount. Never throws; clamps to >= 0. */
export function computeGoldValuation(input: GoldValuationInput): GoldValuation {
  const weight = Math.max(input.netWeightGrams || 0, 0);
  const rate = Math.max(input.ratePerGram || 0, 0);
  const ltv = Math.min(Math.max(input.ltvPercent || 0, 0), 100);
  const fineness = finenessFor(input.purityKarat);

  const assessedValue = Math.round(weight * rate * fineness);
  const eligibleAmount = Math.round((assessedValue * ltv) / 100);
  return { assessedValue, eligibleAmount, finenessUsed: fineness };
}

/** AppSetting keys for the tunable gold inputs. */
export const GOLD_RATE_KEY = (purityKarat: string) =>
  `gold_rate_per_gram_${purityKarat.trim().toLowerCase()}`;
export const GOLD_PURE_RATE_KEY = 'gold_rate_per_gram_24k';
export const GOLD_DEFAULT_LTV_KEY = 'gold_default_ltv_percent';
