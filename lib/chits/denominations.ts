import { roundMoney } from './calculations';

export const STANDARD_CASH_DENOMINATIONS = [500, 200, 100, 50, 20, 10] as const;
export const INR_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

export type CashDenominationMode = 'DISABLED' | 'OPTIONAL' | 'REQUIRED';
export const CASH_DENOMINATION_MODE_SETTING = 'cash_denomination_mode';

export interface DenominationBreakdownPayload {
  currency: 'INR';
  counts: Record<string, number>;
  computedTotal: number;
}

export function normalizeCashDenominationMode(raw: unknown): CashDenominationMode {
  const upper = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (upper === 'DISABLED' || upper === 'REQUIRED' || upper === 'OPTIONAL') {
    return upper;
  }
  return 'OPTIONAL';
}

export async function getCashDenominationMode(db: any, tenantId: string): Promise<CashDenominationMode> {
  if (!tenantId) return 'OPTIONAL';
  const row = await db.appSetting?.findFirst?.({
    where: { tenantId, key: CASH_DENOMINATION_MODE_SETTING },
    select: { value: true },
  });
  return normalizeCashDenominationMode(row?.value);
}

/**
 * Legacy-compatible normalizer: extracts `{ denom: count }` map for positive entries.
 * Unwraps `{ currency, counts }` envelopes seamlessly.
 */
export function normalizeCashDenominations(
  raw: Record<string | number, unknown> | string | null | undefined,
): Record<number, number> | null {
  if (!raw) return null;
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') obj = parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof raw === 'object') {
    obj = raw as Record<string, unknown>;
  }
  if (!obj) return null;

  const source =
    obj.counts && typeof obj.counts === 'object'
      ? (obj.counts as Record<string, unknown>)
      : obj;

  const clean: Record<number, number> = {};
  let hasPositive = false;
  for (const [k, v] of Object.entries(source)) {
    const denom = Math.floor(Number(k));
    const count = Math.floor(Number(v));
    if (Number.isFinite(denom) && denom > 0 && Number.isFinite(count) && count > 0) {
      clean[denom] = count;
      hasPositive = true;
    }
  }
  return hasPositive ? clean : null;
}

export function buildDenominationBreakdown(
  countsInput: Record<string | number, unknown> | null | undefined,
): DenominationBreakdownPayload {
  const counts: Record<string, number> = {};
  for (const denom of INR_DENOMINATIONS) {
    counts[String(denom)] = 0;
  }
  if (countsInput && typeof countsInput === 'object') {
    for (const [k, v] of Object.entries(countsInput)) {
      const denom = Number(k);
      if (!INR_DENOMINATIONS.includes(denom as (typeof INR_DENOMINATIONS)[number])) {
        throw new Error(`Unsupported denomination: ${k}`);
      }
      const num = Number(v ?? 0);
      if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
        throw new Error(`Invalid count for ₹${denom} denomination: must be a non-negative integer`);
      }
      counts[String(denom)] = num;
    }
  }
  let computedTotal = 0;
  for (const denom of INR_DENOMINATIONS) {
    computedTotal = roundMoney(computedTotal + denom * (counts[String(denom)] ?? 0));
  }
  return { currency: 'INR', counts, computedTotal };
}

/**
 * Validates denomination counts strictly on the server:
 * - Rejects negative, fractional, or NaN counts
 * - Recomputes `sum(denomination * count)` server-side (never trusts client computedTotal)
 * - In REQUIRED mode: requires valid breakdown summing strictly to expectedAmount
 * - In OPTIONAL mode: if breakdown is provided & non-empty, verifies sum === expectedAmount
 */
export function validateDenominationBreakdown(
  rawBreakdown: unknown,
  expectedAmount: number,
  mode: CashDenominationMode = 'OPTIONAL',
): {
  valid: true;
  breakdown: DenominationBreakdownPayload | null;
  recomputedTotal: number;
} {
  if (mode === 'DISABLED') {
    return { valid: true, breakdown: null, recomputedTotal: 0 };
  }

  let parsed: unknown = rawBreakdown;
  if (typeof rawBreakdown === 'string') {
    const trimmed = rawBreakdown.trim();
    if (!trimmed) {
      parsed = null;
    } else {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        throw new Error('Invalid cash denomination JSON payload');
      }
    }
  }

  const expected = roundMoney(Number(expectedAmount) || 0);

  if (!parsed || typeof parsed !== 'object') {
    if (mode === 'REQUIRED' && expected > 0) {
      throw new Error(`Cash denomination breakdown totalling ${expected} is required`);
    }
    return { valid: true, breakdown: null, recomputedTotal: 0 };
  }

  const obj = parsed as Record<string, unknown>;
  const rawCounts =
    obj.counts && typeof obj.counts === 'object'
      ? (obj.counts as Record<string, unknown>)
      : Object.fromEntries(
          Object.entries(obj).filter(([k]) => k !== 'currency' && k !== 'computedTotal'),
        );

  const built = buildDenominationBreakdown(rawCounts);
  const totalNotes = Object.values(built.counts).reduce((s, c) => s + c, 0);

  if (totalNotes === 0) {
    if (mode === 'REQUIRED' && expected > 0) {
      throw new Error(`Cash denomination breakdown totalling ${expected} is required`);
    }
    return { valid: true, breakdown: null, recomputedTotal: 0 };
  }

  if (Math.abs(built.computedTotal - expected) > 0.01) {
    throw new Error(
      `Cash denomination total (${built.computedTotal}) must equal transaction amount (${expected})`,
    );
  }

  return {
    valid: true,
    breakdown: built,
    recomputedTotal: built.computedTotal,
  };
}

export function sumCashDenominations(denoms: Record<number, number> | null | undefined): number {
  if (!denoms) return 0;
  let total = 0;
  for (const [k, v] of Object.entries(denoms)) {
    const d = Number(k);
    const c = Number(v);
    if (Number.isFinite(d) && d > 0 && Number.isFinite(c) && c > 0) {
      total = roundMoney(total + d * c);
    }
  }
  return total;
}

export function formatCashDenominationsSummary(
  denoms: Record<number, number> | null | undefined,
  sym = 'Rs.',
): string | null {
  if (!denoms) return null;
  const parts = Object.entries(denoms)
    .map(([k, v]) => [Number(k), Number(v)] as const)
    .filter(([d, c]) => d > 0 && c > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([d, c]) => `${sym}${d}x${c}`);
  return parts.length > 0 ? parts.join(', ') : null;
}
