'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { recordAuctionWinner, recordChitPayment } from '../actions';
import { formatCurrency, formatDate } from '@/lib/utils';

interface ChitGroupDetailClientProps {
  group: any;
  currencySymbol: string;
}

export default function ChitGroupDetailClient({ group, currencySymbol }: ChitGroupDetailClientProps) {
  const router = useRouter();
  const [auctionModal, setAuctionModal] = useState<any>(null);
  const [paymentModal, setPaymentModal] = useState<any>(null);
  const [winnerId, setWinnerId] = useState('');
  const [prizeAmount, setPrizeAmount] = useState(0);
  const [payAmount, setPayAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRecordWinner = async () => {
    if (!auctionModal || !winnerId) return;
    setLoading(true);
    setError('');
    try {
      await recordAuctionWinner(auctionModal.id, winnerId, prizeAmount);
      setAuctionModal(null);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleRecordPayment = async () => {
    if (!paymentModal) return;
    setLoading(true);
    setError('');
    try {
      await recordChitPayment(paymentModal.memberId, paymentModal.periodNumber, payAmount);
      setPaymentModal(null);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const pendingAuctions = group.auctions.filter((a: any) => a.status === 'pending');
  const completedAuctions = group.auctions.filter((a: any) => a.status === 'completed');

  return (
    <>
      {error && <div className="alert alert-danger" style={{ marginBottom: '16px', padding: '10px 14px', background: '#fff0f0', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', color: 'var(--danger)' }}>{error}</div>}

      {/* Summary */}
      <div className="kpi-grid" style={{ marginBottom: '20px' }}>
        <div className="kpi-card">
          <div className="kpi-icon green"><span className="material-icons-outlined">savings</span></div>
          <div><div className="kpi-value">{formatCurrency(Number(group.chitValue), currencySymbol)}</div><div className="kpi-label">Chit Value</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon blue"><span className="material-icons-outlined">payments</span></div>
          <div><div className="kpi-value">{formatCurrency(Number(group.monthlyContrib), currencySymbol)}</div><div className="kpi-label">Monthly Contribution</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange"><span className="material-icons-outlined">groups</span></div>
          <div><div className="kpi-value">{group.members.length}/{group.totalMembers}</div><div className="kpi-label">Members Enrolled</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon purple"><span className="material-icons-outlined">gavel</span></div>
          <div><div className="kpi-value">{completedAuctions.length}/{group.durationMonths}</div><div className="kpi-label">Auctions Completed</div></div>
        </div>
      </div>

      <div className="grid-60-40">
        {/* Auctions */}
        <div className="card">
          <div className="card-header"><h3>🔨 Auction History</h3></div>
          {group.auctions.length === 0 ? (
            <p style={{ padding: '16px', color: 'var(--text-secondary)' }}>No auctions yet.</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Date</th>
                    <th>Winner</th>
                    <th>Prize</th>
                    <th>Dividend</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {group.auctions.map((a: any) => (
                    <tr key={a.id}>
                      <td>Period {a.periodNumber}</td>
                      <td>{formatDate(a.auctionDate)}</td>
                      <td>{a.winnerMember?.customer?.name || '—'}</td>
                      <td>{a.prizeAmount ? formatCurrency(Number(a.prizeAmount), currencySymbol) : '—'}</td>
                      <td>{a.dividend ? formatCurrency(Number(a.dividend), currencySymbol) : '—'}</td>
                      <td><span className={`badge badge-${a.status === 'completed' ? 'success' : 'warning'}`}>{a.status}</span></td>
                      <td>
                        {a.status === 'pending' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setAuctionModal(a);
                              setPrizeAmount(Number(group.chitValue));
                              setWinnerId('');
                              setError('');
                            }}
                          >
                            Record Winner
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Members */}
        <div className="card">
          <div className="card-header"><h3>👥 Members</h3></div>
          {group.members.length === 0 ? (
            <p style={{ padding: '16px', color: 'var(--text-secondary)' }}>No members enrolled.</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Customer</th>
                    <th>Won</th>
                  </tr>
                </thead>
                <tbody>
                  {group.members.map((m: any) => (
                    <tr key={m.id}>
                      <td>{m.memberNumber}</td>
                      <td>
                        <a href={`/customers/${m.customer.id}`}>{m.customer.name}</a>
                        <br /><span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{m.customer.customerCode}</span>
                      </td>
                      <td>{m.hasWon ? <span className="badge badge-success">Won {formatDate(m.wonAt)}</span> : <span className="badge badge-secondary">Pending</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Subscription Payments */}
      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header"><h3>💳 Member Payments</h3></div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Period</th>
                <th>Due Date</th>
                <th>Due Amount</th>
                <th>Paid</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {group.members.flatMap((m: any) =>
                m.subscriptions.map((s: any) => (
                  <tr key={s.id}>
                    <td>{m.customer.name}</td>
                    <td>Period {s.periodNumber}</td>
                    <td>{formatDate(s.dueDate)}</td>
                    <td>{formatCurrency(Number(s.dueAmount), currencySymbol)}</td>
                    <td>{formatCurrency(Number(s.paidAmount), currencySymbol)}</td>
                    <td><span className={`badge badge-${s.status === 'paid' ? 'success' : s.status === 'missed' ? 'danger' : 'secondary'}`}>{s.status}</span></td>
                    <td>
                      {s.status !== 'paid' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setPaymentModal({ memberId: m.id, periodNumber: s.periodNumber, dueAmount: s.dueAmount });
                            setPayAmount(Number(s.dueAmount));
                            setError('');
                          }}
                        >
                          Record Payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auction Winner Modal */}
      {auctionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '440px', padding: '24px' }}>
            <h3 style={{ marginBottom: '12px' }}>Record Auction Winner — Period {auctionModal.periodNumber}</h3>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '10px', fontSize: '.85rem' }}>{error}</p>}
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Winner</label>
              <select className="form-control" value={winnerId} onChange={(e) => setWinnerId(e.target.value)}>
                <option value="">Select member</option>
                {group.members.filter((m: any) => !m.hasWon).map((m: any) => (
                  <option key={m.id} value={m.id}>{m.memberNumber}. {m.customer.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Prize Amount ({currencySymbol})</label>
              <input type="number" className="form-control" value={prizeAmount} onChange={(e) => setPrizeAmount(Number(e.target.value))} max={Number(group.chitValue)} />
              {prizeAmount < Number(group.chitValue) && (
                <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Bid discount: {formatCurrency(Number(group.chitValue) - prizeAmount, currencySymbol)} | Commission ({group.commissionPct}%): {formatCurrency(((Number(group.chitValue) - prizeAmount) * Number(group.commissionPct)) / 100, currencySymbol)}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setAuctionModal(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleRecordWinner} disabled={loading || !winnerId}>
                {loading ? 'Saving...' : 'Record Winner'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '380px', padding: '24px' }}>
            <h3 style={{ marginBottom: '12px' }}>Record Payment — Period {paymentModal.periodNumber}</h3>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '10px', fontSize: '.85rem' }}>{error}</p>}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Amount Paid ({currencySymbol})</label>
              <input type="number" className="form-control" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPaymentModal(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleRecordPayment} disabled={loading || payAmount <= 0}>
                {loading ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
