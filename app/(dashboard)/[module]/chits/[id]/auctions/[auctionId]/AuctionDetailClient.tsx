'use client';

import { compressFormDataImages } from '@/lib/imageCompression';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';
import { PokerTableArena } from '@/components/chits/PokerTableArena';
import {
  addAuctionBid,
  closeLiveRoom,
  collectAllAuctionTableCashAction,
  collectAuctionTableCashAction,
  confirmAuction,
  decideRoomAdmission,
  drawAuctionWinner,
  getAuctionTimeline,
  getAuctionWinnerSummary,
  getChitWhatsAppInviteAction,
  getLiveAuctionState,
  getWinnerPayoutSummaryAction,
  markAuctionAttendance,
  markAuctionNoticeSent,
  manageChitAuctionScheduleAction,
  openLiveRoom,
  postRoomMessage,
  postRoomVoiceMessage,
  releasePrizePayout,
  reopenLiveRoomAction,
  requestChitSecurityApprovalAction,
  retractLiveMemberBid,
  reviewChitSecurityDocument,
  ringLiveBell,
  submitChitSecurity,
  updateChitBellIntervalAction,
  updateChitGroupRepeatSelfBid,
  updateChitRoomVoiceSettings,
  updateLiveAuctionBidMultiplier,
  updatePayoutDenominationsAction,
} from '../../../actions';
import './auction-room.css';
import AuctionScheduleModal from '@/components/chits/AuctionScheduleModal';
import LotteryDrawStage from '@/components/chits/LotteryDrawStage';
import ThirdBellWinnerModal from '@/components/chits/ThirdBellWinnerModal';
import ChitPdfPreviewModal from '@/components/chits/ChitPdfPreviewModal';
import {
  isBellSoundMuted,
  playAuctionBellChime,
  playBellCountdownTick,
  playWinnerConfirmedFanfare,
  setBellSoundMuted,
} from '@/lib/chits/bellAudio';
import type { AuctionTableCashSummary } from '@/lib/chits/tableCash';
import {
  BID_VOICE_LANGUAGES,
  isBidVoiceEnabled,
  normalizeVoiceLanguageCode,
  setBidVoiceEnabled,
  speakBidCallout,
  speakWinnerCallout,
  stopBidVoicePlayback,
  warmUpBidVoiceEngine,
  type BidVoiceLanguageCode,
} from '@/lib/chits/bidVoiceAnnouncer';
import CashDenominationCounter from '@/components/chits/CashDenominationCounter';
import {
  formatCashDenominationsSummary,
  normalizeCashDenominations,
  sumCashDenominations,
  type CashDenominationMode,
} from '@/lib/chits/denominations';
import { PDF_LANGUAGES, resolvePdfLang } from '@/lib/reports/pdfLanguages';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useRegisterBreadcrumbLabel } from '@/components/layout/BreadcrumbLabelContext';
import DividendBreakdown from '@/components/chits/DividendBreakdown';
import AuctionAutomatedBidBox from '@/components/chits/AuctionAutomatedBidBox';
import AuctionRoomChatBox, { type RoomActivityEntry, type RoomMemberRosterItem } from '@/components/chits/AuctionRoomChatBox';
import { consolidateSeatsByCustomer, interleaveSeatsByCustomer } from '@/lib/chits/seatOrder';
import type { AutomatedBidBounds } from '@/lib/chits/validation';
import {
  isBiddingEnabledForPeriod,
  parseChitEngineConfig,
  resolveEngineTypeFromGroup,
  resolvePeriodRoomMode,
  supportsBellForPeriod,
} from '@/lib/chits/engineTypes';
import {
  CANONICAL_SECURITY_OPTIONS,
  SECURITY_DOCUMENT_LABELS,
  getSecurityTypeSpec,
  normalizeSecurityType,
} from '@/lib/chits/securityTypes';

export interface PreviousWinnerItem {
  auctionId: string | null;
  memberId: string;
  ticketNo: string;
  memberName: string;
  periodNumber: number | null;
  wonDate: string | null;
  prizeAmount: number;
  bidDiscount: number;
  dividend: number;
  payoutStatus: string;
  source: 'auction' | 'historical';
}

interface NextAuctionTarget {
  id: string;
  periodNumber: number;
  auctionDate: string;
  status: string;
}

interface Props {
  auction: any;
  security: any | null;
  securityDocuments: any[];
  payoutReceipt?: any | null;
  initialMessages?: any[];
  previousWinners?: PreviousWinnerItem[];
  initialBidBounds: AutomatedBidBounds;
  initialTableCashSummary?: AuctionTableCashSummary | null;
  nextAuction?: NextAuctionTarget | null;
  viewerRole?: string;
  canApproveSecurity?: boolean;
  canReleasePayout?: boolean;
  currencySymbol: string;
  lang?: string;
  dict: any;
}

function eligibleSeatCountOrText(activeSeats: number, wonCount: number): string {
  return wonCount > 0 ? `${activeSeats} Bidding Seats · ${wonCount} Won Off Table` : `${activeSeats} Bidding Seats`;
}

