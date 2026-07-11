import { redirect } from 'next/navigation';
import { getBorrowerSession } from '@/lib/borrowerAuth';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getMyChitContributions, getMyChitReceipts } from '@/lib/chits/customerPortal';

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '14px',
  border: '1px solid #e2e8f0',
  padding: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

export default async function BorrowerChitsPage() {
  const session = await getBorrowerSession();
  if (!session) redirect('/borrower/login');

  const [contributions, receipts] = await Promise.all([
    getMyChitContributions(session.customerId, session.tenantId),
    getMyChitReceipts(session.customerId, session.tenantId),
  ]);

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Contributions & Receipts</h1>

      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>Contributions</h2>
        {contributions.length === 0 ? (
          <div style={cardStyle}><p style={{ color: '#64748b', margin: 0 }}>No contributions yet.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {contributions.map((c) => (
              <div key={c.subscriptionId} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.groupName} · Period {c.periodNumber}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Due {formatDate(c.dueDate)}</div>
                  </div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '999px',
                      alignSelf: 'flex-start',
                      background: c.status === 'paid' ? '#dcfce7' : c.status === 'missed' ? '#fee2e2' : '#fef9c3',
                      color: c.status === 'paid' ? '#166534' : c.status === 'missed' ? '#991b1b' : '#854d0e',
                    }}
                  >
                    {c.status}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginTop: '10px', fontSize: '0.82rem' }}>
                  <div><span style={{ color: '#94a3b8' }}>Base: </span>{formatCurrency(c.baseDueAmount)}</div>
                  <div><span style={{ color: '#94a3b8' }}>Dividend: </span>{formatCurrency(c.dividendAmount)}</div>
                  <div><span style={{ color: '#94a3b8' }}>Penalty: </span>{formatCurrency(c.penaltyAmount)}</div>
                  <div><span style={{ color: '#94a3b8' }}>Paid: </span>{formatCurrency(c.paidAmount)}</div>
                  <div style={{ fontWeight: 700 }}><span style={{ color: '#94a3b8', fontWeight: 400 }}>Outstanding: </span>{formatCurrency(c.outstanding)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>Receipts</h2>
        {receipts.length === 0 ? (
          <div style={cardStyle}><p style={{ color: '#64748b', margin: 0 }}>No receipts yet.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {receipts.map((r) => (
              <div key={r.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.receiptNo}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {r.receiptType} · {r.paymentMode} · {formatDate(r.issuedAt)}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{formatCurrency(r.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
