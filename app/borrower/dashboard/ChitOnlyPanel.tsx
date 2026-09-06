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

export default function ChitOnlyPanel({ memberships }: { memberships: Memberships }) {
  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>My Chits</h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
          Your chit fund memberships, contributions, and receipts.
        </p>
      </div>

      {memberships.length === 0 ? (
        <div style={cardStyle}>
          <p style={{ color: '#64748b', margin: 0 }}>No active chit memberships found.</p>
        </div>
      ) : (
        memberships.map((m) => (
          <div key={m.memberId} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{m.group.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {m.group.groupCode ? `${m.group.groupCode} · ` : ''}Ticket {m.ticketNo ?? '—'}
                </div>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginTop: '14px' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Chit value</div>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(m.group.chitValue)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Monthly contribution</div>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(m.group.monthlyContrib)}</div>
              </div>
              {m.nextDue && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Next due ({formatDate(m.nextDue.dueDate)})</div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>
                    {formatCurrency(m.nextDue.dueAmount - m.nextDue.paidAmount)}
                  </div>
                </div>
              )}
              {m.nextAuction && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Next auction</div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>
                    Period {m.nextAuction.periodNumber} · {formatDate(m.nextAuction.scheduledAt ?? m.nextAuction.auctionDate)}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))
      )}

      <Link
        href="/borrower/chits"
        style={{
          textAlign: 'center',
          padding: '10px',
          borderRadius: '10px',
          border: '1px solid #cbd5e1',
          color: '#334155',
          fontWeight: 600,
          fontSize: '0.85rem',
          textDecoration: 'none',
        }}
      >
        View contributions & receipts
      </Link>
    </div>
  );
}
