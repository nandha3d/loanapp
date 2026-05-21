'use client';

import { useState } from 'react';
import { formatCurrency, getBadgeClass } from '@/lib/utils';
import { settlePenalty, waivePenalty, enforcePenalty } from './actions';
import { useRouter } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';

export default function PenaltiesClient({
  penalties,
  kpis,
  routes,
  currencySymbol,
  filters,
  dict,
}: {
  penalties: any[];
  kpis: { totalGross: number; totalSettled: number; totalWaived: number; count: number };
  routes: any[];
  currencySymbol: string;
  filters: { q: string; status: string; routeId: string };
  dict: any;
}) {
  const d = dict.penalties;
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
          <div><div className="kpi-value" style={{ color: 'var(--danger)' }}>{formatCurrency(kpis.totalGross, currencySymbol)}</div><div className="kpi-label">{d.totalGross}</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon green"><span className="material-icons-outlined">check_circle</span></div>
          <div><div className="kpi-value" style={{ color: 'var(--success)' }}>{formatCurrency(kpis.totalSettled, currencySymbol)}</div><div className="kpi-label">{d.totalSettled}</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon purple"><span className="material-icons-outlined">money_off</span></div>
          <div><div className="kpi-value" style={{ color: '#8B5CF6' }}>{formatCurrency(kpis.totalWaived, currencySymbol)}</div><div className="kpi-label">{d.totalWaived}</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange"><span className="material-icons-outlined">account_balance_wallet</span></div>
          <div><div className="kpi-value" style={{ color: 'var(--primary-dark)' }}>{formatCurrency(netOutstanding, currencySymbol)}</div><div className="kpi-label">{d.netOutstanding}</div></div>
        </div>
      </div>

      {/* Main Card */}
      <div className="card">
        <div className="card-header">
          <h3>⚖️ {d.title}</h3>
          <span className="badge badge-pending">{kpis.count} {d.total}</span>
        </div>

        <form className="filter-bar" method="GET">
          <div className="search-input">
            <span className="material-icons-outlined">search</span>
            <input type="text" name="q" className="form-control" placeholder={d.searchPlaceholder} defaultValue={filters.q} />
          </div>
          <select name="status" className="form-control" style={{ width: 'auto' }} defaultValue={filters.status}>
            <option value="">{d.allStatus}</option>
            <option value="pending">{d.pending}</option>
            <option value="settled">{d.settled}</option>
            <option value="waived">{d.waived}</option>
            <option value="partial">{d.partial}</option>
          </select>
          <select name="routeId" className="form-control" style={{ width: 'auto' }} defaultValue={filters.routeId}>
            <option value="">{d.allRoutes}</option>
            {routes.map((r: any) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary">{d.filter}</button>
          {(filters.q || filters.status || filters.routeId) && (
            <Link href="/penalties" className="btn btn-ghost">{d.clear}</Link>
          )}
        </form>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{d.loanId}</th>
                <th>{d.customer}</th>
                <th>{d.route}</th>
                <th>{d.missedDays}</th>
                <th>{d.grossPenalty}</th>
                <th>{d.settled}</th>
                <th>{d.waived}</th>
                <th>{d.netOutstandingCol}</th>
                <th>{d.status}</th>
                <th>{d.action}</th>
              </tr>
            </thead>
            <tbody>
              {penalties.map((p: any) => {
                const net = Number(p.grossPenalty) - Number(p.settledAmount) - Number(p.waivedAmount);
                return (
                  <tr key={p.id}>
                    <td><Link href={`/loans/${p.loan.loanCode}`}><strong>{p.loan.loanCode}</strong></Link></td>
                    <td>
                      <Link href={`/customers/${p.customer.customerCode}`}>{p.customer.name}</Link>
                      <br /><span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{p.customer.customerCode}</span>
                    </td>
                    <td>{p.customer.route?.name || '—'}</td>
                    <td><span className="badge badge-missed">{p.missedDays} {d.missedDaysLabel}</span></td>
                    <td style={{ fontWeight: 600, color: 'var(--danger)' }}>{formatCurrency(p.grossPenalty, currencySymbol)}</td>
                    <td style={{ color: 'var(--success)' }}>{formatCurrency(p.settledAmount, currencySymbol)}</td>
                    <td style={{ color: '#8B5CF6' }}>{formatCurrency(p.waivedAmount, currencySymbol)}</td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(net, currencySymbol)}</td>
                    <td><span className={getBadgeClass(p.status)} style={{ textTransform: 'capitalize' }}>{p.status}</span></td>
                    <td>
                      {p.status === 'pending' || p.status === 'partial' ? (
                        <button className="btn btn-ghost btn-sm" onClick={() => openModal(p)}>{d.action}</button>
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
                    {d.noPenalties} 🎉
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
              <h3>⚖️ {d.penaltyAction}</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setModal(null)}>close</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px' }}>
                <p style={{ fontSize: '.85rem' }}><strong>{modal.customer.name}</strong> — {modal.loan.loanCode}</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)', marginTop: '6px' }}>
                  {d.grossPenalty}: {formatCurrency(modal.grossPenalty, currencySymbol)}
                </p>
                <p style={{ fontSize: '.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {modal.missedDays} {d.missedDaysLabel} · {d.alreadySettled}: {formatCurrency(modal.settledAmount, currencySymbol)}
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">{d.penaltyAction} *</label>
                <select className="form-control" value={action} onChange={(e) => setAction(e.target.value as any)}>
                  <option value="enforce">{d.enforceFullPenalty}</option>
                  <option value="settle">{d.partialSettlement}</option>
                  <option value="waive">{d.waiveEntirely}</option>
                </select>
              </div>
              {action === 'settle' && (
                <div className="form-group">
                  <label className="form-label">{d.settlementAmount} ({currencySymbol})</label>
                  <input type="number" className="form-control" value={settleAmount} onChange={(e) => setSettleAmount(Number(e.target.value))} min={0} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">{d.remarks}</label>
                <input type="text" className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={d.addNotesPlaceholder} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>{d.cancel}</button>
              <button className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>check</span>
                {loading ? d.processing : d.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
