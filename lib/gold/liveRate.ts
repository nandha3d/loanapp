import { getSetting } from '@/lib/tenant';
import { finenessFor, GOLD_PURE_RATE_KEY } from '@/lib/gold/valuation';

/**
 * Live gold-rate hook — pluggable provider, never hardcoded.
 *
 * Set in .env:
 *   GOLD_PRICE_API_URL   full URL that returns JSON with a 24K ₹/gram price
 *   GOLD_PRICE_API_KEY   sent as `x-access-token` header (goldapi.io style); optional
 *   GOLD_PRICE_JSON_PATH dot-path to the ₹/g 24K number in the response
 *                        (default "price_gram_24k", the goldapi.io field)
 *
 * Always falls back to the tenant's manual AppSetting rate (gold_rate_per_gram_24k)
 * when no provider is configured or the call fails — so pledges work with or
 * without a paid feed. Result is cached in-process for GOLD_PRICE_TTL_MS (1h default).
 */

type CacheEntry = { value: number; at: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = Number(process.env.GOLD_PRICE_TTL_MS) || 60 * 60 * 1000;

function pick(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => {
    if (acc && typeof acc === 'object' && k in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
}

/** Fetch the live 24K ₹/gram rate from the configured provider, or null. Cached. */
export async function fetchLive24kRate(): Promise<number | null> {
  const url = process.env.GOLD_PRICE_API_URL;
  if (!url) return null;

  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (process.env.GOLD_PRICE_API_KEY) headers['x-access-token'] = process.env.GOLD_PRICE_API_KEY;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return cached?.value ?? null;
    const json = await res.json();
    const path = process.env.GOLD_PRICE_JSON_PATH || 'price_gram_24k';
    const raw = pick(json, path);
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return cached?.value ?? null;
    cache.set(url, { value, at: Date.now() });
    return value;
  } catch {
    return cached?.value ?? null; // serve stale on error if we have it
  }
}

export type ResolvedRate = {
  ratePerGram: number | null;
  purityKarat: string;
  source: 'live' | 'manual' | 'none';
};

/**
 * Effective ₹/gram for a purity. Live 24K × karat fineness when a provider is
 * set; otherwise the tenant's manual AppSetting 24K rate × fineness.
 */
export async function resolveGoldRate(tenantId: string, purityKarat = '24K'): Promise<ResolvedRate> {
  const fineness = finenessFor(purityKarat);

  const live = await fetchLive24kRate();
  if (live != null) {
    return { ratePerGram: Math.round(live * fineness), purityKarat, source: 'live' };
  }

  const manual = Number(await getSetting(tenantId, GOLD_PURE_RATE_KEY, ''));
  if (Number.isFinite(manual) && manual > 0) {
    return { ratePerGram: Math.round(manual * fineness), purityKarat, source: 'manual' };
  }

  return { ratePerGram: null, purityKarat, source: 'none' };
}
