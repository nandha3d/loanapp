'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PeriodRoomMode } from '@/lib/chits/engineTypes';
import {
  BID_VOICE_LANGUAGES,
  getRoomChatStrings,
  normalizeVoiceLanguageCode,
  voiceLanguageBcp47,
  type BidVoiceLanguageCode,
} from '@/lib/chits/bidVoiceAnnouncer';
import { formatCurrency } from '@/lib/utils';

export interface RoomChatMessage {
  id: string;
  senderName: string;
  visibility: string;
  messageType?: string;
  body: string;
  audioUrl?: string | null;
  audioDurationSec?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

interface WaitingMemberItem {
  memberId: string;
  name: string;
}

interface EligibleBidderItem {
  id: string;
  memberNumber: number;
  ticketNo?: string | null;
  customer: { name: string };
}

export interface RoomMemberRosterItem {
  memberId: string;
  ticketNo: string | number;
  ticketNos?: string[];
  name: string;
  photoUrl?: string | null;
  isOnline: boolean;
  hasWon: boolean;
  isLeading?: boolean;
  latestPrize?: number | null;
  wonPeriodNumber?: number | null;
  wonDate?: string | null;
  wonPrizeAmount?: number | null;
  wonPayoutStatus?: string | null;
  attendanceStatus?: string;
  onMarkAttendance?: (status: 'present' | 'absent' | 'proxy') => void;
  onSelect?: () => void;
}

export interface RoomActivityEntry {
  id: string;
  kind: string;
  type?: string;
  bidStatus?: string;
  ticketNo?: string | number | null;
  memberName?: string | null;
  amount?: number | null;
  message?: string | null;
  senderName?: string | null;
  body?: string | null;
  createdAt: string;
}

interface Props {
  messages: RoomChatMessage[];
  waiting: WaitingMemberItem[];
  busy: string;
  locked: boolean;
  onSendText: (body: string, visibility: 'public' | 'organizer') => Promise<void>;
  onSendVoice: (
    file: File,
    durationSec: number,
    transcript: string,
    visibility: 'public' | 'organizer',
  ) => Promise<void>;
  onDecideAdmission?: (memberId: string, decision: 'admit' | 'deny') => void;
  onError?: (msg: string) => void;
  roomMode?: PeriodRoomMode;
  variant?: 'default' | 'studio';
  showVoiceControlBar?: boolean;
  currencySymbol?: string;
  activityFeed?: RoomActivityEntry[];
  activityLoading?: boolean;
  onRefreshActivity?: () => void;
  membersPanel?: RoomMemberRosterItem[];
  biddingDisabledReason?: string;
  onStartLive?: () => void;
  startLiveLabel?: string;
  startLiveIcon?: string;
  startLiveBusy?: boolean;
  /** Foreman-controlled speech & chat language + whether customers may override it */
  voiceControl?: {
    language: BidVoiceLanguageCode;
    allowMemberChange: boolean;
    saving?: boolean;
    onChangeLanguage: (lang: BidVoiceLanguageCode) => void;
    onToggleAllowMemberChange: (allow: boolean) => void;
  };
  /** Optional interactive Chat-to-Bid controls synced with the live auction console */
  bidding?: {
    enabled: boolean;
    currencySymbol: string;
    chitValue: number;
    minPrize: number;
    maxPrize: number;
    quickOptions: number[];
    eligibleBidders: EligibleBidderItem[];
    selectedMemberId: string;
    onSelectMemberId: (id: string) => void;
    onPlaceBid: (prizeAmount: number, explicitMemberId?: string) => Promise<void> | void;
  };
}

/**
 * Extracts a numeric bid intent from natural chat messages like `92500`, `92,500`,
 * `bid 92000`, or `92.5k`, returning null if no plausible prize number sits in range.
 */
export function parseBidAmountFromChat(text: string, minPrize: number, maxPrize: number): number | null {
  const cleaned = text.trim();
  if (!cleaned) return null;

  // Match e.g. `92.5k` or `92k` first
  const kMatch = cleaned.match(/\b(\d{1,4}(?:\.\d{1,2})?)\s*k\b/i);
  if (kMatch) {
    const val = Math.round(Number(kMatch[1]) * 1000);
    if (Number.isFinite(val) && val >= minPrize && val <= maxPrize) return val;
  }

  // Match plain integers / comma numbers e.g. `92,500` or `92500`
  const nums = cleaned.match(/\d[\d,]{2,}/g);
  if (!nums) return null;
  for (const raw of nums) {
    const val = Math.round(Number(raw.replace(/,/g, '')));
    if (Number.isFinite(val) && val >= minPrize && val <= maxPrize) return val;
  }
  return null;
}

interface SpeechRecognitionAlternativeLike {
  transcript?: string;
}

interface SpeechRecognitionResultEventLike {
  results: ArrayLike<ArrayLike<SpeechRecognitionAlternativeLike>>;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SpeechRecognitionResultEventLike) => void) | null;
  start: () => void;
  stop: () => void;
}

function formatRelativeStudioTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 45) return 'Now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function getDockActivityBadge(
  entry: RoomActivityEntry,
  index: number,
  sym: string,
): {
  icon: string;
  bg: string;
  color: string;
  title: string;
  subtitlePrefix: string;
  amountText?: string;
} {
  if (entry.kind === 'bid') {
    const who = `${entry.memberName ?? 'Member'} (Seat ${entry.ticketNo ?? '?'})`;
    const amt = formatCurrency(Number(entry.amount ?? 0), sym);
    if (entry.bidStatus === 'retracted') {
      return {
        icon: 'undo',
        bg: '#fee2e2',
        color: '#dc2626',
        title: who,
        subtitlePrefix: 'retracted bid of ',
        amountText: amt,
      };
    }
    if (index === 0 || entry.bidStatus === 'winning') {
      return {
        icon: 'emoji_events',
        bg: '#dcfce7',
        color: '#16a34a',
        title: who,
        subtitlePrefix: 'is leading with ',
        amountText: amt,
      };
    }
    return {
      icon: 'flag',
      bg: '#fef3c7',
      color: '#d97706',
      title: who,
      subtitlePrefix: 'placed a bid of ',
      amountText: amt,
    };
  }
  if (entry.kind === 'message') {
    return {
      icon: 'groups',
      bg: '#e0f2fe',
      color: '#0284c7',
      title: entry.senderName ?? 'Member',
      subtitlePrefix: entry.body || 'sent a voice note',
    };
  }
  const icon =
    entry.type === 'confirm'
      ? 'emoji_events'
      : entry.type === 'bell'
        ? 'notifications_active'
        : entry.type === 'open'
          ? 'play_circle'
          : entry.type === 'close'
            ? 'stop_circle'
            : entry.type === 'extend'
              ? 'update'
              : 'arrow_upward';
  return {
    icon,
    bg: entry.type === 'bell' ? '#fef3c7' : '#ecfdf5',
    color: entry.type === 'bell' ? '#d97706' : '#059669',
    title: entry.type ? entry.type.toUpperCase() : 'Room Update',
    subtitlePrefix: entry.message || 'Live room event',
  };
}

function formatDockActivityIcon(entry: RoomActivityEntry): string {
  if (entry.kind === 'message') return '💬';
  if (entry.kind === 'bid') return entry.bidStatus === 'retracted' ? '↩' : '💰';
  switch (entry.type) {
    case 'open':
      return '🟢';
    case 'close':
      return '🔴';
    case 'extend':
      return '⏱️';
    case 'bell':
      return '🔔';
    case 'confirm':
      return '🏆';
    default:
      return '•';
  }
}

