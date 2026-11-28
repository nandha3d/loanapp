'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { PokerTableArena } from '@/components/chits/PokerTableArena';
import {
  isBellSoundMuted,
  playAuctionBellChime,
  playWinnerConfirmedFanfare,
  setBellSoundMuted,
} from '@/lib/chits/bellAudio';
import {
  BID_VOICE_LANGUAGES,
  getCustomerVoiceLanguageOverride,
  getRoomChatStrings,
  isBidVoiceEnabled,
  normalizeVoiceLanguageCode,
  resolveRoomEffectiveVoiceLang,
  setBidVoiceEnabled,
  setCustomerVoiceLanguageOverride,
  speakBidCallout,
  speakWinnerCallout,
  voiceLanguageBcp47,
  warmUpBidVoiceEngine,
  type BidVoiceLanguageCode,
} from '@/lib/chits/bidVoiceAnnouncer';

type Props = {
  groupId: string;
  auctionId: string;
  initialState: any;
  currencySymbol: string;
  lang?: string;
};

export default function BorrowerChitRoomClient({
  groupId,
  auctionId,
  initialState,
  currencySymbol,
}: Props) {
  const [state, setState] = useState<any>(initialState);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [prizeInput, setPrizeInput] = useState<number>(
    Number(initialState?.bidBounds?.nextValidPrize ?? initialState?.chitValue ?? 0),
  );
  const [chatText, setChatText] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [soundMuted, setSoundMuted] = useState<boolean>(() => isBellSoundMuted());
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => isBidVoiceEnabled());
  const [customerVoiceOverride, setCustomerVoiceOverride] = useState<BidVoiceLanguageCode | null>(() =>
    getCustomerVoiceLanguageOverride(),
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const userEditedRef = useRef(false);
  const prevBellRef = useRef<number>(Number(initialState?.bell?.bellsRung ?? 0));
  const prevWinnerRef = useRef<string | null>(initialState?.winner?.ticketNo ?? null);
  const lastSpokenBidKeyRef = useRef<string | null>(
    initialState?.currentHighestBid
      ? `${initialState.currentHighestBid.memberId}:${initialState.currentHighestBid.bidAmount}`
      : '__none__',
  );

  const bounds = state?.bidBounds;
  const maxPrize = Number(bounds?.nextValidPrize ?? state?.chitValue ?? 0);
  const minPrize = Number(bounds?.minPrize ?? 1);
  const roomOpen = Boolean(state?.isRoomOpen);
  const me = state?.myMembership;
  const canJoin = roomOpen && !me?.hasWon && me?.subscriberStatus === 'active' && !['admitted', 'denied'].includes(me?.admissionStatus);
  const canBid =
    roomOpen &&
    !me?.hasWon &&
    me?.subscriberStatus === 'active' &&
    Boolean(bounds?.canBidFurther) &&
    (state?.roomAdmission !== 'approval' || me?.admissionStatus === 'admitted');

  const poll = async () => {
    try {
      const res = await fetch(`/api/borrower/chits/${groupId}/auctions/${auctionId}`, { cache: 'no-store' });
      const data = await res.json();
      if (data?.state) {
        const nextRung = Number(data.state?.bell?.bellsRung ?? 0);
        const totalBells = Number(data.state?.bell?.bellCount ?? 3);
        if (nextRung > prevBellRef.current && nextRung > 0) {
          playAuctionBellChime(nextRung, totalBells);
        }
        prevBellRef.current = nextRung;
        const winnerKey = data.state?.winner?.ticketNo ? String(data.state.winner.ticketNo) : null;
        const nextRoomLang = normalizeVoiceLanguageCode(data.state?.voiceSettings?.language);
        const nextAllowChange = Boolean(data.state?.voiceSettings?.allowMemberChange);
        const nextVoiceLang = resolveRoomEffectiveVoiceLang({
          roomLanguage: nextRoomLang,
          allowMemberChange: nextAllowChange,
          customerOverride: customerVoiceOverride,
        });
        if (winnerKey && winnerKey !== prevWinnerRef.current) {
          prevWinnerRef.current = winnerKey;
          playWinnerConfirmedFanfare();
          void speakWinnerCallout({
            prizeAmount: Number(data.state.winner.prizeAmount ?? 0),
            memberName: data.state.winner.memberName,
            ticketNo: data.state.winner.ticketNo,
            lang: nextVoiceLang,
          });
        }
        const best = data.state?.currentHighestBid;
        if (best) {
          const bidKey = `${best.memberId}:${best.bidAmount}`;
          if (bidKey !== lastSpokenBidKeyRef.current) {
            lastSpokenBidKeyRef.current = bidKey;
            void speakBidCallout({
              prizeAmount: Number(best.bidAmount ?? 0),
              memberName: best.memberName,
              ticketNo: best.ticketNo,
              lang: nextVoiceLang,
            });
          }
        }
        setState(data.state);
        if (!userEditedRef.current && data.state?.bidBounds?.nextValidPrize) {
          setPrizeInput(Number(data.state.bidBounds.nextValidPrize));
        }
      }
    } catch {
      // transient poll error ignored
    }
  };

  useEffect(() => {
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, auctionId]);

  const clampReversePrize = (raw: number) => {
    if (!Number.isFinite(raw)) return maxPrize;
    return Math.max(minPrize, Math.min(maxPrize, raw));
  };

  const handleJoin = async () => {
    setBusy('join');
    setError('');
    try {
      const res = await fetch(`/api/borrower/chits/${groupId}/auctions/${auctionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not join room');
      await poll();
    } catch (e: any) {
      setError(e.message || 'Could not join');
    }
    setBusy('');
  };

  const handleBid = async (amount: number, source: 'tap' | 'voice' = 'tap', transcript?: string) => {
    const validated = clampReversePrize(amount);
    setBusy('bid');
    setError('');
    setNotice('');
    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await fetch(`/api/borrower/chits/${groupId}/auctions/${auctionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bid', prizeAmount: validated, source, transcript, idempotencyKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bid rejected');
      userEditedRef.current = false;
      setNotice(`Bid placed at ${formatCurrency(validated, currencySymbol)}`);
      await poll();
    } catch (e: any) {
      setError(e.message || 'Bid failed');
    }
    setBusy('');
  };

  const handleSendText = async (overrideText?: string) => {
    const text = (overrideText ?? chatText).trim();
    if (!text) return;
    setBusy('chat');
    setError('');
    try {
      const res = await fetch(`/api/borrower/chits/${groupId}/auctions/${auctionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'message', body: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Message failed');
      if (!overrideText) setChatText('');
      await poll();
    } catch (e: any) {
      setError(e.message || 'Message failed');
    }
    setBusy('');
  };

  const startVoiceNote = async () => {
    if (recording) return;
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch {}
        }
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const dur = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
        const transcript = transcriptRef.current.trim();
        if (blob.size > 0) {
          setBusy('voice');
          const fd = new FormData();
          fd.set('audio', new File([blob], mimeType.includes('webm') ? 'voice.webm' : 'voice.m4a', { type: mimeType }));
          fd.set('durationSec', String(dur));
          if (transcript) fd.set('transcript', transcript);
          try {
            const res = await fetch(`/api/borrower/chits/${groupId}/auctions/${auctionId}`, {
              method: 'POST',
              body: fd,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Voice upload failed');
            await poll();
          } catch (e: any) {
            setError(e.message || 'Voice upload failed');
          }
          setBusy('');
        }
        transcriptRef.current = '';
        setRecording(false);
        setRecordSeconds(0);
        setLiveTranscript('');
      };

      // Best-effort browser STT for live transcript preview alongside audio clip
      transcriptRef.current = '';
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.lang = voiceLanguageBcp47(effectiveVoiceLang);
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
        const secs = Math.round((Date.now() - recordStartRef.current) / 1000);
        setRecordSeconds(secs);
        if (secs >= 25) recorder.stop();
      }, 500);
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch {
      setError('Microphone permission denied or unavailable on this browser.');
    }
  };

  const stopVoiceNote = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const roomVoiceLang = normalizeVoiceLanguageCode(state?.voiceSettings?.language);
  const allowMemberVoiceChange = Boolean(state?.voiceSettings?.allowMemberChange);
  const effectiveVoiceLang = resolveRoomEffectiveVoiceLang({
    roomLanguage: roomVoiceLang,
    allowMemberChange: allowMemberVoiceChange,
    customerOverride: customerVoiceOverride,
  });
  const borrowerChatStrings = getRoomChatStrings(effectiveVoiceLang);
  const secsLeft = Number(state?.secondsRemaining ?? 0);
  const currentBest = state?.currentHighestBid;
  const chitValue = Number(state?.chitValue ?? 0);
  const templatePrizes = (bounds?.templatePrizes ?? []) as Array<{
    label: string;
    prizeAmount: number;
    discountAmount: number;
    discountPct: number;
  }>;

  return (
    <div
      style={
        {
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          '--primary': '#27AE60',
          '--primary-dark': '#1E8449',
          '--primary-light': '#EAFAF1',
          '--primary-border': '#BBF7D0',
          '--primary-tint': '#DCFCE7',
        } as React.CSSProperties
      }
    >
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontWeight: 600 }}>
          {error}
        </div>
      )}
      {notice && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#F0FDF4', border: '1px solid #86EFAC', color: '#166534', fontWeight: 600 }}>
          {notice}
        </div>
      )}

      {/* Top 4 KPI Summary Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>CHIT VALUE</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A' }}>{formatCurrency(chitValue, currencySymbol)}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>TIME REMAINING</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: roomOpen ? 'var(--primary)' : '#64748B', fontFamily: 'monospace' }}>
            {roomOpen ? `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}` : state?.roomStatus}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>LEADING PRIZE BID</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#15803D' }}>
            {currentBest ? formatCurrency(currentBest.bidAmount, currencySymbol) : `Floor ${formatCurrency(maxPrize, currencySymbol)}`}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>BELL STATUS</div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  const nextVoice = !voiceEnabled;
                  setVoiceEnabled(nextVoice);
                  setBidVoiceEnabled(nextVoice);
                  if (nextVoice) void warmUpBidVoiceEngine();
                }}
                style={{
                  border: '1px solid #CBD5E1',
                  background: voiceEnabled ? 'var(--primary-light)' : '#F8FAFC',
                  color: voiceEnabled ? 'var(--primary-dark)' : '#64748B',
                  borderRadius: '999px',
                  padding: '2px 8px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {voiceEnabled ? '🗣️ Voice ON' : '🔇 Voice Off'}
              </button>
              {voiceEnabled &&
                (allowMemberVoiceChange ? (
                  <select
                    aria-label="Live Voice Language"
                    value={effectiveVoiceLang}
                    onChange={(e) => {
                      const nextCode = e.target.value as BidVoiceLanguageCode;
                      setCustomerVoiceOverride(nextCode);
                      setCustomerVoiceLanguageOverride(nextCode);
                      void warmUpBidVoiceEngine();
                    }}
                    style={{
                      border: '1px solid #CBD5E1',
                      background: '#F8FAFC',
                      color: '#0F172A',
                      borderRadius: '999px',
                      padding: '2px 6px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                    }}
                  >
                    {BID_VOICE_LANGUAGES.map((vl) => (
                      <option key={vl.code} value={vl.code}>
                        {vl.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    title="Voice language fixed by Foreman"
                    style={{
                      border: '1px solid var(--primary-border)',
                      background: 'var(--primary-light)',
                      color: 'var(--primary-dark)',
                      borderRadius: '999px',
                      padding: '2px 7px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                    }}
                  >
                    🔒 {BID_VOICE_LANGUAGES.find((vl) => vl.code === effectiveVoiceLang)?.label ?? 'EN (IN)'}
                  </span>
                ))}
              <button
                type="button"
                onClick={() => {
                  const nextMuted = !soundMuted;
                  setSoundMuted(nextMuted);
                  setBellSoundMuted(nextMuted);
                  if (!nextMuted) playAuctionBellChime(1, 3, { force: true });
                }}
                style={{
                  border: '1px solid #CBD5E1',
                  background: '#F8FAFC',
                  borderRadius: '999px',
                  padding: '2px 8px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {soundMuted ? '🔇 Muted' : '🔊 Sound ON'}
              </button>
            </div>
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A' }}>
            🔔 {state?.bell?.bellsRung ?? 0} / {state?.bell?.bellCount ?? 3}
          </div>
        </div>
      </div>

      {state?.winner && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '14px',
            background: '#F0FDF4',
            border: '1.5px solid #22C55E',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#15803D', textTransform: 'uppercase' }}>
              🏆 Period Winner Confirmed &amp; Announced
            </div>
            <div style={{ fontSize: '1.12rem', fontWeight: 800, color: '#0F172A' }}>
              Ticket #{state.winner.ticketNo} · {state.winner.memberName}
            </div>
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#15803D' }}>
            Prize: {formatCurrency(Number(state.winner.prizeAmount ?? 0), currencySymbol)}
          </div>
        </div>
      )}

      {/* Live Poker Table Arena */}
      <div style={{ marginBottom: '18px' }}>
        <PokerTableArena
          periodNumber={Number(state?.periodNumber ?? 1)}
          chitValue={chitValue}
          currencySymbol={currencySymbol}
          roomStatus={state?.roomStatus}
          isOpen={roomOpen}
          secondsRemaining={secsLeft}
          bell={state?.bell}
          confirmedWinner={
            state?.winner
              ? {
                  ticketNo: state.winner.ticketNo,
                  memberName: state.winner.memberName,
                  prizeAmount: Number(state.winner.prizeAmount ?? 0),
                }
              : null
          }
          highestBid={
            currentBest
              ? {
                  ticketNo: currentBest.ticketNo,
                  memberName: currentBest.memberName,
                  prizeAmount: currentBest.bidAmount,
                }
              : null
          }
          seats={(state?.seats ?? [])
            .filter((s: any) => !s.hasWon)
            .map((s: any) => ({
            memberId: s.memberId,
            ticketNo: s.ticketNo,
            name: s.memberName ?? s.name ?? 'Member',
            photoUrl: s.profilePhoto ?? null,
            isOnline: Boolean(!s.passed && (s.latestPrize != null || s.isMe || s.isOnline)),
            isLeader: Boolean(currentBest && currentBest.memberId === s.memberId),
            hasWon: Boolean(s.hasWon),
            isMe: Boolean(s.isMe),
            latestPrize: s.latestPrize ?? null,
          }))}
        />
      </div>

      {/* 2 Clean Workflow Containers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px', alignItems: 'start' }}>
        {/* Left Container: Automated Reverse Bidding & Live Status */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>Live Automated Bidding</h2>
            {canJoin && (
              <button
                type="button"
                onClick={handleJoin}
                disabled={busy === 'join'}
                style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
              >
                {busy === 'join' ? 'Joining…' : 'Enter Bidding Room'}
              </button>
            )}
          </div>

          {me?.hasWon && (
            <div style={{ padding: '12px', borderRadius: '10px', background: '#F0FDF4', color: '#166534', fontWeight: 600 }}>
              You have already won a pot in this group — watching in spectator mode.
            </div>
          )}

          {canBid && (
            <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-border)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary-dark)', marginBottom: '6px' }}>
                <span>REVERSE BIDDING (PRIZE ONLY DECREASES)</span>
                <span>MAX ALLOWED: {formatCurrency(maxPrize, currencySymbol)}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-dark)' }}>{currencySymbol}</div>
                <input
                  type="number"
                  min={minPrize}
                  max={maxPrize}
                  value={prizeInput}
                  onChange={(e) => {
                    userEditedRef.current = true;
                    setPrizeInput(clampReversePrize(Number(e.target.value)));
                  }}
                  style={{
                    flex: '1 1 180px',
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '2px solid var(--primary)',
                    color: '#0F172A',
                    background: '#fff',
                  }}
                />
                <button
                  type="button"
                  disabled={busy === 'bid'}
                  onClick={() => handleBid(prizeInput)}
                  style={{
                    padding: '12px 22px',
                    borderRadius: '10px',
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '1rem',
                    cursor: 'pointer',
                  }}
                >
                  {busy === 'bid' ? 'Placing…' : 'Place Bid'}
                </button>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--primary-dark)', fontWeight: 600, marginBottom: '10px' }}>
                Discount Offered: {formatCurrency(Math.max(0, chitValue - prizeInput), currencySymbol)} (
                {chitValue > 0 ? (((chitValue - prizeInput) / chitValue) * 100).toFixed(1) : '0'}%)
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {templatePrizes.map((tp) => (
                  <button
                    key={tp.prizeAmount}
                    type="button"
                    disabled={busy === 'bid'}
                    onClick={() => handleBid(tp.prizeAmount)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '10px',
                      background: '#fff',
                      border: '1px solid var(--primary-border)',
                      color: 'var(--primary-dark)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontSize: '0.95rem' }}>{formatCurrency(tp.prizeAmount, currencySymbol)}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{tp.label} ({tp.discountPct}%)</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!roomOpen && (
            <div style={{ padding: '12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569' }}>
              Room is currently <strong>{state?.roomStatus}</strong>. You can still message in the chat room.
            </div>
          )}
        </div>

        {/* Right Container: Members Voice & Text Live Chat Room */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
              💬 Members Live Chat (Voice &amp; Text)
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
              {(state?.latestMessages ?? []).length} msgs
            </span>
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px', background: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(state?.latestMessages ?? []).length === 0 ? (
              <div style={{ color: '#64748B', fontSize: '0.85rem' }}>No messages yet. Say hello or drop a voice note!</div>
            ) : (
              (state?.latestMessages ?? []).map((m: any) => (
                <div key={m.id} style={{ background: '#fff', borderRadius: '8px', padding: '8px 10px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748B', marginBottom: '2px' }}>
                    <strong style={{ color: '#0F172A' }}>{m.senderName}</strong>
                    <span>{new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {m.audioUrl && (
                    <div style={{ marginTop: '4px', marginBottom: '4px' }}>
                      <audio controls preload="none" src={m.audioUrl} style={{ width: '100%', height: '34px' }} />
                    </div>
                  )}
                  <div style={{ fontSize: '0.88rem', color: '#1E293B' }}>{m.body}</div>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['Calling Min Floor', 'Going Lower', 'I am passing this round'].map((quick) => (
              <button
                key={quick}
                type="button"
                disabled={!!busy}
                onClick={() => handleSendText(quick)}
                style={{ padding: '4px 10px', borderRadius: '999px', border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', color: '#334155' }}
              >
                {quick}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={recording ? stopVoiceNote : startVoiceNote}
              disabled={busy === 'voice'}
              style={{
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid ' + (recording ? '#DC2626' : 'var(--primary)'),
                background: recording ? '#FEE2E2' : 'var(--primary-light)',
                color: recording ? '#991B1B' : 'var(--primary-dark)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              {recording ? `⏹ Stop (${recordSeconds}s)` : busy === 'voice' ? 'Uploading…' : '🎙️ Voice Note'}
            </button>
            <input
              type="text"
              placeholder={borrowerChatStrings.placeholderBidding}
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && chatText.trim() && busy !== 'chat') {
                  handleSendText();
                }
              }}
              style={{ flex: '1 1 180px', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem' }}
            />
            <button
              type="button"
              disabled={busy === 'chat' || !chatText.trim()}
              onClick={() => handleSendText()}
              style={{ padding: '9px 16px', borderRadius: '8px', background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
            >
              {borrowerChatStrings.sendBtn}
            </button>
          </div>
          {recording && liveTranscript && (
            <div style={{ fontSize: '0.78rem', color: 'var(--primary-dark)', fontStyle: 'italic' }}>
              Transcript preview: &ldquo;{liveTranscript}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
