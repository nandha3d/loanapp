'use client';

// Gold pledge reports — summary KPIs, pending interests, ornaments by type.
// Data comes from /api/v1/gold/reports (server-fetched in the page). No money
// math here — it's all computed server-side via lib/gold.

export default function GoldReportsPanel({
  summary,
  pending,
  ornaments,
  currencySymbol = '₹',
}: {
  summary?: any;
  pending?: any;
  ornaments?: any;
  currencySymbol?: string;
}) {
  const fmt = (n: any) => `${currencySymbol}${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
  const wt = (n: any) => `${(Number(n) || 0).toLocaleString('en-IN')} g`;
  const pendingRows: any[] = pending?.rows ?? [];
  const ornamentRows: any[] = ornaments?.rows ?? [];

  const card = (label: string, value: string) => (
    <div className="card" style={{ flex: '1 1 160px', padding: '14px 16px' }}>
      <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{value}</div>
    </div>
  );

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 12px' }}>🏅 Gold Pledge Reports</h3>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        {card('Active pledges', String(summary?.activePledges ?? 0))}
        {card('Total loan', fmt(summary?.totalLoanAmount))}
        {card('Pending interest', fmt(summary?.totalPendingInterest))}
        {card('Store rate / g', summary?.storeRatePerGram != null ? fmt(summary.storeRatePerGram) : '—')}
        {card('Active net wt', wt(summary?.activeOrnamentWeight?.net))}
        {card('Closed net wt', wt(summary?.closedOrnamentWeight?.net))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h4 style={{ margin: 0 }}>Pending Interests ({pendingRows.length})</h4>
          <span style={{ fontWeight: 700 }}>{fmt(pending?.totalPendingInterest)}</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead><tr><th>Loan</th><th>Customer</th><th>Outstanding</th><th>Months</th><th>Interest Due</th><th>Redemption</th></tr></thead>
            <tbody>
              {pendingRows.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 14 }}>No active pledges</td></tr>
              ) : pendingRows.map((r) => (
                <tr key={r.loanId}>
                  <td>{r.loanCode}</td>
                  <td>{r.customer}<div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{r.phone}</div></td>
                  <td>{fmt(r.outstandingPrincipal)}</td>
                  <td>{r.monthsDue}</td>
                  <td>{fmt(r.interestDue)}</td>
                  <td>{fmt(r.redemptionAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h4 style={{ margin: 0 }}>Ornaments by Type</h4></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead><tr><th>Type</th><th>Qty</th><th>Gross</th><th>Wastage</th><th>Net</th><th>Value</th></tr></thead>
            <tbody>
              {ornamentRows.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 14 }}>No ornaments</td></tr>
              ) : ornamentRows.map((r) => (
                <tr key={r.ornamentType}>
                  <td>{r.ornamentType}</td>
                  <td>{r.quantity}</td>
                  <td>{wt(r.grossWeight)}</td>
                  <td>{wt(r.wastage)}</td>
                  <td>{wt(r.netWeight)}</td>
                  <td>{fmt(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
