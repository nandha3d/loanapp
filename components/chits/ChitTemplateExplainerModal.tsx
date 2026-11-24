'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CHIT_ENGINE_CATALOG, type ChitEngineType } from '@/lib/chits/engineTypes';
import type { ChitTemplateDefinition } from '@/lib/chits/templates';
import {
  buildDefaultSimulationInput,
  type ChitCycleOverride,
  type ChitSimulatedCycle,
  type ChitSimulationInput,
  type ChitSimulationResult,
} from '@/lib/chits/simulator';
import {
  OPERATIONAL_GUIDES,
  formatLocalizedTemplate,
  type SupportedLocale,
} from '@/lib/chits/templateGuides';
import type { ChitCommissionBasis, ChitDividendPolicy } from '@/lib/chits/types';
import { simulateChitTemplateAction } from '@/app/(dashboard)/[module]/chits/actions';
import {
  ConsolidatedComparisonChart,
  CycleTrendChart,
  MoneyFlowDiagram,
  PotSplitDonut,
  formatDecimalMoney,
  formatMoneyCompact,
  type SimulatorLabels,
} from './ChitSimulatorVisuals';

export type ChitTemplateApplyOverrides = {
  chitValue: number;
  monthlyContrib: number;
  totalMembers: number;
  commissionPct: number;
  commissionBasis: ChitCommissionBasis;
  dividendPolicy: ChitDividendPolicy;
  prizedPremiumAmount?: number;
  reservePriceStepPct?: number;
  goldBonusMonths?: number;
  goldRatePerGram?: number;
  merchantBonusPct?: number;
  reservedCyclesCount?: number;
  reservedDiscountPct?: number;
  ascaMonthlyLoanInterestPct?: number;
};

type TabId = 'process' | 'simulator' | 'consolidated';

type LocalizedTemplateCopy = {
  title?: string;
  badge?: string;
  desc?: string;
};

const STRICT_POT_EQUAL_CONTRIB_ENGINES = new Set<ChitEngineType>([
  'AUCTION_STANDARD',
  'AUCTION_RESERVE_PRICE',
  'AUCTION_UNCAPPED_ENTERPRISE',
  'PURE_LOTTERY',
  'FIXED_ROTATION',
  'NEED_BASED_CONSENSUS',
  'HYBRID_SPLIT_PHASE',
]);

export default function ChitTemplateExplainerModal({
  template,
  currencySymbol = '₹',
  lang = 'en',
  dict,
  isApplied = false,
  onApply,
  onClose,
}: {
  template: ChitTemplateDefinition | null;
  currencySymbol?: string;
  lang?: string;
  dict?: Record<string, unknown>;
  isApplied?: boolean;
  onApply: (template: ChitTemplateDefinition, customOverrides?: ChitTemplateApplyOverrides) => void;
  onClose: () => void;
}) {
  if (!template) return null;
  return (
    <ChitTemplateExplainerModalContent
      key={template.code}
      template={template}
      currencySymbol={currencySymbol}
      lang={lang}
      dict={dict}
      isApplied={isApplied}
      onApply={onApply}
      onClose={onClose}
    />
  );
}

