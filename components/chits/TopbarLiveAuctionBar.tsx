'use client';

import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import DashboardLink from '@/components/layout/DashboardLink';
import {
  getChitTopbarTickerAction,
  manageChitAuctionScheduleAction,
} from '@/app/(dashboard)/[module]/chits/actions';
import AuctionScheduleModal from '@/components/chits/AuctionScheduleModal';
import type { ChitLiveTickerItem, ChitLiveTickerPayload } from '@/lib/chits/liveTicker';
import { formatCurrency } from '@/lib/utils';

const emptySubscribe = () => () => {};

interface Props {
  mode: 'staff' | 'borrower';
  canConductAuction?: boolean;
  dict?: { chits?: Record<string, unknown> };
}

function formatCountdownShort(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const remSec = s % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins >= 10) return `${mins}m`;
  return `${mins}:${String(remSec).padStart(2, '0')}`;
}

function buildSnippetText(
  item: ChitLiveTickerItem,
  currencySymbol: string,
  dc: Record<string, string>,
): string {
  if (item.roomMode === 'LOTTERY_DRAW') {
    return (dc.liveTopbarDrawSnippet || 'Lucky draw ready · Pot {amount}').replace(
      '{amount}',
      formatCurrency(item.chitValue, currencySymbol),
    );
  }
  if (item.roomMode === 'SEALED_TENDER' && item.roomStatus !== 'closed') {
    return dc.liveTopbarSealedSnippet || 'Sealed tender window open';
  }
  if (item.bellSupported && item.bellsRung > 0) {
    if (item.highestBid) {
      return (dc.liveTopbarBellSnippet || 'Bell {rung}/{total} · Leading {amount}')
        .replace('{rung}', String(item.bellsRung))
        .replace('{total}', String(item.bellCount))
        .replace('{amount}', formatCurrency(item.highestBid.prizeAmount, currencySymbol));
    }
    return (dc.liveTopbarNoBidBellSnippet || 'Bell {rung}/{total} · Closing soon')
      .replace('{rung}', String(item.bellsRung))
      .replace('{total}', String(item.bellCount));
  }
  if (item.highestBid) {
    return (dc.liveTopbarBidSnippet || '{name} bid {amount}')
      .replace('{name}', item.highestBid.memberName)
      .replace('{amount}', formatCurrency(item.highestBid.prizeAmount, currencySymbol));
  }
  return (dc.liveTopbarFloorSnippet || 'Room open · Floor {amount}').replace(
    '{amount}',
    formatCurrency(item.startingPrize, currencySymbol),
  );
}

