'use client';

import { useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/utils';

type TrendPoint = { label: string; expected: number; collected: number };

const RANGES = [
  { key: 7, label: '7D' },
  { key: 14, label: '14D' },
  { key: 30, label: '30D' },
] as const;

export default function CollectionTrendChart({
  data,
  currencySymbol,
}: {
  data: TrendPoint[];
  currencySymbol: string;
}) {
  const [range, setRange] = useState<number>(7);
  const [hover, setHover] = useState<number | null>(null);

  const view = useMemo(() => data.slice(-range), [data, range]);

  const { max, totalExpected, totalCollected } = useMemo(() => {
    const max = Math.max(1, ...view.flatMap((d) => [d.expected, d.collected]));
    const totalExpected = view.reduce((s, d) => s + d.expected, 0);
    const totalCollected = view.reduce((s, d) => s + d.collected, 0);
    return { max, totalExpected, totalCollected };
  }, [view]);

  const rate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
  // Thinner bars / fewer labels when the range is wide so 30 days stays readable.
  const compact = view.length > 10;

  return (
    <div>
      {/* Header: title + range pills */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '4px' }}>
        <div style={{ display: 'flex', gap: '16px', fontSize: '.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 10, height: 10, background: '#DBEAFE', borderRadius: 3 }} /> Expected
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 10, height: 10, background: 'var(--primary)', borderRadius: 3 }} /> Collected
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '10px' }}>
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '5px 14px',
                borderRadius: '8px',
                fontSize: '.78rem',
                fontWeight: 700,
                transition: 'all .15s ease',
                background: range === r.key ? '#fff' : 'transparent',
                color: range === r.key ? 'var(--primary)' : '#64748b',
                boxShadow: range === r.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
        <div>
          <div style={{ fontSize: '.68rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Expected</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(totalExpected, currencySymbol)}</div>
        </div>
        <div>
          <div style={{ fontSize: '.68rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Collected</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(totalCollected, currencySymbol)}</div>
        </div>
        <div>
          <div style={{ fontSize: '.68rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Rate</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: rate >= 80 ? '#16a34a' : rate >= 50 ? '#d97706' : '#dc2626' }}>{rate}%</div>
        </div>
      </div>

      {/* Bars */}
      <div style={{ position: 'relative', height: '200px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${view.length}, 1fr)`, gap: compact ? '3px' : '10px', alignItems: 'end', height: '170px' }}>
          {view.map((item, i) => {
            const isHover = hover === i;
            return (
              <div
                key={`${item.label}-${i}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ display: 'flex', flexDirection: 'column', justifyContent: 'end', height: '100%', gap: '6px', cursor: 'pointer', position: 'relative' }}
              >
                {/* Tooltip */}
                {isHover && (
                  <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 6px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#1e293b',
                    color: '#fff',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '.72rem',
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    pointerEvents: 'none',
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>{item.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 8, height: 8, background: '#93c5fd', borderRadius: 2 }} /> Expected: {formatCurrency(item.expected, currencySymbol)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span style={{ width: 8, height: 8, background: 'var(--primary)', borderRadius: 2 }} /> Collected: {formatCurrency(item.collected, currencySymbol)}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'end', gap: compact ? '2px' : '4px', height: '150px', justifyContent: 'center' }}>
                  <div style={{
                    width: '50%',
                    height: `${Math.max(4, (item.expected / max) * 100)}%`,
                    borderRadius: '4px 4px 2px 2px',
                    background: '#DBEAFE',
                    opacity: hover === null || isHover ? 1 : 0.45,
                    transition: 'opacity .15s ease',
                  }} />
                  <div style={{
                    width: '50%',
                    height: `${Math.max(4, (item.collected / max) * 100)}%`,
                    borderRadius: '4px 4px 2px 2px',
                    background: 'linear-gradient(180deg, var(--primary) 0%, #d97706 100%)',
                    opacity: hover === null || isHover ? 1 : 0.45,
                    transition: 'opacity .15s ease',
                  }} />
                </div>
                {/* X label — hide some when compact to avoid clutter */}
                <div style={{
                  fontSize: '.66rem',
                  color: isHover ? 'var(--primary)' : 'var(--text-secondary)',
                  textAlign: 'center',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  visibility: compact && i % 3 !== 0 && !isHover ? 'hidden' : 'visible',
                }}>
                  {compact ? item.label.split(' ')[0] : item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
