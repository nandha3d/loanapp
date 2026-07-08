'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  activateChitGroup,
  cancelChitGroup,
  drawAuctionWinner,
  markPaymentMissed,
  recordChitPayment,
  updateChitMemberDetails,
  markChitAgreementSigned,
  verifyChitAgreement,
} from '../actions';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from '@/components/layout/DashboardLink';

interface ChitGroupDetailClientProps {
  group: any;
  currencySymbol: string;
  dict: any;
}

const AUCTION_TYPE_LABELS: Record<string, string> = {
  open_manual: 'Open auction (manual entry)',
  open_live: 'Open live bidding',
  sealed: 'Sealed tender',
  lottery: 'Lottery draw',
  fixed_rotation: 'Fixed rotation',
};

const DISTRIBUTION_LABELS: Record<string, string> = {
  ADJUST_NEXT_DUE: 'Reduces next installment',
  CASH_PAYOUT: 'Paid out in cash',
  ACCUMULATE: 'Accumulated to closure',
};

export default function ChitGroupDetailClient({ group, currencySymbol, dict }: ChitGroupDetailClientProps) {
  const d = dict.chits;
  const router = useRouter();
  const [paymentModal, setPaymentModal] = useState<any>(null);
  const [memberModal, setMemberModal] = useState<any>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [lastReceipt, setLastReceipt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const isDrawType = ['lottery', 'fixed_rotation'].includes(group.auctionType);
  const completedAuctions = group.auctions.filter((a: any) => ['confirmed', 'paid', 'completed'].includes(a.status));

  const run = async (label: string, fn: () => Promise<any>) => {
    setBusy(label);
    setError('');
    try {
      await fn();
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    }
    setBusy('');
  };

  const handleRecordPayment = async () => {
    if (!paymentModal) return;
    setLoading(true);
    setError('');
    try {
      const result = await recordChitPayment(paymentModal.memberId, paymentModal.periodNumber, payAmount, payMode, payRef || null, payNotes || null);
      setLastReceipt(result?.receiptNo || '');
      setPaymentModal(null);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleSaveMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!memberModal) return;
    setLoading(true);
    setError('');
    try {
      await updateChitMemberDetails(memberModal.id, new FormData(e.currentTarget));
      setMemberModal(null);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const agreementBadge = (status: string) => {
    const cls = status === 'verified' ? 'success' : status === 'signed' ? 'info' : status === 'rejected' ? 'danger' : 'warning';
    return <span className={`badge badge-${cls}`}>{status}</span>;
  };

  const complianceRows: [string, React.ReactNode][] = group.chitType === 'registered'
    ? [
        ['Registration no', group.registrationNo || <span style={{ color: 'var(--danger)' }}>missing</span>],
        ['Registrar office', group.registrarOffice || <span style={{ color: 'var(--danger)' }}>missing</span>],
        ['By-law no', group.bylawNo || <span style={{ color: 'var(--danger)' }}>missing</span>],
        ['Commencement cert.', group.commencementCertificate || <span style={{ color: 'var(--danger)' }}>missing</span>],
        ['Approved bank', group.approvedBankName || <span style={{ color: 'var(--danger)' }}>missing</span>],
        ['Foreman', group.foremanName || <span style={{ color: 'var(--danger)' }}>missing</span>],
      ]
    : [['Compliance', 'Unregistered chit — registration details not required']];

  return (
    <>
      {error && <div className="alert alert-danger" style={{ marginBottom: '16px', padding: '10px 14px', background: '#fff0f0', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', color: 'var(--danger)' }}>{error}</div>}
      {lastReceipt && (
        <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#f0fff4', border: '1px solid var(--success)', borderRadius: 'var(--radius)', color: 'var(--success)' }}>
          Payment recorded — receipt {lastReceipt}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'flex-end' }}>
        <a href={`/chits/${group.id}/edit`} className="btn btn-secondary btn-sm">Edit</a>
        {group.status === 'draft' && (
          <button
            className="btn btn-primary btn-sm"
            disabled={busy === 'activate'}
            onClick={() => run('activate', () => activateChitGroup(group.id))}
          >
            {busy === 'activate' ? 'Activating…' : 'Activate Group'}
          </button>
        )}
        {group.status === 'active' && (
          <button
            className="btn btn-danger btn-sm"
            disabled={busy === 'cancel'}
            onClick={() => {
              if (confirm('Cancel this chit group? All pending auctions will be cancelled.')) {
                run('cancel', () => cancelChitGroup(group.id));
              }
            }}
          >
            {busy === 'cancel' ? 'Cancelling…' : 'Cancel Group'}
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="kpi-grid" style={{ marginBottom: '20px' }}>
        <div className="kpi-card">
          <div className="kpi-icon green"><span className="material-icons-outlined">savings</span></div>
          <div><div className="kpi-value">{formatCurrency(Number(group.chitValue), currencySymbol)}</div><div className="kpi-label">{d.chitValue}</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon blue"><span className="material-icons-outlined">payments</span></div>
          <div><div className="kpi-value">{formatCurrency(Number(group.monthlyContrib), currencySymbol)}</div><div className="kpi-label">Installment ({group.auctionFrequency})</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange"><span className="material-icons-outlined">groups</span></div>
          <div><div className="kpi-value">{group.members.length}/{group.totalMembers}</div><div className="kpi-label">{d.membersEnrolled}</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon purple"><span className="material-icons-outlined">gavel</span></div>
          <div><div className="kpi-value">{completedAuctions.length}/{group.totalMembers}</div><div className="kpi-label">{d.auctionsCompleted}</div></div>
        </div>
      </div>

      {/* Configuration & compliance */}
      <div className="grid-60-40" style={{ marginBottom: '20px' }}>
        <div className="card">
          <div className="card-header"><h3>⚙️ Chit configuration</h3></div>
          <div className="table-wrapper">
            <table>
              <tbody>
                <tr><td>Type</td><td>{group.chitType === 'registered' ? 'Registered' : 'Unregistered'} · {AUCTION_TYPE_LABELS[group.auctionType] ?? group.auctionType}</td></tr>
                <tr><td>Commission</td><td>{Number(group.commissionPct)}% of {group.commissionBasis === 'CHIT_VALUE' ? 'chit value' : 'bid discount'}{group.gstPct ? ` + GST ${Number(group.gstPct)}%` : ''}</td></tr>
                <tr><td>Dividend</td><td>{group.dividendPolicy === 'NON_WINNERS_ONLY' ? 'Non-winners only' : 'All members'} · {DISTRIBUTION_LABELS[group.dividendDistribution] ?? group.dividendDistribution}{group.dividendRounding ? ` · rounded to ${currencySymbol}${group.dividendRounding}` : ''}</td></tr>
                {!isDrawType && (
                  <tr><td>Bid rules</td><td>
                    Discount {group.minDiscountPct ? `${Number(group.minDiscountPct)}%` : `${Number(group.commissionPct)}% (commission floor)`} – {group.maxDiscountPct ? `${Number(group.maxDiscountPct)}%` : 'no cap'}
                    {group.bidIncrement ? ` · step ${formatCurrency(Number(group.bidIncrement), currencySymbol)}` : ''}
                    {` · tie: ${group.tieBreakRule === 'LOTTERY_AMONG_TIED' ? 'lottery among tied' : 'earliest bid'}`}
                  </td></tr>
                )}
                {isDrawType && (
                  <tr><td>Fixed discount</td><td>{group.fixedDiscountPct ? `${Number(group.fixedDiscountPct)}%` : 'None (full chit value prize)'}</td></tr>
                )}
                {group.hasForemanTicket && <tr><td>Foreman ticket</td><td>Period-1 prize goes to the foreman ticket without auction</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>📋 Compliance</h3></div>
          <div className="table-wrapper">
            <table>
              <tbody>
                {complianceRows.map(([label, valueNode]) => (
                  <tr key={label}><td>{label}</td><td>{valueNode}</td></tr>
                ))}
                <tr><td>Status</td><td><span className={`badge badge-${group.complianceStatus === 'active' ? 'success' : 'secondary'}`}>{group.complianceStatus}</span></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Auctions */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header"><h3>🔨 {d.auctionHistory}</h3></div>
        {group.auctions.length === 0 ? (
          <p style={{ padding: '16px', color: 'var(--text-secondary)' }}>{group.status === 'draft' ? 'Auctions are generated when the group is activated.' : d.noAuctions}</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{d.period}</th>
                  <th>{d.date}</th>
                  <th>{d.winner}</th>
                  <th>{d.prize}</th>
                  <th>{d.dividend}</th>
                  <th>{d.status}</th>
                  <th>Payout</th>
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
                    <td><span className={`badge badge-${['confirmed', 'paid'].includes(a.status) ? 'success' : a.status === 'cancelled' ? 'danger' : a.status === 'in_progress' ? 'info' : 'warning'}`}>{a.status}</span></td>
                    <td>{a.winnerMemberId ? <span className={`badge badge-${a.payoutStatus === 'paid' ? 'success' : a.payoutStatus === 'ready' ? 'info' : 'warning'}`}>{a.payoutStatus}</span> : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link href={`/chits/${group.id}/auctions/${a.id}`} className="btn btn-ghost btn-sm">Manage</Link>
                      {isDrawType && !['confirmed', 'paid', 'cancelled'].includes(a.status) && group.status === 'active' && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ marginLeft: '4px' }}
                          disabled={busy === `draw-${a.id}`}
                          onClick={() => run(`draw-${a.id}`, () => drawAuctionWinner(a.id))}
                        >
                          {busy === `draw-${a.id}` ? 'Drawing…' : group.auctionType === 'lottery' ? 'Draw' : 'Resolve'}
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
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header"><h3>👥 {d.members}</h3></div>
        {group.members.length === 0 ? (
          <p style={{ padding: '16px', color: 'var(--text-secondary)' }}>{d.noMembers}</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>{d.customer}</th>
                  <th>Share</th>
                  <th>Agreement</th>
                  <th>Nominee</th>
                  <th>{d.status}</th>
                  <th>{d.won}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {group.members.map((m: any) => (
                  <tr key={m.id}>
                    <td>{m.ticketNo ?? m.memberNumber}{m.fractionNo ? `-${m.fractionNo}` : ''}{m.isForemanTicket ? ' ★' : ''}</td>
                    <td>
                      <Link href={`/customers/${m.customer.customerCode}`}>{m.customer.name}</Link>
                      <br /><span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{m.customer.customerCode}</span>
                    </td>
                    <td>{Number(m.ticketShare) === 1 ? 'Full' : Number(m.ticketShare)}</td>
                    <td>
                      {agreementBadge(m.agreementStatus)}
                      {m.agreementStatus === 'pending' && (
                        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => run(`sign-${m.id}`, () => markChitAgreementSigned(m.id))}>Sign</button>
                      )}
                      {m.agreementStatus === 'signed' && (
                        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => run(`verify-${m.id}`, () => verifyChitAgreement(m.id))}>Verify</button>
                      )}
                    </td>
                    <td>{m.nomineeName || <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                    <td><span className={`badge badge-${m.subscriberStatus === 'active' ? 'success' : 'secondary'}`}>{m.subscriberStatus}</span></td>
                    <td>{m.hasWon ? <span className="badge badge-success">{d.won} {formatDate(m.wonAt)}</span> : <span className="badge badge-secondary">{d.pending}</span>}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setMemberModal(m); setError(''); }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Subscription Payments */}
      <div className="card">
        <div className="card-header"><h3>💳 {d.memberPayments}</h3></div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{d.member}</th>
                <th>{d.period}</th>
                <th>{d.dueDate}</th>
                <th>{d.dueAmount}</th>
                <th>{d.dividend}</th>
                <th>{d.paid}</th>
                <th>Receipt</th>
                <th>{d.status}</th>
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
                    <td>{Number(s.dividendAmount) > 0 ? formatCurrency(Number(s.dividendAmount), currencySymbol) : '—'}</td>
                    <td>{formatCurrency(Number(s.paidAmount), currencySymbol)}</td>
                    <td style={{ fontSize: '.75rem' }}>{s.lastReceiptNo || '—'}</td>
                    <td><span className={`badge badge-${s.status === 'paid' ? 'success' : s.status === 'missed' ? 'danger' : s.status === 'partial' ? 'warning' : 'secondary'}`}>{s.status}</span></td>
                    <td style={{ display: 'flex', gap: '4px' }}>
                      {s.status !== 'paid' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setPaymentModal({ subscriptionId: s.id, memberId: m.id, periodNumber: s.periodNumber, dueAmount: s.dueAmount });
                            setPayAmount(Number(s.dueAmount) - Number(s.paidAmount));
                            setPayMode('cash');
                            setPayRef('');
                            setPayNotes('');
                            setError('');
                          }}
                        >
                          {d.recordPayment}
                        </button>
                      )}
                      {s.status !== 'paid' && s.status !== 'missed' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => run(`missed-${s.id}`, () => markPaymentMissed(s.id))}
                          disabled={!!busy}
                        >
                          Missed
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

      {/* Payment Modal */}
      {paymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '400px', padding: '24px' }}>
            <h3 style={{ marginBottom: '12px' }}>{d.recordPayment} — Period {paymentModal.periodNumber}
              <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)', fontWeight: 'normal', marginLeft: '8px' }}>
                Due: {formatCurrency(Number(paymentModal.dueAmount), currencySymbol)}
              </span>
            </h3>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '10px', fontSize: '.85rem' }}>{error}</p>}
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">{d.amountPaid} ({currencySymbol})</label>
              <input type="number" className="form-control" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} />
            </div>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Payment mode</label>
              <select className="form-control" value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank">Bank transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            {payMode !== 'cash' && (
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Reference no</label>
                <input type="text" className="form-control" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="UPI/txn reference" />
              </div>
            )}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Notes</label>
              <input type="text" className="form-control" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPaymentModal(null)}>{d.cancel}</button>
              <button className="btn btn-primary btn-sm" onClick={handleRecordPayment} disabled={loading || payAmount <= 0}>
                {loading ? d.saving : d.recordPayment}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Edit Modal */}
      {memberModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form className="card" style={{ width: '460px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }} onSubmit={handleSaveMember}>
            <h3 style={{ marginBottom: '12px' }}>Edit member — {memberModal.customer.name}</h3>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '10px', fontSize: '.85rem' }}>{error}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Ticket no</label>
                <input name="ticketNo" type="text" className="form-control" defaultValue={memberModal.ticketNo ?? ''} />
              </div>
              <div className="form-group">
                <label className="form-label">Fraction no</label>
                <input name="fractionNo" type="text" className="form-control" defaultValue={memberModal.fractionNo ?? ''} placeholder="e.g. A" />
              </div>
              <div className="form-group">
                <label className="form-label">Ticket share</label>
                <select name="ticketShare" className="form-control" defaultValue={String(Number(memberModal.ticketShare))}>
                  <option value="1">Full (1.00)</option>
                  <option value="0.5">Half (0.50)</option>
                  <option value="0.25">Quarter (0.25)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Subscriber status</label>
                <select name="subscriberStatus" className="form-control" defaultValue={memberModal.subscriberStatus}>
                  <option value="active">Active</option>
                  <option value="vacant">Vacant (company-held)</option>
                  <option value="defaulted">Defaulted</option>
                  <option value="substituted">Substituted</option>
                  <option value="removed">Removed</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Agreement status</label>
                <select name="agreementStatus" className="form-control" defaultValue={memberModal.agreementStatus}>
                  <option value="pending">Pending</option>
                  <option value="signed">Signed</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Introduced by</label>
                <input name="introducedBy" type="text" className="form-control" defaultValue={memberModal.introducedBy ?? ''} />
              </div>
              <div className="form-group">
                <label className="form-label">Nominee name</label>
                <input name="nomineeName" type="text" className="form-control" defaultValue={memberModal.nomineeName ?? ''} />
              </div>
              <div className="form-group">
                <label className="form-label">Nominee relation</label>
                <input name="nomineeRelation" type="text" className="form-control" defaultValue={memberModal.nomineeRelation ?? ''} />
              </div>
              <div className="form-group">
                <label className="form-label">Nominee phone</label>
                <input name="nomineePhone" type="tel" className="form-control" defaultValue={memberModal.nomineePhone ?? ''} />
              </div>
              {group.hasForemanTicket && (
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.85rem' }}>
                    <input name="isForemanTicket" type="checkbox" value="true" defaultChecked={memberModal.isForemanTicket} />
                    This is the foreman/company ticket
                  </label>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMemberModal(null)}>{d.cancel}</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>{loading ? d.saving : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
