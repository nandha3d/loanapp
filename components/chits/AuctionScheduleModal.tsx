'use client';

import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { manageChitAuctionScheduleAction } from '@/app/(dashboard)/[module]/chits/actions';

const emptySubscribe = () => () => {};

interface Props {
  open: boolean;
  onClose: () => void;
  auctionId: string;
  groupName: string;
  periodNumber: number;
  initialScheduledAt?: string | null;
  initialDurationMinutes?: number;
  initialAutoStart?: boolean;
  isBiddingRoom?: boolean;
  dict?: { chits?: Record<string, unknown> };
  onCompleted?: () => void;
}

function toDatetimeLocalValue(iso?: string | null): string {
  const dt = iso ? new Date(iso) : new Date(Date.now() + 15 * 60_000);
  if (Number.isNaN(dt.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export default function AuctionScheduleModal({
  open,
  onClose,
  auctionId,
  groupName,
  periodNumber,
  initialScheduledAt,
  initialDurationMinutes = 30,
  initialAutoStart = true,
  isBiddingRoom = true,
  dict,
  onCompleted,
}: Props) {
  const dc = (dict?.chits ?? {}) as Record<string, string>;
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [dateTimeVal, setDateTimeVal] = useState(() => toDatetimeLocalValue(initialScheduledAt));
  const [durationMinutes, setDurationMinutes] = useState(initialDurationMinutes);
  const [autoStart, setAutoStart] = useState(initialAutoStart);
  const [busy, setBusy] = useState<'schedule' | 'start_now' | null>(null);
  const [error, setError] = useState('');

  if (!open || !mounted) return null;

  const applyQuickSlot = (kind: '15m' | '1h' | 'tonight' | 'tomorrow') => {
    const dt = new Date();
    if (kind === '15m') {
      dt.setMinutes(dt.getMinutes() + 15);
    } else if (kind === '1h') {
      dt.setHours(dt.getHours() + 1);
    } else if (kind === 'tonight') {
      dt.setHours(19, 30, 0, 0);
      if (dt.getTime() < Date.now()) dt.setDate(dt.getDate() + 1);
    } else {
      dt.setDate(dt.getDate() + 1);
      dt.setHours(19, 30, 0, 0);
    }
    setDateTimeVal(toDatetimeLocalValue(dt.toISOString()));
  };

  const handleAction = async (mode: 'schedule' | 'start_now') => {
    setBusy(mode);
    setError('');
    try {
      const scheduledAtIso =
        mode === 'schedule' ? new Date(dateTimeVal).toISOString() : undefined;
      const res = await manageChitAuctionScheduleAction(auctionId, {
        mode,
        scheduledAtIso,
        durationMinutes: isBiddingRoom ? durationMinutes : undefined,
        autoStart: isBiddingRoom ? autoStart : undefined,
      });
      if (res && typeof res === 'object' && 'ok' in res && res.ok === false) {
        setError(res.error || 'Could not update auction schedule');
        setBusy(null);
        return;
      }
      window.dispatchEvent(new CustomEvent('zolofund:chit-auction-updated'));
      onCompleted?.();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not update auction schedule');
    } finally {
      setBusy(null);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.56)',
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '490px',
          maxWidth: '100%',
          background: 'var(--surface)',
          borderRadius: '18px',
          border: '1.5px solid var(--border)',
          boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.32)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '15px 20px',
            background: 'linear-gradient(120deg, var(--primary-dark), var(--primary))',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: '#fff' }}>
              📅 {isBiddingRoom ? dc.scheduleModalTitle || 'Schedule or Override Auction' : dc.scheduleDrawModalTitle || 'Schedule or Start Lucky Draw'}
            </h3>
            <div style={{ fontSize: '0.78rem', opacity: 0.9, marginTop: '2px' }}>
              {groupName} · Period {periodNumber}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
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

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {dc.scheduleModalSubtitle || 'Set a meeting time like Zoom/Meet, or override and start the room right now.'}
          </p>

          {error && (
            <div
              style={{
                padding: '9px 12px',
                borderRadius: '10px',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger)',
                color: 'var(--danger)',
                fontSize: '0.84rem',
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyQuickSlot('15m')}>
              {dc.scheduleQuick15m || 'In 15 min'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyQuickSlot('1h')}>
              {dc.scheduleQuick1h || 'In 1 hour'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyQuickSlot('tonight')}>
              {dc.scheduleQuickTonight || 'Today 7:30 PM'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyQuickSlot('tomorrow')}>
              {dc.scheduleQuickTomorrow || 'Tomorrow 7:30 PM'}
            </button>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>
              {dc.scheduleDateTimeLabel || 'Auction Date & Start Time'}
            </label>
            <input
              type="datetime-local"
              className="form-control"
              value={dateTimeVal}
              onChange={(e) => setDateTimeVal(e.target.value)}
            />
          </div>

          {isBiddingRoom && (
            <>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>
                  {dc.scheduleDurationLabel || 'Room Duration (Minutes)'}
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {[15, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDurationMinutes(mins)}
                      className={`btn btn-sm ${durationMinutes === mins ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {mins} min
                    </button>
                  ))}
                  <input
                    type="number"
                    min={5}
                    max={240}
                    className="form-control"
                    style={{ width: '92px' }}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.max(5, Math.min(240, Number(e.target.value) || 30)))}
                  />
                </div>
              </div>

              <label className="checkbox-label" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={autoStart}
                  onChange={(e) => setAutoStart(e.target.checked)}
                />
                <span>{dc.scheduleAutoStartLabel || 'Auto-open live bidding room at scheduled time'}</span>
              </label>
            </>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              paddingTop: '10px',
              borderTop: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void handleAction('start_now')}
              className="btn btn-primary btn-sm"
            >
              ⚡ {busy === 'start_now' ? 'Starting…' : dc.scheduleOverrideStartBtn || 'Start Live Now (Override)'}
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                {dc.cancel || 'Cancel'}
              </button>
              <button
                type="button"
                disabled={busy !== null || !dateTimeVal}
                onClick={() => void handleAction('schedule')}
                className="btn btn-primary btn-sm"
              >
                {busy === 'schedule' ? 'Saving…' : dc.scheduleSaveBtn || 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