export default function AuctionDetailClient({
  auction,
  security,
  securityDocuments,
  payoutReceipt = null,
  initialMessages = [],
  previousWinners = [],
  initialBidBounds,
  initialTableCashSummary = null,
  nextAuction = null,
  viewerRole = 'admin',
  canApproveSecurity = false,
  canReleasePayout = false,
  currencySymbol,
  lang,
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
  const roomMode = resolvePeriodRoomMode(group, auction.periodNumber);
  const bellSupported = supportsBellForPeriod(group, auction.periodNumber);
  const isBiddingRoom = roomMode === 'OPEN_AUCTION' || roomMode === 'SEALED_TENDER';
  const isDrawType = !isBiddingRoom;
  const isReservePrice = engineType === 'AUCTION_RESERVE_PRICE';
  const isMultiDivision = engineType === 'AUCTION_MULTI_DIVISION';
  const isConsensus = roomMode === 'CONSENSUS';
  const isLive = isBiddingRoom;
  const isSealed = roomMode === 'SEALED_TENDER';
  const locked = ['confirmed', 'paid', 'cancelled'].includes(auction.status);

  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [workflowBanner, setWorkflowBanner] = useState<{
    tone: 'success' | 'warning' | 'info';
    title: string;
    detail: string;
  } | null>(null);
  const [showDividendTable, setShowDividendTable] = useState(false);
  const [bidMemberId, setBidMemberId] = useState('');
  const [bidPrize, setBidPrize] = useState<number>(initialBidBounds.nextValidPrize);
  const [showTableCanvas, setShowTableCanvas] = useState(true);
  const [showModeCircle, setShowModeCircle] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [consensusMemberId, setConsensusMemberId] = useState('');
  const [consensusReason, setConsensusReason] = useState('');
  const [minutes, setMinutes] = useState('');
  const [roomMinutes, setRoomMinutes] = useState(engineCfg.meetingSchedule?.defaultDurationMinutes ?? 30);
  const [antiSnipe, setAntiSnipe] = useState(60);
  const [live, setLive] = useState<any>(null);
  const [tableCash, setTableCash] = useState<AuctionTableCashSummary | null>(initialTableCashSummary);
  const [showTableCashModal, setShowTableCashModal] = useState(false);
  const [tableCashPayMode, setTableCashPayMode] = useState<'cash' | 'upi' | 'bank'>('cash');
  const [bellTickerPerfMs, setBellTickerPerfMs] = useState<number>(0);
  const bellSyncAnchorRef = useRef<{ remainingMs: number; capturedPerfMs: number; key: string } | null>(null);
  const lastBellTickSecRef = useRef<number | null>(null);
  const bellAutoPollTriggerRef = useRef<string>('');
  const [seatModal, setSeatModal] = useState<any>(null);
  const [seatPhotoFailedId, setSeatPhotoFailedId] = useState<string | null>(null);
  const [payMode, setPayMode] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const [securityTypeInput, setSecurityTypeInput] = useState<string>(() =>
    normalizeSecurityType(security?.securityType),
  );
  const savedReceiptDenoms = normalizeCashDenominations(payoutReceipt?.cashDenominationsJson);
  const [pdfLang, setPdfLang] = useState<string>(() => resolvePdfLang(lang));
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [includeCashNotes, setIncludeCashNotes] = useState<boolean>(() => Boolean(savedReceiptDenoms));
  const [showDenoms, setShowDenoms] = useState(false);
  const [denom500, setDenom500] = useState<number>(() => savedReceiptDenoms?.[500] ?? 0);
  const [denom200, setDenom200] = useState<number>(() => savedReceiptDenoms?.[200] ?? 0);
  const [denom100, setDenom100] = useState<number>(() => savedReceiptDenoms?.[100] ?? 0);
  const [denom50, setDenom50] = useState<number>(() => savedReceiptDenoms?.[50] ?? 0);
  const [denom20, setDenom20] = useState<number>(() => savedReceiptDenoms?.[20] ?? 0);
  const [denom10, setDenom10] = useState<number>(() => savedReceiptDenoms?.[10] ?? 0);
  const [payoutCounts, setPayoutCounts] = useState<Record<number, number>>(() => savedReceiptDenoms ?? {});
  const [payoutDenomJson, setPayoutDenomJson] = useState<string | null>(null);
  const [payoutDenomMatched, setPayoutDenomMatched] = useState(true);
  const [payoutDenomMode, setPayoutDenomMode] = useState<CashDenominationMode>('OPTIONAL');
  const [payoutSummary, setPayoutSummary] = useState<any>(null);
  const [deductArrears, setDeductArrears] = useState(true);
  const [useCustomArrears, setUseCustomArrears] = useState(false);
  const [customArrearsAmount, setCustomArrearsAmount] = useState('');
  const [waivePenalties, setWaivePenalties] = useState(false);
  const [showArrearsDetail, setShowArrearsDetail] = useState(false);
  const [disburseNowInput, setDisburseNowInput] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const payoutIdempotencyRef = useRef<string>('');
  const [rightTab, setRightTab] = useState<'attendance' | 'bids' | 'winners' | 'log' | 'settlement'>(() =>
    locked || Boolean(auction.winnerMemberId) ? 'settlement' : 'bids',
  );
  const [studioClock, setStudioClock] = useState<Date | null>(null);
  const [showStudioDrawer, setShowStudioDrawer] = useState<boolean>(() => Boolean(locked || auction.winnerMemberId));
    const [allowConsecutiveSelfBid, setAllowConsecutiveSelfBid] = useState<boolean>(() =>
      Boolean(engineCfg.discountRules.allowConsecutiveSelfBid),
    );
    const [liveMultiplierInput, setLiveMultiplierInput] = useState<number>(() => {
      const grpInc = group.bidIncrement ? Number(group.bidIncrement) : 0;
      const engInc = engineCfg.discountRules.bidIncrementMultiple > 0 ? engineCfg.discountRules.bidIncrementMultiple : 0;
      return grpInc > 0 ? grpInc : engInc > 0 ? engInc : 1;
    });
    const [liveStrictMultiple, setLiveStrictMultiple] = useState<boolean>(() =>
      Boolean(initialBidBounds.strictBidMultiple ?? engineCfg.discountRules.strictBidMultiple),
    );
    const [popupBidPrize, setPopupBidPrize] = useState<number>(initialBidBounds.nextValidPrize);
    const [inviteInfo, setInviteInfo] = useState<{ joinUrl: string; shareUrl: string } | null>(null);
    const [inviteNotice, setInviteNotice] = useState('');
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollFailCountRef = useRef(0);
    const prevBellsRungRef = useRef(auction.bellsRung ?? 0);
    const lastBellSoundKeyRef = useRef('');
    const thirdBellModalPromptKeyRef = useRef('');
    const [bellToast, setBellToast] = useState('');
    const [soundMuted, setSoundMuted] = useState<boolean>(() => isBellSoundMuted());
    const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => isBidVoiceEnabled());
    const [roomVoiceLang, setRoomVoiceLang] = useState<BidVoiceLanguageCode>(() =>
      normalizeVoiceLanguageCode(engineCfg.voiceSettings?.language),
    );
    const [allowMemberVoiceChange, setAllowMemberVoiceChange] = useState<boolean>(() =>
      Boolean(engineCfg.voiceSettings?.allowMemberChange),
    );
    const [thirdBellModalOpen, setThirdBellModalOpen] = useState(false);
    const [spinInModalActive, setSpinInModalActive] = useState(false);
    const initialTopValidBid = (() => {
      const valid = (auction.bids ?? []).filter((b: any) => ['valid', 'winning'].includes(b.status));
      if (!valid.length) return null;
      return valid.reduce(
        (top: any, cur: any) => (Number(cur.bidDiscount ?? 0) > Number(top.bidDiscount ?? 0) ? cur : top),
        valid[0],
      );
    })();
    const lastSpokenBidKeyRef = useRef<string>(
      initialTopValidBid
        ? `${initialTopValidBid.memberId}:${Number(initialTopValidBid.bidAmount ?? 0)}:${Number(initialTopValidBid.bidDiscount ?? 0)}`
        : '__none__',
    );
    const [timeline, setTimeline] = useState<any>(null);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const timelinePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [winnerSummary, setWinnerSummary] = useState<any>(null);
    const activeBidBounds: AutomatedBidBounds = live?.bidBounds ?? initialBidBounds;
    const activeSecuritySpec = getSecurityTypeSpec(securityTypeInput);
    const savedSecuritySpec = getSecurityTypeSpec(security?.securityType);

    useEffect(() => {
      if (engineCfg.discountRules.allowConsecutiveSelfBid !== undefined) return;
      try {
        const saved = window.localStorage.getItem(`zolofund-chit-repeat-self-bid:${group.id}`);
        if (saved === '1') setAllowConsecutiveSelfBid(true);
      } catch {
        // Ignore storage access errors in restricted browsers.
      }
    }, [engineCfg.discountRules.allowConsecutiveSelfBid, group.id]);

    const handleSetRepeatSelfBid = async (nextValue: boolean) => {
      setAllowConsecutiveSelfBid(nextValue);
      try {
        window.localStorage.setItem(`zolofund-chit-repeat-self-bid:${group.id}`, nextValue ? '1' : '0');
      } catch {
        // Ignore storage access errors in restricted browsers.
      }
      const res = await updateChitGroupRepeatSelfBid(group.id, nextValue, auction.id).catch((e: any) => ({
        ok: false,
        error: e?.message || 'Failed to save repeat self-bid setting',
      }));
      if (res && 'ok' in res && res.ok === false) {
        setError(res.error || 'Failed to save repeat self-bid setting');
      }
    };

    const applyLiveBidMultiplier = async (stepVal: number, strictVal: boolean) => {
      const cleanStep = Math.max(1, Math.round(Number(stepVal) || 1));
      const cleanStrict = cleanStep > 1 ? strictVal : false;
      setLiveMultiplierInput(cleanStep);
      setLiveStrictMultiple(cleanStrict);
      await run('bid-multiplier', () =>
        updateLiveAuctionBidMultiplier(auction.id, {
          bidIncrement: cleanStep,
          strictBidMultiple: cleanStrict,
        }),
      );
    };

    useEffect(() => {
      if (security?.securityType) {
        setSecurityTypeInput(normalizeSecurityType(security.securityType));
      }
    }, [security?.securityType]);

    // Keep automated & popup bid inputs synced cleanly to valid monotonic ceiling whenever bounds tighten
    useEffect(() => {
      setBidPrize((prev) => {
        if (!Number.isFinite(prev) || prev > activeBidBounds.nextValidPrize || prev < activeBidBounds.minPrize) {
          return activeBidBounds.nextValidPrize;
        }
        return prev;
      });
      setPopupBidPrize((prev) => {
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

    const handleGenerateInvite = async () => {
      setBusy('invite');
      setError('');
      setInviteNotice('');
      try {
        const res = await getChitWhatsAppInviteAction(group.id);
        if (!res.ok) throw new Error(res.error || 'Could not generate invite');
        setInviteInfo({ joinUrl: res.joinUrl, shareUrl: res.shareUrl });
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(res.joinUrl).catch(() => { });
          setInviteNotice('Invite link copied — ready to share on WhatsApp!');
        }
      } catch (e: any) {
        setError(e?.message || 'Could not create invite link');
      } finally {
        setBusy('');
      }
    };

    const triggerBellFeedback = (rung: number, count: number, bidCountVal: number, highestTicket?: string | null) => {
      if (rung <= 0 || count <= 0) return;
      setBellToast(bellPhrase(rung, count, highestTicket));
      const soundKey = `${bidCountVal}:${rung}`;
      if (lastBellSoundKeyRef.current !== soundKey) {
        lastBellSoundKeyRef.current = soundKey;
        playAuctionBellChime(rung, count);
      }
    };

    // Auto-dismiss transient bell overlay cleanly after 2 seconds (independent of poll re-renders)
    useEffect(() => {
      if (!bellToast) return;
      const id = setTimeout(() => setBellToast(''), 2000);
      return () => clearTimeout(id);
    }, [bellToast]);

    // Clear bell alert immediately once auction is confirmed (unless wheel spin popup is finishing its reveal)
    useEffect(() => {
      if (!locked) return;
      const t = setTimeout(() => {
        setBellToast('');
        if (!spinInModalActive) {
          setThirdBellModalOpen(false);
        }
      }, 0);
      return () => clearTimeout(t);
    }, [locked, spinInModalActive]);

    // Live spoken voice announcement when a new highest bid lands ("48 thousand by Oviya")
    useEffect(() => {
      if (locked || spinInModalActive || thirdBellModalOpen || Boolean(auction.winnerMemberId) || !voiceEnabled || isSealed || !live?.highestBid) return;
      const hb = live.highestBid;
      const prize = Math.max(
        0,
        Number(hb.prizeAmount ?? hb.bidAmount ?? Number(group.chitValue) - Number(hb.bidDiscount ?? 0)),
      );
      const bidKey = `${hb.memberId}:${prize}:${Number(hb.bidDiscount ?? 0)}`;
      if (bidKey === lastSpokenBidKeyRef.current) return;
      lastSpokenBidKeyRef.current = bidKey;
      void speakBidCallout({
        prizeAmount: prize,
        memberName: hb.memberName,
        ticketNo: hb.ticketNo,
        lang: roomVoiceLang,
      });
    }, [live?.highestBid, locked, spinInModalActive, thirdBellModalOpen, auction.winnerMemberId, voiceEnabled, isSealed, group.chitValue, roomVoiceLang]);

    const handleSaveRoomVoiceSettings = async (
      nextLang: BidVoiceLanguageCode,
      nextAllowMemberChange: boolean,
      previewSpeech = false,
    ) => {
      setRoomVoiceLang(nextLang);
      setAllowMemberVoiceChange(nextAllowMemberChange);
      const ok = await run('voice-settings', () =>
        updateChitRoomVoiceSettings(
          group.id,
          { language: nextLang, allowMemberChange: nextAllowMemberChange },
          auction.id,
        ),
      );
      if (ok && previewSpeech && voiceEnabled) {
        void warmUpBidVoiceEngine().then(() => {
          void speakBidCallout({
            prizeAmount: Number(leadingBidForTable?.prizeAmount ?? group.chitValue),
            memberName: leadingBidForTable?.memberName || 'Oviya',
            ticketNo: leadingBidForTable?.ticketNo,
            lang: nextLang,
            force: true,
          });
        });
      }
    };

    // Auto-open Foreman 3rd-Bell Winner Confirmation Popup when the final bell completes
    useEffect(() => {
      if (locked || auction.winnerMemberId || !bellSupported || !isBiddingRoom) return;
      const rung = live?.bell?.bellsRung ?? auction.bellsRung ?? 0;
      const count = live?.bell?.bellCount ?? group.bellCount ?? 3;
      const bidCountVal = live?.bidCount ?? auction.bids?.length ?? 0;
      const promptKey = `${bidCountVal}:${rung}`;
      if (rung >= count && count > 0 && thirdBellModalPromptKeyRef.current !== promptKey) {
        thirdBellModalPromptKeyRef.current = promptKey;
        const t = setTimeout(() => setThirdBellModalOpen(true), 1200);
        return () => clearTimeout(t);
      }
    }, [
      locked,
      auction.winnerMemberId,
      auction.bellsRung,
      auction.bids?.length,
      bellSupported,
      isBiddingRoom,
      live?.bell?.bellsRung,
      live?.bell?.bellCount,
      live?.bidCount,
      group.bellCount,
    ]);

    const roomActive = (live?.roomStatus ?? auction.roomStatus) === 'open' || (live?.roomStatus ?? auction.roomStatus) === 'extended';
    const currentBellsRung = live?.bell?.bellsRung ?? auction.bellsRung ?? 0;
    const totalBellCount = live?.bell?.bellCount ?? group.bellCount ?? 3;
    const isClosedByBell = !roomActive && currentBellsRung >= totalBellCount && totalBellCount > 0;
    const canBidLiveNow = isBiddingRoom && !locked && activeBidBounds.canBidFurther && roomActive;
    const needsTableCashBeforeStart = Boolean(
      tableCash?.enabled &&
      !tableCash.allSettled &&
      isLive &&
      !roomActive &&
      !locked &&
      !isClosedByBell &&
      (live?.roomStatus ?? auction.roomStatus) !== 'closed',
    );

    const idleBellIntervalSec = Math.max(
      5,
      Number(live?.bell?.intervalSeconds ?? group.bellIntervalSeconds ?? 60),
    );
    const syncBellAnchorFromState = (state: any) => {
      const rem = state?.bell?.remainingMs;
      const key = `${state?.bell?.bellsRung ?? 0}:${state?.bell?.nextBellAt ?? ''}:${state?.roomStatus ?? ''}`;
      if (typeof rem === 'number' && Number.isFinite(rem)) {
        const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const prevAnchor = bellSyncAnchorRef.current;
        const prevComputedRem = prevAnchor
          ? Math.max(0, prevAnchor.remainingMs - Math.max(0, nowPerf - prevAnchor.capturedPerfMs))
          : null;
        if (!prevAnchor || prevAnchor.key !== key || prevComputedRem == null || Math.abs(prevComputedRem - rem) > 650) {
          bellSyncAnchorRef.current = { remainingMs: Math.max(0, rem), capturedPerfMs: nowPerf, key };
          setBellTickerPerfMs(nowPerf);
        }
      } else {
        bellSyncAnchorRef.current = null;
      }
    };
    const bellAnchor = bellSyncAnchorRef.current;
    const expectedBellKey = `${currentBellsRung}:${live?.bell?.nextBellAt ?? ''}:${live?.roomStatus ?? auction.roomStatus ?? ''}`;
    const bellRemainingMs =
      roomActive && bellSupported
        ? bellAnchor && bellAnchor.key === expectedBellKey
          ? Math.max(0, bellAnchor.remainingMs - Math.max(0, bellTickerPerfMs - bellAnchor.capturedPerfMs))
          : live?.bell?.remainingMs != null
            ? Math.max(0, Number(live.bell.remainingMs))
            : null
        : null;
    const bellSecondsLeft = bellRemainingMs != null ? Math.ceil(bellRemainingMs / 1000) : null;
    const bellUrgentSeconds =
      bellSecondsLeft != null && bellSecondsLeft >= 1 && bellSecondsLeft <= 5 ? bellSecondsLeft : null;
    const idleBellProgressPct =
      roomActive && bellSupported
        ? bellRemainingMs != null
          ? Math.min(100, Math.max(0, (bellRemainingMs / (idleBellIntervalSec * 1000)) * 100))
          : 0
        : 0;

    useEffect(() => {
      const boot = setTimeout(() => setStudioClock(new Date()), 0);
      const id = setInterval(() => setStudioClock(new Date()), 1000);
      return () => {
        clearTimeout(boot);
        clearInterval(id);
      };
    }, []);

    // High-resolution 100ms monotonic bell countdown bar + 5-second audio tick + zero-second auto-ring poll
    useEffect(() => {
      if (!roomActive || !bellSupported || locked || (!live?.bell?.nextBellAt && live?.bell?.remainingMs == null)) {
        lastBellTickSecRef.current = null;
        return;
      }
      const id = setInterval(() => {
        const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
        setBellTickerPerfMs(nowPerf);
        const curAnchor = bellSyncAnchorRef.current;
        const remMs = curAnchor
          ? Math.max(0, curAnchor.remainingMs - Math.max(0, nowPerf - curAnchor.capturedPerfMs))
          : live?.bell?.remainingMs != null
            ? Math.max(0, Number(live.bell.remainingMs))
            : null;
        if (remMs == null) return;
        const secLeft = Math.ceil(remMs / 1000);
        if (secLeft >= 1 && secLeft <= 5 && lastBellTickSecRef.current !== secLeft) {
          lastBellTickSecRef.current = secLeft;
          playBellCountdownTick(secLeft);
        } else if (secLeft > 5 || secLeft <= 0) {
          lastBellTickSecRef.current = null;
        }
        const pollKey = `${currentBellsRung}:${live?.bell?.nextBellAt ?? ''}`;
        if (remMs === 0 && bellAutoPollTriggerRef.current !== pollKey) {
          bellAutoPollTriggerRef.current = pollKey;
          getLiveAuctionState(auction.id)
            .then((state) => {
              syncBellAnchorFromState(state);
              setLive(state);
              if (state?.tableCashSummary) setTableCash(state.tableCashSummary);
            })
            .catch(() => { });
        }
      }, 100);
      return () => clearInterval(id);
    }, [roomActive, bellSupported, locked, live?.bell?.nextBellAt, live?.bell?.remainingMs, currentBellsRung, auction.id]);

    // Poll the room every 1.5s when live (or slower in manual/chat mode) so messages
    // and server countdown stay synced for all members.
    useEffect(() => {
      if (locked) return;
      if (!isLive && !biddingAllowed) return;
      const tick = async () => {
        try {
          const state = await getLiveAuctionState(auction.id);
          pollFailCountRef.current = 0;
          syncBellAnchorFromState(state);
          setLive(state);
          if (state?.tableCashSummary) {
            setTableCash(state.tableCashSummary);
          }
          if (isLive) {
            const rung = state.bell?.bellsRung ?? 0;
            const count = state.bell?.bellCount ?? 0;
            if (rung === 0) {
              setBellToast('');
              lastBellSoundKeyRef.current = '';
            } else if (rung > prevBellsRungRef.current && count > 0) {
              triggerBellFeedback(rung, count, state.bidCount ?? 0, state.highestBid?.ticketNo);
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

    // Winner summary + FIFO arrears/split payout summary loader
    const refreshPayoutSummary = () => {
      if (!auction.winnerMemberId) return;
      const customNum = useCustomArrears && customArrearsAmount !== '' ? Number(customArrearsAmount) : null;
      getWinnerPayoutSummaryAction(auction.id, {
        deductArrears,
        customArrearsAmount: customNum != null && Number.isFinite(customNum) ? customNum : null,
        waivePenalties,
      })
        .then((res) => {
          if (res && res.ok) {
            setPayoutSummary(res.summary);
            setPayoutDenomMode((res.denominationMode as CashDenominationMode) ?? 'OPTIONAL');
            if (res.summary?.remainingPayableAmount != null) {
              setDisburseNowInput(String(res.summary.remainingPayableAmount));
            }
          }
        })
        .catch(() => { });
    };

    useEffect(() => {
      if (!auction.winnerMemberId) return;
      getAuctionWinnerSummary(auction.id).then(setWinnerSummary).catch(() => { });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auction.id, auction.winnerMemberId]);

    useEffect(() => {
      refreshPayoutSummary();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auction.id, auction.winnerMemberId, auction.payoutStatus, deductArrears, useCustomArrears, customArrearsAmount, waivePenalties]);

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

    const focusSettlementWorkflow = (banner?: {
      tone: 'success' | 'warning' | 'info';
      title: string;
      detail: string;
    }) => {
      setRightTab('settlement');
      setShowStudioDrawer(true);
      if (banner) setWorkflowBanner(banner);
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          document.getElementById('post-auction-workflow')?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }, 140);
      }
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
        if (res && typeof res === 'object' && 'tableCashSummary' in res && res.tableCashSummary) {
          setTableCash(res.tableCashSummary);
        }
        router.refresh();
        window.dispatchEvent(new CustomEvent('zolofund:chit-auction-updated'));
        // Refresh timeline + live state immediately after any mutation
        fetchTimeline();
        if (!locked) {
          getLiveAuctionState(auction.id)
            .then((state) => {
              syncBellAnchorFromState(state);
              setLive(state);
              if (state?.tableCashSummary) setTableCash(state.tableCashSummary);
            })
            .catch(() => { });
        }
        setBusy('');
        return res ?? true;
      } catch (e: any) {
        setError(e?.message || 'Action failed');
        setBusy('');
        return false;
      }
    };

    const handlePrimaryStartAction = () => {
      if (needsTableCashBeforeStart) {
        setShowTableCashModal(true);
        return;
      }
      void run('open-room', () => openLiveRoom(auction.id, roomMinutes, antiSnipe));
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
    const currentDenomMap: Record<number, number> = {
      500: denom500,
      200: denom200,
      100: denom100,
      50: denom50,
      20: denom20,
      10: denom10,
    };
    const currentDenomTotal = sumCashDenominations(currentDenomMap);
    const denomFields = [
      { denom: 500, val: denom500, set: setDenom500 },
      { denom: 200, val: denom200, set: setDenom200 },
      { denom: 100, val: denom100, set: setDenom100 },
      { denom: 50, val: denom50, set: setDenom50 },
      { denom: 20, val: denom20, set: setDenom20 },
      { denom: 10, val: denom10, set: setDenom10 },
    ];

    const periodReportUrl = (() => {
      const qs = new URLSearchParams();
      qs.set('lang', pdfLang);
      if (showDenoms && currentDenomTotal > 0) {
        for (const f of denomFields) {
          if (f.val > 0) qs.set(`d${f.denom}`, String(f.val));
        }
      }
      return `/api/chits/${group.id}/auctions/${auction.id}/report?${qs.toString()}`;
    })();
    const periodReportPreviewUrl = `${periodReportUrl}&inline=1`;

    const leadingBidForTable = live?.highestBid
      ? {
        ticketNo: live.highestBid.ticketNo,
        memberName: live.highestBid.memberName,
        bidDiscount: live.highestBid.bidDiscount,
        prizeAmount: Number(group.chitValue) - Number(live.highestBid.bidDiscount ?? 0),
      }
      : validBids[0] && !hideBidAmounts
        ? {
          ticketNo: validBids[0].member?.ticketNo ?? validBids[0].member?.memberNumber,
          memberName: validBids[0].member?.customer?.name,
          bidDiscount: Number(validBids[0].bidDiscount ?? 0),
          prizeAmount: Number(validBids[0].bidAmount ?? 0),
        }
        : null;

    const sourceBidsForTieCheck: any[] = (live?.bids ?? validBids).filter(
      (b: any) => !b.status || ['valid', 'winning'].includes(b.status),
    );
    const tiedTopCandidates = (() => {
      if (hideBidAmounts || sourceBidsForTieCheck.length < 2) return [];
      const maxDisc = Math.max(...sourceBidsForTieCheck.map((b: any) => Number(b.bidDiscount ?? 0)));
      const seen = new Map<string, { memberId: string; ticketNo: string; name: string }>();
      for (const b of sourceBidsForTieCheck) {
        if (Number(b.bidDiscount ?? 0) === maxDisc && !seen.has(b.memberId)) {
          seen.set(b.memberId, {
            memberId: b.memberId,
            ticketNo: String(b.ticketNo ?? b.member?.ticketNo ?? b.member?.memberNumber ?? '?'),
            name: String(b.memberName ?? b.member?.customer?.name ?? 'Member'),
          });
        }
      }
      return Array.from(seen.values());
    })();

    const eligibleSpinCandidates = eligibleBidders.map((m: any) => ({
      memberId: m.id,
      ticketNo: String(m.ticketNo ?? m.memberNumber),
      name: String(m.customer?.name ?? 'Member'),
    }));
    const zeroBidFloorDiscount = isReservePrice && auction.reserveFloorAmount != null
      ? Number(auction.reserveFloorAmount)
      : Number(activeBidBounds.startingDiscount ?? 0);
    const zeroBidFloorPrize = Math.max(1, Number(group.chitValue) - zeroBidFloorDiscount);

    const wonMemberCount = (group.members ?? []).filter((m: any) => Boolean(m.hasWon)).length;
    const activeSeatCount = (group.members ?? []).length - wonMemberCount;
    const studioActivityFeed: RoomActivityEntry[] = (timeline?.entries ?? []).map((entry: any) => ({
      id: String(entry.id ?? `${entry.kind}-${entry.createdAt}`),
      kind: String(entry.kind ?? 'event'),
      type: entry.type,
      bidStatus: entry.bidStatus,
      ticketNo: entry.ticketNo,
      memberName: entry.memberName,
      amount: entry.bidAmount ?? entry.amount ?? null,
      message: entry.message,
      senderName: entry.senderName,
      body: entry.body,
      createdAt: String(entry.createdAt),
    }));

    const studioMembersRoster: RoomMemberRosterItem[] = (() => {
      const raw = group.members ?? [];
      const leadingMem = leadingBidForTable
        ? raw.find((m: any) => (m.ticketNo ?? m.memberNumber) == leadingBidForTable.ticketNo)
        : null;
      const leadingCustId = leadingMem?.customerId ?? null;
      const grouped = consolidateSeatsByCustomer(raw, leadingBidForTable?.ticketNo);
      const sourceList = allowConsecutiveSelfBid
        ? raw.map((m: any) => ({
          primary: m,
          tickets: [m],
          ticketNos: [String(m.ticketNo ?? m.memberNumber)],
        }))
        : grouped;

      return sourceList.map((entry: any) => {
        const m = entry.primary;
        const tickets = entry.tickets as any[];
        const hasWonAll = tickets.every((t: any) => Boolean(t.hasWon));
        const ticketPrizes = tickets
          .map((t: any) => {
            const tLive = live?.memberBids?.[t.id]?.[0]?.prizeAmount;
            if (tLive != null) return Number(tLive);
            const tSsr = !hideBidAmounts ? validBids.find((b: any) => b.memberId === t.id)?.bidAmount : null;
            return tSsr != null ? Number(tSsr) : null;
          })
          .filter((p): p is number => p != null && Number.isFinite(p));
        const bestPrize = ticketPrizes.length > 0 ? Math.min(...ticketPrizes) : null;
        const isOnline = tickets.some((t: any) => {
          const tLive = live?.seats?.find((s: any) => s.memberId === t.id);
          return (
            attendanceOf(t.id) === 'present' ||
            attendanceOf(t.id) === 'proxy' ||
            Boolean(tLive && !tLive.passed && tLive.latestPrize !== null)
          );
        });
        const isLeading = Boolean(
          !hideBidAmounts &&
          leadingBidForTable &&
          (allowConsecutiveSelfBid
            ? leadingBidForTable.ticketNo == (m.ticketNo ?? m.memberNumber)
            : Boolean(leadingCustId && m.customerId === leadingCustId)),
        );
        const winMatches = tickets
          .map((t: any) => previousWinners.find((w) => w.memberId === t.id))
          .filter((w): w is PreviousWinnerItem => Boolean(w));
        const latestWin = winMatches.sort((a, b) => {
          const ta = a.wonDate ? new Date(a.wonDate).getTime() : 0;
          const tb = b.wonDate ? new Date(b.wonDate).getTime() : 0;
          return tb - ta;
        })[0];
        const fallbackWonDate =
          tickets.map((t: any) => t.wonAt).find(Boolean) ?? null;
        const resolvedPhoto =
          tickets
            .map((t: any) => live?.seats?.find((s: any) => s.memberId === t.id)?.profilePhoto || t.customer?.profilePhoto)
            .find(Boolean) ?? null;
        const currentAtt = attendanceOf(m.id) ?? undefined;
        return {
          memberId: m.id,
          ticketNo: m.ticketNo ?? m.memberNumber,
          ticketNos: entry.ticketNos,
          name: m.customer?.name ?? 'Member',
          photoUrl: resolvedPhoto,
          isOnline,
          hasWon: hasWonAll,
          isLeading,
          latestPrize: !hideBidAmounts ? bestPrize : null,
          wonPeriodNumber: latestWin?.periodNumber ?? m.prizedCycleNumber ?? null,
          wonDate: latestWin?.wonDate ?? (fallbackWonDate ? String(fallbackWonDate) : null),
          wonPrizeAmount: latestWin?.prizeAmount ?? (m.historicalPrizeAmount != null ? Number(m.historicalPrizeAmount) : null),
          wonPayoutStatus: latestWin?.payoutStatus ?? null,
          attendanceStatus: currentAtt,
          onMarkAttendance: !locked
            ? (opt: 'present' | 'absent' | 'proxy') => {
              void run(`att-${m.id}`, () => markAuctionAttendance(auction.id, m.id, opt, null));
            }
            : undefined,
          onSelect:
            !hasWonAll && !isSealed
              ? () => {
                const liveSeat = live?.seats?.find((s: any) => s.memberId === m.id);
                setPopupBidPrize(activeBidBounds.nextValidPrize);
                if (!m.hasWon) setBidMemberId(m.id);
                setSeatModal({ ...m, liveSeat });
              }
              : undefined,
        };
      });
    })();

    const consolidatedTableGroups = consolidateSeatsByCustomer(group.members ?? [], leadingBidForTable?.ticketNo);
    const eligibleSeatTotal = allowConsecutiveSelfBid || isSealed
      ? (group.members ?? []).filter((m: any) => !m.hasWon).length
      : consolidatedTableGroups.filter((g) => !g.tickets.every((t: any) => Boolean(t.hasWon))).length;

    const studioHeaderTitle = roomMode === 'LOTTERY_DRAW'
      ? `Lucky Draw Table — ${eligibleSeatTotal} Unique Members (${activeSeatCount} Tickets)`
      : roomMode === 'SEALED_TENDER'
        ? `Sealed Tender Room — ${eligibleSeatTotal} Eligible`
        : roomMode === 'CONSENSUS'
          ? `Consensus Room — Period ${auction.periodNumber}`
          : roomMode === 'FIXED_ROTATION'
            ? `Cycle Rotation — Period ${auction.periodNumber}`
            : allowConsecutiveSelfBid
              ? `Live Auction Table — ${activeSeatCount} Active Tickets (${group.totalMembers} Total)`
              : `Live Auction Table — ${eligibleSeatTotal} Unique Members (${activeSeatCount} Tickets)`;

    const isRoomClosedState =
      locked || isClosedByBell || (live?.roomStatus ?? auction.roomStatus) === 'closed';
    const countdownTotalSec = roomActive
      ? Math.max(0, Number(live?.secondsRemaining ?? 0))
      : isRoomClosedState
        ? 0
        : Math.max(0, Number(roomMinutes ?? 30) * 60);
    const cdHours = String(Math.floor(countdownTotalSec / 3600)).padStart(2, '0');
    const cdMins = String(Math.floor((countdownTotalSec % 3600) / 60)).padStart(2, '0');
    const cdSecs = String(countdownTotalSec % 60).padStart(2, '0');
    const bellProgressPct = Math.min(100, Math.max(12, Math.round(((bellSupported ? currentBellsRung : 0) / Math.max(1, totalBellCount)) * 100)));

    return (
      <div className="chit-room-shell">
        {/* 1. Outer Light Header Bar Above the Dark Navy Studio Shell */}
        <header className="chit-room-outer-header">
          <div className="chit-room-outer-row1">
            <h2 className="chit-room-outer-title">
              <span className="material-icons-outlined" style={{ fontSize: '24px', color: '#dc2626' }}>adjust</span>
              <span>{studioHeaderTitle}</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginLeft: '4px' }}>
                ({eligibleSeatCountOrText(eligibleSeatTotal, wonMemberCount)})
              </span>
            </h2>
            <div className="chit-room-outer-leader">
              <span className="material-icons-outlined" style={{ fontSize: '22px', color: '#eab308' }}>emoji_events</span>
              {auction.winnerMemberId ? (
                <span>
                  Winner: #{auction.winnerMember?.ticketNo ?? auction.winnerMember?.memberNumber} {auction.winnerMember?.customer?.name ?? 'Winner'} · {formatCurrency(Number(auction.prizeAmount ?? 0), currencySymbol)}
                </span>
              ) : leadingBidForTable && !hideBidAmounts ? (
                <span>
                  Leading: #{leadingBidForTable.ticketNo} {leadingBidForTable.memberName || ''} · {formatCurrency(leadingBidForTable.prizeAmount, currencySymbol)}
                </span>
              ) : (
                <span>
                  Period {auction.periodNumber} of {group.totalMembers} · Next ≤ {formatCurrency(activeBidBounds.nextValidPrize, currencySymbol)}
                </span>
              )}
            </div>
          </div>

          <div className="chit-room-outer-row2">
            <div className="chit-room-light-actions">
              <Link href={`/chits/${group.groupCode ?? group.id}`} className="chit-room-light-pill">
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                {group.name}
              </Link>
              {!isDrawType && !isSealed && !locked && (
                <button
                  type="button"
                  onClick={() => void handleSetRepeatSelfBid(!allowConsecutiveSelfBid)}
                  className={`chit-room-light-pill${allowConsecutiveSelfBid ? ' chit-room-light-pill--active' : ''}`}
                  title="When OFF, duplicate multi-ticket members collapse to 1 seat per customer and wait until another member bids."
                >
                  <span className="material-icons-outlined" style={{ fontSize: '16px', color: allowConsecutiveSelfBid ? 'var(--primary-dark)' : '#0ea5e9' }}>
                    {allowConsecutiveSelfBid ? 'repeat' : 'shield'}
                  </span>
                  {allowConsecutiveSelfBid
                    ? `Repeat Self-Bid: ON (${activeSeatCount} Active)`
                    : `Repeat Self-Bid: OFF (${eligibleSeatTotal} Unique Members)`}
                </button>
              )}
              {isBiddingRoom && (
                <button
                  type="button"
                  className="chit-room-light-pill"
                  onClick={() => setShowTableCanvas((v) => !v)}
                >
                  {showTableCanvas ? 'Collapse Table' : 'Expand Table'}
                </button>
              )}
              <div
                className={`chit-room-light-lang-group${voiceEnabled ? ' chit-room-light-lang-group--active' : ''}`}
                title="Connected Voice Callout & Chat Room Language Control"
              >
                {isBiddingRoom && (
                  <button
                    type="button"
                    className="chit-room-light-lang-btn"
                    title={voiceEnabled ? 'Turn Voice Announcements OFF' : 'Turn Voice Announcements ON'}
                    onClick={() => {
                      const nextVoice = !voiceEnabled;
                      setVoiceEnabled(nextVoice);
                      setBidVoiceEnabled(nextVoice);
                      if (nextVoice) {
                        void warmUpBidVoiceEngine().then(() => {
                          void speakBidCallout({
                            prizeAmount: Number(leadingBidForTable?.prizeAmount ?? group.chitValue),
                            memberName: leadingBidForTable?.memberName || 'Live Room',
                            ticketNo: leadingBidForTable?.ticketNo,
                            lang: roomVoiceLang,
                            force: true,
                          });
                        });
                      }
                    }}
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '16px', color: voiceEnabled ? 'var(--primary-dark)' : '#64748b' }}>
                      {voiceEnabled ? 'record_voice_over' : 'voice_over_off'}
                    </span>
                    <span>{voiceEnabled ? 'Voice ON' : 'Muted'}</span>
                  </button>
                )}
                <select
                  aria-label="Room Voice and Chat Language"
                  title="Foreman room speech & chat language (independent of app UI language)"
                  disabled={busy === 'voice-settings'}
                  value={roomVoiceLang}
                  onChange={(e) => void handleSaveRoomVoiceSettings(e.target.value as BidVoiceLanguageCode, allowMemberVoiceChange, true)}
                  className="chit-room-light-lang-select"
                >
                  {BID_VOICE_LANGUAGES.map((vl) => (
                    <option key={vl.code} value={vl.code}>
                      {vl.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="chit-room-light-lang-btn"
                  disabled={busy === 'voice-settings'}
                  onClick={() => void handleSaveRoomVoiceSettings(roomVoiceLang, !allowMemberVoiceChange, false)}
                  title={
                    allowMemberVoiceChange
                      ? 'Members can switch their own voice language — click to lock to Foreman language'
                      : 'Fixed by Foreman — members hear only this language. Click to allow change.'
                  }
                >
                  <span className="material-icons-outlined" style={{ fontSize: '15px', color: allowMemberVoiceChange ? '#d97706' : '#475569' }}>
                    {allowMemberVoiceChange ? 'lock_open' : 'lock'}
                  </span>
                </button>
              </div>
            </div>

            <div className="chit-room-light-actions">
              {tableCash?.enabled && (
                <button
                  type="button"
                  className={`chit-room-light-pill${tableCash.allSettled ? ' chit-room-light-pill--active' : ''}`}
                  style={
                    !tableCash.allSettled
                      ? { background: '#fffbeb', borderColor: '#f59e0b', color: '#92400e' }
                      : undefined
                  }
                  title="Pre-auction Period Table Cash settlement sheet"
                  onClick={() => setShowTableCashModal(true)}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '16px', color: tableCash.allSettled ? 'var(--success)' : '#d97706' }}>
                    payments
                  </span>
                  Table Cash ({tableCash.settledTickets}/{tableCash.totalTickets})
                </button>
              )}
              {bellSupported && (
                <button
                  type="button"
                  className="chit-room-light-pill"
                  title="Toggle auction chime & 5s countdown tick audio"
                  onClick={() => {
                    const nextMuted = !soundMuted;
                    setSoundMuted(nextMuted);
                    setBellSoundMuted(nextMuted);
                    if (!nextMuted) playAuctionBellChime(1, totalBellCount, { force: true });
                  }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '16px', color: soundMuted ? '#64748b' : '#d97706' }}>
                    {soundMuted ? 'volume_off' : 'volume_up'}
                  </span>
                  {soundMuted ? 'Chime Off' : 'Chime ON'}
                </button>
              )}
              {!locked && (
                <button
                  type="button"
                  className="chit-room-light-pill"
                  onClick={() => setScheduleModalOpen(true)}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '16px', color: '#0284c7' }}>event</span>
                  Schedule
                </button>
              )}
              <button
                type="button"
                className="chit-room-light-pill"
                disabled={busy === 'invite'}
                onClick={handleGenerateInvite}
              >
                <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--primary-dark)' }}>share</span>
                {busy === 'invite' ? 'Creating…' : 'Invite'}
              </button>
              <button
                type="button"
                className={`chit-room-light-pill${showDenoms ? ' chit-room-light-pill--active' : ''}`}
                onClick={() => setShowDenoms((v) => !v)}
              >
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>payments</span>
                Notes
              </button>
              <div className="chit-room-light-lang-group">
                <select
                  aria-label="Report PDF Language"
                  className="chit-room-light-lang-select"
                  style={{ borderLeft: 'none' }}
                  value={pdfLang}
                  onChange={(e) => setPdfLang(e.target.value)}
                >
                  {PDF_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setPdfPreviewOpen(true)}
                  className="chit-room-light-lang-btn"
                  style={{ borderRight: '1px solid #cbd5e1', cursor: 'pointer' }}
                  title="Preview PDF before downloading"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '16px', color: '#2563eb' }}>visibility</span>
                  Preview
                </button>
                <a href={periodReportUrl} download className="chit-room-light-lang-btn" style={{ textDecoration: 'none' }} title="Download PDF">
                  <span className="material-icons-outlined" style={{ fontSize: '16px', color: '#dc2626' }}>picture_as_pdf</span>
                  PDF ↓
                </a>
              </div>
            </div>
          </div>
        </header>

        <div className="chit-studio-shell">
          {/* 2. Icon-Driven 4-Tile Telemetry Strip inside Dark Navy Studio Frame */}
          <section className="chit-studio-telemetry">
            {/* Tile 1: Live Clock & Date + Active Seats & Present */}
            <div className="chit-telemetry-tile">
              <div className="chit-telemetry-clock-split">
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                  <span className="material-icons-outlined" style={{ fontSize: '23px', color: '#cbd5e1', flexShrink: 0 }}>calendar_today</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="chit-telemetry-value">
                      {studioClock
                        ? studioClock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : formatDate(auction.auctionDate)}
                    </div>
                    <div className="chit-telemetry-meta">
                      {studioClock
                        ? studioClock.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
                        : `Period ${auction.periodNumber} of ${group.totalMembers}`}
                    </div>
                  </div>
                </div>
                <span className="chit-telemetry-divider" />
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                  <span className="material-icons-outlined" style={{ fontSize: '24px', color: '#a855f7', flexShrink: 0 }}>groups</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="chit-telemetry-value">
                      {allowConsecutiveSelfBid ? `${activeSeatCount} Seats` : `${eligibleSeatTotal} Seats`}
                    </div>
                    <div className="chit-telemetry-meta" style={{ color: '#4ade80' }}>
                      ● {presentCount} Present
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tile 2: Trophy + Leading Member + Gold Prize Pill */}
            <div className="chit-telemetry-tile chit-telemetry-tile--leader">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                <span className="material-icons-outlined" style={{ fontSize: '28px', color: '#facc15', flexShrink: 0 }}>emoji_events</span>
                <div style={{ minWidth: 0 }}>
                  <div className="chit-telemetry-kicker">
                    {auction.winnerMemberId
                      ? 'Confirmed Winner'
                      : leadingBidForTable && !hideBidAmounts
                        ? 'Leading Member'
                        : isSealed
                          ? 'Sealed Tenders'
                          : 'Next Allowed Floor'}
                  </div>
                  <div className="chit-telemetry-value" style={{ fontSize: '0.96rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {auction.winnerMemberId
                      ? `#${auction.winnerMember?.ticketNo ?? auction.winnerMember?.memberNumber} ${auction.winnerMember?.customer?.name ?? 'Winner'}`
                      : hideBidAmounts
                        ? `${live?.bidCount ?? validBids.length} Sealed Bid(s)`
                        : leadingBidForTable
                          ? `#${leadingBidForTable.ticketNo} ${leadingBidForTable.memberName || ''}`
                          : `${activeSeatCount} Eligible Active`}
                  </div>
                </div>
              </div>
              <div className="chit-telemetry-leader-pill">
                {auction.winnerMemberId
                  ? formatCurrency(Number(auction.prizeAmount ?? 0), currencySymbol)
                  : hideBidAmounts
                    ? 'SEALED'
                    : leadingBidForTable
                      ? formatCurrency(leadingBidForTable.prizeAmount, currencySymbol)
                      : `≤ ${formatCurrency(activeBidBounds.nextValidPrize, currencySymbol)}`}
              </div>
            </div>

            {/* Tile 3: Stopwatch + Time Left + Duration/Extend Controls */}
            <div className="chit-telemetry-tile">
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                <span className="material-icons-outlined" style={{ fontSize: '25px', color: roomActive ? '#38bdf8' : '#e2e8f0', flexShrink: 0 }}>timer</span>
                <div style={{ minWidth: 0 }}>
                  <div className="chit-telemetry-kicker" style={{ whiteSpace: 'nowrap' }}>
                    {roomActive ? 'Live Time Left' : isRoomClosedState ? 'Room Timer' : 'Time Left'}
                  </div>
                  <div className="chit-telemetry-value" style={{ fontSize: '1.1rem', letterSpacing: '0.4px', color: roomActive ? '#38bdf8' : '#ffffff', whiteSpace: 'nowrap' }}>
                    {`${cdHours} : ${cdMins} : ${cdSecs}`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                {!locked && isLive && !roomActive && !isRoomClosedState && (
                  <>
                    <button
                      type="button"
                      className="chit-room-glass-btn"
                      title="Decrease room duration by 5 minutes"
                      disabled={roomMinutes <= 5}
                      onClick={() => setRoomMinutes((m) => Math.max(5, Number(m || 30) - 5))}
                      style={{ padding: '4px 7px', fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' }}
                    >
                      −5m
                    </button>
                    <button
                      type="button"
                      className="chit-room-glass-btn"
                      title="Extend initial room duration by 5 minutes"
                      onClick={() => setRoomMinutes((m) => Math.min(240, Number(m || 30) + 5))}
                      style={{ padding: '4px 7px', fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' }}
                    >
                      +5m
                    </button>
                  </>
                )}
                {!locked && isLive && roomActive && (
                  <button
                    type="button"
                    className="chit-room-glass-btn"
                    title="Extend live auction timer by 5 minutes"
                    disabled={busy === 'extend-5'}
                    onClick={() =>
                      run('extend-5', () =>
                        manageChitAuctionScheduleAction(auction.id, { mode: 'extend', extendMinutes: 5 }),
                      )
                    }
                    style={{ padding: '4px 9px', fontSize: '0.73rem', fontWeight: 800, whiteSpace: 'nowrap' }}
                  >
                    {busy === 'extend-5' ? '…' : '+5m'}
                  </button>
                )}
                {!locked && isLive && !roomActive && isRoomClosedState && (
                  <button
                    type="button"
                    className="chit-room-glass-btn"
                    title="Reopen room and extend timer by 5 minutes"
                    disabled={busy === 'reopen-room'}
                    onClick={() =>
                      run('reopen-room', async () => {
                        const res = await reopenLiveRoomAction(auction.id, 5);
                        if (res && res.ok !== false) {
                          prevBellsRungRef.current = 0;
                          lastBellSoundKeyRef.current = '';
                          setBellToast('');
                          setThirdBellModalOpen(false);
                        }
                        return res;
                      })
                    }
                    style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' }}
                  >
                    {busy === 'reopen-room' ? '…' : '🔓 +5m'}
                  </button>
                )}
                {showNoticeAction && (
                  <button
                    type="button"
                    disabled={busy === 'notice'}
                    onClick={() => run('notice', () => markAuctionNoticeSent(auction.id))}
                    className="chit-room-glass-btn"
                    title="Mark auction notice sent"
                    style={{ padding: '4px 8px', fontSize: '0.7rem', whiteSpace: 'nowrap' }}
                  >
                    {busy === 'notice' ? '…' : '📢 Notice'}
                  </button>
                )}
              </div>
            </div>

            {/* Tile 4: Single-Line Bell Idle-Time Bar + 5s Urgent Countdown + Room Control */}
            <div className="chit-telemetry-tile chit-telemetry-tile--control">
              <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'nowrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <span className="material-icons-outlined" style={{ fontSize: '16px', color: bellUrgentSeconds != null ? '#fbbf24' : '#f59e0b' }}>
                      notifications_active
                    </span>
                    {bellSupported ? 'Bell Timer' : 'Room Status'}
                  </span>
                  <span
                    className={bellUrgentSeconds != null ? 'chit-bell-countdown-pill' : undefined}
                    style={{
                      padding: '2px 9px',
                      borderRadius: '999px',
                      background:
                        bellUrgentSeconds != null
                          ? 'linear-gradient(135deg, #dc2626 0%, #ea580c 100%)'
                          : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {bellUrgentSeconds != null
                      ? `🔔 ${bellUrgentSeconds}s → Bell ${currentBellsRung + 1}`
                      : bellSupported
                        ? `Bell ${currentBellsRung}/${totalBellCount}`
                        : `${presentCount}/${group.members.length}`}
                  </span>
                </div>
                <div style={{ height: '7px', borderRadius: '999px', background: 'rgba(15, 23, 42, 0.88)', overflow: 'hidden', border: '1px solid rgba(148,163,184,0.22)' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${bellSupported ? idleBellProgressPct : Math.round((presentCount / Math.max(1, group.members.length)) * 100)}%`,
                      borderRadius: '999px',
                      background:
                        bellUrgentSeconds != null
                          ? 'linear-gradient(90deg, #ef4444 0%, #f59e0b 100%)'
                          : 'linear-gradient(90deg, #f97316 0%, #facc15 45%, #22c55e 100%)',
                      transition: 'width 0.1s linear',
                    }}
                  />
                </div>
                {bellSupported && (
                  <div style={{ fontSize: '0.67rem', fontWeight: 700, color: bellUrgentSeconds != null ? '#fca5a5' : '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    {roomActive ? (
                      currentBellsRung >= totalBellCount ? (
                        <span style={{ whiteSpace: 'nowrap' }}>Final bell completed</span>
                      ) : bellUrgentSeconds != null ? (
                        <span style={{ whiteSpace: 'nowrap' }}>Next bell in {bellUrgentSeconds}s…</span>
                      ) : bellSecondsLeft != null ? (
                        <span style={{ whiteSpace: 'nowrap' }}>Idle: {bellSecondsLeft}s to Bell {currentBellsRung + 1}</span>
                      ) : (
                        <span style={{ whiteSpace: 'nowrap' }}>Auto bell · {idleBellIntervalSec}s</span>
                      )
                    ) : (
                      <span style={{ whiteSpace: 'nowrap' }}>{idleBellIntervalSec}s idle · 3 bells</span>
                    )}
                    <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{currentBellsRung}/{totalBellCount} rung</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                {locked ? (
                  <span className="chit-studio-status-pill chit-studio-status-pill--locked">
                    {String(auction.payoutStatus || 'pending').toUpperCase()}
                  </span>
                ) : isLive ? (
                  !roomActive ? (
                    (isClosedByBell || (live?.roomStatus ?? auction.roomStatus) === 'closed') ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ whiteSpace: 'nowrap' }}
                          onClick={() => setThirdBellModalOpen(true)}
                        >
                          {tiedTopCandidates.length > 1
                            ? '🎡 Tie Spin'
                            : (live?.bidCount ?? validBids.length) === 0
                              ? '🎡 Spin'
                              : '🏆 Winner'}
                        </button>
                        <span className="chit-studio-status-pill">CLOSED</span>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busy === 'open-room'}
                          onClick={handlePrimaryStartAction}
                          style={{
                            fontWeight: 800,
                            whiteSpace: 'nowrap',
                            ...(needsTableCashBeforeStart
                              ? { background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', borderColor: '#fbbf24' }
                              : {}),
                          }}
                        >
                          {busy === 'open-room'
                            ? 'Starting…'
                            : needsTableCashBeforeStart
                              ? `💵 Cash (${tableCash!.settledTickets}/${tableCash!.totalTickets})`
                              : '▶ Start Live'}
                        </button>
                        <span className="chit-studio-status-pill">
                          {String(live?.roomStatus ?? auction.roomStatus ?? 'SCHEDULED').toUpperCase()}
                        </span>
                      </>
                    )
                  ) : (
                    <>
                      {bellSupported && currentBellsRung < totalBellCount && (
                        <button
                          type="button"
                          className="chit-room-glass-btn"
                          style={{ background: 'rgba(234, 88, 12, 0.28)', borderColor: 'rgba(251, 146, 60, 0.55)', color: '#fed7aa', whiteSpace: 'nowrap' }}
                          disabled={busy === 'ring-bell'}
                          title={`Ring Bell ${currentBellsRung + 1} of ${totalBellCount} manually now`}
                          onClick={async () => {
                            const targetBell = Math.min(totalBellCount, currentBellsRung + 1);
                            triggerBellFeedback(
                              targetBell,
                              totalBellCount,
                              live?.bidCount ?? validBids.length,
                              leadingBidForTable?.ticketNo != null ? String(leadingBidForTable.ticketNo) : null,
                            );
                            await run('ring-bell', () => ringLiveBell(auction.id));
                          }}
                        >
                          {busy === 'ring-bell' ? '…' : '🔔 Ring'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="chit-room-glass-btn"
                        style={{ background: 'rgba(220, 38, 38, 0.28)', borderColor: 'rgba(248, 113, 113, 0.5)', color: '#fecaca', whiteSpace: 'nowrap' }}
                        disabled={busy === 'close-room'}
                        onClick={() => run('close-room', () => closeLiveRoom(auction.id))}
                      >
                        Close
                      </button>
                      <span className="chit-studio-status-pill chit-studio-status-pill--live">● LIVE</span>
                    </>
                  )
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={() => {
                      setRightTab('log');
                      setShowStudioDrawer(true);
                    }}
                  >
                    ✅ Allocate Period
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Guided Post-Auction Next-Step Studio Strip (never leaves foreman wondering what happens next) */}
          {auction.winnerMemberId && (() => {
            const isPaidDone = auction.payoutStatus === 'paid';
            const isSecurityApproved = security?.status === 'approved';
            return (
              <div
                style={{
                  margin: '2px 16px 8px',
                  padding: '10px 14px',
                  borderRadius: '13px',
                  background: isPaidDone
                    ? 'linear-gradient(120deg, rgba(22, 163, 74, 0.22) 0%, rgba(15, 27, 46, 0.92) 100%)'
                    : isSecurityApproved
                      ? 'linear-gradient(120deg, rgba(14, 165, 233, 0.2) 0%, rgba(15, 27, 46, 0.92) 100%)'
                      : 'linear-gradient(120deg, rgba(245, 158, 11, 0.2) 0%, rgba(15, 27, 46, 0.92) 100%)',
                  border: isPaidDone
                    ? '1px solid rgba(74, 222, 128, 0.45)'
                    : isSecurityApproved
                      ? '1px solid rgba(56, 189, 248, 0.45)'
                      : '1px solid rgba(251, 191, 36, 0.48)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <span
                    className="material-icons-outlined"
                    style={{
                      fontSize: '22px',
                      color: isPaidDone ? '#4ade80' : isSecurityApproved ? '#38bdf8' : '#fde047',
                    }}
                  >
                    {isPaidDone ? 'task_alt' : isSecurityApproved ? 'payments' : 'verified_user'}
                  </span>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#ffffff' }}>
                      {isPaidDone
                        ? `Period ${auction.periodNumber} Settled — Winner Paid (${formatCurrency(Number(auction.prizeAmount ?? 0), currencySymbol)})`
                        : isSecurityApproved
                          ? `Step 3 of 3: Security Approved — ${canReleasePayout ? 'Release Prize Payout' : 'Awaits Superadmin Payout'} (${formatCurrency(Number(auction.prizeAmount ?? 0), currencySymbol)})`
                          : security?.status === 'verified' && !canApproveSecurity
                            ? 'Step 2 of 3: Security Verified — Waiting for Superadmin Final Approval (CHIT-29)'
                            : `Step 2 of 3: ${canApproveSecurity ? 'Approve Winner Security to Unlock Payout' : 'Verify Winner Security for Superadmin Approval'}`}
                    </div>
                    <div style={{ fontSize: '0.73rem', color: '#cbd5e1' }}>
                      {isPaidDone
                        ? 'Download Period PDF or proceed directly to the next period auction.'
                        : isSecurityApproved
                          ? canReleasePayout
                            ? 'Review arrears deductions and disburse cash/UPI/bank payout below.'
                            : 'Sign in as Superadmin (Owner) to release the approved payout.'
                          : canApproveSecurity
                            ? 'Approve uploaded documents or click Approve Security & Unlock Payout below.'
                            : 'Admin verifies collateral documents; Superadmin gives final approval per CHIT-29.'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ fontWeight: 800, whiteSpace: 'nowrap' }}
                    onClick={() => focusSettlementWorkflow()}
                  >
                    {isPaidDone
                      ? 'View Receipt & Summary ↓'
                      : isSecurityApproved
                        ? '💸 Go to Release Payout ↓'
                        : canApproveSecurity
                          ? '🛡️ Go to Security Approval ↓'
                          : '🛡️ Verify / Notify Superadmin ↓'}
                  </button>
                  {isPaidDone && nextAuction && (
                    <Link
                      href={`/chits/${group.groupCode ?? group.id}/auctions/${nextAuction.id}`}
                      className="chit-room-glass-btn"
                      style={{ background: 'rgba(250, 204, 21, 0.2)', borderColor: 'rgba(250, 204, 21, 0.55)', color: '#fef08a', fontWeight: 800 }}
                    >
                      ▶ Next Period (P{nextAuction.periodNumber}) →
                    </Link>
                  )}
                  {isPaidDone && (
                    <Link
                      href={`/chits/${group.groupCode ?? group.id}`}
                      className="chit-room-glass-btn"
                    >
                      Chit Overview →
                    </Link>
                  )}
                </div>
              </div>
            );
          })()}

          {inviteInfo && (
            <div
              style={{
                margin: '10px 20px 0',
                padding: '11px 15px',
                borderRadius: '12px',
                background: 'rgba(22, 163, 74, 0.16)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ fontSize: '0.82rem', color: '#86efac', fontWeight: 700 }}>
                {inviteNotice || 'Invite ready!'}{' '}
                <code style={{ marginLeft: '6px', padding: '2px 7px', borderRadius: '6px', background: 'rgba(15,23,42,0.85)', color: '#f8fafc' }}>
                  {inviteInfo.joinUrl}
                </code>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a href={inviteInfo.shareUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                  Share on WhatsApp →
                </a>
                <button type="button" className="chit-room-glass-btn" onClick={() => setInviteInfo(null)}>
                  Close
                </button>
              </div>
            </div>
          )}

          {showDenoms && (
            <div
              style={{
                margin: '10px 20px 0',
                padding: '12px 15px',
                borderRadius: '12px',
                background: 'rgba(15, 23, 42, 0.72)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-end',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', alignSelf: 'center', marginRight: '4px' }}>
                Cash Notes for PDF:
              </div>
              {denomFields.map((item) => (
                <div key={item.denom} className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{currencySymbol}{item.denom}</label>
                  <input
                    type="number"
                    min={0}
                    className="form-control"
                    value={item.val}
                    onChange={(e) => item.set(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                    style={{ width: '78px', padding: '5px 8px', background: 'rgba(15,23,42,0.9)', color: '#f8fafc', borderColor: 'rgba(148,163,184,0.28)' }}
                  />
                </div>
              ))}
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4ade80', alignSelf: 'center' }}>
                Total: {formatCurrency(currentDenomTotal, currencySymbol)}
              </div>
              {auction.payoutStatus === 'paid' && payoutReceipt && (
                <button
                  type="button"
                  className="chit-room-glass-btn"
                  disabled={busy === 'save-denoms'}
                  onClick={() => run('save-denoms', () => updatePayoutDenominationsAction(auction.id, JSON.stringify(currentDenomMap)))}
                >
                  {busy === 'save-denoms' ? 'Saving…' : 'Save Notes'}
                </button>
              )}
              <button
                type="button"
                className="chit-room-glass-btn"
                onClick={() => setPdfPreviewOpen(true)}
              >
                👁 Preview PDF
              </button>
              <a href={periodReportUrl} download className="btn btn-primary btn-sm">
                Download PDF with Notes
              </a>
            </div>
          )}

          {bellToast && (
            <div
              style={{
                margin: '10px 20px 0',
                textAlign: 'center',
                padding: '10px 16px',
                background: 'linear-gradient(90deg, #b45309, #ea580c)',
                color: '#fff',
                borderRadius: '12px',
                border: '1px solid #fde047',
                fontWeight: 800,
                fontSize: '1rem',
              }}
            >
              🔔 {bellToast}
            </div>
          )}

          {error && (
            <div
              style={{
                margin: '10px 20px 0',
                padding: '11px 15px',
                background: 'rgba(220, 38, 38, 0.18)',
                border: '1px solid rgba(248, 113, 113, 0.5)',
                borderRadius: '12px',
                color: '#fecaca',
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          )}

          {/* 3. Shared-Background 70:30 Studio Stage (Table Arena w/ Lights + Live Chat/Activity/Members Dock) */}
          {(() => {
            const rawMembers = group.members ?? [];
            const activeRawMembers = rawMembers.filter((m: any) => !m.hasWon);
            const leadingMemberObj = leadingBidForTable
              ? rawMembers.find(
                (m: any) => (m.ticketNo ?? m.memberNumber) == leadingBidForTable.ticketNo,
              )
              : null;
            const leadingCustomerId = leadingMemberObj?.customerId ?? null;
            const consolidatedGroups = consolidateSeatsByCustomer(rawMembers, leadingBidForTable?.ticketNo)
              .filter((grp) => !grp.tickets.every((t: any) => Boolean(t.hasWon)));
            const arenaSeats = allowConsecutiveSelfBid
              ? interleaveSeatsByCustomer(activeRawMembers).map((m: any) => {
                const liveSeat = live?.seats?.find((s: any) => s.memberId === m.id);
                const liveBidRow = live?.memberBids?.[m.id]?.[0];
                const ssrBidRow = !hideBidAmounts ? validBids.find((b: any) => b.memberId === m.id) : null;
                const seatLatestPrize =
                  liveSeat?.latestPrize ??
                  (liveBidRow?.prizeAmount != null
                    ? Number(liveBidRow.prizeAmount)
                    : ssrBidRow?.bidAmount != null
                      ? Number(ssrBidRow.bidAmount)
                      : null);
                const isOnline =
                  attendanceOf(m.id) === 'present' ||
                  attendanceOf(m.id) === 'proxy' ||
                  Boolean(liveSeat && !liveSeat.passed && seatLatestPrize !== null);
                return {
                  memberId: m.id,
                  customerId: m.customerId,
                  ticketNo: m.ticketNo ?? m.memberNumber,
                  name: m.customer?.name ?? 'Member',
                  photoUrl: liveSeat?.profilePhoto || m.customer?.profilePhoto || null,
                  isOnline,
                  isLeader: Boolean(leadingBidForTable && leadingBidForTable.ticketNo == (m.ticketNo ?? m.memberNumber)),
                  hasWon: false,
                  isPaused: false,
                  latestPrize: seatLatestPrize,
                };
              })
              : consolidatedGroups.map((grp) => {
                const m = grp.primary as any;
                const liveSeat = live?.seats?.find((s: any) => s.memberId === m.id);
                const ticketPrizes = grp.tickets
                  .map((t: any) => {
                    const tLive = live?.memberBids?.[t.id]?.[0]?.prizeAmount;
                    if (tLive != null) return Number(tLive);
                    const tSsr = !hideBidAmounts ? validBids.find((b: any) => b.memberId === t.id)?.bidAmount : null;
                    return tSsr != null ? Number(tSsr) : null;
                  })
                  .filter((p): p is number => p != null && Number.isFinite(p));
                const bestTicketPrize = ticketPrizes.length > 0 ? Math.min(...ticketPrizes) : null;
                const seatLatestPrize = liveSeat?.latestPrize ?? bestTicketPrize;
                const isOnline = grp.tickets.some((t: any) => {
                  const tLive = live?.seats?.find((s: any) => s.memberId === t.id);
                  return (
                    attendanceOf(t.id) === 'present' ||
                    attendanceOf(t.id) === 'proxy' ||
                    Boolean(tLive && !tLive.passed && tLive.latestPrize !== null)
                  );
                });
                const ticketPhoto =
                  grp.tickets
                    .map((t: any) => live?.seats?.find((s: any) => s.memberId === t.id)?.profilePhoto || t.customer?.profilePhoto)
                    .find(Boolean) ?? null;
                const isSameCustomerLeading = Boolean(leadingCustomerId && m.customerId === leadingCustomerId);
                const ticketLabel = grp.ticketNos.map((n) => `#${n}`).join(', ');
                return {
                  memberId: m.id,
                  customerId: m.customerId,
                  ticketNo: m.ticketNo ?? m.memberNumber,
                  name: m.customer?.name ?? 'Member',
                  photoUrl: ticketPhoto,
                  isOnline,
                  isLeader: Boolean(
                    leadingBidForTable &&
                    (isSameCustomerLeading || leadingBidForTable.ticketNo == (m.ticketNo ?? m.memberNumber)),
                  ),
                  hasWon: false,
                  isPaused: isSameCustomerLeading,
                  ticketCount: grp.ticketCount,
                  ticketLabel: grp.ticketCount > 1 ? ticketLabel : undefined,
                  latestPrize: seatLatestPrize,
                };
              });

            const quickRailItems = allowConsecutiveSelfBid
              ? interleaveSeatsByCustomer(activeRawMembers).map((m: any) => ({
                member: m,
                ticketCount: 1,
                ticketNos: [String(m.ticketNo ?? m.memberNumber)],
                allWon: false,
              }))
              : consolidatedGroups.map((grp) => ({
                member: grp.primary as any,
                ticketCount: grp.ticketCount,
                ticketNos: grp.ticketNos,
                allWon: false,
              }));

            return (
              <div className="chit-room-stage-split">
                {roomMode === 'LOTTERY_DRAW' ? (
                  <LotteryDrawStage
                    periodNumber={auction.periodNumber}
                    chitValue={Number(group.chitValue)}
                    currencySymbol={currencySymbol}
                    scheduledLabel={
                      auction.scheduledAt
                        ? new Date(auction.scheduledAt).toLocaleString([], {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                        : formatDate(auction.auctionDate)
                    }
                    candidates={activeRawMembers.map((m: any) => ({
                      memberId: m.id,
                      ticketNo: String(m.ticketNo ?? m.memberNumber),
                      name: m.customer?.name ?? 'Member',
                      hasWon: Boolean(m.hasWon),
                      isOnline: attendanceOf(m.id) === 'present' || attendanceOf(m.id) === 'proxy',
                      photoUrl: m.customer?.profilePhoto || null,
                    }))}
                    allSeats={arenaSeats}
                    winner={
                      auction.winnerMemberId
                        ? {
                          memberId: auction.winnerMemberId,
                          ticketNo: String(auction.winnerMember?.ticketNo ?? auction.winnerMember?.memberNumber ?? ''),
                          name: auction.winnerMember?.customer?.name ?? 'Winner',
                          prizeAmount: Number(auction.prizeAmount ?? group.chitValue),
                        }
                        : null
                    }
                    locked={locked}
                    busy={busy === 'draw'}
                    canManage
                    dict={dict}
                    onOpenSchedule={() => setScheduleModalOpen(true)}
                    onTriggerDraw={async () => {
                      setBusy('draw');
                      setError('');
                      try {
                        const res = await drawAuctionWinner(auction.id);
                        if (res && typeof res === 'object' && 'ok' in res && res.ok === false) {
                          setError(res.error || 'Could not draw lucky winner');
                          setBusy('');
                          return null;
                        }
                        router.refresh();
                        window.dispatchEvent(new CustomEvent('zolofund:chit-auction-updated'));
                        setBusy('');
                        return (res as any)?.winner ?? null;
                      } catch (e: any) {
                        setError(e?.message || 'Could not draw lucky winner');
                        setBusy('');
                        return null;
                      }
                    }}
                  />
                ) : !isBiddingRoom ? (
                  <section className="chit-studio-arena-col">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '0 4px' }}>
                      <strong style={{ fontSize: '0.96rem', color: '#f8fafc' }}>
                        {roomMode === 'CONSENSUS' ? '🤝 Mutual Consensus Allocation' : '🔄 Scheduled Cycle Allocation'} — Period {auction.periodNumber}
                      </strong>
                      <button type="button" className="chit-room-glass-btn" onClick={() => setShowModeCircle((v) => !v)}>
                        {showModeCircle ? 'Hide Circle' : '👥 Active Member Circle'}
                      </button>
                    </div>
                    {showModeCircle ? (
                      <PokerTableArena
                        embedded
                        periodNumber={auction.periodNumber}
                        chitValue={Number(group.chitValue)}
                        currencySymbol={currencySymbol}
                        roomStatus={auction.roomStatus}
                        auctionStatus={auction.status}
                        isOpen={!locked}
                        hideBidAmounts
                        seats={arenaSeats}
                        emptyCenterLabel={formatDate(auction.auctionDate)}
                      />
                    ) : (
                      <div
                        style={{
                          padding: '28px 20px',
                          borderRadius: '16px',
                          background: 'rgba(15, 23, 42, 0.55)',
                          border: '1px solid rgba(148, 163, 184, 0.18)',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6ee7b7', textTransform: 'uppercase' }}>
                          {roomMode === 'CONSENSUS' ? 'No Bidding — Group Consensus' : 'No Auction Bidding — Pre-Set Turn / Savings'}
                        </div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc' }}>
                          {formatCurrency(Number(group.chitValue), currencySymbol)}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1' }}>
                          {auction.winnerMemberId
                            ? `Allocated to #${auction.winnerMember?.ticketNo ?? auction.winnerMember?.memberNumber} · ${auction.winnerMember?.customer?.name ?? 'Winner'}`
                            : roomMode === 'CONSENSUS'
                              ? 'Choose the unanimous recipient in the Period Desk below and confirm allocation.'
                              : 'Use the allocation action in the Period Desk below to resolve this cycle.'}
                        </p>
                      </div>
                    )}
                  </section>
                ) : (
            <section className="chit-studio-arena-col">
              {showTableCanvas && (
              <PokerTableArena
                embedded
                periodNumber={auction.periodNumber}
                chitValue={Number(group.chitValue)}
                currencySymbol={currencySymbol}
                roomStatus={live?.roomStatus ?? auction.roomStatus}
                auctionStatus={auction.status}
                isOpen={roomActive}
                secondsRemaining={live?.secondsRemaining ?? 0}
                hideBidAmounts={hideBidAmounts}
                bidCount={live?.bidCount ?? validBids.length}
                bell={bellSupported ? live?.bell : null}
                bellAlertText={bellToast || null}
                bellCountdownSec={bellUrgentSeconds}
                nextBellNumber={currentBellsRung + 1}
                confirmedWinner={
                  auction.winnerMemberId
                    ? {
                      ticketNo:
                        auction.winnerMember?.ticketNo ?? auction.winnerMember?.memberNumber ?? '—',
                      memberName: auction.winnerMember?.customer?.name ?? 'Winner',
                      prizeAmount: Number(auction.prizeAmount ?? 0),
                    }
                    : live?.winner
                      ? {
                        ticketNo: live.winner.ticketNo ?? '—',
                        memberName: live.winner.name ?? 'Winner',
                        prizeAmount: Number(live.winner.prizeAmount ?? 0),
                      }
                      : null
                }
                selectedMemberId={bidMemberId}
                emptyCenterLabel={formatDate(auction.auctionDate)}
                highestBid={leadingBidForTable}
                seats={arenaSeats}
                onSelectSeat={isSealed ? undefined : (seat) => {
                  const m = group.members.find((x: any) => x.id === seat.memberId);
                  const liveSeat = live?.seats?.find((s: any) => s.memberId === seat.memberId);
                  if (m) {
                    setPopupBidPrize(activeBidBounds.nextValidPrize);
                    setSeatModal({ ...m, liveSeat });
                  }
                  if (!seat.hasWon) setBidMemberId(seat.memberId);
                }}
              />
            )}

            {/* Fallback Quick-Select Active Bidders Rail (shown only when visual table is collapsed) */}
            {!showTableCanvas && !isSealed && quickRailItems.length > 0 && (
              <div className="chit-room-seat-rail">
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#94a3b8', whiteSpace: 'nowrap', marginRight: '2px' }}>
                  Active Seats ({quickRailItems.length}):
                </span>
                {quickRailItems.map((item) => {
                  const m = item.member;
                  const isSel = bidMemberId === m.id;
                  const online = attendanceOf(m.id) === 'present' || attendanceOf(m.id) === 'proxy';
                  const isConsecutiveLocked =
                    !allowConsecutiveSelfBid &&
                    Boolean(leadingCustomerId && m.customerId === leadingCustomerId);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={locked}
                      title={isConsecutiveLocked ? 'Leading customer — waiting for another member bid first (or toggle Repeat Self-Bid ON)' : undefined}
                      onClick={() => {
                        const liveSeat = live?.seats?.find((s: any) => s.memberId === m.id);
                        setPopupBidPrize(activeBidBounds.nextValidPrize);
                        setBidMemberId(m.id);
                        setSeatModal({ ...m, liveSeat });
                      }}
                      style={isConsecutiveLocked ? { opacity: 0.56 } : undefined}
                      className={`chit-room-seat-chip${isSel ? ' chit-room-seat-chip--selected' : ''}`}
                    >
                      <span style={{ fontWeight: 800 }}>
                        {item.ticketCount > 1 ? `#${item.ticketNos.join(',')}` : `#${m.ticketNo ?? m.memberNumber}`}
                      </span>
                      <span>{m.customer?.name?.split(' ')[0] || 'Member'}</span>
                      {online && <span style={{ color: isSel ? '#bbf7d0' : '#4ade80', fontSize: '0.66rem' }}>●</span>}
                      {isConsecutiveLocked && <span style={{ fontSize: '0.66rem' }}>⏳</span>}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="chit-room-glass-btn"
                  style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '0.75rem' }}
                  onClick={() => setShowTableCanvas(true)}
                >
                  Show Table
                </button>
              </div>
            )}
          </section>
              )}

          {/* Right 30% Studio Dock: Live Activity | Chat | Members */}
          <div className="chit-room-chat-dock">
            <AuctionRoomChatBox
              variant="studio"
              showVoiceControlBar={false}
              currencySymbol={currencySymbol}
              messages={roomMessages}
              waiting={live?.waiting ?? []}
              busy={busy}
              locked={locked}
              roomMode={roomMode}
              activityFeed={studioActivityFeed}
              activityLoading={timelineLoading}
              onRefreshActivity={fetchTimeline}
              membersPanel={studioMembersRoster}
              biddingDisabledReason={
                isBiddingRoom && !locked && !roomActive
                  ? isClosedByBell || (live?.roomStatus ?? auction.roomStatus) === 'closed'
                    ? 'Room is closed — re-open (+5m) or confirm winner above.'
                    : needsTableCashBeforeStart
                      ? 'Table Cash is enabled — collect pending member cash before starting live bidding.'
                      : 'Press Start Live Now above to enable live bidding.'
                  : undefined
              }
              onStartLive={
                isLive && !locked && !roomActive && !isClosedByBell && (live?.roomStatus ?? auction.roomStatus) !== 'closed'
                  ? handlePrimaryStartAction
                  : undefined
              }
              startLiveLabel={
                needsTableCashBeforeStart
                  ? `Collect Cash (${tableCash!.settledTickets}/${tableCash!.totalTickets}) to Start`
                  : undefined
              }
              startLiveIcon={needsTableCashBeforeStart ? 'payments' : 'play_arrow'}
              startLiveBusy={busy === 'open-room'}
              voiceControl={{
                language: roomVoiceLang,
                allowMemberChange: allowMemberVoiceChange,
                saving: busy === 'voice-settings',
                onChangeLanguage: (nextLang) => void handleSaveRoomVoiceSettings(nextLang, allowMemberVoiceChange, true),
                onToggleAllowMemberChange: (allow) => void handleSaveRoomVoiceSettings(roomVoiceLang, allow, false),
              }}
              bidding={{
                enabled: canBidLiveNow,
                currencySymbol,
                chitValue: Number(group.chitValue),
                minPrize: activeBidBounds.minPrize,
                maxPrize: activeBidBounds.nextValidPrize,
                quickOptions: isSealed ? [] : (activeBidBounds.templatePrizes ?? []).map((tp) => tp.prizeAmount),
                eligibleBidders,
                selectedMemberId: bidMemberId,
                onSelectMemberId: setBidMemberId,
                onPlaceBid: async (prizeAmount, explicitMemberId) => {
                  const targetId = explicitMemberId || bidMemberId;
                  if (!targetId) return;
                  await run('bid', async () => {
                    const res = await addAuctionBid(auction.id, targetId, prizeAmount, null, {
                      blockConsecutiveSelfBid: !allowConsecutiveSelfBid,
                    });
                    if (res && res.ok !== false) {
                      prevBellsRungRef.current = 0;
                      lastBellSoundKeyRef.current = '';
                      setBellToast('');
                      if (!explicitMemberId) setBidMemberId('');
                    }
                    return res;
                  });
                },
              }}
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
          </div>
        </div>
          );
        })()}

        {/* 4. Bottom Reference Studio Bar */}
        <footer className="chit-studio-footer-bar">
          <span style={{ fontSize: '0.84rem', color: '#cbd5e1', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '18px', color: '#cbd5e1' }}>info</span>
            {auction.winnerMemberId
              ? auction.payoutStatus === 'paid'
                ? `Period ${auction.periodNumber} settled — review receipt or continue to next period`
                : 'Winner confirmed — complete security approval & prize payout below'
              : 'Click any member around the table to bid directly or view history'}
          </span>
          <div className="chit-studio-tabs">
            {(
              [
                { id: 'attendance', label: 'Members', icon: 'groups' },
                { id: 'bids', label: isBiddingRoom ? 'Bids' : 'Allocation', icon: 'tune' },
                { id: 'winners', label: previousWinners.length > 0 ? `Winners (${previousWinners.length})` : 'Winners', icon: 'emoji_events' },
                { id: 'log', label: 'Auction Log', icon: 'description' },
                {
                  id: 'settlement',
                  label: auction.winnerMemberId
                    ? auction.payoutStatus === 'paid'
                      ? '✓ Settled'
                      : 'Settlement & Payout'
                    : 'Settlement',
                  icon: auction.payoutStatus === 'paid' ? 'task_alt' : 'verified_user',
                },
              ] as const
            ).map((tab) => {
              const active = showStudioDrawer && rightTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (showStudioDrawer && rightTab === tab.id) {
                      setShowStudioDrawer(false);
                    } else {
                      setRightTab(tab.id);
                      setShowStudioDrawer(true);
                    }
                  }}
                  className={`chit-studio-tab${active ? ' chit-studio-tab--active' : ''}`}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '18px' }}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </footer>
        </div>{/* /.chit-studio-shell */}

        {/* Light-Theme Consolidated Bottom Drawer Outside Navy Frame */}
        {showStudioDrawer && (
          <div className="chit-studio-drawer">
            {rightTab === 'winners' && (
              <div className="chit-studio-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span className="material-icons-outlined" style={{ fontSize: '19px', color: '#d97706' }}>emoji_events</span>
                      Previous Chit Winners — Datewise ({previousWinners.length})
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Completed cycle winners sit off the active bidding table while their live presence shows below.
                    </div>
                  </div>
                </div>
                {previousWinners.length === 0 ? (
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                    No winners confirmed yet in previous cycles of this chit group.
                  </p>
                ) : (
                  <div className="table-wrapper" style={{ maxHeight: '340px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th>Date Won</th>
                          <th>Ticket</th>
                          <th>Member</th>
                          <th>Presence</th>
                          <th>Prize Won</th>
                          <th>Discount</th>
                          <th>Dividend / Ticket</th>
                          <th>Payout</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {previousWinners.map((w) => {
                          const online = attendanceOf(w.memberId) === 'present' || attendanceOf(w.memberId) === 'proxy';
                          return (
                            <tr key={`${w.auctionId ?? w.source}-${w.memberId}`}>
                              <td style={{ fontWeight: 800 }}>
                                {w.periodNumber != null ? `Period ${w.periodNumber}` : 'Migrated'}
                              </td>
                              <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                                {w.wonDate ? formatDate(w.wonDate) : '—'}
                              </td>
                              <td style={{ fontWeight: 800, color: 'var(--primary-dark)' }}>#{w.ticketNo}</td>
                              <td style={{ fontWeight: 700 }}>{w.memberName}</td>
                              <td>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: online ? 'var(--success)' : 'var(--text-secondary)' }}>
                                  {online ? '● LIVE' : 'Offline'}
                                </span>
                              </td>
                              <td style={{ fontWeight: 800, color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>
                                {formatCurrency(w.prizeAmount, currencySymbol)}
                              </td>
                              <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                                {formatCurrency(w.bidDiscount, currencySymbol)}
                              </td>
                              <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                                {w.dividend > 0 ? formatCurrency(w.dividend, currencySymbol) : '—'}
                              </td>
                              <td>
                                <span className={`badge badge-${w.payoutStatus === 'paid' ? 'success' : w.payoutStatus === 'ready' ? 'info' : 'warning'}`}>
                                  {w.payoutStatus}
                                </span>
                              </td>
                              <td>
                                {w.auctionId && w.auctionId !== auction.id && (
                                  <Link
                                    href={`/chits/${group.groupCode ?? group.id}/auctions/${w.auctionId}`}
                                    className="chit-drawer-pill-btn"
                                    style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                  >
                                    View →
                                  </Link>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {rightTab === 'bids' && (
              <>
                {/* Bids Tab: Dedicated Bid Multiplier & Narrow Bid Control (+ Sealed Entry when Sealed) */}
                {!isDrawType && !isSealed ? (
                  <div className="chit-studio-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text)' }}>
                          ⚖️ Bid Multiplier &amp; Narrow Bid Control
                        </h3>
                        <span className="badge badge-info">
                          {activeBidBounds.step <= 1
                            ? `${currencySymbol}1 Narrow Allowed`
                            : activeBidBounds.strictBidMultiple
                              ? `${currencySymbol}${activeBidBounds.step.toLocaleString('en-IN')} Strict Multiplier`
                              : `Min Step ${currencySymbol}${activeBidBounds.step.toLocaleString('en-IN')}`}
                        </span>
                      </div>
                      {!locked && (
                        <button
                          type="button"
                          disabled={busy === 'bid-multiplier' || liveMultiplierInput <= 1}
                          onClick={() => void applyLiveBidMultiplier(liveMultiplierInput, !liveStrictMultiple)}
                          className={`chit-drawer-pill-btn${liveStrictMultiple && liveMultiplierInput > 1 ? ' chit-drawer-pill-btn--active' : ''}`}
                          title="Block narrow ₹1 increments like 5001, 5002 and require exact multiplier jumps"
                        >
                          {liveStrictMultiple && liveMultiplierInput > 1
                            ? '🚫 Narrow Bids Restricted'
                            : '🔓 Narrow Steps Unchecked'}
                        </button>
                      )}
                    </div>
                    {!locked ? (
                      <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {[
                            { step: 1, label: `${currencySymbol}1 (Narrow)` },
                            { step: 50, label: `${currencySymbol}50` },
                            { step: 100, label: `${currencySymbol}100` },
                            { step: 500, label: `${currencySymbol}500` },
                            { step: 1000, label: `${currencySymbol}1,000` },
                          ].map((preset) => (
                            <button
                              key={preset.step}
                              type="button"
                              disabled={busy === 'bid-multiplier'}
                              onClick={() => void applyLiveBidMultiplier(preset.step, preset.step > 1)}
                              className={`chit-drawer-pill-btn${activeBidBounds.step === preset.step ? ' chit-drawer-pill-btn--active' : ''}`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                          <input
                            type="number"
                            min={1}
                            max={Number(group.chitValue)}
                            className="form-control"
                            style={{ width: '96px', minHeight: '34px', fontSize: '0.86rem' }}
                            value={liveMultiplierInput}
                            onChange={(e) => {
                              const next = Math.max(1, Math.round(Number(e.target.value) || 1));
                              setLiveMultiplierInput(next);
                              if (next <= 1) setLiveStrictMultiple(false);
                            }}
                            aria-label="Live custom bid multiplier"
                          />
                          <button
                            type="button"
                            disabled={busy === 'bid-multiplier'}
                            className="chit-drawer-pill-btn"
                            onClick={() => void applyLiveBidMultiplier(liveMultiplierInput, liveMultiplierInput > 1 ? liveStrictMultiple : false)}
                          >
                            {busy === 'bid-multiplier' ? 'Saving…' : 'Apply Live'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                        Period is locked ({String(auction.status)}). Quick bidding and multiplier edits are closed for this cycle.
                      </p>
                    )}

                    {bellSupported && !locked && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>
                          🔔 Idle Bell Countdown Between Bids:{' '}
                          <span style={{ color: 'var(--primary-dark)' }}>{idleBellIntervalSec}s per bell</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {[10, 15, 20, 30, 60].map((sec) => (
                            <button
                              key={sec}
                              type="button"
                              disabled={busy === 'bell-interval'}
                              onClick={() => void run('bell-interval', () => updateChitBellIntervalAction(auction.id, sec))}
                              className={`chit-drawer-pill-btn${idleBellIntervalSec === sec ? ' chit-drawer-pill-btn--active' : ''}`}
                            >
                              {sec}s
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : isSealed && !locked ? (
                  <AuctionAutomatedBidBox
                    variant="default"
                    roomOpen={roomActive}
                    onStartLive={
                      isLive && !roomActive && !isClosedByBell && (live?.roomStatus ?? auction.roomStatus) !== 'closed'
                        ? handlePrimaryStartAction
                        : undefined
                    }
                    startLiveBusy={busy === 'open-room'}
                    bounds={activeBidBounds}
                    eligibleBidders={eligibleBidders}
                    bidMemberId={bidMemberId}
                    onChangeMemberId={setBidMemberId}
                    bidPrize={bidPrize}
                    onChangePrize={setBidPrize}
                    onPlaceBid={(amt) => {
                      run('bid', async () => {
                        const res = await addAuctionBid(auction.id, bidMemberId, amt, null, {
                          blockConsecutiveSelfBid: !allowConsecutiveSelfBid,
                        });
                        if (res && res.ok !== false) {
                          prevBellsRungRef.current = 0;
                          lastBellSoundKeyRef.current = '';
                          setBellToast('');
                          setBidMemberId('');
                        }
                        return res;
                      });
                    }}
                    currencySymbol={currencySymbol}
                    busy={busy === 'bid'}
                    isSealed={isSealed}
                    labels={{
                      title: 'Submit Sealed Tender Bid',
                      member: d.member,
                      selectMember: d.selectMember,
                      prizeAmount: d.prizeAmount,
                      placeBid: 'Submit Sealed Bid',
                      startLive: needsTableCashBeforeStart
                        ? `💵 Collect Cash (${tableCash!.settledTickets}/${tableCash!.totalTickets})`
                        : undefined,
                    }}
                  />
                ) : (
                  <div className="chit-studio-panel" style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                    This period uses <strong>{roomMode.replaceAll('_', ' ')}</strong> allocation — open <strong>Auction Log</strong> to resolve or review period details.
                  </div>
                )}
              </>
            )}

            {rightTab === 'log' && (
              <>
                {/* Confirm / Draw / Decide Period */}
                {!locked && (
                  <div className="chit-studio-panel">
                    <h3 style={{ margin: '0 0 12px', fontSize: '0.98rem', fontWeight: 700, color: 'var(--text)' }}>✅ Decide period</h3>
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
                          onClick={async () => {
                            const ok = await run('draw', () => drawAuctionWinner(auction.id, { selectedMemberId: consensusMemberId, consensusReason }));
                            if (ok) {
                              focusSettlementWorkflow({
                                tone: 'success',
                                title: 'Step 1 Complete — Winner Allocated',
                                detail: 'Next: submit and approve winner security (Step 2) to unlock prize payout.',
                              });
                            }
                          }}
                        >
                          {busy === 'draw' ? 'Allocating…' : 'Allocate by Consensus'}
                        </button>
                      </div>
                    ) : isDrawType ? (
                      <button
                        className="btn btn-primary"
                        disabled={busy === 'draw'}
                        onClick={async () => {
                          const ok = await run('draw', () => drawAuctionWinner(auction.id));
                          if (ok) {
                            focusSettlementWorkflow({
                              tone: 'success',
                              title: 'Step 1 Complete — Winner Drawn',
                              detail: 'Next: submit and approve winner security (Step 2) to unlock prize payout.',
                            });
                          }
                        }}
                      >
                        {busy === 'draw' ? 'Resolving…' : group.auctionType === 'lottery' ? '🎲 Draw winner' : `Resolve (${engineType})`}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          className="btn btn-primary"
                          disabled={busy === 'confirm' || validBids.length === 0 || roomActive}
                          onClick={async () => {
                            const ok = await run('confirm', () => confirmAuction(auction.id, null, minutes || null));
                            if (ok) {
                              focusSettlementWorkflow({
                                tone: 'success',
                                title: 'Step 1 Complete — Winner Confirmed',
                                detail: 'Next: submit & approve winner security (Step 2) below to unlock prize payout.',
                              });
                            }
                          }}
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
                            onClick={async () => {
                              const ok = await run('draw', () => drawAuctionWinner(auction.id));
                              if (ok) {
                                focusSettlementWorkflow({
                                  tone: 'success',
                                  title: 'Step 1 Complete — Winner Drawn at Reserve Floor',
                                  detail: 'Next: submit & approve winner security (Step 2) below to unlock prize payout.',
                                });
                              }
                            }}
                          >
                            {busy === 'draw'
                              ? 'Drawing…'
                              : `Draw at Reserve Floor (${auction.reserveFloorAmount ? formatCurrency(Number(auction.reserveFloorAmount), currencySymbol) : 'R_t'})`}
                          </button>
                        )}
                      </div>
                    )}
                    <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)', margin: '8px 0 0' }}>
                      Confirming never releases money — approve winner security in Settlement &amp; Payout next.
                    </p>
                  </div>
                )}

                {/* Period Bid History Audit Table */}
                <div className="chit-studio-panel">
                  <h3 style={{ margin: '0 0 10px', fontSize: '0.98rem', fontWeight: 800, color: 'var(--text)' }}>
                    🔨 Bid History ({auction.bids.length})
                  </h3>
                  {auction.bids.length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '.86rem' }}>
                      {isDrawType ? 'Draw-based chit — no competitive bids recorded.' : 'No bids recorded yet.'}
                    </p>
                  ) : hideBidAmounts ? (
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '.86rem' }}>
                      {auction.bids.length} sealed bid(s) received — amounts stay hidden until close.
                    </p>
                  ) : (
                    <div className="table-wrapper" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                      <table>
                        <thead>
                          <tr><th>Ticket</th><th>Member</th><th>{d.prize}</th><th>Disc.</th><th>{d.status}</th>{!locked && <th></th>}</tr>
                        </thead>
                        <tbody>
                          {auction.bids.map((b: any) => (
                            <tr key={b.id} style={b.status === 'winning' ? { background: 'var(--success-bg, #f0fdf4)' } : undefined}>
                              <td style={{ fontWeight: 700 }}>#{b.member.ticketNo ?? b.member.memberNumber}</td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{b.member.customer.name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                  {new Date(b.bidTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </td>
                              <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(Number(b.bidAmount), currencySymbol)}</td>
                              <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(Number(b.bidDiscount), currencySymbol)}</td>
                              <td><span className={`badge badge-${b.status === 'winning' ? 'success' : b.status === 'valid' ? 'info' : 'secondary'}`}>{b.status}</span></td>
                              {!locked && (
                                <td>
                                  {b.status === 'valid' && (
                                    <button
                                      className="chit-drawer-pill-btn"
                                      disabled={!!busy}
                                      onClick={async () => {
                                        const ok = await run(`confirm-${b.id}`, () => confirmAuction(auction.id, b.id, minutes || null));
                                        if (ok) {
                                          focusSettlementWorkflow({
                                            tone: 'success',
                                            title: 'Step 1 Complete — Winner Confirmed',
                                            detail: 'Next: submit & approve winner security (Step 2) below to unlock prize payout.',
                                          });
                                        }
                                      }}
                                    >
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

                {auction.minutesText && (
                  <div className="chit-studio-panel">
                    <h3 style={{ margin: '0 0 8px', fontSize: '0.96rem', fontWeight: 700, color: 'var(--text)' }}>📝 Minutes</h3>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.82rem', margin: 0, color: 'var(--text)' }}>{auction.minutesText}</pre>
                  </div>
                )}
              </>
            )}

            {rightTab === 'attendance' && (
              <div className="chit-studio-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text)' }}>
                    👥 Enrolled Members &amp; Attendance ({group.members.length})
                  </h3>
                  {tableCash?.enabled && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowTableCashModal(true)}
                    >
                      💵 Table Cash Sheet ({tableCash.settledTickets}/{tableCash.totalTickets})
                    </button>
                  )}
                </div>
                <div className="table-wrapper" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Ticket</th>
                        <th>{d.member}</th>
                        <th>Won Status</th>
                        {tableCash?.enabled && <th>Table Cash</th>}
                        <th>{d.status}</th>
                        <th>Via</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.members.map((m: any) => {
                        const status = attendanceOf(m.id);
                        const entry = attendanceEntryOf(m.id);
                        const tcRow = tableCash?.rows.find((r) => r.memberId === m.id);
                        return (
                          <tr key={m.id}>
                            <td style={{ fontWeight: 700 }}>#{m.ticketNo ?? m.memberNumber}</td>
                            <td style={{ fontWeight: 600 }}>{m.customer.name}</td>
                            <td>
                              {m.hasWon ? (
                                <span className="badge badge-success">🏆 Won Chit</span>
                              ) : (
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Seat</span>
                              )}
                            </td>
                            {tableCash?.enabled && (
                              <td>
                                {tcRow ? (
                                  tcRow.remainingAmount <= 0 ? (
                                    <span className="badge badge-success">
                                      ✓ Paid {formatCurrency(tcRow.paidAmount, currencySymbol)}
                                    </span>
                                  ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span className="badge badge-warning">
                                        Due {formatCurrency(tcRow.remainingAmount, currencySymbol)}
                                      </span>
                                      <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        disabled={!!busy}
                                        onClick={() =>
                                          void run(`tc-${m.id}`, () =>
                                            collectAuctionTableCashAction(auction.id, m.id, tableCashPayMode),
                                          )
                                        }
                                      >
                                        Collect
                                      </button>
                                    </div>
                                  )
                                ) : '—'}
                              </td>
                            )}
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
            )}

            {rightTab === 'settlement' && (
              <>
                {tableCash?.enabled &&
                  ((tableCash.winnerRow && tableCash.winnerRow.remainingAmount > 0) || tableCash.pendingTickets > 0) && (
                    <div
                      className="chit-studio-panel"
                      style={{ borderColor: '#f59e0b', background: '#fffbeb' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#92400e' }}>
                            💵 Post-Auction Table Cash Settlement — Period {auction.periodNumber}
                          </h3>
                          <div style={{ fontSize: '0.78rem', color: '#78350f', marginTop: '2px' }}>
                            {tableCash.winnerRow && tableCash.winnerRow.remainingAmount > 0
                              ? `Winner #${tableCash.winnerRow.ticketNo} ${tableCash.winnerRow.memberName} still has ${formatCurrency(tableCash.winnerRow.remainingAmount, currencySymbol)} pending for this cycle — collect directly below or let Prize Payout auto-deduct it FIFO.`
                              : `${tableCash.pendingTickets} member ticket(s) were deferred with Start Live Anyway and can settle below.`}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setShowTableCashModal(true)}
                        >
                          Open Full Table Cash Sheet ({tableCash.settledTickets}/{tableCash.totalTickets})
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {tableCash.rows
                          .filter((r) => r.remainingAmount > 0)
                          .slice(0, 6)
                          .map((r) => (
                            <div
                              key={r.memberId}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 10px',
                                borderRadius: '10px',
                                background: 'var(--surface)',
                                border: r.isCurrentWinner ? '1.5px solid #d97706' : '1px solid var(--border)',
                                fontSize: '0.79rem',
                              }}
                            >
                              <span style={{ fontWeight: 800 }}>
                                #{r.ticketNo} {r.memberName}
                                {r.isCurrentWinner ? ' (Winner)' : ''}
                              </span>
                              <span style={{ fontWeight: 700, color: '#b45309' }}>
                                {formatCurrency(r.remainingAmount, currencySymbol)}
                              </span>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={!!busy}
                                onClick={async () => {
                                  const ok = await run(`tc-post-${r.memberId}`, () =>
                                    collectAuctionTableCashAction(auction.id, r.memberId, tableCashPayMode),
                                  );
                                  if (ok) refreshPayoutSummary();
                                }}
                              >
                                Collect
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                {auction.winnerMemberId ? (
                  <div id="post-auction-workflow" style={{ borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--surface)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Inline Workflow Confirmation / Warning Banner (always visible right in context) */}
                    {error && (
                      <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.84rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                        <span>⚠ {error}</span>
                        <button type="button" className="chit-drawer-pill-btn" onClick={() => setError('')}>Dismiss</button>
                      </div>
                    )}
                    {workflowBanner && (
                      <div
                        style={{
                          padding: '12px 14px',
                          borderRadius: '11px',
                          background: workflowBanner.tone === 'success' ? '#f0fdf4' : workflowBanner.tone === 'warning' ? '#fffbeb' : '#eff6ff',
                          border: `1px solid ${workflowBanner.tone === 'success' ? '#86efac' : workflowBanner.tone === 'warning' ? '#fde68a' : '#bfdbfe'}`,
                          color: workflowBanner.tone === 'success' ? '#166534' : workflowBanner.tone === 'warning' ? '#92400e' : '#1e40af',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '10px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800 }}>{workflowBanner.title}</div>
                          <div style={{ fontSize: '0.79rem', marginTop: '2px' }}>{workflowBanner.detail}</div>
                        </div>
                        <button type="button" className="chit-drawer-pill-btn" onClick={() => setWorkflowBanner(null)}>OK</button>
                      </div>
                    )}

                    {/* Header + Quick PDF / Copy / Print */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.04rem', fontWeight: 800, color: 'var(--text)' }}>
                          🏆 Period {auction.periodNumber} Settlement Workflow
                        </h3>
                        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Winner: <strong style={{ color: 'var(--text)' }}>#{auction.winnerMember?.ticketNo ?? auction.winnerMember?.memberNumber} {auction.winnerMember?.customer?.name}</strong> · Prize <strong style={{ color: 'var(--success)' }}>{formatCurrency(Number(auction.prizeAmount), currencySymbol)}</strong>
                        </div>
                      </div>
                      {winnerSummary && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPdfPreviewOpen(true)}>👁 Preview PDF</button>
                          <a href={periodReportUrl} download className="btn btn-primary btn-sm">📄 Download PDF</a>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={copyWinnerSummary}>Copy</button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>Print</button>
                        </div>
                      )}
                    </div>

                    {/* Visual 3-Step Progress Tracker */}
                    {(() => {
                      const step2Done = security?.status === 'approved' || auction.payoutStatus === 'paid';
                      const step3Done = auction.payoutStatus === 'paid';
                      const workflowSteps = [
                        { num: 1, title: 'Winner Confirmed', sub: `#${auction.winnerMember?.ticketNo ?? auction.winnerMember?.memberNumber} · ${formatCurrency(Number(auction.prizeAmount), currencySymbol)}`, done: true, active: false },
                        { num: 2, title: 'Security & Documents', sub: step2Done ? '✓ Approved' : security?.status === 'rejected' ? 'Rejected — Update & Re-approve' : `${securityDocuments.length} doc(s) · Needs Approval`, done: step2Done, active: !step2Done },
                        { num: 3, title: 'Release Prize Payout', sub: step3Done ? '✓ Disbursed' : step2Done ? 'Unlocked — Ready to Pay' : 'Locked until Security Approved', done: step3Done, active: step2Done && !step3Done },
                      ];
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '8px' }}>
                          {workflowSteps.map((st) => (
                            <div
                              key={st.num}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '11px',
                                background: st.done ? '#f0fdf4' : st.active ? 'var(--primary-light)' : 'var(--bg)',
                                border: st.done ? '1.5px solid #86efac' : st.active ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                              }}
                            >
                              <span
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '999px',
                                  background: st.done ? '#16a34a' : st.active ? 'var(--primary)' : '#cbd5e1',
                                  color: '#ffffff',
                                  fontSize: '0.82rem',
                                  fontWeight: 800,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {st.done ? '✓' : st.num}
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: st.done ? '#166534' : st.active ? 'var(--primary-dark)' : 'var(--text-secondary)' }}>
                                  {st.title}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                  {st.sub}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {securityDocuments.length > 0 && (
                      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: 'var(--surface)' }}>
                        <div style={{ padding: '8px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <span>📎 Uploaded Collateral Documents ({securityDocuments.length})</span>
                          {!canApproveSecurity && (
                            <span style={{ fontSize: '0.73rem', fontWeight: 700, color: '#b45309' }}>
                              Admin verifies files · Superadmin gives final approval
                            </span>
                          )}
                        </div>
                        <table className="data-table" style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th>Document</th>
                              <th>File</th>
                              <th>Status</th>
                              <th>Review Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {securityDocuments.map((doc) => (
                              <tr key={doc.id}>
                                <td>{SECURITY_DOCUMENT_LABELS[doc.documentType] ?? doc.documentType}</td>
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
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {doc.status !== 'approved' && doc.status !== 'verified' && (
                                      <button
                                        type="button"
                                        className={canApproveSecurity ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm'}
                                        disabled={!!busy}
                                        onClick={async () => {
                                          const res: any = await run(`doc-${doc.id}-verify`, () => reviewChitSecurityDocument(auction.id, doc.id, 'verify'));
                                          if (res) {
                                            setWorkflowBanner(
                                              res.securityAutoVerified
                                                ? {
                                                    tone: 'success',
                                                    title: '✓ All Documents Verified — Superadmin Notified!',
                                                    detail: canApproveSecurity
                                                      ? 'Click "Approve Security & Unlock Payout" below to unlock Step 3.'
                                                      : 'Your Tenant Superadmin has been notified to give final Step 2 approval.',
                                                  }
                                                : {
                                                    tone: 'info',
                                                    title: '✓ Document Verified',
                                                    detail: canApproveSecurity
                                                      ? 'Click Approve on the document (or Approve Security & Unlock Payout below) to unlock Step 3.'
                                                      : 'Verify any remaining pending documents, or click "Notify Superadmin" below.',
                                                  },
                                            );
                                          }
                                        }}
                                      >
                                        ✓ Verify
                                      </button>
                                    )}
                                    {canApproveSecurity ? (
                                      <>
                                        {doc.status !== 'approved' && (
                                          <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            disabled={!!busy}
                                            onClick={async () => {
                                              const res: any = await run(`doc-${doc.id}-approve`, () => reviewChitSecurityDocument(auction.id, doc.id, 'approve'));
                                              if (res) {
                                                if (res.securityAutoApproved) {
                                                  setWorkflowBanner({
                                                    tone: 'success',
                                                    title: '✓ Step 2 Complete — All Documents Approved & Security Cleared!',
                                                    detail: 'Step 3 (Release Prize Payout) is now unlocked right below.',
                                                  });
                                                  setTimeout(() => {
                                                    document.getElementById('payout-release-step')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                                  }, 140);
                                                } else {
                                                  setWorkflowBanner({
                                                    tone: 'info',
                                                    title: '✓ Document Approved',
                                                    detail: res.remainingPending > 0
                                                      ? `${res.remainingPending} remaining document(s) still pending — approve them or click "Approve Security & Unlock Payout" below.`
                                                      : 'Click "Approve Security & Unlock Payout" below to unlock Step 3.',
                                                  });
                                                }
                                              }
                                            }}
                                          >
                                            Approve
                                          </button>
                                        )}
                                        {doc.status !== 'rejected' && (
                                          <button
                                            type="button"
                                            className="btn btn-danger btn-sm"
                                            disabled={!!busy}
                                            onClick={async () => {
                                              const res = await run(`doc-${doc.id}-reject`, () => reviewChitSecurityDocument(auction.id, doc.id, 'reject'));
                                              if (res) {
                                                setWorkflowBanner({
                                                  tone: 'warning',
                                                  title: 'Document Rejected',
                                                  detail: 'Upload a replacement file below before approving security.',
                                                });
                                              }
                                            }}
                                          >
                                            Reject
                                          </button>
                                        )}
                                      </>
                                    ) : doc.status === 'verified' ? (
                                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#15803d' }}>
                                        Verified — Awaits Superadmin
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {security?.status === 'approved' && auction.payoutStatus !== 'paid' && savedSecuritySpec.documents.length > 0 && (
                      <form
                        style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', background: 'var(--bg)' }}
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          fd.set('action', 'documents');
                          const ok = await run('security-documents', async () => {
                            await compressFormDataImages(fd);
                            return submitChitSecurity(auction.id, fd);
                          });
                          if (ok) {
                            setWorkflowBanner({
                              tone: 'success',
                              title: 'Additional Documents Saved',
                              detail: 'Attached files are saved on the security record.',
                            });
                          }
                        }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                          {savedSecuritySpec.documents.map((docSpec) => (
                            <div key={docSpec.key} className="form-group">
                              <label className="form-label">{docSpec.label}</label>
                              <input name={docSpec.key} type="file" accept={docSpec.accept} className="form-control" />
                            </div>
                          ))}
                        </div>
                        <button type="submit" className="btn btn-secondary btn-sm" disabled={!!busy}>Upload extra documents</button>
                      </form>
                    )}

                    {auction.payoutStatus !== 'paid' && (
                      <>
                        {security?.status !== 'approved' && (
                          <form
                            style={{ border: '1.5px solid var(--primary-border)', borderRadius: '12px', padding: '14px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: '12px' }}
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
                              const fallbackAction = canApproveSecurity ? 'approve' : 'verify';
                              const actionName = submitter?.value || fallbackAction;
                              const fd = new FormData(e.currentTarget, submitter);
                              if (!fd.get('action')) fd.set('action', actionName);
                              const ok = await run('security', async () => {
                                await compressFormDataImages(fd);
                                return submitChitSecurity(auction.id, fd);
                              });
                              if (ok) {
                                if (actionName === 'approve') {
                                  setWorkflowBanner({
                                    tone: 'success',
                                    title: '✓ Step 2 Complete — Security Approved!',
                                    detail: 'Step 3 (Release Prize Payout) is now unlocked right below.',
                                  });
                                } else if (actionName === 'verify') {
                                  setWorkflowBanner({
                                    tone: canApproveSecurity ? 'info' : 'success',
                                    title: canApproveSecurity
                                      ? 'Security Verified'
                                      : '✓ Security Verified & Sent to Superadmin!',
                                    detail: canApproveSecurity
                                      ? 'Now click "Approve Security & Unlock Payout" to unlock Step 3.'
                                      : 'Waiting for Superadmin / Owner final approval (CHIT-29) to unlock prize payout.',
                                  });
                                } else {
                                  setWorkflowBanner({
                                    tone: 'info',
                                    title: 'Security Details & Documents Saved',
                                    detail: canApproveSecurity
                                      ? 'Next: click "Approve Security & Unlock Payout" when ready to release prize money.'
                                      : 'Next: click "Verify & Notify Superadmin" so the Owner can approve Step 2.',
                                  });
                                }
                              }
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                              <strong style={{ fontSize: '0.94rem', color: 'var(--primary-dark)' }}>
                                🛡️ Step 2: Winner Security &amp; Guarantor Clearance
                              </strong>
                              <span className={`badge badge-${security?.status === 'rejected' ? 'danger' : security?.status === 'verified' ? 'info' : 'warning'}`}>
                                Current: {security?.status ?? 'pending'}
                              </span>
                            </div>

                            {!canApproveSecurity && (
                              <div
                                style={{
                                  padding: '11px 13px',
                                  borderRadius: '10px',
                                  background: security?.status === 'verified' ? '#eff6ff' : '#fffbeb',
                                  border: `1px solid ${security?.status === 'verified' ? '#93c5fd' : '#fcd34d'}`,
                                  color: security?.status === 'verified' ? '#1e40af' : '#92400e',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: '10px',
                                }}
                              >
                                <div style={{ flex: '1 1 280px' }}>
                                  <div style={{ fontSize: '0.84rem', fontWeight: 800 }}>
                                    {security?.status === 'verified'
                                      ? '⏳ Security Verified — Waiting for Superadmin Final Approval'
                                      : 'ℹ️ Role Rule (CHIT-29): Admin Verifies · Superadmin Approves'}
                                  </div>
                                  <div style={{ fontSize: '0.76rem', marginTop: '2px' }}>
                                    Your account (<strong>{viewerRole}</strong>) can upload and verify collateral &amp; documents. Final Step 2 approval and Prize Payout must be done by a <strong>Superadmin (Owner)</strong> account (or a Head Foreman granted Security Approval permission).
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  disabled={busy === 'notify-superadmin'}
                                  onClick={async () => {
                                    const res: any = await run('notify-superadmin', () => requestChitSecurityApprovalAction(auction.id));
                                    if (res) {
                                      setWorkflowBanner({
                                        tone: 'success',
                                        title: '🔔 Approval Alert Sent to Superadmin!',
                                        detail: res.notifiedCount > 0
                                          ? `Notified ${res.notifiedCount} Superadmin account(s). Switch to or ask your Superadmin to approve Step 2 & release payout.`
                                          : 'Request logged — ask your Superadmin / Owner to sign in and approve Step 2.',
                                      });
                                    }
                                  }}
                                >
                                  {busy === 'notify-superadmin' ? 'Notifying…' : '🔔 Notify Superadmin to Approve'}
                                </button>
                              </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              <div className="form-group" style={{ gridColumn: !activeSecuritySpec.showGuarantorMember && !activeSecuritySpec.showValue ? '1 / -1' : undefined }}>
                                <label className="form-label">Security type</label>
                                <select
                                  name="securityType"
                                  className="form-control"
                                  value={securityTypeInput}
                                  onChange={(e) => setSecurityTypeInput(e.target.value)}
                                >
                                  {CANONICAL_SECURITY_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                                <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                  {activeSecuritySpec.hint}
                                </div>
                              </div>
                              {activeSecuritySpec.showGuarantorMember && (
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
                              )}
                              {activeSecuritySpec.showValue && (
                                <div className="form-group">
                                  <label className="form-label">{activeSecuritySpec.valueLabel} ({currencySymbol})</label>
                                  <input name="securityValue" type="number" className="form-control" defaultValue={security?.securityValue ? Number(security.securityValue) : ''} />
                                </div>
                              )}
                              {activeSecuritySpec.showPartyName && (
                                <div className="form-group">
                                  <label className="form-label">{activeSecuritySpec.partyNameLabel}</label>
                                  <input name="guarantorName" type="text" className="form-control" defaultValue={security?.guarantorName ?? ''} />
                                </div>
                              )}
                              {activeSecuritySpec.showPartyPhone && (
                                <div className="form-group">
                                  <label className="form-label">{activeSecuritySpec.partyPhoneLabel}</label>
                                  <input name="guarantorPhone" type="tel" className="form-control" defaultValue={security?.guarantorPhone ?? ''} />
                                </div>
                              )}
                              {activeSecuritySpec.showDetails && (
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                  <label className="form-label">{activeSecuritySpec.detailsLabel}</label>
                                  <input
                                    name="details"
                                    type="text"
                                    className="form-control"
                                    defaultValue={security?.details ?? ''}
                                    placeholder={activeSecuritySpec.detailsPlaceholder}
                                  />
                                </div>
                              )}
                              {activeSecuritySpec.documents.map((docSpec) => (
                                <div key={docSpec.key} className="form-group">
                                  <label className="form-label">{docSpec.label}</label>
                                  <input name={docSpec.key} type="file" accept={docSpec.accept} className="form-control" />
                                </div>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                              {canApproveSecurity ? (
                                <>
                                  <button
                                    type="submit"
                                    name="action"
                                    value="approve"
                                    className="btn btn-primary"
                                    disabled={!!busy}
                                    style={{ fontWeight: 800 }}
                                  >
                                    {busy === 'security' ? 'Saving & Approving…' : '✓ Approve Security & Unlock Payout →'}
                                  </button>
                                  <button type="submit" name="action" value="submit" className="btn btn-secondary btn-sm" disabled={!!busy}>
                                    Save Draft Only
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    disabled={!!busy || !security}
                                    onClick={async () => {
                                      const reason = prompt('Rejection reason?');
                                      if (!reason) return;
                                      const fd = new FormData();
                                      fd.set('action', 'reject');
                                      fd.set('rejectionReason', reason);
                                      const ok = await run('security', () => submitChitSecurity(auction.id, fd));
                                      if (ok) {
                                        setWorkflowBanner({
                                          tone: 'warning',
                                          title: 'Security Rejected',
                                          detail: `Reason: ${reason}. Update collateral details above and re-approve when ready.`,
                                        });
                                      }
                                    }}
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="submit"
                                    name="action"
                                    value="verify"
                                    className="btn btn-primary"
                                    disabled={!!busy}
                                    style={{ fontWeight: 800 }}
                                  >
                                    {busy === 'security'
                                      ? 'Verifying & Sending…'
                                      : '✓ Verify & Request Superadmin Approval →'}
                                  </button>
                                  <button type="submit" name="action" value="submit" className="btn btn-secondary btn-sm" disabled={!!busy}>
                                    Save Draft Only
                                  </button>
                                </>
                              )}
                            </div>
                          </form>
                        )}

                        {security?.status === 'approved' && (auction.payoutStatus === 'ready' || auction.payoutStatus === 'partially_paid') && (
                          <div
                            id="payout-release-step"
                            data-testid="payout-release-panel"
                            style={{
                              borderRadius: '12px',
                              border: '1.5px solid var(--primary)',
                              background: 'var(--bg)',
                              padding: '14px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px',
                            }}
                          >
                            {(() => {
                              const gross = Number(payoutSummary?.grossPrizeAmount ?? auction.grossPrizeAmount ?? auction.prizeAmount ?? 0);
                              const arrearsDed = Number(payoutSummary?.arrearsDeductedAmount ?? 0);
                              const penDed = Number(payoutSummary?.penaltyDeductedAmount ?? 0);
                              const netPayable = Number(payoutSummary?.netPayableAmount ?? Math.max(0, gross - arrearsDed - penDed));
                              const alreadyPaid = Number(payoutSummary?.totalDisbursedAmount ?? 0);
                              const remainingBal = Number(payoutSummary?.remainingPayableAmount ?? Math.max(0, netPayable - alreadyPaid));
                              const requestedAmt = disburseNowInput !== '' ? Number(disburseNowInput) : remainingBal;
                              const effectiveDisburseAmt = Number.isFinite(requestedAmt) && requestedAmt > 0 ? requestedAmt : 0;
                              const needDenomMatch = payMode === 'cash' && payoutDenomMode === 'REQUIRED';
                              const canRelease =
                                canReleasePayout &&
                                busy !== 'payout' &&
                                effectiveDisburseAmt > 0 &&
                                effectiveDisburseAmt <= remainingBal + 0.01 &&
                                (!needDenomMatch || payoutDenomMatched);

                              return (
                                <>
                                  <div
                                    style={{
                                      borderRadius: '12px',
                                      border: '1px solid var(--border)',
                                      background: 'var(--surface)',
                                      padding: '14px',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                                      <strong style={{ fontSize: '0.94rem', color: 'var(--primary-dark)' }}>
                                        💸 Step 3: Release Winner Prize Payout &amp; Arrears Netting
                                      </strong>
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        {payoutSummary?.nettingLocked && (
                                          <span className="badge badge-info">Arrears Netting Locked (Tranche Started)</span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => setPdfPreviewOpen(true)}
                                          className="btn btn-secondary btn-sm"
                                        >
                                          👁 Preview PDF
                                        </button>
                                        <a
                                          href={periodReportUrl}
                                          download
                                          className="btn btn-secondary btn-sm"
                                        >
                                          📄 Download Settlement PDF
                                        </a>
                                      </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                                      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Gross Prize</div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{formatCurrency(gross, currencySymbol)}</div>
                                      </div>
                                      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>(-) Unpaid Arrears</div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: arrearsDed > 0 ? '#b45309' : 'var(--text)' }}>
                                          {formatCurrency(arrearsDed, currencySymbol)}
                                        </div>
                                      </div>
                                      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>(-) Pending Penalties</div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: penDed > 0 ? '#b45309' : 'var(--text)' }}>
                                          {formatCurrency(penDed, currencySymbol)}
                                        </div>
                                      </div>
                                      <div style={{ background: 'var(--bg)', border: '1px solid var(--primary)', borderRadius: '8px', padding: '8px 10px' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--primary-dark, var(--primary))', fontWeight: 600 }}>= Net Payable</div>
                                        <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--primary-dark, var(--primary))' }}>
                                          {formatCurrency(netPayable, currencySymbol)}
                                        </div>
                                      </div>
                                      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Already Paid</div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#047857' }}>{formatCurrency(alreadyPaid, currencySymbol)}</div>
                                      </div>
                                      <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: '8px', padding: '8px 10px' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#854d0e', fontWeight: 600 }}>Remaining Balance</div>
                                        <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#854d0e' }}>{formatCurrency(remainingBal, currencySymbol)}</div>
                                      </div>
                                    </div>

                                    {!payoutSummary?.nettingLocked && (
                                      <div style={{ marginTop: '10px', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                                          <input
                                            type="checkbox"
                                            checked={deductArrears}
                                            onChange={(e) => setDeductArrears(e.target.checked)}
                                          />
                                          Auto-deduct unpaid arrears (FIFO)
                                        </label>
                                        {deductArrears && (
                                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                                            <input
                                              type="checkbox"
                                              checked={useCustomArrears}
                                              onChange={(e) => setUseCustomArrears(e.target.checked)}
                                            />
                                            Partial custom arrears deduction
                                          </label>
                                        )}
                                        {deductArrears && useCustomArrears && (
                                          <input
                                            type="number"
                                            min={0}
                                            max={Number(payoutSummary?.maxDeductible ?? gross)}
                                            step="0.01"
                                            placeholder="Custom offset ₹"
                                            className="form-control"
                                            style={{ width: '130px', padding: '4px 8px', fontSize: '0.8rem' }}
                                            value={customArrearsAmount}
                                            onChange={(e) => setCustomArrearsAmount(e.target.value)}
                                          />
                                        )}
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                                          <input
                                            type="checkbox"
                                            checked={waivePenalties}
                                            onChange={(e) => setWaivePenalties(e.target.checked)}
                                          />
                                          Waive pending penalties
                                        </label>
                                      </div>
                                    )}

                                    {(payoutSummary?.overdueCycles?.length ?? 0) > 0 && (
                                      <div style={{ marginTop: '8px' }}>
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-sm"
                                          onClick={() => setShowArrearsDetail((v) => !v)}
                                          style={{ padding: '2px 6px', fontSize: '0.76rem' }}
                                        >
                                          {showArrearsDetail ? '▾ Hide' : '▸ View'} {payoutSummary.overdueCycles.length} overdue cycle(s) included in FIFO
                                        </button>
                                        {showArrearsDetail && (
                                          <div style={{ marginTop: '6px', overflowX: 'auto' }}>
                                            <table className="data-table" style={{ margin: 0, fontSize: '0.78rem' }}>
                                              <thead>
                                                <tr>
                                                  <th>Cycle</th>
                                                  <th>Due Date</th>
                                                  <th>Due</th>
                                                  <th>Paid</th>
                                                  <th>Unpaid Sub</th>
                                                  <th>Pending Penalty</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {payoutSummary.overdueCycles.map((cyc: any) => (
                                                  <tr key={cyc.subscriptionId}>
                                                    <td>#{cyc.periodNumber}</td>
                                                    <td>{formatDate(cyc.dueDate)}</td>
                                                    <td>{formatCurrency(cyc.dueAmount, currencySymbol)}</td>
                                                    <td>{formatCurrency(cyc.paidAmount, currencySymbol)}</td>
                                                    <td style={{ color: '#b45309', fontWeight: 600 }}>{formatCurrency(cyc.unpaidSubscriptionAmount, currencySymbol)}</td>
                                                    <td style={{ color: '#b91c1c' }}>{formatCurrency(cyc.pendingPenaltyAmount, currencySymbol)}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {!canReleasePayout && (
                                    <div style={{ padding: '10px 13px', borderRadius: '10px', background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', fontSize: '0.82rem', fontWeight: 700 }}>
                                      🔒 Prize payout disbursement is restricted to Superadmin / Owner or staff with Payout Release permission (CHIT-29). Sign in as Superadmin to disburse.
                                    </div>
                                  )}

                                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                    <div className="form-group">
                                      <label className="form-label">Disburse Amount Now ({currencySymbol})</label>
                                      <input
                                        type="number"
                                        min={1}
                                        max={remainingBal}
                                        step="0.01"
                                        className="form-control"
                                        value={disburseNowInput}
                                        onChange={(e) => {
                                          setDisburseNowInput(e.target.value);
                                          payoutIdempotencyRef.current = '';
                                        }}
                                        style={{ width: '160px', fontWeight: 700 }}
                                      />
                                    </div>
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
                                      <input type="text" className="form-control" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="UTR / Cheque / Voucher" />
                                    </div>
                                    <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                                      <label className="form-label">Tranche notes</label>
                                      <input type="text" className="form-control" value={payoutNotes} onChange={(e) => setPayoutNotes(e.target.value)} placeholder="e.g. Tranche 1" />
                                    </div>
                                    {canReleasePayout && (
                                      <button
                                        type="button"
                                        className="btn btn-primary"
                                        style={{ fontWeight: 800 }}
                                        disabled={!canRelease}
                                        onClick={async () => {
                                          if (!payoutIdempotencyRef.current) {
                                            payoutIdempotencyRef.current =
                                              typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                                                ? crypto.randomUUID()
                                                : `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                                          }
                                          const fd = new FormData();
                                          fd.set('paymentMode', payMode);
                                          fd.set('disburseNowAmount', String(effectiveDisburseAmt));
                                          fd.set('deductArrears', String(deductArrears));
                                          fd.set('waivePenalties', String(waivePenalties));
                                          fd.set('idempotencyKey', payoutIdempotencyRef.current);
                                          if (deductArrears && useCustomArrears && customArrearsAmount !== '') {
                                            fd.set('customArrearsAmount', customArrearsAmount);
                                          }
                                          if (payRef) fd.set('referenceNo', payRef);
                                          if (payoutNotes) fd.set('notes', payoutNotes);
                                          if ((payMode === 'cash' || includeCashNotes) && payoutDenomJson) {
                                            fd.set('cashDenominationsJson', payoutDenomJson);
                                          }
                                          const ok = await run('payout', () => releasePrizePayout(auction.id, fd));
                                          if (ok) {
                                            payoutIdempotencyRef.current = '';
                                            setPayRef('');
                                            setPayoutNotes('');
                                            setPayoutCounts({});
                                            setPayoutDenomJson(null);
                                            refreshPayoutSummary();
                                            setWorkflowBanner({
                                              tone: 'success',
                                              title: '🎉 Prize Payout Released!',
                                              detail: nextAuction
                                                ? `Period ${auction.periodNumber} is settled. You can download the Period PDF or proceed to Period ${nextAuction.periodNumber}.`
                                                : `Period ${auction.periodNumber} is completely settled. Download the Period PDF or return to ${group.name}.`,
                                            });
                                          }
                                        }}
                                      >
                                        {busy === 'payout'
                                          ? 'Releasing…'
                                          : effectiveDisburseAmt < remainingBal - 0.01
                                            ? `Disburse Tranche ${formatCurrency(effectiveDisburseAmt, currencySymbol)}`
                                            : `💸 Release ${formatCurrency(effectiveDisburseAmt, currencySymbol)}`}
                                      </button>
                                    )}
                                  </div>

                                  {needDenomMatch && !payoutDenomMatched && (
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#b45309' }}>
                                      ⚠ Cash note denomination breakdown must equal {formatCurrency(effectiveDisburseAmt, currencySymbol)} before releasing cash payout.
                                    </div>
                                  )}

                                  {payMode !== 'cash' && (
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                      <input
                                        type="checkbox"
                                        checked={includeCashNotes}
                                        onChange={(e) => setIncludeCashNotes(e.target.checked)}
                                      />
                                      Include physical cash denomination breakdown (for split cash + digital payout)
                                    </label>
                                  )}

                                  {(payMode === 'cash' || includeCashNotes) && (
                                    <CashDenominationCounter
                                      expectedAmount={effectiveDisburseAmt}
                                      mode={payoutDenomMode}
                                      value={payoutCounts}
                                      currencySymbol={currencySymbol}
                                      title="Winner Payout Cash Note Counter"
                                      onChange={(nextCounts, meta) => {
                                        setPayoutCounts(nextCounts);
                                        setPayoutDenomJson(meta.json);
                                        setPayoutDenomMatched(meta.isMatch);
                                      }}
                                    />
                                  )}

                                  {(payoutSummary?.disbursements?.length ?? 0) > 0 && (
                                    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', background: 'var(--surface)' }}>
                                      <div style={{ padding: '8px 12px', fontSize: '0.8rem', fontWeight: 700, borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                                        Disbursement Tranches ({payoutSummary.disbursements.length})
                                      </div>
                                      <table className="data-table" style={{ margin: 0, fontSize: '0.8rem' }}>
                                        <thead>
                                          <tr>
                                            <th>#</th>
                                            <th>Date</th>
                                            <th>Mode / Reference</th>
                                            <th>Amount</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {payoutSummary.disbursements.map((t: any) => (
                                            <tr key={t.id}>
                                              <td>Tranche #{t.trancheNumber}</td>
                                              <td>{formatDate(t.paidAt)}</td>
                                              <td>{String(t.paymentMode).toUpperCase()}{t.referenceNumber ? ` · ${t.referenceNumber}` : ''}</td>
                                              <td style={{ fontWeight: 700 }}>{formatCurrency(t.amount, currencySymbol)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </>
                    )}

                    {auction.payoutStatus === 'paid' && (
                      <div style={{ padding: '14px', borderRadius: '12px', background: '#f0fdf4', border: '1.5px solid #86efac', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <div style={{ color: '#166534', fontWeight: 800, fontSize: '0.94rem' }}>
                              ✓ Period {auction.periodNumber} Settled — Prize Payout Complete
                            </div>
                            <div style={{ color: '#15803d', fontSize: '0.8rem', marginTop: '2px' }}>
                              {payoutSummary && (payoutSummary.arrearsDeductedAmount > 0 || payoutSummary.penaltyDeductedAmount > 0)
                                ? `Gross ${formatCurrency(payoutSummary.grossPrizeAmount, currencySymbol)} · Netted ${formatCurrency(payoutSummary.arrearsDeductedAmount + payoutSummary.penaltyDeductedAmount, currencySymbol)} · Disbursed ${formatCurrency(payoutSummary.totalDisbursedAmount, currencySymbol)}`
                                : `Disbursed ${formatCurrency(Number(auction.prizeAmount ?? 0), currencySymbol)}`}
                              {payoutReceipt ? ` · Receipt ${payoutReceipt.receiptNo} (${payoutReceipt.paymentMode.toUpperCase()}${payoutReceipt.referenceNo ? ` · ${payoutReceipt.referenceNo}` : ''})` : ''}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => setPdfPreviewOpen(true)} className="btn btn-secondary btn-sm">
                              👁 Preview PDF
                            </button>
                            <a href={periodReportUrl} download className="btn btn-secondary btn-sm">
                              📄 Download PDF
                            </a>
                            {nextAuction && (
                              <Link
                                href={`/chits/${group.groupCode ?? group.id}/auctions/${nextAuction.id}`}
                                className="btn btn-primary btn-sm"
                                style={{ fontWeight: 800 }}
                              >
                                ▶ Open Next Period (Period {nextAuction.periodNumber}) →
                              </Link>
                            )}
                            <Link
                              href={`/chits/${group.groupCode ?? group.id}`}
                              className="btn btn-secondary btn-sm"
                            >
                              ← Back to {group.name}
                            </Link>
                          </div>
                        </div>

                        {(payoutSummary?.disbursements?.length ?? 0) > 1 && (
                          <div style={{ fontSize: '0.78rem', color: '#166534' }}>
                            {payoutSummary.disbursements.map((t: any) => (
                              <span key={t.id} style={{ marginRight: '10px', display: 'inline-block' }}>
                                • Tranche #{t.trancheNumber}: {formatCurrency(t.amount, currencySymbol)} ({String(t.paymentMode).toUpperCase()})
                              </span>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', paddingTop: '6px', borderTop: '1px solid #bbf7d0' }}>
                          {denomFields.map((item) => (
                            <div key={item.denom} className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontSize: '0.7rem', color: '#166534' }}>{currencySymbol}{item.denom} notes</label>
                              <input
                                type="number"
                                min={0}
                                className="form-control"
                                value={item.val}
                                onChange={(e) => item.set(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                                style={{ width: '74px', padding: '4px 6px', fontSize: '0.82rem' }}
                              />
                            </div>
                          ))}
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534', alignSelf: 'center' }}>
                            = {formatCurrency(currentDenomTotal, currencySymbol)}
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busy === 'save-denoms'}
                            onClick={async () => {
                              const ok = await run('save-denoms', () => updatePayoutDenominationsAction(auction.id, JSON.stringify(currentDenomMap)));
                              if (ok) {
                                setWorkflowBanner({
                                  tone: 'success',
                                  title: 'Cash Denominations Saved',
                                  detail: `Updated receipt note count (${formatCurrency(currentDenomTotal, currencySymbol)}).`,
                                });
                              }
                            }}
                          >
                            {busy === 'save-denoms' ? 'Saving…' : 'Save Cash Note Counts'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Collapsible Dividend & Member Distribution Breakdown (keeps active workflow step concise above) */}
                    {winnerSummary ? (
                      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                        <button
                          type="button"
                          onClick={() => setShowDividendTable((v) => !v)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'var(--bg)',
                            border: 'none',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            color: 'var(--text)',
                            fontSize: '0.84rem',
                            fontWeight: 800,
                          }}
                        >
                          <span>
                            📊 Dividend &amp; Per-Member Breakdown (Dividend {formatCurrency(winnerSummary.dividend, currencySymbol)}/ticket)
                          </span>
                          <span>{showDividendTable ? '▾ Hide Details' : '▸ Expand Details'}</span>
                        </button>
                        {showDividendTable && (
                          <div style={{ padding: '12px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
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
                        )}
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: '.82rem', color: 'var(--text-secondary)' }}>
                        Commission {formatCurrency(Number(auction.commission ?? 0), currencySymbol)}
                        {Number(auction.gstAmount) > 0 && ` · GST ${formatCurrency(Number(auction.gstAmount), currencySymbol)}`}
                        {' · '}Dividend/ticket {formatCurrency(Number(auction.dividend ?? 0), currencySymbol)}
                        {Number(auction.roundingIncome) > 0 && ` · rounding income ${formatCurrency(Number(auction.roundingIncome), currencySymbol)}`}
                      </p>
                    )}
                  </div>
                ) : (
                  <div id="post-auction-workflow" className="chit-studio-panel" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                    Winner &amp; payout settlement details will appear here once a winning bid is confirmed or drawn.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {showTableCashModal && tableCash && typeof document !== 'undefined' && createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.58)',
              zIndex: 130,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
            onClick={() => setShowTableCashModal(false)}
          >
            <div
              className="card"
              style={{
                width: '760px',
                maxWidth: '100%',
                maxHeight: '88vh',
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                overflow: 'hidden',
                borderRadius: '18px',
                border: '1.5px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  padding: '15px 20px',
                  background: 'linear-gradient(120deg, var(--primary-dark), var(--primary))',
                  color: '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: '#ffffff' }}>
                    💵 Table Cash Settlement — Period {auction.periodNumber}
                  </h3>
                  <div style={{ fontSize: '0.79rem', opacity: 0.92, marginTop: '2px' }}>
                    {group.name} · {tableCash.settledTickets} of {tableCash.totalTickets} tickets settled
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTableCashModal(false)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.35)',
                    background: 'rgba(255,255,255,0.16)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 800,
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '11px',
                    background: 'var(--primary-light)',
                    border: '1px solid var(--primary-border)',
                    color: 'var(--primary-dark)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                  }}
                >
                  Everyone settles Period {auction.periodNumber} table cash before live bidding starts. The cycle winner can also settle or adjust after the auction; if some members cannot pay right now, use <strong>Start Live Anyway</strong> below.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                  <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Collected</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--success)' }}>
                      {formatCurrency(tableCash.totalCollectedAmount, currencySymbol)}
                    </div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Pending</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: tableCash.totalPendingAmount > 0 ? '#b45309' : 'var(--success)' }}>
                      {formatCurrency(tableCash.totalPendingAmount, currencySymbol)}
                    </div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Tickets Ready</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)' }}>
                      {tableCash.settledTickets} / {tableCash.totalTickets}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Payment Mode:</span>
                    {(['cash', 'upi', 'bank'] as const).map((pm) => (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => setTableCashPayMode(pm)}
                        className={`chit-drawer-pill-btn${tableCashPayMode === pm ? ' chit-drawer-pill-btn--active' : ''}`}
                      >
                        {pm.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  {tableCash.pendingTickets > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy === 'tc-all'}
                      onClick={() => void run('tc-all', () => collectAllAuctionTableCashAction(auction.id, tableCashPayMode))}
                    >
                      {busy === 'tc-all'
                        ? 'Collecting All…'
                        : `✓ Collect All Remaining (${tableCash.pendingTickets})`}
                    </button>
                  )}
                </div>

                <div className="table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Ticket</th>
                        <th>Member</th>
                        <th>Due</th>
                        <th>Paid</th>
                        <th>Status / Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableCash.rows.map((r) => (
                        <tr key={r.memberId}>
                          <td style={{ fontWeight: 800 }}>#{r.ticketNo}</td>
                          <td>
                            <div style={{ fontWeight: 700 }}>{r.memberName}</div>
                            {r.customerPhone && (
                              <div style={{ fontSize: '0.71rem', color: 'var(--text-secondary)' }}>{r.customerPhone}</div>
                            )}
                          </td>
                          <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(r.dueAmount, currencySymbol)}</td>
                          <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                            {formatCurrency(r.paidAmount, currencySymbol)}
                          </td>
                          <td>
                            {r.remainingAmount <= 0 ? (
                              <span className="badge badge-success">
                                ✓ Settled{r.receiptNo ? ` · ${r.receiptNo}` : ''}
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={!!busy}
                                onClick={() =>
                                  void run(`tc-m-${r.memberId}`, () =>
                                    collectAuctionTableCashAction(auction.id, r.memberId, tableCashPayMode),
                                  )
                                }
                              >
                                {busy === `tc-m-${r.memberId}`
                                  ? 'Collecting…'
                                  : `💵 Collect ${formatCurrency(r.remainingAmount, currencySymbol)}`}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div
                style={{
                  padding: '13px 20px',
                  borderTop: '1px solid var(--border)',
                  background: 'var(--bg)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowTableCashModal(false)}>
                  Close
                </button>
                {isLive && !roomActive && !locked && !isClosedByBell && (live?.roomStatus ?? auction.roomStatus) !== 'closed' && (
                  tableCash.allSettled ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy === 'open-room'}
                      onClick={async () => {
                        const ok = await run('open-room', () => openLiveRoom(auction.id, roomMinutes, antiSnipe));
                        if (ok) setShowTableCashModal(false);
                      }}
                    >
                      {busy === 'open-room' ? 'Starting…' : '▶ All Settled — Start Live Auction Now'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', borderColor: '#f59e0b' }}
                      disabled={busy === 'open-room'}
                      onClick={async () => {
                        const ok = await run('open-room', () =>
                          openLiveRoom(auction.id, roomMinutes, antiSnipe, { allowUnsettledTableCash: true }),
                        );
                        if (ok) setShowTableCashModal(false);
                      }}
                    >
                      {busy === 'open-room'
                        ? 'Starting…'
                        : `▶ Start Live Anyway (${tableCash.pendingTickets} Pending — Settle After Auction)`}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

        {seatModal && typeof document !== 'undefined' && createPortal((() => {
          const seatBids = live?.memberBids?.[seatModal.id] ??
            auction.bids.filter((b: any) => b.memberId === seatModal.id && b.status !== 'retracted');
          const sameCustomerTickets = (group.members ?? []).filter(
            (m: any) => m.customerId === seatModal.customerId,
          );
          const leadingTicketObj = leadingBidForTable
            ? (group.members ?? []).find(
              (m: any) => (m.ticketNo ?? m.memberNumber) == leadingBidForTable.ticketNo,
            )
            : null;
          const isConsecutiveBlockedForSeat =
            !allowConsecutiveSelfBid &&
            Boolean(leadingTicketObj && leadingTicketObj.customerId === seatModal.customerId);
          const effectivePopupPrize = Math.max(
            activeBidBounds.minPrize,
            Math.min(activeBidBounds.nextValidPrize, Number.isFinite(popupBidPrize) ? popupBidPrize : activeBidBounds.nextValidPrize),
          );
          const popupDiscount = Math.max(0, Number(group.chitValue) - effectivePopupPrize);
          const seatTicketNo = seatModal.ticketNo ?? seatModal.memberNumber;
          const liveSeatMatch = live?.seats?.find((s: any) => s.memberId === seatModal.id) ?? seatModal.liveSeat ?? null;
          const resolvedSeatPhoto =
            liveSeatMatch?.profilePhoto ||
            seatModal.customer?.profilePhoto ||
            null;
          const showSeatPhoto = Boolean(resolvedSeatPhoto && seatPhotoFailedId !== seatModal.id);
          const seatInitial = String(seatModal.customer?.name ?? 'M').trim().charAt(0).toUpperCase() || 'M';
          const isSeatLeading = Boolean(
            !hideBidAmounts &&
            leadingBidForTable &&
            (allowConsecutiveSelfBid
              ? leadingBidForTable.ticketNo == seatTicketNo
              : leadingTicketObj?.customerId === seatModal.customerId),
          );
          const seatAtt = attendanceOf(seatModal.id);
          const isSeatOnline =
            seatAtt === 'present' ||
            seatAtt === 'proxy' ||
            Boolean(liveSeatMatch && !liveSeatMatch.passed && liveSeatMatch.latestPrize !== null);
          const quickSeatPresets = (activeBidBounds.templatePrizes ?? []).slice(0, 5);

          return (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(8, 15, 28, 0.72)',
                backdropFilter: 'blur(4px)',
                zIndex: 130,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
              }}
              onClick={() => setSeatModal(null)}
            >
              <div
                style={{
                  width: '500px',
                  maxWidth: '100%',
                  borderRadius: '20px',
                  overflow: 'hidden',
                  background: '#ffffff',
                  border: '1px solid rgba(148, 163, 184, 0.28)',
                  boxShadow: '0 26px 60px -18px rgba(8, 15, 28, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Studio Dark Header with Customer Photo, Name & Live Seat Identity */}
                <div
                  style={{
                    position: 'relative',
                    padding: '16px 18px',
                    background: isSeatLeading
                      ? 'radial-gradient(110% 130% at 15% 0%, rgba(250, 204, 21, 0.18) 0%, transparent 55%), linear-gradient(135deg, #0f1b2e 0%, #16243a 62%, #0c1728 100%)'
                      : 'radial-gradient(110% 130% at 15% 0%, rgba(16, 185, 129, 0.16) 0%, transparent 55%), linear-gradient(135deg, #0f1b2e 0%, #16243a 62%, #0c1728 100%)',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.22)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div
                        style={{
                          width: '58px',
                          height: '58px',
                          borderRadius: '999px',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isSeatLeading
                            ? 'linear-gradient(145deg, #facc15 0%, #ca8a04 100%)'
                            : isSeatOnline
                              ? 'linear-gradient(145deg, #22c55e 0%, #15803d 100%)'
                              : 'linear-gradient(145deg, #334155 0%, #1e293b 100%)',
                          border: isSeatLeading
                            ? '2.5px solid #fde047'
                            : isSeatOnline
                              ? '2.5px solid #4ade80'
                              : '2px solid rgba(148, 163, 184, 0.45)',
                          boxShadow: isSeatLeading
                            ? '0 0 22px -2px rgba(250, 204, 21, 0.65), 0 8px 18px rgba(0,0,0,0.4)'
                            : isSeatOnline
                              ? '0 0 18px -2px rgba(34, 197, 94, 0.5), 0 8px 18px rgba(0,0,0,0.4)'
                              : '0 8px 18px rgba(0,0,0,0.4)',
                          fontSize: '1.35rem',
                          fontWeight: 900,
                          color: isSeatLeading ? '#422006' : '#ffffff',
                        }}
                      >
                        {showSeatPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolvedSeatPhoto}
                            alt={seatModal.customer?.name ?? 'Member'}
                            onError={() => setSeatPhotoFailedId(seatModal.id)}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        ) : (
                          seatInitial
                        )}
                      </div>
                      {(isSeatLeading || isSeatOnline) && (
                        <span
                          style={{
                            position: 'absolute',
                            right: '-2px',
                            bottom: '-2px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '999px',
                            background: isSeatLeading ? '#facc15' : '#22c55e',
                            border: '2px solid #0f1b2e',
                            color: isSeatLeading ? '#422006' : '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 900,
                          }}
                        >
                          {isSeatLeading ? '★' : '✓'}
                        </span>
                      )}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: 'rgba(255, 255, 255, 0.12)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            color: '#fde047',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Seat #{seatTicketNo}
                        </span>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: seatModal.hasWon
                              ? 'rgba(234, 179, 8, 0.18)'
                              : isSeatOnline
                                ? 'rgba(34, 197, 94, 0.2)'
                                : 'rgba(148, 163, 184, 0.16)',
                            border: seatModal.hasWon
                              ? '1px solid rgba(250, 204, 21, 0.45)'
                              : isSeatOnline
                                ? '1px solid rgba(74, 222, 128, 0.45)'
                                : '1px solid rgba(148, 163, 184, 0.3)',
                            color: seatModal.hasWon ? '#fde047' : isSeatOnline ? '#86efac' : '#cbd5e1',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {seatModal.hasWon
                            ? 'Spectator · Won'
                            : isSeatLeading
                              ? 'Leading Bidder'
                              : isSeatOnline
                                ? '● Live in Room'
                                : 'Eligible Bidder'}
                        </span>
                      </div>
                      <h3
                        style={{
                          margin: '5px 0 2px',
                          fontSize: '1.15rem',
                          fontWeight: 800,
                          color: '#ffffff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {seatModal.customer?.name ?? 'Member'}
                      </h3>
                      <div style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 600 }}>
                        Period {auction.periodNumber} · Next ≤ {formatCurrency(activeBidBounds.nextValidPrize, currencySymbol)}
                        {sameCustomerTickets.length > 1
                          ? ` · ${sameCustomerTickets.length} tickets`
                          : ''}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label="Close member popup"
                    onClick={() => setSeatModal(null)}
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '10px',
                      border: '1px solid rgba(148, 163, 184, 0.32)',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: '#f8fafc',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span>
                  </button>
                </div>

                {/* Light Studio Body Matching Chat Dock Aesthetic */}
                <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#ffffff' }}>
                  {sameCustomerTickets.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b' }}>
                        Tickets:
                      </span>
                      {sameCustomerTickets.map((t: any) => {
                        const activeTicket = t.id === seatModal.id;
                        const tLive = live?.seats?.find((s: any) => s.memberId === t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            disabled={Boolean(t.hasWon)}
                            onClick={() => {
                              setSeatPhotoFailedId(null);
                              setSeatModal({ ...t, liveSeat: tLive });
                              if (!t.hasWon) setBidMemberId(t.id);
                            }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '9px',
                              border: activeTicket ? '1.5px solid var(--primary)' : '1px solid #cbd5e1',
                              background: activeTicket ? 'var(--primary-light)' : '#f8fafc',
                              color: activeTicket ? 'var(--primary-dark)' : '#0f172a',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: t.hasWon ? 'not-allowed' : 'pointer',
                            }}
                          >
                            #{t.ticketNo ?? t.memberNumber}
                            {t.hasWon ? ' ✓' : ''}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Studio Pre-Open Readiness + Large Glossy Start Live CTA (Matches Chat Dock) */}
                  {!seatModal.hasWon && !locked && !isDrawType && (
                    !roomActive ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div
                          style={{
                            padding: '12px 14px',
                            borderRadius: '13px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                          }}
                        >
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '12px',
                              background: needsTableCashBeforeStart ? '#fef3c7' : 'var(--primary-light)',
                              color: needsTableCashBeforeStart ? '#b45309' : 'var(--primary-dark)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <span className="material-icons-outlined" style={{ fontSize: '21px' }}>
                              {needsTableCashBeforeStart ? 'payments' : 'podcasts'}
                            </span>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                              {needsTableCashBeforeStart
                                ? `Table Cash Required (${tableCash!.settledTickets}/${tableCash!.totalTickets} Settled)`
                                : 'Auction Room Is Not Live Yet'}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                              {needsTableCashBeforeStart
                                ? 'Collect pre-auction table cash or choose Start Live Anyway inside the cash modal.'
                                : `Start the live studio (${roomMinutes}m timer) to enable bidding for #${seatTicketNo}.`}
                            </div>
                          </div>
                        </div>

                        {isLive && !isClosedByBell && (live?.roomStatus ?? auction.roomStatus) !== 'closed' && (
                          <button
                            type="button"
                            disabled={busy === 'open-room'}
                            onClick={handlePrimaryStartAction}
                            style={{
                              width: '100%',
                              minHeight: '48px',
                              padding: '0 18px',
                              borderRadius: '13px',
                              border: 'none',
                              background: needsTableCashBeforeStart
                                ? 'linear-gradient(180deg, #f59e0b 0%, #b45309 100%)'
                                : 'linear-gradient(180deg, var(--primary) 0%, var(--primary-dark) 100%)',
                              boxShadow: needsTableCashBeforeStart
                                ? '0 10px 22px -6px rgba(217, 119, 6, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.35)'
                                : '0 10px 22px -6px var(--primary-glow), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
                              color: '#ffffff',
                              fontSize: '1rem',
                              fontWeight: 800,
                              cursor: busy === 'open-room' ? 'wait' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              gap: '8px',
                            }}
                          >
                            <span className="material-icons-outlined" style={{ fontSize: '22px' }}>
                              {needsTableCashBeforeStart ? 'payments' : 'play_arrow'}
                            </span>
                            <span>
                              {busy === 'open-room'
                                ? 'Starting Live Room…'
                                : needsTableCashBeforeStart
                                  ? `Collect Cash (${tableCash!.settledTickets}/${tableCash!.totalTickets}) to Start`
                                  : 'Start Live Now to Bid'}
                            </span>
                            <span className="material-icons-outlined" style={{ fontSize: '20px', position: 'absolute', right: '16px' }}>
                              arrow_forward
                            </span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '13px 14px',
                          borderRadius: '14px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--primary-dark)' }}>gavel</span>
                            Quick Bid ({currencySymbol})
                          </span>
                          <span style={{ fontSize: '0.76rem', color: '#15803d', fontWeight: 800, background: '#dcfce7', padding: '2px 9px', borderRadius: '999px' }}>
                            Discount {formatCurrency(popupDiscount, currencySymbol)}
                          </span>
                        </div>

                        {isConsecutiveBlockedForSeat && (
                          <div
                            style={{
                              padding: '9px 11px',
                              borderRadius: '10px',
                              background: '#fff7ed',
                              border: '1px solid #fdba74',
                              color: '#9a3412',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '8px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <span>This customer is currently leading — wait for another bidder or allow repeat.</span>
                            <button
                              type="button"
                              onClick={() => void handleSetRepeatSelfBid(true)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '8px',
                                border: '1px solid #fb923c',
                                background: '#ffffff',
                                color: '#9a3412',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                              }}
                            >
                              Allow Repeat Bid
                            </button>
                          </div>
                        )}

                        {quickSeatPresets.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '7px' }}>
                            {quickSeatPresets.map((tp) => {
                              const selected = effectivePopupPrize === tp.prizeAmount;
                              return (
                                <button
                                  key={tp.prizeAmount}
                                  type="button"
                                  onClick={() => setPopupBidPrize(tp.prizeAmount)}
                                  style={{
                                    padding: '8px 6px',
                                    borderRadius: '9px',
                                    border: selected ? '1.5px solid var(--primary)' : '1px solid #cbd5e1',
                                    background: selected ? 'var(--primary-light)' : '#ffffff',
                                    color: selected ? 'var(--primary-dark)' : '#0f172a',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    fontVariantNumeric: 'tabular-nums',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {Number(tp.prizeAmount).toLocaleString('en-IN')}
                                </button>
                              );
                            })}
                            {activeBidBounds.effectiveStep > 0 && (
                              <button
                                type="button"
                                onClick={() => setPopupBidPrize(Math.max(activeBidBounds.minPrize, effectivePopupPrize - activeBidBounds.effectiveStep))}
                                style={{
                                  padding: '8px 6px',
                                  borderRadius: '9px',
                                  border: '1px solid var(--primary-border)',
                                  background: 'var(--primary-light)',
                                  color: 'var(--primary-dark)',
                                  fontSize: '0.82rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                }}
                              >
                                −{Number(activeBidBounds.effectiveStep).toLocaleString('en-IN')}
                              </button>
                            )}
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--primary)', borderRadius: '10px', background: '#ffffff', padding: '0 12px', height: '44px' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary-dark)', marginRight: '6px' }}>{currencySymbol}</span>
                          <input
                            type="number"
                            min={activeBidBounds.minPrize}
                            max={activeBidBounds.nextValidPrize}
                            step={activeBidBounds.effectiveStep > 0 ? activeBidBounds.effectiveStep : 1}
                            value={effectivePopupPrize}
                            onChange={(e) => setPopupBidPrize(Number(e.target.value))}
                            style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '1.18rem', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}
                          />
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>
                            Max {Number(activeBidBounds.nextValidPrize).toLocaleString('en-IN')}
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={busy === 'bid' || isConsecutiveBlockedForSeat || !activeBidBounds.canBidFurther}
                          onClick={async () => {
                            const ok = await run('bid', () =>
                              addAuctionBid(auction.id, seatModal.id, effectivePopupPrize, null, {
                                blockConsecutiveSelfBid: !allowConsecutiveSelfBid,
                              }),
                            );
                            if (ok) {
                              prevBellsRungRef.current = 0;
                              lastBellSoundKeyRef.current = '';
                              setBellToast('');
                              setBidMemberId('');
                              setSeatModal(null);
                            }
                          }}
                          style={{
                            width: '100%',
                            minHeight: '48px',
                            padding: '0 18px',
                            borderRadius: '13px',
                            border: 'none',
                            background: 'linear-gradient(180deg, var(--primary) 0%, var(--primary-dark) 100%)',
                            boxShadow: '0 10px 22px -6px var(--primary-glow), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
                            color: '#ffffff',
                            fontSize: '1rem',
                            fontWeight: 800,
                            cursor: busy === 'bid' || isConsecutiveBlockedForSeat || !activeBidBounds.canBidFurther ? 'not-allowed' : 'pointer',
                            opacity: isConsecutiveBlockedForSeat || !activeBidBounds.canBidFurther ? 0.65 : 1,
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
                              : `Place Bid · ${formatCurrency(effectivePopupPrize, currencySymbol)}`}
                          </span>
                          <span className="material-icons-outlined" style={{ fontSize: '20px', position: 'absolute', right: '16px' }}>
                            arrow_forward
                          </span>
                        </button>
                      </div>
                    )
                  )}

                  {/* Ticket Bid Activity */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.45px' }}>
                      <span>Ticket Bid History</span>
                      <span>{seatBids.length} bid(s)</span>
                    </div>
                    <div style={{ maxHeight: '170px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {seatBids.length === 0 ? (
                        <div style={{ padding: '12px 14px', borderRadius: '11px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.82rem', fontWeight: 600, textAlign: 'center' }}>
                          No bids placed for Seat #{seatTicketNo} yet.
                        </div>
                      ) : (
                        seatBids.map((b: any) => (
                          <div
                            key={b.id}
                            style={{
                              padding: '8px 11px',
                              borderRadius: '10px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                              <span
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '8px',
                                  background: 'var(--primary-light)',
                                  color: 'var(--primary-dark)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <span className="material-icons-outlined" style={{ fontSize: '15px' }}>gavel</span>
                              </span>
                              <div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                                  {formatCurrency(b.bidAmount ?? b.prizeAmount, currencySymbol)}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                                  Source: {b.source ?? 'tap'}
                                </div>
                              </div>
                            </div>
                            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                              {new Date(b.bidTime ?? b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '2px' }}>
                    {!seatModal.hasWon && isLive && roomActive && seatBids.length > 0 && (
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
                        Retract Last Bid
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSeatModal(null)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        color: '#334155',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })(), document.body)}

                        <ThirdBellWinnerModal
                          open={thirdBellModalOpen && ((!locked && !auction.winnerMemberId) || spinInModalActive)}
                          onClose={() => {
                            setSpinInModalActive(false);
                            setThirdBellModalOpen(false);
                          }}
                          groupName={group.name}
                          periodNumber={auction.periodNumber}
                          chitValue={Number(group.chitValue)}
                          currencySymbol={currencySymbol}
                          highestBid={leadingBidForTable}
                          bidCount={live?.bidCount ?? validBids.length}
                          isReservePrice={isReservePrice}
                          reserveFloorAmount={auction.reserveFloorAmount != null ? Number(auction.reserveFloorAmount) : null}
                          tieBreakRule={group.tieBreakRule}
                          tiedCount={tiedTopCandidates.length}
                          tiedCandidates={tiedTopCandidates}
                          eligibleCandidates={eligibleSpinCandidates}
                          zeroBidFloorPrize={zeroBidFloorPrize}
                          zeroBidFloorDiscount={zeroBidFloorDiscount}
                          busy={busy}
                          labels={{
                            spinWheelBtn: d.spinWheelBtn,
                            fortuneWheelTab: d.fortuneWheelTab,
                            slotRunnerTab: d.slotRunnerTab,
                            tieDetectedHeading: d.tieDetectedHeading,
                            noBidsSpinNotice: d.noBidsSpinNotice,
                          }}
                          onReopenRoom={async () => {
                            const ok = await run('reopen-room', () => reopenLiveRoomAction(auction.id, 5));
                            if (ok) {
                              prevBellsRungRef.current = 0;
                              lastBellSoundKeyRef.current = '';
                              setBellToast('');
                              setThirdBellModalOpen(false);
                            }
                          }}
                          onDrawReserveFloor={async () => {
                            const ok = await run('draw', () => drawAuctionWinner(auction.id));
                            if (ok) {
                              playWinnerConfirmedFanfare();
                              setThirdBellModalOpen(false);
                              focusSettlementWorkflow({
                                tone: 'success',
                                title: 'Step 1 Complete — Winner Drawn at Reserve Floor',
                                detail: 'Next: submit & approve winner security (Step 2) below to unlock prize payout.',
                              });
                            }
                          }}
                          onSpinTieWinner={async ({ announcementNote, minutesText }) => {
                            setSpinInModalActive(true);
                            setError('');
                            const res = await confirmAuction(
                              auction.id,
                              null,
                              minutesText || null,
                              announcementNote || null,
                              { resolveTieByLottery: true },
                            );
                            if (!res || ('ok' in res && res.ok === false)) {
                              setSpinInModalActive(false);
                              const msg = (res as any)?.error || 'Tie-break spin failed';
                              setError(msg);
                              throw new Error(msg);
                            }
                            return (res as any)?.winner ?? null;
                          }}
                          onSpinZeroBidWinner={async ({ announcementNote }) => {
                            setSpinInModalActive(true);
                            setError('');
                            const res = await drawAuctionWinner(auction.id, {
                              announcementNote: announcementNote || null,
                            });
                            if (!res || ('ok' in res && res.ok === false)) {
                              setSpinInModalActive(false);
                              const msg = (res as any)?.error || 'Zero-bid draw failed';
                              setError(msg);
                              throw new Error(msg);
                            }
                            return (res as any)?.winner ?? null;
                          }}
                          onWinnerLanded={(winner) => {
                            stopBidVoicePlayback();
                            if (winner && voiceEnabled) {
                              void speakWinnerCallout({
                                prizeAmount: Number(winner.prizeAmount ?? 0),
                                memberName: winner.name,
                                ticketNo: winner.ticketNo,
                                lang: roomVoiceLang,
                              });
                            }
                          }}
                          onAfterSpinComplete={() => {
                            stopBidVoicePlayback();
                            setSpinInModalActive(false);
                            setThirdBellModalOpen(false);
                            router.refresh();
                            fetchTimeline();
                            getLiveAuctionState(auction.id)
                              .then((state) => {
                                syncBellAnchorFromState(state);
                                setLive(state);
                              })
                              .catch(() => { });
                            focusSettlementWorkflow({
                              tone: 'success',
                              title: 'Step 1 Complete — Winner Selected & Announced!',
                              detail: 'Next: approve winner security & documents (Step 2) below to unlock prize payout.',
                            });
                          }}
                          onConfirmWinner={async ({ announcementNote, minutesText }) => {
                            const ok = await run('confirm', () =>
                              confirmAuction(auction.id, null, minutesText || null, announcementNote || null),
                            );
                            if (ok) {
                              stopBidVoicePlayback();
                              playWinnerConfirmedFanfare();
                              if (leadingBidForTable && voiceEnabled) {
                                void speakWinnerCallout({
                                  prizeAmount: Number(leadingBidForTable.prizeAmount ?? 0),
                                  memberName: leadingBidForTable.memberName,
                                  ticketNo: leadingBidForTable.ticketNo,
                                  lang: roomVoiceLang,
                                });
                              }
                              setThirdBellModalOpen(false);
                              focusSettlementWorkflow({
                                tone: 'success',
                                title: 'Step 1 Complete — Winner Confirmed & Announced!',
                                detail: 'Next: submit & approve winner security (Step 2) below to unlock prize payout.',
                              });
                            }
                          }}
                        />

                        <AuctionScheduleModal
                          open={scheduleModalOpen}
                          onClose={() => setScheduleModalOpen(false)}
                          auctionId={auction.id}
                          groupName={group.name}
                          periodNumber={auction.periodNumber}
                          initialScheduledAt={auction.scheduledAt ?? auction.auctionDate}
                          initialDurationMinutes={engineCfg.meetingSchedule?.defaultDurationMinutes ?? 30}
                          initialAutoStart={Boolean(engineCfg.meetingSchedule?.autoStartAtScheduledTime)}
                          isBiddingRoom={isBiddingRoom}
                          dict={dict}
                          onCompleted={() => {
                            router.refresh();
                            fetchTimeline();
                            if (!locked) {
                              getLiveAuctionState(auction.id).then(setLive).catch(() => { });
                            }
                          }}
                        />

                        <ChitPdfPreviewModal
                          open={pdfPreviewOpen}
                          onClose={() => setPdfPreviewOpen(false)}
                          title={`${group.name} — Period ${auction.periodNumber} Report`}
                          previewUrl={periodReportPreviewUrl}
                          downloadUrl={periodReportUrl}
                          pdfLang={pdfLang}
                          onChangePdfLang={setPdfLang}
                        />
                      </div>
                    );
}
