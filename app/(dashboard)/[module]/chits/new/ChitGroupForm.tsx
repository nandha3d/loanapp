'use client';

import { useState } from 'react';
import { createChitGroup } from '../actions';
import { useRouter } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';
import {
  nextPeriodDate,
  frequencyLabel,
  collectionFrequencyToConfig,
  type FrequencyConfig,
} from '@/lib/chits/frequency';
import {
  BIDDING_MODES,
  CHIT_ENGINE_CATALOG,
  CHIT_SECURITY_TYPES,
  COLLECTION_FREQUENCIES,
  DEFAULT_ENABLED_CHIT_ENGINE_TYPES,
  FOREMAN_COMPENSATION_MODES,
  LATE_FEE_TYPES,
  PAYOUT_ASSET_TYPES,
  REGULATORY_TIERS,
  SCALE_TIERS,
  mapBiddingModeToAuctionType,
  type ChitEngineCategory,
  type ChitEngineConfig,
  type ChitEngineType,
} from '@/lib/chits/engineTypes';
import {
  PRACTICAL_CHIT_TEMPLATES,
  type ChitTemplateCode,
  type ChitTemplateDefinition,
} from '@/lib/chits/templates';
import ChitTemplateExplainerModal, {
  type ChitTemplateApplyOverrides,
} from '@/components/chits/ChitTemplateExplainerModal';

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' }, { value: 0, label: 'Sun' },
];

const sectionStyle: React.CSSProperties = { marginBottom: '20px' };
const sectionTitleStyle: React.CSSProperties = { margin: '0 0 12px', fontSize: '.95rem', borderBottom: '1px solid var(--border)', paddingBottom: '6px' };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' };
const hintStyle: React.CSSProperties = { fontSize: '.75rem', color: 'var(--text-secondary)', marginTop: '4px' };

const FLEXIBLE_VALUE_ENGINES = new Set<ChitEngineType>([
  'BASE_PLUS_PREMIUM',
  'FIXED_CHART_ESCALATING',
  'FIXED_PAYOUT_VARIABLE_PAY',
  'GOLD_VALUE_ACCUMULATION',
  'GOLD_WEIGHT_ACCUMULATION',
  'FESTIVAL_COMMODITY',
  'ASCA_SHG_REVOLVING',
  'CUSTOM_MANUAL_SCHEDULE',
]);

