'use client';

import { useEffect, useRef, useState } from 'react';
import { playWinnerConfirmedFanfare } from '@/lib/chits/bellAudio';

export interface WheelCandidate {
  memberId: string;
  ticketNo: string;
  name: string;
}

export interface SpinWinnerResult {
  memberId?: string | null;
  ticketNo?: string | null;
  name?: string | null;
  prizeAmount?: number | null;
}

/**
 * Resolves the winner's index inside a frozen spin candidate snapshot so mid-spin
 * server revalidation (`hasWon = true`) can never shift slice indices under the reel.
 */
export function resolveFrozenSpinWinnerIndex(
  snapshot: WheelCandidate[],
  winner: SpinWinnerResult,
): { candidates: WheelCandidate[]; winnerIndex: number } {
  const list = [...snapshot];
  const idxById = winner.memberId
    ? list.findIndex((c) => c.memberId === winner.memberId)
    : -1;
  if (idxById >= 0) {
    return { candidates: list, winnerIndex: idxById };
  }
  const idxByTicket = winner.ticketNo != null
    ? list.findIndex((c) => c.ticketNo === String(winner.ticketNo))
    : -1;
  if (idxByTicket >= 0) {
    return { candidates: list, winnerIndex: idxByTicket };
  }
  list.push({
    memberId: winner.memberId || `winner-${String(winner.ticketNo ?? 'x')}`,
    ticketNo: String(winner.ticketNo ?? '?'),
    name: String(winner.name ?? 'Winner'),
  });
  return { candidates: list, winnerIndex: list.length - 1 };
}

/**
 * Computes the cumulative clockwise CSS rotation angle (in degrees) that aligns
 * `winnerIndex`'s slice center directly beneath the top 12-o'clock pointer.
 */
export function computeWheelTargetAngle(
  winnerIndex: number,
  totalSlices: number,
  currentRotationDeg: number,
  extraSpins = 5,
): number {
  const safeTotal = Math.max(1, totalSlices);
  const safeIdx = ((winnerIndex % safeTotal) + safeTotal) % safeTotal;
  const sliceAngle = 360 / safeTotal;
  const centerDeg = (safeIdx + 0.5) * sliceAngle;
  const desiredMod = (360 - (centerDeg % 360)) % 360;
  const currentMod = ((currentRotationDeg % 360) + 360) % 360;
  const delta = (desiredMod - currentMod + 360) % 360;
  return currentRotationDeg + Math.max(1, extraSpins) * 360 + delta;
}

const STUDIO_WHEEL_PALETTE = [
  '#065f46',
  '#1e3a8a',
  '#92400e',
  '#0f766e',
  '#1e293b',
  '#15803d',
  '#0c4a6e',
  '#b45309',
];

