'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import {
  computeTableEdgeCoords,
  MAX_MAIN_TABLE_SEATS,
  partitionTableAndBenchSeats,
} from '@/lib/chits/seatOrder';

export { computeTableEdgeCoords };

export interface PokerTableSeat {
  memberId: string;
  customerId?: string | null;
  ticketNo: string | number;
  name: string;
  photoUrl?: string | null;
  isOnline?: boolean;
  isLeader?: boolean;
  hasWon?: boolean;
  isMe?: boolean;
  isPaused?: boolean;
  ticketCount?: number;
  ticketLabel?: string;
  latestPrize?: number | null;
}

export interface PokerTableArenaProps {
  periodNumber: number;
  chitValue: number;
  currencySymbol: string;
  roomStatus?: string;
  auctionStatus?: string;
  isOpen?: boolean;
  secondsRemaining?: number;
  seats: PokerTableSeat[];
  highestBid?: {
    ticketNo?: string | number | null;
    memberName?: string | null;
    prizeAmount?: number | null;
    bidDiscount?: number | null;
  } | null;
  hideBidAmounts?: boolean;
  bidCount?: number;
  bell?: {
    enabled?: boolean;
    bellsRung?: number;
    bellCount?: number;
  } | null;
  bellAlertText?: string | null;
  bellCountdownSec?: number | null;
  nextBellNumber?: number | null;
  confirmedWinner?: {
    ticketNo: string | number;
    memberName: string;
    prizeAmount: number;
  } | null;
  selectedMemberId?: string;
  onSelectSeat?: (seat: PokerTableSeat) => void;
  emptyCenterLabel?: string;
  embedded?: boolean;
}

// Seat geometry helper `computeTableEdgeCoords` imported & re-exported from lib/chits/seatOrder.ts

