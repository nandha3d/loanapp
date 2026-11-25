import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { getMyChitMemberships } from '@/lib/chits/customerPortal';

type Memberships = Awaited<ReturnType<typeof getMyChitMemberships>>;

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '14px',
  border: '1px solid #e2e8f0',
  padding: '18px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

export default function ChitOnlyPanel({
  memberships,
  currencySymbol = '₹',
  dict,
}: {
  memberships: Memberships;
  currencySymbol?: string;
  dict?: any;
}) {
  const dc = dict?.chits || {};

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
          {dc.portalMyChits || 'My Chits'}
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
          {dc.portalMyChitsDesc || 'Your chit fund memberships, dividend earnings, contributions, and receipts.'}
        </p>
      </div>

      {memberships.length === 0 ? (
        <div style={cardStyle}>
          <p style={{ color: '#64748b', margin: 0 }}>{dc.portalNoMemberships || 'No active chit memberships found.'}</p>
        </div>
      ) : (
        memberships.map((m) => (
          <div key={m.memberId} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{m.group.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {m.group.groupCode ? `${m.group.groupCode} · ` : ''}Ticket {m.ticketNo ?? '—'}
                  {m.ticketShare !== 1 ? ` (${m.ticketShare} share)` : ''} · {m.engineName}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '999px',
                    background: m.isCompleted ? '#dbeafe' : '#f1f5f9',
                    color: m.isCompleted ? '#1e40af' : '#334155',
                  }}
                >
                  {m.isCompleted
                    ? dc.chitCompletedBadge || 'Chit Completed'
                    : `${m.completedPeriodsCount}/${m.totalPeriods} periods`}
                </div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '999px',
                    background: m.hasWon ? '#dcfce7' : '#e0f2fe',
                    color: m.hasWon ? '#166534' : '#075985',
                  }}
                >
                  {m.hasWon ? 'Prize won' : 'Active'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginTop: '14px' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{dc.chitValue || 'Chit value'}</div>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(m.group.chitValue, currencySymbol)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{dc.monthlyContribution || 'Contribution'}</div>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(m.group.monthlyContrib, currencySymbol)}</div>
              </div>
              <div style={{ background: '#f0fdf4', padding: '6px 8px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '0.72rem', color: '#166534' }}>{dc.totalDividendEarned || 'Total Dividend Earned'}</div>
                <div style={{ fontWeight: 700, color: '#15803d' }}>
                  {formatCurrency(m.totalDividendEarned, currencySymbol)} ({m.effectiveSavingsPct}%)
                </div>
              </div>
              {m.totalDeferredDividend > 0 && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{dc.deferredBonusPool || 'Deferred Bonus'}</div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(m.totalDeferredDividend, currencySymbol)}</div>
                </div>
              )}
              {m.goldTotalGrams > 0 && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{dc.goldGramsAccumulated || 'Gold Accumulated'}</div>
                  <div style={{ fontWeight: 600, color: '#b45309' }}>{m.goldTotalGrams.toFixed(4)} g</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{dc.paid || 'Total Paid'}</div>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(m.totalPaid, currencySymbol)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{dc.netFinancialOutcome || 'Net Benefit / Outcome'}</div>
                <div style={{ fontWeight: 700, color: m.netFinancialOutcome >= 0 ? '#15803d' : '#0f172a' }}>
                  {formatCurrency(m.netFinancialOutcome, currencySymbol)}
                </div>
              </div>
              {m.nextDue && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Next due ({formatDate(m.nextDue.dueDate)})</div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>
                    {formatCurrency(m.nextDue.outstanding, currencySymbol)}
                  </div>
                </div>
              )}
              {m.nextAuction && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Next auction</div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>
                    Period {m.nextAuction.periodNumber} · {formatDate(m.nextAuction.scheduledAt ?? m.nextAuction.auctionDate)}
                  </div>
                  {(m.group as any).auctionType === 'open_live' && (
                    <Link
                      href={`/borrower/chits/${m.group.id}/auctions/${m.nextAuction.id}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '6px',
                        padding: '5px 12px',
                        borderRadius: '999px',
                        background: '#7D287E',
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      Join Live Auction Table →
                    </Link>
                  )}
                </div>
              )}
              <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                <Link
                  href={`/borrower/chits/${m.group.id}/room`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '999px',
                    background: '#075e54',
                    color: '#fff',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  💬 Open Group Chat &amp; Live Room →
                </Link>
              </div>
            </div>
          </div>
        ))
      )}

      <Link
        href="/borrower/chits"
        style={{
          textAlign: 'center',
          padding: '12px',
          borderRadius: '10px',
          border: '1px solid #0f172a',
          background: '#0f172a',
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.88rem',
          textDecoration: 'none',
        }}
      >
        {dc.viewFullDividendStatement || 'View Detailed Chit, Dividend Statement & Receipts'}
      </Link>
    </div>
  );
}