function ChitTemplateExplainerModalContent({
  template,
  currencySymbol,
  lang,
  dict,
  isApplied,
  onApply,
  onClose,
}: {
  template: ChitTemplateDefinition;
  currencySymbol: string;
  lang: string;
  dict?: Record<string, unknown>;
  isApplied: boolean;
  onApply: (template: ChitTemplateDefinition, customOverrides?: ChitTemplateApplyOverrides) => void;
  onClose: () => void;
}) {
  const validLocales: SupportedLocale[] = ['en', 'ta', 'hi', 'te', 'kn', 'ml'];
  const locale: SupportedLocale = validLocales.includes(lang as SupportedLocale)
    ? (lang as SupportedLocale)
    : 'en';

  const chitsDict = (dict?.chits ?? {}) as Record<string, unknown>;
  const labels = (chitsDict.simulator ?? {}) as SimulatorLabels;
  const templatesMap = (chitsDict.templates ?? {}) as Record<string, LocalizedTemplateCopy | undefined>;

  const [activeTab, setActiveTab] = useState<TabId>('process');
  const [simInput, setSimInput] = useState<ChitSimulationInput>(() =>
    buildDefaultSimulationInput(template),
  );
  const [simResult, setSimResult] = useState<ChitSimulationResult | null>(null);
  const [isCustomized, setIsCustomized] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  const requestSeqRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  // Execute server simulation whenever simInput changes (debounced 150ms on edits, immediate on mount)
  useEffect(() => {
    const seq = ++requestSeqRef.current;
    const delay = hasLoadedOnceRef.current ? 150 : 0;

    const timer = setTimeout(async () => {
      if (requestSeqRef.current !== seq) return;
      setSimLoading(true);
      try {
        const result = await simulateChitTemplateAction(simInput);
        if (requestSeqRef.current !== seq) return;
        hasLoadedOnceRef.current = true;
        setSimResult(result);
        setSimError(null);
      } catch (err: unknown) {
        if (requestSeqRef.current !== seq) return;
        const msg = err instanceof Error ? err.message : 'Simulation failed';
        setSimError(msg);
      } finally {
        if (requestSeqRef.current === seq) {
          setSimLoading(false);
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [simInput]);

  const updateInput = (patch: Partial<ChitSimulationInput>, markEdited = true) => {
    setSimInput((prev) => {
      const next: ChitSimulationInput = { ...prev, ...patch };
      // Auto-sync monthlyContrib when strict pot value / members change unless user specifically edited monthlyContrib directly
      if (
        (patch.chitValue !== undefined || patch.totalMembers !== undefined) &&
        patch.monthlyContrib === undefined &&
        STRICT_POT_EQUAL_CONTRIB_ENGINES.has(prev.engineType)
      ) {
        const safeMembers = Math.max(2, Math.trunc(next.totalMembers || 2));
        next.monthlyContrib = Math.round(Math.max(1, next.chitValue) / safeMembers);
      }
      if (patch.chitValue !== undefined && prev.engineType === 'AUCTION_MULTI_DIVISION') {
        const safeMembers = Math.max(2, Math.trunc(next.totalMembers || 2));
        next.monthlyContrib = Math.round(Math.max(1, next.chitValue) / safeMembers);
      }
      // Trim selectedCycle inside valid [1, N]
      const clampedN = Math.max(2, Math.min(60, Math.trunc(next.totalMembers || 2)));
      if ((next.selectedCycle ?? 1) > clampedN) {
        next.selectedCycle = clampedN;
      }
      return next;
    });
    if (markEdited) setIsCustomized(true);
  };

  const updateCycleOverride = (periodNumber: number, patch: Partial<ChitCycleOverride>) => {
    setSimInput((prev) => {
      const existing = prev.cycleOverrides ?? {};
      return {
        ...prev,
        selectedCycle: periodNumber,
        cycleOverrides: {
          ...existing,
          [periodNumber]: {
            ...(existing[periodNumber] ?? {}),
            ...patch,
          },
        },
      };
    });
    setIsCustomized(true);
  };

  const catalog = CHIT_ENGINE_CATALOG[template.engineType];
  const guide = OPERATIONAL_GUIDES[template.engineType] ?? OPERATIONAL_GUIDES.AUCTION_STANDARD;
  const localizedTmpl = templatesMap[template.code];
  const templateTitle = localizedTmpl?.title || template.defaultName;
  const templateBadge = localizedTmpl?.badge || template.defaultBadge;

  const freqLabelMap: Record<string, string> = {
    monthly: labels.freqMonthly || 'monthly',
    daily: labels.freqDaily || 'daily',
    weekly: labels.freqWeekly || 'weekly',
    fortnightly: labels.freqFortnightly || 'fortnightly',
    custom: labels.freqCustom || 'custom',
  };
  const localizedFreq = freqLabelMap[simInput.frequency || template.defaultFrequency] || template.defaultFrequency;

  const handleReset = () => {
    const defaults = buildDefaultSimulationInput(template);
    setSimInput(defaults);
    setIsCustomized(false);
    setSimError(null);
  };

  const handleApply = () => {
    if (isCustomized) {
      onApply(template, {
        chitValue: simInput.chitValue,
        monthlyContrib: simInput.monthlyContrib,
        totalMembers: Math.max(2, Math.min(60, Math.trunc(simInput.totalMembers))),
        commissionPct: simInput.commissionPct,
        commissionBasis: simInput.commissionBasis,
        dividendPolicy: simInput.dividendPolicy,
        prizedPremiumAmount: simInput.prizedPremiumAmount,
        reservePriceStepPct: simInput.reservePriceStepPct,
        goldBonusMonths: simInput.goldBonusMonths,
        goldRatePerGram: simInput.goldRatePerGram,
        merchantBonusPct: simInput.merchantBonusPct,
        reservedCyclesCount: simInput.reservedCyclesCount,
        reservedDiscountPct: simInput.reservedDiscountPct,
        ascaMonthlyLoanInterestPct: simInput.ascaMonthlyLoanInterestPct,
      });
    } else {
      onApply(template);
    }
    onClose();
  };

  const activeCycleNumber = simResult?.selectedCycleNumber ?? simInput.selectedCycle ?? 1;
  const activeCycle: ChitSimulatedCycle | undefined =
    simResult?.cycles.find((c) => c.periodNumber === activeCycleNumber) ?? simResult?.cycles[0];

  const basisText =
    simInput.commissionBasis === 'CHIT_VALUE'
      ? labels.basisChitValue || '% of Gross Chit Value'
      : labels.basisBidDiscount || '% of Bid Discount';

  const step1Formatted = (() => {
    if (!activeCycle) return '';
    if (template.engineType === 'BASE_PLUS_PREMIUM') {
      const prizedCount = Math.max(0, activeCycle.periodNumber - 1);
      const nonPrizedCount = Math.max(0, simInput.totalMembers - prizedCount);
      return formatLocalizedTemplate(
        labels.step1DualBody || 'Cycle {cycle}: {nonPrizedCount} non-prized pay {baseDue} + {prizedCount} prized pay {prizedDue} = {grossPool}.',
        {
          cycle: activeCycle.periodNumber,
          nonPrizedCount,
          prizedCount,
          baseDue: formatMoneyCompact(activeCycle.nonPrizedInstalmentThisCycle, currencySymbol),
          prizedDue: formatMoneyCompact(activeCycle.prizedInstalmentThisCycle, currencySymbol),
          grossPool: formatMoneyCompact(activeCycle.grossPool, currencySymbol),
        },
      );
    }
    if (template.engineType === 'AUCTION_MULTI_DIVISION' && simResult) {
      return formatLocalizedTemplate(
        labels.step1SyndicateBody || '{tickets} syndicate tickets contribute {installment} per {frequency} cycle across {winners} divisions = {grossPool}.',
        {
          tickets: simResult.rules.syndicateTicketCount,
          installment: formatMoneyCompact(simInput.monthlyContrib, currencySymbol),
          frequency: localizedFreq,
          winners: simResult.rules.winnersPerCycle,
          grossPool: formatMoneyCompact(activeCycle.grossPool, currencySymbol),
        },
      );
    }
    return formatLocalizedTemplate(
      labels.step1Body || '{members} members contribute {installment} per {frequency} cycle, forming a gross collection pool of {grossPool}.',
      {
        members: simInput.totalMembers,
        installment: formatMoneyCompact(simInput.monthlyContrib, currencySymbol),
        frequency: localizedFreq,
        grossPool: formatMoneyCompact(activeCycle.grossPool, currencySymbol),
      },
    );
  })();

  const step3Formatted = (() => {
    const baseText = guide.commissionRule[locale] || guide.commissionRule.en;
    if (!activeCycle) return baseText;
    const gstNote =
      (simInput.gstPct ?? 0) > 0
        ? `GST ${simInput.gstPct}% = ${formatMoneyCompact(activeCycle.gstAmount, currencySymbol)}`
        : 'GST 0%';
    const suffix = formatLocalizedTemplate(
      labels.step3Suffix || 'Currently {commPct}% on {basis} = {commAmount} ({gstNote}).',
      {
        commPct: simInput.commissionPct,
        basis: basisText,
        commAmount: formatMoneyCompact(activeCycle.commission, currencySymbol),
        gstNote,
      },
    );
    return `${baseText} ${suffix}`;
  })();

  const stages = [
    { title: labels.step1Title || '1. Collection & Pool Formation', detail: step1Formatted },
    { title: labels.step2Title || '2. Winner Selection & Starting Floor', detail: guide.auctionStartMode[locale] || guide.auctionStartMode.en },
    { title: labels.step3Title || '3. Foreman Commission Calculation', detail: step3Formatted },
    { title: labels.step4Title || '4. Dividend Pool & Sharing', detail: guide.dividendRule[locale] || guide.dividendRule.en },
    { title: labels.step5Title || '5. Winner Payout & Security Gate', detail: guide.payoutRule[locale] || guide.payoutRule.en },
    { title: labels.step6Title || '6. Post-Win Obligations & Closure', detail: guide.postWinRule[locale] || guide.postWinRule.en },
  ];

  const warningMessage = (w: ChitSimulatedCycle['warning']): string | null => {
    if (!w) return null;
    if (w.code === 'below_floor') {
      return formatLocalizedTemplate(
        labels.warnBelowFloor || 'Edited discount is below the minimum floor of {floorAmount} ({floorPct}%).',
        { floorAmount: formatMoneyCompact(w.floorAmount ?? 0, currencySymbol), floorPct: w.floorPct ?? 0 },
      );
    }
    if (w.code === 'above_cap') {
      return formatLocalizedTemplate(
        labels.warnAboveCap || 'Edited discount exceeds the cap of {capAmount} ({capPct}%).',
        { capAmount: formatMoneyCompact(w.capAmount ?? 0, currencySymbol), capPct: w.capPct ?? 0 },
      );
    }
    if (w.code === 'reserve_fallback') {
      return formatLocalizedTemplate(
        labels.warnReserveFallback || 'Bid meets reserve floor {floorAmount} ({floorPct}%): fallback lottery resolves at floor.',
        { floorAmount: formatMoneyCompact(w.floorAmount ?? 0, currencySymbol), floorPct: w.floorPct ?? 0 },
      );
    }
    if (w.code === 'commission_exceeds_discount') {
      return labels.warnCommissionExceedsDiscount || 'Bid discount is smaller than foreman commission; dividend reduces to ₹0.';
    }
    return null;
  };

  const tabs: Array<{ id: TabId; num: number; label: string; sub: string }> = [
    { id: 'process', num: 1, label: labels.tabProcess || 'How It Works', sub: labels.tabProcessSub || 'Flow & Rules' },
    { id: 'simulator', num: 2, label: labels.tabSimulator || 'Live Simulator', sub: labels.tabSimulatorSub || 'Edit Values & Bids' },
    { id: 'consolidated', num: 3, label: labels.tabConsolidated || 'Consolidated Result', sub: labels.tabConsolidatedSub || 'Summary & Members' },
  ];

  const paramInputStyle: React.CSSProperties = {
    padding: '7px 10px',
    fontSize: '.82rem',
    height: '36px',
  };

  const inlineCellInputStyle: React.CSSProperties = {
    width: '108px',
    padding: '5px 8px',
    fontSize: '.80rem',
    fontWeight: 600,
    border: '1px solid var(--primary-border)',
    borderRadius: '6px',
    background: 'var(--surface)',
    color: 'var(--text)',
    textAlign: 'right',
  };

  const engine = template.engineType;
  const isAuctionFamily =
    engine === 'AUCTION_STANDARD' ||
    engine === 'AUCTION_RESERVE_PRICE' ||
    engine === 'AUCTION_MULTI_DIVISION' ||
    engine === 'AUCTION_UNCAPPED_ENTERPRISE' ||
    engine === 'MICRO_DAILY_COLLECTION' ||
    engine === 'HYBRID_SPLIT_PHASE';
  const showDividendPolicyControl =
    isAuctionFamily || engine === 'FIXED_DIVIDEND' || engine === 'CUSTOM_MANUAL_SCHEDULE';

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.58)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '980px',
          maxWidth: '96vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface, #ffffff)',
          borderRadius: 'var(--radius, 12px)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border, #e2e8f0)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '16px 24px 12px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '14px',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <span className="badge badge-pending" style={{ fontSize: '.70rem' }}>
                {catalog.category}
              </span>
              <span className="badge badge-active" style={{ fontSize: '.70rem' }}>
                {templateBadge}
              </span>
              {isCustomized && (
                <span className="badge badge-partial" style={{ fontSize: '.70rem' }}>
                  {labels.customizedBadge || 'Edited'}
                </span>
              )}
            </div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)' }}>
              {templateTitle}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '.76rem', color: 'var(--text-secondary)' }}>
              {labels.modalSubtitle || 'Explore how money flows, simulate custom values, and inspect consolidated returns.'}
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label={labels.close || 'Close'}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              lineHeight: 1,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '2px',
            }}
          >
            &times;
          </button>
        </div>

        {/* Highlighted 3-Tab Workflow Bar */}
        <div
          role="tablist"
          aria-label="Template workflow tabs"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '8px',
            padding: '10px 24px',
            background: 'var(--bg)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: active ? '1px solid var(--primary-dark)' : '1px solid var(--border)',
                  background: active ? 'var(--primary)' : 'var(--surface)',
                  color: active ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: active ? '0 2px 8px var(--primary-glow)' : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.16s ease',
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '.76rem',
                    fontWeight: 700,
                    flexShrink: 0,
                    background: active ? 'rgba(255, 255, 255, 0.22)' : 'var(--bg)',
                    color: active ? '#ffffff' : 'var(--primary-dark)',
                    border: active ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid var(--border)',
                  }}
                >
                  {tab.num}
                </span>
                <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  <span style={{ fontSize: '.84rem', fontWeight: active ? 700 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tab.label}
                  </span>
                  <span style={{ fontSize: '.69rem', opacity: active ? 0.9 : 0.78, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tab.sub}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Modal Body */}
        <div
          className="modal-body"
          style={{
            padding: '18px 24px',
            overflowY: 'auto',
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {simError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger)',
                color: '#991B1B',
                fontSize: '.82rem',
                fontWeight: 600,
              }}
            >
              {simError}
            </div>
          )}

          {/* TAB 1: HOW IT WORKS */}
          {activeTab === 'process' && (
            <>
              <p style={{ margin: 0, fontSize: '.86rem', color: 'var(--text)', lineHeight: 1.55 }}>
                {guide.overview[locale] || guide.overview.en}
              </p>

              {/* Core Engine Rules Strip */}
              {simResult && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
                    gap: '10px',
                  }}
                >
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                    <div style={{ fontSize: '.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                      {simResult.supportsBidding ? (labels.ruleFloor || 'Minimum Floor') : (labels.ruleZeroBid || 'Selection')}
                    </div>
                    <div style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>
                      {simResult.supportsBidding
                        ? `${simResult.rules.floorDiscountPct ?? 0}% (${formatMoneyCompact(simResult.rules.floorDiscountAmount, currencySymbol)})`
                        : (labels.phaseDraw || 'Draw / Fixed')}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                    <div style={{ fontSize: '.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                      {simResult.rules.capDiscountPct != null ? (labels.ruleCap || 'Maximum Cap') : (labels.ruleUncapped || 'Ceiling')}
                    </div>
                    <div style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>
                      {simResult.rules.capDiscountPct != null && simResult.rules.capDiscountAmount != null
                        ? `${simResult.rules.capDiscountPct}% (${formatMoneyCompact(simResult.rules.capDiscountAmount, currencySymbol)})`
                        : (labels.ruleUncapped || 'Uncapped')}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                    <div style={{ fontSize: '.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                      {labels.ruleCommissionMode || 'Foreman Commission'}
                    </div>
                    <div style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>
                      {simInput.commissionPct}% · {simInput.commissionBasis === 'CHIT_VALUE' ? (labels.chitValue || 'Chit Value') : (labels.colBidDiscount || 'Bid Discount')}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                    <div style={{ fontSize: '.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                      {labels.step5Title || 'Security Gate'}
                    </div>
                    <div style={{ fontSize: '.86rem', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>
                      {simResult.rules.securityRequired
                        ? (labels.ruleSecurityRequired || 'Surety Mandatory')
                        : (labels.ruleSecurityOptional || 'Mutual Trust')}
                    </div>
                  </div>
                </div>
              )}

              {/* Graphical Visuals: Flow Diagram + Donut Split */}
              {simResult && activeCycle && (
                <>
                  <MoneyFlowDiagram
                    simulation={simResult}
                    cycle={activeCycle}
                    currencySymbol={currencySymbol}
                    labels={labels}
                  />

                  <PotSplitDonut
                    cycle={activeCycle}
                    currencySymbol={currencySymbol}
                    labels={labels}
                  />
                </>
              )}

              {/* 6-Stage Operational Lifecycle */}
              <div>
                <h4
                  style={{
                    margin: '0 0 10px',
                    fontSize: '.90rem',
                    fontWeight: 700,
                    color: 'var(--text)',
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: '6px',
                  }}
                >
                  {labels.lifecycleStepsTitle || 'Step-by-Step Lifecycle Walkthrough'}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stages.map((st, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                        padding: '10px 14px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '.76rem',
                          color: 'var(--primary-dark)',
                          flexShrink: 0,
                          marginTop: '1px',
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '.84rem', color: 'var(--text)', marginBottom: '2px' }}>
                          {st.title}
                        </div>
                        <div style={{ fontSize: '.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                          {st.detail}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveTab('simulator')}
                >
                  {labels.goToSimulator || 'Next: Interactive Simulator'} →
                </button>
              </div>
            </>
          )}

          {/* TAB 2: LIVE SIMULATOR */}
          {activeTab === 'simulator' && (
            <>
              {/* Editable Parameters Card */}
              <div
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 16px',
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
                  <div style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--text)' }}>
                    {labels.editableParamsTitle || 'Customize Group & Engine Parameters'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {simLoading && (
                      <span style={{ fontSize: '.72rem', color: 'var(--primary-dark)', fontWeight: 600 }}>
                        {labels.recalculating || 'Recalculating...'}
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleReset}
                      style={{ padding: '4px 10px', fontSize: '.74rem' }}
                    >
                      {labels.resetDefaults || 'Reset Defaults'}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '10px',
                  }}
                >
                  <div>
                    <label className="form-label" style={{ fontSize: '.72rem' }}>
                      {labels.chitValue || 'Chit Value'} ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      min={1000}
                      step={1000}
                      className="form-control"
                      style={paramInputStyle}
                      value={simInput.chitValue}
                      onChange={(e) => updateInput({ chitValue: Math.max(100, Number(e.target.value) || 100) })}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '.72rem' }}>
                      {labels.totalMembers || 'Members / Cycles'}
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={60}
                      className="form-control"
                      style={paramInputStyle}
                      value={simInput.totalMembers}
                      onChange={(e) => {
                        const n = Math.max(2, Math.min(60, Math.trunc(Number(e.target.value) || 2)));
                        updateInput({ totalMembers: n });
                      }}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '.72rem' }}>
                      {labels.installment || 'Base Installment'} ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      min={100}
                      step={100}
                      className="form-control"
                      style={paramInputStyle}
                      value={simInput.monthlyContrib}
                      onChange={(e) => {
                        const amt = Math.max(10, Number(e.target.value) || 10);
                        updateInput({
                          monthlyContrib: amt,
                          ...(engine === 'BASE_PLUS_PREMIUM' ? { baseInstalment: amt } : {}),
                        });
                      }}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '.72rem' }}>
                      {labels.commissionPct || 'Commission %'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={25}
                      step={0.5}
                      className="form-control"
                      style={paramInputStyle}
                      value={simInput.commissionPct}
                      onChange={(e) =>
                        updateInput({ commissionPct: Math.max(0, Math.min(25, Number(e.target.value) || 0)) })
                      }
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '.72rem' }}>
                      {labels.commissionBasis || 'Commission Basis'}
                    </label>
                    <select
                      className="form-control"
                      style={paramInputStyle}
                      value={simInput.commissionBasis}
                      onChange={(e) => updateInput({ commissionBasis: e.target.value as ChitCommissionBasis })}
                    >
                      <option value="CHIT_VALUE">{labels.basisChitValue || '% of Chit Value'}</option>
                      <option value="BID_DISCOUNT">{labels.basisBidDiscount || '% of Bid Discount'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '.72rem' }}>
                      {labels.gstPct || 'GST %'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={28}
                      step={1}
                      className="form-control"
                      style={paramInputStyle}
                      value={simInput.gstPct ?? 0}
                      onChange={(e) =>
                        updateInput({ gstPct: Math.max(0, Math.min(28, Number(e.target.value) || 0)) })
                      }
                    />
                  </div>

                  {showDividendPolicyControl && (
                    <div>
                      <label className="form-label" style={{ fontSize: '.72rem' }}>
                        {labels.dividendPolicy || 'Dividend Policy'}
                      </label>
                      <select
                        className="form-control"
                        style={paramInputStyle}
                        value={simInput.dividendPolicy}
                        onChange={(e) => updateInput({ dividendPolicy: e.target.value as ChitDividendPolicy })}
                      >
                        <option value="ALL_MEMBERS">{labels.policyAll || 'All Members'}</option>
                        <option value="NON_WINNERS_ONLY">{labels.policyNonWinners || 'Non-Winners Only'}</option>
                        <option value="NON_PRIZED_ONLY">{labels.policyNonPrized || 'Non-Prized Only'}</option>
                        <option value="NONE">{labels.policyNone || 'No Dividend'}</option>
                      </select>
                    </div>
                  )}

                  {engine === 'AUCTION_RESERVE_PRICE' && (
                    <div>
                      <label className="form-label" style={{ fontSize: '.72rem' }}>
                        {labels.reserveStepPct || 'Reserve Step %'}
                      </label>
                      <input
                        type="number"
                        min={0.1}
                        max={10}
                        step={0.1}
                        className="form-control"
                        style={paramInputStyle}
                        value={simInput.reservePriceStepPct ?? 1.5}
                        onChange={(e) => updateInput({ reservePriceStepPct: Math.max(0.1, Number(e.target.value) || 1.5) })}
                      />
                    </div>
                  )}

                  {engine === 'AUCTION_MULTI_DIVISION' && (
                    <>
                      <div>
                        <label className="form-label" style={{ fontSize: '.72rem' }}>
                          {labels.lotteryWinners || 'Lottery Winners'}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={2}
                          className="form-control"
                          style={paramInputStyle}
                          value={simInput.lotteryWinnersPerCycle ?? 1}
                          onChange={(e) => updateInput({ lotteryWinnersPerCycle: Math.max(0, Math.min(2, Number(e.target.value) || 0)) })}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '.72rem' }}>
                          {labels.auctionWinners || 'Auction Winners'}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={6}
                          className="form-control"
                          style={paramInputStyle}
                          value={simInput.auctionWinnersPerCycle ?? 3}
                          onChange={(e) => updateInput({ auctionWinnersPerCycle: Math.max(1, Math.min(6, Number(e.target.value) || 1)) })}
                        />
                      </div>
                    </>
                  )}

                  {engine === 'BASE_PLUS_PREMIUM' && (
                    <div>
                      <label className="form-label" style={{ fontSize: '.72rem' }}>
                        {labels.winnerPremium || 'Winner Premium'} ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        className="form-control"
                        style={paramInputStyle}
                        value={simInput.prizedPremiumAmount ?? 2000}
                        onChange={(e) => updateInput({ prizedPremiumAmount: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </div>
                  )}

                  {engine === 'HYBRID_SPLIT_PHASE' && (
                    <>
                      <div>
                        <label className="form-label" style={{ fontSize: '.72rem' }}>
                          {labels.reservedCycles || 'Reserved Cycles'}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, simInput.totalMembers - 1)}
                          className="form-control"
                          style={paramInputStyle}
                          value={simInput.reservedCyclesCount ?? 1}
                          onChange={(e) => updateInput({ reservedCyclesCount: Math.max(1, Number(e.target.value) || 1) })}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '.72rem' }}>
                          {labels.reservedDiscountPct || 'Reserved Disc %'}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={40}
                          step={0.5}
                          className="form-control"
                          style={paramInputStyle}
                          value={simInput.reservedDiscountPct ?? 0}
                          onChange={(e) => updateInput({ reservedDiscountPct: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </div>
                    </>
                  )}

                  {engine === 'GOLD_VALUE_ACCUMULATION' && (
                    <>
                      <div>
                        <label className="form-label" style={{ fontSize: '.72rem' }}>
                          {labels.goldBonusMonths || 'Bonus Months'}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={Math.max(1, simInput.totalMembers - 1)}
                          className="form-control"
                          style={paramInputStyle}
                          value={simInput.goldBonusMonths ?? 1}
                          onChange={(e) => updateInput({ goldBonusMonths: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '.72rem' }}>
                          {labels.goldRatePerGram || 'Gold Rate (₹/g)'}
                        </label>
                        <input
                          type="number"
                          min={500}
                          step={100}
                          className="form-control"
                          style={paramInputStyle}
                          value={simInput.goldRatePerGram ?? 7500}
                          onChange={(e) => updateInput({ goldRatePerGram: Math.max(500, Number(e.target.value) || 7500) })}
                        />
                      </div>
                    </>
                  )}

                  {engine === 'GOLD_WEIGHT_ACCUMULATION' && (
                    <div>
                      <label className="form-label" style={{ fontSize: '.72rem' }}>
                        {labels.goldRatePerGram || 'Base Gold Rate (₹/g)'}
                      </label>
                      <input
                        type="number"
                        min={500}
                        step={100}
                        className="form-control"
                        style={paramInputStyle}
                        value={simInput.goldRatePerGram ?? 7500}
                        onChange={(e) => updateInput({ goldRatePerGram: Math.max(500, Number(e.target.value) || 7500) })}
                      />
                    </div>
                  )}

                  {engine === 'FESTIVAL_COMMODITY' && (
                    <div>
                      <label className="form-label" style={{ fontSize: '.72rem' }}>
                        {labels.merchantBonusPct || 'Merchant Bonus %'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        step={1}
                        className="form-control"
                        style={paramInputStyle}
                        value={simInput.merchantBonusPct ?? 8}
                        onChange={(e) => updateInput({ merchantBonusPct: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </div>
                  )}

                  {engine === 'ASCA_SHG_REVOLVING' && (
                    <>
                      <div>
                        <label className="form-label" style={{ fontSize: '.72rem' }}>
                          {labels.ascaInterestPct || 'Loan Interest % / mo'}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step={0.25}
                          className="form-control"
                          style={paramInputStyle}
                          value={simInput.ascaMonthlyLoanInterestPct ?? 1.5}
                          onChange={(e) => updateInput({ ascaMonthlyLoanInterestPct: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '.72rem' }}>
                          {labels.ascaUtilizationPct || 'Pool Utilization %'}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          className="form-control"
                          style={paramInputStyle}
                          value={simInput.ascaPoolUtilizationPct ?? 70}
                          onChange={(e) => updateInput({ ascaPoolUtilizationPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Warning for Selected Cycle if Any */}
              {activeCycle?.warning && warningMessage(activeCycle.warning) && (
                <div
                  style={{
                    padding: '9px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: activeCycle.warning.code === 'below_floor' || activeCycle.warning.code === 'above_cap' ? 'var(--warning-bg)' : 'var(--info-bg)',
                    border: activeCycle.warning.code === 'below_floor' || activeCycle.warning.code === 'above_cap' ? '1px solid var(--warning)' : '1px solid var(--info)',
                    color: 'var(--text)',
                    fontSize: '.78rem',
                    fontWeight: 600,
                  }}
                >
                  {warningMessage(activeCycle.warning)}
                </div>
              )}

              {/* Selected Cycle Split Donut + Server Formula Breakdown */}
              {simResult && activeCycle && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
                    gap: '12px',
                  }}
                >
                  <PotSplitDonut
                    cycle={activeCycle}
                    currencySymbol={currencySymbol}
                    labels={labels}
                  />

                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '.80rem', fontWeight: 700, color: 'var(--text)' }}>
                        {labels.formulaLedgerTitle || 'Server Calculation Breakdown'} ({labels.cycleLabel || 'Cycle'} #{activeCycle.periodNumber})
                      </span>
                    </div>
                    {activeCycle.formulaLines.map((line, lIdx) => (
                      <div
                        key={lIdx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '.78rem',
                          padding: '3px 0',
                          borderTop: line.sign === '=' ? '1px solid var(--border)' : 'none',
                          fontWeight: line.sign === '=' ? 700 : 500,
                          color: line.sign === '=' ? 'var(--primary-dark)' : 'var(--text-secondary)',
                        }}
                      >
                        <span>
                          {line.sign !== 'info' ? `${line.sign} ` : ''}
                          {line.label}
                        </span>
                        <span style={{ color: line.sign === '=' ? 'var(--primary-dark)' : 'var(--text)', fontWeight: 600 }}>
                          {line.label.toLowerCase().includes('gram')
                            ? `${line.amount.toFixed(4)} g`
                            : formatDecimalMoney(line.amount, currencySymbol)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Graphical Trend Chart */}
              {simResult && (
                <CycleTrendChart
                  cycles={simResult.cycles}
                  selectedCycleNumber={activeCycleNumber}
                  currencySymbol={currencySymbol}
                  labels={labels}
                  onSelectCycle={(cycleNum) => updateInput({ selectedCycle: cycleNum }, false)}
                />
              )}

              {/* Editable Per-Cycle Table */}
              {simResult && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '.86rem', fontWeight: 700, color: 'var(--text)' }}>
                      {labels.cycleTableTitle || 'Cycle-by-Cycle Editable Ledger'}
                    </h4>
                    <span style={{ fontSize: '.72rem', color: 'var(--text-secondary)' }}>
                      {labels.clickRowHint || 'Click any cycle row to inspect.'}
                    </span>
                  </div>

                  <div
                    className="table-wrapper"
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      maxHeight: '300px',
                      overflowY: 'auto',
                    }}
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>{labels.colCycle || 'Cycle'}</th>
                          <th>{labels.colPhase || 'Mode'}</th>
                          <th>{labels.colGrossPool || 'Gross Pool'}</th>
                          {engine === 'AUCTION_RESERVE_PRICE' && (
                            <th>{labels.colReserveFloor || 'Reserve Floor'}</th>
                          )}
                          {simResult.editableCycleField === 'bidDiscount' && (
                            <th>{labels.colBidDiscount || 'Bid Discount'} ({currencySymbol})</th>
                          )}
                          {simResult.editableCycleField === 'payoutAmount' && (
                            <th>{labels.colPayout || 'Chart Payout'} ({currencySymbol})</th>
                          )}
                          {simResult.editableCycleField === 'dividendPerTicket' && (
                            <th>{labels.colDividend || 'Dividend / Ticket'} ({currencySymbol})</th>
                          )}
                          {simResult.editableCycleField === 'variableDue' && (
                            <>
                              <th>{labels.baseInstalment || 'Non-Prized Due'} ({currencySymbol})</th>
                              <th>{labels.colPrizedDue || 'Prized Due'} ({currencySymbol})</th>
                            </>
                          )}
                          {simResult.editableCycleField === 'goldRatePerGram' && (
                            <>
                              <th>{labels.colGoldRate || 'Gold Rate / g'} ({currencySymbol})</th>
                              <th>{labels.colGoldGrams || 'Grams Credited'}</th>
                            </>
                          )}
                          {simResult.editableCycleField === 'internalLoanAmount' && (
                            <>
                              <th>{labels.colInternalLoan || 'Internal Loan'} ({currencySymbol})</th>
                              <th>{labels.colInterestEarned || 'Interest'}</th>
                            </>
                          )}
                          {simResult.editableCycleField === 'customRow' && (
                            <>
                              <th>{labels.colPayout || 'Payout'} ({currencySymbol})</th>
                              <th>{labels.colCommission || 'Comm'} ({currencySymbol})</th>
                            </>
                          )}
                          <th>{labels.colPayout || 'Winner Payout'}</th>
                          <th>{labels.colCommission || 'Commission'}</th>
                          <th>{labels.colDividend || 'Div / Member'}</th>
                          <th>{labels.colNextDue || 'Next Member Due'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {simResult.cycles.map((c) => {
                          const isRowSelected = c.periodNumber === activeCycleNumber;
                          return (
                            <tr
                              key={c.periodNumber}
                              onClick={() => updateInput({ selectedCycle: c.periodNumber }, false)}
                              style={{
                                cursor: 'pointer',
                                background: isRowSelected ? 'var(--primary-light)' : undefined,
                              }}
                            >
                              <td data-label={labels.colCycle || 'Cycle'} style={{ fontWeight: 700, color: isRowSelected ? 'var(--primary-dark)' : undefined }}>
                                #{c.periodNumber}
                              </td>
                              <td data-label={labels.colPhase || 'Mode'}>
                                <span style={{ fontSize: '.74rem', color: 'var(--text-secondary)' }}>
                                  {c.phase}
                                </span>
                              </td>
                              <td data-label={labels.colGrossPool || 'Pool'}>
                                {formatMoneyCompact(c.grossPool, currencySymbol)}
                              </td>
                              {engine === 'AUCTION_RESERVE_PRICE' && (
                                <td data-label={labels.colReserveFloor || 'Floor'}>
                                  {formatMoneyCompact(c.reserveFloorAmount ?? 0, currencySymbol)} ({c.reserveFloorPct ?? 0}%)
                                </td>
                              )}

                              {simResult.editableCycleField === 'bidDiscount' && (
                                <td data-label={labels.colBidDiscount || 'Bid Discount'} onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="number"
                                    min={0}
                                    max={simInput.chitValue - 1}
                                    step={500}
                                    style={inlineCellInputStyle}
                                    value={c.editableValue}
                                    onChange={(e) =>
                                      updateCycleOverride(c.periodNumber, {
                                        bidDiscount: Math.max(0, Number(e.target.value) || 0),
                                      })
                                    }
                                  />
                                </td>
                              )}

                              {simResult.editableCycleField === 'payoutAmount' && (
                                <td data-label={labels.colPayout || 'Chart Payout'} onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="number"
                                    min={1}
                                    step={500}
                                    style={inlineCellInputStyle}
                                    value={c.editableValue}
                                    onChange={(e) =>
                                      updateCycleOverride(c.periodNumber, {
                                        payoutAmount: Math.max(1, Number(e.target.value) || 1),
                                      })
                                    }
                                  />
                                </td>
                              )}

                              {simResult.editableCycleField === 'dividendPerTicket' && (
                                <td data-label={labels.colDividend || 'Dividend / Ticket'} onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="number"
                                    min={0}
                                    step={100}
                                    style={inlineCellInputStyle}
                                    value={c.editableValue}
                                    onChange={(e) =>
                                      updateCycleOverride(c.periodNumber, {
                                        dividendPerTicket: Math.max(0, Number(e.target.value) || 0),
                                      })
                                    }
                                  />
                                </td>
                              )}

                              {simResult.editableCycleField === 'variableDue' && (
                                <>
                                  <td data-label={labels.baseInstalment || 'Non-Prized'} onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="number"
                                      min={0}
                                      step={250}
                                      style={inlineCellInputStyle}
                                      value={c.nonPrizedInstalmentThisCycle}
                                      onChange={(e) =>
                                        updateCycleOverride(c.periodNumber, {
                                          nonPrizedDue: Math.max(0, Number(e.target.value) || 0),
                                        })
                                      }
                                    />
                                  </td>
                                  <td data-label={labels.colPrizedDue || 'Prized'} onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="number"
                                      min={0}
                                      step={250}
                                      style={inlineCellInputStyle}
                                      value={c.prizedInstalmentThisCycle}
                                      onChange={(e) =>
                                        updateCycleOverride(c.periodNumber, {
                                          prizedDue: Math.max(0, Number(e.target.value) || 0),
                                        })
                                      }
                                    />
                                  </td>
                                </>
                              )}

                              {simResult.editableCycleField === 'goldRatePerGram' && (
                                <>
                                  <td data-label={labels.colGoldRate || 'Rate/g'} onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="number"
                                      min={100}
                                      step={50}
                                      style={inlineCellInputStyle}
                                      value={c.goldRatePerGram}
                                      onChange={(e) =>
                                        updateCycleOverride(c.periodNumber, {
                                          goldRatePerGram: Math.max(100, Number(e.target.value) || 100),
                                        })
                                      }
                                    />
                                  </td>
                                  <td data-label={labels.colGoldGrams || 'Grams'} style={{ fontWeight: 600 }}>
                                    {c.goldGramsCredited.toFixed(4)} g
                                  </td>
                                </>
                              )}

                              {simResult.editableCycleField === 'internalLoanAmount' && (
                                <>
                                  <td data-label={labels.colInternalLoan || 'Loan'} onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="number"
                                      min={0}
                                      step={1000}
                                      style={inlineCellInputStyle}
                                      value={c.internalLoanDisbursed}
                                      onChange={(e) =>
                                        updateCycleOverride(c.periodNumber, {
                                          internalLoanAmount: Math.max(0, Number(e.target.value) || 0),
                                        })
                                      }
                                    />
                                  </td>
                                  <td data-label={labels.colInterestEarned || 'Interest'} style={{ color: 'var(--success)', fontWeight: 600 }}>
                                    {formatMoneyCompact(c.interestEarned, currencySymbol)}
                                  </td>
                                </>
                              )}

                              {simResult.editableCycleField === 'customRow' && (
                                <>
                                  <td data-label={labels.colPayout || 'Payout'} onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="number"
                                      min={1}
                                      step={500}
                                      style={inlineCellInputStyle}
                                      value={c.prizeAmount}
                                      onChange={(e) =>
                                        updateCycleOverride(c.periodNumber, {
                                          payoutAmount: Math.max(1, Number(e.target.value) || 1),
                                        })
                                      }
                                    />
                                  </td>
                                  <td data-label={labels.colCommission || 'Comm'} onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="number"
                                      min={0}
                                      step={250}
                                      style={inlineCellInputStyle}
                                      value={c.commission}
                                      onChange={(e) =>
                                        updateCycleOverride(c.periodNumber, {
                                          commission: Math.max(0, Number(e.target.value) || 0),
                                        })
                                      }
                                    />
                                  </td>
                                </>
                              )}

                              <td data-label={labels.colPayout || 'Winner Payout'} style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>
                                {formatMoneyCompact(c.prizeAmount, currencySymbol)}
                              </td>
                              <td data-label={labels.colCommission || 'Commission'}>
                                {formatMoneyCompact(c.commission, currencySymbol)}
                              </td>
                              <td data-label={labels.colDividend || 'Div / Member'}>
                                {formatDecimalMoney(c.dividendPerTicket, currencySymbol)}
                              </td>
                              <td data-label={labels.colNextDue || 'Next Member Due'}>
                                {formatDecimalMoney(c.nextCycleNetDueNonPrized, currencySymbol)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveTab('process')}
                >
                  ← {labels.backToProcess || 'Back: How It Works'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveTab('consolidated')}
                >
                  {labels.goToConsolidated || 'Next: Consolidated Result'} →
                </button>
              </div>
            </>
          )}

          {/* TAB 3: CONSOLIDATED RESULT */}
          {activeTab === 'consolidated' && simResult && (
            <>
              {/* 4 Consolidated KPI Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
                  gap: '12px',
                }}
              >
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
                  <div style={{ fontSize: '.70rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {labels.kpiTotalCollected || 'Total Net Collected'}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>
                    {formatMoneyCompact(simResult.consolidated.totalNetCollections, currencySymbol)}
                  </div>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {simResult.consolidated.totalCycles} {labels.colCycle || 'Cycles'} · {simResult.consolidated.totalTickets} Tickets
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
                  <div style={{ fontSize: '.70rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {engine === 'GOLD_WEIGHT_ACCUMULATION'
                      ? (labels.kpiTotalGoldGrams || 'Total Gold / Member')
                      : (labels.kpiTotalPayouts || 'Total Payouts Disbursed')}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-dark)', marginTop: '4px' }}>
                    {engine === 'GOLD_WEIGHT_ACCUMULATION'
                      ? `${simResult.consolidated.totalGoldGramsPerMember.toFixed(4)} g`
                      : formatMoneyCompact(simResult.consolidated.totalPrizePayouts, currencySymbol)}
                  </div>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {engine === 'GOLD_WEIGHT_ACCUMULATION'
                      ? `${labels.kpiAvgGoldRate || 'Avg Rate'}: ${formatDecimalMoney(simResult.consolidated.weightedAvgGoldRate, currencySymbol)}/g`
                      : `${labels.kpiAvgPayout || 'Avg Payout'}: ${formatMoneyCompact(simResult.consolidated.averagePrizePayout, currencySymbol)}`}
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
                  <div style={{ fontSize: '.70rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {labels.kpiForemanEarnings || 'Foreman Earnings'}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>
                    {formatMoneyCompact(simResult.consolidated.totalForemanEarnings, currencySymbol)}
                  </div>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {simResult.consolidated.totalGst > 0
                      ? `+GST: ${formatMoneyCompact(simResult.consolidated.totalGst, currencySymbol)}`
                      : `${labels.kpiRoundingIncome || 'Rounding'}: ${formatDecimalMoney(simResult.consolidated.totalRoundingIncome, currencySymbol)}`}
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
                  <div style={{ fontSize: '.70rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {simResult.consolidated.totalMerchantBonusOrInterest > 0
                      ? (labels.kpiTotalBonusInterest || 'Total Bonus / Interest')
                      : (labels.kpiTotalDividends || 'Total Dividends Shared')}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)', marginTop: '4px' }}>
                    {formatMoneyCompact(
                      simResult.consolidated.totalMerchantBonusOrInterest > 0
                        ? simResult.consolidated.totalMerchantBonusOrInterest
                        : simResult.consolidated.totalDividendsDistributed,
                      currencySymbol,
                    )}
                  </div>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {labels.kpiAvgDividendCycle || 'Avg / Cycle'}: {formatMoneyCompact(simResult.consolidated.averageDividendPerCycle, currencySymbol)}
                  </div>
                </div>
              </div>

              {/* Consolidated Visual Chart + Accounting Reconciliation */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '12px' }}>
                <ConsolidatedComparisonChart
                  journeys={simResult.memberJourneys}
                  currencySymbol={currencySymbol}
                  labels={labels}
                />

                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px',
                    overflow: 'hidden',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '.80rem', fontWeight: 700, color: 'var(--text)' }}>
                        {labels.reconciliationTitle || 'Pool Accounting Reconciliation'}
                      </span>
                      <span className={simResult.consolidated.balanceCheck.isBalanced ? 'badge badge-active' : 'badge badge-partial'} style={{ fontSize: '.70rem' }}>
                        {simResult.consolidated.balanceCheck.isBalanced
                          ? (labels.balancedLabel || 'Reconciled')
                          : (labels.unbalancedLabel || 'Variance')}
                      </span>
                    </div>

                    {/* Stacked Consolidated Allocation Bar */}
                    <div
                      style={{
                        height: '10px',
                        width: '100%',
                        background: 'var(--bg)',
                        borderRadius: '5px',
                        overflow: 'hidden',
                        display: 'flex',
                        marginBottom: '10px',
                      }}
                    >
                      <div style={{ width: `${simResult.consolidated.consolidatedSplitPct.payoutPct}%`, background: 'var(--primary)' }} />
                      <div style={{ width: `${simResult.consolidated.consolidatedSplitPct.dividendOrBonusPct}%`, background: 'var(--info)' }} />
                      <div style={{ width: `${simResult.consolidated.consolidatedSplitPct.commissionPct}%`, background: 'var(--warning)' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '.78rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{labels.inflowLabel || 'Total Inflows'}</span>
                        <strong style={{ color: 'var(--text)' }}>{formatDecimalMoney(simResult.consolidated.balanceCheck.inflowTotal, currencySymbol)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{labels.outflowLabel || 'Total Outflows'}</span>
                        <strong style={{ color: 'var(--text)' }}>{formatDecimalMoney(simResult.consolidated.balanceCheck.outflowTotal, currencySymbol)}</strong>
                      </div>
                      {Math.abs(simResult.consolidated.endingPoolSurplus) > 0.01 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{labels.surplusLabel || 'Retained Pool Surplus / (Draw)'}</span>
                          <strong style={{ color: simResult.consolidated.endingPoolSurplus >= 0 ? 'var(--success)' : 'var(--warning)' }}>
                            {formatDecimalMoney(simResult.consolidated.endingPoolSurplus, currencySymbol)}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Subscriber Perspective Comparison Table */}
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: '.86rem', fontWeight: 700, color: 'var(--text)' }}>
                  {labels.subscriberCompareTitle || 'Early Winner vs Mid Winner vs Patient Saver'}
                </h4>
                <div className="table-wrapper" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>{labels.colMemberRole || 'Member Profile'}</th>
                        <th>{labels.colWinCycle || 'Win Cycle'}</th>
                        <th>{labels.colTotalBase || 'Base Contributions'}</th>
                        <th>{labels.colDividendsSaved || 'Dividends / Bonus'}</th>
                        <th>{labels.colExtraPaid || 'Extra Premium'}</th>
                        <th>{labels.colNetPaid || 'Total Net Paid'}</th>
                        <th>{labels.colReceived || 'Payout / Maturity'}</th>
                        <th>{labels.colNetOutcome || 'Net Gain / (Cost)'}</th>
                        <th>{labels.colEffectivePct || 'Net %'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simResult.memberJourneys.map((j) => {
                        const roleName =
                          j.role === 'early'
                            ? formatLocalizedTemplate(labels.personaEarly || 'Early Winner (Cycle {cycle})', { cycle: j.winCycle })
                            : j.role === 'mid'
                              ? formatLocalizedTemplate(labels.personaMid || 'Mid Winner (Cycle {cycle})', { cycle: j.winCycle })
                              : formatLocalizedTemplate(labels.personaLate || 'Patient Saver (Cycle {cycle})', { cycle: j.winCycle });
                        const isGain = j.netGainOrCost >= 0;
                        return (
                          <tr key={j.role}>
                            <td data-label={labels.colMemberRole || 'Profile'} style={{ fontWeight: 600 }}>{roleName}</td>
                            <td data-label={labels.colWinCycle || 'Win'}>#{j.winCycle}</td>
                            <td data-label={labels.colTotalBase || 'Base'}>{formatMoneyCompact(j.totalBaseDue, currencySymbol)}</td>
                            <td data-label={labels.colDividendsSaved || 'Saved'}>{formatDecimalMoney(j.totalDividendsReceived, currencySymbol)}</td>
                            <td data-label={labels.colExtraPaid || 'Extra'}>{formatMoneyCompact(j.totalPremiumOrInterestPaid, currencySymbol)}</td>
                            <td data-label={labels.colNetPaid || 'Net Paid'} style={{ fontWeight: 600 }}>{formatDecimalMoney(j.totalNetPaid, currencySymbol)}</td>
                            <td data-label={labels.colReceived || 'Received'} style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>
                              {formatMoneyCompact(j.prizeOrMaturityReceived, currencySymbol)}
                            </td>
                            <td data-label={labels.colNetOutcome || 'Outcome'} style={{ fontWeight: 700, color: isGain ? 'var(--success)' : 'var(--danger)' }}>
                              {isGain ? '+' : ''}
                              {formatDecimalMoney(j.netGainOrCost, currencySymbol)}
                            </td>
                            <td data-label={labels.colEffectivePct || 'Net %'}>
                              <span className={isGain ? 'badge badge-active' : 'badge badge-partial'} style={{ fontSize: '.70rem' }}>
                                {isGain ? '+' : ''}
                                {j.effectiveReturnPct.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveTab('simulator')}
                >
                  ← {labels.backToSimulator || 'Back: Live Simulator'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '.76rem', color: 'var(--text-secondary)' }}>
            {isCustomized
              ? (labels.customizedNotice || 'Custom values simulated. Applying will copy these exact numbers into the form.')
              : isApplied
                ? (labels.appliedNotice || 'This template is currently applied to the form.')
                : (labels.readyNotice || 'Edit values inside Live Simulator or apply directly to autofill the form.')}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              {labels.close || 'Close'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleApply}
            >
              {isCustomized
                ? (labels.applyCustomized || 'Apply Customized Values to Form')
                : isApplied
                  ? (labels.keepAndReturn || 'Keep & Return to Form')
                  : (labels.applyDefault || 'Apply This Template to Form')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
