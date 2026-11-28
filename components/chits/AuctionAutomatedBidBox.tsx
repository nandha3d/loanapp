'use client';

import React from 'react';
import { formatCurrency } from '@/lib/utils';
import type { AutomatedBidBounds } from '@/lib/chits/validation';

interface MemberOption {
  id: string;
  memberNumber: number;
  ticketNo?: string | null;
  customer: { name: string };
}

interface AuctionAutomatedBidBoxProps {
  bounds: AutomatedBidBounds;
  eligibleBidders: MemberOption[];
  bidMemberId: string;
  onChangeMemberId: (id: string) => void;
  bidPrize: number;
  onChangePrize: (next: number) => void;
  onPlaceBid: (prizeAmount: number) => void;
  currencySymbol: string;
  busy: boolean;
  isSealed?: boolean;
  roomOpen?: boolean;
  onStartLive?: () => void;
  startLiveBusy?: boolean;
  variant?: 'default' | 'studio';
  labels?: {
    title?: string;
    member?: string;
    selectMember?: string;
    prizeAmount?: string;
    discount?: string;
    placeBid?: string;
    startLive?: string;
  };
}

export default function AuctionAutomatedBidBox({
  bounds,
  eligibleBidders,
  bidMemberId,
  onChangeMemberId,
  bidPrize,
  onChangePrize,
  onPlaceBid,
  currencySymbol,
  busy,
  isSealed = false,
  roomOpen = true,
  onStartLive,
  startLiveBusy = false,
  variant = 'default',
  labels,
}: AuctionAutomatedBidBoxProps) {
  const isStudio = variant === 'studio';
  const minAllowedPrize = bounds.minPrize;
  const maxAllowedPrize = bounds.nextValidPrize;
  const effectivePrize = Math.max(minAllowedPrize, Math.min(maxAllowedPrize, Number.isFinite(bidPrize) ? bidPrize : maxAllowedPrize));
  const discountPreview = Math.max(0, Math.round((bounds.chitValue - effectivePrize) * 100) / 100);
  const discountPctPreview = bounds.chitValue > 0 ? Math.round((discountPreview / bounds.chitValue) * 1000) / 10 : 0;

  const stepDown = (delta: number) => {
    const next = Math.max(minAllowedPrize, Math.min(maxAllowedPrize, effectivePrize - delta));
    onChangePrize(next);
  };

  return (
    <div
      style={{
        borderRadius: '14px',
        border: isStudio ? '1px solid rgba(148, 163, 184, 0.16)' : '1px solid var(--border)',
        background: isStudio ? 'rgba(15, 23, 42, 0.65)' : 'var(--surface)',
        color: isStudio ? '#f8fafc' : 'var(--text)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      {/* Header strip showing automated direction & floor metrics */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          paddingBottom: '12px',
          borderBottom: isStudio ? '1px solid rgba(148, 163, 184, 0.14)' : '1px solid var(--border)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: isStudio ? '#f8fafc' : 'var(--text-primary)' }}>
              🔨 {labels?.title || 'Automated Reverse Bidding'}
            </h3>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '999px',
                background: isStudio ? 'rgba(16, 185, 129, 0.18)' : 'var(--primary-light)',
                color: isStudio ? '#6ee7b7' : 'var(--primary-dark)',
              }}
            >
              {isSealed
                ? 'Sealed Bid Mode'
                : bounds.strictBidMultiple && bounds.step > 1
                  ? `Step ₹${bounds.step.toLocaleString('en-IN')} · Strict Multiples`
                  : bounds.step === 1
                    ? '₹1 Narrow Bids Allowed'
                    : `Auto Reverse · Min Step ₹${bounds.effectiveStep.toLocaleString('en-IN')}`}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: isStudio ? '#94a3b8' : 'var(--text-secondary)', marginTop: '4px' }}>
            Opening Floor: <strong>{formatCurrency(bounds.startingPrize, currencySymbol)}</strong> ({formatCurrency(bounds.startingDiscount, currencySymbol)} disc.)
            {' · '}Next Allowed: <strong>≤ {formatCurrency(maxAllowedPrize, currencySymbol)}</strong>
            {bounds.maxDiscount != null && (
              <> · Ceiling Min Prize: <strong>{formatCurrency(minAllowedPrize, currencySymbol)}</strong></>
            )}
          </div>
        </div>

        {/* Giant Current Best / Next Automated Metric */}
        <div
          style={{
            background: isStudio
              ? bounds.currentLowestPrize != null
                ? 'rgba(22, 163, 74, 0.18)'
                : 'rgba(30, 41, 59, 0.72)'
              : bounds.currentLowestPrize != null
                ? '#ECFDF5'
                : 'var(--primary-light)',
            border: `1px solid ${
              isStudio
                ? bounds.currentLowestPrize != null
                  ? 'rgba(74, 222, 128, 0.35)'
                  : 'rgba(148, 163, 184, 0.22)'
                : bounds.currentLowestPrize != null
                  ? '#A7F3D0'
                  : 'var(--primary-border)'
            }`,
            borderRadius: '10px',
            padding: '10px 16px',
            textAlign: 'right',
            minWidth: '170px',
          }}
        >
          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              color: isStudio ? '#86efac' : bounds.currentLowestPrize != null ? '#065F46' : 'var(--primary-dark)',
            }}
          >
            {bounds.currentLowestPrize != null ? 'Current Leading Bid' : 'Automated Start Floor'}
          </div>
          <div
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              lineHeight: 1.15,
              fontVariantNumeric: 'tabular-nums',
              color: isStudio ? '#facc15' : bounds.currentLowestPrize != null ? '#047857' : 'var(--primary)',
            }}
          >
            {formatCurrency(bounds.currentLowestPrize ?? bounds.startingPrize, currencySymbol)}
          </div>
        </div>
      </div>

      {!roomOpen && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            background: isStudio ? 'rgba(245, 158, 11, 0.14)' : 'var(--warning-bg)',
            border: '1px solid rgba(245, 158, 11, 0.38)',
            color: isStudio ? '#fde68a' : 'var(--warning)',
            fontWeight: 700,
            fontSize: '0.86rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <span>⏸ Bidding is paused until the Foreman presses Start Live Now.</span>
          {onStartLive && (
            <button
              type="button"
              disabled={startLiveBusy}
              onClick={onStartLive}
              className="btn btn-primary btn-sm"
            >
              {startLiveBusy ? 'Starting…' : (labels?.startLive || '▶ Start Live Now')}
            </button>
          )}
        </div>
      )}

      {!bounds.canBidFurther ? (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '10px',
            background: '#FEF3C7',
            border: '1px solid #FDE68A',
            color: '#92400E',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          Maximum statutory discount cap ({formatCurrency(bounds.maxDiscount ?? 0, currencySymbol)}) has been reached. Ready to close and pick/draw the winner.
        </div>
      ) : (
        <>
          {/* Member Picker + Giant Numeric Bid Box */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px',
              alignItems: 'end',
            }}
          >
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                {labels?.member || 'Bidder Member'}
              </label>
              <select
                className="form-control"
                value={bidMemberId}
                onChange={(e) => onChangeMemberId(e.target.value)}
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 600,
                  height: '54px',
                  padding: '0 12px',
                  borderRadius: '10px',
                }}
              >
                <option value="">{labels?.selectMember || 'Select eligible member…'}</option>
                {eligibleBidders.map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.ticketNo ?? m.memberNumber} · {m.customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '0.84rem' }}>
                  {labels?.prizeAmount || 'Next Bid Prize'} ({currencySymbol})
                </label>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {labels?.discount || 'Discount'}: {formatCurrency(discountPreview, currencySymbol)} ({discountPctPreview}%)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: '8px' }}>
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    border: '2px solid var(--primary)',
                    borderRadius: '10px',
                    background: 'var(--primary-light)',
                    padding: '0 14px',
                    height: '54px',
                  }}
                >
                  <span style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--primary)', marginRight: '6px' }}>
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    min={minAllowedPrize}
                    max={maxAllowedPrize}
                    step={bounds.effectiveStep > 0 ? bounds.effectiveStep : 1}
                    value={effectivePrize}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      if (!Number.isFinite(raw)) return;
                      onChangePrize(raw);
                    }}
                    onBlur={() => {
                      // Auto-clamp strictly within valid monotonic range on blur so invalid directions can never submit
                      if (effectivePrize !== bidPrize) {
                        onChangePrize(effectivePrize);
                      }
                    }}
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: '1.85rem',
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => stepDown(bounds.effectiveStep)}
                  title={`Step lower by ${formatCurrency(bounds.effectiveStep, currencySymbol)}`}
                  style={{
                    height: '54px',
                    padding: '0 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    color: 'var(--primary-dark)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  −{formatCurrency(bounds.effectiveStep, currencySymbol)}
                </button>
              </div>
            </div>
          </div>

          {/* Premade Large Template Price Buttons */}
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Quick Premade Bid Prices (Tap to select &amp; load)
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))',
                gap: '10px',
              }}
            >
              {bounds.templatePrizes.map((tp) => {
                const selected = effectivePrize === tp.prizeAmount;
                return (
                    <button
                      key={tp.prizeAmount}
                      type="button"
                      disabled={busy || !roomOpen}
                      onClick={() => {
                        onChangePrize(tp.prizeAmount);
                        if (bidMemberId && roomOpen) {
                          onPlaceBid(tp.prizeAmount);
                        }
                      }}
                      style={{
                        padding: '12px 12px',
                        borderRadius: '10px',
                        border: selected ? '2px solid var(--primary)' : isStudio ? '1px solid rgba(148,163,184,0.2)' : '1px solid var(--border)',
                        background: isStudio
                          ? selected
                            ? 'rgba(16, 185, 129, 0.18)'
                            : 'rgba(30, 41, 59, 0.65)'
                          : selected
                            ? 'var(--primary-light)'
                            : 'var(--bg)',
                        textAlign: 'left',
                        cursor: busy || !roomOpen ? 'not-allowed' : 'pointer',
                        opacity: roomOpen ? 1 : 0.6,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '1.22rem',
                          fontWeight: 800,
                          fontVariantNumeric: 'tabular-nums',
                          color: isStudio ? '#f8fafc' : selected ? 'var(--primary-dark)' : 'var(--text-primary)',
                          lineHeight: 1.2,
                        }}
                      >
                        {formatCurrency(tp.prizeAmount, currencySymbol)}
                      </div>
                      <div style={{ fontSize: '0.74rem', fontWeight: 600, color: isStudio ? '#94a3b8' : 'var(--text-secondary)', marginTop: '3px' }}>
                        {tp.label} · {tp.discountPct}%
                      </div>
                    </button>
                );
              })}
            </div>
          </div>

          {/* Primary Confirm / Place Bid Action */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {bidMemberId
                ? 'Tip: Clicking any premade price card places that automated bid immediately.'
                : 'Select a member first, then tap a premade price or Place Bid.'}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !bidMemberId || !roomOpen}
              onClick={() => onPlaceBid(effectivePrize)}
              style={{
                padding: '12px 26px',
                fontSize: '1.05rem',
                fontWeight: 800,
                borderRadius: '10px',
              }}
            >
              {busy
                ? 'Placing Bid…'
                : `${labels?.placeBid || 'Place Bid'} · ${formatCurrency(effectivePrize, currencySymbol)}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
