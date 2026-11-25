'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/utils';

type Props = {
  groupId: string;
  auctionId: string;
  initialState: any;
  currencySymbol: string;
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const userEditedRef = useRef(false);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: roomOpen ? '#7D287E' : '#64748B', fontFamily: 'monospace' }}>
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
          <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>BELL STATUS</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A' }}>
            🔔 {state?.bell?.bellsRung ?? 0} / {state?.bell?.bellCount ?? 3}
          </div>
        </div>
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
                style={{ padding: '8px 16px', borderRadius: '8px', background: '#7D287E', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
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
            <div style={{ background: '#F9F1FA', border: '1px solid #E9D5EC', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: '#5A195B', marginBottom: '6px' }}>
                <span>REVERSE BIDDING (PRIZE ONLY DECREASES)</span>
                <span>MAX ALLOWED: {formatCurrency(maxPrize, currencySymbol)}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#5A195B' }}>{currencySymbol}</div>
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
                    border: '2px solid #7D287E',
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
                    background: '#7D287E',
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
              <div style={{ fontSize: '0.82rem', color: '#5A195B', fontWeight: 600, marginBottom: '10px' }}>
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
                      border: '1px solid #C084FC',
                      color: '#5A195B',
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
                border: '1px solid ' + (recording ? '#DC2626' : '#7D287E'),
                background: recording ? '#FEE2E2' : '#F9F1FA',
                color: recording ? '#991B1B' : '#7D287E',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              {recording ? `⏹ Stop (${recordSeconds}s)` : busy === 'voice' ? 'Uploading…' : '🎙️ Voice Note'}
            </button>
            <input
              type="text"
              placeholder="Message members or call a bid..."
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
              style={{ padding: '9px 16px', borderRadius: '8px', background: '#7D287E', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
            >
              Send
            </button>
          </div>
          {recording && liveTranscript && (
            <div style={{ fontSize: '0.78rem', color: '#5A195B', fontStyle: 'italic' }}>
              Transcript preview: &ldquo;{liveTranscript}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
