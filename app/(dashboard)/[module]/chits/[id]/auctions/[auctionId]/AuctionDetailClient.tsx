'use client';

import { compressFormDataImages } from '@/lib/imageCompression';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';
import {
  addAuctionBid,
  closeLiveRoom,
  confirmAuction,
  decideRoomAdmission,
  drawAuctionWinner,
  getAuctionTimeline,
  getAuctionWinnerSummary,
  getLiveAuctionState,
  markAuctionAttendance,
  markAuctionNoticeSent,
  openLiveRoom,
  postRoomMessage,
  postRoomVoiceMessage,
  releasePrizePayout,
  retractLiveMemberBid,
  reviewChitSecurityDocument,
  ringLiveBell,
  submitChitSecurity,
} from '../../../actions';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useRegisterBreadcrumbLabel } from '@/components/layout/BreadcrumbLabelContext';
import DividendBreakdown from '@/components/chits/DividendBreakdown';
import AuctionAutomatedBidBox from '@/components/chits/AuctionAutomatedBidBox';
import AuctionRoomChatBox from '@/components/chits/AuctionRoomChatBox';
import type { AutomatedBidBounds } from '@/lib/chits/validation';
import {
  isBiddingEnabledForPeriod,
  parseChitEngineConfig,
  resolveEngineTypeFromGroup,
} from '@/lib/chits/engineTypes';

interface Props {
  auction: any;
  security: any | null;
  securityDocuments: any[];
  initialMessages?: any[];
  initialBidBounds: AutomatedBidBounds;
  currencySymbol: string;
  dict: any;
}

const securityDocumentLabels: Record<string, string> = {
  guarantor_photo: 'Guarantor photo',
  guarantor_kyc: 'Guarantor KYC',
  security_cheque: 'Security cheque',
};

function timelineIcon(entry: any): string {
  if (entry.kind === 'message') return '💬';
  if (entry.kind === 'bid') return entry.bidStatus === 'retracted' ? '↩' : '💰';
  switch (entry.type) {
    case 'bell': return '🔔';
    case 'open': case 'close': return '🚪';
    case 'extend': return '⏱';
    case 'pass': return '↩';
    case 'winner': return '🏆';
    default: return '•';
  }
}

function timelineText(entry: any, currencySymbol: string): string {
  const who = entry.actorName ? ` — ${entry.actorName}` : '';
  if (entry.kind === 'message') {
    return `${entry.senderName ?? 'Member'}${entry.visibility === 'organizer' ? ' (private)' : ''}: ${entry.body ?? ''}`;
  }
  if (entry.kind === 'bid') {
    if (entry.bidAmount == null) return `${entry.memberName ?? 'Member'} bid a sealed amount`;
    const prefix = entry.bidStatus === 'retracted' ? 'Bid retracted' : 'Bid';
    return `${entry.memberName ?? 'Member'} — ${prefix} ${currencySymbol}${Number(entry.bidAmount).toLocaleString('en-IN')} (discount ${currencySymbol}${Number(entry.bidDiscount ?? 0).toLocaleString('en-IN')})`;
  }
  // event
  return `${entry.message ?? entry.type}${who}`;
}

