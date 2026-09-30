'use client';

import { useState } from 'react';
import Link from '@/components/layout/DashboardLink';
import { formatCurrency } from '@/lib/utils';

// Dashboard charts (web only). Every bar scales against the max of ALL plotted
// series, is clamped to 0–100% and sits in an overflow-hidden plot (UI-1).

const TOOLTIP: React.CSSProperties = {
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
};

const pct = (value: number, max: number) => (max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0);

function compactCurrency(amount: number, symbol: string) {
  const abs = Math.abs(amount);
  if (abs >= 1e7) return `${symbol}${(amount / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
  if (abs >= 1e5) return `${symbol}${(amount / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
  if (abs >= 1e3) return `${symbol}${(amount / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return formatCurrency(amount, symbol);
}

function EmptyChart({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="empty-state" style={{ padding: '32px 16px', textAlign: 'center' }}>
      <span className="material-icons-outlined" style={{ fontSize: '36px', color: 'var(--success)' }}>{icon}</span>
      <p style={{ marginTop: '8px', fontSize: '.85rem', color: 'var(--text-secondary)' }}>{text}</p>
    </div>
  );
}

// ── Overdue ageing ────────────────────────────────────────────────────────

export type AgeingBucketView = { from: number; to: number | null; amount: number; count: number };

// One hue, light → dark: older debt reads darker (sequential, not categorical).
const AGEING_RAMP = ['#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'];

export function OverdueAgeingChart({
  buckets,
  currencySymbol,
  labels,
}: {
  buckets: AgeingBucketView[];
  currencySymbol: string;
  labels: { days: string; instalments: string; empty: string };
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...buckets.map((b) => b.amount));
  if (max <= 0) return <EmptyChart icon="check_circle" text={labels.empty} />;

  const rangeLabel = (b: AgeingBucketView) => (b.to === null ? `${b.from}+` : `${b.from}–${b.to}`);
  const colorAt = (i: number) =>
    AGEING_RAMP[Math.min(AGEING_RAMP.length - 1, Math.round((i / Math.max(1, buckets.length - 1)) * (AGEING_RAMP.length - 1)))];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))`, gap: '10px', alignItems: 'end', height: '210px' }}>
        {buckets.map((b, i) => {
          const isHover = hover === i;
          return (
            <div
              key={rangeLabel(b)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'end', height: '100%', gap: '6px', position: 'relative', cursor: 'default' }}
            >
              {isHover && (
                <div style={TOOLTIP}>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>{rangeLabel(b)} {labels.days}</div>
                  <div>{formatCurrency(b.amount, currencySymbol)}</div>
                  <div style={{ opacity: 0.8 }}>{b.count} {labels.instalments}</div>
                </div>
              )}
              <div style={{ fontSize: '.7rem', fontWeight: 700, color: b.amount > 0 ? '#334155' : '#cbd5e1', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {b.amount > 0 ? compactCurrency(b.amount, currencySymbol) : '—'}
              </div>
              <div style={{ height: '150px', display: 'flex', alignItems: 'end', justifyContent: 'center', overflow: 'hidden' }}>
                <div
                  style={{
                    width: '70%',
                    maxWidth: '56px',
                    height: `${b.amount > 0 ? Math.max(3, pct(b.amount, max)) : 0}%`,
                    background: colorAt(i),
                    borderRadius: '4px 4px 0 0',
                    opacity: hover === null || isHover ? 1 : 0.45,
                    transition: 'opacity .15s ease',
                  }}
                />
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>{rangeLabel(b)}</div>
                <div style={{ fontSize: '.66rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {b.count} {labels.instalments}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: 'center', fontSize: '.7rem', color: '#94a3b8', marginTop: '6px' }}>{labels.days}</div>
    </div>
  );
}

// ── Top overdue customers ─────────────────────────────────────────────────

export type TopOverdueView = {
  customerId: string;
  name: string;
  customerCode: string;
  routeName: string | null;
  amount: number;
  count: number;
  maxDaysOverdue: number;
};

export function TopOverdueCustomers({
  rows,
  currencySymbol,
  labels,
}: {
  rows: TopOverdueView[];
  currencySymbol: string;
  labels: { instalments: string; oldest: string; days: string; empty: string };
}) {
  const max = Math.max(0, ...rows.map((r) => r.amount));
  if (rows.length === 0 || max <= 0) return <EmptyChart icon="check_circle" text={labels.empty} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {rows.map((r) => (
        <Link
          key={r.customerId}
          href={`/customers/${r.customerCode}`}
          style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
          title={`${r.name} — ${formatCurrency(r.amount, currencySymbol)}`}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', marginBottom: '5px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '.86rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
              <div style={{ fontSize: '.7rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {[r.customerCode, r.routeName, `${r.count} ${labels.instalments}`, `${labels.oldest} ${r.maxDaysOverdue} ${labels.days}`]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <div style={{ fontWeight: 800, fontSize: '.9rem', color: 'var(--danger)', whiteSpace: 'nowrap' }}>
              {formatCurrency(r.amount, currencySymbol)}
            </div>
          </div>
          <div style={{ height: '8px', background: '#fef2f2', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(2, pct(r.amount, max))}%`, height: '100%', background: '#dc2626', borderRadius: '4px' }} />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Disbursed vs collected (cash book) ────────────────────────────────────

export type CashFlowMonth = { label: string; disbursed: number; collected: number };

const DISBURSED_COLOR = '#3b82f6';
const COLLECTED_COLOR = '#059669';

export function CashFlowChart({
  months,
  currencySymbol,
  labels,
}: {
  months: CashFlowMonth[];
  currencySymbol: string;
  labels: { disbursed: string; collected: string; empty: string };
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...months.flatMap((m) => [m.disbursed, m.collected]));
  const totalDisbursed = months.reduce((s, m) => s + m.disbursed, 0);
  const totalCollected = months.reduce((s, m) => s + m.collected, 0);

  const legend = [
    { color: DISBURSED_COLOR, label: labels.disbursed, total: totalDisbursed },
    { color: COLLECTED_COLOR, label: labels.collected, total: totalCollected },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
        {legend.map((l) => (
          <div key={l.label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.68rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              <span style={{ width: 10, height: 10, background: l.color, borderRadius: 3 }} /> {l.label}
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(l.total, currencySymbol)}</div>
          </div>
        ))}
      </div>

      {max <= 0 ? (
        <EmptyChart icon="bar_chart" text={labels.empty} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`, gap: '12px', alignItems: 'end', height: '190px' }}>
          {months.map((m, i) => {
            const isHover = hover === i;
            return (
              <div
                key={m.label}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ display: 'flex', flexDirection: 'column', justifyContent: 'end', height: '100%', gap: '6px', position: 'relative' }}
              >
                {isHover && (
                  <div style={TOOLTIP}>
                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>{m.label}</div>
                    {legend.map((l, li) => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: li ? '2px' : 0 }}>
                        <span style={{ width: 8, height: 8, background: l.color, borderRadius: 2 }} />
                        {l.label}: {formatCurrency(li === 0 ? m.disbursed : m.collected, currencySymbol)}
                      </div>
                    ))}
                  </div>
                )}
                {/* 2px surface gap between the paired bars */}
                <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'center', gap: '2px', height: '160px', overflow: 'hidden' }}>
                  {[m.disbursed, m.collected].map((value, si) => (
                    <div
                      key={si}
                      style={{
                        width: '42%',
                        maxWidth: '28px',
                        height: `${value > 0 ? Math.max(2, pct(value, max)) : 0}%`,
                        background: si === 0 ? DISBURSED_COLOR : COLLECTED_COLOR,
                        borderRadius: '4px 4px 0 0',
                        opacity: hover === null || isHover ? 1 : 0.45,
                        transition: 'opacity .15s ease',
                      }}
                    />
                  ))}
                </div>
                <div style={{ fontSize: '.7rem', fontWeight: 700, textAlign: 'center', color: isHover ? '#1e293b' : 'var(--text-secondary)', borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                  {m.label}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Portfolio health donut ────────────────────────────────────────────────

export function PortfolioHealthDonut({
  onTrack,
  withOverdue,
  labels,
}: {
  onTrack: number;
  withOverdue: number;
  labels: { onTrack: string; withOverdue: string; loans: string; empty: string };
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = onTrack + withOverdue;
  if (total <= 0) return <EmptyChart icon="donut_large" text={labels.empty} />;

  const segments = [
    { label: labels.onTrack, value: onTrack, color: '#059669', icon: 'check_circle' },
    { label: labels.withOverdue, value: withOverdue, color: '#dc2626', icon: 'warning' },
  ];
  const size = 168;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const visible = segments.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? 2 : 0; // 2px surface gap between segments
  let offset = 0;
  const onTrackPct = Math.round((onTrack / total) * 100);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} role="img" aria-label={`${labels.onTrack} ${onTrackPct}%`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
          {segments.map((s, i) => {
            if (s.value <= 0) return null;
            const len = (s.value / total) * circumference;
            const dash = Math.max(0, len - gap);
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ opacity: hover === null || hover === i ? 1 : 0.45, transition: 'opacity .15s ease', cursor: 'default' }}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {hover === null ? (
            <>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{onTrackPct}%</div>
              <div style={{ fontSize: '.72rem', color: '#64748b', marginTop: '4px' }}>{labels.onTrack}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{segments[hover].value}</div>
              <div style={{ fontSize: '.72rem', color: '#64748b', marginTop: '4px' }}>{segments[hover].label}</div>
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '160px' }}>
        {segments.map((s, i) => (
          <div
            key={s.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', background: hover === i ? '#f8fafc' : 'transparent' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px', color: s.color }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: '.78rem', color: '#64748b', fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                {s.value} <span style={{ fontSize: '.74rem', color: '#94a3b8', fontWeight: 500 }}>{labels.loans} · {Math.round((s.value / total) * 100)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
