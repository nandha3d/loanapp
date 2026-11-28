'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '@/lib/utils';
import { stopBidVoicePlayback } from '@/lib/chits/bidVoiceAnnouncer';
import FortuneWheelSpinner, {
  type SpinWinnerResult,
  type WheelCandidate,
} from './FortuneWheelSpinner';

const subscribeNoop = () => () => {};

interface HighestBidCandidate {
  id?: string;
  ticketNo?: string | number | null;
  memberName?: string | null;
  prizeAmount?: number | null;
  bidDiscount?: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  groupName: string;
  periodNumber: number;
  chitValue: number;
  currencySymbol: string;
  highestBid: HighestBidCandidate | null;
  bidCount: number;
  isReservePrice?: boolean;
  reserveFloorAmount?: number | null;
  tieBreakRule?: string | null;
  tiedCount?: number;
  tiedCandidates?: WheelCandidate[];
  eligibleCandidates?: WheelCandidate[];
  zeroBidFloorPrize?: number;
  zeroBidFloorDiscount?: number;
  busy?: string;
  onConfirmWinner: (opts: { announcementNote: string; minutesText: string }) => Promise<void>;
  onSpinTieWinner?: (opts: {
    announcementNote: string;
    minutesText: string;
  }) => Promise<SpinWinnerResult | null>;
  onSpinZeroBidWinner?: (opts: {
    announcementNote: string;
    minutesText: string;
  }) => Promise<SpinWinnerResult | null>;
  onWinnerLanded?: (winner: SpinWinnerResult) => void;
  onAfterSpinComplete?: () => void;
  onDrawReserveFloor?: () => Promise<void>;
  onReopenRoom?: () => Promise<void>;
  labels?: {
    title?: string;
    subtitle?: string;
    highestBidHeading?: string;
    prizeLabel?: string;
    discountLabel?: string;
    totalBidsLabel?: string;
    announcementLabel?: string;
    announcementPlaceholder?: string;
    reopenBtn?: string;
    dismissBtn?: string;
    confirmAnnounceBtn?: string;
    confirmingBtn?: string;
    noBidsNotice?: string;
    drawFloorBtn?: string;
    spinWheelBtn?: string;
    fortuneWheelTab?: string;
    slotRunnerTab?: string;
    tieDetectedHeading?: string;
    noBidsSpinNotice?: string;
  };
}

type ModalMode = 'highest_bid' | 'tie_spin' | 'zero_bid_spin';

