import { roundMoney } from './calculations';

export const STANDARD_CASH_DENOMINATIONS = [500, 200, 100, 50, 20, 10] as const;

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

  const clean: Record<number, number> = {};
  let hasPositive = false;
  for (const [k, v] of Object.entries(obj)) {
    const denom = Math.floor(Number(k));
    const count = Math.floor(Number(v));
    if (Number.isFinite(denom) && denom > 0 && Number.isFinite(count) && count > 0) {
      clean[denom] = count;
      hasPositive = true;
    }
  }
  return hasPositive ? clean : null;
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
