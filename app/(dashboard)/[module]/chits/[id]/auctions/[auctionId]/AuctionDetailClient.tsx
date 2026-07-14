'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';
import {
  addAuctionBid,
  closeLiveRoom,
  confirmAuction,
  decideRoomAdmission,
  drawAuctionWinner,
  getLiveAuctionState,
  markAuctionAttendance,
  markAuctionNoticeSent,
  openLiveRoom,
  postRoomMessage,
  releasePrizePayout,
  retractLiveMemberBid,
  reviewChitSecurityDocument,
  ringLiveBell,
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
  useRegisterBreadcrumbLabel(group.id, group.name);
  useRegisterBreadcrumbLabel(auction.id, `Period ${auction.periodNumber}`);
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
  const [seatModal, setSeatModal] = useState<any>(null);
  const [payMode, setPayMode] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const [chatBody, setChatBody] = useState('');
  const [chatToOrganizer, setChatToOrganizer] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollFailCountRef = useRef(0);
  const [clockNow, setClockNow] = useState<Date | null>(null);
  const prevBellsRungRef = useRef(0);
  const [bellToast, setBellToast] = useState('');
  const bellToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bellPhrase = (n: number, count: number, ticketNo?: string | null) => {
    if (n >= count) return ticketNo ? `Sold to ticket #${ticketNo}!` : 'Sold!';
    if (n === count - 1) return 'Going twice!';
    return 'Going once!';
  };

  // Wall-clock corner display — client-only (null on first render) so SSR/CSR text never mismatches.
  useEffect(() => {
    setClockNow(new Date());
    const t = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const roomActive = (live?.roomStatus ?? auction.roomStatus) === 'open' || (live?.roomStatus ?? auction.roomStatus) === 'extended';

  // Poll the live room every 1.5s while it is (or may be) open. Countdown is
  // server-driven via secondsRemaining — never the device clock.
  useEffect(() => {
    if (!isLive || locked) return;
    const tick = async () => {
      try {
        const state = await getLiveAuctionState(auction.id);
        pollFailCountRef.current = 0;
        setLive(state);
        // Chime + toast when bellsRung increases since the last poll — compare
        // against the previous value so an unchanged count never re-chimes.
        const rung = state.bell?.bellsRung ?? 0;
        const count = state.bell?.bellCount ?? 0;
        if (rung > prevBellsRungRef.current && count > 0) {
          setBellToast(bellPhrase(rung, count, state.highestBid?.ticketNo));
          try {
            const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
              const ctx = new AudioCtx();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.frequency.value = 880;
              gain.gain.setValueAtTime(0.15, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
              osc.connect(gain).connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.4);
            }
          } catch { /* audio is a nicety, never block the room on it */ }
          if (bellToastTimerRef.current) clearTimeout(bellToastTimerRef.current);
          bellToastTimerRef.current = setTimeout(() => setBellToast(''), 3500);
        }
        prevBellsRungRef.current = rung;
        if (state.roomStatus === 'closed' && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          router.refresh();
        }
      } catch (e: any) {
        pollFailCountRef.current += 1;
        // Surface after 2 consecutive failures so a single transient blip doesn't flash an error.
        if (pollFailCountRef.current >= 2) {
          setError(`Live room poll failing: ${e?.message ?? 'unknown error'}`);
        }
      }
    };
    tick();
    pollRef.current = setInterval(tick, 1500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (bellToastTimerRef.current) clearTimeout(bellToastTimerRef.current);
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
  const quickStep = Number(group.bidIncrement || 1);
  const quickBase = Number(live?.minNextPrize ?? bidPrize);

  const presentCount = auction.attendance.filter((entry: any) => ['present', 'proxy'].includes(entry.status)).length;

  return (
    <>
      <div style={{ marginBottom: '16px' }}>
        <Link href={`/chits/${group.groupCode ?? group.id}`} className="btn btn-ghost btn-sm">
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          Back to {group.name}
        </Link>
      </div>

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
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>
                      ⏱ {Math.floor((live?.secondsRemaining ?? 0) / 60)}:{String((live?.secondsRemaining ?? 0) % 60).padStart(2, '0')}
                    </div>
                    <span className={`badge badge-${live?.roomStatus === 'extended' ? 'warning' : 'success'}`}>{live?.roomStatus}</span>
                    {live?.highestBid && !hideBidAmounts && (
                      <div style={{ fontWeight: 600, color: 'var(--success)' }}>
                        Highest: ticket #{live.highestBid.ticketNo} — discount {formatCurrency(live.highestBid.bidDiscount, currencySymbol)}
                      </div>
                    )}
                    {hideBidAmounts && <div>{live?.bidCount ?? 0} sealed bid(s) received</div>}
                    {live?.bell?.enabled && (
                      <span className="badge badge-secondary" title="Going once / going twice / sold">
                        🔔 {live.bell.bellsRung}/{live.bell.bellCount}
                        {live.bell.bellsRung >= live.bell.bellCount && !live.bell.autoClose ? ' — awaiting manual close' : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {live?.bell?.enabled && (live?.bell?.bellsRung ?? 0) < (live?.bell?.bellCount ?? 0) && (
                      <button className="btn btn-secondary btn-sm" disabled={busy === 'ring-bell'} onClick={() => run('ring-bell', () => ringLiveBell(auction.id))}>
                        {busy === 'ring-bell' ? 'Ringing…' : '🔔 Ring bell'}
                      </button>
                    )}
                    <button className="btn btn-danger btn-sm" disabled={busy === 'close-room'} onClick={() => run('close-room', () => closeLiveRoom(auction.id))}>
                      {busy === 'close-room' ? 'Closing…' : 'Close room now'}
                    </button>
                  </div>
                </div>

                {bellToast && (
                  <div
                    style={{
                      textAlign: 'center', padding: '10px 16px', marginBottom: '12px',
                      background: 'linear-gradient(135deg, #7c2d12, #b45309)', color: '#fff',
                      borderRadius: '10px', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.3px',
                    }}
                  >
                    🔔 {bellToast}
                  </div>
                )}

                {/* Poker Table Visual Room with Avatars & Green Dot */}
                <div style={{ position: 'relative', width: '100%', maxWidth: '1080px', aspectRatio: '2712 / 1536', borderRadius: '28px', overflow: 'hidden', border: '3px solid #334155', boxShadow: '0 24px 48px rgba(0,0,0,0.55)', margin: '28px auto 40px auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/assets/poker_table.avif)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'brightness(0.88) contrast(1.12)' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, rgba(15,23,42,0.35) 0%, rgba(15,23,42,0.7) 100%)' }} />

                  {/* Corner: live wall-clock date & time */}
                  {clockNow && (
                    <div style={{ position: 'absolute', top: '14px', left: '14px', zIndex: 10, padding: '6px 12px', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'left' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                        {clockNow.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                        {clockNow.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  )}

                  {/* Center Table Info Panel */}
                  <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '18px 32px', background: 'rgba(15, 23, 42, 0.82)', backdropFilter: 'blur(10px)', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 8px 32px rgba(0,0,0,0.45)', maxWidth: '300px' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#94a3b8', fontWeight: 700 }}>Chit Period {auction.periodNumber}</div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace', margin: '4px 0', textShadow: '0 0 12px rgba(56,189,248,0.5)' }}>
                      ⏱ {Math.floor((live?.secondsRemaining ?? 0) / 60)}:{String((live?.secondsRemaining ?? 0) % 60).padStart(2, '0')}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Chit Value: {formatCurrency(Number(group.chitValue), currencySymbol)}</div>
                    {live?.highestBid && (
                      <div style={{ fontSize: '0.8rem', color: '#22c55e', fontWeight: 700, marginTop: '2px' }}>
                        🏆 Ticket #{live.highestBid.ticketNo} · {formatCurrency(Number(group.chitValue) - live.highestBid.bidDiscount, currencySymbol)}
                      </div>
                    )}
                  </div>

                  {/* Arranged Seats cleanly spaced inside the felt oval */}
                  {group.members.map((m: any, idx: number) => {
                    const total = group.members.length || 1;
                    const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
                    const rx = 34;
                    const ry = 31;
                    const left = 50 + rx * Math.cos(angle);
                    const top = 50 + ry * Math.sin(angle);
                    const liveSeat = live?.seats?.find((s: any) => s.memberId === m.id);
                    const isOnline = attendanceOf(m.id) === 'present' || attendanceOf(m.id) === 'proxy' || (liveSeat && !liveSeat.passed && liveSeat.latestPrize !== null);
                    const photoUrl = liveSeat?.profilePhoto || m.customer?.profilePhoto || null;
                    const isLeader = live?.highestBid && live.highestBid.memberId === m.id;

                    return (
                      <div
                        key={m.id}
                        onClick={() => setSeatModal({ ...m, liveSeat })}
                        style={{
                          position: 'absolute',
                          left: `${left}%`,
                          top: `${top}%`,
                          transform: 'translate(-50%, -50%)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          cursor: 'pointer',
                          zIndex: 20,
                          transition: 'transform 0.2s',
                        }}
                        title={`${m.customer.name} (${isOnline ? 'Online' : 'Offline'})`}
                      >
                        {isLeader && (
                          <div style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginBottom: '8px',
                            padding: '4px 10px',
                            background: '#eab308',
                            color: '#1e293b',
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            borderRadius: '999px',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 4px 12px rgba(234,179,8,0.5)',
                            zIndex: 30,
                          }}>
                            {formatCurrency(Number(group.chitValue) - live.highestBid.bidDiscount, currencySymbol)}
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 0,
                              height: 0,
                              borderLeft: '5px solid transparent',
                              borderRight: '5px solid transparent',
                              borderTop: '5px solid #eab308',
                            }} />
                          </div>
                        )}
                        <div style={{
                          position: 'relative',
                          width: '54px',
                          height: '54px',
                          borderRadius: '50%',
                          border: isLeader ? '3px solid #eab308' : isOnline ? '2px solid #22c55e' : '2px solid rgba(255,255,255,0.3)',
                          backgroundColor: '#1e293b',
                          boxShadow: isLeader ? '0 0 15px rgba(234, 179, 8, 0.7)' : '0 4px 10px rgba(0,0,0,0.6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}>
                          {photoUrl ? (
                            <img src={photoUrl} alt={m.customer.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                              {m.customer?.name?.[0]?.toUpperCase() ?? 'M'}
                            </span>
                          )}
                          <div style={{
                            position: 'absolute',
                            bottom: '2px',
                            right: '2px',
                            width: '13px',
                            height: '13px',
                            borderRadius: '50%',
                            backgroundColor: isOnline ? '#22c55e' : '#64748b',
                            border: '2px solid #0f172a',
                            boxShadow: isOnline ? '0 0 6px #22c55e' : 'none',
                          }} />
                        </div>
                        <div style={{
                          marginTop: '4px',
                          padding: '2px 8px',
                          backgroundColor: 'rgba(15, 23, 42, 0.9)',
                          borderRadius: '12px',
                          border: '1px solid rgba(255,255,255,0.18)',
                          textAlign: 'center',
                          maxWidth: '96px',
                        }}>
                          <div style={{ fontSize: '0.68rem', color: '#f8fafc', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.ticketNo ?? m.memberNumber}. {m.customer?.name?.split(' ')[0]}
                          </div>
                          {liveSeat?.latestPrize && (
                            <div style={{ fontSize: '0.62rem', color: '#38bdf8', fontWeight: 700 }}>
                              {formatCurrency(liveSeat.latestPrize, currencySymbol)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {seatModal?.hasWon && (
                  <div className="alert alert-warning" style={{ marginBottom: '12px', padding: '8px 10px' }}>
                    {seatModal.customer.name} has already won and is viewing as a spectator.
                  </div>
                )}
                {!hideBidAmounts && ((live?.allBids?.length ?? live?.bids?.length ?? 0) > 0) && (
                  <div className="table-wrapper" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    <table>
                      <thead><tr><th>Time</th><th>Ticket</th><th>Member</th><th>Discount</th><th>Source</th></tr></thead>
                      <tbody>
                        {(live.allBids ?? live.bids).map((b: any) => (
                          <tr key={b.id}>
                            <td>{new Date(b.bidTime ?? b.createdAt).toLocaleTimeString()}</td>
                            <td>{b.ticketNo}</td>
                            <td>{b.memberName}</td>
                            <td>{formatCurrency(b.bidDiscount ?? b.discountAmount, currencySymbol)}</td>
                            <td>{b.source ?? 'tap'}</td>
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

      {/* Waiting room + live chat (M2) */}
      {isLive && !locked && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header"><h3>💬 Room chat{(live?.waiting?.length ?? 0) > 0 ? ` · ${live.waiting.length} waiting` : ''}</h3></div>
          <div style={{ padding: '16px' }}>
            {(live?.waiting?.length ?? 0) > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontWeight: 600, marginBottom: '6px' }}>Waiting room</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {live.waiting.map((w: any) => (
                    <div key={w.memberId} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ flex: 1 }}>{w.name}</span>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={busy === `admit-${w.memberId}`}
                        onClick={() => run(`admit-${w.memberId}`, () => decideRoomAdmission(auction.id, w.memberId, 'admit'))}
                      >
                        Admit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={busy === `deny-${w.memberId}`}
                        onClick={() => run(`deny-${w.memberId}`, () => decideRoomAdmission(auction.id, w.memberId, 'deny'))}
                      >
                        Deny
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
              {(live?.latestMessages ?? []).length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No messages yet.</p>
              ) : (
                live.latestMessages.map((m: any) => (
                  <div key={m.id} style={{ fontSize: '.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{new Date(m.createdAt).toLocaleTimeString()}</span>{' '}
                    <strong>{m.senderName}</strong>
                    {m.visibility === 'organizer' && <span className="badge badge-warning" style={{ marginLeft: '6px' }}>private</span>}
                    <span style={{ marginLeft: '6px' }}>{m.body}</span>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Message the room…"
                value={chatBody}
                maxLength={500}
                style={{ flex: 1, minWidth: '220px' }}
                onChange={(e) => setChatBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && chatBody.trim() && busy !== 'chat') {
                    run('chat', async () => {
                      await postRoomMessage(auction.id, chatBody, chatToOrganizer ? 'organizer' : 'public');
                      setChatBody('');
                    });
                  }
                }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.8rem' }}>
                <input type="checkbox" checked={chatToOrganizer} onChange={(e) => setChatToOrganizer(e.target.checked)} />
                Organizer-only
              </label>
              <button
                className="btn btn-primary btn-sm"
                disabled={busy === 'chat' || !chatBody.trim()}
                onClick={() => run('chat', async () => {
                  await postRoomMessage(auction.id, chatBody, chatToOrganizer ? 'organizer' : 'public');
                  setChatBody('');
                })}
              >
                {busy === 'chat' ? 'Sending…' : 'Send'}
              </button>
            </div>
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
                {isLive && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', paddingBottom: '10px', flexWrap: 'wrap' }}>
                    {[
                      ['Min', quickBase],
                      ['+1', quickBase - quickStep],
                      ['+2', quickBase - quickStep * 2],
                      ['+5', quickBase - quickStep * 5],
                    ].map(([label, amount]) => (
                      <button
                        key={label}
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setBidPrize(Math.max(1, Number(amount)))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
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
      {seatModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '420px', maxWidth: 'calc(100vw - 24px)', padding: '18px' }}>
            <h3 style={{ margin: '0 0 10px' }}>{seatModal.ticketNo ?? seatModal.memberNumber}. {seatModal.customer.name}</h3>
            <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '.84rem' }}>
              {seatModal.hasWon ? 'Spectator' : 'Active bidder'} · latest prize {seatModal.liveSeat?.latestPrize ? formatCurrency(seatModal.liveSeat.latestPrize, currencySymbol) : '—'}
            </p>
            <div className="table-wrapper" style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '12px' }}>
              <table>
                <thead><tr><th>Time</th><th>Prize</th><th>Source</th></tr></thead>
                <tbody>
                  {(live?.memberBids?.[seatModal.id] ?? []).map((b: any) => (
                    <tr key={b.id}>
                      <td>{new Date(b.bidTime ?? b.createdAt).toLocaleTimeString()}</td>
                      <td>{formatCurrency(b.bidAmount ?? b.prizeAmount, currencySymbol)}</td>
                      <td>{b.source ?? 'tap'}</td>
                    </tr>
                  ))}
                  {(live?.memberBids?.[seatModal.id] ?? []).length === 0 && (
                    <tr><td colSpan={3} style={{ color: 'var(--text-secondary)' }}>No live bids yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSeatModal(null)}>Close</button>
              {!seatModal.hasWon && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={busy === 'retract-member'}
                  onClick={() => run('retract-member', async () => {
                    await retractLiveMemberBid(auction.id, seatModal.id);
                    setSeatModal(null);
                  })}
                >
                  Retract last
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