function formatDockActivityText(entry: RoomActivityEntry, currencySymbol: string): string {
  if (entry.kind === 'message') {
    const who = entry.senderName ?? 'Member';
    return entry.body ? `${who}: ${entry.body}` : `${who} sent a voice message`;
  }
  if (entry.kind === 'bid') {
    const label = `#${entry.ticketNo ?? '?'} ${entry.memberName ?? 'Member'}`;
    const amt = formatCurrency(Number(entry.amount ?? 0), currencySymbol);
    return entry.bidStatus === 'retracted' ? `${label} retracted bid ${amt}` : `${label} bid ${amt}`;
  }
  return entry.message || entry.type || 'Event';
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
  roomMode = 'OPEN_AUCTION',
  variant = 'default',
  showVoiceControlBar,
  currencySymbol,
  activityFeed,
  activityLoading = false,
  onRefreshActivity,
  membersPanel,
  biddingDisabledReason,
  onStartLive,
  startLiveLabel,
  startLiveIcon,
  startLiveBusy = false,
  voiceControl,
  bidding,
}: Props) {
  const isStudio = variant === 'studio';
  const activeChatLang = normalizeVoiceLanguageCode(voiceControl?.language);
  const chatCopy = getRoomChatStrings(activeChatLang);
  const [dockTab, setDockTab] = useState<'chat' | 'activity' | 'members'>(() =>
    isStudio && activityFeed ? 'activity' : 'chat',
  );
  const [selectedQuickPrize, setSelectedQuickPrize] = useState<number | null>(null);
  const [customBidOpen, setCustomBidOpen] = useState(false);
  const [customBidInput, setCustomBidInput] = useState('');
  const [chatBody, setChatBody] = useState('');
  const [chatToOrganizer, setChatToOrganizer] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'voice' | 'staff'>('all');
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptRef = useRef('');
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  const detectedDraftBid = useMemo(() => {
    if (!bidding?.enabled || locked) return null;
    return parseBidAmountFromChat(chatBody, bidding.minPrize, bidding.maxPrize);
  }, [bidding, chatBody, locked]);

  const filteredMessages = useMemo(() => {
    if (filterTab === 'voice') {
      return messages.filter((m) => m.messageType === 'voice' || Boolean(m.audioUrl));
    }
    if (filterTab === 'staff') {
      return messages.filter((m) => m.visibility === 'organizer');
    }
    return messages;
  }, [messages, filterTab]);

  const sendText = async (overrideText?: string) => {
    const text = (overrideText ?? chatBody).trim();
    if (!text || busy) return;
    await onSendText(text, chatToOrganizer ? 'organizer' : 'public');
    if (!overrideText) setChatBody('');
  };

  const handleQuickBid = async (amount: number, bidderId?: string, clearDraft = false) => {
    if (!bidding?.enabled || locked || busy) return;
    const targetMemberId = bidderId || bidding.selectedMemberId;
    if (!targetMemberId) {
      onError?.('Tap a member seat around the table or pick a member in the chat bidder dropdown first.');
      return;
    }
    await bidding.onPlaceBid(amount, targetMemberId);
    if (clearDraft) setChatBody('');
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
          try {
            recognitionRef.current.stop();
          } catch {
            /* ignore */
          }
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

      const speechWindow = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
      };
      const SpeechRec = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.lang = voiceLanguageBcp47(activeChatLang);
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (ev) => {
            const text = Array.from(ev.results)
              .map((r) => r[0]?.transcript ?? '')
              .join(' ')
              .trim();
            transcriptRef.current = text;
            setLiveTranscript(text);
          };
          rec.start();
          recognitionRef.current = rec;
        } catch {
          /* ignore */
        }
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

  const sym = bidding?.currencySymbol || currencySymbol || '₹';
  const hasDockTabs = Boolean(activityFeed || membersPanel);
  const liveMembersCount = (membersPanel ?? []).filter((m) => m.isOnline).length;
  const wonMembersCount = (membersPanel ?? []).filter((m) => m.hasWon).length;

  const quickGridPrizes = useMemo(() => {
    if (!bidding) return [] as number[];
    const seen = new Set<number>();
    const list: number[] = [];
    for (const opt of bidding.quickOptions) {
      const n = Math.round(Number(opt));
      if (Number.isFinite(n) && n >= bidding.minPrize && n <= bidding.maxPrize && !seen.has(n)) {
        seen.add(n);
        list.push(n);
        if (list.length >= 5) break;
      }
    }
    if (list.length < 5 && bidding.maxPrize >= bidding.minPrize) {
      const span = Math.max(0, bidding.maxPrize - bidding.minPrize);
      const rawStep = Math.max(1000, Math.round((span / 10) / 1000) * 1000 || 5000);
      let candidate = bidding.maxPrize;
      let guard = 0;
      while (list.length < 5 && candidate >= bidding.minPrize && guard < 12) {
        if (!seen.has(candidate)) {
          seen.add(candidate);
          list.push(candidate);
        }
        candidate -= rawStep;
        guard++;
      }
    }
    return list.slice(0, 5);
  }, [bidding]);

  const effectiveStudioBidAmount = useMemo(() => {
    if (!bidding) return 0;
    if (customBidOpen) {
      const parsed = Math.round(Number(customBidInput));
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    if (selectedQuickPrize != null && selectedQuickPrize >= bidding.minPrize && selectedQuickPrize <= bidding.maxPrize) {
      return selectedQuickPrize;
    }
    return quickGridPrizes[0] ?? bidding.maxPrize;
  }, [bidding, customBidOpen, customBidInput, selectedQuickPrize, quickGridPrizes]);

  return (
    <div
      style={{
        borderRadius: '18px',
        border: isStudio ? '1px solid rgba(226, 232, 240, 0.95)' : '1.5px solid var(--border)',
        background: isStudio ? '#ffffff' : 'var(--surface)',
        overflow: 'hidden',
        boxShadow: isStudio
          ? '0 14px 32px rgba(2, 6, 23, 0.36)'
          : '0 6px 20px -8px rgba(15, 23, 42, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        color: isStudio ? '#0f172a' : undefined,
      }}
    >
      {/* Header: White Segmented Pill Bar (Studio) vs Primary Gradient (Default) */}
      <div
        style={{
          padding: isStudio ? '12px 14px 10px' : '13px 16px',
          background: isStudio
            ? '#ffffff'
            : 'linear-gradient(90deg, var(--primary-dark) 0%, var(--primary) 100%)',
          borderBottom: isStudio ? '1px solid #f1f5f9' : 'none',
          color: isStudio ? '#0f172a' : '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        {hasDockTabs ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                width: '100%',
                display: 'flex',
                gap: '4px',
                padding: '4px',
                borderRadius: '12px',
                background: isStudio ? '#f1f5f9' : 'rgba(255,255,255,0.14)',
                border: isStudio ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.2)',
                alignItems: 'center',
              }}
            >
              {activityFeed && (
                <button
                  type="button"
                  onClick={() => setDockTab('activity')}
                  style={{
                    flex: '1 1 0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    padding: '7px 8px',
                    borderRadius: '9px',
                    border: 'none',
                    background:
                      dockTab === 'activity'
                        ? 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)'
                        : 'transparent',
                    boxShadow: dockTab === 'activity' ? '0 4px 12px -2px var(--primary-glow)' : 'none',
                    color: dockTab === 'activity' ? '#ffffff' : isStudio ? '#334155' : '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '15px' }}>bolt</span>
                  Live Activity
                </button>
              )}
              <button
                type="button"
                onClick={() => setDockTab('chat')}
                style={{
                  flex: '1 1 0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  padding: '7px 8px',
                  borderRadius: '9px',
                  border: 'none',
                  background:
                    dockTab === 'chat'
                      ? 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)'
                      : 'transparent',
                  boxShadow: dockTab === 'chat' ? '0 4px 12px -2px var(--primary-glow)' : 'none',
                  color: dockTab === 'chat' ? '#ffffff' : isStudio ? '#334155' : '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '15px' }}>chat_bubble_outline</span>
                Chat ({messages.length})
              </button>
              {membersPanel && (
                <button
                  type="button"
                  onClick={() => setDockTab('members')}
                  style={{
                    flex: '1 1 0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    padding: '7px 8px',
                    borderRadius: '9px',
                    border: 'none',
                    background:
                      dockTab === 'members'
                        ? 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)'
                        : 'transparent',
                    boxShadow: dockTab === 'members' ? '0 4px 12px -2px var(--primary-glow)' : 'none',
                    color: dockTab === 'members' ? '#ffffff' : isStudio ? '#334155' : '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '15px' }}>groups</span>
                  Members ({membersPanel.length})
                </button>
              )}
            </div>
            {waiting.length > 0 && (
              <span className="badge badge-warning" style={{ fontSize: '0.7rem', alignSelf: 'flex-start' }}>
                {waiting.length} waiting admission
              </span>
            )}
          </div>
        ) : (
          <div>
            <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '7px' }}>
              {roomMode === 'LOTTERY_DRAW'
                ? '🎲 Lucky Draw Group Chat'
                : roomMode === 'SEALED_TENDER'
                  ? '🔒 Sealed Tender Chat'
                  : roomMode === 'CONSENSUS'
                    ? '🤝 Consensus Room Chat'
                    : roomMode === 'FIXED_ROTATION'
                      ? '🔄 Cycle Turn Chat'
                      : '💬 Live Auction Chat & Quick Bid'}
              {waiting.length > 0 && (
                <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                  {waiting.length} waiting
                </span>
              )}
            </h3>
            <div style={{ fontSize: '0.75rem', opacity: 0.9, marginTop: '2px' }}>
              Text, voice notes, floor callouts &amp; 1-tap bidding directly from chat
            </div>
          </div>
        )}

        {dockTab === 'chat' && (
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
              {(['all', 'voice', 'staff'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterTab(tab)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 9px',
                    borderRadius: '999px',
                    border: isStudio ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.2)',
                    background:
                      filterTab === tab
                        ? isStudio
                          ? '#0f172a'
                          : '#ffffff'
                        : isStudio
                          ? '#f8fafc'
                          : 'rgba(255,255,255,0.07)',
                    color:
                      filterTab === tab
                        ? isStudio
                          ? '#ffffff'
                          : '#0f172a'
                        : isStudio
                          ? '#475569'
                          : '#cbd5e1',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {tab === 'all' ? `All (${messages.length})` : tab === 'voice' ? '🎙️ Voice' : 'Staff'}
                </button>
              ))}
            </div>
            {voiceControl && !(showVoiceControlBar ?? !isStudio) && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: isStudio ? '#475569' : '#94a3b8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Synced with room header Voice & Chat language control"
              >
                <span className="material-icons-outlined" style={{ fontSize: '13px', color: 'var(--primary)' }}>
                  {voiceControl.allowMemberChange ? 'lock_open' : 'lock'}
                </span>
                {BID_VOICE_LANGUAGES.find((vl) => vl.code === activeChatLang)?.label ?? 'EN'}
              </span>
            )}
          </div>
        )}
        {voiceControl && (showVoiceControlBar ?? !isStudio) && dockTab === 'chat' && (
          <div
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              flexWrap: 'wrap',
              paddingTop: '6px',
              borderTop: isStudio ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.14)',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.71rem', fontWeight: 700, opacity: 0.9 }}>
                🌐 Voice &amp; Chat:
              </span>
              <select
                aria-label="Room Voice and Chat Language"
                title="Foreman room speech & chat language (independent of app UI language)"
                disabled={voiceControl.saving}
                value={voiceControl.language}
                onChange={(e) => voiceControl.onChangeLanguage(e.target.value as BidVoiceLanguageCode)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.28)',
                  background: '#ffffff',
                  color: 'var(--primary-dark)',
                  fontSize: '0.73rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {BID_VOICE_LANGUAGES.map((vl) => (
                  <option key={vl.code} value={vl.code}>
                    {vl.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={voiceControl.saving}
              onClick={() => voiceControl.onToggleAllowMemberChange(!voiceControl.allowMemberChange)}
              title={
                voiceControl.allowMemberChange
                  ? 'Members can switch their own voice language — click to lock to Foreman language'
                  : 'Fixed by Foreman — members hear only this language. Click to allow members to change.'
              }
              style={{
                padding: '3px 9px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.28)',
                background: voiceControl.allowMemberChange
                  ? 'rgba(34, 197, 94, 0.22)'
                  : 'rgba(15, 23, 42, 0.45)',
                color: '#ffffff',
                fontSize: '0.69rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {voiceControl.allowMemberChange ? '🔓 Members Can Change' : '🔒 Fixed for Members'}
            </button>
          </div>
        )}
      </div>

      {/* Waiting-Room Approval Strip */}
      {waiting.length > 0 && onDecideAdmission && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--warning-bg)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--warning)' }}>Waiting to enter:</span>
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
                background: 'var(--surface)',
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{w.name}</span>
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

      {/* Live Activity Feed View */}
      {dockTab === 'activity' && activityFeed && (
        <div
          style={{
            flex: '1 1 220px',
            minHeight: '200px',
            maxHeight: '340px',
            overflowY: 'auto',
            padding: isStudio ? '6px 14px 12px' : '12px 14px',
            background: isStudio ? '#ffffff' : 'var(--bg)',
            display: 'flex',
            flexDirection: 'column',
            gap: isStudio ? '10px' : '8px',
          }}
        >
          {activityFeed.length === 0 ? (
            <div style={{ margin: 'auto', color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '18px 8px' }}>
              No live activity recorded yet. Start live bidding or place the first offer.
            </div>
          ) : (
            activityFeed.map((entry, idx) => {
              const badge = getDockActivityBadge(entry, idx, sym);
              return (
                <div
                  key={`${entry.kind}-${entry.id}`}
                  style={{
                    display: 'flex',
                    gap: '11px',
                    alignItems: 'center',
                    padding: isStudio ? '6px 2px' : '8px 10px',
                    borderBottom: isStudio && idx < activityFeed.length - 1 ? '1px solid #f1f5f9' : 'none',
                    borderRadius: isStudio ? '0px' : '11px',
                    background: isStudio ? 'transparent' : 'var(--surface)',
                    border: isStudio ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: badge.bg,
                      color: badge.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '18px' }}>{badge.icon}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: '#0f172a',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {badge.title}
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {formatRelativeStudioTime(entry.createdAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '1px', wordBreak: 'break-word' }}>
                      {badge.subtitlePrefix}
                      {badge.amountText && (
                        <strong style={{ color: idx === 0 || entry.bidStatus === 'winning' ? '#d97706' : '#0f172a', fontWeight: 800 }}>
                          {badge.amountText}
                        </strong>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Members Directory View: Winners Separated Datewise at Top + Active Bidders Below */}
      {dockTab === 'members' && membersPanel && (() => {
        const winnersList = membersPanel
          .filter((m) => m.hasWon)
          .sort((a, b) => {
            const ta = a.wonDate ? new Date(a.wonDate).getTime() : 0;
            const tb = b.wonDate ? new Date(b.wonDate).getTime() : 0;
            if (tb !== ta) return tb - ta;
            return (b.wonPeriodNumber ?? 0) - (a.wonPeriodNumber ?? 0);
          });
        const activeList = membersPanel
          .filter((m) => !m.hasWon)
          .sort((a, b) => {
            if (Boolean(b.isLeading) !== Boolean(a.isLeading)) return b.isLeading ? 1 : -1;
            if (Boolean(b.isOnline) !== Boolean(a.isOnline)) return b.isOnline ? 1 : -1;
            return String(a.ticketNo).localeCompare(String(b.ticketNo), undefined, { numeric: true });
          });

        const renderMemberRow = (mem: RoomMemberRosterItem, winnerRow: boolean) => (
          <div
            key={mem.memberId}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '11px',
              background: mem.isLeading
                ? '#fef9c3'
                : winnerRow
                  ? '#fffbeb'
                  : isStudio
                    ? '#f8fafc'
                    : 'var(--surface)',
              border: mem.isLeading
                ? '1px solid #facc15'
                : winnerRow
                  ? '1px solid #fde68a'
                  : isStudio
                    ? '1px solid #e2e8f0'
                    : '1px solid var(--border)',
            }}
          >
            <div
              onClick={mem.onSelect}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: 0,
                flex: 1,
                cursor: mem.onSelect ? 'pointer' : 'default',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  overflow: 'hidden',
                  background: mem.isOnline ? 'var(--primary)' : '#475569',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  border: mem.isLeading
                    ? '2px solid #eab308'
                    : mem.isOnline
                      ? '2px solid #22c55e'
                      : '1.5px solid #cbd5e1',
                }}
              >
                {mem.photoUrl ? (
                  <img
                    src={mem.photoUrl}
                    alt={mem.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  mem.name?.[0]?.toUpperCase() ?? 'M'
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  #{mem.ticketNos && mem.ticketNos.length > 1 ? mem.ticketNos.join(',') : mem.ticketNo} {mem.name}
                </div>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap', marginTop: '2px' }}>
                  <span
                    style={{
                      fontSize: '0.67rem',
                      fontWeight: 700,
                      color: mem.isOnline ? '#16a34a' : '#64748b',
                    }}
                  >
                    {mem.isOnline ? '● LIVE' : 'Offline'}
                  </span>
                  {winnerRow && (
                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '999px',
                        background: '#fef3c7',
                        color: '#92400e',
                        border: '1px solid #fcd34d',
                      }}
                    >
                      🏆 {mem.wonPeriodNumber != null ? `P${mem.wonPeriodNumber}` : 'Won'}
                      {mem.wonDate ? ` · ${new Date(mem.wonDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}
                      {mem.wonPrizeAmount != null ? ` · ${formatCurrency(mem.wonPrizeAmount, sym)}` : ''}
                    </span>
                  )}
                  {mem.isLeading && (
                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '999px',
                        background: '#fde047',
                        color: '#713f12',
                      }}
                    >
                      👑 Leading{mem.latestPrize != null ? ` ${formatCurrency(mem.latestPrize, sym)}` : ''}
                    </span>
                  )}
                  {!mem.isLeading && mem.latestPrize != null && !winnerRow && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--primary-dark)', fontWeight: 700 }}>
                      {formatCurrency(mem.latestPrize, sym)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {!locked && mem.onMarkAttendance && (
              <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                {(['present', 'absent'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    disabled={!!busy}
                    onClick={() => mem.onMarkAttendance?.(opt)}
                    style={{
                      padding: '3px 7px',
                      borderRadius: '6px',
                      border: mem.attendanceStatus === opt ? '1px solid var(--primary)' : '1px solid #cbd5e1',
                      background: mem.attendanceStatus === opt ? 'var(--primary)' : '#ffffff',
                      color: mem.attendanceStatus === opt ? '#ffffff' : '#475569',
                      fontSize: '0.67rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {opt === 'present' ? 'P' : 'A'}
                  </button>
                ))}
              </div>
            )}
          </div>
        );

        return (
          <div
            style={{
              flex: '1 1 220px',
              minHeight: '200px',
              maxHeight: '340px',
              overflowY: 'auto',
              padding: '8px 14px 12px',
              background: isStudio ? '#ffffff' : 'var(--bg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '7px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#16a34a' }}>
                ● {liveMembersCount} Live Now
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b45309' }}>
                🏆 {wonMembersCount} Won · 🎯 {activeList.length} Bidding
              </span>
            </div>

            {winnersList.length > 0 && (
              <>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#b45309', marginTop: '2px' }}>
                  Previous Winners — Datewise ({winnersList.length})
                </div>
                {winnersList.map((mem) => renderMemberRow(mem, true))}
              </>
            )}

            {activeList.length > 0 && (
              <>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#64748b', marginTop: winnersList.length > 0 ? '4px' : '2px' }}>
                  Active Bidders ({activeList.length})
                </div>
                {activeList.map((mem) => renderMemberRow(mem, false))}
              </>
            )}
          </div>
        );
      })()}

      {/* Message Stream */}
      {dockTab === 'chat' && (
      <div
        style={{
          flex: '1 1 200px',
          minHeight: '190px',
          maxHeight: isStudio ? '290px' : '400px',
          overflowY: 'auto',
          padding: '10px 14px',
          background: isStudio ? '#f8fafc' : 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {filteredMessages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#64748b', fontSize: '0.84rem', maxWidth: '280px' }}>
            No messages yet. Type a bid (e.g. <strong>92500</strong>), tap Quick Bid below, or hold Voice to call out offers.
          </div>
        ) : (
          filteredMessages.map((m) => {
            const msgBid =
              bidding?.enabled && !locked
                ? parseBidAmountFromChat(m.body, bidding.minPrize, bidding.maxPrize)
                : null;
            const matchedBidder = msgBid
              ? bidding?.eligibleBidders.find((b) =>
                  b.customer.name.toLowerCase().includes(m.senderName.toLowerCase()) ||
                  m.senderName.toLowerCase().includes(b.customer.name.toLowerCase()),
                )
              : undefined;

            return (
              <div
                key={m.id}
                style={{
                  background: m.messageType === 'settlement_card'
                    ? '#f0fdf4'
                    : m.messageType === 'system_notice'
                      ? 'var(--primary-light)'
                      : m.visibility === 'organizer'
                        ? '#fffbeb'
                        : isStudio
                          ? '#ffffff'
                          : 'var(--surface)',
                  border: `1px solid ${
                    m.messageType === 'settlement_card'
                      ? '#22c55e'
                      : m.messageType === 'system_notice'
                        ? 'var(--primary-border)'
                        : m.visibility === 'organizer'
                          ? '#f59e0b'
                          : '#e2e8f0'
                  }`,
                  borderRadius: '11px',
                  padding: '8px 11px',
                  boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginBottom: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <strong style={{ color: '#0f172a' }}>
                      {m.messageType === 'settlement_card'
                        ? `🏆 ${m.senderName}`
                        : m.messageType === 'system_notice'
                          ? `📢 ${m.senderName}`
                          : m.senderName}
                    </strong>
                    {m.visibility === 'organizer' && <span className="badge badge-warning">staff-only</span>}
                    {(m.messageType === 'voice' || m.audioUrl) && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '1px 7px',
                          borderRadius: '999px',
                          background: 'var(--primary-light)',
                          color: 'var(--primary-dark)',
                        }}
                      >
                        🎙️ Voice{m.audioDurationSec ? ` ${m.audioDurationSec}s` : ''}
                      </span>
                    )}
                  </div>
                  <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                    {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {m.audioUrl && (
                  <div style={{ margin: '5px 0' }}>
                    <audio controls preload="none" src={m.audioUrl} style={{ width: '100%', height: '32px' }} />
                  </div>
                )}
                {m.messageType === 'settlement_card' && m.metadata ? (
                  <div style={{ fontSize: '0.82rem', color: '#0f172a', lineHeight: 1.45, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ fontWeight: 800, color: '#16a34a' }}>
                      Winner Confirmed: #{String(m.metadata.winnerTicketNo ?? '?')} {String(m.metadata.winnerName ?? '')}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                      Prize: {formatCurrency(Number(m.metadata.prizeAmount ?? 0), sym)} · Dividend:{' '}
                      {formatCurrency(Number(m.metadata.dividendPerTicket ?? 0), sym)}/ticket · Next Due:{' '}
                      {formatCurrency(Number(m.metadata.netInstallment ?? 0), sym)}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.84rem', color: '#1e293b', lineHeight: 1.4 }}>{m.body}</div>
                )}
                {msgBid != null && (
                  <div style={{ marginTop: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={!!busy}
                      style={{
                        fontSize: '0.73rem',
                        padding: '3px 9px',
                        borderRadius: '999px',
                        borderColor: 'var(--primary)',
                        background: 'var(--primary-light)',
                        color: 'var(--primary-dark)',
                        fontWeight: 700,
                      }}
                      onClick={() => handleQuickBid(msgBid, matchedBidder?.id || bidding?.selectedMemberId)}
                    >
                      🔨 Record Bid {formatCurrency(msgBid, sym)}
                      {matchedBidder ? ` (#${matchedBidder.ticketNo ?? matchedBidder.memberNumber})` : ''}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={feedEndRef} />
      </div>
      )}

      {/* Compact Chat Input Bar (when Chat tab is open) */}
      {!locked && dockTab === 'chat' && (
        <div
          style={{
            padding: '10px 14px',
            borderTop: isStudio ? '1px solid #e2e8f0' : '1px solid var(--border)',
            background: isStudio ? '#f8fafc' : 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {detectedDraftBid != null && bidding?.enabled && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                padding: '7px 10px',
                borderRadius: '10px',
                background: 'var(--success-bg)',
                border: '1px solid var(--success)',
                color: 'var(--success)',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              <span>
                Detected Bid: <strong>{formatCurrency(detectedDraftBid, sym)}</strong>
              </span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!!busy}
                onClick={() => handleQuickBid(detectedDraftBid, undefined, true)}
              >
                🔨 Place Bid &amp; Clear
              </button>
            </div>
          )}

          {/* Mode-Aware Quick Callout Chips */}
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {(roomMode === 'OPEN_AUCTION'
              ? chatCopy.quickCalloutsAuction
              : roomMode === 'LOTTERY_DRAW'
                ? chatCopy.quickCalloutsLottery
                : roomMode === 'SEALED_TENDER'
                  ? chatCopy.quickCalloutsSealed
                  : chatCopy.quickCalloutsOther
            ).map((quick) => (
              <button
                key={quick}
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!!busy}
                onClick={() => sendText(quick)}
                style={{
                  fontSize: '0.72rem',
                  borderRadius: '999px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                }}
              >
                {quick}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '7px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={busy === 'voice'}
              style={{
                padding: '7px 10px',
                borderRadius: '9px',
                border: `1.5px solid ${recording ? 'var(--danger)' : 'var(--primary-border)'}`,
                background: recording ? 'var(--danger-bg)' : 'var(--primary-light)',
                color: recording ? 'var(--danger)' : 'var(--primary-dark)',
                fontWeight: 700,
                fontSize: '0.79rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {recording ? `⏹ Stop (${recordSeconds}s)` : busy === 'voice' ? 'Uploading…' : '🎙️ Voice'}
            </button>
            <input
              type="text"
              className="form-control"
              placeholder={bidding?.enabled ? chatCopy.placeholderBidding : chatCopy.placeholderGeneral}
              value={chatBody}
              onChange={(e) => setChatBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && chatBody.trim() && !busy) {
                  sendText();
                }
              }}
              style={{
                flex: '1 1 150px',
                minHeight: '38px',
                background: '#ffffff',
                color: '#0f172a',
                borderColor: '#cbd5e1',
              }}
            />
            <label style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '0.73rem', color: '#475569', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={chatToOrganizer} onChange={(e) => setChatToOrganizer(e.target.checked)} />
              {chatCopy.staffOnlyLabel}
            </label>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!!busy || !chatBody.trim()}
              onClick={() => sendText()}
              style={{ minHeight: '38px', padding: '0 14px' }}
            >
              {busy === 'chat' ? 'Sending…' : chatCopy.sendBtn}
            </button>
          </div>

          {recording && liveTranscript && (
            <div style={{ fontSize: '0.76rem', color: 'var(--primary-dark)', fontStyle: 'italic' }}>
              Live transcript: &ldquo;{liveTranscript}&rdquo;
            </div>
          )}
        </div>
      )}

      {/* Persistent Reference Quick Bid (3×2 Grid) + Full-Width Glossy Emerald CTA Button */}
      {!locked && bidding && (
        <div
          style={{
            padding: '12px 14px 14px',
            borderTop: isStudio ? '1px solid #e2e8f0' : '1px solid var(--border)',
            background: isStudio ? '#ffffff' : 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: '9px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '0.92rem', fontWeight: 800, color: isStudio ? '#0f172a' : 'var(--text)' }}>
              Quick Bid ({sym})
            </strong>
            <select
              aria-label="Chat quick bidder"
              value={bidding.selectedMemberId}
              onChange={(e) => bidding.onSelectMemberId(e.target.value)}
              style={{
                flex: '1 1 150px',
                maxWidth: '215px',
                minHeight: '32px',
                padding: '4px 8px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
            >
              <option value="">Select bidder / tap seat…</option>
              {bidding.eligibleBidders.map((m) => (
                <option key={m.id} value={m.id}>
                  #{m.ticketNo ?? m.memberNumber} {m.customer.name}
                </option>
              ))}
            </select>
          </div>

          {quickGridPrizes.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '7px' }}>
              {quickGridPrizes.map((amt) => {
                const isSelected = !customBidOpen && (selectedQuickPrize ?? quickGridPrizes[0]) === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    disabled={!!busy}
                    onClick={() => {
                      setCustomBidOpen(false);
                      setSelectedQuickPrize(amt);
                    }}
                    style={{
                      padding: '8px 6px',
                      borderRadius: '9px',
                      border: isSelected ? '1.5px solid var(--primary)' : '1px solid #e2e8f0',
                      background: isSelected ? 'var(--primary-light)' : '#f8fafc',
                      color: isSelected ? 'var(--primary-dark)' : '#0f172a',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {Number(amt).toLocaleString('en-IN')}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={!!busy}
                onClick={() => {
                  setCustomBidOpen((v) => !v);
                  if (!customBidInput) setCustomBidInput(String(bidding.maxPrize));
                }}
                style={{
                  padding: '8px 6px',
                  borderRadius: '9px',
                  border: customBidOpen ? '1.5px solid var(--primary)' : '1px solid var(--primary-border)',
                  background: '#ecfdf5',
                  color: 'var(--primary-dark)',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>edit</span>
                Custom
              </button>
            </div>
          )}

          {customBidOpen && (
            <input
              type="number"
              min={bidding.minPrize}
              max={bidding.maxPrize}
              value={customBidInput}
              onChange={(e) => setCustomBidInput(e.target.value)}
              placeholder={`Enter bid between ${formatCurrency(bidding.minPrize, sym)} and ${formatCurrency(bidding.maxPrize, sym)}`}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '9px',
                border: '1.5px solid var(--primary)',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: '0.88rem',
                fontWeight: 800,
              }}
            />
          )}

          {bidding.enabled ? (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => handleQuickBid(effectiveStudioBidAmount)}
              style={{
                width: '100%',
                minHeight: '46px',
                padding: '0 18px',
                borderRadius: '13px',
                border: 'none',
                background: 'linear-gradient(180deg, var(--primary) 0%, var(--primary-dark) 100%)',
                boxShadow: '0 10px 22px -6px var(--primary-glow), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                gap: '8px',
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '20px' }}>gavel</span>
              <span>
                {busy === 'bid'
                  ? 'Placing Bid…'
                  : `Place Bid · ${formatCurrency(effectiveStudioBidAmount, sym)}`}
              </span>
              <span className="material-icons-outlined" style={{ fontSize: '20px', position: 'absolute', right: '16px' }}>arrow_forward</span>
            </button>
          ) : onStartLive ? (
            <button
              type="button"
              disabled={startLiveBusy}
              onClick={onStartLive}
              style={{
                width: '100%',
                minHeight: '46px',
                padding: '0 18px',
                borderRadius: '13px',
                border: 'none',
                background: 'linear-gradient(180deg, var(--primary) 0%, var(--primary-dark) 100%)',
                boxShadow: '0 10px 22px -6px var(--primary-glow), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                gap: '8px',
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '22px' }}>
                {startLiveIcon || 'play_arrow'}
              </span>
              <span>
                {startLiveBusy ? 'Starting Live Room…' : (startLiveLabel || 'Start Live Now to Bid')}
              </span>
              <span className="material-icons-outlined" style={{ fontSize: '20px', position: 'absolute', right: '16px' }}>arrow_forward</span>
            </button>
          ) : (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '11px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#475569',
                fontSize: '0.82rem',
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              {biddingDisabledReason || 'Room closed — confirm winner or extend in top bar.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
