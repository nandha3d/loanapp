'use client';

/**
 * Collapsible loan event timeline + RBI NPA risk badge.
 * Reads GET /api/v1/loans/[id]/timeline (web session via dualAuth).
 * Purely additive — renders below the existing loan detail content.
 */

import { useEffect, useState } from 'react';

type TimelineEvent = {
  at: string;
  type: string;
  title: string;
  amount?: number;
  meta?: Record<string, string | number | null>;
};

type TimelineData = {
  npa: { status: string | null; subCategory: string | null; daysOverdue: number };
  events: TimelineEvent[];
};

const TYPE_ICON: Record<string, string> = {
  disbursed: '💸',
  collection: '✅',
  penalty: '⚠️',
  penalty_settled: '🤝',
  nach_debit: '🏦',
  npa_change: '🚩',
  closed: '🔒',
};

export function NpaBadge({ status, subCategory, daysOverdue }: {
  status: string | null; subCategory: string | null; daysOverdue: number;
}) {
  if (!status || status === 'standard') {
    if (daysOverdue > 0) {
      // SMA buckets before NPA: 0-30 SMA-0, 31-60 SMA-1, 61-90 SMA-2
      const sma = daysOverdue <= 30 ? 'SMA-0' : daysOverdue <= 60 ? 'SMA-1' : 'SMA-2';
      return (
        <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '.72rem', fontWeight: 700, background: 'rgba(245,158,11,.12)', color: '#d97706' }}>
          {sma} · {daysOverdue} DPD
        </span>
      );
    }
    return (
      <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '.72rem', fontWeight: 700, background: 'rgba(34,197,94,.12)', color: '#16a34a' }}>
        Standard
      </span>
    );
  }
  const label = subCategory ? `${status} · ${subCategory}` : status;
  return (
    <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '.72rem', fontWeight: 700, background: 'rgba(239,68,68,.12)', color: '#dc2626', textTransform: 'capitalize' }}>
      NPA: {label} · {daysOverdue} DPD
    </span>
  );
}

function gpsBadge(meta?: Record<string, string | number | null>) {
  const status = meta?.locationStatus;
  if (!status || status === 'not_captured') return null;
  const map: Record<string, { label: string; color: string }> = {
    verified:      { label: '📍 verified', color: '#16a34a' },
    mismatch:      { label: '📍 mismatch', color: '#dc2626' },
    mock_location: { label: '📍 FAKE GPS', color: '#dc2626' },
    unverifiable:  { label: '📍 unverified', color: '#9ca3af' },
  };
  const item = map[String(status)];
  if (!item) return null;
  return (
    <span style={{ fontSize: '.7rem', fontWeight: 700, color: item.color, marginLeft: '8px' }}>
      {item.label}{meta?.distanceM != null ? ` (${meta.distanceM} m)` : ''}
    </span>
  );
}

export default function LoanTimeline({ loanId, currencySymbol }: { loanId: string; currencySymbol: string }) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/loans/${loanId}/timeline`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => { if (!cancelled) setData(json?.data ?? null); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [loanId]);

  if (failed || !data) return null;

  const events = [...data.events].reverse(); // newest first

  return (
    <div className="card">
      <div
        className="card-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setOpen((v) => !v)}
      >
        <h3>🕒 Loan Timeline ({events.length} events)</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <NpaBadge {...data.npa} />
          <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--text-light)' }}>
            {open ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </div>

      {open && (
        <div style={{ padding: '4px 18px 16px' }}>
          <div style={{ display: 'grid', gap: 0 }}>
            {events.map((e, i) => (
              <div key={`${e.at}-${i}`} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '16px', lineHeight: '28px' }}>{TYPE_ICON[e.type] ?? '•'}</span>
                  {i < events.length - 1 && (
                    <span style={{ width: '2px', flex: 1, minHeight: '14px', background: 'var(--border)' }} />
                  )}
                </div>
                <div style={{ paddingBottom: '12px', fontSize: '.83rem' }}>
                  <div>
                    <strong>{e.title}</strong>
                    {e.amount != null && (
                      <span style={{ marginLeft: '8px', fontWeight: 700, color: e.type === 'collection' ? 'var(--success)' : 'inherit' }}>
                        {currencySymbol}{Number(e.amount).toLocaleString('en-IN')}
                      </span>
                    )}
                    {gpsBadge(e.meta)}
                  </div>
                  <div style={{ color: 'var(--text-light)', fontSize: '.74rem' }}>
                    {new Date(e.at).toLocaleString()}
                    {e.meta?.paymentMode ? ` · ${e.meta.paymentMode}` : ''}
                    {e.meta?.failureReason ? ` · ${e.meta.failureReason}` : ''}
                  </div>
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <p style={{ color: 'var(--text-light)', fontSize: '.8rem' }}>No events yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
