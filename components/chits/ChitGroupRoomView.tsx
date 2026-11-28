'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PDF_LANGUAGES, resolvePdfLang } from '@/lib/reports/pdfLanguages';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PokerTableArena } from './PokerTableArena';
import { parseBidAmountFromChat } from './AuctionRoomChatBox';

export interface GroupRoomProps {
  mode: 'staff' | 'member';
  initialState: any;
  currencySymbol: string;
  initialLang?: string;
  backHref: string;
  apiBaseUrl: string;
  modulePrefix?: string;
}

export default function ChitGroupRoomView({
  mode,
  initialState,
  currencySymbol,
  initialLang,
  backHref,
  apiBaseUrl,
}: GroupRoomProps) {
  const [pdfLang, setPdfLang] = useState<string>(() => resolvePdfLang(initialLang));
  const [state, setState] = useState<any>(initialState);
  const [messages, setMessages] = useState<any[]>(initialState?.messages ?? []);
  const [chatBody, setChatBody] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'organizer'>('public');
  const [replyTo, setReplyTo] = useState<{ id: string; senderName: string; body: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Recording / Voice Chat
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');

  // Bidding controls
  const activeAuction = state?.activeAuction;
  const bounds = activeAuction?.bidBounds;
  const [selectedBidMemberId, setSelectedBidMemberId] = useState<string>(
    () => (state?.members ?? []).find((m: any) => !m.hasWon && m.subscriberStatus === 'active')?.memberId || '',
  );
  const [prizeInput, setPrizeInput] = useState<number>(
    Number(bounds?.nextValidPrize ?? state?.group?.chitValue ?? 0),
  );
  const userEditedBidRef = useRef(false);

  // Staff settings / invite controls
  const [pinInput, setPinInput] = useState<string>(initialState?.group?.pinnedAnnouncement ?? '');
  const [showSettings, setShowSettings] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{ joinUrl: string; shareUrl: string } | null>(null);
  const [openDuration, setOpenDuration] = useState(30);
  const [reminderDraft, setReminderDraft] = useState('');

  const feedEndRef = useRef<HTMLDivElement | null>(null);

  const pollRoom = async () => {
    try {
      const res = await fetch(apiBaseUrl, { cache: 'no-store' });
      const data = await res.json();
      if (data?.state) {
        setState(data.state);
        setMessages(data.state.messages ?? []);
        if (!userEditedBidRef.current && data.state?.activeAuction?.bidBounds?.nextValidPrize) {
          setPrizeInput(Number(data.state.activeAuction.bidBounds.nextValidPrize));
        }
      }
    } catch {
      // transient polling failure ignored
    }
  };

  useEffect(() => {
    const t = setInterval(pollRoom, 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  const g = state.group;
  const my = state.mySummary;
  const isMemberLocked = mode === 'member' && g.roomChatMode === 'announcements_only';
  const roomOpen = Boolean(activeAuction?.isOpen);
  const maxPrize = Number(bounds?.nextValidPrize ?? g.chitValue ?? 0);
  const minPrize = Number(bounds?.minPrize ?? 1);
  const quickOptions: number[] = Array.isArray(bounds?.quickOptions) ? bounds.quickOptions : [];

  const postJson = async (payload: Record<string, any>, actionTag = 'action') => {
    setBusy(actionTag);
    setError('');
    try {
      const res = await fetch(apiBaseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      await pollRoom();
      return data;
    } catch (e: any) {
      setError(e?.message || 'Operation failed');
      return null;
    } finally {
      setBusy('');
    }
  };

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = chatBody.trim();
    if (!text || busy) return;
    const out = await postJson(
      {
        action: 'message',
        body: text,
        visibility: mode === 'staff' ? visibility : 'public',
        replyToId: replyTo?.id ?? null,
      },
      'message',
    );
    if (out) {
      setChatBody('');
      setReplyTo(null);
    }
  };

  const handleSendReminder = async () => {
    const text =
      reminderDraft.trim() ||
      `Period ${activeAuction?.periodNumber ?? 1} installment Rs. ${Number(g.monthlyContrib).toLocaleString('en-IN')} is open for payment.`;
    const out = await postJson({ action: 'reminder', body: text }, 'reminder');
    if (out) {
      setReminderDraft('');
      setNotice('Payment reminder posted to room chat');
    }
  };

  const handleBid = async (amount: number, source: 'tap' | 'voice' = 'tap', transcript?: string) => {
    const clamped = Math.max(minPrize, Math.min(maxPrize, Math.round(amount)));
    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const out = await postJson(
      {
        action: 'bid',
        auctionId: activeAuction?.id,
        memberId: mode === 'staff' ? selectedBidMemberId : undefined,
        prizeAmount: clamped,
        source,
        transcript,
        idempotencyKey,
      },
      'bid',
    );
    if (out) {
      userEditedBidRef.current = false;
      setNotice(`Bid placed at ${formatCurrency(clamped, currencySymbol)}`);
    }
  };

  const startVoiceRecording = async () => {
    if (recording || isMemberLocked || busy) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      transcriptRef.current = '';
      setLiveTranscript('');

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch {}
        }
        const dur = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const transcript = transcriptRef.current.trim();
        setRecording(false);
        setRecordSeconds(0);
        setLiveTranscript('');

        if (blob.size > 0) {
          setBusy('voice');
          setError('');
          try {
            const fd = new FormData();
            const ext = mimeType.includes('webm') ? 'webm' : 'm4a';
            fd.append('audio', new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType }));
            fd.append('durationSec', String(dur));
            if (transcript) fd.append('transcript', transcript);
            if (replyTo?.id) fd.append('replyToId', replyTo.id);
            fd.append('visibility', mode === 'staff' ? visibility : 'public');
            const res = await fetch(apiBaseUrl, { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Voice upload failed');
            setReplyTo(null);
            await pollRoom();
          } catch (err: any) {
            setError(err?.message || 'Could not send voice note');
          } finally {
            setBusy('');
          }
        }
      };

      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.lang = 'en-IN';
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (ev: any) => {
            const text = Array.from(ev.results)
              .map((r: any) => r[0]?.transcript ?? '')
              .join(' ')
              .trim();
            transcriptRef.current = text;
            setLiveTranscript(text);
          };
          rec.start();
          recognitionRef.current = rec;
        } catch {}
      }

      recordStartRef.current = Date.now();
      setRecordSeconds(0);
      setRecording(true);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds(Math.round((Date.now() - recordStartRef.current) / 1000));
      }, 400);
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (err: any) {
      setError(err?.message || 'Microphone access denied');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const generateInvite = async () => {
    setBusy('invite');
    setError('');
    try {
      const { getChitWhatsAppInviteAction } = await import('@/app/(dashboard)/[module]/chits/actions');
      const res = await getChitWhatsAppInviteAction(g.id);
      if (!res.ok) throw new Error(res.error);
      setInviteInfo({ joinUrl: res.joinUrl, shareUrl: res.shareUrl });
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(res.joinUrl).catch(() => {});
        setNotice('Invite link copied & ready to share in WhatsApp!');
      }
    } catch (err: any) {
      setError(err?.message || 'Could not create invite link');
    } finally {
      setBusy('');
    }
  };

  const canMemberBidNow =
    mode === 'member' &&
    roomOpen &&
    Boolean(activeAuction?.supportsBidding) &&
    !my?.hasWon &&
    my?.subscriberStatus === 'active' &&
    Boolean(bounds?.canBidFurther) &&
    (g.roomAdmission !== 'approval' || my?.admissionStatus === 'admitted');

  const canMemberJoinRoom =
    mode === 'member' &&
    roomOpen &&
    !my?.hasWon &&
    my?.subscriberStatus === 'active' &&
    !['admitted', 'denied'].includes(my?.admissionStatus ?? '');

  return (
    <div style={{ maxWidth: '1360px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Unified Theme Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', background: 'linear-gradient(125deg, var(--primary-dark) 0%, var(--primary) 100%)', color: '#fff', padding: '16px 22px', borderRadius: '18px', boxShadow: '0 10px 26px -10px var(--primary-glow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Link href={backHref} style={{ color: '#ffffff', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 700, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.28)', padding: '7px 13px', borderRadius: '10px' }}>
            ← Back
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>{g.name}</h2>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: g.roomChatMode === 'announcements_only' ? 'var(--warning)' : 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.28)', color: '#fff' }}>
                {g.roomChatMode === 'announcements_only' ? '📢 Announcements Only' : '💬 Live Group Table & Chat'}
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.88)', marginTop: '3px' }}>
              {g.engineLabel} · Pool {formatCurrency(g.chitValue, currencySymbol)} · {g.enrolledCount}/{g.totalMembers} Members
              {my ? ` · Your Ticket #${my.ticketNo ?? '—'}` : ''}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {mode === 'staff' && (
            <>
              <button
                type="button"
                onClick={generateInvite}
                disabled={busy === 'invite'}
                style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', background: '#25D366', color: '#052e16', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                {busy === 'invite' ? 'Generating…' : '📲 Invite from WhatsApp'}
              </button>
              <button
                type="button"
                onClick={() => setShowSettings((v) => !v)}
                style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: '#fff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                ⚙️ Room Settings
              </button>
            </>
          )}
          {mode === 'member' && my?.nextDue && (
            <Link
              href="/borrower/pay"
              style={{ padding: '7px 14px', borderRadius: '8px', background: '#10b981', color: '#052e16', fontWeight: 800, fontSize: '0.8rem', textDecoration: 'none' }}
            >
              Pay Due {formatCurrency(my.nextDue.outstanding, currencySymbol)} →
            </Link>
          )}
        </div>
      </div>

      {/* Invite Share Strip (Staff) */}
      {inviteInfo && (
        <div style={{ padding: '12px 16px', background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '0.82rem', color: '#065f46' }}>
            <strong>Invite Link (Copied):</strong> <code>{inviteInfo.joinUrl}</code>
          </div>
          <a
            href={inviteInfo.shareUrl}
            target="_blank"
            rel="noreferrer"
            style={{ padding: '6px 12px', borderRadius: '8px', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none' }}
          >
            Open WhatsApp &amp; Drop into Group →
          </a>
        </div>
      )}

      {/* Staff Room Controls Panel */}
      {mode === 'staff' && showSettings && (
        <div className="card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Chat Mode:</label>
            <button
              type="button"
              className={`btn btn-sm ${g.roomChatMode !== 'announcements_only' ? 'btn-primary' : 'btn-secondary'}`}
              disabled={busy === 'settings'}
              onClick={() => postJson({ action: 'settings', roomChatMode: 'open', pinnedAnnouncement: pinInput }, 'settings')}
            >
              💬 Open Discussion
            </button>
            <button
              type="button"
              className={`btn btn-sm ${g.roomChatMode === 'announcements_only' ? 'btn-primary' : 'btn-secondary'}`}
              disabled={busy === 'settings'}
              onClick={() => postJson({ action: 'settings', roomChatMode: 'announcements_only', pinnedAnnouncement: pinInput }, 'settings')}
            >
              📢 Announcements Only
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-control"
              style={{ flex: 1, minWidth: '220px' }}
              placeholder="Pinned announcement (e.g. Period 4 auction Sunday 7 PM)"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy === 'settings'}
              onClick={() => postJson({ action: 'settings', roomChatMode: g.roomChatMode, pinnedAnnouncement: pinInput }, 'settings')}
            >
              Save Pin
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-control"
              style={{ flex: 1, minWidth: '220px' }}
              placeholder="Send quick payment reminder notice to group chat..."
              value={reminderDraft}
              onChange={(e) => setReminderDraft(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy === 'reminder'}
              onClick={handleSendReminder}
            >
              💸 Post Payment Reminder
            </button>
          </div>
        </div>
      )}

      {/* Pinned Banner */}
      {g.pinnedAnnouncement && (
        <div style={{ padding: '9px 14px', background: '#fef9c3', border: '1px solid #fde047', borderRadius: '10px', fontSize: '0.82rem', color: '#713f12', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📌</span>
          <span>{g.pinnedAnnouncement}</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '0.84rem' }}>
          {error}
        </div>
      )}
      {notice && (
        <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontSize: '0.84rem' }}>
          {notice}
        </div>
      )}

      {/* Full-Width 20+ Seat Stadium Arena Table FIRST */}
      <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: '20px', padding: '14px', boxShadow: '0 8px 24px -10px rgba(15,23,42,0.08)' }}>
        <PokerTableArena
          periodNumber={activeAuction?.periodNumber ?? 1}
          chitValue={Number(g.chitValue ?? 0)}
          currencySymbol={currencySymbol}
          roomStatus={activeAuction?.roomStatus ?? (roomOpen ? 'live' : 'scheduled')}
          isOpen={roomOpen}
          secondsRemaining={activeAuction?.secondsRemaining ?? 0}
          bell={activeAuction?.bellState}
          selectedMemberId={mode === 'staff' ? selectedBidMemberId : my?.memberId}
          highestBid={
            activeAuction?.leadingBid
              ? {
                  ticketNo: activeAuction.leadingBid.ticketNo,
                  memberName: activeAuction.leadingBid.memberName,
                  prizeAmount: activeAuction.leadingBid.prizeAmount,
                  bidDiscount: activeAuction.leadingBid.bidDiscount,
                }
              : null
          }
          emptyCenterLabel={
            activeAuction
              ? formatDate(activeAuction.scheduledAt ?? activeAuction.auctionDate)
              : 'Group Table'
          }
          seats={(state.members ?? []).map((m: any) => ({
            memberId: m.memberId,
            ticketNo: m.ticketNo,
            name: m.name,
            photoUrl: m.profilePhoto ?? null,
            isOnline: Boolean(m.isOnline || m.isMe || activeAuction?.leadingBid?.memberId === m.memberId),
            isLeader: Boolean(activeAuction?.leadingBid?.memberId === m.memberId),
            hasWon: Boolean(m.hasWon),
            isMe: Boolean(m.isMe),
            latestPrize: m.latestPrize ?? null,
          }))}
          onSelectSeat={
            mode === 'staff'
              ? (seat) => {
                  if (!seat.hasWon) setSelectedBidMemberId(seat.memberId);
                }
              : undefined
          }
        />
      </div>

      {/* 2-Column Responsive Layout Below Table: Left = Controls & Roster, Right = Interactive Bid Chat */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px', alignItems: 'start' }}>
        {/* LIVE AUCTION & SETTLEMENTS PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeAuction && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-dark)', textTransform: 'uppercase' }}>
                    {roomOpen ? '🔴 Live Auction Room' : 'Scheduled Period'}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>
                    Period {activeAuction.periodNumber} · {formatDate(activeAuction.scheduledAt ?? activeAuction.auctionDate)}
                  </div>
                </div>
                {roomOpen && (
                  <div style={{ padding: '4px 10px', borderRadius: '999px', background: '#fee2e2', color: '#b91c1c', fontWeight: 800, fontSize: '0.85rem' }}>
                    ⏱ {Math.floor(activeAuction.secondsRemaining / 60)}:{String(activeAuction.secondsRemaining % 60).padStart(2, '0')}
                  </div>
                )}
              </div>

              {activeAuction.bellState?.bellsRung > 0 && (
                <div style={{ marginBottom: '10px', padding: '6px 10px', borderRadius: '8px', background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: '0.8rem', fontWeight: 700 }}>
                  🔔 {activeAuction.bellState.bellsRung >= 3 ? 'SOLD — Final Bell!' : `Bell ${activeAuction.bellState.bellsRung} of 3`}
                </div>
              )}

              {/* Leading Bid Highlight */}
              <div style={{ padding: '10px 12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: '10px' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Current Leading Bid</div>
                {activeAuction.leadingBid ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '1.15rem', color: '#0f172a' }}>
                      {formatCurrency(activeAuction.leadingBid.prizeAmount, currencySymbol)}
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: '#047857', fontWeight: 700 }}>
                      Discount {formatCurrency(activeAuction.leadingBid.bidDiscount, currencySymbol)} · #{activeAuction.leadingBid.ticketNo} {activeAuction.leadingBid.memberName}
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                    {activeAuction.supportsBidding
                      ? `Opening Max Prize: ${formatCurrency(maxPrize, currencySymbol)}`
                      : 'Draw / Rotation Cycle (No bidding)'}
                  </div>
                )}
              </div>

              {/* Staff Live Controls */}
              {mode === 'staff' && activeAuction.supportsBidding && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {!roomOpen && g.auctionType === 'open_live' && !['confirmed', 'paid', 'cancelled'].includes(activeAuction.status) && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        className="form-control"
                        style={{ width: '80px' }}
                        value={openDuration}
                        onChange={(e) => setOpenDuration(Number(e.target.value) || 30)}
                      />
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>min</span>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy === 'open_room'}
                        onClick={() => postJson({ action: 'open_room', auctionId: activeAuction.id, durationMinutes: openDuration }, 'open_room')}
                      >
                        ▶ Open Live Auction
                      </button>
                    </div>
                  )}
                  {roomOpen && (
                    <>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <select
                          className="form-control"
                          style={{ flex: 1, minWidth: '140px' }}
                          value={selectedBidMemberId}
                          onChange={(e) => setSelectedBidMemberId(e.target.value)}
                        >
                          <option value="">Select eligible ticket…</option>
                          {(state.members ?? [])
                            .filter((m: any) => !m.hasWon && m.subscriberStatus === 'active')
                            .map((m: any) => (
                              <option key={m.memberId} value={m.memberId}>
                                #{m.ticketNo} {m.name}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={busy === 'close_room'}
                          onClick={() => postJson({ action: 'close_room', auctionId: activeAuction.id }, 'close_room')}
                        >
                          ⏹ Close Room
                        </button>
                      </div>
                      {bounds?.canBidFurther && selectedBidMemberId && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {quickOptions.slice(0, 4).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={busy === 'bid'}
                              onClick={() => handleBid(opt)}
                            >
                              {formatCurrency(opt, currencySymbol)}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {activeAuction.waitingMembers?.length > 0 && (
                    <div style={{ padding: '8px', background: '#eff6ff', borderRadius: '8px', fontSize: '0.78rem' }}>
                      <strong>Waiting Room:</strong>
                      {activeAuction.waitingMembers.map((wm: any) => (
                        <div key={wm.memberId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <span>{wm.name}</span>
                          <span style={{ display: 'flex', gap: '4px' }}>
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => postJson({ action: 'admit', auctionId: activeAuction.id, memberId: wm.memberId }, 'admit')}>Admit</button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => postJson({ action: 'deny', auctionId: activeAuction.id, memberId: wm.memberId }, 'deny')}>Deny</button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Member Live Controls */}
              {mode === 'member' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {canMemberJoinRoom && (
                    <button
                      type="button"
                      disabled={busy === 'join'}
                      onClick={() => postJson({ action: 'join' }, 'join')}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                    >
                      {busy === 'join' ? 'Joining…' : '✋ Join Live Auction Table'}
                    </button>
                  )}
                  {canMemberBidNow && (
                    <>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {quickOptions.slice(0, 4).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            disabled={busy === 'bid'}
                            onClick={() => handleBid(opt)}
                            style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--primary-border)', background: 'var(--primary-light)', color: 'var(--primary-dark)', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}
                          >
                            Bid {formatCurrency(opt, currencySymbol)}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="number"
                          value={prizeInput}
                          min={minPrize}
                          max={maxPrize}
                          onChange={(e) => {
                            userEditedBidRef.current = true;
                            setPrizeInput(Number(e.target.value));
                          }}
                          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700 }}
                        />
                        <button
                          type="button"
                          disabled={busy === 'bid'}
                          onClick={() => handleBid(prizeInput)}
                          style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Place Bid
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Member Roster Pills */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a', marginBottom: '8px' }}>
              👥 Members ({state.members?.length ?? 0}/{g.totalMembers})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
              {(state.members ?? []).map((m: any) => (
                <span
                  key={m.memberId}
                  style={{
                    fontSize: '0.74rem',
                    padding: '3px 8px',
                    borderRadius: '999px',
                    background: m.isMe ? 'var(--primary-tint)' : m.hasWon ? '#dcfce7' : '#f1f5f9',
                    color: m.isMe ? 'var(--primary-dark)' : m.hasWon ? '#166534' : '#334155',
                    fontWeight: m.isMe ? 700 : 500,
                  }}
                >
                  #{m.ticketNo} {m.name}{m.hasWon ? ' ✓' : ''}
                </span>
              ))}
            </div>
          </div>

          {/* Completed Period PDFs */}
          {state.settlements?.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a' }}>
                  📄 Period Settlement Reports
                </div>
                <select
                  aria-label="Settlement PDF Language"
                  value={pdfLang}
                  onChange={(e) => setPdfLang(e.target.value)}
                  style={{ fontSize: '0.74rem', padding: '3px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  {PDF_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.nativeName}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {state.settlements.map((st: any) => (
                  <div key={st.auctionId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', padding: '6px 8px', background: '#f8fafc', borderRadius: '8px' }}>
                    <div>
                      <strong>Period {st.periodNumber}</strong> · {st.winnerName} ({formatCurrency(st.prizeAmount, currencySymbol)})
                    </div>
                    <a
                      href={`${mode === 'staff' ? st.reportUrl : st.borrowerReportUrl}?lang=${pdfLang}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ padding: '4px 9px', borderRadius: '6px', background: 'var(--primary)', color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: '0.72rem' }}
                    >
                      PDF ↓
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PERSISTENT WHATSAPP-STYLE MULTI-MEMBER CHAT TIMELINE */}
        <div style={{ background: '#efeae2', borderRadius: '14px', border: '1px solid #d6d3d1', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: '520px', maxHeight: '680px' }}>
          <div style={{ background: '#075e54', color: '#fff', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>💬 {g.name} — Group Chat</div>
              <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>
                {g.enrolledCount} participants · Text, Voice &amp; Live Auction Feed
              </div>
            </div>
            <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.18)', padding: '3px 8px', borderRadius: '999px' }}>
              Live Sync
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: '60px', color: '#57534e', fontSize: '0.84rem' }}>
                No messages yet. Say hello to the chit group!
              </div>
            ) : (
              messages.map((m) => {
                const isMine =
                  mode === 'member'
                    ? Boolean(my && m.senderMemberId === my.memberId)
                    : Boolean(m.senderUserId);
                const isCard = ['bid_event', 'settlement_card', 'payment_reminder', 'system_notice'].includes(m.messageType);

                if (isCard) {
                  const bg =
                    m.messageType === 'settlement_card'
                      ? '#dcfce7'
                      : m.messageType === 'bid_event'
                        ? '#fef3c7'
                        : m.messageType === 'payment_reminder'
                          ? '#fee2e2'
                          : '#e0f2fe';
                  const pdfHref =
                    m.metadata &&
                    (mode === 'staff' ? m.metadata.reportPath : m.metadata.borrowerReportPath);
                  return (
                    <div key={m.id} style={{ alignSelf: 'center', maxWidth: '92%', background: bg, border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', padding: '8px 12px', fontSize: '0.78rem', color: '#1e293b', textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, marginBottom: '2px' }}>
                        {m.messageType === 'bid_event' ? '🔨 ' : m.messageType === 'settlement_card' ? '🏆 ' : m.messageType === 'payment_reminder' ? '💸 ' : 'ℹ️ '}
                        {m.senderName}
                      </div>
                      <div>{m.body}</div>
                      {typeof pdfHref === 'string' && (
                        <div style={{ marginTop: '6px' }}>
                          <a href={`${pdfHref}?lang=${pdfLang}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '6px', background: '#065f46', color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: '0.72rem' }}>
                            📄 Download Period PDF
                          </a>
                        </div>
                      )}
                      <div style={{ fontSize: '0.66rem', color: '#64748b', marginTop: '3px' }}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: isMine ? 'flex-end' : 'flex-start',
                      maxWidth: '82%',
                      background: m.visibility === 'organizer' ? '#fae8ff' : isMine ? '#d9fdd3' : '#ffffff',
                      borderRadius: '10px',
                      padding: '8px 11px',
                      boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#075e54' }}>
                        {m.senderName}
                        {m.visibility === 'organizer' ? ' · Organizer Only' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => setReplyTo({ id: m.id, senderName: m.senderName, body: m.body })}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.7rem', color: '#64748b', padding: 0 }}
                        title="Reply"
                      >
                        ↩
                      </button>
                    </div>
                    {m.replyToBody && (
                      <div style={{ border: '1px solid var(--primary-border)', marginBottom: '4px', fontSize: '0.72rem', color: 'var(--text-secondary)', background: 'var(--primary-light)', borderRadius: '8px', padding: '4px 8px' }}>
                        <strong>{m.replyToSender}:</strong> {m.replyToBody}
                      </div>
                    )}
                    {m.audioUrl && (
                      <div style={{ marginBottom: '4px' }}>
                        <audio controls preload="none" src={m.audioUrl} style={{ height: '32px', maxWidth: '240px' }} />
                        {m.audioDurationSec && (
                          <span style={{ fontSize: '0.68rem', color: '#64748b', marginLeft: '6px' }}>{m.audioDurationSec}s</span>
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: '0.84rem', color: '#111827', whiteSpace: 'pre-wrap' }}>{m.body}</div>
                    <div style={{ fontSize: '0.66rem', color: '#64748b', textAlign: 'right', marginTop: '2px' }}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={feedEndRef} />
          </div>

          {/* Reply Preview */}
          {replyTo && (
            <div style={{ background: '#f1f5f9', padding: '6px 12px', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem' }}>
              <div>
                Replying to <strong>{replyTo.senderName}</strong>: {replyTo.body.slice(0, 70)}
              </div>
              <button type="button" onClick={() => setReplyTo(null)} style={{ border: 'none', background: 'transparent', fontWeight: 700, cursor: 'pointer' }}>×</button>
            </div>
          )}

          {/* Voice Recording Banner */}
          {recording && (
            <div style={{ background: '#fef2f2', padding: '6px 12px', borderTop: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#b91c1c' }}>
              <span>🔴 Recording {recordSeconds}s {liveTranscript ? `— "${liveTranscript}"` : ''}</span>
              <button type="button" onClick={stopVoiceRecording} style={{ padding: '4px 10px', borderRadius: '6px', background: '#dc2626', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                Stop &amp; Send
              </button>
            </div>
          )}

          {/* Composer + Chat-to-Bid Bar */}
          {isMemberLocked ? (
            <div style={{ background: 'var(--bg)', padding: '10px 14px', borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              📢 Only organizers can send messages in this group right now.
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
              {(canMemberBidNow || (mode === 'staff' && roomOpen && activeAuction?.supportsBidding)) && (() => {
                const parsedChatBid = parseBidAmountFromChat(chatBody, minPrize, maxPrize);
                return (
                  <div style={{ padding: '8px 12px', background: 'var(--primary-light)', borderBottom: '1px solid var(--primary-border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {parsedChatBid != null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-dark)' }}>
                        <span>⚡ Detected Bid: {formatCurrency(parsedChatBid, currencySymbol)}</span>
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          className="btn btn-primary btn-sm"
                          onClick={async () => {
                            await handleBid(parsedChatBid, 'tap');
                            setChatBody('');
                          }}
                        >
                          🔨 Place Bid from Chat
                        </button>
                      </div>
                    )}
                    {quickOptions.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-dark)' }}>Quick Bid:</span>
                        {quickOptions.slice(0, 4).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => handleBid(opt)}
                            style={{ padding: '4px 9px', borderRadius: '999px', border: '1px solid var(--primary)', background: 'var(--surface)', color: 'var(--primary-dark)', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
                          >
                            🔨 {formatCurrency(opt, currencySymbol)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
              <form onSubmit={handleSendText} style={{ background: 'var(--bg)', padding: '8px 10px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={chatBody}
                  onChange={(e) => setChatBody(e.target.value)}
                  placeholder="Type a message or offer amount (e.g. 92500)..."
                  maxLength={500}
                  style={{ flex: 1, minWidth: '160px', padding: '9px 12px', borderRadius: '999px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.86rem' }}
                />
              {mode === 'staff' && (
                <label style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px', color: '#475569' }}>
                  <input
                    type="checkbox"
                    checked={visibility === 'organizer'}
                    onChange={(e) => setVisibility(e.target.checked ? 'organizer' : 'public')}
                  />
                  Organizer-only
                </label>
              )}
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={recording ? stopVoiceRecording : startVoiceRecording}
                style={{ padding: '8px 11px', borderRadius: '999px', border: 'none', background: recording ? '#dc2626' : '#e2e8f0', color: recording ? '#fff' : '#0f172a', fontWeight: 700, cursor: 'pointer' }}
                title="Voice note"
              >
                {recording ? '⏹' : '🎤'}
              </button>
              <button
                type="submit"
                disabled={!chatBody.trim() || Boolean(busy)}
                style={{ padding: '8px 16px', borderRadius: '999px', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer' }}
              >
                Send
              </button>
            </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