export default function ChitGroupForm({
  customers,
  currencySymbol,
  dict,
  lang = 'en',
  enabledChitTypes,
  typeDefaults,
}: {
  customers: { id: string; name: string; customerCode: string }[];
  currencySymbol: string;
  dict: any;
  lang?: string;
  enabledChitTypes?: ChitEngineType[];
  typeDefaults?: Partial<Record<ChitEngineType, ChitEngineConfig>>;
}) {
  const d = dict.chits;
  const router = useRouter();
  const availableTypes =
    enabledChitTypes && enabledChitTypes.length > 0
      ? enabledChitTypes
      : [...DEFAULT_ENABLED_CHIT_ENGINE_TYPES];

  const [selectedEngine, setSelectedEngine] = useState<ChitEngineType>(availableTypes[0]);
  const initialCfg =
    typeDefaults?.[availableTypes[0]]
      ? structuredClone(typeDefaults[availableTypes[0]]!)
      : structuredClone(CHIT_ENGINE_CATALOG[availableTypes[0]].defaultConfig);

  const [engineConfig, setEngineConfig] = useState<ChitEngineConfig>(initialCfg);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalMembers, setTotalMembers] = useState(5);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<ChitTemplateCode | null>(null);
  const [explainerTemplate, setExplainerTemplate] = useState<ChitTemplateDefinition | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | ChitEngineCategory>('ALL');
  const [groupName, setGroupName] = useState('');
  const [chitValue, setChitValue] = useState(0);
  const [monthlyContrib, setMonthlyContrib] = useState(0);
  const [chitType, setChitType] = useState(
    initialCfg.regulatoryTier === 'REGISTERED_ACT_1982' ? 'registered' : 'unregistered',
  );
  const [auctionType, setAuctionType] = useState(
    mapBiddingModeToAuctionType(availableTypes[0], initialCfg.biddingMode),
  );
  const [auctionFrequency, setAuctionFrequency] = useState('monthly');
  const [frequencyMode, setFrequencyMode] = useState<'preset' | 'custom'>('preset');
  const [customUnit, setCustomUnit] = useState<'day' | 'week' | 'month'>('month');
  const [customInterval, setCustomInterval] = useState(1);
  const [customWeekdays, setCustomWeekdays] = useState<number[]>([]);
  const [startDate, setStartDate] = useState('');
  const [bidStartAtCommission, setBidStartAtCommission] = useState(true);
  const [commissionPct, setCommissionPct] = useState(initialCfg.foremanCompensation.commissionPct);
  const [commissionBasis, setCommissionBasis] = useState<'BID_DISCOUNT' | 'CHIT_VALUE'>('BID_DISCOUNT');
  const [minDiscountPct, setMinDiscountPct] = useState<string>(
    initialCfg.discountRules.minDiscountPct > 0 ? String(initialCfg.discountRules.minDiscountPct) : '',
  );
  const [maxDiscountPct, setMaxDiscountPct] = useState<string>(
    initialCfg.discountRules.maxDiscountPct != null ? String(initialCfg.discountRules.maxDiscountPct) : '',
  );
  const [dividendPolicy, setDividendPolicy] = useState(
    initialCfg.dividendDistributionMode === 'NON_PRIZED_ONLY'
      ? 'NON_PRIZED_ONLY'
      : initialCfg.dividendDistributionMode === 'NON_WINNERS_ONLY'
        ? 'NON_WINNERS_ONLY'
        : initialCfg.dividendDistributionMode === 'NONE'
          ? 'NONE'
          : 'ALL_MEMBERS',
  );
  const [dividendDistribution, setDividendDistribution] = useState(
    initialCfg.dividendDistributionMode === 'DEFERRED_BONUS_POOL'
      ? 'DEFERRED_BONUS_POOL'
      : initialCfg.dividendDistributionMode === 'NONE'
        ? 'NONE'
        : 'ADJUST_NEXT_DUE',
  );
  const [bellEnabled, setBellEnabled] = useState(true);
  const [bellAutoClose, setBellAutoClose] = useState(true);
  const [hasForemanTicket, setHasForemanTicket] = useState(false);
  const [winnerInterestType, setWinnerInterestType] = useState('NONE');
  const [winnerInterestValue, setWinnerInterestValue] = useState(0);
  const [winnerInterestPeriods, setWinnerInterestPeriods] = useState(0);
  const [csvScheduleText, setCsvScheduleText] = useState('');

  const catalogItem = CHIT_ENGINE_CATALOG[selectedEngine];
  const isDrawType = !catalogItem.supportsBidding || auctionType === 'lottery' || auctionType === 'fixed_rotation';
  const requiresStrictPotCheck = !FLEXIBLE_VALUE_ENGINES.has(selectedEngine);

  const selectEngineType = (code: ChitEngineType) => {
    setSelectedEngine(code);
    const nextCfg = typeDefaults?.[code]
      ? structuredClone(typeDefaults[code]!)
      : structuredClone(CHIT_ENGINE_CATALOG[code].defaultConfig);
    setEngineConfig(nextCfg);
    setChitType(nextCfg.regulatoryTier === 'REGISTERED_ACT_1982' ? 'registered' : 'unregistered');
    setAuctionType(mapBiddingModeToAuctionType(code, nextCfg.biddingMode));
    setCommissionPct(nextCfg.foremanCompensation.commissionPct);
    setMinDiscountPct(nextCfg.discountRules.minDiscountPct > 0 ? String(nextCfg.discountRules.minDiscountPct) : '');
    setMaxDiscountPct(nextCfg.discountRules.maxDiscountPct != null ? String(nextCfg.discountRules.maxDiscountPct) : '');
    if (nextCfg.dividendDistributionMode === 'NON_PRIZED_ONLY') {
      setDividendPolicy('NON_PRIZED_ONLY');
      setDividendDistribution('ADJUST_NEXT_DUE');
    } else if (nextCfg.dividendDistributionMode === 'NON_WINNERS_ONLY') {
      setDividendPolicy('NON_WINNERS_ONLY');
      setDividendDistribution('ADJUST_NEXT_DUE');
    } else if (nextCfg.dividendDistributionMode === 'DEFERRED_BONUS_POOL') {
      setDividendPolicy('ALL_MEMBERS');
      setDividendDistribution('DEFERRED_BONUS_POOL');
    } else if (nextCfg.dividendDistributionMode === 'NONE') {
      setDividendPolicy('NONE');
      setDividendDistribution('NONE');
    } else {
      setDividendPolicy('ALL_MEMBERS');
      setDividendDistribution('ADJUST_NEXT_DUE');
    }
    const freqCfg = collectionFrequencyToConfig(nextCfg.collectionFrequency);
    if (nextCfg.collectionFrequency === 'DAILY_25' || nextCfg.collectionFrequency === 'BI_MONTHLY') {
      setFrequencyMode('custom');
      setCustomUnit(freqCfg.unit);
      setCustomInterval(freqCfg.interval);
      setCustomWeekdays(freqCfg.weekdays ?? []);
    } else {
      setFrequencyMode('preset');
      setAuctionFrequency(
        nextCfg.collectionFrequency === 'DAILY_30'
          ? 'daily'
          : nextCfg.collectionFrequency === 'WEEKLY'
            ? 'weekly'
            : nextCfg.collectionFrequency === 'FORTNIGHTLY'
              ? 'fortnightly'
              : 'monthly',
      );
    }
  };

  const applyTemplate = (
    tmpl: ChitTemplateDefinition,
    customOverrides?: ChitTemplateApplyOverrides,
  ) => {
    setActiveTemplate(tmpl.code);

    let targetEngine: ChitEngineType = tmpl.engineType;
    if (!availableTypes.includes(targetEngine)) {
      if (
        targetEngine === 'HYBRID_SPLIT_PHASE' ||
        targetEngine === 'MICRO_DAILY_COLLECTION' ||
        targetEngine === 'BASE_PLUS_PREMIUM'
      ) {
        targetEngine = availableTypes.includes('AUCTION_STANDARD') ? 'AUCTION_STANDARD' : availableTypes[0];
      } else if (
        targetEngine === 'GOLD_VALUE_ACCUMULATION' ||
        targetEngine === 'FESTIVAL_COMMODITY'
      ) {
        targetEngine = availableTypes.includes('FIXED_ROTATION') ? 'FIXED_ROTATION' : availableTypes[0];
      } else {
        targetEngine = availableTypes[0];
      }
    }

    selectEngineType(targetEngine);

    const localizedTitle = (d.templates as any)?.[tmpl.code]?.title || tmpl.defaultName;
    setGroupName(localizedTitle);
    setChitValue(customOverrides?.chitValue ?? tmpl.defaultChitValue);
    setMonthlyContrib(customOverrides?.monthlyContrib ?? tmpl.defaultMonthlyContrib);
    setTotalMembers(customOverrides?.totalMembers ?? tmpl.defaultTotalMembers);
    setChitType(tmpl.defaultChitType);
    setAuctionType(tmpl.defaultAuctionType);
    setCommissionPct(customOverrides?.commissionPct ?? tmpl.defaultCommissionPct);
    if (customOverrides?.commissionBasis) {
      setCommissionBasis(customOverrides.commissionBasis);
    }
    setHasForemanTicket(tmpl.defaultHasForemanTicket);
    setDividendPolicy(customOverrides?.dividendPolicy ?? tmpl.defaultDividendPolicy);
    setDividendDistribution(tmpl.defaultDividendDistribution);
    setWinnerInterestType(tmpl.defaultWinnerInterestType);
    if (customOverrides?.prizedPremiumAmount != null && tmpl.defaultWinnerInterestValue != null) {
      setWinnerInterestValue(customOverrides.prizedPremiumAmount);
    } else if (tmpl.defaultWinnerInterestValue != null) {
      setWinnerInterestValue(tmpl.defaultWinnerInterestValue);
    }
    if (tmpl.defaultFixedDiscountPct != null) {
      setMinDiscountPct(String(tmpl.defaultFixedDiscountPct));
      setMaxDiscountPct(String(tmpl.defaultFixedDiscountPct));
    }

    if (customOverrides) {
      setEngineConfig((prev) => ({
        ...prev,
        foremanCompensation: {
          ...prev.foremanCompensation,
          commissionPct: customOverrides.commissionPct,
        },
        discountRules: {
          ...prev.discountRules,
          ...(customOverrides.reservePriceStepPct != null
            ? { reservePriceStepPct: customOverrides.reservePriceStepPct }
            : {}),
        },
        differentialInstalment: {
          ...prev.differentialInstalment,
          baseInstalment: customOverrides.monthlyContrib,
          ...(customOverrides.prizedPremiumAmount != null
            ? { prizedPremiumAmount: customOverrides.prizedPremiumAmount }
            : {}),
        },
        ...(prev.goldScheme
          ? {
              goldScheme: {
                ...prev.goldScheme,
                ...(customOverrides.goldBonusMonths != null
                  ? { bonusMonths: customOverrides.goldBonusMonths }
                  : {}),
                ...(customOverrides.goldRatePerGram != null
                  ? { defaultGoldRatePerGram: customOverrides.goldRatePerGram }
                  : {}),
              },
            }
          : {}),
        ...(prev.commodityScheme && customOverrides.merchantBonusPct != null
          ? {
              commodityScheme: {
                ...prev.commodityScheme,
                merchantBonusPct: customOverrides.merchantBonusPct,
              },
            }
          : {}),
        ...(prev.hybridSplitPhase
          ? {
              hybridSplitPhase: {
                ...prev.hybridSplitPhase,
                ...(customOverrides.reservedCyclesCount != null
                  ? { reservedCyclesCount: customOverrides.reservedCyclesCount }
                  : {}),
                ...(customOverrides.reservedDiscountPct != null
                  ? { reservedDiscountPct: customOverrides.reservedDiscountPct }
                  : {}),
              },
            }
          : {}),
        ...(prev.ascaPool && customOverrides.ascaMonthlyLoanInterestPct != null
          ? {
              ascaPool: {
                ...prev.ascaPool,
                monthlyLoanInterestPct: customOverrides.ascaMonthlyLoanInterestPct,
              },
            }
          : {}),
      }));
    }

    if (tmpl.defaultFrequency === 'daily') {
      setFrequencyMode('custom');
      setCustomUnit(tmpl.customUnit || 'day');
      setCustomInterval(tmpl.customInterval || 1);
      setAuctionFrequency('daily');
    } else {
      setFrequencyMode('preset');
      setAuctionFrequency(tmpl.defaultFrequency);
    }
  };

  const toggleWeekday = (day: number) => {
    setCustomWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  const previewDates = (() => {
    const base = startDate ? new Date(startDate) : null;
    if (!base || Number.isNaN(base.getTime())) return [];
    const freq: FrequencyConfig =
      frequencyMode === 'custom'
        ? { unit: customUnit, interval: customInterval, weekdays: customWeekdays.length ? customWeekdays : null }
        : collectionFrequencyToConfig(auctionFrequency);
    return [1, 2, 3].map((period) => nextPeriodDate(base, period, freq));
  })();

  const interestPerPeriod =
    winnerInterestType === 'FIXED'
      ? winnerInterestValue
      : winnerInterestType === 'PERCENT'
        ? (chitValue * winnerInterestValue) / 100
        : 0;
  const winnerDuePreview = monthlyContrib + interestPerPeriod;

  const generateEscalatingChart = () => {
    const startPayout = Math.round(chitValue * 0.82);
    const endPayout = Math.round(chitValue * 1.15);
    const rows = Array.from({ length: totalMembers }, (_, i) => {
      const ratio = totalMembers > 1 ? i / (totalMembers - 1) : 1;
      return { period: i + 1, payoutAmount: Math.round(startPayout + (endPayout - startPayout) * ratio) };
    });
    setEngineConfig((c) => ({ ...c, escalatingPayouts: rows }));
  };

  const generateTaperingDividends = () => {
    const maxDiv = Math.round(monthlyContrib * 0.25);
    const rows = Array.from({ length: totalMembers }, (_, i) => {
      const ratio = totalMembers > 1 ? 1 - i / (totalMembers - 1) : 0;
      return { period: i + 1, dividendPerTicket: Math.round(maxDiv * ratio) };
    });
    setEngineConfig((c) => ({ ...c, fixedDividends: rows }));
  };

  const parseManualCsv = () => {
    const lines = csvScheduleText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const rows = lines
      .map((line, idx) => {
        const parts = line.split(',').map((p) => p.trim());
        if (parts.length < 4 || Number.isNaN(Number(parts[0]))) return null;
        return {
          period: Number(parts[0]) || idx + 1,
          instalmentNonPrized: Number(parts[1]) || 0,
          instalmentPrized: Number(parts[2]) || 0,
          payoutAmount: Number(parts[3]) || 0,
          commission: Number(parts[4] ?? 0) || 0,
          dividendPerTicket: parts[5] !== undefined ? Number(parts[5]) || 0 : undefined,
        };
      })
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
    if (rows.length > 0) {
      setEngineConfig((c) => ({ ...c, customSchedule: rows }));
    }
  };

  const addMemberSlot = () => {
    if (selectedMembers.length < totalMembers) setSelectedMembers([...selectedMembers, '']);
  };
  const updateMember = (idx: number, val: string) => {
    const updated = [...selectedMembers];
    updated[idx] = val;
    setSelectedMembers(updated);
  };
  const removeMember = (idx: number) => setSelectedMembers(selectedMembers.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (requiresStrictPotCheck && chitValue > 0 && monthlyContrib > 0 && chitValue !== monthlyContrib * totalMembers) {
      setError(`Chit value must equal installment × total members (${monthlyContrib} × ${totalMembers} = ${monthlyContrib * totalMembers})`);
      setLoading(false);
      return;
    }
    const fd = new FormData(e.currentTarget);
    const finalConfig: ChitEngineConfig = {
      ...engineConfig,
      chitType: selectedEngine,
      foremanCompensation: {
        ...engineConfig.foremanCompensation,
        commissionPct,
      },
      discountRules: {
        ...engineConfig.discountRules,
        minDiscountPct: minDiscountPct ? Number(minDiscountPct) : 0,
        maxDiscountPct: engineConfig.discountRules.uncapped
          ? null
          : maxDiscountPct
            ? Number(maxDiscountPct)
            : null,
      },
      differentialInstalment:
        selectedEngine === 'BASE_PLUS_PREMIUM'
          ? {
            enabled: true,
            baseInstalment: engineConfig.differentialInstalment.baseInstalment || monthlyContrib,
            prizedPremiumAmount: engineConfig.differentialInstalment.prizedPremiumAmount,
          }
          : engineConfig.differentialInstalment,
    };
    fd.set('chitEngineType', selectedEngine);
    fd.set('engineConfig', JSON.stringify(finalConfig));
    selectedMembers.forEach((id) => {
      if (id) fd.append('memberIds', id);
    });
    try {
      await createChitGroup(fd);
    } catch (err: any) {
      setError(err.message || d.failed);
      setLoading(false);
    }
  };

  const availableCustomers = (idx: number) =>
    customers.filter((c) => !selectedMembers.some((id, i) => i !== idx && id === c.id));

  return (
    <div
      className="grid-60-40 chit-create-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.25fr) minmax(360px, 440px)',
        gap: '24px',
        alignItems: 'start',
      }}
    >
      <style>{`
        @media (max-width: 1080px) {
          .chit-create-grid {
            grid-template-columns: 1fr !important;
          }
        }
        .chit-templates-scroll-list::-webkit-scrollbar {
          width: 5px;
        }
        .chit-templates-scroll-list::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 4px;
        }
      `}</style>

      {/* Main Creation Form on the Left */}
      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: '100%' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <h3>{d.createGroup}</h3>
          <Link href="/settings?tab=chittypes" className="btn btn-ghost btn-sm">
            {d.configureChitTypesLink || 'Enable / configure more chit types'}
          </Link>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ margin: '0 0 16px', padding: '10px 14px', background: '#fff0f0', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {/* Compact banner if a template is active */}
        {activeTemplate && (
          <div
            style={{
              margin: '0 0 16px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#dcfce7',
              border: '1px solid #86efac',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '.80rem',
            }}
          >
            <span style={{ color: '#15803d', fontWeight: 600 }}>
              ✓ {d.templateActiveBadge || 'Template Applied — All fields remain 100% editable'}
            </span>
            <button
              type="button"
              onClick={() => setActiveTemplate(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '.74rem',
                textDecoration: 'underline',
              }}
            >
              {d.clearTemplate || 'Clear template indicator'}
            </button>
          </div>
        )}

        <p style={{ ...hintStyle, marginBottom: '16px' }}>
          Groups are saved as drafts. A group can be activated only after members, tickets, and (for registered chits) compliance details are complete.
        </p>

        {/* 1. Basic details */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>1. Basic details</h4>
          <div style={gridStyle}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">{d.groupName} *</label>
              <input
                name="name"
                type="text"
                className="form-control"
                required
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. January 2026 Group"
              />
            </div>
            <div className="form-group">
              <label className="form-label">{d.chitValue} ({currencySymbol}) *</label>
              <input
                name="chitValue"
                type="number"
                className="form-control"
                required
                min="100"
                placeholder="e.g. 100000"
                value={chitValue || ''}
                onChange={(e) => setChitValue(Number(e.target.value))}
              />
              {requiresStrictPotCheck && chitValue > 0 && monthlyContrib > 0 && chitValue !== monthlyContrib * totalMembers && (
                <p style={{ ...hintStyle, color: 'var(--danger)' }}>
                  Must equal {monthlyContrib} × {totalMembers} = {monthlyContrib * totalMembers}
                </p>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Installment amount ({currencySymbol}) *</label>
              <input
                name="monthlyContrib"
                type="number"
                className="form-control"
                required
                min="10"
                placeholder="e.g. 5000"
                value={monthlyContrib || ''}
                onChange={(e) => setMonthlyContrib(Number(e.target.value))}
              />
              <p style={hintStyle}>Base instalment per full ticket per cycle.</p>
            </div>
            <div className="form-group">
              <label className="form-label">{d.totalMembers} *</label>
              <input
                name="totalMembers"
                type="number"
                className="form-control"
                required
                min="2"
                max="200"
                value={totalMembers}
                onChange={(e) => setTotalMembers(parseInt(e.target.value) || 2)}
              />
              <p style={hintStyle}>Group runs {totalMembers} cycles.</p>
            </div>
            <div className="form-group">
              <label className="form-label">{d.startDate} *</label>
              <input name="startDate" type="date" className="form-control" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Compliance classification *</label>
              <select name="chitType" className="form-control" value={chitType} onChange={(e) => setChitType(e.target.value)}>
                <option value="unregistered">Unregistered (private/informal chit)</option>
                <option value="registered">Registered (registrar-approved chit)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{d.regulatoryTier || 'Regulatory tier'}</label>
              <select
                className="form-control"
                value={engineConfig.regulatoryTier}
                onChange={(e) => setEngineConfig((c) => ({ ...c, regulatoryTier: e.target.value as any }))}
              >
                {REGULATORY_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{d.scaleTier || 'Scale tier'}</label>
              <select
                className="form-control"
                value={engineConfig.scaleTier}
                onChange={(e) => setEngineConfig((c) => ({ ...c, scaleTier: e.target.value as any }))}
              >
                {SCALE_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{d.payoutAssetType || 'Payout asset'}</label>
              <select
                className="form-control"
                value={engineConfig.payoutAssetType}
                onChange={(e) => setEngineConfig((c) => ({ ...c, payoutAssetType: e.target.value as any }))}
              >
                {PAYOUT_ASSET_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* 2. Chit style & frequency */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>2. Chit style &amp; cadence</h4>
          <div style={gridStyle}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">{d.selectEngineType || 'Chit engine model'}</label>
              <select
                className="form-control"
                value={selectedEngine}
                onChange={(e) => selectEngineType(e.target.value as ChitEngineType)}
              >
                {availableTypes.map((code) => {
                  const item = CHIT_ENGINE_CATALOG[code];
                  return (
                    <option key={code} value={code}>
                      {d.engineNames?.[code] || item.name} ({item.regionalNames})
                    </option>
                  );
                })}
              </select>
              <p style={hintStyle}>{d.engineDescs?.[selectedEngine] || catalogItem.description}</p>
            </div>

            <div className="form-group">
              <label className="form-label">Auction / resolution mode *</label>
              <select name="auctionType" className="form-control" value={auctionType} onChange={(e) => setAuctionType(e.target.value as typeof auctionType)}>
                <option value="open_manual">Open auction — staff enters bids</option>
                <option value="open_live">Open live — online bidding room</option>
                <option value="sealed">Sealed tender — bids hidden until close</option>
                <option value="lottery">Lottery — winner drawn at random</option>
                <option value="fixed_rotation">Fixed rotation — payout by ticket order</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Bidding mode</label>
              <select
                className="form-control"
                value={engineConfig.biddingMode}
                onChange={(e) => {
                  const bm = e.target.value as any;
                  setEngineConfig((c) => ({ ...c, biddingMode: bm }));
                  setAuctionType(mapBiddingModeToAuctionType(selectedEngine, bm));
                }}
              >
                {BIDDING_MODES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Frequency *</label>
              <select
                className="form-control"
                value={frequencyMode === 'custom' ? 'custom' : auctionFrequency}
                onChange={(e) => {
                  if (e.target.value === 'custom') setFrequencyMode('custom');
                  else {
                    setFrequencyMode('preset');
                    setAuctionFrequency(e.target.value);
                  }
                }}
              >
                <option value="monthly">Monthly</option>
                <option value="fortnightly">Bi-weekly (every 2 weeks)</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
                <option value="custom">Custom…</option>
              </select>
              <input type="hidden" name="auctionFrequency" value={frequencyMode === 'custom' ? 'monthly' : auctionFrequency} />
              {frequencyMode === 'custom' && (
                <>
                  <input type="hidden" name="frequencyUnit" value={customUnit} />
                  <input type="hidden" name="frequencyInterval" value={customInterval} />
                  <input type="hidden" name="frequencyWeekdays" value={customWeekdays.join(',')} />
                </>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">{d.collectionFrequency || 'Collection frequency preset'}</label>
              <select
                className="form-control"
                value={engineConfig.collectionFrequency}
                onChange={(e) => {
                  const cf = e.target.value as any;
                  setEngineConfig((c) => ({ ...c, collectionFrequency: cf }));
                  const fc = collectionFrequencyToConfig(cf);
                  setFrequencyMode('custom');
                  setCustomUnit(fc.unit);
                  setCustomInterval(fc.interval);
                  setCustomWeekdays(fc.weekdays ?? []);
                }}
              >
                {COLLECTION_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Auction day</label>
              <input name="auctionDay" type="number" className="form-control" min="1" max="31" placeholder={auctionFrequency === 'weekly' ? '1-7 (Mon-Sun)' : 'Day of month'} />
            </div>
            <div className="form-group">
              <label className="form-label">Default auction time</label>
              <input name="auctionTime" type="time" className="form-control" />
            </div>

            {frequencyMode === 'custom' && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Custom frequency</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '.85rem' }}>Every</span>
                  <input type="number" min="1" className="form-control" style={{ width: '70px' }} value={customInterval} onChange={(e) => setCustomInterval(Math.max(1, parseInt(e.target.value) || 1))} />
                  <select className="form-control" style={{ width: 'auto' }} value={customUnit} onChange={(e) => setCustomUnit(e.target.value as 'day' | 'week' | 'month')}>
                    <option value="day">day(s)</option>
                    <option value="week">week(s)</option>
                    <option value="month">month(s)</option>
                  </select>
                  {customUnit !== 'month' && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {WEEKDAY_OPTIONS.map((w) => (
                        <button
                          type="button"
                          key={w.value}
                          onClick={() => toggleWeekday(w.value)}
                          className={`btn btn-sm ${customWeekdays.includes(w.value) ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {previewDates.length > 0 && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <p style={{ ...hintStyle, margin: 0 }}>
                  {frequencyLabel(
                    frequencyMode === 'custom'
                      ? { unit: customUnit, interval: customInterval, weekdays: customWeekdays.length ? customWeekdays : null }
                      : collectionFrequencyToConfig(auctionFrequency),
                  )}{' '}
                  — first periods: {previewDates.map((d2) => d2.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })).join(', ')}
                </p>
              </div>
            )}

            {isDrawType && (
              <div className="form-group">
                <label className="form-label">Fixed discount %</label>
                <input name="fixedDiscountPct" type="number" className="form-control" step="0.5" min="0" placeholder="e.g. 0 or 10" />
              </div>
            )}
          </div>
        </div>

        {/* Engine-specific rules */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Engine-specific parameters ({selectedEngine})</h4>
          <div style={gridStyle}>
            {selectedEngine === 'AUCTION_RESERVE_PRICE' && (
              <div className="form-group">
                <label className="form-label">{d.reserveStepPct || 'Reserve price step % per remaining cycle'}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  className="form-control"
                  value={engineConfig.discountRules.reservePriceStepPct}
                  onChange={(e) =>
                    setEngineConfig((c) => ({
                      ...c,
                      discountRules: { ...c.discountRules, reservePriceStepPct: Number(e.target.value) || 0 },
                    }))
                  }
                />
                {chitValue > 0 && (
                  <p style={hintStyle}>
                    Cycle 1 floor: {currencySymbol}
                    {Math.round((engineConfig.discountRules.reservePriceStepPct / 100) * chitValue * totalMembers).toLocaleString('en-IN')}
                    {' '}· Final cycle floor: {currencySymbol}
                    {Math.round((engineConfig.discountRules.reservePriceStepPct / 100) * chitValue).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            )}

            {selectedEngine === 'AUCTION_MULTI_DIVISION' && (
              <>
                <div className="form-group">
                  <label className="form-label">{d.lotteryWinnersPerCycle || 'Lottery winners per cycle'}</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={engineConfig.multiDivision.lotteryWinnersPerCycle}
                    onChange={(e) =>
                      setEngineConfig((c) => ({
                        ...c,
                        multiDivision: { ...c.multiDivision, enabled: true, lotteryWinnersPerCycle: Number(e.target.value) || 0 },
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{d.auctionWinnersPerCycle || 'Auction winners per cycle'}</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={engineConfig.multiDivision.auctionWinnersPerCycle}
                    onChange={(e) =>
                      setEngineConfig((c) => ({
                        ...c,
                        multiDivision: { ...c.multiDivision, enabled: true, auctionWinnersPerCycle: Number(e.target.value) || 1 },
                      }))
                    }
                  />
                </div>
              </>
            )}

            {selectedEngine === 'AUCTION_UNCAPPED_ENTERPRISE' && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.85rem' }}>
                  <input
                    type="checkbox"
                    checked={engineConfig.discountRules.uncapped}
                    onChange={(e) =>
                      setEngineConfig((c) => ({
                        ...c,
                        discountRules: { ...c.discountRules, uncapped: e.target.checked },
                      }))
                    }
                  />
                  {d.uncappedDiscount || 'Allow uncapped discount bidding (> 40%)'}
                </label>
              </div>
            )}

            {selectedEngine === 'BASE_PLUS_PREMIUM' && (
              <>
                <div className="form-group">
                  <label className="form-label">{d.baseInstalment || 'Non-prized base instalment'} ({currencySymbol})</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={engineConfig.differentialInstalment.baseInstalment || monthlyContrib || ''}
                    onChange={(e) =>
                      setEngineConfig((c) => ({
                        ...c,
                        differentialInstalment: { ...c.differentialInstalment, enabled: true, baseInstalment: Number(e.target.value) || 0 },
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{d.prizedPremium || 'Post-prize premium per cycle'} ({currencySymbol})</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={engineConfig.differentialInstalment.prizedPremiumAmount}
                    onChange={(e) =>
                      setEngineConfig((c) => ({
                        ...c,
                        differentialInstalment: { ...c.differentialInstalment, enabled: true, prizedPremiumAmount: Number(e.target.value) || 0 },
                      }))
                    }
                  />
                </div>
              </>
            )}

            {selectedEngine === 'FIXED_CHART_ESCALATING' && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Escalating Payout Table ({totalMembers} periods)</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={generateEscalatingChart}>
                    Generate Linear Chart (82% → 115%)
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>
                  {Array.from({ length: totalMembers }, (_, i) => {
                    const p = i + 1;
                    const existing = engineConfig.escalatingPayouts?.find((r) => r.period === p)?.payoutAmount ?? chitValue;
                    return (
                      <label key={p} style={{ fontSize: '.78rem' }}>
                        P{p} Payout
                        <input
                          type="number"
                          className="form-control"
                          value={existing}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setEngineConfig((c) => {
                              const rows = [...(c.escalatingPayouts ?? [])].filter((r) => r.period !== p);
                              rows.push({ period: p, payoutAmount: val });
                              rows.sort((a, b) => a.period - b.period);
                              return { ...c, escalatingPayouts: rows };
                            });
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedEngine === 'FIXED_DIVIDEND' && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Fixed Dividend Schedule ({totalMembers} periods)</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={generateTaperingDividends}>
                    Generate Tapering Schedule
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>
                  {Array.from({ length: totalMembers }, (_, i) => {
                    const p = i + 1;
                    const existing = engineConfig.fixedDividends?.find((r) => r.period === p)?.dividendPerTicket ?? 0;
                    return (
                      <label key={p} style={{ fontSize: '.78rem' }}>
                        P{p} Dividend/Ticket
                        <input
                          type="number"
                          className="form-control"
                          value={existing}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setEngineConfig((c) => {
                              const rows = [...(c.fixedDividends ?? [])].filter((r) => r.period !== p);
                              rows.push({ period: p, dividendPerTicket: val });
                              rows.sort((a, b) => a.period - b.period);
                              return { ...c, fixedDividends: rows };
                            });
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedEngine === 'MICRO_DAILY_COLLECTION' && (
              <>
                <div className="form-group">
                  <label className="form-label">Collection days per cycle</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={engineConfig.microDaily?.collectionDaysPerCycle ?? 25}
                    onChange={(e) =>
                      setEngineConfig((c) => ({
                        ...c,
                        microDaily: {
                          collectionDaysPerCycle: Number(e.target.value) || 25,
                          dailyAmount: c.microDaily?.dailyAmount ?? 200,
                          drawCadence: c.microDaily?.drawCadence ?? 'monthly',
                        },
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Target daily collection ({currencySymbol})</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={engineConfig.microDaily?.dailyAmount ?? 200}
                    onChange={(e) =>
                      setEngineConfig((c) => ({
                        ...c,
                        microDaily: {
                          collectionDaysPerCycle: c.microDaily?.collectionDaysPerCycle ?? 25,
                          dailyAmount: Number(e.target.value) || 0,
                          drawCadence: c.microDaily?.drawCadence ?? 'monthly',
                        },
                      }))
                    }
                  />
                </div>
              </>
            )}

            {(selectedEngine === 'GOLD_VALUE_ACCUMULATION' || selectedEngine === 'GOLD_WEIGHT_ACCUMULATION') && (
              <>
                <div className="form-group">
                  <label className="form-label">{d.defaultGoldRate || 'Default gold rate/g'} ({currencySymbol})</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={engineConfig.goldScheme?.defaultGoldRatePerGram ?? 0}
                    onChange={(e) =>
                      setEngineConfig((c) => ({
                        ...c,
                        goldScheme: {
                          bonusMonths: c.goldScheme?.bonusMonths ?? 0,
                          bonusPct: c.goldScheme?.bonusPct ?? 0,
                          makingChargeWaiverPct: c.goldScheme?.makingChargeWaiverPct ?? 0,
                          wastageWaiverPct: c.goldScheme?.wastageWaiverPct ?? 0,
                          defaultGoldRatePerGram: Number(e.target.value) || 0,
                        },
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{d.goldBonusMonths || 'Maturity bonus months'}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="form-control"
                    value={engineConfig.goldScheme?.bonusMonths ?? 0}
                    onChange={(e) =>
                      setEngineConfig((c) => ({
                        ...c,
                        goldScheme: {
                          bonusMonths: Number(e.target.value) || 0,
                          bonusPct: c.goldScheme?.bonusPct ?? 0,
                          makingChargeWaiverPct: c.goldScheme?.makingChargeWaiverPct ?? 0,
                          wastageWaiverPct: c.goldScheme?.wastageWaiverPct ?? 0,
                          defaultGoldRatePerGram: c.goldScheme?.defaultGoldRatePerGram ?? 0,
                        },
                      }))
                    }
                  />
                </div>
              </>
            )}

            {selectedEngine === 'FESTIVAL_COMMODITY' && (
              <>
                <div className="form-group">
                  <label className="form-label">Commodity / goods bundle</label>
                  <input
                    type="text"
                    className="form-control"
                    value={engineConfig.commodityScheme?.itemsSummary ?? ''}
                    onChange={(e) =>
                      setEngineConfig((c) => ({
                        ...c,
                        commodityScheme: {
                          itemsSummary: e.target.value,
                          merchantBonusAmount: c.commodityScheme?.merchantBonusAmount ?? 0,
                          merchantBonusPct: c.commodityScheme?.merchantBonusPct ?? 0,
                        },
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Merchant bonus %</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="form-control"
                    value={engineConfig.commodityScheme?.merchantBonusPct ?? 0}
                    onChange={(e) =>
                      setEngineConfig((c) => ({
                        ...c,
                        commodityScheme: {
                          itemsSummary: c.commodityScheme?.itemsSummary ?? '',
                          merchantBonusAmount: c.commodityScheme?.merchantBonusAmount ?? 0,
                          merchantBonusPct: Number(e.target.value) || 0,
                        },
                      }))
                    }
                  />
                </div>
              </>
            )}

            {selectedEngine === 'HYBRID_SPLIT_PHASE' && (
              <>
                <div className="form-group">
                  <label className="form-label">{d.reservedCycles || 'Reserved Phase-1 cycles (k)'}</label>
                  <input
                    type="number"
                    min="0"
                    max={Math.max(0, totalMembers - 1)}
                    className="form-control"
                    value={engineConfig.hybridSplitPhase?.reservedCyclesCount ?? 1}
                    onChange={(e) =>
                      setEngineConfig((c) => ({
                        ...c,
                        hybridSplitPhase: {
                          reservedCyclesCount: Number(e.target.value) || 0,
                          reservedDiscountPct: c.hybridSplitPhase?.reservedDiscountPct ?? 0,
                        },
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{d.reservedDiscountPct || 'Phase-1 fixed discount %'}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="form-control"
                    value={engineConfig.hybridSplitPhase?.reservedDiscountPct ?? 0}
                    onChange={(e) =>
                      setEngineConfig((c) => ({
                        ...c,
                        hybridSplitPhase: {
                          reservedCyclesCount: c.hybridSplitPhase?.reservedCyclesCount ?? 1,
                          reservedDiscountPct: Number(e.target.value) || 0,
                        },
                      }))
                    }
                  />
                </div>
              </>
            )}

            {selectedEngine === 'ASCA_SHG_REVOLVING' && (
              <>
                <div className="form-group">
                  <label className="form-label">{d.ascaLoanInterestPct || 'Internal loan monthly interest %'}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className="form-control"
                    value={engineConfig.ascaPool?.monthlyLoanInterestPct ?? 1.5}
                    onChange={(e) =>
                      setEngineConfig((c) => ({
                        ...c,
                        ascaPool: {
                          monthlyLoanInterestPct: Number(e.target.value) || 0,
                          maxLoanMultiplier: c.ascaPool?.maxLoanMultiplier ?? 3,
                          adminExpensePerCycle: c.ascaPool?.adminExpensePerCycle ?? 0,
                        },
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max loan multiplier (x savings)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    className="form-control"
                    value={engineConfig.ascaPool?.maxLoanMultiplier ?? 3}
                    onChange={(e) =>
                      setEngineConfig((c) => ({
                        ...c,
                        ascaPool: {
                          monthlyLoanInterestPct: c.ascaPool?.monthlyLoanInterestPct ?? 1.5,
                          maxLoanMultiplier: Number(e.target.value) || 1,
                          adminExpensePerCycle: c.ascaPool?.adminExpensePerCycle ?? 0,
                        },
                      }))
                    }
                  />
                </div>
              </>
            )}

            {selectedEngine === 'CUSTOM_MANUAL_SCHEDULE' && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Custom CSV Schedule (period,non_prized_due,prized_due,payout,commission,dividend)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={csvScheduleText}
                    onChange={(e) => setCsvScheduleText(e.target.value)}
                    placeholder={'1,5000,6000,90000,5000,500\n2,5000,6000,92000,5000,300'}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={parseManualCsv}>
                    Apply CSV ({engineConfig.customSchedule?.length ?? 0} rows)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Registration & approval — registered chits only */}
        {chitType === 'registered' && (
          <div style={sectionStyle}>
            <h4 style={sectionTitleStyle}>3. Registration &amp; approval</h4>
            <div style={gridStyle}>
              <div className="form-group"><label className="form-label">Registration number</label><input name="registrationNo" type="text" className="form-control" placeholder="e.g. TN/ERD/2026/123" /></div>
              <div className="form-group"><label className="form-label">Registration date</label><input name="registrationDate" type="date" className="form-control" /></div>
              <div className="form-group"><label className="form-label">Registrar office</label><input name="registrarOffice" type="text" className="form-control" /></div>
              <div className="form-group"><label className="form-label">By-law number</label><input name="bylawNo" type="text" className="form-control" /></div>
              <div className="form-group"><label className="form-label">Commencement certificate</label><input name="commencementCertificate" type="text" className="form-control" /></div>
              <div className="form-group"><label className="form-label">GST % on commission</label><input name="gstPct" type="number" className="form-control" step="0.5" min="0" placeholder="e.g. 12" /></div>
              <div className="form-group"><label className="form-label">Approved bank name</label><input name="approvedBankName" type="text" className="form-control" /></div>
              <div className="form-group"><label className="form-label">Approved bank account no</label><input name="approvedBankAccountNo" type="text" className="form-control" /></div>
            </div>
          </div>
        )}

        {/* 4. Foreman & commission */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>{chitType === 'registered' ? '4' : '3'}. Foreman &amp; commission</h4>
          <div style={gridStyle}>
            <div className="form-group">
              <label className="form-label">Foreman name{chitType === 'registered' ? '' : ' (optional)'}</label>
              <input name="foremanName" type="text" className="form-control" />
            </div>
            <div className="form-group">
              <label className="form-label">{d.foremanCompMode || 'Foreman compensation mode'}</label>
              <select
                className="form-control"
                value={engineConfig.foremanCompensation.mode}
                onChange={(e) =>
                  setEngineConfig((c) => ({
                    ...c,
                    foremanCompensation: { ...c.foremanCompensation, mode: e.target.value as any },
                  }))
                }
              >
                {FOREMAN_COMPENSATION_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{d.commission} % *</label>
              <input
                name="commissionPct"
                type="number"
                className="form-control"
                step="0.5"
                min="0"
                max="20"
                value={commissionPct}
                onChange={(e) => setCommissionPct(Number(e.target.value) || 0)}
              />
            </div>
            {engineConfig.foremanCompensation.mode === 'FLAT_FEE' && (
              <div className="form-group">
                <label className="form-label">{d.flatFeeAmount || 'Flat fee per cycle'} ({currencySymbol})</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={engineConfig.foremanCompensation.flatFeeAmount}
                  onChange={(e) =>
                    setEngineConfig((c) => ({
                      ...c,
                      foremanCompensation: { ...c.foremanCompensation, flatFeeAmount: Number(e.target.value) || 0 },
                    }))
                  }
                />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Commission basis</label>
              <select
                name="commissionBasis"
                className="form-control"
                value={commissionBasis}
                onChange={(e) => setCommissionBasis(e.target.value as 'BID_DISCOUNT' | 'CHIT_VALUE')}
              >
                <option value="BID_DISCOUNT">% of bid discount</option>
                <option value="CHIT_VALUE">% of chit value</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Commission cap %</label>
              <input name="foremanCommissionCapPct" type="number" className="form-control" step="0.5" min="0" placeholder="optional" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <input type="hidden" name="bidStartAtCommission" value={String(bidStartAtCommission)} />
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.85rem' }}>
                <input type="checkbox" checked={bidStartAtCommission} onChange={(e) => setBidStartAtCommission(e.target.checked)} />
                Start bidding from commission amount
              </label>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.85rem' }}>
                <input
                  name="hasForemanTicket"
                  type="checkbox"
                  value="true"
                  checked={hasForemanTicket}
                  onChange={(e) => setHasForemanTicket(e.target.checked)}
                />
                Foreman/company holds a ticket and takes the period-1 prize without auction
              </label>
            </div>
          </div>
        </div>

        {/* 5. Bid & dividend rules */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>{chitType === 'registered' ? '5' : '4'}. Bid, dividend &amp; default rules</h4>
          <div style={gridStyle}>
            {!isDrawType && (
              <>
                <div className="form-group">
                  <label className="form-label">Min discount %</label>
                  <input name="minDiscountPct" type="number" className="form-control" step="0.5" min="0" value={minDiscountPct} onChange={(e) => setMinDiscountPct(e.target.value)} placeholder="defaults to commission %" />
                </div>
                <div className="form-group">
                  <label className="form-label">Max discount %</label>
                  <input name="maxDiscountPct" type="number" className="form-control" step="0.5" min="0" value={maxDiscountPct} onChange={(e) => setMaxDiscountPct(e.target.value)} placeholder="e.g. 30" />
                </div>
                <div className="form-group">
                  <label className="form-label">Bid increment ({currencySymbol})</label>
                  <input name="bidIncrement" type="number" className="form-control" min="0" placeholder="optional step, e.g. 500" />
                </div>
                <div className="form-group">
                  <label className="form-label">Tie break at cap</label>
                  <select name="tieBreakRule" className="form-control" defaultValue="EARLIEST_BID">
                    <option value="EARLIEST_BID">Earliest bid wins</option>
                    <option value="LOTTERY_AMONG_TIED">Lottery among tied bidders</option>
                    <option value="MANUAL_FOREMAN_PICK">Manual foreman selection</option>
                  </select>
                </div>
              </>
            )}
            <div className="form-group">
              <label className="form-label">Dividend shared by</label>
              <select name="dividendPolicy" className="form-control" value={dividendPolicy} onChange={(e) => setDividendPolicy(e.target.value)}>
                <option value="ALL_MEMBERS">All members (winner included)</option>
                <option value="NON_WINNERS_ONLY">Non-winners only</option>
                <option value="NON_PRIZED_ONLY">Non-prized members only</option>
                <option value="NONE">None (zero dividend)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Dividend distribution</label>
              <select name="dividendDistribution" className="form-control" value={dividendDistribution} onChange={(e) => setDividendDistribution(e.target.value)}>
                <option value="ADJUST_NEXT_DUE">Reduce next installment</option>
                <option value="CASH_PAYOUT">Pay out in cash each period</option>
                <option value="ACCUMULATE">Accumulate, settle at closure</option>
                <option value="DEFERRED_BONUS_POOL">Deferred maturity bonus pool</option>
                <option value="NONE">None</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Dividend rounding</label>
              <select name="dividendRounding" className="form-control" defaultValue="0">
                <option value="0">Exact (no rounding)</option>
                <option value="1">Round down to {currencySymbol}1</option>
                <option value="10">Round down to {currencySymbol}10</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{d.lateFeeType || 'Late payment fee type'}</label>
              <select
                className="form-control"
                value={engineConfig.defaultRules.lateFeeType}
                onChange={(e) =>
                  setEngineConfig((c) => ({
                    ...c,
                    defaultRules: { ...c.defaultRules, lateFeeType: e.target.value as any },
                  }))
                }
              >
                {LATE_FEE_TYPES.map((lt) => <option key={lt} value={lt}>{lt}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{d.lateFeeValue || 'Late fee value'}</label>
              <input
                type="number"
                min="0"
                step="0.5"
                className="form-control"
                value={engineConfig.defaultRules.lateFeeValue}
                onChange={(e) =>
                  setEngineConfig((c) => ({
                    ...c,
                    defaultRules: { ...c.defaultRules, lateFeeValue: Number(e.target.value) || 0 },
                  }))
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">{d.substitutionCutoffPct || 'Substitution cutoff %'}</label>
              <input
                type="number"
                min="0"
                max="100"
                className="form-control"
                value={engineConfig.defaultRules.substitutionCutoffPct}
                onChange={(e) =>
                  setEngineConfig((c) => ({
                    ...c,
                    defaultRules: { ...c.defaultRules, substitutionCutoffPct: Number(e.target.value) || 0 },
                  }))
                }
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.85rem' }}>
                <input
                  type="checkbox"
                  checked={engineConfig.defaultRules.forfeitDividendOnLate}
                  onChange={(e) =>
                    setEngineConfig((c) => ({
                      ...c,
                      defaultRules: { ...c.defaultRules, forfeitDividendOnLate: e.target.checked },
                    }))
                  }
                />
                {d.forfeitDividendOnLate || 'Forfeit cycle dividend for late/defaulting members'}
              </label>
            </div>
          </div>
        </div>

        {/* Winner interest, live room & security */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Security, live room &amp; winner interest</h4>
          <div style={gridStyle}>
            <div className="form-group">
              <label className="form-label">Live room admission</label>
              <select name="roomAdmission" className="form-control" defaultValue="auto">
                <option value="auto">Auto-admit joiners</option>
                <option value="approval">Organizer approves each joiner</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.85rem' }}>
                <input
                  type="checkbox"
                  checked={engineConfig.securityRequirements.requiredForPrized}
                  onChange={(e) =>
                    setEngineConfig((c) => ({
                      ...c,
                      securityRequirements: {
                        ...c.securityRequirements,
                        requiredForPrized: e.target.checked,
                        autoHoldPayoutUntilVerified: e.target.checked,
                      },
                    }))
                  }
                />
                {d.securityRequiredForPrized || 'Require security/collateral verification before releasing prize payout'}
              </label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
                {CHIT_SECURITY_TYPES.map((st) => {
                  const checked = engineConfig.securityRequirements.acceptedTypes.includes(st);
                  return (
                    <label key={st} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.76rem' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setEngineConfig((c) => {
                            const cur = c.securityRequirements.acceptedTypes;
                            const next = checked ? cur.filter((x) => x !== st) : [...cur, st];
                            return {
                              ...c,
                              securityRequirements: { ...c.securityRequirements, acceptedTypes: next.length ? next : ['NONE'] },
                            };
                          })
                        }
                      />
                      {st}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <input type="hidden" name="bellEnabled" value={String(bellEnabled)} />
              <input type="hidden" name="bellAutoClose" value={String(bellAutoClose)} />
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.85rem' }}>
                <input type="checkbox" checked={bellEnabled} onChange={(e) => setBellEnabled(e.target.checked)} />
                Organizer bell (going once / going twice / sold)
              </label>
              {bellEnabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.85rem' }}>
                    Interval
                    <input name="bellIntervalSeconds" type="number" className="form-control" style={{ width: '80px' }} defaultValue={60} min={5} />
                    sec
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.85rem' }}>
                    Ring count
                    <input name="bellCount" type="number" className="form-control" style={{ width: '70px' }} defaultValue={3} min={1} max={10} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.85rem' }}>
                    <input type="checkbox" checked={bellAutoClose} onChange={(e) => setBellAutoClose(e.target.checked)} />
                    Auto-close room on final bell
                  </label>
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Winner interest</label>
              <select name="winnerInterestType" className="form-control" value={winnerInterestType} onChange={(e) => setWinnerInterestType(e.target.value)}>
                <option value="NONE">None</option>
                <option value="FIXED">Fixed amount per period</option>
                <option value="PERCENT">Percent of chit value per period</option>
              </select>
            </div>
            {winnerInterestType !== 'NONE' && (
              <>
                <div className="form-group">
                  <label className="form-label">{winnerInterestType === 'FIXED' ? `Interest amount (${currencySymbol})` : 'Interest percent'}</label>
                  <input name="winnerInterestValue" type="number" className="form-control" min="0" step="0.01" value={winnerInterestValue || ''} onChange={(e) => setWinnerInterestValue(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Interest periods</label>
                  <input name="winnerInterestPeriods" type="number" className="form-control" min="1" step="1" value={winnerInterestPeriods || ''} onChange={(e) => setWinnerInterestPeriods(Number(e.target.value))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <p style={{ ...hintStyle, margin: 0 }}>
                    Preview: winner pays {currencySymbol}{Math.round(winnerDuePreview).toLocaleString('en-IN')} for {winnerInterestPeriods || 0} period(s).
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Members */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>{chitType === 'registered' ? '6' : '5'}. {d.members} ({selectedMembers.length}/{totalMembers})</h4>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '10px' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addMemberSlot} disabled={selectedMembers.length >= totalMembers}>
              + {d.addMember}
            </button>
          </div>
          {selectedMembers.map((memberId, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
              <span style={{ width: '24px', color: 'var(--text-secondary)', fontSize: '.85rem' }}>{idx + 1}.</span>
              <select className="form-control" value={memberId} onChange={(e) => updateMember(idx, e.target.value)} required>
                <option value="">{d.selectCustomer}</option>
                {availableCustomers(idx).map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.customerCode})</option>
                ))}
              </select>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeMember(idx)}>
                <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--danger)' }}>close</span>
              </button>
            </div>
          ))}
          {selectedMembers.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>{d.clickAddMember}</p>}
        </div>

        <div className="form-group" style={sectionStyle}>
          <label className="form-label">Remarks</label>
          <textarea name="remarks" className="form-control" rows={2} />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading || selectedMembers.filter(Boolean).length > totalMembers}>
            {loading ? d.creating : d.createGroup}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => router.back()}>{d.cancel}</button>
        </div>
      </form>

      {/* Right Side Pane: Chit Templates */}
      <aside
        className="card chit-templates-panel"
        style={{
          position: 'sticky',
          top: '16px',
          height: 'calc(100vh - 80px)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
        }}
      >
        {/* Header */}
        <div style={{ flexShrink: 0, marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
              {d.quickTemplatesTitle || 'Chit Templates'}
            </h3>
            <span className="badge badge-pending" style={{ fontSize: '.72rem' }}>
              18 {d.presets || 'Templates'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {d.quickTemplatesSubtitle || 'Select a template to autofill group details. All fields remain editable.'}
          </p>
        </div>

        {/* Category Filter Pills */}
        <div style={{ flexShrink: 0, display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {[
            { id: 'ALL' as const, label: d.templateCatAll || 'All (18)' },
            { id: 'AUCTION' as const, label: d.templateCatAuction || 'Auction (4)' },
            { id: 'FIXED_CHART' as const, label: d.templateCatFixedChart || 'Fixed (7)' },
            { id: 'MICRO_COMMODITY' as const, label: d.templateCatMicroCommodity || 'Daily/Gold (4)' },
            { id: 'ENTERPRISE_HYBRID' as const, label: d.templateCatEnterpriseHybrid || 'Enterprise (3)' },
          ].map((cat) => {
            const isCatActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '.74rem',
                  fontWeight: isCatActive ? 700 : 500,
                  border: isCatActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: isCatActive ? 'var(--primary)' : 'var(--bg)',
                  color: isCatActive ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Template List Container - CRITICAL: flex: 1 1 auto, minHeight: 0, overflowY: auto */}
        <div
          className="chit-templates-scroll-list"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {PRACTICAL_CHIT_TEMPLATES.filter(
            (t) => selectedCategory === 'ALL' || t.category === selectedCategory,
          ).map((tmpl) => {
            const isSelected = activeTemplate === tmpl.code;
            const tData = (d.templates as Record<string, { title?: string; badge?: string; desc?: string }> | undefined)?.[tmpl.code];
            const title = tData?.title || tmpl.defaultName;
            const badge = tData?.badge || tmpl.defaultBadge;
            const desc = tData?.desc || CHIT_ENGINE_CATALOG[tmpl.engineType]?.description;

            return (
              <div
                key={tmpl.code}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: isSelected ? 'var(--primary-light, #f0fdf4)' : 'var(--surface)',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ fontWeight: 600, fontSize: '.88rem', color: 'var(--text)', lineHeight: 1.3 }}>
                    {title}
                  </div>
                  {isSelected && (
                    <span className="badge badge-active" style={{ fontSize: '.70rem' }}>
                      ✓ Active
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className="badge badge-pending" style={{ fontSize: '.72rem' }}>
                    {badge}
                  </span>
                </div>

                {desc && (
                  <div style={{ fontSize: '.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {desc}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border)',
                    fontSize: '.75rem',
                    color: 'var(--text-secondary)',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>
                    <strong>{currencySymbol}{tmpl.defaultChitValue.toLocaleString('en-IN')}</strong> · {tmpl.defaultTotalMembers} members · {tmpl.defaultFrequency}
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setExplainerTemplate(tmpl)}
                      style={{ padding: '4px 10px', fontSize: '.74rem' }}
                    >
                      {d.details || 'Process & Details'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => applyTemplate(tmpl)}
                      style={{ padding: '4px 12px', fontSize: '.74rem' }}
                    >
                      {isSelected ? '✓ Applied' : 'Apply'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Single-Language Detailed Process Flow Modal */}
      <ChitTemplateExplainerModal
        template={explainerTemplate}
        currencySymbol={currencySymbol}
        lang={lang}
        dict={dict as Record<string, unknown>}
        isApplied={Boolean(explainerTemplate && activeTemplate === explainerTemplate.code)}
        onApply={(tmpl, customOverrides) => applyTemplate(tmpl, customOverrides)}
        onClose={() => setExplainerTemplate(null)}
      />
    </div>
  );
}