export default function ThirdBellWinnerModal({
  open,
  onClose,
  groupName,
  periodNumber,
  chitValue,
  currencySymbol,
  highestBid,
  bidCount,
  isReservePrice = false,
  reserveFloorAmount = null,
  tieBreakRule,
  tiedCount = 0,
  tiedCandidates = [],
  eligibleCandidates = [],
  zeroBidFloorPrize,
  zeroBidFloorDiscount,
  busy = '',
  onConfirmWinner,
  onSpinTieWinner,
  onSpinZeroBidWinner,
  onWinnerLanded,
  onAfterSpinComplete,
  onDrawReserveFloor,
  onReopenRoom,
  labels,
}: Props) {
  const isMounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  // Latch initial mode + candidates when modal opens so background polling / revalidation
  // mid-spin never mutates a zero-bid wheel into a fake highest-bid card.
  const wasOpenRef = useRef(false);
  const [latchedState, setLatchedState] = useState<{
    mode: ModalMode;
    highestBid: HighestBidCandidate | null;
    bidCount: number;
    tiedCount: number;
    tiedCandidates: WheelCandidate[];
    eligibleCandidates: WheelCandidate[];
  } | null>(null);
  const [customAnnouncement, setCustomAnnouncement] = useState<string | null>(null);
  const [minutesText, setMinutesText] = useState('');
  const [spinningNow, setSpinningNow] = useState(false);
  const [spinFinished, setSpinFinished] = useState(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const effTied = Math.max(tiedCount, tiedCandidates.length);
      const nextMode: ModalMode =
        !highestBid || bidCount === 0
          ? 'zero_bid_spin'
          : effTied > 1 && tiedCandidates.length > 1 && Boolean(onSpinTieWinner)
            ? 'tie_spin'
            : 'highest_bid';
      setLatchedState({
        mode: nextMode,
        highestBid,
        bidCount,
        tiedCount: effTied,
        tiedCandidates,
        eligibleCandidates,
      });
      setSpinningNow(false);
      setSpinFinished(false);
      setCustomAnnouncement(null);
      setMinutesText('');
    } else if (!open && wasOpenRef.current) {
      setLatchedState(null);
      setSpinningNow(false);
      setSpinFinished(false);
    }
    wasOpenRef.current = open;
  }, [open, highestBid, bidCount, tiedCount, tiedCandidates, eligibleCandidates, onSpinTieWinner]);

  if (!open || !isMounted) return null;

  const activeMode: ModalMode =
    latchedState?.mode ??
    (!highestBid || bidCount === 0
      ? 'zero_bid_spin'
      : Math.max(tiedCount, tiedCandidates.length) > 1 && tiedCandidates.length > 1 && Boolean(onSpinTieWinner)
        ? 'tie_spin'
        : 'highest_bid');
  const activeBid = latchedState ? latchedState.highestBid : highestBid;
  const activeBidCount = latchedState ? latchedState.bidCount : bidCount;
  const activeTiedCount = latchedState ? latchedState.tiedCount : Math.max(tiedCount, tiedCandidates.length);
  const activeTiedCandidates = latchedState ? latchedState.tiedCandidates : tiedCandidates;
  const activeEligibleCandidates = latchedState ? latchedState.eligibleCandidates : eligibleCandidates;

  const isTiedTop = activeMode === 'tie_spin';
  const isZeroBid = activeMode === 'zero_bid_spin';

  const winningPrize = activeBid
    ? Number(activeBid.prizeAmount ?? Math.max(0, chitValue - Number(activeBid.bidDiscount ?? 0)))
    : 0;
  const bidDiscount = activeBid ? Number(activeBid.bidDiscount ?? Math.max(0, chitValue - winningPrize)) : 0;

  const computedFloorDiscount =
    zeroBidFloorDiscount ?? (isReservePrice && reserveFloorAmount != null ? reserveFloorAmount : 0);
  const computedFloorPrize =
    zeroBidFloorPrize ?? Math.max(1, chitValue - computedFloorDiscount);

  const defaultAnnouncement = isTiedTop
    ? `🎡 Sold after Tie-Break Draw on 3rd Bell at Prize ${formatCurrency(winningPrize, currencySymbol)} (Discount ${formatCurrency(bidDiscount, currencySymbol)}).`
    : activeBid
      ? `🔔 Sold on 3rd Bell! Congratulations #${activeBid.ticketNo ?? '?'} ${activeBid.memberName || 'Member'} — Winning Prize ${formatCurrency(
          winningPrize,
          currencySymbol,
        )} (Discount ${formatCurrency(bidDiscount, currencySymbol)}).`
      : `🎡 No bids placed by 3rd Bell — Lucky Draw resolved at floor Prize ${formatCurrency(
          computedFloorPrize,
          currencySymbol,
        )} (Discount ${formatCurrency(computedFloorDiscount, currencySymbol)}).`;

  const announcementNote = customAnnouncement ?? defaultAnnouncement;
  const showTieWheel = isTiedTop && Boolean(onSpinTieWinner);
  const showZeroBidWheel = isZeroBid && activeEligibleCandidates.length > 0 && Boolean(onSpinZeroBidWinner);

  const handleCloseSafely = () => {
    stopBidVoicePlayback();
    if (spinFinished) onAfterSpinComplete?.();
    onClose();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="third-bell-winner-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1450,
        background: 'rgba(8, 15, 28, 0.74)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={() => {
        if (!spinningNow) handleCloseSafely();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: showTieWheel || showZeroBidWheel ? '650px' : '540px',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: '#ffffff',
          border: '1px solid rgba(148, 163, 184, 0.28)',
          borderRadius: '20px',
          boxShadow: '0 26px 64px -16px rgba(8, 15, 28, 0.68)',
          color: '#0f172a',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Studio Obsidian Header Matching Live Chit Room */}
        <div
          style={{
            padding: '18px 22px',
            background:
              'radial-gradient(110% 130% at 15% 0%, rgba(250, 204, 21, 0.16) 0%, transparent 58%), linear-gradient(135deg, #0f1b2e 0%, #16243a 62%, #0c1728 100%)',
            borderBottom: '1px solid rgba(148, 163, 184, 0.22)',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '13px',
                background: 'rgba(250, 204, 21, 0.15)',
                border: '1px solid rgba(250, 204, 21, 0.45)',
                color: '#fde047',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '24px' }}>
                {showTieWheel || showZeroBidWheel ? 'casino' : 'emoji_events'}
              </span>
            </div>
            <div>
              <div style={{ fontSize: '0.73rem', fontWeight: 800, color: '#fde047', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                {groupName} · Period {periodNumber}
              </div>
              <h3 id="third-bell-winner-title" style={{ margin: '3px 0 0', fontSize: '1.18rem', fontWeight: 800, color: '#ffffff' }}>
                {labels?.title || '3rd Bell Completed — Confirm Winner'}
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.38 }}>
                {isTiedTop
                  ? `${activeTiedCount} members tied at the highest discount — spin the wheel or slot runner to pick the winner.`
                  : isZeroBid
                    ? 'No bids were recorded by the 3rd bell — spin the lucky wheel among eligible members or re-open the room.'
                    : labels?.subtitle ||
                      'Review the winning bid, confirm & announce to all members, then approve security to release payout.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={spinningNow}
            onClick={handleCloseSafely}
            aria-label="Close popup"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              border: '1px solid rgba(148, 163, 184, 0.32)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#f8fafc',
              cursor: spinningNow ? 'default' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        {/* Studio Body */}
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#ffffff' }}>
          {activeMode === 'highest_bid' && activeBid && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '14px',
                background: '#f8fafc',
                border: '1.5px solid var(--primary-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary-dark)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🏆 {labels?.highestBidHeading || 'Highest Valid Bid'}
                  </div>
                  <div style={{ fontSize: '1.22rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                    #{activeBid.ticketNo ?? '—'} · {activeBid.memberName || 'Member'}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: 'var(--primary-light)',
                    color: 'var(--primary-dark)',
                    border: '1px solid var(--primary-border)',
                  }}
                >
                  {labels?.totalBidsLabel || 'Bids Placed'}: {activeBidCount}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                <div style={{ padding: '10px 12px', borderRadius: '11px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>
                    {labels?.prizeLabel || 'Winning Prize Amount'}
                  </div>
                  <div style={{ fontSize: '1.18rem', fontWeight: 900, color: '#15803d', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(winningPrize, currencySymbol)}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '11px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>
                    {labels?.discountLabel || 'Bid Discount Offered'}
                  </div>
                  <div style={{ fontSize: '1.18rem', fontWeight: 900, color: 'var(--primary-dark)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(bidDiscount, currencySymbol)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {showTieWheel && onSpinTieWinner && (
            <>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
                  ⚖️ {labels?.tieDetectedHeading || `${activeTiedCount} Members Tied at Top Discount`} ·{' '}
                  {formatCurrency(winningPrize, currencySymbol)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {activeTiedCandidates.map((tc) => (
                    <span
                      key={tc.memberId}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a',
                      }}
                    >
                      #{tc.ticketNo} {tc.name}
                    </span>
                  ))}
                </div>
              </div>
              <FortuneWheelSpinner
                candidates={activeTiedCandidates}
                modeLabel="Tie-Break Spin"
                prizeAmountLabel={`Prize ${formatCurrency(winningPrize, currencySymbol)}`}
                spinButtonLabel={labels?.spinWheelBtn || 'Spin Wheel to Break Tie'}
                fortuneWheelTabLabel={labels?.fortuneWheelTab}
                slotRunnerTabLabel={labels?.slotRunnerTab}
                disabled={Boolean(busy)}
                onSpinStart={() => {
                  stopBidVoicePlayback();
                  setSpinningNow(true);
                }}
                onSpinRequest={async () => {
                  try {
                    const res = await onSpinTieWinner({ announcementNote, minutesText });
                    if (!res) setSpinningNow(false);
                    return res;
                  } catch (err) {
                    setSpinningNow(false);
                    throw err;
                  }
                }}
                onLanded={(winner) => {
                  setSpinningNow(false);
                  setSpinFinished(true);
                  onWinnerLanded?.(winner);
                }}
                onComplete={() => {
                  stopBidVoicePlayback();
                  onAfterSpinComplete?.();
                  onClose();
                }}
              />
            </>
          )}

          {isZeroBid && (
            <>
              <div
                style={{
                  padding: '11px 14px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#334155',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '20px', color: '#d97706', flexShrink: 0 }}>info</span>
                <span>
                  {labels?.noBidsSpinNotice ||
                    labels?.noBidsNotice ||
                    `No valid bids were placed before the 3rd bell. Spin among ${activeEligibleCandidates.length} eligible seats at floor prize ${formatCurrency(
                      computedFloorPrize,
                      currencySymbol,
                    )}, or re-open the room (+5m).`}
                </span>
              </div>
              {showZeroBidWheel && onSpinZeroBidWinner && (
                <FortuneWheelSpinner
                  candidates={activeEligibleCandidates}
                  modeLabel="Zero-Bid Lucky Spin"
                  prizeAmountLabel={`Floor Prize ${formatCurrency(computedFloorPrize, currencySymbol)}`}
                  spinButtonLabel={labels?.spinWheelBtn || 'Spin Wheel to Pick Winner'}
                  fortuneWheelTabLabel={labels?.fortuneWheelTab}
                  slotRunnerTabLabel={labels?.slotRunnerTab}
                  disabled={Boolean(busy)}
                  onSpinStart={() => {
                    stopBidVoicePlayback();
                    setSpinningNow(true);
                  }}
                  onSpinRequest={async () => {
                    try {
                      const res = await onSpinZeroBidWinner({ announcementNote, minutesText });
                      if (!res) setSpinningNow(false);
                      return res;
                    } catch (err) {
                      setSpinningNow(false);
                      throw err;
                    }
                  }}
                  onLanded={(winner) => {
                    setSpinningNow(false);
                    setSpinFinished(true);
                    onWinnerLanded?.(winner);
                  }}
                  onComplete={() => {
                    stopBidVoicePlayback();
                    onAfterSpinComplete?.();
                    onClose();
                  }}
                />
              )}
            </>
          )}

          {!spinFinished && (
            <>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                  📢 {labels?.announcementLabel || 'Announcement Message to Group Room'}
                </label>
                <textarea
                  rows={2}
                  className="form-control"
                  value={announcementNote}
                  onChange={(e) => setCustomAnnouncement(e.target.value)}
                  placeholder={labels?.announcementPlaceholder || 'Optional announcement posted in the group chat room...'}
                />
              </div>

              {activeBid && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                    📝 Minutes Override (optional)
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={minutesText}
                    onChange={(e) => setMinutesText(e.target.value)}
                    placeholder="Leave blank to auto-generate statutory minutes"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!spinFinished && onReopenRoom && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={Boolean(busy) || spinningNow}
                onClick={() => {
                  stopBidVoicePlayback();
                  void onReopenRoom();
                }}
              >
                {busy === 'reopen-room' ? 'Re-opening…' : `🔓 ${labels?.reopenBtn || 'Re-Open Room (+5m)'}`}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={Boolean(busy) || spinningNow}
              onClick={handleCloseSafely}
            >
              {spinFinished ? 'Close' : labels?.dismissBtn || 'Later'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-end' }}>
            {activeBid && (!isTiedTop || tieBreakRule === 'EARLIEST_BID') && !spinFinished && (
              <button
                type="button"
                disabled={Boolean(busy) || spinningNow}
                onClick={async () => {
                  stopBidVoicePlayback();
                  await onConfirmWinner({ announcementNote, minutesText });
                  setCustomAnnouncement(null);
                  setMinutesText('');
                }}
                style={{
                  minHeight: '44px',
                  padding: '0 20px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(180deg, var(--primary) 0%, var(--primary-dark) 100%)',
                  boxShadow: '0 8px 18px -5px var(--primary-glow), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
                  color: '#ffffff',
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  cursor: Boolean(busy) || spinningNow ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>verified</span>
                <span>
                  {busy === 'confirm'
                    ? labels?.confirmingBtn || 'Confirming…'
                    : isTiedTop
                      ? `Confirm Earliest Bid (#${activeBid.ticketNo ?? '—'})`
                      : labels?.confirmAnnounceBtn || 'Confirm Winner & Open Settlement'}
                </span>
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
              </button>
            )}
            {isZeroBid && !showZeroBidWheel && isReservePrice && onDrawReserveFloor && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={Boolean(busy)}
                onClick={() => void onDrawReserveFloor()}
              >
                {busy === 'draw'
                  ? 'Resolving…'
                  : labels?.drawFloorBtn ||
                    `Draw at Reserve Floor (${reserveFloorAmount != null ? formatCurrency(reserveFloorAmount, currencySymbol) : 'R_t'})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