export function PokerTableArena({
  periodNumber,
  chitValue,
  currencySymbol,
  roomStatus,
  auctionStatus,
  isOpen = false,
  secondsRemaining = 0,
  seats,
  highestBid,
  hideBidAmounts = false,
  bidCount = 0,
  bell,
  bellAlertText,
  bellCountdownSec = null,
  nextBellNumber = null,
  confirmedWinner = null,
  selectedMemberId,
  onSelectSeat,
  emptyCenterLabel,
  embedded = false,
}: PokerTableArenaProps) {
  const [clockNow, setClockNow] = useState<Date | null>(null);
  const [autoBellLabel, setAutoBellLabel] = useState<string | null>(null);
  const [failedPhotoUrls, setFailedPhotoUrls] = useState<Record<string, boolean>>({});
  const prevBellsRef = useRef<number>(bell?.bellsRung ?? 0);

  useEffect(() => {
    const boot = setTimeout(() => setClockNow(new Date()), 0);
    const id = setInterval(() => setClockNow(new Date()), 1000);
    return () => {
      clearTimeout(boot);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const current = bell?.bellsRung ?? 0;
    const totalBells = bell?.bellCount ?? 3;
    if (current === 0 || confirmedWinner) {
      prevBellsRef.current = current;
      const clearTimer = setTimeout(() => setAutoBellLabel(null), 0);
      return () => clearTimeout(clearTimer);
    }
    if (current > prevBellsRef.current && current > 0) {
      const label =
        current >= totalBells
          ? 'FINAL BELL!'
          : current === totalBells - 1
            ? 'GOING TWICE!'
            : 'GOING ONCE!';
      const bootLabel = setTimeout(() => setAutoBellLabel(label), 0);
      const t = setTimeout(() => setAutoBellLabel(null), 2000);
      prevBellsRef.current = current;
      return () => {
        clearTimeout(bootLabel);
        clearTimeout(t);
      };
    }
    prevBellsRef.current = current;
  }, [bell?.bellsRung, bell?.bellCount, confirmedWinner]);

  const activeBellOverlay = confirmedWinner ? null : bellAlertText || autoBellLabel;
  // Cap main table at 20 interleaved seats; additional members sit in the side bench until they bid.
  const { tableSeats, benchSeats } = partitionTableAndBenchSeats(seats, MAX_MAIN_TABLE_SEATS);
  const hasBench = benchSeats.length > 0;
  const total = tableSeats.length || 1;
  const isDense = total > 14;
  const isUltraDense = total > 18 || hasBench;
  const avatarPx = hasBench ? 40 : isDense ? 46 : 52;

  const leaderPrize = highestBid
    ? highestBid.prizeAmount != null
      ? Number(highestBid.prizeAmount)
      : Math.max(0, Number(chitValue) - Number(highestBid.bidDiscount ?? 0))
    : null;

  const mins = Math.floor(Math.max(0, secondsRemaining) / 60);
  const secs = String(Math.max(0, secondsRemaining) % 60).padStart(2, '0');
  const onlineCount = seats.filter((s) => s.isOnline).length;
  const showFiveSecCountdown =
    Boolean(isOpen && !confirmedWinner && bellCountdownSec != null && bellCountdownSec >= 1 && bellCountdownSec <= 5);

  return (
    <div
      style={
        embedded
          ? {
            position: 'relative',
            width: '100%',
            padding: 0,
            borderRadius: '18px',
            background: 'radial-gradient(ellipse at 50% 48%, #eae8ed 0%, #dcdadf 65%, #cecccf 100%)',
            border: '1px solid rgba(255, 255, 255, 0.7)',
            boxShadow: '0 14px 32px rgba(2, 6, 23, 0.42)',
            overflow: 'hidden',
            userSelect: 'none',
          }
          : {
            position: 'relative',
            width: '100%',
            padding: '44px 10px 30px',
            borderRadius: '20px',
            background: 'linear-gradient(180deg, #0b1222 0%, #11192e 100%)',
            border: '1.5px solid var(--border)',
            boxShadow: '0 20px 44px -12px rgba(15, 23, 42, 0.42)',
            overflow: 'hidden',
            userSelect: 'none',
          }
      }
    >
      <style>{`
        @keyframes pokerStudioGlow {
          0%, 100% { opacity: 0.78; }
          50% { opacity: 1; }
        }
        @keyframes pokerSparkleBeacon {
          0%, 100% { transform: translate(-50%, -50%) scale(0.92); opacity: 0.78; }
          50% { transform: translate(-50%, -50%) scale(1.16); opacity: 1; }
        }
        @keyframes pokerBellCountdownPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 18px rgba(245, 158, 11, 0.7); }
          50% { transform: scale(1.06); box-shadow: 0 0 28px rgba(239, 68, 68, 0.92); }
        }
      `}</style>

      {/* Top-Left Clock & Seat Count (shown standalone only; embedded mode uses Studio Telemetry Strip) */}
      {!embedded && (
        <div
          style={{
            position: 'absolute',
            top: '14px',
            left: '16px',
            zIndex: 15,
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {clockNow && (
            <div
              style={{
                padding: '6px 11px',
                background: 'rgba(15, 23, 42, 0.84)',
                backdropFilter: 'blur(8px)',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.16)',
              }}
            >
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                {clockNow.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>
                {clockNow.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          )}
          <div
            style={{
              padding: '6px 11px',
              background: 'rgba(15, 23, 42, 0.8)',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.14)',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>
              👥 {hasBench ? `${tableSeats.length} Table · +${benchSeats.length} Bench` : `${seats.length} Active Seats`}
            </span>
            <span style={{ color: '#4ade80' }}>● {onlineCount} Present</span>
          </div>
        </div>
      )}

      {/* Top-Right Room Status & Bells (shown standalone only) */}
      {!embedded && (
        <div
          style={{
            position: 'absolute',
            top: '14px',
            right: '16px',
            zIndex: 15,
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          {bell?.enabled && (bell.bellsRung ?? 0) > 0 && (
            <div
              style={{
                padding: '5px 11px',
                borderRadius: '999px',
                background: 'rgba(234, 88, 12, 0.92)',
                color: '#fff',
                fontSize: '0.74rem',
                fontWeight: 800,
              }}
            >
              🔔 {bell.bellsRung}/{bell.bellCount ?? 3}
            </div>
          )}
          <div
            style={{
              padding: '5px 12px',
              borderRadius: '999px',
              background: confirmedWinner
                ? 'rgba(22, 163, 74, 0.92)'
                : isOpen
                  ? 'rgba(220, 38, 38, 0.92)'
                  : 'rgba(15, 23, 42, 0.86)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.6px',
            }}
          >
            {confirmedWinner
              ? `🏆 WINNER #${confirmedWinner.ticketNo}`
              : isOpen
                ? '● LIVE'
                : auctionStatus === 'in_progress'
                  ? '● IN PROGRESS'
                  : (roomStatus ?? 'SCHEDULED').toUpperCase()}
          </div>
        </div>
      )}

      {/* Bottom Hint (shown standalone only) */}
      {!embedded && onSelectSeat && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '16px',
            zIndex: 12,
            padding: '4px 10px',
            borderRadius: '8px',
            background: 'rgba(15, 23, 42, 0.78)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#cbd5e1',
            fontSize: '0.68rem',
            fontWeight: 600,
          }}
        >
          💡 Click any member around the table to bid directly or view history
        </div>
      )}

      {/* Keep full-width layout for <=20 members; shrink table left & add right bench only when >20 members */}
      <div
        className={hasBench ? 'poker-arena-split-with-bench' : undefined}
        style={
          hasBench
            ? {
              display: 'grid',
              gap: '12px',
              alignItems: 'center',
            }
            : undefined
        }
      >
        {hasBench && (
          <style>{`
            .poker-arena-split-with-bench {
              grid-template-columns: minmax(0, 1fr) 215px;
            }
            @media (max-width: 860px) {
              .poker-arena-split-with-bench {
                grid-template-columns: 1fr;
              }
            }
          `}</style>
        )}

        {/* Seamless Full-Bleed Table Frame (`poker_table.avif`) aligned with 20-seat max perimeter */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            margin: '0 auto',
            aspectRatio: '2712 / 1536',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Soft Perimeter Glow Behind Table */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: '4%',
              borderRadius: '999px',
              background:
                'radial-gradient(ellipse at center, rgba(250, 204, 21, 0.18) 0%, color-mix(in srgb, var(--primary) 16%, transparent) 46%, transparent 74%)',
              filter: 'blur(20px)',
              animation: 'pokerStudioGlow 4s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: '3.5%',
              backgroundImage: 'url(/assets/poker_table.avif)',
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              filter: 'contrast(1.06) brightness(1.02)',
              borderRadius: embedded ? '0px' : '26px',
              WebkitMaskImage: embedded
                ? 'radial-gradient(ellipse 98% 96% at 50% 50%, #000 84%, transparent 100%)'
                : undefined,
              maskImage: embedded
                ? 'radial-gradient(ellipse 98% 96% at 50% 50%, #000 84%, transparent 100%)'
                : undefined,
              boxShadow: embedded
                ? 'none'
                : isOpen
                  ? '0 0 44px rgba(250, 204, 21, 0.36), 0 0 88px color-mix(in srgb, var(--primary) 32%, transparent), inset 0 0 24px rgba(250, 204, 21, 0.16)'
                  : '0 0 34px rgba(250, 204, 21, 0.24), 0 20px 48px rgba(0, 0, 0, 0.48)',
            }}
          />
          {/* Calibrated Golden LED Rim Lighting Tracing the Inner Leather/Walnut Rail */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '28.2%',
              bottom: '26.9%',
              left: '18.0%',
              right: '15.8%',
              borderRadius: '999px',
              border: '2px solid rgba(254, 240, 138, 0.88)',
              boxShadow: isOpen
                ? '0 0 22px 4px rgba(245, 158, 11, 0.82), 0 0 44px 8px rgba(234, 179, 8, 0.38), inset 0 0 24px 4px rgba(245, 158, 11, 0.56)'
                : '0 0 18px 3px rgba(245, 158, 11, 0.72), 0 0 36px 6px rgba(234, 179, 8, 0.3), inset 0 0 20px 3px rgba(245, 158, 11, 0.48)',
              pointerEvents: 'none',
              zIndex: 6,
              animation: 'pokerStudioGlow 3.6s ease-in-out infinite',
            }}
          />
          {/* 7 Bright-Core Specular Glint Stars Anchored Directly on the Wooden Rail Perimeter */}
          {[
            { top: '28.2%', left: '31.5%', w: '74px', h: '26px' },
            { top: '28.2%', left: '51.1%', w: '88px', h: '28px' },
            { top: '28.2%', left: '70.5%', w: '74px', h: '26px' },
            { top: '50.6%', left: '84.2%', w: '26px', h: '72px' },
            { top: '73.1%', left: '70.5%', w: '74px', h: '26px' },
            { top: '73.1%', left: '31.5%', w: '74px', h: '26px' },
            { top: '50.6%', left: '18.0%', w: '26px', h: '72px' },
          ].map((pt, i) => (
            <div
              key={i}
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: pt.top,
                left: pt.left,
                width: pt.w,
                height: pt.h,
                transform: 'translate(-50%, -50%)',
                background:
                  'radial-gradient(circle, rgba(255,255,255,0.96) 0%, rgba(254, 240, 138, 0.85) 24%, rgba(245, 158, 11, 0.35) 54%, transparent 76%)',
                filter: 'blur(2.5px)',
                mixBlendMode: 'screen',
                pointerEvents: 'none',
                zIndex: 7,
                animation: `pokerSparkleBeacon 3.4s ease-in-out ${i * 0.32}s infinite`,
              }}
            />
          ))}

          {/* Center Bell Ringing Attention Overlay */}
          {activeBellOverlay && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 40,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                background: 'radial-gradient(circle, rgba(234,179,8,0.28) 0%, rgba(15,23,42,0.55) 70%)',
                borderRadius: '20px',
              }}
            >
              <style>{`
              @keyframes pokerBellSwing {
                0% { transform: rotate(0deg) scale(1); }
                15% { transform: rotate(22deg) scale(1.1); }
                30% { transform: rotate(-20deg) scale(1.12); }
                45% { transform: rotate(16deg) scale(1.08); }
                60% { transform: rotate(-14deg) scale(1.06); }
                75% { transform: rotate(8deg) scale(1.03); }
                100% { transform: rotate(0deg) scale(1); }
              }
              @keyframes pokerBellRingPulse {
                0% { transform: scale(0.7); opacity: 0.9; }
                100% { transform: scale(1.85); opacity: 0; }
              }
            `}</style>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div
                  style={{
                    position: 'absolute',
                    width: '124px',
                    height: '124px',
                    borderRadius: '50%',
                    border: '4px solid #facc15',
                    animation: 'pokerBellRingPulse 1.1s ease-out infinite',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    width: '124px',
                    height: '124px',
                    borderRadius: '50%',
                    border: '3px solid #fb923c',
                    animation: 'pokerBellRingPulse 1.1s ease-out 0.35s infinite',
                  }}
                />
                <div
                  style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #fde047 0%, #f59e0b 60%, #dc2626 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 36px rgba(250, 204, 21, 0.85)',
                    border: '3px solid #fffbeb',
                    animation: 'pokerBellSwing 0.85s ease-in-out infinite',
                  }}
                >
                  <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill="#fffbeb" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
              </div>
              <div
                style={{
                  marginTop: '14px',
                  padding: '9px 24px',
                  borderRadius: '999px',
                  background: 'linear-gradient(90deg, #b91c1c, #ea580c)',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '1.15rem',
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  border: '2px solid #fde047',
                }}
              >
                🔔 {activeBellOverlay}
              </div>
            </div>
          )}

          {/* Larger Illuminated Royal-Gold Medallion with Pulsing Halo, Metallic Bezel & 5s Bell Countdown */}
          <div
            style={{
              position: 'relative',
              zIndex: 12,
              width: hasBench ? 'clamp(290px, 41%, 390px)' : 'clamp(340px, 47%, 500px)',
              maxWidth: '92%',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            {/* Ambient Golden Halo Behind Center Medallion */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: '-16px -22px',
                borderRadius: '999px',
                background: confirmedWinner
                  ? 'radial-gradient(ellipse at center, rgba(74, 222, 128, 0.36) 0%, rgba(250, 204, 21, 0.24) 48%, transparent 76%)'
                  : showFiveSecCountdown
                    ? 'radial-gradient(ellipse at center, rgba(239, 68, 68, 0.45) 0%, rgba(245, 158, 11, 0.32) 48%, transparent 78%)'
                    : 'radial-gradient(ellipse at center, rgba(250, 204, 21, 0.42) 0%, rgba(245, 158, 11, 0.2) 52%, transparent 78%)',
                filter: 'blur(18px)',
                animation: 'pokerStudioGlow 3.2s ease-in-out infinite',
                pointerEvents: 'none',
              }}
            />

            {/* Metallic Gold Bezel Outer Shell */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                padding: '2px',
                borderRadius: '999px',
                background: 'linear-gradient(180deg, #11192b 0%, #0b1120 55%, #070b15 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -10px 24px rgba(0, 0, 0, 0.55)',
              }}
            >
              {/* Inner Velvet Obsidian Medallion Core */}
              <div
                style={{
                  position: 'relative',
                  textAlign: 'center',
                  padding: isDense ? '20px 30px' : '25px 40px',
                  borderRadius: '999px',
                  background:
                    'radial-gradient(ellipse at 50% 0%, rgba(250, 204, 21, 0.2) 0%, rgba(20, 30, 52, 0.97) 52%, rgba(9, 14, 26, 0.99) 100%)',
                  backdropFilter: 'blur(16px)',
                  boxShadow: 'inset 0 1px 0 rgba(254, 240, 138, 0.32), inset 0 -10px 24px rgba(0, 0, 0, 0.48)',
                }}
              >
                {/* Live 5-Second Urgent Bell Countdown Floating Badge */}
                {showFiveSecCountdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-15px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '4px 14px',
                      borderRadius: '999px',
                      background: 'linear-gradient(90deg, #b91c1c 0%, #ea580c 52%, #d97706 100%)',
                      border: '1.5px solid #fef08a',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 900,
                      letterSpacing: '0.6px',
                      whiteSpace: 'nowrap',
                      animation: 'pokerBellCountdownPulse 0.85s ease-in-out infinite',
                    }}
                  >
                    <span>🔔 BELL {nextBellNumber ?? ((bell?.bellsRung ?? 0) + 1)} IN</span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: '#fef08a',
                        color: '#991b1b',
                        fontSize: '0.84rem',
                        fontWeight: 900,
                      }}
                    >
                      {bellCountdownSec}
                    </span>
                  </div>
                )}

                <div
                  style={{
                    fontSize: '0.79rem',
                    textTransform: 'uppercase',
                    letterSpacing: '2.3px',
                    color: '#fde047',
                    fontWeight: 900,
                    textShadow: '0 0 12px rgba(250, 204, 21, 0.45)',
                  }}
                >
                  ✦ CHIT PERIOD {periodNumber} ✦
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', margin: '7px 0' }}>
                  <svg
                    width="30"
                    height="46"
                    viewBox="0 0 24 36"
                    fill="none"
                    aria-hidden="true"
                    style={{ flexShrink: 0, filter: 'drop-shadow(0 0 7px rgba(250, 204, 21, 0.65))' }}
                  >
                    <path d="M18 33C9 27 6 15 11 4" stroke="#facc15" strokeWidth="1.8" strokeLinecap="round" />
                    <ellipse cx="7" cy="24" rx="4.4" ry="2.2" transform="rotate(-35 7 24)" fill="#fde047" />
                    <ellipse cx="6" cy="17" rx="4.4" ry="2.2" transform="rotate(-20 6 17)" fill="#fef08a" />
                    <ellipse cx="8" cy="10" rx="4.1" ry="2.1" transform="rotate(10 8 10)" fill="#facc15" />
                    <ellipse cx="13" cy="29" rx="3.9" ry="2.0" transform="rotate(-55 13 29)" fill="#eab308" />
                  </svg>

                  <div>
                    <div
                      style={{
                        fontSize: confirmedWinner ? '1.36rem' : isOpen ? '2.05rem' : '1.58rem',
                        fontWeight: 900,
                        color: confirmedWinner ? '#fde047' : isOpen ? '#38bdf8' : '#ffffff',
                        fontFamily: isOpen && !confirmedWinner ? 'monospace' : 'inherit',
                        lineHeight: 1.12,
                        textShadow: confirmedWinner
                          ? '0 0 20px rgba(250, 204, 21, 0.55)'
                          : isOpen
                            ? '0 0 20px rgba(56, 189, 248, 0.6)'
                            : '0 2px 12px rgba(0,0,0,0.55)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                    >
                      {confirmedWinner
                        ? `🏆 #${confirmedWinner.ticketNo} ${confirmedWinner.memberName}`
                        : isOpen
                          ? `⏱ ${mins}:${secs}`
                          : (
                            <>
                              <span className="material-icons-outlined" style={{ fontSize: '23px', color: '#fde047' }}>calendar_today</span>
                              <span>{emptyCenterLabel ?? 'Waiting to Open'}</span>
                            </>
                          )}
                    </div>

                    {confirmedWinner && (
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#4ade80', marginTop: '4px' }}>
                        Prize: {formatCurrency(confirmedWinner.prizeAmount, currencySymbol)}
                      </div>
                    )}

                    <div style={{ fontSize: '0.98rem', color: '#e2e8f0', fontWeight: 700, marginTop: '5px' }}>
                      Pot:{' '}
                      <span style={{ color: '#fef08a', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(Number(chitValue), currencySymbol)}
                      </span>
                    </div>
                  </div>

                  <svg
                    width="30"
                    height="46"
                    viewBox="0 0 24 36"
                    fill="none"
                    aria-hidden="true"
                    style={{ flexShrink: 0, transform: 'scaleX(-1)', filter: 'drop-shadow(0 0 7px rgba(250, 204, 21, 0.65))' }}
                  >
                    <path d="M18 33C9 27 6 15 11 4" stroke="#facc15" strokeWidth="1.8" strokeLinecap="round" />
                    <ellipse cx="7" cy="24" rx="4.4" ry="2.2" transform="rotate(-35 7 24)" fill="#fde047" />
                    <ellipse cx="6" cy="17" rx="4.4" ry="2.2" transform="rotate(-20 6 17)" fill="#fef08a" />
                    <ellipse cx="8" cy="10" rx="4.1" ry="2.1" transform="rotate(10 8 10)" fill="#facc15" />
                    <ellipse cx="13" cy="29" rx="3.9" ry="2.0" transform="rotate(-55 13 29)" fill="#eab308" />
                  </svg>
                </div>

                {hideBidAmounts ? (
                  <div style={{ fontSize: '0.84rem', color: '#38bdf8', fontWeight: 800, marginTop: '6px' }}>
                    {bidCount} sealed bid(s)
                  </div>
                ) : (
                  highestBid &&
                  leaderPrize != null && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.94rem',
                        color: '#fef08a',
                        fontWeight: 900,
                        marginTop: '7px',
                        padding: '7px 18px',
                        borderRadius: '999px',
                        background:
                          'linear-gradient(90deg, rgba(234, 179, 8, 0.24) 0%, rgba(245, 158, 11, 0.16) 50%, rgba(234, 179, 8, 0.24) 100%)',
                        border: '1.5px solid rgba(253, 224, 71, 0.82)',
                        boxShadow: '0 0 22px rgba(245, 158, 11, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      🏆 #{highestBid.ticketNo} {highestBid.memberName || ''} · {formatCurrency(leaderPrize, currencySymbol)}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Interleaved Seats Aligned Around the Outer Table Rail (Max 20; won seats excluded cleanly) */}
          {seats.length > 0 && tableSeats.map((seat, idx) => {
            const { left, top } = computeTableEdgeCoords(idx, total);
            const isSelected = Boolean(selectedMemberId && selectedMemberId === seat.memberId);
            const firstName = seat.name?.split(' ')[0] ?? 'Member';

            return (
              <div
                key={seat.memberId}
                onClick={onSelectSeat ? () => onSelectSeat(seat) : undefined}
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  top: `${top}%`,
                  transform: isSelected ? 'translate(-50%, -50%) scale(1.08)' : 'translate(-50%, -50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: onSelectSeat ? 'pointer' : 'default',
                  zIndex: seat.isLeader ? 26 : isSelected ? 25 : 20,
                  opacity: seat.isPaused && !seat.isLeader ? 0.78 : 1,
                  transition: 'transform 0.16s ease, opacity 0.16s ease',
                }}
                title={`${seat.name}${seat.ticketLabel ? ` (Tickets ${seat.ticketLabel})` : ''}${seat.hasWon ? ' (Won)' : seat.isPaused ? ' (Leading — waiting for next turn)' : seat.isOnline ? ' (Online)' : ' (Offline)'}`}
              >
                {/* Gold Leader Chip Bubble */}
                {seat.isLeader && leaderPrize != null && !hideBidAmounts && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginBottom: '6px',
                      padding: '3px 10px',
                      background: 'linear-gradient(180deg, #fde047 0%, #eab308 100%)',
                      color: '#0f172a',
                      fontWeight: 800,
                      fontSize: '0.74rem',
                      borderRadius: '999px',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 14px rgba(234,179,8,0.65)',
                      zIndex: 30,
                    }}
                  >
                    {formatCurrency(leaderPrize, currencySymbol)}
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 0,
                        height: 0,
                        borderLeft: '5px solid transparent',
                        borderRight: '5px solid transparent',
                        borderTop: '5px solid #eab308',
                      }}
                    />
                  </div>
                )}

                {/* 3D Glossy Metallic Avatar Circle */}
                <div
                  style={{
                    position: 'relative',
                    width: `${avatarPx}px`,
                    height: `${avatarPx}px`,
                    borderRadius: '50%',
                    border: seat.isLeader
                      ? '3px solid #fde047'
                      : seat.isPaused
                        ? '2.5px solid #f59e0b'
                        : seat.isMe
                          ? '3px solid #a855f7'
                          : seat.isOnline
                            ? '2.5px solid #86efac'
                            : '2px solid rgba(255,255,255,0.72)',
                    background: seat.isLeader
                      ? 'radial-gradient(circle at 32% 28%, #facc15 0%, #a16207 58%, #422006 100%)'
                      : seat.hasWon
                        ? 'radial-gradient(circle at 32% 28%, #10b981 0%, #047857 60%, #064e3b 100%)'
                        : seat.isOnline
                          ? 'radial-gradient(circle at 32% 28%, #22c55e 0%, #059669 58%, #064e3b 100%)'
                          : 'radial-gradient(circle at 32% 28%, #3c4d66 0%, #1e293b 58%, #0f172a 100%)',
                    boxShadow: isSelected
                      ? '0 0 0 3px #38bdf8, 0 0 22px rgba(56,189,248,0.85)'
                      : seat.isLeader
                        ? '0 0 28px rgba(250, 204, 21, 0.92), 0 6px 14px rgba(0,0,0,0.48)'
                        : seat.isOnline
                          ? '0 0 18px rgba(34, 197, 94, 0.55), 0 6px 14px rgba(0,0,0,0.4)'
                          : '0 6px 14px rgba(15, 23, 42, 0.36), inset 0 1px 2px rgba(255, 255, 255, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {seat.photoUrl && !failedPhotoUrls[seat.photoUrl] ? (
                    <img
                      src={seat.photoUrl}
                      alt={seat.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={() =>
                        setFailedPhotoUrls((prev) =>
                          seat.photoUrl && !prev[seat.photoUrl] ? { ...prev, [seat.photoUrl]: true } : prev,
                        )
                      }
                    />
                  ) : (
                    <span style={{ fontSize: isUltraDense ? '0.96rem' : isDense ? '1.05rem' : '1.16rem', fontWeight: 800, color: '#ffffff' }}>
                      {seat.name?.[0]?.toUpperCase() ?? 'M'}
                    </span>
                  )}
                </div>

                {seat.ticketCount && seat.ticketCount > 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      left: '-6px',
                      background: '#0ea5e9',
                      color: '#fff',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: '999px',
                      border: '1px solid #0f172a',
                      zIndex: 27,
                    }}
                  >
                    ×{seat.ticketCount}
                  </div>
                )}

                {seat.isLeader ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-5px',
                      right: '-5px',
                      background: 'linear-gradient(135deg, #fde047, #eab308)',
                      color: '#0f172a',
                      fontSize: '0.64rem',
                      fontWeight: 900,
                      width: '19px',
                      height: '19px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1.5px solid #ffffff',
                      boxShadow: '0 2px 8px rgba(234, 179, 8, 0.7)',
                      zIndex: 28,
                    }}
                  >
                    👑
                  </div>
                ) : seat.isOnline && !seat.hasWon ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      background: '#22c55e',
                      color: '#ffffff',
                      fontSize: '0.62rem',
                      fontWeight: 900,
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1.5px solid #ffffff',
                      boxShadow: '0 2px 6px rgba(34, 197, 94, 0.55)',
                      zIndex: 27,
                    }}
                  >
                    ✓
                  </div>
                ) : null}

                {seat.hasWon ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-3px',
                      right: '-4px',
                      background: '#16a34a',
                      color: '#fff',
                      fontSize: '0.58rem',
                      fontWeight: 800,
                      padding: '1px 4px',
                      borderRadius: '999px',
                      border: '1px solid #0f172a',
                      zIndex: 26,
                    }}
                  >
                    ✓
                  </div>
                ) : seat.isPaused && !seat.isLeader ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-5px',
                      background: '#f59e0b',
                      color: '#0f172a',
                      fontSize: '0.58rem',
                      fontWeight: 800,
                      padding: '1px 4px',
                      borderRadius: '999px',
                      border: '1px solid #0f172a',
                      zIndex: 26,
                    }}
                  >
                    ⏳
                  </div>
                ) : null}

                {/* Seat Ticket & First Name Badge */}
                <div
                  style={{
                    marginTop: '3px',
                    padding: '2px 8px',
                    backgroundColor: isSelected
                      ? 'rgba(14, 165, 233, 0.94)'
                      : seat.isMe
                        ? 'rgba(107, 33, 168, 0.92)'
                        : seat.isLeader
                          ? 'rgba(28, 22, 10, 0.94)'
                          : 'rgba(15, 23, 42, 0.92)',
                    borderRadius: '9px',
                    border: seat.isLeader
                      ? '1.5px solid #eab308'
                      : isSelected
                        ? '1px solid #bae6fd'
                        : '1px solid rgba(255,255,255,0.22)',
                    boxShadow: seat.isLeader ? '0 0 14px rgba(234, 179, 8, 0.45)' : '0 3px 8px rgba(0,0,0,0.35)',
                    textAlign: 'center',
                    maxWidth: isUltraDense ? '84px' : isDense ? '92px' : '104px',
                  }}
                >
                  <div
                    style={{
                      fontSize: isUltraDense ? '0.63rem' : isDense ? '0.67rem' : '0.73rem',
                      color: '#ffffff',
                      fontWeight: 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {seat.ticketNo}. {firstName}
                  </div>
                  {seat.latestPrize != null && !hideBidAmounts && (
                    <div
                      style={{
                        fontSize: isUltraDense ? '0.6rem' : '0.66rem',
                        color: isSelected ? '#ffffff' : seat.isLeader ? '#fde047' : '#38bdf8',
                        fontWeight: 800,
                      }}
                    >
                      {formatCurrency(seat.latestPrize, currencySymbol)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Side Bench Panel (shown only when total seats exceed 20; bids promote member to main table) */}
        {hasBench && (
          <aside
            style={{
              background: 'rgba(15, 23, 42, 0.88)',
              border: '1px solid rgba(255,255,255,0.16)',
              borderRadius: '14px',
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '420px',
              alignSelf: 'stretch',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
              <strong style={{ fontSize: '0.78rem', color: '#f8fafc' }}>
                🪑 Bench ({benchSeats.length})
              </strong>
              <span style={{ fontSize: '0.64rem', color: '#94a3b8', fontWeight: 600 }}>
                Bid → enters table
              </span>
            </div>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px', paddingRight: '2px' }}>
              {benchSeats.map((seat) => {
                const isSelected = Boolean(selectedMemberId && selectedMemberId === seat.memberId);
                return (
                  <button
                    key={seat.memberId}
                    type="button"
                    onClick={onSelectSeat ? () => onSelectSeat(seat) : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '7px',
                      padding: '6px 8px',
                      borderRadius: '9px',
                      border: isSelected
                        ? '1.5px solid #38bdf8'
                        : seat.isMe
                          ? '1px solid #a855f7'
                          : '1px solid rgba(255,255,255,0.12)',
                      background: isSelected ? 'rgba(14, 165, 233, 0.22)' : 'rgba(30, 41, 59, 0.85)',
                      color: '#f8fafc',
                      cursor: onSelectSeat ? 'pointer' : 'default',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          flexShrink: 0,
                          backgroundColor: seat.isOnline ? '#22c55e' : '#64748b',
                        }}
                      />
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        #{seat.ticketNo} {seat.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      {seat.ticketCount && seat.ticketCount > 1 && (
                        <span
                          style={{
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: '999px',
                            background: '#0ea5e9',
                            color: '#fff',
                          }}
                        >
                          ×{seat.ticketCount}
                        </span>
                      )}
                      {seat.hasWon && (
                        <span style={{ fontSize: '0.68rem', color: '#4ade80', fontWeight: 800 }}>✓</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