function polarToSvg(cx: number, cy: number, r: number, clockDeg: number) {
  const rad = ((clockDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function buildSlicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const p1 = polarToSvg(cx, cy, r, startDeg);
  const p2 = polarToSvg(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`;
}

function playPegTickSound() {
  if (typeof window === 'undefined') return;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    const ctx = new Ctor();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.032);
    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.042);
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 90);
  } catch {
    // ignore Web Audio restriction errors
  }
}

interface FortuneWheelSpinnerProps {
  candidates: WheelCandidate[];
  modeLabel: string;
  prizeAmountLabel: string;
  spinButtonLabel?: string;
  fortuneWheelTabLabel?: string;
  slotRunnerTabLabel?: string;
  disabled?: boolean;
  onSpinStart?: () => void;
  onSpinRequest: () => Promise<SpinWinnerResult | null>;
  onLanded?: (winner: SpinWinnerResult) => void;
  onComplete?: (winner: SpinWinnerResult) => void;
}

export default function FortuneWheelSpinner({
  candidates,
  modeLabel,
  prizeAmountLabel,
  spinButtonLabel = 'Spin to Pick Winner',
  fortuneWheelTabLabel = 'Fortune Wheel',
  slotRunnerTabLabel = 'Slot Runner',
  disabled = false,
  onSpinStart,
  onSpinRequest,
  onLanded,
  onComplete,
}: FortuneWheelSpinnerProps) {
  const [viewMode, setViewMode] = useState<'wheel' | 'slot'>('wheel');
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'landed'>('idle');
  const [frozenCandidates, setFrozenCandidates] = useState<WheelCandidate[] | null>(null);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [slotIndex, setSlotIndex] = useState(0);
  const [landedWinner, setLandedWinner] = useState<SpinWinnerResult | null>(null);
  const [spinError, setSpinError] = useState('');

  const rafRef = useRef<number | null>(null);
  const rotationRef = useRef(0);
  const slotIndexRef = useRef(0);
  const activeSpinRef = useRef(false);

  useEffect(() => {
    return () => {
      activeSpinRef.current = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const displayCandidates = frozenCandidates ?? candidates;
  const count = displayCandidates.length;

  const handleSpin = async () => {
    if (disabled || phase === 'spinning' || candidates.length === 0) return;
    const baseSnapshot = [...candidates];
    setFrozenCandidates(baseSnapshot);
    setSpinError('');
    setLandedWinner(null);
    setPhase('spinning');
    activeSpinRef.current = true;
    onSpinStart?.();

    const startTime = performance.now();
    let pendingServerDone = false;
    let resolvedWinner: SpinWinnerResult | null = null;
    let serverErr: string | null = null;

    // Smooth pre-spin while server CSPRNG draw runs
    let preFrame = 0;
    const preSpinTick = () => {
      if (pendingServerDone || !activeSpinRef.current) return;
      rotationRef.current += 9;
      setRotationDeg(rotationRef.current);
      preFrame += 1;
      if (preFrame % 3 === 0) {
        const nextIdx = (slotIndexRef.current + 1) % baseSnapshot.length;
        slotIndexRef.current = nextIdx;
        setSlotIndex(nextIdx);
      }
      rafRef.current = requestAnimationFrame(preSpinTick);
    };
    rafRef.current = requestAnimationFrame(preSpinTick);

    try {
      resolvedWinner = await onSpinRequest();
    } catch (err: unknown) {
      serverErr = err instanceof Error ? err.message : 'Unable to resolve winner';
    }
    pendingServerDone = true;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    if (!activeSpinRef.current) return;

    if (serverErr || !resolvedWinner) {
      activeSpinRef.current = false;
      setFrozenCandidates(null);
      setPhase('idle');
      setSpinError(serverErr || 'Could not determine winner from server.');
      return;
    }

    const { candidates: workingList, winnerIndex: winnerIdx } = resolveFrozenSpinWinnerIndex(
      baseSnapshot,
      resolvedWinner,
    );
    setFrozenCandidates(workingList);

    const startRot = rotationRef.current;
    const targetRot = computeWheelTargetAngle(winnerIdx, workingList.length, startRot, 5);
    const startSlotIdx = slotIndexRef.current % workingList.length;
    const offsetToWinner = (winnerIdx - startSlotIdx + workingList.length) % workingList.length;
    const totalSlotSteps = 3 * workingList.length + offsetToWinner;
    const animDurationMs = Math.max(2400, 2900 - Math.min(400, performance.now() - startTime));
    const animStart = performance.now();
    const sliceDeg = 360 / Math.max(1, workingList.length);
    let lastTickSlice = Math.floor(startRot / sliceDeg);
    let lastTickSlotStep = 0;

    const finishSpin = () => {
      activeSpinRef.current = false;
      rotationRef.current = targetRot;
      slotIndexRef.current = winnerIdx;
      setRotationDeg(targetRot);
      setSlotIndex(winnerIdx);
      setPhase('landed');
      setLandedWinner(resolvedWinner);
      playWinnerConfirmedFanfare();
      if (resolvedWinner) onLanded?.(resolvedWinner);
    };

    const animateDecel = (now: number) => {
      if (!activeSpinRef.current) return;
      const elapsed = now - animStart;
      const progress = Math.min(1, elapsed / animDurationMs);
      const eased = 1 - Math.pow(1 - progress, 3);

      const currentDeg = startRot + (targetRot - startRot) * eased;
      rotationRef.current = currentDeg;
      setRotationDeg(currentDeg);

      const stepOffset = Math.min(totalSlotSteps, Math.floor(totalSlotSteps * eased));
      const nextSlot = (startSlotIdx + stepOffset) % workingList.length;
      if (slotIndexRef.current !== nextSlot) {
        slotIndexRef.current = nextSlot;
        setSlotIndex(nextSlot);
      }

      if (viewMode === 'wheel') {
        const currentSliceStep = Math.floor(currentDeg / sliceDeg);
        if (progress < 0.992 && currentSliceStep !== lastTickSlice) {
          lastTickSlice = currentSliceStep;
          playPegTickSound();
        }
      } else if (progress < 0.992 && stepOffset !== lastTickSlotStep) {
        lastTickSlotStep = stepOffset;
        playPegTickSound();
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animateDecel);
      } else {
        finishSpin();
      }
    };

    rafRef.current = requestAnimationFrame(animateDecel);
  };

  const safeSlotIdx = count > 0 ? Math.min(slotIndex, count - 1) : 0;
  const sliceAngle = 360 / Math.max(1, count);
  const prevIdx = count > 0 ? (safeSlotIdx - 1 + count) % count : 0;
  const nextIdx = count > 0 ? (safeSlotIdx + 1) % count : 0;
  const centerSlotDisplay =
    phase === 'landed' && landedWinner
      ? `#${landedWinner.ticketNo ?? '—'} · ${landedWinner.name || 'Winner'}`
      : `#${displayCandidates[safeSlotIdx]?.ticketNo ?? '—'} · ${displayCandidates[safeSlotIdx]?.name ?? ''}`;

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '18px',
        background: 'linear-gradient(180deg, #0c1526 0%, #15233b 100%)',
        border: '1.5px solid rgba(250, 204, 21, 0.34)',
        boxShadow: '0 18px 40px -16px rgba(8, 15, 28, 0.65), inset 0 1px 0 rgba(254, 240, 138, 0.14)',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      {/* Studio Stage Header & Wheel / Slot Mode Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.73rem', fontWeight: 800, color: '#fde047', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            ✦ {modeLabel}
          </div>
          <div style={{ fontSize: '0.84rem', color: '#cbd5e1', fontWeight: 600, marginTop: '2px' }}>
            {count} eligible seats · <strong style={{ color: '#ffffff' }}>{prizeAmountLabel}</strong>
          </div>
        </div>
        <div
          style={{
            display: 'inline-flex',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: '999px',
            padding: '3px',
            gap: '3px',
          }}
        >
          <button
            type="button"
            disabled={phase === 'spinning'}
            onClick={() => setViewMode('wheel')}
            style={{
              padding: '5px 12px',
              borderRadius: '999px',
              border: 'none',
              fontSize: '0.75rem',
              fontWeight: 800,
              cursor: phase === 'spinning' ? 'default' : 'pointer',
              background: viewMode === 'wheel' ? 'linear-gradient(180deg, var(--primary) 0%, var(--primary-dark) 100%)' : 'transparent',
              color: viewMode === 'wheel' ? '#ffffff' : '#94a3b8',
            }}
          >
            🎡 {fortuneWheelTabLabel}
          </button>
          <button
            type="button"
            disabled={phase === 'spinning'}
            onClick={() => setViewMode('slot')}
            style={{
              padding: '5px 12px',
              borderRadius: '999px',
              border: 'none',
              fontSize: '0.75rem',
              fontWeight: 800,
              cursor: phase === 'spinning' ? 'default' : 'pointer',
              background: viewMode === 'slot' ? 'linear-gradient(180deg, var(--primary) 0%, var(--primary-dark) 100%)' : 'transparent',
              color: viewMode === 'slot' ? '#ffffff' : '#94a3b8',
            }}
          >
            🎰 {slotRunnerTabLabel}
          </button>
        </div>
      </div>

      {/* Big Royal-Gold Fortune Wheel OR Studio 3D Slot Runner */}
      {viewMode === 'wheel' && count > 0 ? (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
          {/* Golden 12-O'Clock Top Marker Pin */}
          <div
            aria-hidden="true"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: '-14px',
              zIndex: 5,
            }}
          >
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '999px',
                background: '#fef08a',
                border: '2px solid #92400e',
                boxShadow: '0 0 12px rgba(250, 204, 21, 0.85)',
                marginBottom: '-4px',
              }}
            />
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: '12px solid transparent',
                borderRight: '12px solid transparent',
                borderTop: '22px solid #facc15',
                filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.55))',
              }}
            />
          </div>

          <div
            style={{
              position: 'relative',
              width: 'min(340px, 100%)',
              aspectRatio: '1 / 1',
              borderRadius: '50%',
              padding: '6px',
              background: 'linear-gradient(135deg, #fef08a 0%, #eab308 32%, #92400e 58%, #fde047 85%, #ca8a04 100%)',
              boxShadow: '0 0 38px rgba(250, 204, 21, 0.34), 0 18px 36px rgba(0, 0, 0, 0.65)',
            }}
          >
            <svg
              viewBox="0 0 360 360"
              width="340"
              height="340"
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: '#0b1120',
              }}
            >
              <g style={{ transform: `rotate(${rotationDeg}deg)`, transformOrigin: '180px 180px' }}>
                {displayCandidates.map((cand, idx) => {
                  const startDeg = idx * sliceAngle;
                  const endDeg = (idx + 1) * sliceAngle;
                  const midDeg = startDeg + sliceAngle / 2;
                  const fill = STUDIO_WHEEL_PALETTE[idx % STUDIO_WHEEL_PALETTE.length];
                  const labelRadius = count > 14 ? 114 : 108;
                  const labelPos = polarToSvg(180, 180, labelRadius, midDeg);
                  const shortName = cand.name.split(/\s+/)[0]?.slice(0, count > 14 ? 9 : 11) || `#${cand.ticketNo}`;
                  return (
                    <g key={cand.memberId}>
                      <path
                        d={count === 1 ? 'M 180 18 A 162 162 0 1 1 179.9 18 Z' : buildSlicePath(180, 180, 162, startDeg, endDeg)}
                        fill={fill}
                        stroke="rgba(254, 240, 138, 0.68)"
                        strokeWidth="1.5"
                      />
                      <text
                        x={labelPos.x}
                        y={labelPos.y}
                        fill="#ffffff"
                        fontSize={count > 16 ? '10.2' : count > 10 ? '11.4' : '12.8'}
                        fontWeight="800"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${midDeg - 90}, ${labelPos.x}, ${labelPos.y})`}
                      >
                        #{cand.ticketNo} {shortName}
                      </text>
                    </g>
                  );
                })}
                {/* Inner Ring & Golden Rim Studs */}
                <circle cx="180" cy="180" r="162" fill="none" stroke="rgba(254, 240, 138, 0.9)" strokeWidth="3" />
                {Array.from({ length: 24 }, (_, idx) => {
                  const stud = polarToSvg(180, 180, 170, idx * 15);
                  return (
                    <circle
                      key={idx}
                      cx={stud.x}
                      cy={stud.y}
                      r="3"
                      fill={idx % 2 === 0 ? '#fef08a' : '#ffffff'}
                      opacity="0.92"
                    />
                  );
                })}
              </g>
              {/* Obsidian-Gold Center Hub */}
              <circle cx="180" cy="180" r="34" fill="#0f1b2e" stroke="#facc15" strokeWidth="3.5" />
              <text x="180" y="182" textAnchor="middle" dominantBaseline="middle" fontSize="22">
                {phase === 'landed' ? '🏆' : '🎯'}
              </text>
            </svg>
          </div>

          {phase === 'spinning' && displayCandidates[safeSlotIdx] && (
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fde047' }}>
              Spinning: #{displayCandidates[safeSlotIdx].ticketNo} · {displayCandidates[safeSlotIdx].name}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            background: '#0b1120',
            border: '1.5px solid rgba(250, 204, 21, 0.35)',
            borderRadius: '14px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: 'inset 0 4px 16px rgba(0, 0, 0, 0.65)',
          }}
        >
          {count > 0 && (
            <>
              <div style={{ opacity: 0.45, fontSize: '0.84rem', fontWeight: 600, textAlign: 'center', color: '#94a3b8' }}>
                #{displayCandidates[prevIdx]?.ticketNo} · {displayCandidates[prevIdx]?.name}
              </div>
              <div
                style={{
                  minHeight: '56px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background:
                    phase === 'landed'
                      ? 'linear-gradient(135deg, rgba(22, 163, 74, 0.25) 0%, rgba(250, 204, 21, 0.22) 100%)'
                      : 'linear-gradient(135deg, rgba(30, 58, 138, 0.38) 0%, rgba(15, 23, 42, 0.92) 100%)',
                  border: `1.5px solid ${phase === 'landed' ? '#facc15' : 'var(--primary)'}`,
                  boxShadow:
                    phase === 'landed'
                      ? '0 0 24px -4px rgba(250, 204, 21, 0.45)'
                      : '0 0 18px -6px var(--primary-glow)',
                  textAlign: 'center',
                  fontSize: '1.12rem',
                  fontWeight: 900,
                  color: phase === 'landed' ? '#fef08a' : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <span>{phase === 'landed' ? '🏆' : '🎰'}</span>
                <span>{centerSlotDisplay}</span>
              </div>
              <div style={{ opacity: 0.45, fontSize: '0.84rem', fontWeight: 600, textAlign: 'center', color: '#94a3b8' }}>
                #{displayCandidates[nextIdx]?.ticketNo} · {displayCandidates[nextIdx]?.name}
              </div>
            </>
          )}
        </div>
      )}

      {spinError && (
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fca5a5', background: 'rgba(220,38,38,0.2)', padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(248,113,113,0.4)' }}>
          {spinError}
        </div>
      )}

      {phase === 'landed' && landedWinner ? (
        <div
          style={{
            padding: '13px 15px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.22) 0%, rgba(234, 179, 8, 0.14) 100%)',
            border: '1.5px solid rgba(250, 204, 21, 0.55)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fde047', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🏆 Winner Confirmed &amp; Announced
            </div>
            <div style={{ fontSize: '1.08rem', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>
              #{landedWinner.ticketNo ?? '—'} · {landedWinner.name || 'Winner'}
            </div>
          </div>
          {onComplete && (
            <button
              type="button"
              onClick={() => onComplete(landedWinner)}
              style={{
                minHeight: '42px',
                padding: '0 18px',
                borderRadius: '11px',
                border: 'none',
                background: 'linear-gradient(180deg, var(--primary) 0%, var(--primary-dark) 100%)',
                boxShadow: '0 8px 18px -4px var(--primary-glow), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
                color: '#ffffff',
                fontSize: '0.88rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Continue to Security &amp; Payout</span>
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || phase === 'spinning' || count === 0}
          onClick={handleSpin}
          style={{
            width: '100%',
            minHeight: '48px',
            padding: '0 18px',
            borderRadius: '13px',
            border: 'none',
            background: 'linear-gradient(180deg, var(--primary) 0%, var(--primary-dark) 100%)',
            boxShadow: '0 10px 22px -6px var(--primary-glow), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
            color: '#ffffff',
            fontSize: '0.98rem',
            fontWeight: 800,
            cursor: disabled || phase === 'spinning' || count === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            gap: '8px',
          }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '20px' }}>casino</span>
          <span>{phase === 'spinning' ? 'Spinning & Recording Draw…' : spinButtonLabel}</span>
          <span className="material-icons-outlined" style={{ fontSize: '20px', position: 'absolute', right: '16px' }}>arrow_forward</span>
        </button>
      )}
    </div>
  );
}
