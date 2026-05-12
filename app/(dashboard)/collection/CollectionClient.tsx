'use client';

import { useState } from 'react';
import { formatCurrency, formatDate, getBadgeClass, getInitials } from '@/lib/utils';
import { submitCollectionEntry } from './actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CollectionClient({
  instalments,
  agentName,
  agentRole,
  routeName,
  currencySymbol,
  dict
}: {
  instalments: any[];
  agentName: string;
  agentRole: string;
  routeName: string;
  currencySymbol: string;
  dict: any;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState('cash');
  const [remarks, setRemarks] = useState('');
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  // Calculations
  const totalDue = instalments.reduce((s, i) => s + Number(i.dueAmount), 0);
  const totalSubmitted = instalments
    .filter((i) => i.status === 'paid' || i.status === 'partial' || submittedIds.has(i.id))
    .reduce((s, i) => s + Number(i.receivedAmount || i.dueAmount), 0);
  const remaining = totalDue - totalSubmitted;
  const doneCount = instalments.filter(
    (i) => i.status === 'paid' || i.status === 'partial' || submittedIds.has(i.id)
  ).length;
  const pendingCount = instalments.length - doneCount;

  const openModal = (inst: any) => {
    setAmount(Number(inst.dueAmount));
    setMode('cash');
    setRemarks('');
    setModal(inst);
  };

  const handleSubmit = async () => {
    if (!modal || amount <= 0) return;
    setLoading(true);
    const fd = new FormData();
    fd.set('instalmentId', modal.id);
    fd.set('receivedAmount', String(amount));
    fd.set('paymentMode', mode);
    fd.set('remarks', remarks);
    const result = await submitCollectionEntry(fd);
    setLoading(false);
    if (result.success) {
      setSubmittedIds((prev) => new Set(prev).add(modal.id));
      setModal(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to submit');
    }
  };

  return (
    <>
      {/* Agent Info Bar */}
      <div className="card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="profile-avatar" style={{ width: '48px', height: '48px', fontSize: '1rem' }}>{getInitials(agentName)}</div>
          <div>
            <h3 style={{ fontSize: '1rem' }}>{agentName} — {agentRole === 'admin' ? dict.roles.admin : dict.roles.agent}</h3>
            <p style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>
              {dict.collection.route}: <strong>{routeName}</strong> · Today: {todayStr}
            </p>
          </div>
        </div>
        <span className="badge badge-active" style={{ fontSize: '.8rem', padding: '6px 14px' }}>🟢 Online</span>
      </div>

      {/* Summary Bar */}
      <div className="summary-bar" style={{ marginBottom: '20px' }}>
        <div className="summary-item">
          <div className="summary-value">{formatCurrency(totalDue, currencySymbol)}</div>
          <div className="summary-label">Total Due Today</div>
        </div>
        <div className="summary-item">
          <div className="summary-value" style={{ color: 'var(--success)' }}>{formatCurrency(totalSubmitted, currencySymbol)}</div>
          <div className="summary-label">Total Submitted</div>
        </div>
        <div className="summary-item">
          <div className="summary-value" style={{ color: 'var(--warning, #F59E0B)' }}>{formatCurrency(remaining, currencySymbol)}</div>
          <div className="summary-label">Remaining</div>
        </div>
        <div className="summary-item">
          <div className="summary-value">{doneCount}/{instalments.length}</div>
          <div className="summary-label">Entries Done</div>
        </div>
      </div>

      {/* Collection Table */}
      <div className="card">
        <div className="card-header">
          <h3>📋 {dict.collection.todaysList}</h3>
          <span className="badge badge-pending">{pendingCount} {dict.collection.pending}</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{dict.customers.title}</th>
                <th>{dict.sidebar.loans}</th>
                <th>Due Date</th>
                <th>{dict.loans.principal}</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {instalments.map((inst) => {
                const isPaid = inst.status === 'paid' || inst.status === 'partial' || submittedIds.has(inst.id);
                const isMissed = new Date(inst.dueDate) < new Date(new Date().toDateString());
                return (
                  <tr key={inst.id} style={{ opacity: isPaid ? 0.6 : 1 }}>
                    <td>
                      <Link href={`/customers/${inst.loan.customer.customerCode}`}>
                        <strong>{inst.loan.customer.name}</strong>
                      </Link>
                      <br />
                      <span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>
                        {inst.loan.customer.customerCode} · {inst.loan.customer.route?.name || '—'}
                      </span>
                    </td>
                    <td>
                      <Link href={`/loans/${inst.loan.id}`}>{inst.loan.loanCode}</Link>
                    </td>
                    <td>
                      {formatDate(inst.dueDate)}
                      {isMissed && !isPaid && (
                        <span className="badge badge-missed" style={{ marginLeft: '6px', fontSize: '.65rem' }}>Overdue</span>
                      )}
                    </td>
                    <td>{formatCurrency(inst.dueAmount, currencySymbol)}</td>
                    <td>
                      {isPaid ? (
                        <span className="badge badge-paid">
                          <span className="material-icons-outlined" style={{ fontSize: '12px' }}>lock</span> {dict.collection.markPaid}
                        </span>
                      ) : (
                        <span className={getBadgeClass(isMissed ? 'missed' : 'upcoming')} style={{ textTransform: 'capitalize' }}>
                          {isMissed ? 'Missed' : dict.collection.pending}
                        </span>
                      )}
                    </td>
                    <td>
                      {isPaid ? (
                        <span style={{ color: 'var(--text-light)', fontSize: '.8rem' }}>Done</span>
                      ) : (
                        <button className="btn btn-primary btn-sm" onClick={() => openModal(inst)}>
                          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>send</span> {dict.collection.markPaid}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {instalments.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-light)' }}>
                    {dict.collection.noCollections}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collection Modal */}
      {modal && (
        <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>💰 {dict.collection.title}</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setModal(null)}>close</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem' }}>
                  <span><strong>{modal.loan.customer.name}</strong></span>
                  <span style={{ color: 'var(--text-secondary)' }}>{modal.loan.customer.customerCode}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  <span>Loan: {modal.loan.loanCode} · #{modal.instalmentNo}</span>
                  <span>Due: <strong style={{ color: 'var(--text)' }}>{formatCurrency(modal.dueAmount, currencySymbol)}</strong></span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{dict.collection.collected} ({currencySymbol}) *</label>
                <input type="number" className="form-control" value={amount} onChange={(e) => setAmount(Number(e.target.value))} min={1} required />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select className="form-control" value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Remarks (optional)</label>
                <input type="text" className="form-control" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Any notes..." />
              </div>
              <div style={{ background: '#FEF3C7', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '.78rem', color: '#92400E', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>warning</span>
                <span><strong>Warning:</strong> Once submitted, this entry cannot be reversed.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>{dict.loans.cancel}</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || amount <= 0}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>check</span>
                {loading ? dict.collection.receiving : dict.collection.markPaid}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
