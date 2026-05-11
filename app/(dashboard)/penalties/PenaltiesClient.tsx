'use client';

import { useState } from 'react';
import { formatCurrency, getBadgeClass } from '@/lib/utils';
import { settlePenalty, waivePenalty, enforcePenalty } from './actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PenaltiesClient({
  penalties,
  kpis,
  routes,
  currencySymbol,
  filters,
}: {
  penalties: any[];
  kpis: { totalGross: number; totalSettled: number; totalWaived: number; count: number };
  routes: any[];
  currencySymbol: string;
  filters: { q: string; status: string; routeId: string };
}) {
  const router = useRouter();
  const [modal, setModal] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'enforce' | 'settle' | 'waive'>('enforce');
  const [settleAmount, setSettleAmount] = useState(0);
  const [notes, setNotes] = useState('');

  const netOutstanding = kpis.totalGross - kpis.totalSettled - kpis.totalWaived;

  const openModal = (penalty: any) => {
    setAction('enforce');
    const net = Number(penalty.grossPenalty) - Number(penalty.settledAmount) - Number(penalty.waivedAmount);
    setSettleAmount(net);
    setNotes('');
    setModal(penalty);
  };

  const handleConfirm = async () => {
    if (!modal) return;
    setLoading(true);
    const fd = new FormData();
    fd.set('penaltyId', modal.id);
    fd.set('notes', notes);

    let result;
    if (action === 'settle') {
      fd.set('settledAmount', String(settleAmount));
      result = await settlePenalty(fd);
    } else if (action === 'waive') {
      result = await waivePenalty(fd);
    } else {
      result = await enforcePenalty(fd);
    }

    setLoading(false);
    if (result.success) {
      setModal(null);
      router.refresh();
    } else {
      alert(result.error || 'Action failed');
    }
  };

  return (
    <>
      {/* KPI Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '20px' }}>
        <div className="kpi-card">
          <div className="kpi-icon red"><span className="material-icons-outlined">gavel</span></div>
          <div><div className="kpi-value" style={{ color: 'var(--danger)' }}>{formatCurrency(kpis.totalGross, currencySymbol)}</div><div className="kpi-label">Total Gross Penalty</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon green"><span className="material-icons-outlined">check_circle</span></div>
          <div><div className="kpi-value" style={{ color: 'var(--success)' }}>{formatCurrency(kpis.totalSettled, currencySymbol)}</div><div className="kpi-label">Total Settled</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon purple"><span className="material-icons-outlined">money_off</span></div>
          <div><div className="kpi-value" style={{ color: '#8B5CF6' }}>{formatCurrency(kpis.totalWaived, currencySymbol)}</div><div className="kpi-label">Total Waived</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange"><span className="material-icons-outlined">account_balance_wallet</span></div>
          <div><div className="kpi-value" style={{ color: 'var(--primary-dark)' }}>{formatCurrency(netOutstanding, currencySymbol)}</div><div className="kpi-label">Net Outstanding</div></div>
        </div>
      </div>

      {/* Main Card */}
      <div className="card">
        <div className="card-header">
          <h3>⚖️ Penalty Overview</h3>
          <span className="badge badge-pending">{kpis.count} Total</span>
        </div>

        <form className="filter-bar" method="GET">
          <div className="search-input">
            <span className="material-icons-outlined">search</span>
            <input type="text" name="q" className="form-control" placeholder="Search loan ID or customer..." defaultValue={filters.q} />
          </div>
          <select name="status" className="form-control" style={{ width: 'auto' }} defaultValue={filters.status}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="settled">Settled</option>
            <option value="waived">Waived</option>
            <option value="partial">Partial</option>
          </select>
          <select name="routeId" className="form-control" style={{ width: 'auto' }} defaultValue={filters.routeId}>
            <option value="">All Routes</option>
            {routes.map((r: any) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary">Filter</button>
          {(filters.q || filters.status || filters.routeId) && (
            <Link href="/penalties" className="btn btn-ghost">Clear</Link>
          )}
        </form>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Loan ID</th>
                <th>Customer</th>
                <th>Route</th>
                <th>Missed Days</th>
                <th>Gross Penalty</th>
                <th>Settled</th>
                <th>Waived</th>
                <th>Net Outstanding</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {penalties.map((p: any) => {
                const net = Number(p.grossPenalty) - Number(p.settledAmount) - Number(p.waivedAmount);
                return (
                  <tr key={p.id}>
                    <td><Link href={`/loans/${p.loan.id}`}><strong>{p.loan.loanCode}</strong></Link></td>
                    <td>
                      <Link href={`/customers/${p.customer.id}`}>{p.customer.name}</Link>
                      <br /><span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{p.customer.customerCode}</span>
                    </td>
                    <td>{p.customer.route?.name || '—'}</td>
                    <td><span className="badge badge-missed">{p.missedDays} days</span></td>
                    <td style={{ fontWeight: 600, color: 'var(--danger)' }}>{formatCurrency(p.grossPenalty, currencySymbol)}</td>
                    <td style={{ color: 'var(--success)' }}>{formatCurrency(p.settledAmount, currencySymbol)}</td>
                    <td style={{ color: '#8B5CF6' }}>{formatCurrency(p.waivedAmount, currencySymbol)}</td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(net, currencySymbol)}</td>
                    <td><span className={getBadgeClass(p.status)} style={{ textTransform: 'capitalize' }}>{p.status}</span></td>
                    <td>
                      {p.status === 'pending' || p.status === 'partial' ? (
                        <button className="btn btn-ghost btn-sm" onClick={() => openModal(p)}>Action</button>
                      ) : (
                        <span style={{ color: 'var(--text-light)', fontSize: '.8rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {penalties.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-light)' }}>
                    No penalties found. 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Penalty Action Modal */}
      {modal && (
        <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>⚖️ Penalty Action</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setModal(null)}>close</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px' }}>
                <p style={{ fontSize: '.85rem' }}><strong>{modal.customer.name}</strong> — {modal.loan.loanCode}</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)', marginTop: '6px' }}>
                  Gross Penalty: {formatCurrency(modal.grossPenalty, currencySymbol)}
                </p>
                <p style={{ fontSize: '.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {modal.missedDays} missed days · Already settled: {formatCurrency(modal.settledAmount, currencySymbol)}
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Action *</label>
                <select className="form-control" value={action} onChange={(e) => setAction(e.target.value as any)}>
                  <option value="enforce">Enforce Full Penalty</option>
                  <option value="settle">Partial Settlement</option>
                  <option value="waive">Waive Entirely</option>
                </select>
              </div>
              {action === 'settle' && (
                <div className="form-group">
                  <label className="form-label">Settlement Amount ({currencySymbol})</label>
                  <input type="number" className="form-control" value={settleAmount} onChange={(e) => setSettleAmount(Number(e.target.value))} min={0} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Remarks / Notes</label>
                <input type="text" className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>check</span>
                {loading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
