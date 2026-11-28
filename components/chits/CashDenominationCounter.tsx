'use client';

import React, { useMemo } from 'react';
import {
  INR_DENOMINATIONS,
  type CashDenominationMode,
} from '@/lib/chits/denominations';
import { formatCurrency } from '@/lib/utils';

export interface CashDenominationCounterProps {
  expectedAmount: number;
  mode: CashDenominationMode;
  value: Record<number, number>;
  onChange: (
    nextCounts: Record<number, number>,
    meta: {
      computedTotal: number;
      difference: number;
      isMatch: boolean;
      json: string | null;
    },
  ) => void;
  currencySymbol?: string;
  compact?: boolean;
  disabled?: boolean;
  title?: string;
}

function sanitizeCount(raw: number): number {
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return Math.floor(raw);
}

function buildMeta(counts: Record<number, number>, expectedAmount: number) {
  let computedTotal = 0;
  const sparse: Record<number, number> = {};
  for (const denom of INR_DENOMINATIONS) {
    const qty = sanitizeCount(counts[denom] ?? 0);
    if (qty > 0) {
      sparse[denom] = qty;
      computedTotal += denom * qty;
    }
  }
  const roundedExpected = Math.round(expectedAmount * 100) / 100;
  const difference = Math.round((computedTotal - roundedExpected) * 100) / 100;
  const isMatch = Math.abs(difference) < 0.01;
  const json =
    Object.keys(sparse).length > 0
      ? JSON.stringify({
          currency: 'INR',
          counts: Object.fromEntries(Object.entries(sparse).map(([k, v]) => [String(k), v])),
          computedTotal,
        })
      : null;
  return { sparse, computedTotal, difference, isMatch, json };
}

export function greedyFillDenominations(targetAmount: number): Record<number, number> {
  let remaining = Math.max(0, Math.round(targetAmount));
  const next: Record<number, number> = {};
  for (const denom of INR_DENOMINATIONS) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / denom);
    if (count > 0) {
      next[denom] = count;
      remaining -= count * denom;
    }
  }
  return next;
}

export default function CashDenominationCounter({
  expectedAmount,
  mode,
  value,
  onChange,
  currencySymbol = '₹',
  compact = false,
  disabled = false,
  title = 'Cash Note & Coin Denomination Counter',
}: CashDenominationCounterProps) {
  const { computedTotal, difference, isMatch } = useMemo(
    () => buildMeta(value, expectedAmount),
    [value, expectedAmount],
  );

  if (mode === 'DISABLED') {
    return null;
  }

  const updateCount = (denom: number, nextQty: number) => {
    const next: Record<number, number> = { ...value, [denom]: sanitizeCount(nextQty) };
    const meta = buildMeta(next, expectedAmount);
    onChange(meta.sparse, {
      computedTotal: meta.computedTotal,
      difference: meta.difference,
      isMatch: meta.isMatch,
      json: meta.json,
    });
  };

  const applyMap = (next: Record<number, number>) => {
    const meta = buildMeta(next, expectedAmount);
    onChange(meta.sparse, {
      computedTotal: meta.computedTotal,
      difference: meta.difference,
      isMatch: meta.isMatch,
      json: meta.json,
    });
  };

  const hasAny = computedTotal > 0;
  const mustMatch = mode === 'REQUIRED' || hasAny;
  const statusBg = isMatch
    ? 'rgba(16, 185, 129, 0.12)'
    : mustMatch
      ? 'rgba(239, 68, 68, 0.12)'
      : 'rgba(100, 116, 139, 0.12)';
  const statusColor = isMatch ? '#047857' : mustMatch ? '#b91c1c' : '#475569';

  return (
    <div
      data-testid="cash-denomination-counter"
      style={{
        background: 'linear-gradient(135deg, rgba(var(--primary-rgb, 125,40,126), 0.04), var(--bg))',
        border: `1px solid ${!isMatch && mode === 'REQUIRED' ? '#fca5a5' : 'var(--border)'}`,
        borderRadius: '12px',
        padding: compact ? '10px 12px' : '14px 16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text)' }}>
            💵 {title}
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '999px',
              background: mode === 'REQUIRED' ? 'var(--primary-light, #f3e8ff)' : 'var(--surface)',
              color: mode === 'REQUIRED' ? 'var(--primary-dark, #5a195b)' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {mode === 'REQUIRED' ? 'Required to match' : 'Optional tally'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={disabled || expectedAmount <= 0}
            onClick={() => applyMap(greedyFillDenominations(expectedAmount))}
            style={{ fontSize: '0.73rem', padding: '3px 8px' }}
          >
            Auto-fill notes
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={disabled || !hasAny}
            onClick={() => applyMap({})}
            style={{ fontSize: '0.73rem', padding: '3px 8px' }}
          >
            Clear
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact
            ? 'repeat(auto-fill, minmax(126px, 1fr))'
            : 'repeat(auto-fill, minmax(145px, 1fr))',
          gap: '8px',
        }}
      >
        {INR_DENOMINATIONS.map((denom) => {
          const count = sanitizeCount(value[denom] ?? 0);
          const lineTotal = denom * count;
          return (
            <div
              key={denom}
              style={{
                background: count > 0 ? 'var(--surface)' : 'var(--bg)',
                border: `1px solid ${count > 0 ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: '9px',
                padding: '7px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text)' }}>
                  {currencySymbol}{denom}
                </span>
                <span style={{ fontSize: '0.71rem', color: count > 0 ? 'var(--primary-dark, var(--primary))' : 'var(--text-light)', fontWeight: 600 }}>
                  {formatCurrency(lineTotal, currencySymbol)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  aria-label={`Decrease ${currencySymbol}${denom} count`}
                  disabled={disabled || count <= 0}
                  onClick={() => updateCount(denom, count - 1)}
                  style={{
                    width: '26px',
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    cursor: disabled || count <= 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                  }}
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  aria-label={`${currencySymbol}${denom} count`}
                  disabled={disabled}
                  value={count}
                  onChange={(e) => updateCount(denom, Number(e.target.value))}
                  className="form-control"
                  style={{
                    textAlign: 'center',
                    padding: '3px 4px',
                    height: '28px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    minWidth: 0,
                    flex: 1,
                  }}
                />
                <button
                  type="button"
                  aria-label={`Increase ${currencySymbol}${denom} count`}
                  disabled={disabled}
                  onClick={() => updateCount(denom, count + 1)}
                  style={{
                    width: '26px',
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                  }}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: '10px',
          paddingTop: '8px',
          borderTop: '1px dashed var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Counted: <strong style={{ color: 'var(--text)' }}>{formatCurrency(computedTotal, currencySymbol)}</strong>
          {' · '}Expected: <strong style={{ color: 'var(--text)' }}>{formatCurrency(expectedAmount, currencySymbol)}</strong>
        </div>
        <span
          data-testid="denomination-diff-badge"
          style={{
            fontSize: '0.76rem',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: '999px',
            background: statusBg,
            color: statusColor,
          }}
        >
          {isMatch
            ? '✓ Exact Match'
            : difference > 0
              ? `Excess +${formatCurrency(difference, currencySymbol)}`
              : `Short ${formatCurrency(Math.abs(difference), currencySymbol)}`}
        </span>
      </div>
    </div>
  );
}