export default function TopbarLiveAuctionBar({
  mode,
  canConductAuction = false,
  dict,
}: Props) {
  const dc = useMemo(() => (dict?.chits ?? {}) as Record<string, string>, [dict]);
  const pathname = usePathname() || '';
  const router = useRouter();
  const [payload, setPayload] = useState<ChitLiveTickerPayload | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 64, left: 16 });
  const [scheduleTarget, setScheduleTarget] = useState<ChitLiveTickerItem | null>(null);
  const [toastItem, setToastItem] = useState<{ item: ChitLiveTickerItem; snippet: string } | null>(null);
  const [busyId, setBusyId] = useState<string>('');
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const anchorRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const seenKeysRef = useRef<Map<string, string>>(new Map());
  const seededInitialRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const roomHrefFor = useCallback(
    (item: ChitLiveTickerItem) =>
      mode === 'borrower'
        ? `/borrower/chits/${item.chitGroupId}/auctions/${item.auctionId}`
        : `/chits/${item.chitGroupId}/auctions/${item.auctionId}`,
    [mode],
  );

  const fetchTicker = useCallback(async () => {
    try {
      let next: ChitLiveTickerPayload | null = null;
      if (mode === 'borrower') {
        const res = await fetch('/api/borrower/chits/live-ticker', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          next = data?.ticker ?? null;
        }
      } else {
        const res = await getChitTopbarTickerAction();
        if (res && res.ok !== false) {
          next = res.ticker ?? null;
        }
      }
      if (!next) return;
      setPayload(next);

      const sym = next.currencySymbol || '₹';
      const externalLive = next.liveAuctions.filter((a) => !pathname.includes(`/auctions/${a.auctionId}`));
      if (!seededInitialRef.current) {
        seededInitialRef.current = true;
        for (const item of next.liveAuctions) {
          seenKeysRef.current.set(item.auctionId, item.latestEventKey);
        }
      } else {
        let newestChanged: ChitLiveTickerItem | null = null;
        for (const item of externalLive) {
          const prevKey = seenKeysRef.current.get(item.auctionId);
          if (prevKey !== item.latestEventKey) {
            seenKeysRef.current.set(item.auctionId, item.latestEventKey);
            newestChanged = item;
          }
        }
        if (newestChanged) {
          const snippet = buildSnippetText(newestChanged, sym, dc);
          setToastItem({ item: newestChanged, snippet });
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => setToastItem(null), 6000);
        }
      }
    } catch {
      // Transient poll errors never disturb navigation.
    }
  }, [dc, mode, pathname]);

  useEffect(() => {
    const boot = setTimeout(() => {
      void fetchTicker();
    }, 0);
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void fetchTicker();
    }, 5000);
    const onRefresh = () => void fetchTicker();
    window.addEventListener('active-branch-changed', onRefresh);
    window.addEventListener('zolofund:chit-auction-updated', onRefresh);
    return () => {
      clearTimeout(boot);
      clearInterval(id);
      window.removeEventListener('active-branch-changed', onRefresh);
      window.removeEventListener('zolofund:chit-auction-updated', onRefresh);
    };
  }, [fetchTicker]);

  useEffect(() => {
    if (!popoverOpen) return;
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (anchorRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setPopoverOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [popoverOpen]);

  const externalLive = useMemo(
    () => (payload?.liveAuctions ?? []).filter((a) => !pathname.includes(`/auctions/${a.auctionId}`)),
    [payload, pathname],
  );
  const externalUpcoming = useMemo(
    () => (payload?.upcomingAuctions ?? []).filter((a) => !pathname.includes(`/auctions/${a.auctionId}`)),
    [payload, pathname],
  );

  const sym = payload?.currencySymbol || '₹';
  const primaryLive = externalLive[0] ?? null;
  const primaryUpcoming = !primaryLive ? externalUpcoming[0] ?? null : null;

  if (!primaryLive && !primaryUpcoming) {
    return null;
  }

  const togglePopover = () => {
    if (!popoverOpen && anchorRef.current && typeof window !== 'undefined') {
      const rect = anchorRef.current.getBoundingClientRect();
      const popWidth = 340;
      const clampedLeft = Math.max(12, Math.min(rect.right - popWidth, window.innerWidth - popWidth - 12));
      const clampedTop = Math.min(rect.bottom + 8, window.innerHeight - 260);
      setPopoverPos({ top: clampedTop, left: clampedLeft });
    }
    setPopoverOpen((v) => !v);
  };

  const runQuickAction = async (
    auctionId: string,
    action: { mode: 'start_now' | 'extend' | 'close_now'; extendMinutes?: number },
  ) => {
    setBusyId(auctionId);
    try {
      await manageChitAuctionScheduleAction(auctionId, action);
      window.dispatchEvent(new CustomEvent('zolofund:chit-auction-updated'));
      await fetchTicker();
      router.refresh();
    } finally {
      setBusyId('');
    }
  };

  const LinkComp = mode === 'borrower' ? NextLink : DashboardLink;

  return (
    <div ref={anchorRef} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
      {primaryLive ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 6px 4px 10px',
            borderRadius: '999px',
            background: 'linear-gradient(120deg, var(--primary-dark), var(--primary))',
            color: '#fff',
            boxShadow: '0 4px 14px var(--primary-glow)',
            maxWidth: '390px',
            minWidth: 0,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.2)',
              letterSpacing: '0.4px',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#4ade80',
                boxShadow: '0 0 8px #4ade80',
              }}
            />
            {primaryLive.roomMode === 'LOTTERY_DRAW'
              ? dc.liveTopbarDrawBadge || 'DRAW'
              : dc.liveTopbarBadge || 'LIVE'}
          </span>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              lineHeight: 1.15,
            }}
          >
            <span
              style={{
                fontSize: '0.7rem',
                opacity: 0.9,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {primaryLive.groupName} · P{primaryLive.periodNumber}
              {primaryLive.secondsRemaining > 0 ? ` · ${formatCountdownShort(primaryLive.secondsRemaining)}` : ''}
            </span>
            <strong
              style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {buildSnippetText(primaryLive, sym, dc)}
            </strong>
          </div>

          <LinkComp
            href={roomHrefFor(primaryLive)}
            style={{
              padding: '4px 10px',
              borderRadius: '999px',
              background: '#ffffff',
              color: 'var(--primary-dark)',
              fontSize: '0.74rem',
              fontWeight: 800,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {primaryLive.roomMode === 'LOTTERY_DRAW'
              ? `${dc.liveTopbarEnterDrawRoom || 'Open Draw'} →`
              : `${dc.liveTopbarEnterRoom || 'Enter Room'} →`}
          </LinkComp>

          {(canConductAuction || externalLive.length + externalUpcoming.length > 1) && (
            <button
              type="button"
              onClick={togglePopover}
              aria-label="More live auctions & schedule"
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '999px',
                border: 'none',
                background: 'rgba(255,255,255,0.18)',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              ▾
            </button>
          )}
        </div>
      ) : primaryUpcoming ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 6px 4px 10px',
            borderRadius: '999px',
            background: 'var(--primary-light)',
            border: '1px solid var(--primary-border)',
            color: 'var(--primary-dark)',
            maxWidth: '370px',
            minWidth: 0,
          }}
        >
          <span style={{ fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
            📅 {primaryUpcoming.groupName} · P{primaryUpcoming.periodNumber}
          </span>
          <span
            style={{
              fontSize: '0.74rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {primaryUpcoming.isOverdueToStart
              ? dc.liveTopbarReadyNow || 'Scheduled time reached'
              : primaryUpcoming.startsInSeconds != null && primaryUpcoming.startsInSeconds > 0
                ? (dc.liveTopbarStartsIn || 'Starts in {time}').replace(
                    '{time}',
                    formatCountdownShort(primaryUpcoming.startsInSeconds),
                  )
                : dc.liveTopbarUpcomingBadge || 'Scheduled'}
          </span>
          <button
            type="button"
            onClick={togglePopover}
            className="btn btn-primary btn-sm"
            style={{ borderRadius: '999px', padding: '3px 10px', fontSize: '0.72rem', flexShrink: 0 }}
          >
            {dc.liveTopbarEnterRoom || 'Enter Room'} ▾
          </button>
        </div>
      ) : null}

      {/* Floating Portal Dropdown Menu (All Live & Upcoming Rooms + Meet-style Overrides) */}
      {mounted &&
        popoverOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${popoverPos.top}px`,
              left: `${popoverPos.left}px`,
              width: '340px',
              maxWidth: 'calc(100vw - 24px)',
              maxHeight: '72vh',
              overflowY: 'auto',
              background: 'var(--surface)',
              border: '1.5px solid var(--primary-border)',
              borderRadius: '14px',
              boxShadow: '0 18px 40px -10px rgba(15, 23, 42, 0.28)',
              zIndex: 1260,
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {[...externalLive, ...externalUpcoming].map((item) => {
              const isItemLive = externalLive.some((l) => l.auctionId === item.auctionId);
              return (
                <div
                  key={item.auctionId}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ fontSize: '0.84rem', color: 'var(--text)' }}>
                      {item.groupName} (P{item.periodNumber})
                    </strong>
                    <span className={`badge ${isItemLive ? 'badge-success' : 'badge-secondary'}`}>
                      {isItemLive
                        ? dc.liveTopbarBadge || 'LIVE'
                        : dc.liveTopbarUpcomingBadge || 'Scheduled'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {isItemLive
                      ? buildSnippetText(item, sym, dc)
                      : item.scheduledAt
                        ? new Date(item.scheduledAt).toLocaleString([], {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <LinkComp
                      href={roomHrefFor(item)}
                      onClick={() => setPopoverOpen(false)}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '0.74rem' }}
                    >
                      {dc.liveTopbarEnterRoom || 'Enter Room'} →
                    </LinkComp>
                    {mode === 'staff' && canConductAuction && (
                      <>
                        {isItemLive && ['open', 'extended'].includes(item.roomStatus) ? (
                          <button
                            type="button"
                            disabled={busyId === item.auctionId}
                            onClick={() => void runQuickAction(item.auctionId, { mode: 'extend', extendMinutes: 5 })}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.74rem' }}
                          >
                            {dc.liveTopbarExtend5m || '+5m'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === item.auctionId}
                            onClick={() => void runQuickAction(item.auctionId, { mode: 'start_now' })}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.74rem' }}
                          >
                            ⚡ {dc.liveTopbarStartNow || 'Start Now'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setPopoverOpen(false);
                            setScheduleTarget(item);
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.74rem' }}
                        >
                          📅 {dc.scheduleRescheduleBtn || 'Schedule / Time'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>,
          document.body,
        )}

      {/* Floating Portal Live Activity Snippet Toast (No Left Border Stripe) */}
      {mounted &&
        toastItem &&
        createPortal(
          <div
            role="status"
            style={{
              position: 'fixed',
              top: '76px',
              right: '20px',
              width: '340px',
              maxWidth: 'calc(100vw - 32px)',
              borderRadius: '14px',
              background: 'var(--surface)',
              border: '1.5px solid var(--primary-border)',
              boxShadow: '0 14px 34px -8px rgba(15, 23, 42, 0.24)',
              overflow: 'hidden',
              zIndex: 1250,
            }}
          >
            <div
              style={{
                padding: '7px 12px',
                background: 'linear-gradient(90deg, var(--primary-dark), var(--primary))',
                color: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.75rem',
                fontWeight: 800,
              }}
            >
              <span>
                ● {toastItem.item.groupName} · P{toastItem.item.periodNumber}
              </span>
              <button
                type="button"
                onClick={() => setToastItem(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                padding: '11px 13px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text)' }}>
                {toastItem.snippet}
              </div>
              <LinkComp
                href={roomHrefFor(toastItem.item)}
                onClick={() => setToastItem(null)}
                className="btn btn-primary btn-sm"
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {dc.liveTopbarEnterRoom || 'Enter Room'} →
              </LinkComp>
            </div>
          </div>,
          document.body,
        )}

      {scheduleTarget && (
        <AuctionScheduleModal
          open
          onClose={() => setScheduleTarget(null)}
          auctionId={scheduleTarget.auctionId}
          groupName={scheduleTarget.groupName}
          periodNumber={scheduleTarget.periodNumber}
          initialScheduledAt={scheduleTarget.scheduledAt}
          initialDurationMinutes={scheduleTarget.durationMinutes}
          initialAutoStart={scheduleTarget.autoStartEnabled}
          isBiddingRoom={['OPEN_AUCTION', 'SEALED_TENDER'].includes(scheduleTarget.roomMode)}
          dict={dict}
          onCompleted={() => {
            void fetchTicker();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
