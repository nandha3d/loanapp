'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { PokerTableArena, type PokerTableSeat } from '@/components/chits/PokerTableArena';

export interface LotteryTicketCandidate {
  memberId: string;
  ticketNo: string;
  name: string;
  hasWon?: boolean;
  isOnline?: boolean;
  photoUrl?: string | null;
}

interface DrawWinnerResult {
  memberId?: string | null;
  ticketNo?: string | null;
  name?: string | null;
  prizeAmount?: number | null;
}

interface Props {
  periodNumber: number;
  chitValue: number;
  currencySymbol: string;
  scheduledLabel?: string | null;
  candidates: LotteryTicketCandidate[];
  allSeats: PokerTableSeat[];
  winner?: DrawWinnerResult | null;
  locked: boolean;
  busy: boolean;
  canManage: boolean;
  dict?: { chits?: Record<string, unknown> };
  onTriggerDraw: () => Promise<DrawWinnerResult | null>;
  onOpenSchedule?: () => void;
}

export default function LotteryDrawStage({
  periodNumber,
  chitValue,
  currencySymbol,
  scheduledLabel,
  candidates,
  allSeats,
  winner,
  locked,
  busy,
  canManage,
  dict,
  onTriggerDraw,
  onOpenSchedule,
}: Props) {
  const dc = (dict?.chits || {}) as Record<string, string>;
  const eligible = useMemo(() => candidates.filter((c) => !c.hasWon), [candidates]);
  const [spinning, setSpinning] = useState(false);
  const [slotIdx, setSlotIdx] = useState(0);
  const [landedWinner, setLandedWinner] = useState<DrawWinnerResult | null>(winner ?? null);
  const [showCircle, setShowCircle] = useState(false);
  const spinTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) clearInterval(spinTimerRef.current);
    };
  }, []);

  const handleSpinAndDraw = async () => {
    if (spinning || busy || locked || eligible.length === 0) return;
    setSpinning(true);
    setLandedWinner(null);
    let step = 0;
    if (spinTimerRef.current) clearInterval(spinTimerRef.current);
    spinTimerRef.current = setInterval(() => {
      step += 1;
      setSlotIdx(step % Math.max(1, eligible.length));
    }, 90);

    try {
      const [result] = await Promise.all([
        onTriggerDraw(),
        new Promise((resolve) => setTimeout(resolve, 1450)),
      ]);
      if (spinTimerRef.current) {
        clearInterval(spinTimerRef.current);
        spinTimerRef.current = null;
      }
      if (result) {
        setLandedWinner(result);
        const winIdx = eligible.findIndex(
          (e) =>
            (result.memberId && e.memberId === result.memberId) ||
            (result.ticketNo && e.ticketNo === result.ticketNo),
        );
        if (winIdx >= 0) setSlotIdx(winIdx);
      }
    } finally {
      if (spinTimerRef.current) {
        clearInterval(spinTimerRef.current);
        spinTimerRef.current = null;
      }
      setSpinning(false);
    }
  };

  const windowItem = (offset: number) => {
    if (eligible.length === 0) return null;
    const idx = (slotIdx + offset + eligible.length) % eligible.length;
    return eligible[idx];
  };

  const activeWinner = landedWinner ?? winner ?? null;

  return (
    <section className="chit-room-stage-card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '0 4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '1.02rem', color: 'var(--text)' }}>
            🎲 {dc.lotterySlotTitle || 'Lucky Draw Slot Drum'} — Period {periodNumber}
          </strong>
          <span className="badge badge-info">
            {(dc.lotterySlotEligibleCount || '{count} eligible tickets in drum').replace(
              '{count}',
              String(eligible.length),
            )}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {scheduledLabel && (
            <span className="badge badge-secondary">📅 {scheduledLabel}</span>
          )}
          {onOpenSchedule && !locked && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenSchedule}>
              📅 {dc.scheduleRescheduleBtn || 'Schedule / Time'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowCircle((v) => !v)}
          >
            {showCircle ? '🎰 Show Slot Drum' : '👥 Member Circle'}
          </button>
        </div>
      </div>

      {showCircle ? (
        <PokerTableArena
          periodNumber={periodNumber}
          chitValue={chitValue}
          currencySymbol={currencySymbol}
          roomStatus={locked ? 'closed' : 'open'}
          isOpen={!locked}
          auctionStatus={locked ? 'confirmed' : 'in_progress'}
          hideBidAmounts
          seats={allSeats}
          emptyCenterLabel={`Pot ${formatCurrency(chitValue, currencySymbol)}`}
        />
      ) : (
        <div
          style={{
            borderRadius: '18px',
            padding: '24px 20px',
            background: 'linear-gradient(155deg, var(--primary-dark) 0%, #1e293b 55%, var(--primary-dark) 100%)',
            border: '1.5px solid var(--primary-border)',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '18px',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '1.1px', opacity: 0.85, fontWeight: 700 }}>
              Token Draw Pool · Period {periodNumber}
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '4px' }}>
              {formatCurrency(chitValue, currencySymbol)}
            </div>
          </div>

          {activeWinner ? (
            <div
              style={{
                width: '100%',
                maxWidth: '520px',
                padding: '20px 22px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.14)',
                border: '1.5px solid rgba(255, 255, 255, 0.35)',
                textAlign: 'center',
                boxShadow: '0 14px 32px rgba(0,0,0,0.28)',
              }}
            >
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#bbf7d0', textTransform: 'uppercase', letterSpacing: '0.9px' }}>
                🏆 Selected Lucky Winner
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '6px', color: '#ffffff' }}>
                #{activeWinner.ticketNo || '—'} · {activeWinner.name || 'Winner'}
              </div>
              {activeWinner.prizeAmount != null && activeWinner.prizeAmount > 0 && (
                <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '6px', color: '#fde68a' }}>
                  Prize: {formatCurrency(Number(activeWinner.prizeAmount), currencySymbol)}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                width: '100%',
                maxWidth: '560px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '10px',
                padding: '12px',
                borderRadius: '16px',
                background: 'rgba(15, 23, 42, 0.48)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
              }}
            >
              {[-1, 0, 1].map((offset) => {
                const candidate = windowItem(offset);
                const isCenter = offset === 0;
                return (
                  <div
                    key={offset}
                    style={{
                      padding: '14px 10px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      background: isCenter ? 'var(--surface)' : 'rgba(255, 255, 255, 0.08)',
                      color: isCenter ? 'var(--primary-dark)' : 'rgba(255, 255, 255, 0.72)',
                      border: isCenter ? '2px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.12)',
                      transform: isCenter ? 'scale(1.04)' : 'scale(0.96)',
                      transition: 'transform 0.12s ease',
                    }}
                  >
                    <div style={{ fontSize: isCenter ? '1.35rem' : '1rem', fontWeight: 800 }}>
                      #{candidate?.ticketNo ?? '—'}
                    </div>
                    <div
                      style={{
                        fontSize: isCenter ? '0.9rem' : '0.78rem',
                        fontWeight: 700,
                        marginTop: '4px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {candidate?.name ?? 'Waiting'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!locked && !activeWinner && canManage && (
            <button
              type="button"
              disabled={spinning || busy || eligible.length === 0}
              onClick={() => void handleSpinAndDraw()}
              className="btn btn-primary"
              style={{
                padding: '12px 26px',
                fontSize: '1.02rem',
                fontWeight: 800,
                borderRadius: '999px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
              }}
            >
              {spinning || busy
                ? `🎡 ${dc.lotterySlotSpinning || 'Drawing Lucky Ticket…'}`
                : `🎲 ${dc.lotterySlotSpinBtn || 'Spin & Draw Lucky Winner'}`}
            </button>
          )}
        </div>
      )}

      {/* Eligible Ticket Chips Strip */}
      <div className="chit-room-seat-rail">
        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginRight: '4px' }}>
          Tickets in Drum ({eligible.length}):
        </span>
        {candidates.map((c) => (
          <span
            key={c.memberId}
            className={`chit-room-seat-chip${c.hasWon ? ' chit-room-seat-chip--won' : ''}`}
            style={{ cursor: 'default' }}
          >
            <span style={{ fontWeight: 800 }}>#{c.ticketNo}</span>
            <span>{c.name.split(' ')[0]}</span>
            {c.hasWon ? <span style={{ fontSize: '0.68rem' }}>✓</span> : c.isOnline ? <span style={{ color: 'var(--success)', fontSize: '0.68rem' }}>●</span> : null}
          </span>
        ))}
      </div>
    </section>
  );
}