export default function AuctionDetailClient({
  auction,
  security,
  securityDocuments,
  initialMessages = [],
  initialBidBounds,
  currencySymbol,
  dict,
}: Props) {
  const d = dict.chits;
  const router = useRouter();
  const group = auction.chitGroup;
  useRegisterBreadcrumbLabel(group.groupCode ?? group.id, group.name);
  useRegisterBreadcrumbLabel(group.id, group.name);
  useRegisterBreadcrumbLabel(auction.id, `Period ${auction.periodNumber}`);
  const engineType = resolveEngineTypeFromGroup(group);
  const engineCfg = parseChitEngineConfig(group.engineConfig, engineType);
  const biddingAllowed = isBiddingEnabledForPeriod(group, auction.periodNumber);
  const isDrawType = !biddingAllowed;
  const isReservePrice = engineType === 'AUCTION_RESERVE_PRICE';
  const isMultiDivision = engineType === 'AUCTION_MULTI_DIVISION';
  const isConsensus = engineType === 'NEED_BASED_CONSENSUS';
  const isLive = group.auctionType === 'open_live' && biddingAllowed;
  const isSealed = group.auctionType === 'sealed';
  const locked = ['confirmed', 'paid', 'cancelled'].includes(auction.status);

  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [bidMemberId, setBidMemberId] = useState('');
  const [bidPrize, setBidPrize] = useState<number>(initialBidBounds.nextValidPrize);
  const [showTableCanvas, setShowTableCanvas] = useState(false);
  const [consensusMemberId, setConsensusMemberId] = useState('');
  const [consensusReason, setConsensusReason] = useState('');
  const [minutes, setMinutes] = useState('');
  const [roomMinutes, setRoomMinutes] = useState(30);
  const [antiSnipe, setAntiSnipe] = useState(60);
  const [live, setLive] = useState<any>(null);
  const [seatModal, setSeatModal] = useState<any>(null);
  const [payMode, setPayMode] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollFailCountRef = useRef(0);
  const [clockNow, setClockNow] = useState<Date | null>(null);
  const prevBellsRungRef = useRef(0);
  const [bellToast, setBellToast] = useState('');
  const bellToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [timeline, setTimeline] = useState<any>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const timelinePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [winnerSummary, setWinnerSummary] = useState<any>(null);
  const activeBidBounds: AutomatedBidBounds = live?.bidBounds ?? initialBidBounds;

  // Keep automated bid input synced cleanly to valid monotonic ceiling whenever bounds tighten
  useEffect(() => {
    setBidPrize((prev) => {
      if (!Number.isFinite(prev) || prev > activeBidBounds.nextValidPrize || prev < activeBidBounds.minPrize) {
        return activeBidBounds.nextValidPrize;
      }
      return prev;
    });
  }, [activeBidBounds.nextValidPrize, activeBidBounds.minPrize]);

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

  // Poll the room every 2s when live (or slower in manual/chat mode) so messages
  // and server countdown stay synced for all members.
  useEffect(() => {
    if (locked) return;
    if (!isLive && !biddingAllowed) return;
    const tick = async () => {
      try {
        const state = await getLiveAuctionState(auction.id);
        pollFailCountRef.current = 0;
        setLive(state);
        if (isLive) {
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
        }
      } catch (e: any) {
        pollFailCountRef.current += 1;
        if (pollFailCountRef.current >= 2) {
          setError(`Live room sync failing: ${e?.message ?? 'unknown error'}`);
        }
      }
    };
    tick();
    pollRef.current = setInterval(tick, isLive ? 1500 : 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (bellToastTimerRef.current) clearTimeout(bellToastTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, biddingAllowed, locked, auction.id, auction.roomStatus]);

  // Auction activity feed stays visible in the Right Container — load immediately
  // and refresh every 6s so events, bells, and bids appear live on the right.
  const fetchTimeline = async () => {
    setTimelineLoading(true);
    try {
      const data = await getAuctionTimeline(auction.id);
      setTimeline(data);
    } catch {
      // transient — next interval tick retries
    }
    setTimelineLoading(false);
  };

  useEffect(() => {
    fetchTimeline();
    timelinePollRef.current = setInterval(fetchTimeline, 6000);
    return () => {
      if (timelinePollRef.current) clearInterval(timelinePollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auction.id]);

  // Winner summary is static once confirmed — fetch once, no polling.
  useEffect(() => {
    if (!auction.winnerMemberId) return;
    getAuctionWinnerSummary(auction.id).then(setWinnerSummary).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auction.id, auction.winnerMemberId]);

  const copyWinnerSummary = () => {
    if (!winnerSummary) return;
    const lines = [
      `${winnerSummary.groupName} — Period ${winnerSummary.periodNumber} Auction Result`,
      `Winner: ${winnerSummary.winnerName ?? '—'} (Ticket ${winnerSummary.winnerTicketNo ?? '—'})`,
      `Prize: ${formatCurrency(winnerSummary.prizeAmount, currencySymbol)}`,
      `Bid discount: ${formatCurrency(winnerSummary.bidDiscount, currencySymbol)}`,
      `Commission: ${formatCurrency(winnerSummary.commission, currencySymbol)}`,
      ...(winnerSummary.gstAmount > 0 ? [`GST: ${formatCurrency(winnerSummary.gstAmount, currencySymbol)}`] : []),
      `Dividend per ticket: ${formatCurrency(winnerSummary.dividend, currencySymbol)}`,
      ...(winnerSummary.receiptNo ? [`Dividend receipt: ${winnerSummary.receiptNo}`] : []),
    ];
    navigator.clipboard?.writeText(lines.join('\n'));
  };

  const run = async (label: string, fn: () => Promise<any>) => {
    setBusy(label);
    setError('');
    try {
      const res = await fn();
      if (res && typeof res === 'object' && 'ok' in res && res.ok === false) {
        setError(res.error || 'Action failed');
        setBusy('');
        return false;
      }
      router.refresh();
      // Refresh timeline + live state immediately after any mutation
      fetchTimeline();
      if (!locked) {
        getLiveAuctionState(auction.id).then(setLive).catch(() => {});
      }
      setBusy('');
      return true;
    } catch (e: any) {
      setError(e?.message || 'Action failed');
      setBusy('');
      return false;
    }
  };

  const attendanceOf = (memberId: string) =>
    auction.attendance.find((entry: any) => entry.memberId === memberId)?.status ?? null;
  const attendanceEntryOf = (memberId: string) =>
    auction.attendance.find((entry: any) => entry.memberId === memberId) ?? null;
  const viaLabel = (via?: string | null, admissionStatus?: string | null) => {
    if (via === 'room_join') return admissionStatus === 'none' ? 'via login' : 'via room';
    if (via === 'login') return 'via login';
    if (via === 'whatsapp') return 'via WhatsApp';
    return 'via staff';
  };

  const eligibleBidders = group.members.filter((m: any) => !m.hasWon && m.subscriberStatus === 'active');
  const validBids = auction.bids.filter((b: any) => ['valid', 'winning'].includes(b.status));
  const hideBidAmounts = isSealed && !locked && (live?.roomStatus ?? auction.roomStatus) !== 'closed';
  const presentCount = auction.attendance.filter((entry: any) => ['present', 'proxy'].includes(entry.status)).length;
  const showNoticeAction = !locked && auction.status === 'pending' && auction.noticeStatus !== 'sent';
  const roomMessages = live?.latestMessages ?? initialMessages;

  return (
    <>
      <div style={{ marginBottom: '16px' }}>
        <Link href={`/chits/${group.groupCode ?? group.id}`} className="btn btn-ghost btn-sm">
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          Back to {group.name}
        </Link>
      </div>

      {error && (
        <div
          className="alert alert-danger"
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 'var(--radius)',
            color: '#991B1B',
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {/* Top 4 KPI Summary Info Boxes */}
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

      {/* Strictly 2 Containers Below the Info Boxes */}
      <div className="grid-60-40" style={{ alignItems: 'start', gap: '20px' }}>
        {/* CONTAINER 1 (LEFT): Room Control -> Automated Reverse Bidding -> Members Live Chat -> Settlement & Payout */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>
          {/* 1. Workflow Header: Notice + Live Bidding Room Control */}
          {(showNoticeAction || (isLive && !locked)) && (
            <div
              style={{
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
                    {isLive ? '📡 Live Auction Room Control' : '📢 Auction Notice'}
                  </h3>
                  {isLive && roomActive && (
                    <span className={`badge badge-${live?.roomStatus === 'extended' ? 'warning' : 'success'}`}>
                      {live?.roomStatus ?? auction.roomStatus}
                    </span>
                  )}
                  {isLive && !roomActive && (live?.roomStatus === 'closed' || auction.roomStatus === 'closed') && (
                    <span className="badge badge-secondary">Room closed — select winner below</span>
                  )}
                </div>
                {showNoticeAction && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy === 'notice'}
                    onClick={() => run('notice', () => markAuctionNoticeSent(auction.id))}
                  >
                    {busy === 'notice' ? 'Marking…' : 'Mark auction notice sent'}
                  </button>
                )}
              </div>

              {isLive && !locked && !roomActive && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Duration (minutes)</label>
                    <input type="number" className="form-control" value={roomMinutes} min={1} onChange={(e) => setRoomMinutes(Number(e.target.value))} style={{ width: '130px' }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Anti-snipe extend (sec)</label>
                    <input type="number" className="form-control" value={antiSnipe} min={0} onChange={(e) => setAntiSnipe(Number(e.target.value))} style={{ width: '140px' }} />
                  </div>
                  <button className="btn btn-primary" disabled={busy === 'open-room'} onClick={() => run('open-room', () => openLiveRoom(auction.id, roomMinutes, antiSnipe))}>
                    {busy === 'open-room' ? 'Opening…' : 'Open bidding room'}
                  </button>
                </div>
              )}

              {isLive && !locked && roomActive && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: 'var(--primary-light)',
                      border: '1px solid #E9D5EC',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '1.75rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--primary-dark)' }}>
                        ⏱ {Math.floor((live?.secondsRemaining ?? 0) / 60)}:{String((live?.secondsRemaining ?? 0) % 60).padStart(2, '0')}
                      </div>
                      {live?.highestBid && !hideBidAmounts && (
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#047857' }}>
                          Leading: #{live.highestBid.ticketNo} · {formatCurrency(Number(group.chitValue) - live.highestBid.bidDiscount, currencySymbol)}
                          <span style={{ fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '6px' }}>
                            (disc. {formatCurrency(live.highestBid.bidDiscount, currencySymbol)})
                          </span>
                        </div>
                      )}
                      {hideBidAmounts && <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{live?.bidCount ?? 0} sealed bid(s) received</div>}
                      {live?.bell?.enabled && (
                        <span className="badge badge-secondary" title="Going once / going twice / sold">
                          🔔 {live.bell.bellsRung}/{live.bell.bellCount}
                          {live.bell.bellsRung >= live.bell.bellCount && !live.bell.autoClose ? ' — awaiting manual close' : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowTableCanvas((v) => !v)}
                      >
                        {showTableCanvas ? 'Hide Poker Table' : '🎭 Poker Table View'}
                      </button>
                      {live?.bell?.enabled && (live?.bell?.bellsRung ?? 0) < (live?.bell?.bellCount ?? 0) && (
                        <button className="btn btn-secondary btn-sm" disabled={busy === 'ring-bell'} onClick={() => run('ring-bell', () => ringLiveBell(auction.id))}>
                          {busy === 'ring-bell' ? 'Ringing…' : '🔔 Ring bell'}
                        </button>
                      )}
                      <button className="btn btn-danger btn-sm" disabled={busy === 'close-room'} onClick={() => run('close-room', () => closeLiveRoom(auction.id))}>
                        {busy === 'close-room' ? 'Closing…' : 'Close room'}
                      </button>
                    </div>
                  </div>

                  {bellToast && (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '10px 16px',
                        background: 'var(--primary-dark)',
                        color: '#fff',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '1.05rem',
                        letterSpacing: '0.3px',
                      }}
                    >
                      🔔 {bellToast}
                    </div>
                  )}

                  {showTableCanvas && (
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '2712 / 1536', borderRadius: '18px', overflow: 'hidden', border: '2px solid #334155', boxShadow: '0 14px 32px rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/assets/poker_table.avif)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'brightness(0.88) contrast(1.12)' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, rgba(15,23,42,0.35) 0%, rgba(15,23,42,0.7) 100%)' }} />

                      {clockNow && (
                        <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10, padding: '6px 10px', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'left' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                            {clockNow.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                          <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>
                            {clockNow.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      )}

                      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '14px 24px', background: 'rgba(15, 23, 42, 0.82)', backdropFilter: 'blur(10px)', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 8px 32px rgba(0,0,0,0.45)', maxWidth: '280px' }}>
                        <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '1.4px', color: '#94a3b8', fontWeight: 700 }}>Chit Period {auction.periodNumber}</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace', margin: '2px 0' }}>
                          ⏱ {Math.floor((live?.secondsRemaining ?? 0) / 60)}:{String((live?.secondsRemaining ?? 0) % 60).padStart(2, '0')}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#cbd5e1' }}>Chit Value: {formatCurrency(Number(group.chitValue), currencySymbol)}</div>
                        {live?.highestBid && (
                          <div style={{ fontSize: '0.76rem', color: '#22c55e', fontWeight: 700, marginTop: '2px' }}>
                            🏆 Ticket #{live.highestBid.ticketNo} · {formatCurrency(Number(group.chitValue) - live.highestBid.bidDiscount, currencySymbol)}
                          </div>
                        )}
                      </div>

                      {group.members.map((m: any, idx: number) => {
                        const total = group.members.length || 1;
                        const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
                        const left = 50 + 34 * Math.cos(angle);
                        const top = 50 + 31 * Math.sin(angle);
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
                            }}
                            title={`${m.customer.name} (${isOnline ? 'Online' : 'Offline'})`}
                          >
                            {isLeader && (
                              <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '6px', padding: '3px 8px', background: '#eab308', color: '#1e293b', fontWeight: 800, fontSize: '0.7rem', borderRadius: '999px', whiteSpace: 'nowrap', zIndex: 30 }}>
                                {formatCurrency(Number(group.chitValue) - live.highestBid.bidDiscount, currencySymbol)}
                              </div>
                            )}
                            <div style={{ position: 'relative', width: '48px', height: '48px', borderRadius: '50%', border: isLeader ? '3px solid #eab308' : isOnline ? '2px solid #22c55e' : '2px solid rgba(255,255,255,0.3)', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              {photoUrl ? (
                                <img src={photoUrl} alt={m.customer.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                                  {m.customer?.name?.[0]?.toUpperCase() ?? 'M'}
                                </span>
                              )}
                              <div style={{ position: 'absolute', bottom: '2px', right: '2px', width: '11px', height: '11px', borderRadius: '50%', backgroundColor: isOnline ? '#22c55e' : '#64748b', border: '2px solid #0f172a' }} />
                            </div>
                            <div style={{ marginTop: '3px', padding: '2px 7px', backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center', maxWidth: '88px' }}>
                              <div style={{ fontSize: '0.65rem', color: '#f8fafc', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.ticketNo ?? m.memberNumber}. {m.customer?.name?.split(' ')[0]}
                              </div>
                              {liveSeat?.latestPrize && (
                                <div style={{ fontSize: '0.6rem', color: '#38bdf8', fontWeight: 700 }}>
                                  {formatCurrency(liveSeat.latestPrize, currencySymbol)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {seatModal?.hasWon && (
                    <div className="alert alert-warning" style={{ padding: '8px 10px' }}>
                      {seatModal.customer.name} has already won and is viewing as a spectator.
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 2. Automated Reverse Bidding Box (Large Font + Premade Template Prices) */}
          {!isDrawType && !locked && (
            <AuctionAutomatedBidBox
              bounds={activeBidBounds}
              eligibleBidders={eligibleBidders}
              bidMemberId={bidMemberId}
              onChangeMemberId={setBidMemberId}
              bidPrize={bidPrize}
              onChangePrize={setBidPrize}
              onPlaceBid={(amt) => {
                run('bid', async () => {
                  const res = await addAuctionBid(auction.id, bidMemberId, amt);
                  if (res && res.ok !== false) setBidMemberId('');
                  return res;
                });
              }}
              currencySymbol={currencySymbol}
              busy={busy === 'bid'}
              isSealed={isSealed}
              labels={{
                title: isLive ? 'Live Automated Reverse Bidding' : 'Automated Reverse Bidding',
                member: d.member,
                selectMember: d.selectMember,
                prizeAmount: d.prizeAmount,
                placeBid: isSealed ? 'Submit Sealed Bid' : 'Place Bid',
              }}
            />
          )}

          {/* 3. Members Live Voice & Text Chat Room */}
          {(isLive || biddingAllowed || roomMessages.length > 0) && (
            <AuctionRoomChatBox
              messages={roomMessages}
              waiting={live?.waiting ?? []}
              busy={busy}
              locked={locked}
              onSendText={async (body, visibility) => {
                await run('chat', () => postRoomMessage(auction.id, body, visibility));
              }}
              onSendVoice={async (file, durationSec, transcript, visibility) => {
                const fd = new FormData();
                fd.set('audio', file);
                fd.set('durationSec', String(durationSec));
                if (transcript) fd.set('transcript', transcript);
                fd.set('visibility', visibility);
                await run('voice', () => postRoomVoiceMessage(auction.id, fd));
              }}
              onDecideAdmission={(memberId, decision) => {
                run(`admit-${memberId}`, () => decideRoomAdmission(auction.id, memberId, decision));
              }}
              onError={setError}
            />
          )}

          {/* 4. Confirm / Draw / Decide Period */}
          {!locked && (
            <div style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg)', padding: '16px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>✅ Decide period</h3>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Minutes (optional override — auto-generated when empty)</label>
                <textarea className="form-control" rows={2} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
              </div>
              {isConsensus ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Select recipient member (Need-Based Consensus)</label>
                    <select className="form-control" value={consensusMemberId} onChange={(e) => setConsensusMemberId(e.target.value)}>
                      <option value="">{d.selectMember}</option>
                      {eligibleBidders.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.ticketNo ?? m.memberNumber}. {m.customer.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Consensus reason / purpose</label>
                    <input type="text" className="form-control" value={consensusReason} onChange={(e) => setConsensusReason(e.target.value)} placeholder="e.g. Medical emergency / wedding" />
                  </div>
                  <button
                    className="btn btn-primary"
                    disabled={busy === 'draw' || !consensusMemberId}
                    onClick={() => run('draw', () => drawAuctionWinner(auction.id, { selectedMemberId: consensusMemberId, consensusReason }))}
                  >
                    {busy === 'draw' ? 'Allocating…' : 'Allocate by Consensus'}
                  </button>
                </div>
              ) : isDrawType ? (
                <button className="btn btn-primary" disabled={busy === 'draw'} onClick={() => run('draw', () => drawAuctionWinner(auction.id))}>
                  {busy === 'draw' ? 'Resolving…' : group.auctionType === 'lottery' ? '🎲 Draw winner' : `Resolve (${engineType})`}
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    className="btn btn-primary"
                    disabled={busy === 'confirm' || validBids.length === 0 || roomActive}
                    onClick={() => run('confirm', () => confirmAuction(auction.id, null, minutes || null))}
                    title={roomActive ? 'Close the bidding room first' : undefined}
                  >
                    {busy === 'confirm'
                      ? 'Confirming…'
                      : isMultiDivision
                        ? `Confirm Multi-Division (${engineCfg.multiDivision.lotteryWinnersPerCycle} Lottery + ${engineCfg.multiDivision.auctionWinnersPerCycle} Auction)`
                        : `Confirm highest bid${group.tieBreakRule === 'LOTTERY_AMONG_TIED' ? ' (cap tie → lottery)' : ''}`}
                  </button>
                  {isReservePrice && validBids.length === 0 && (
                    <button
                      className="btn btn-secondary"
                      disabled={busy === 'draw' || roomActive}
                      onClick={() => run('draw', () => drawAuctionWinner(auction.id))}
                    >
                      {busy === 'draw'
                        ? 'Drawing…'
                        : `Draw at Reserve Floor (${auction.reserveFloorAmount ? formatCurrency(Number(auction.reserveFloorAmount), currencySymbol) : 'R_t'})`}
                    </button>
                  )}
                </div>
              )}
              <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)', margin: '8px 0 0' }}>
                Confirming never releases money — the prize stays locked until security is approved.
              </p>
            </div>
          )}

          {/* 5. Minutes */}
          {auction.minutesText && (
            <div style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg)', padding: '16px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>📝 Minutes</h3>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.82rem', margin: 0 }}>{auction.minutesText}</pre>
            </div>
          )}

          {/* 6. Winner + Security + Payout */}
          {auction.winnerMemberId && (
            <div style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg)', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>🏆 Prize &amp; security</h3>
                {winnerSummary && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={copyWinnerSummary}>Copy</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>Print</button>
                  </div>
                )}
              </div>
              <p style={{ margin: '0 0 8px' }}>
                Winner: <strong>{auction.winnerMember?.customer?.name}</strong> — prize {formatCurrency(Number(auction.prizeAmount), currencySymbol)}
              </p>
              {winnerSummary ? (
                <div style={{ marginBottom: '14px', padding: '12px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <DividendBreakdown
                    chitValue={winnerSummary.chitValue}
                    prizeAmount={winnerSummary.prizeAmount}
                    bidDiscount={winnerSummary.bidDiscount}
                    commissionPct={winnerSummary.commissionPct}
                    commissionBasis={winnerSummary.commissionBasis}
                    commission={winnerSummary.commission}
                    gstPct={winnerSummary.gstPct}
                    gstAmount={winnerSummary.gstAmount}
                    distributableDividend={winnerSummary.distributableDividend}
                    dividendEligibleMembers={winnerSummary.dividendEligibleMembers}
                    dividend={winnerSummary.dividend}
                    roundingIncome={winnerSummary.roundingIncome}
                    dividendPolicy={winnerSummary.dividendPolicy}
                    dividendDistribution={winnerSummary.dividendDistribution}
                    currencySymbol={currencySymbol}
                    engineType={winnerSummary.chitEngineType}
                    foremanCompensationMode={winnerSummary.foremanCompensationMode}
                    reserveFloorAmount={winnerSummary.reserveFloorAmount}
                    forfeitedDividendTotal={winnerSummary.forfeitedDividendTotal}
                    multiDivisionWinners={winnerSummary.multiDivisionWinners}
                    basePlusPremiumDetails={winnerSummary.breakdown?.basePlusPremiumDetails}
                    goldDetails={winnerSummary.breakdown?.goldDetails}
                    commodityDetails={winnerSummary.breakdown?.commodityDetails}
                    ascaDetails={winnerSummary.breakdown?.ascaDetails}
                    dict={dict}
                  />
                  {winnerSummary.receiptNo && (
                    <p style={{ margin: '8px 0 0', fontSize: '.8rem', color: 'var(--success)' }}>Dividend receipt: {winnerSummary.receiptNo}</p>
                  )}
                  {winnerSummary.memberDividends?.length > 0 && (
                    <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                      <strong style={{ fontSize: '.86rem', display: 'block', marginBottom: '6px' }}>
                        Per-member dividend &amp; next due ({winnerSummary.memberDividends.length})
                      </strong>
                      <div className="table-wrapper" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Ticket</th>
                              <th>Member</th>
                              <th>Share</th>
                              <th>Role</th>
                              <th>Dividend</th>
                              <th>Next Due</th>
                            </tr>
                          </thead>
                          <tbody>
                            {winnerSummary.memberDividends.map((m: any) => (
                              <tr key={m.memberId || m.ticketNo}>
                                <td>#{m.ticketNo ?? '—'}</td>
                                <td>{m.name}</td>
                                <td>{m.ticketShare ?? 1}</td>
                                <td style={{ fontSize: '.74rem' }}>{m.roleStatus ?? 'active'}</td>
                                <td style={{ color: 'var(--success)', fontWeight: 700 }}>
                                  {formatCurrency(m.dividend, currencySymbol)}
                                  {m.forfeitedDividend > 0 && (
                                    <span style={{ color: 'var(--danger)', display: 'block', fontSize: '.7rem' }}>
                                      Forfeited {formatCurrency(m.forfeitedDividend, currencySymbol)}
                                    </span>
                                  )}
                                </td>
                                <td>{m.netPayableNextPeriod != null ? formatCurrency(m.netPayableNextPeriod, currencySymbol) : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ margin: '0 0 12px', fontSize: '.82rem', color: 'var(--text-secondary)' }}>
                  Commission {formatCurrency(Number(auction.commission ?? 0), currencySymbol)}
                  {Number(auction.gstAmount) > 0 && ` · GST ${formatCurrency(Number(auction.gstAmount), currencySymbol)}`}
                  {' · '}Dividend/ticket {formatCurrency(Number(auction.dividend ?? 0), currencySymbol)}
                  {Number(auction.roundingIncome) > 0 && ` · rounding income ${formatCurrency(Number(auction.roundingIncome), currencySymbol)}`}
                </p>
              )}

              <p style={{ margin: '0 0 12px' }}>
                Security: <span className={`badge badge-${security?.status === 'approved' ? 'success' : security?.status === 'rejected' ? 'danger' : 'warning'}`}>{security?.status ?? 'pending'}</span>
                {' '}· Payout: <span className={`badge badge-${auction.payoutStatus === 'paid' ? 'success' : auction.payoutStatus === 'ready' ? 'info' : 'warning'}`}>{auction.payoutStatus}</span>
              </p>

              {securityDocuments.length > 0 && (
                <div style={{ marginBottom: '14px', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', background: 'var(--surface)' }}>
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
                              <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => run(`doc-${doc.id}-verify`, () => reviewChitSecurityDocument(auction.id, doc.id, 'verify'))}>Verify</button>
                              <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => run(`doc-${doc.id}-approve`, () => reviewChitSecurityDocument(auction.id, doc.id, 'approve'))}>Approve</button>
                              <button type="button" className="btn btn-danger btn-sm" disabled={!!busy} onClick={() => run(`doc-${doc.id}-reject`, () => reviewChitSecurityDocument(auction.id, doc.id, 'reject'))}>Reject</button>
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
                  style={{ marginBottom: '14px', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', background: 'var(--surface)' }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    fd.set('action', 'documents');
                    run('security-documents', async () => {
                      await compressFormDataImages(fd);
                      return submitChitSecurity(auction.id, fd);
                    });
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
                        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
                        const fd = new FormData(e.currentTarget, submitter);
                        run('security', async () => {
                          await compressFormDataImages(fd);
                          return submitChitSecurity(auction.id, fd);
                        });
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div className="form-group">
                          <label className="form-label">Security type</label>
                          <select name="securityType" className="form-control" defaultValue={security?.securityType ?? 'INTERNAL_GUARANTOR_JAMEEN'}>
                            <option value="INTERNAL_GUARANTOR_JAMEEN">Internal Guarantor (Jameen)</option>
                            <option value="PROMISSORY_NOTE">Promissory Note</option>
                            <option value="POST_DATED_CHEQUE">Post-Dated Cheque (PDC)</option>
                            <option value="GOLD_PLEDGE">Gold Pledge</option>
                            <option value="PROPERTY_DOCUMENT">Property Document</option>
                            <option value="FD_LIEN">FD Lien</option>
                            <option value="NONE">None</option>
                            <option value="guarantor">Guarantor (legacy)</option>
                            <option value="property">Property (legacy)</option>
                            <option value="gold">Gold (legacy)</option>
                            <option value="fd">Fixed deposit (legacy)</option>
                            <option value="cheque">Cheque (legacy)</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Internal Guarantor Member (Jameen Lock)</label>
                          <select name="guarantorMemberId" className="form-control" defaultValue={security?.guarantorMemberId ?? ''}>
                            <option value="">None (external / non-member)</option>
                            {group.members
                              .filter((m: any) => m.id !== auction.winnerMemberId)
                              .map((m: any) => (
                                <option key={m.id} value={m.id}>
                                  #{m.ticketNo ?? m.memberNumber} · {m.customer.name}
                                </option>
                              ))}
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
          )}
        </div>

        {/* CONTAINER 2 (RIGHT): Live Activity Feed -> Bid History -> Attendance */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
          {/* 1. Auction Activity Section (Right Top) */}
          <div style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>📜 Auction activity</h3>
                <span className="badge badge-pending">{timeline?.entries?.length ?? 0}</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={fetchTimeline}
                disabled={timelineLoading}
                style={{ fontSize: '0.74rem' }}
              >
                {timelineLoading ? 'Syncing…' : '↻ Refresh'}
              </button>
            </div>
            {timelineLoading && !timeline ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '.84rem' }}>Loading live activity…</div>
            ) : (timeline?.entries?.length ?? 0) === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '.84rem' }}>No activity yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                {timeline.entries.map((entry: any) => (
                  <div
                    key={`${entry.kind}-${entry.id}`}
                    style={{
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'flex-start',
                      fontSize: '.82rem',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <span style={{ fontSize: '0.95rem', lineHeight: 1.2 }}>{timelineIcon(entry)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--text)', fontWeight: 500, wordBreak: 'break-word' }}>
                        {timelineText(entry, currencySymbol)}
                      </div>
                      <div style={{ color: 'var(--text-light)', fontSize: '0.7rem', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(entry.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Bid History */}
          <div style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>🧾 Bid history</h3>
              <span className="badge badge-info">{auction.bids.length}</span>
            </div>
            {auction.bids.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '.84rem' }}>
                {isDrawType ? 'Draw-based chit — use the draw action to resolve this period.' : 'No bids recorded yet.'}
              </p>
            ) : hideBidAmounts ? (
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '.84rem' }}>
                {auction.bids.length} sealed bid(s) received — amounts stay hidden until close.
              </p>
            ) : (
              <div className="table-wrapper" style={{ maxHeight: '280px', overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <table>
                  <thead>
                    <tr><th>Ticket</th><th>Member</th><th>{d.prize}</th><th>Disc.</th><th>{d.status}</th>{!locked && <th></th>}</tr>
                  </thead>
                  <tbody>
                    {auction.bids.map((b: any) => (
                      <tr key={b.id} style={b.status === 'winning' ? { background: 'rgba(46, 204, 113, .08)' } : undefined}>
                        <td>#{b.member.ticketNo ?? b.member.memberNumber}</td>
                        <td>
                          <div>{b.member.customer.name}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>
                            {new Date(b.bidTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(Number(b.bidAmount), currencySymbol)}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(Number(b.bidDiscount), currencySymbol)}</td>
                        <td><span className={`badge badge-${b.status === 'winning' ? 'success' : b.status === 'valid' ? 'info' : 'secondary'}`}>{b.status}</span></td>
                        {!locked && (
                          <td>
                            {b.status === 'valid' && (
                              <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => run(`confirm-${b.id}`, () => confirmAuction(auction.id, b.id, minutes || null))}>
                                Pick winner
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

          {/* 3. Attendance */}
          <div style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>🙋 Attendance</h3>
              <span className="badge badge-active">{presentCount}/{group.members.length}</span>
            </div>
            <div className="table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <table>
                <thead><tr><th>Ticket</th><th>{d.member}</th><th>{d.status}</th><th>Via</th></tr></thead>
                <tbody>
                  {group.members.map((m: any) => {
                    const status = attendanceOf(m.id);
                    const entry = attendanceEntryOf(m.id);
                    return (
                      <tr key={m.id}>
                        <td>#{m.ticketNo ?? m.memberNumber}</td>
                        <td>{m.customer.name}</td>
                        <td>
                          {locked ? (
                            <span className={`badge badge-${status === 'present' ? 'success' : status === 'proxy' ? 'info' : 'secondary'}`}>
                              {entry?.admissionStatus === 'none' ? 'present (portal only)' : (status ?? '—')}
                            </span>
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
                        <td>
                          {entry ? (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{viaLabel(entry.markedVia, entry.admissionStatus)}</span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
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
                    const res = await retractLiveMemberBid(auction.id, seatModal.id);
                    if (res && res.ok !== false) setSeatModal(null);
                    return res;
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
