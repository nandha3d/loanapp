'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  addAuctionBid,
  closeLiveRoom,
  confirmAuction,
  drawAuctionWinner,
  getLiveAuctionState,
  markAuctionAttendance,
  markAuctionNoticeSent,
  openLiveRoom,
  releasePrizePayout,
  reviewChitSecurityDocument,
  submitChitSecurity,
} from '../../../actions';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useRegisterBreadcrumbLabel } from '@/components/layout/BreadcrumbLabelContext';

interface Props {
  auction: any;
  security: any | null;
  securityDocuments: any[];
  currencySymbol: string;
  dict: any;
}

const securityDocumentLabels: Record<string, string> = {
  guarantor_photo: 'Guarantor photo',
  guarantor_kyc: 'Guarantor KYC',
  security_cheque: 'Security cheque',
};

export default function AuctionDetailClient({ auction, security, securityDocuments, currencySymbol, dict }: Props) {
  const d = dict.chits;
  const router = useRouter();
  const group = auction.chitGroup;
  useRegisterBreadcrumbLabel(group.groupCode ?? group.id, group.name);
  const isDrawType = ['lottery', 'fixed_rotation'].includes(group.auctionType);
  const isLive = group.auctionType === 'open_live';
  const isSealed = group.auctionType === 'sealed';
  const locked = ['confirmed', 'paid', 'cancelled'].includes(auction.status);

  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [bidMemberId, setBidMemberId] = useState('');
  const [bidPrize, setBidPrize] = useState<number>(Number(group.chitValue));
  const [minutes, setMinutes] = useState('');
  const [roomMinutes, setRoomMinutes] = useState(30);
  const [antiSnipe, setAntiSnipe] = useState(60);
  const [live, setLive] = useState<any>(null);
  const [payMode, setPayMode] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const roomActive = (live?.roomStatus ?? auction.roomStatus) === 'open' || (live?.roomStatus ?? auction.roomStatus) === 'extended';

  // Poll the live room every 2.5s while it is (or may be) open. Countdown is
  // server-driven via secondsRemaining — never the device clock.
  useEffect(() => {
    if (!isLive || locked) return;
    const tick = async () => {
      try {
        const state = await getLiveAuctionState(auction.id);
        setLive(state);
        if (state.roomStatus === 'closed' && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          router.refresh();
        }
      } catch {
        /* transient poll failure — next tick retries */
      }
    };
    tick();
    pollRef.current = setInterval(tick, 2500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, locked, auction.id, auction.roomStatus]);

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

  const attendanceOf = (memberId: string) =>
    auction.attendance.find((entry: any) => entry.memberId === memberId)?.status ?? null;

  const eligibleBidders = group.members.filter((m: any) => !m.hasWon && m.subscriberStatus === 'active');
  const bidDiscountPreview = Number(group.chitValue) - bidPrize;
  const validBids = auction.bids.filter((b: any) => ['valid', 'winning'].includes(b.status));
  const hideBidAmounts = isSealed && !locked && (live?.roomStatus ?? auction.roomStatus) !== 'closed';

  const presentCount = auction.attendance.filter((entry: any) => ['present', 'proxy'].includes(entry.status)).length;

  return (
    <>
      {error && <div className="alert alert-danger" style={{ marginBottom: '16px', padding: '10px 14px', background: '#fff0f0', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', color: 'var(--danger)' }}>{error}</div>}

      {/* Summary */}
      <div className="kpi-grid" style={{ marginBottom: '20px' }}>
        <div className="kpi-card">
          <div className="kpi-icon green"><span className="material-icons-outlined">savings</span></div>
          <div><div className="kpi-value">{formatCurrency(Number(group.chitValue), currencySymbol)}</div><div className="kpi-label">{d.chitValue}</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon blue"><span className="material-icons-outlined">event</span></div>
          <div><div className="kpi-value">{formatDate(auction.auctionDate)}</div><div className="kpi-label">Auction date</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange"><span className="material-icons-outlined">how_to_reg</span></div>
          <div><div className="kpi-value">{presentCount}/{group.members.length}</div><div className="kpi-label">Attendance</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon purple"><span className="material-icons-outlined">flag</span></div>
          <div><div className="kpi-value" style={{ fontSize: '1rem' }}>{auction.status}</div><div className="kpi-label">Status · payout {auction.payoutStatus}</div></div>
        </div>
      </div>

      {!locked && auction.status === 'pending' && auction.noticeStatus !== 'sent' && (
        <div style={{ marginBottom: '16px' }}>
          <button className="btn btn-secondary btn-sm" disabled={busy === 'notice'} onClick={() => run('notice', () => markAuctionNoticeSent(auction.id))}>
            {busy === 'notice' ? 'Marking…' : 'Mark auction notice sent'}
          </button>
        </div>
      )}

      {/* Live room */}
      {isLive && !locked && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header"><h3>📡 Live bidding room</h3></div>
          <div style={{ padding: '16px' }}>
            {!roomActive ? (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group">
                  <label className="form-label">Duration (minutes)</label>
                  <input type="number" className="form-control" value={roomMinutes} min={1} onChange={(e) => setRoomMinutes(Number(e.target.value))} style={{ width: '140px' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Anti-snipe extend (seconds)</label>
                  <input type="number" className="form-control" value={antiSnipe} min={0} onChange={(e) => setAntiSnipe(Number(e.target.value))} style={{ width: '160px' }} />
                </div>
                <button className="btn btn-primary" disabled={busy === 'open-room'} onClick={() => run('open-room', () => openLiveRoom(auction.id, roomMinutes, antiSnipe))}>
                  {busy === 'open-room' ? 'Opening…' : 'Open bidding room'}
                </button>
                {(live?.roomStatus === 'closed' || auction.roomStatus === 'closed') && (
                  <span className="badge badge-secondary">Room closed — pick the winner below and confirm</span>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>
                    ⏱ {Math.floor((live?.secondsRemaining ?? 0) / 60)}:{String((live?.secondsRemaining ?? 0) % 60).padStart(2, '0')}
                  </div>
                  <span className={`badge badge-${live?.roomStatus === 'extended' ? 'warning' : 'success'}`}>{live?.roomStatus}</span>
                  {live?.highestBid && !hideBidAmounts && (
                    <div>
                      Highest: ticket {live.highestBid.ticketNo} — discount {formatCurrency(live.highestBid.bidDiscount, currencySymbol)}
                    </div>
                  )}
                  {hideBidAmounts && <div>{live?.bidCount ?? 0} sealed bid(s) received</div>}
                  <button className="btn btn-danger btn-sm" disabled={busy === 'close-room'} onClick={() => run('close-room', () => closeLiveRoom(auction.id))}>
                    {busy === 'close-room' ? 'Closing…' : 'Close room now'}
                  </button>
                </div>
                {!hideBidAmounts && (live?.bids?.length ?? 0) > 0 && (
                  <div className="table-wrapper" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    <table>
                      <thead><tr><th>Time</th><th>Ticket</th><th>Member</th><th>Discount</th></tr></thead>
                      <tbody>
                        {live.bids.map((b: any) => (
                          <tr key={b.id}>
                            <td>{new Date(b.bidTime).toLocaleTimeString()}</td>
                            <td>{b.ticketNo}</td>
                            <td>{b.memberName}</td>
                            <td>{formatCurrency(b.bidDiscount, currencySymbol)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid-60-40">
        <div>
          {/* Bid entry + history */}
          {!isDrawType && !locked && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header"><h3>🔨 Add bid</h3></div>
              <div style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ minWidth: '220px' }}>
                  <label className="form-label">Member</label>
                  <select className="form-control" value={bidMemberId} onChange={(e) => setBidMemberId(e.target.value)}>
                    <option value="">{d.selectMember}</option>
                    {eligibleBidders.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.ticketNo ?? m.memberNumber}. {m.customer.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{d.prizeAmount} ({currencySymbol})</label>
                  <input type="number" className="form-control" value={bidPrize} onChange={(e) => setBidPrize(Number(e.target.value))} max={Number(group.chitValue)} style={{ width: '160px' }} />
                </div>
                <div style={{ paddingBottom: '10px', fontSize: '.8rem', color: 'var(--text-secondary)' }}>
                  Discount: {formatCurrency(bidDiscountPreview, currencySymbol)}
                </div>
                <button
                  className="btn btn-primary"
                  disabled={busy === 'bid' || !bidMemberId || bidPrize <= 0}
                  onClick={() => run('bid', async () => { await addAuctionBid(auction.id, bidMemberId, bidPrize); setBidMemberId(''); })}
                >
                  {busy === 'bid' ? 'Saving…' : 'Add bid'}
                </button>
              </div>
              {isSealed && <p style={{ padding: '0 16px 12px', fontSize: '.78rem', color: 'var(--text-secondary)' }}>Sealed tender: recorded amounts stay hidden from the bid list until the auction is decided.</p>}
            </div>
          )}

          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header"><h3>📜 Bid history ({auction.bids.length})</h3></div>
            {auction.bids.length === 0 ? (
              <p style={{ padding: '16px', color: 'var(--text-secondary)' }}>{isDrawType ? 'Draw-based chit — use the draw to resolve this period.' : 'No bids yet.'}</p>
            ) : hideBidAmounts ? (
              <p style={{ padding: '16px', color: 'var(--text-secondary)' }}>{auction.bids.length} sealed bid(s) received — amounts hidden until close.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Time</th><th>Ticket</th><th>Member</th><th>{d.prize}</th><th>Discount</th><th>{d.status}</th>{!locked && <th></th>}</tr>
                  </thead>
                  <tbody>
                    {auction.bids.map((b: any) => (
                      <tr key={b.id} style={b.status === 'winning' ? { background: 'rgba(46, 204, 113, .08)' } : undefined}>
                        <td>{new Date(b.bidTime).toLocaleString()}</td>
                        <td>{b.member.ticketNo ?? b.member.memberNumber}</td>
                        <td>{b.member.customer.name}</td>
                        <td>{formatCurrency(Number(b.bidAmount), currencySymbol)}</td>
                        <td>{formatCurrency(Number(b.bidDiscount), currencySymbol)}</td>
                        <td><span className={`badge badge-${b.status === 'winning' ? 'success' : b.status === 'valid' ? 'info' : 'secondary'}`}>{b.status}</span></td>
                        {!locked && (
                          <td>
                            {b.status === 'valid' && (
                              <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => run(`confirm-${b.id}`, () => confirmAuction(auction.id, b.id, minutes || null))}>
                                Select winner
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Confirm / draw */}
          {!locked && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header"><h3>✅ Decide period</h3></div>
              <div style={{ padding: '16px' }}>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Minutes (optional override — auto-generated when empty)</label>
                  <textarea className="form-control" rows={3} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
                </div>
                {isDrawType ? (
                  <button className="btn btn-primary" disabled={busy === 'draw'} onClick={() => run('draw', () => drawAuctionWinner(auction.id))}>
                    {busy === 'draw' ? 'Drawing…' : group.auctionType === 'lottery' ? '🎲 Draw winner' : 'Resolve next in rotation'}
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    disabled={busy === 'confirm' || validBids.length === 0 || roomActive}
                    onClick={() => run('confirm', () => confirmAuction(auction.id, null, minutes || null))}
                    title={roomActive ? 'Close the bidding room first' : undefined}
                  >
                    {busy === 'confirm' ? 'Confirming…' : `Confirm highest bid${group.tieBreakRule === 'LOTTERY_AMONG_TIED' ? ' (cap tie → lottery)' : ''}`}
                  </button>
                )}
                <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Confirming never releases money — the prize stays locked until security is approved.
                </p>
              </div>
            </div>
          )}

          {auction.minutesText && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header"><h3>📝 Minutes</h3></div>
              <pre style={{ padding: '16px', whiteSpace: 'pre-wrap', fontSize: '.82rem', margin: 0 }}>{auction.minutesText}</pre>
            </div>
          )}
        </div>

        <div>
          {/* Attendance */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header"><h3>🙋 Attendance</h3></div>
            <div className="table-wrapper" style={{ maxHeight: '340px', overflowY: 'auto' }}>
              <table>
                <thead><tr><th>Ticket</th><th>{d.member}</th><th>{d.status}</th></tr></thead>
                <tbody>
                  {group.members.map((m: any) => {
                    const status = attendanceOf(m.id);
                    return (
                      <tr key={m.id}>
                        <td>{m.ticketNo ?? m.memberNumber}</td>
                        <td>{m.customer.name}</td>
                        <td>
                          {locked ? (
                            <span className={`badge badge-${status === 'present' ? 'success' : status === 'proxy' ? 'info' : 'secondary'}`}>{status ?? '—'}</span>
                          ) : (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {['present', 'absent', 'proxy'].map((option) => (
                                <button
                                  key={option}
                                  className={`btn btn-sm ${status === option ? 'btn-primary' : 'btn-ghost'}`}
                                  disabled={!!busy}
                                  onClick={() => {
                                    const proxyName = option === 'proxy' ? prompt('Proxy name?') : null;
                                    if (option === 'proxy' && !proxyName) return;
                                    run(`att-${m.id}`, () => markAuctionAttendance(auction.id, m.id, option, proxyName));
                                  }}
                                >
                                  {option === 'present' ? 'P' : option === 'absent' ? 'A' : 'Proxy'}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Winner + security + payout */}
          {auction.winnerMemberId && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header"><h3>🏆 Prize &amp; security</h3></div>
              <div style={{ padding: '16px' }}>
                <p style={{ margin: '0 0 8px' }}>
                  Winner: <strong>{auction.winnerMember?.customer?.name}</strong> — prize {formatCurrency(Number(auction.prizeAmount), currencySymbol)}
                </p>
                <p style={{ margin: '0 0 12px', fontSize: '.82rem', color: 'var(--text-secondary)' }}>
                  Commission {formatCurrency(Number(auction.commission ?? 0), currencySymbol)}
                  {Number(auction.gstAmount) > 0 && ` · GST ${formatCurrency(Number(auction.gstAmount), currencySymbol)}`}
                  {' · '}Dividend/ticket {formatCurrency(Number(auction.dividend ?? 0), currencySymbol)}
                  {Number(auction.roundingIncome) > 0 && ` · rounding income ${formatCurrency(Number(auction.roundingIncome), currencySymbol)}`}
                </p>
                <p style={{ margin: '0 0 12px' }}>
                  Security: <span className={`badge badge-${security?.status === 'approved' ? 'success' : security?.status === 'rejected' ? 'danger' : 'warning'}`}>{security?.status ?? 'pending'}</span>
                  {' '}· Payout: <span className={`badge badge-${auction.payoutStatus === 'paid' ? 'success' : auction.payoutStatus === 'ready' ? 'info' : 'warning'}`}>{auction.payoutStatus}</span>
                </p>

                {securityDocuments.length > 0 && (
                  <div style={{ marginBottom: '14px', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Document</th>
                          <th>File</th>
                          <th>Status</th>
                          <th>Review</th>
                        </tr>
                      </thead>
                      <tbody>
                        {securityDocuments.map((doc) => (
                          <tr key={doc.id}>
                            <td>{securityDocumentLabels[doc.documentType] ?? doc.documentType}</td>
                            <td>
                              <a href={doc.fileUrl} target="_blank" rel="noreferrer">{doc.fileName}</a>
                              <div style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{doc.mimeType ?? 'file'}</div>
                            </td>
                            <td>
                              <span className={`badge badge-${doc.status === 'approved' || doc.status === 'verified' ? 'success' : doc.status === 'rejected' ? 'danger' : 'warning'}`}>
                                {doc.status}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  disabled={!!busy}
                                  onClick={() => run(`doc-${doc.id}-verify`, () => reviewChitSecurityDocument(auction.id, doc.id, 'verify'))}
                                >
                                  Verify
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  disabled={!!busy}
                                  onClick={() => run(`doc-${doc.id}-approve`, () => reviewChitSecurityDocument(auction.id, doc.id, 'approve'))}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  disabled={!!busy}
                                  onClick={() => run(`doc-${doc.id}-reject`, () => reviewChitSecurityDocument(auction.id, doc.id, 'reject'))}
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {security?.status === 'approved' && auction.payoutStatus !== 'paid' && (
                  <form
                    style={{ marginBottom: '14px', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      fd.set('action', 'documents');
                      run('security-documents', () => submitChitSecurity(auction.id, fd));
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div className="form-group">
                        <label className="form-label">Guarantor photo</label>
                        <input name="guarantorPhoto" type="file" accept="image/*" className="form-control" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Guarantor KYC</label>
                        <input name="guarantorKyc" type="file" accept="image/*,.pdf" className="form-control" />
                      </div>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Security cheque image</label>
                        <input name="securityCheque" type="file" accept="image/*,.pdf" className="form-control" />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-secondary btn-sm" disabled={!!busy}>Upload documents</button>
                  </form>
                )}

                {auction.payoutStatus !== 'paid' && (
                  <>
                    {security?.status !== 'approved' && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          run('security', () => submitChitSecurity(auction.id, fd));
                        }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                          <div className="form-group">
                            <label className="form-label">Security type</label>
                            <select name="securityType" className="form-control" defaultValue={security?.securityType ?? 'guarantor'}>
                              <option value="guarantor">Guarantor</option>
                              <option value="property">Property</option>
                              <option value="gold">Gold</option>
                              <option value="fd">Fixed deposit</option>
                              <option value="salary">Salary</option>
                              <option value="cheque">Cheque</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Value ({currencySymbol})</label>
                            <input name="securityValue" type="number" className="form-control" defaultValue={security?.securityValue ? Number(security.securityValue) : ''} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Guarantor name</label>
                            <input name="guarantorName" type="text" className="form-control" defaultValue={security?.guarantorName ?? ''} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Guarantor phone</label>
                            <input name="guarantorPhone" type="tel" className="form-control" defaultValue={security?.guarantorPhone ?? ''} />
                          </div>
                          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label className="form-label">Details</label>
                            <input name="details" type="text" className="form-control" defaultValue={security?.details ?? ''} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Guarantor photo</label>
                            <input name="guarantorPhoto" type="file" accept="image/*" className="form-control" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Guarantor KYC</label>
                            <input name="guarantorKyc" type="file" accept="image/*,.pdf" className="form-control" />
                          </div>
                          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label className="form-label">Security cheque image</label>
                            <input name="securityCheque" type="file" accept="image/*,.pdf" className="form-control" />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button type="submit" name="action" value="submit" className="btn btn-secondary btn-sm" disabled={!!busy}>Submit</button>
                          <button type="submit" name="action" value="verify" className="btn btn-secondary btn-sm" disabled={!!busy || !security}>Verify</button>
                          <button type="submit" name="action" value="approve" className="btn btn-primary btn-sm" disabled={!!busy || !security}>Approve</button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            disabled={!!busy || !security}
                            onClick={() => {
                              const reason = prompt('Rejection reason?');
                              if (!reason) return;
                              const fd = new FormData();
                              fd.set('action', 'reject');
                              fd.set('rejectionReason', reason);
                              run('security', () => submitChitSecurity(auction.id, fd));
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      </form>
                    )}

                    {security?.status === 'approved' && auction.payoutStatus === 'ready' && (
                      <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <div className="form-group">
                            <label className="form-label">Payout mode</label>
                            <select className="form-control" value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                              <option value="cash">Cash</option>
                              <option value="upi">UPI</option>
                              <option value="bank">Bank transfer</option>
                              <option value="cheque">Cheque</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Reference no</label>
                            <input type="text" className="form-control" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
                          </div>
                          <button
                            className="btn btn-primary"
                            disabled={busy === 'payout'}
                            onClick={() => {
                              const fd = new FormData();
                              fd.set('paymentMode', payMode);
                              if (payRef) fd.set('referenceNo', payRef);
                              run('payout', () => releasePrizePayout(auction.id, fd));
                            }}
                          >
                            {busy === 'payout' ? 'Releasing…' : `Release ${formatCurrency(Number(auction.prizeAmount), currencySymbol)}`}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {auction.payoutStatus === 'paid' && <p style={{ margin: 0, color: 'var(--success)' }}>Prize payout released.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
