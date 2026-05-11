'use client';

import { useState } from 'react';
import { formatCurrency, formatDate, getBadgeClass, calcPercentage } from '@/lib/utils';
import { markInstalmentPaid, waiveLoanPenalty, settleLoanPenalty, closeLoan } from './actions';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoanDetailClient({
  loan,
  currencySymbol
}: {
  loan: any;
  currencySymbol: string;
}) {
  const router = useRouter();
  const pct = calcPercentage(loan.paidCount, loan.totalInstalments);
  
  // Calculate penalty summary dynamically
  const missedInstalments = loan.instalments.filter((i: any) => i.status === 'missed');
  const missedCount = missedInstalments.length;
  
  const totalPenalty = loan.penalties.reduce((sum: number, p: any) => sum + Number(p.grossPenalty), 0);
  const settledPenalty = loan.penalties.reduce((sum: number, p: any) => sum + Number(p.settledAmount), 0);
  const waivedPenalty = loan.penalties.reduce((sum: number, p: any) => sum + Number(p.waivedAmount), 0);
  const netPenalty = totalPenalty - settledPenalty - waivedPenalty;

  // Modal states
  const [paymentModal, setPaymentModal] = useState<any>(null);
  const [penaltyModal, setPenaltyModal] = useState<any>(null);
  const [closeModal, setCloseModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Payment form state
  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState('cash');
  const [payRemarks, setPayRemarks] = useState('');

  // Penalty form state
  const [penAction, setPenAction] = useState<'waive' | 'settle'>('settle');
  const [penAmount, setPenAmount] = useState(0);
  const [penNotes, setPenNotes] = useState('');

  const openPaymentModal = (inst: any) => {
    setPayAmount(Number(inst.receivedAmount) > 0 ? Number(inst.receivedAmount) : Number(inst.dueAmount));
    setPayMode(inst.paymentMode || 'cash');
    setPayRemarks(inst.remarks || '');
    setPaymentModal(inst);
  };

  const handleSubmitPayment = async () => {
    if (!paymentModal || payAmount <= 0) return;
    setLoading(true);
    const fd = new FormData();
    fd.set('instalmentId', paymentModal.id);
    fd.set('receivedAmount', String(payAmount));
    fd.set('paymentMode', payMode);
    fd.set('remarks', payRemarks);
    const result = await markInstalmentPaid(fd);
    setLoading(false);
    if (result.success) {
      setPaymentModal(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to record payment');
    }
  };

  const openPenaltyModal = (penalty: any, action: 'waive' | 'settle') => {
    setPenAction(action);
    const gross = Number(penalty.grossPenalty);
    const settled = Number(penalty.settledAmount);
    const waived = Number(penalty.waivedAmount);
    setPenAmount(action === 'settle' ? gross - settled - waived : gross - settled - waived);
    setPenNotes('');
    setPenaltyModal(penalty);
  };

  const handleSubmitPenalty = async () => {
    if (!penaltyModal) return;
    setLoading(true);
    const fd = new FormData();
    fd.set('penaltyId', penaltyModal.id);
    fd.set('notes', penNotes);

    let result;
    if (penAction === 'waive') {
      fd.set('waivedAmount', String(penAmount));
      result = await waiveLoanPenalty(fd);
    } else {
      fd.set('settledAmount', String(penAmount));
      result = await settleLoanPenalty(fd);
    }
    setLoading(false);
    if (result.success) {
      setPenaltyModal(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to process penalty');
    }
  };

  const handleCloseLoan = async () => {
    setLoading(true);
    const fd = new FormData();
    fd.set('loanId', loan.id);
    const result = await closeLoan(fd);
    setLoading(false);
    if (result.success) {
      setCloseModal(false);
      router.refresh();
    } else {
      alert(result.error || 'Failed to close loan');
    }
  };

  const totalCollected = Number(loan.totalCollected);
  const totalDue = loan.instalments.reduce((s: number, i: any) => s + Number(i.dueAmount), 0);
  const outstanding = totalDue - totalCollected;

  return (
    <>
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="loan-header">
          <div className="loan-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2>{loan.loanCode}</h2>
              <span className={getBadgeClass(loan.status)} style={{textTransform:'capitalize'}}>{loan.status}</span>
            </div>
            <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>
              Customer: <Link href={`/customers/${loan.customerId}`}>{loan.customer.name}</Link>
            </p>
            <div className="loan-meta">
              <div className="meta-item"><div className="meta-label">Principal</div><div className="meta-value">{formatCurrency(loan.principal, currencySymbol)}</div></div>
              <div className="meta-item"><div className="meta-label">Disbursed</div><div className="meta-value">{formatCurrency(loan.disbursed, currencySymbol)}</div></div>
              <div className="meta-item"><div className="meta-label">Frequency</div><div className="meta-value" style={{textTransform:'capitalize'}}>{loan.frequency}</div></div>
              <div className="meta-item"><div className="meta-label">Start Date</div><div className="meta-value">{formatDate(loan.startDate)}</div></div>
              <div className="meta-item"><div className="meta-label">Per Instalment</div><div className="meta-value">{formatCurrency(loan.perInstalment, currencySymbol)}</div></div>
              <div className="meta-item"><div className="meta-label">Tenure</div><div className="meta-value">{loan.tenure} {loan.frequency === 'daily' ? 'days' : loan.frequency === 'weekly' ? 'weeks' : 'months'}</div></div>
              <div className="meta-item"><div className="meta-label">Total Collected</div><div className="meta-value" style={{color:'var(--success)'}}>{formatCurrency(totalCollected, currencySymbol)}</div></div>
              <div className="meta-item"><div className="meta-label">Outstanding</div><div className="meta-value" style={{color: outstanding > 0 ? 'var(--danger)' : 'var(--success)'}}>{formatCurrency(outstanding, currencySymbol)}</div></div>
            </div>
          </div>
          <div style={{ textAlign: 'center', minWidth: '120px' }}>
            <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto' }}>
              <svg viewBox="0 0 36 36" style={{ width: '100px', height: '100px', transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E2E8F0" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--primary)" strokeWidth="3" strokeDasharray={`${pct}, 100`} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 700 }}>{pct}%</div>
            </div>
            <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>{loan.paidCount}/{loan.totalInstalments} paid</div>
          </div>
        </div>
      </div>

      <div className="grid-60-40">
        <div className="card">
          <div className="card-header"><h3>📅 Payment Schedule</h3></div>
          <div className="table-wrapper" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Due</th>
                  <th>Received</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loan.instalments.map((inst: any) => {
                  const canPay = true;
                  return (
                    <tr key={inst.id} style={{ opacity: inst.status === 'paid' ? 0.6 : 1 }}>
                      <td>{inst.instalmentNo}</td>
                      <td>{formatDate(inst.dueDate)}</td>
                      <td>{formatCurrency(inst.dueAmount, currencySymbol)}</td>
                      <td>{Number(inst.receivedAmount) > 0 ? formatCurrency(inst.receivedAmount, currencySymbol) : '—'}</td>
                      <td>
                        <span className={getBadgeClass(inst.status)} style={{textTransform:'capitalize'}}>
                          {inst.status}
                        </span>
                      </td>
                      <td>
                        {canPay && loan.status !== 'closed' && (
                          <button className="btn btn-primary btn-sm" onClick={() => openPaymentModal(inst)} style={{ padding: '8px 12px', minHeight: '36px' }}>
                            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>{inst.status === 'paid' ? 'edit' : 'payments'}</span> {inst.status === 'paid' ? 'Edit' : 'Pay'}
                          </button>
                        )}
                        {inst.status === 'paid' && inst.receivedAt && (
                          <span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>
                            {formatDate(inst.receivedAt)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header"><h3>⚡ Penalty Summary</h3></div>
            <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="stat-item"><div className="stat-value" style={{ color: 'var(--danger)' }}>{missedCount}</div><div className="stat-label">Missed Days</div></div>
              <div className="stat-item"><div className="stat-value" style={{ color: 'var(--danger)' }}>{formatCurrency(totalPenalty, currencySymbol)}</div><div className="stat-label">Total Penalty</div></div>
              <div className="stat-item"><div className="stat-value" style={{ color: 'var(--success)' }}>{formatCurrency(settledPenalty + waivedPenalty, currencySymbol)}</div><div className="stat-label">Settled + Waived</div></div>
              <div className="stat-item"><div className="stat-value" style={{ color: 'var(--primary-dark)' }}>{formatCurrency(netPenalty, currencySymbol)}</div><div className="stat-label">Net Due</div></div>
            </div>
            {loan.penalties.length > 0 && (
              <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                {loan.penalties.map((p: any) => {
                  const pNet = Number(p.grossPenalty) - Number(p.settledAmount) - Number(p.waivedAmount);
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '.82rem' }}>
                      <div>
                        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{formatCurrency(p.grossPenalty, currencySymbol)}</span>
                        <span style={{ color: 'var(--text-light)', marginLeft: '8px' }}>{p.missedDays} days</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {p.status === 'pending' && (
                          <>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: '.72rem' }} onClick={() => openPenaltyModal(p, 'settle')}>Settle</button>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: '.72rem', color: 'var(--text-light)' }} onClick={() => openPenaltyModal(p, 'waive')}>Waive</button>
                          </>
                        )}
                        <span className={getBadgeClass(p.status)} style={{textTransform:'capitalize', fontSize: '.7rem'}}>{p.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {loan.status !== 'closed' && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header"><h3>🔧 Admin Actions</h3></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button className="btn btn-danger" onClick={() => setCloseModal(true)}>
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>lock</span> Close Loan
                </button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header"><h3>📄 Security Cheques</h3></div>
            <div>
              {loan.customer.securityCheques.map((ch: any) => (
                <div key={ch.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '.82rem' }}>
                  <span>{ch.bankName} — {ch.chequeNumber}</span>
                  <span className={getBadgeClass(ch.status)} style={{textTransform:'capitalize'}}>{ch.status}</span>
                </div>
              ))}
              {loan.customer.securityCheques.length === 0 && (
                <p style={{ color: 'var(--text-light)', fontSize: '.85rem' }}>No cheques registered</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setPaymentModal(null); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>💰 Record Payment</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setPaymentModal(null)}>close</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.9rem' }}>
                  <span><strong>{loan.customer.name}</strong></span>
                  <span style={{ color: 'var(--text-secondary)' }}>Instalment #{paymentModal.instalmentNo}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  <span>Due: {formatDate(paymentModal.dueDate)}</span>
                  <span>Amount: <strong style={{ color: 'var(--text)' }}>{formatCurrency(paymentModal.dueAmount, currencySymbol)}</strong></span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Received Amount ({currencySymbol}) *</label>
                <input type="number" className="form-control" style={{ fontSize: '1.1rem', padding: '12px' }} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} min={0} required />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select className="form-control" style={{ fontSize: '1rem', padding: '12px' }} value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Remarks (optional)</label>
                <input type="text" className="form-control" style={{ fontSize: '1rem', padding: '12px' }} value={payRemarks} onChange={(e) => setPayRemarks(e.target.value)} placeholder="Any notes..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" style={{ padding: '10px 16px', fontSize: '1rem' }} onClick={() => setPaymentModal(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ padding: '10px 16px', fontSize: '1rem' }} onClick={handleSubmitPayment} disabled={loading || payAmount < 0}>
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>check</span>
                {loading ? 'Submitting...' : 'Submit Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Penalty Modal */}
      {penaltyModal && (
        <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setPenaltyModal(null); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>⚖️ {penAction === 'waive' ? 'Waive' : 'Settle'} Penalty</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setPenaltyModal(null)}>close</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px' }}>
                <p style={{ fontSize: '.85rem' }}><strong>{loan.customer.name}</strong> — {loan.loanCode}</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)', marginTop: '6px' }}>
                  Gross Penalty: {formatCurrency(penaltyModal.grossPenalty, currencySymbol)}
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">{penAction === 'waive' ? 'Waive' : 'Settlement'} Amount ({currencySymbol})</label>
                <input type="number" className="form-control" value={penAmount} onChange={(e) => setPenAmount(Number(e.target.value))} min={0} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input type="text" className="form-control" value={penNotes} onChange={(e) => setPenNotes(e.target.value)} placeholder="Add notes..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPenaltyModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmitPenalty} disabled={loading}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>check</span>
                {loading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Loan Modal */}
      {closeModal && (
        <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setCloseModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>🔒 Close Loan</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setCloseModal(false)}>close</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#FEF2F2', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px' }}>
                <p style={{ fontSize: '.9rem', fontWeight: 600, color: '#991B1B' }}>Are you sure you want to close this loan?</p>
                <p style={{ fontSize: '.82rem', color: '#B91C1C', marginTop: '6px' }}>
                  This will permanently mark <strong>{loan.loanCode}</strong> as closed. 
                  {loan.paidCount < loan.totalInstalments && (
                    <span> {loan.totalInstalments - loan.paidCount} instalments are still unpaid.</span>
                  )}
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCloseModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleCloseLoan} disabled={loading}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>lock</span>
                {loading ? 'Closing...' : 'Close Loan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
