'use client';

import React from 'react';
import type {
  ChitMemberJourneySummary,
  ChitSimulatedCycle,
  ChitSimulationResult,
} from '@/lib/chits/simulator';

export type SimulatorLabels = Record<string, string>;

export function formatMoneyCompact(value: number, symbol: string): string {
  const safeVal = Number.isFinite(value) ? value : 0;
  return `${symbol}${Math.round(safeVal).toLocaleString('en-IN')}`;
}

export function formatDecimalMoney(value: number, symbol: string): string {
  const safeVal = Number.isFinite(value) ? value : 0;
  const hasDecimals = Math.abs(safeVal - Math.round(safeVal)) > 0.005;
  return `${symbol}${safeVal.toLocaleString('en-IN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function phaseBadgeInfo(
  phase: ChitSimulatedCycle['phase'],
  labels: SimulatorLabels,
): { text: string; cls: string } {
  switch (phase) {
    case 'reserved':
      return { text: labels.phaseReserved || 'Reserved', cls: 'badge badge-closed' };
    case 'auction':
      return { text: labels.phaseAuction || 'Auction', cls: 'badge badge-pending' };
    case 'bonus':
      return { text: labels.phaseBonus || 'Bonus Month', cls: 'badge badge-active' };
    case 'accumulation':
      return { text: labels.phaseAccumulation || 'Savings', cls: 'badge badge-upcoming' };
    case 'revolving':
      return { text: labels.phaseRevolving || 'Revolving', cls: 'badge badge-upcoming' };
    case 'chart':
      return { text: labels.phaseChart || 'Chart', cls: 'badge badge-closed' };
    default:
      return { text: labels.phaseDraw || 'Draw', cls: 'badge badge-upcoming' };
  }
}

export function MoneyFlowDiagram({
  simulation,
  cycle,
  currencySymbol,
  labels,
}: {
  simulation: ChitSimulationResult;
  cycle: ChitSimulatedCycle;
  currencySymbol: string;
  labels: SimulatorLabels;
}) {
  const { input } = simulation;
  const engine = input.engineType;
  const phaseBadge = phaseBadgeInfo(cycle.phase, labels);

  const stage2Title = labels.flowStage2Title || 'Bid / Rule Gate';
  let stage2Value = formatMoneyCompact(cycle.bidDiscount, currencySymbol);
  let stage2Sub = `${cycle.bidDiscountPct}%`;

  if (engine === 'GOLD_WEIGHT_ACCUMULATION') {
    stage2Value = `${formatMoneyCompact(cycle.goldRatePerGram, currencySymbol)}/g`;
    stage2Sub = `${cycle.goldGramsCredited.toFixed(3)} g / cycle`;
  } else if (engine === 'GOLD_VALUE_ACCUMULATION') {
    stage2Value =
      cycle.phase === 'bonus'
        ? `+${formatMoneyCompact(cycle.merchantBonusAdded, currencySymbol)}`
        : formatMoneyCompact(input.monthlyContrib, currencySymbol);
    stage2Sub = cycle.phase === 'bonus' ? (labels.phaseBonus || 'Bonus') : (labels.phaseAccumulation || 'Savings');
  } else if (engine === 'ASCA_SHG_REVOLVING') {
    stage2Value = formatMoneyCompact(cycle.internalLoanDisbursed, currencySymbol);
    stage2Sub = `+${formatMoneyCompact(cycle.interestEarned, currencySymbol)} int.`;
  } else if (engine === 'AUCTION_RESERVE_PRICE' && cycle.reserveFloorAmount != null) {
    stage2Sub = `Floor ${formatMoneyCompact(cycle.reserveFloorAmount, currencySymbol)} (${cycle.reserveFloorPct ?? 0}%)`;
  } else if (engine === 'FESTIVAL_COMMODITY') {
    stage2Value = `+${input.merchantBonusPct ?? 0}%`;
    stage2Sub = cycle.merchantBonusAdded > 0
      ? formatMoneyCompact(cycle.merchantBonusAdded, currencySymbol)
      : (labels.phaseAccumulation || 'Accumulating');
  }

  const stage4Value =
    engine === 'GOLD_WEIGHT_ACCUMULATION'
      ? `${cycle.cumulativeGoldGrams.toFixed(3)} g`
      : engine === 'GOLD_VALUE_ACCUMULATION' || engine === 'FESTIVAL_COMMODITY'
        ? formatMoneyCompact(cycle.prizeAmount > 0 ? Math.round(cycle.prizeAmount / input.totalMembers) : cycle.nonPrizedInstalmentThisCycle, currencySymbol)
        : engine === 'ASCA_SHG_REVOLVING'
          ? formatMoneyCompact(cycle.cumulativePoolBalance, currencySymbol)
          : formatMoneyCompact(cycle.nextCycleNetDueNonPrized, currencySymbol);

  const stage4Label =
    engine === 'GOLD_WEIGHT_ACCUMULATION'
      ? (labels.colCumulativeGrams || 'Total Grams')
      : engine === 'ASCA_SHG_REVOLVING'
        ? (labels.colGrossPool || 'Pool Corpus')
        : (labels.colNextDue || 'Next Member Due');

  const stageBoxStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  };

  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '14px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <span style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--text)' }}>
          {labels.moneyFlowTitle || 'Visual Money Flow'} · {labels.cycleLabel || 'Cycle'} #{cycle.periodNumber}
        </span>
        <span className={phaseBadge.cls} style={{ fontSize: '.70rem' }}>
          {phaseBadge.text}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
          gap: '10px',
          alignItems: 'stretch',
        }}
      >
        {/* Stage 1: Pool Formation */}
        <div style={stageBoxStyle}>
          <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--text-secondary)' }}>
            1. {labels.flowStage1Title || 'Collection Pool'}
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>
            {formatMoneyCompact(cycle.grossPool, currencySymbol)}
          </div>
          <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)' }}>
            {simulation.rules.syndicateTicketCount} × {formatMoneyCompact(cycle.nonPrizedInstalmentThisCycle, currencySymbol)}
          </div>
        </div>

        {/* Stage 2: Bid / Rule Gate */}
        <div style={stageBoxStyle}>
          <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--text-secondary)' }}>
            2. {stage2Title}
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary-dark)' }}>
            {stage2Value}
          </div>
          <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)' }}>
            {stage2Sub}
          </div>
        </div>

        {/* Stage 3: Pot Distribution */}
        <div style={stageBoxStyle}>
          <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--text-secondary)' }}>
            3. {labels.flowStage3Title || 'Pot Distribution'}
          </div>
          <div style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--primary)' }}>
            {labels.legendPayout || 'Payout'}: {formatMoneyCompact(cycle.prizeAmount, currencySymbol)}
          </div>
          <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)' }}>
            {labels.colCommission || 'Comm'}: {formatMoneyCompact(cycle.commission, currencySymbol)} · {labels.colDividend || 'Div'}: {formatMoneyCompact(cycle.dividendPerTicket, currencySymbol)}
          </div>
        </div>

        {/* Stage 4: Member Impact */}
        <div
          style={{
            ...stageBoxStyle,
            borderColor: 'var(--primary-border)',
            background: 'var(--primary-light)',
          }}
        >
          <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--primary-dark)' }}>
            4. {labels.flowStage4Title || 'Member Impact'}
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary-dark)' }}>
            {stage4Value}
          </div>
          <div style={{ fontSize: '.72rem', color: 'var(--primary-dark)' }}>
            {stage4Label}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PotSplitDonut({
  cycle,
  currencySymbol,
  labels,
}: {
  cycle: ChitSimulatedCycle;
  currencySymbol: string;
  labels: SimulatorLabels;
}) {
  const { potSplitPct } = cycle;
  const r = 42;
  const circumference = 2 * Math.PI * r;

  const p1 = Math.min(100, Math.max(0, potSplitPct.payoutPct));
  const p2 = Math.min(100 - p1, Math.max(0, potSplitPct.dividendPct));
  const p3 = Math.min(100 - p1 - p2, Math.max(0, potSplitPct.commissionPct));

  const len1 = (p1 / 100) * circumference;
  const len2 = (p2 / 100) * circumference;
  const len3 = (p3 / 100) * circumference;

  const off1 = 0;
  const off2 = -len1;
  const off3 = -(len1 + len2);

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflow: 'hidden',
      }}
    >
      <div style={{ fontSize: '.80rem', fontWeight: 700, color: 'var(--text)' }}>
        {labels.potSplitTitle || 'Pot Allocation Breakdown'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '112px', height: '112px', flexShrink: 0 }}>
          <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={labels.potSplitTitle || 'Pot Allocation'}>
            <g transform="rotate(-90 56 56)">
              <circle
                cx="56"
                cy="56"
                r={r}
                fill="none"
                stroke="var(--bg)"
                strokeWidth="14"
              />
              {len1 > 0.1 && (
                <circle
                  cx="56"
                  cy="56"
                  r={r}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="14"
                  strokeDasharray={`${len1} ${circumference}`}
                  strokeDashoffset={off1}
                />
              )}
              {len2 > 0.1 && (
                <circle
                  cx="56"
                  cy="56"
                  r={r}
                  fill="none"
                  stroke="var(--info)"
                  strokeWidth="14"
                  strokeDasharray={`${len2} ${circumference}`}
                  strokeDashoffset={off2}
                />
              )}
              {len3 > 0.1 && (
                <circle
                  cx="56"
                  cy="56"
                  r={r}
                  fill="none"
                  stroke="var(--warning)"
                  strokeWidth="14"
                  strokeDasharray={`${len3} ${circumference}`}
                  strokeDashoffset={off3}
                />
              )}
            </g>
            <text
              x="56"
              y="53"
              textAnchor="middle"
              fontSize="15"
              fontWeight="700"
              fill="var(--text)"
            >
              {potSplitPct.payoutPct.toFixed(0)}%
            </text>
            <text
              x="56"
              y="68"
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="600"
              fill="var(--text-secondary)"
            >
              {labels.legendPayout || 'Payout'}
            </text>
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: '170px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Horizontal stacked bar */}
          <div
            style={{
              height: '8px',
              width: '100%',
              background: 'var(--bg)',
              borderRadius: '4px',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <div style={{ width: `${p1}%`, background: 'var(--primary)', transition: 'width .25s ease' }} />
            <div style={{ width: `${p2}%`, background: 'var(--info)', transition: 'width .25s ease' }} />
            <div style={{ width: `${p3}%`, background: 'var(--warning)', transition: 'width .25s ease' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.76rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'var(--primary)', display: 'inline-block' }} />
              {labels.legendPayout || 'Winner Payout'}
            </span>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>
              {formatMoneyCompact(cycle.prizeAmount, currencySymbol)} ({potSplitPct.payoutPct.toFixed(1)}%)
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.76rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'var(--info)', display: 'inline-block' }} />
              {labels.legendDividend || 'Dividends / Bonus'}
            </span>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>
              {formatMoneyCompact(cycle.distributableDividend, currencySymbol)} ({potSplitPct.dividendPct.toFixed(1)}%)
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.76rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'var(--warning)', display: 'inline-block' }} />
              {labels.legendCommission || 'Foreman Commission'}
            </span>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>
              {formatMoneyCompact(cycle.commission, currencySymbol)} ({potSplitPct.commissionPct.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CycleTrendChart({
  cycles,
  selectedCycleNumber,
  currencySymbol,
  labels,
  onSelectCycle,
}: {
  cycles: ChitSimulatedCycle[];
  selectedCycleNumber: number;
  currencySymbol: string;
  labels: SimulatorLabels;
  onSelectCycle: (cycleNumber: number) => void;
}) {
  const maxVal = Math.max(
    1,
    ...cycles.map((c) => Math.max(c.prizeAmount, c.nonPrizedInstalmentThisCycle)),
  );
  const colW = cycles.length > 20 ? 34 : Math.max(38, Math.floor(620 / Math.max(1, cycles.length)));
  const chartWidth = Math.max(460, cycles.length * colW + 56);
  const chartHeight = 166;
  const plotTop = 14;
  const plotBottom = 136;
  const plotHeight = plotBottom - plotTop;

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '14px 16px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <div>
          <div style={{ fontSize: '.80rem', fontWeight: 700, color: 'var(--text)' }}>
            {labels.cycleTrendTitle || 'Cycle-by-Cycle Payout vs Net Member Due'}
          </div>
          <div style={{ fontSize: '.70rem', color: 'var(--text-secondary)' }}>
            {labels.clickBarHint || 'Click any bar to inspect that cycle.'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', fontSize: '.72rem', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'var(--primary)', display: 'inline-block' }} />
            {labels.legendPayout || 'Winner Payout'}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'var(--info)', display: 'inline-block' }} />
            {labels.legendNetDue || 'Member Net Due'}
          </span>
        </div>
      </div>

      <div style={{ overflowX: 'auto', overflowY: 'hidden', width: '100%' }}>
        <svg
          width={cycles.length > 18 ? chartWidth : '100%'}
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          style={{ display: 'block', minWidth: cycles.length > 18 ? `${chartWidth}px` : undefined }}
          role="img"
          aria-label={labels.cycleTrendTitle || 'Cycle Trend Chart'}
        >
          {/* Horizontal Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
            const y = plotBottom - frac * plotHeight;
            const refVal = Math.round(maxVal * frac);
            return (
              <g key={idx}>
                <line
                  x1={44}
                  y1={y}
                  x2={chartWidth - 10}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray={frac === 0 ? undefined : '3 3'}
                  strokeWidth="1"
                />
                {idx % 2 === 0 && (
                  <text
                    x={40}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="9"
                    fill="var(--text-secondary)"
                  >
                    {refVal >= 100000
                      ? `${currencySymbol}${(refVal / 100000).toFixed(1)}L`
                      : refVal >= 1000
                        ? `${currencySymbol}${Math.round(refVal / 1000)}k`
                        : `${currencySymbol}${refVal}`}
                  </text>
                )}
              </g>
            );
          })}

          {/* Cycle Columns */}
          {cycles.map((c, idx) => {
            const cx = 48 + idx * colW;
            const isSelected = c.periodNumber === selectedCycleNumber;
            const payoutH = Math.max(c.prizeAmount > 0 ? 3 : 0, (c.payoutBarPct / 100) * plotHeight);
            const dueH = Math.max(c.nonPrizedInstalmentThisCycle > 0 ? 3 : 0, (c.netDueBarPct / 100) * plotHeight);
            const barW = Math.max(7, Math.min(14, Math.floor((colW - 10) / 2)));

            return (
              <g
                key={c.periodNumber}
                onClick={() => onSelectCycle(c.periodNumber)}
                style={{ cursor: 'pointer' }}
              >
                {isSelected && (
                  <rect
                    x={cx - 2}
                    y={plotTop - 4}
                    width={colW - 2}
                    height={plotHeight + 24}
                    rx="4"
                    fill="var(--primary-light)"
                  />
                )}
                <rect
                  x={cx + (colW - 2) / 2 - barW - 1}
                  y={plotBottom - payoutH}
                  width={barW}
                  height={payoutH}
                  rx="2"
                  fill={isSelected ? 'var(--primary-dark)' : 'var(--primary)'}
                >
                  <title>{`#${c.periodNumber} ${labels.legendPayout || 'Payout'}: ${formatMoneyCompact(c.prizeAmount, currencySymbol)}`}</title>
                </rect>
                <rect
                  x={cx + (colW - 2) / 2 + 1}
                  y={plotBottom - dueH}
                  width={barW}
                  height={dueH}
                  rx="2"
                  fill="var(--info)"
                >
                  <title>{`#${c.periodNumber} ${labels.legendNetDue || 'Due'}: ${formatMoneyCompact(c.nonPrizedInstalmentThisCycle, currencySymbol)}`}</title>
                </rect>
                <text
                  x={cx + (colW - 2) / 2}
                  y={plotBottom + 13}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight={isSelected ? '700' : '500'}
                  fill={isSelected ? 'var(--primary-dark)' : 'var(--text-secondary)'}
                >
                  C{c.periodNumber}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function ConsolidatedComparisonChart({
  journeys,
  currencySymbol,
  labels,
}: {
  journeys: ChitMemberJourneySummary[];
  currencySymbol: string;
  labels: SimulatorLabels;
}) {
  const roleLabel = (j: ChitMemberJourneySummary): string => {
    const template =
      j.role === 'early'
        ? labels.personaEarly || 'Early Winner (Cycle {cycle})'
        : j.role === 'mid'
          ? labels.personaMid || 'Mid-Term Winner (Cycle {cycle})'
          : labels.personaLate || 'Patient Saver (Cycle {cycle})';
    return template.replace('{cycle}', String(j.winCycle));
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ fontSize: '.80rem', fontWeight: 700, color: 'var(--text)' }}>
          {labels.paidVsReceivedTitle || 'Total Net Paid vs Total Received'}
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '.72rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'var(--text-secondary)', display: 'inline-block' }} />
            {labels.legendPaid || 'Net Paid'}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'var(--primary)', display: 'inline-block' }} />
            {labels.legendReceived || 'Received'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {journeys.map((j) => {
          const isPositive = j.netGainOrCost >= 0;
          return (
            <div key={j.role} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text)' }}>
                  {roleLabel(j)}
                </span>
                <span className={isPositive ? 'badge badge-active' : 'badge badge-partial'} style={{ fontSize: '.70rem' }}>
                  {isPositive ? '+' : ''}
                  {formatMoneyCompact(j.netGainOrCost, currencySymbol)} ({isPositive ? '+' : ''}
                  {j.effectiveReturnPct.toFixed(1)}%)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'center' }}>
                <div style={{ height: '10px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.max(0, j.paidBarPct))}%`,
                      background: 'var(--text-secondary)',
                      transition: 'width .25s ease',
                    }}
                  />
                </div>
                <span style={{ fontSize: '.74rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '82px', textAlign: 'right' }}>
                  {formatMoneyCompact(j.totalNetPaid, currencySymbol)}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'center' }}>
                <div style={{ height: '10px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.max(0, j.receivedBarPct))}%`,
                      background: 'var(--primary)',
                      transition: 'width .25s ease',
                    }}
                  />
                </div>
                <span style={{ fontSize: '.74rem', fontWeight: 700, color: 'var(--primary-dark)', minWidth: '82px', textAlign: 'right' }}>
                  {formatMoneyCompact(j.prizeOrMaturityReceived, currencySymbol)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
