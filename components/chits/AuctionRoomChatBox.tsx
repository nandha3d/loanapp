'use client';

import React, { useRef, useState } from 'react';

export interface RoomChatMessage {
  id: string;
  senderName: string;
  visibility: string;
  messageType?: string;
  body: string;
  audioUrl?: string | null;
  audioDurationSec?: number | null;
  createdAt: string;
}

interface WaitingMemberItem {
  memberId: string;
  name: string;
}

interface Props {
  messages: RoomChatMessage[];
  waiting: WaitingMemberItem[];
  busy: string;
  locked: boolean;
  onSendText: (body: string, visibility: 'public' | 'organizer') => Promise<void>;
  onSendVoice: (file: File, durationSec: number, transcript: string, visibility: 'public' | 'organizer') => Promise<void>;
  onDecideAdmission?: (memberId: string, decision: 'admit' | 'deny') => void;
  onError?: (msg: string) => void;
}

export default function AuctionRoomChatBox({
  messages,
  waiting,
  busy,
  locked,
  onSendText,
  onSendVoice,
  onDecideAdmission,
  onError,
}: Props) {
  const [chatBody, setChatBody] = useState('');
  const [chatToOrganizer, setChatToOrganizer] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');

  const sendText = async (overrideText?: string) => {
    const text = (overrideText ?? chatBody).trim();
    if (!text || busy) return;
    await onSendText(text, chatToOrganizer ? 'organizer' : 'public');
    if (!overrideText) setChatBody('');
  };

  const startRecording = async () => {
    if (recording || locked || busy) return;
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
          const ext = mimeType.includes('webm') ? 'webm' : 'm4a';
          const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType });
          await onSendVoice(file, dur, transcript, chatToOrganizer ? 'organizer' : 'public');
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
        const secs = Math.round((Date.now() - recordStartRef.current) / 1000);
        setRecordSeconds(secs);
        if (secs >= 25) recorder.stop();
      }, 500);
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch {
      onError?.('Microphone permission denied or unavailable on this browser.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <div
      style={{
        borderRadius: '12px',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            💬 Members Live Chat Room (Voice &amp; Text)
          </h3>
          {waiting.length > 0 && (
            <span className="badge badge-warning">{waiting.length} waiting</span>
          )}
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {messages.length} message{messages.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Waiting-room approval queue */}
      {waiting.length > 0 && onDecideAdmission && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {waiting.map((w) => (
            <div
              key={w.memberId}
              style={{
                display: 'inline-flex',
                gap: '6px',
                alignItems: 'center',
                padding: '4px 10px',
                borderRadius: '999px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
              }}
            >
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{w.name}</span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!!busy}
                onClick={() => onDecideAdmission(w.memberId, 'admit')}
              >
                Admit
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={!!busy}
                onClick={() => onDecideAdmission(w.memberId, 'deny')}
              >
                Deny
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Scrollable Chat History */}
      <div
        style={{
          maxHeight: '260px',
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '10px 12px',
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {messages.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>
            No messages yet. Members and organizers can chat by voice or text here.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              style={{
                background: m.visibility === 'organizer' ? '#FFFBEB' : 'var(--surface)',
                border: `1px solid ${m.visibility === 'organizer' ? '#FDE68A' : 'var(--border)'}`,
                borderRadius: '8px',
                padding: '8px 10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', marginBottom: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{m.senderName}</strong>
                  {m.visibility === 'organizer' && (
                    <span className="badge badge-warning">staff-only</span>
                  )}
                  {(m.messageType === 'voice' || m.audioUrl) && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '999px',
                        background: 'var(--primary-light)',
                        color: 'var(--primary-dark)',
                      }}
                    >
                      🎙️ Voice{m.audioDurationSec ? ` ${m.audioDurationSec}s` : ''}
                    </span>
                  )}
                </div>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {m.audioUrl && (
                <div style={{ margin: '4px 0' }}>
                  <audio controls preload="none" src={m.audioUrl} style={{ width: '100%', height: '32px' }} />
                </div>
              )}
              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{m.body}</div>
            </div>
          ))
        )}
      </div>

      {!locked && (
        <>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['Going once!', 'Going twice!', 'Any lower bid?', 'Last 30 seconds'].map((quick) => (
              <button
                key={quick}
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!!busy}
                onClick={() => sendText(quick)}
                style={{ fontSize: '0.75rem', borderRadius: '999px', border: '1px solid var(--border)' }}
              >
                {quick}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={busy === 'voice'}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: `1px solid ${recording ? 'var(--danger)' : 'var(--primary)'}`,
                background: recording ? '#FEE2E2' : 'var(--primary-light)',
                color: recording ? 'var(--danger)' : 'var(--primary-dark)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {recording ? `⏹ Stop (${recordSeconds}s)` : busy === 'voice' ? 'Uploading…' : '🎙️ Record Voice'}
            </button>
            <input
              type="text"
              className="form-control"
              placeholder="Message members or announce floor…"
              value={chatBody}
              onChange={(e) => setChatBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && chatBody.trim() && !busy) {
                  sendText();
                }
              }}
              style={{ flex: '1 1 200px' }}
            />
            <label style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={chatToOrganizer} onChange={(e) => setChatToOrganizer(e.target.checked)} />
              Staff only
            </label>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!!busy || !chatBody.trim()}
              onClick={() => sendText()}
            >
              {busy === 'chat' ? 'Sending…' : 'Send'}
            </button>
          </div>
          {recording && liveTranscript && (
            <div style={{ fontSize: '0.78rem', color: 'var(--primary-dark)', fontStyle: 'italic' }}>
              Live transcript: &ldquo;{liveTranscript}&rdquo;
            </div>
          )}
        </>
      )}
    </div>
  );
}
