'use client';

import { useState } from 'react';
import { createChitGroup } from '../actions';
import { useRouter } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';
import FieldHelpIcon from '@/components/chits/FieldHelpIcon';
import {
  formatChitTenure,
  getChitFieldTooltip,
  getChitFormUiStrings,
} from '@/lib/chits/formTooltipsI18n';
import {
  nextPeriodDate,
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

interface StaffUserOption {
  id: string;
  name: string;
  phone: string;
  role: string;
  customRoleName?: string | null;
  customRole?: { name: string } | null;
}

interface ForemanEntry {
  userId: string;
  roleLabel: string;
  isPrimary: boolean;
}

export default function ChitGroupForm({
  customers,
  staffUsers = [],
  currencySymbol,
  dict,
  lang = 'en',
  enabledChitTypes,
  typeDefaults,
}: {
  customers: { id: string; name: string; customerCode: string }[];
  staffUsers?: StaffUserOption[];
  currencySymbol: string;
  dict: any;
  lang?: string;
  enabledChitTypes?: ChitEngineType[];
  typeDefaults?: Partial<Record<ChitEngineType, ChitEngineConfig>>;
}) {
  const d = dict.chits;
  const ui = getChitFormUiStrings(lang);
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
  const [totalMembers, setTotalMembers] = useState(10);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<ChitTemplateCode | null>(null);
  const [explainerTemplate, setExplainerTemplate] = useState<ChitTemplateDefinition | null>(null);
  const [showTemplatesDrawer, setShowTemplatesDrawer] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | ChitEngineCategory>('ALL');

  const [groupName, setGroupName] = useState('');
  const [chitValue, setChitValue] = useState(100000);
  const [monthlyContrib, setMonthlyContrib] = useState(10000);
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

  // Multi-foreman assignment state
  const [selectedForemen, setSelectedForemen] = useState<ForemanEntry[]>([]);
  const [pickForemanId, setPickForemanId] = useState('');
  const [pickForemanRole, setPickForemanRole] = useState('Primary Foreman');

  // Quick multi-ticket customer picker state
  const [pickCustomerId, setPickCustomerId] = useState('');
  const [pickTicketQty, setPickTicketQty] = useState(1);

  // Collapsible secondary sections (compact layout)
  const [openAdvanced, setOpenAdvanced] = useState(false);
  const [openSecurity, setOpenSecurity] = useState(false);

  const catalogItem = CHIT_ENGINE_CATALOG[selectedEngine];
  const isDrawType = !catalogItem.supportsBidding || auctionType === 'lottery' || auctionType === 'fixed_rotation';
  const requiresStrictPotCheck = !FLEXIBLE_VALUE_ENGINES.has(selectedEngine);

  // Auto-calculated cadence configuration & localized tenure display
  const currentFreqConfig: FrequencyConfig =
    frequencyMode === 'custom'
      ? { unit: customUnit, interval: Math.max(1, customInterval), weekdays: customWeekdays.length ? customWeekdays : null }
      : collectionFrequencyToConfig(auctionFrequency);
  const tenureDisplay = formatChitTenure(totalMembers, currentFreqConfig, lang);

  // Auto-calculation handlers (Section 1 requirement)
  const handleChitValueChange = (val: number) => {
    const cleanVal = Math.max(0, Number.isFinite(val) ? val : 0);
    setChitValue(cleanVal);
    if (totalMembers > 0) {
      setMonthlyContrib(Math.round(cleanVal / totalMembers));
    }
  };

  const handleTotalMembersChange = (count: number) => {
    const nextMembers = Math.max(2, Math.min(200, Math.round(Number(count) || 2)));
    setTotalMembers(nextMembers);
    if (chitValue > 0) {
      setMonthlyContrib(Math.round(chitValue / nextMembers));
    } else if (monthlyContrib > 0) {
      setChitValue(monthlyContrib * nextMembers);
    }
    if (selectedMembers.length > nextMembers) {
      setSelectedMembers((prev) => prev.slice(0, nextMembers));
    }
  };

  const handleInstallmentChange = (amt: number) => {
    const cleanAmt = Math.max(0, Number.isFinite(amt) ? amt : 0);
    setMonthlyContrib(cleanAmt);
    if (chitValue === 0 && totalMembers > 0) {
      setChitValue(cleanAmt * totalMembers);
    }
  };

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
    const nextVal = customOverrides?.chitValue ?? tmpl.defaultChitValue;
    const nextMem = customOverrides?.totalMembers ?? tmpl.defaultTotalMembers;
    setChitValue(nextVal);
    setTotalMembers(nextMem);
    setMonthlyContrib(customOverrides?.monthlyContrib ?? tmpl.defaultMonthlyContrib);
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
    setShowTemplatesDrawer(false);
  };

  const toggleWeekday = (day: number) => {
    setCustomWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  const previewDates = (() => {
    const base = startDate ? new Date(startDate) : null;
    if (!base || Number.isNaN(base.getTime())) return [];
    return [1, 2, 3].map((period) => nextPeriodDate(base, period, currentFreqConfig));
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

  // Multi-ticket helpers: one customer can be enrolled multiple times!
  const addTicketsForCustomer = (customerId: string, qty: number) => {
    if (!customerId) return;
    const count = Math.max(1, Math.min(50, Math.round(qty) || 1));
    const additions = Array.from({ length: count }, () => customerId);
    const nextList = [...selectedMembers, ...additions];
    setSelectedMembers(nextList);
    if (nextList.length > totalMembers) {
      handleTotalMembersChange(nextList.length);
    }
  };

  const removeOneTicketForCustomer = (customerId: string) => {
    setSelectedMembers((prev) => {
      const idx = prev.lastIndexOf(customerId);
      if (idx === -1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  };

  const removeAllTicketsForCustomer = (customerId: string) => {
    setSelectedMembers((prev) => prev.filter((id) => id !== customerId));
  };

  // Group enrolled member slots by customer for compact chip display
  const groupedTickets = (() => {
    const map = new Map<string, number[]>();
    selectedMembers.forEach((cid, idx) => {
      if (!cid) return;
      const list = map.get(cid) ?? [];
      list.push(idx + 1);
      map.set(cid, list);
    });
    return Array.from(map.entries()).map(([customerId, ticketNumbers]) => ({
      customerId,
      customer: customers.find((c) => c.id === customerId),
      ticketNumbers,
    }));
  })();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    formData.set('chitEngineType', selectedEngine);
    formData.set('durationMonths', String(totalMembers));
    const syncedConfig: ChitEngineConfig = {
      ...engineConfig,
      biddingMode:
        auctionType === 'lottery' || auctionType === 'fixed_rotation'
          ? 'NONE'
          : auctionType === 'sealed'
            ? 'SEALED_TENDER'
            : auctionType === 'open_live'
              ? 'OPEN_LIVE'
              : 'OPEN_MANUAL',
      foremanCompensation: {
        ...engineConfig.foremanCompensation,
        commissionPct,
      },
      discountRules: {
        ...engineConfig.discountRules,
        minDiscountPct: minDiscountPct ? Number(minDiscountPct) : 0,
        maxDiscountPct: maxDiscountPct ? Number(maxDiscountPct) : null,
      },
    };
    formData.set('engineConfig', JSON.stringify(syncedConfig));
    formData.set('foremenJson', JSON.stringify(selectedForemen));
    if (frequencyMode === 'custom') {
      formData.set('auctionFrequency', 'custom');
      formData.set('frequencyUnit', customUnit);
      formData.set('frequencyInterval', String(customInterval));
      formData.set('frequencyWeekdays', customWeekdays.join(','));
    } else {
      formData.set('auctionFrequency', auctionFrequency);
    }
    try {
      await createChitGroup(formData);
    } catch (err: any) {
      setError(err.message || d.failedCreate);
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <style>{`
        .chit-compact-form .form-control {
          padding: 6px 10px;
          font-size: .82rem;
          min-height: 34px;
        }
        .chit-compact-form .form-label {
          font-size: .76rem;
          font-weight: 600;
          margin-bottom: 4px;
          display: inline-flex;
          align-items: center;
          color: var(--text);
        }
        .chit-compact-form .form-group {
          margin-bottom: 0;
        }
        .chit-section-box {
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: 9px;
          background: var(--surface);
          margin-bottom: 10px;
        }
        .chit-section-hdr {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--border);
        }
        .chit-section-hdr h4 {
          margin: 0;
          font-size: .88rem;
          font-weight: 700;
          color: var(--text);
        }
        .chit-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px 12px;
        }
        .chit-col-span-2 {
          grid-column: span 2;
        }
        .chit-col-span-3 {
          grid-column: 1 / -1;
        }
        @media (max-width: 900px) {
          .chit-grid-3 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .chit-col-span-2 {
            grid-column: 1 / -1;
          }
        }
        @media (max-width: 580px) {
          .chit-grid-3 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <form onSubmit={handleSubmit} className="card chit-compact-form" style={{ padding: '14px 16px' }}>
        {/* Compact Header & Template Strip */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{d.createGroup}</h3>
            <p style={{ margin: '2px 0 0', fontSize: '.74rem', color: 'var(--text-secondary)' }}>
              Saved as draft until members, tickets &amp; compliance details are ready.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{ui.templatesQuickTitle}:</span>
            {PRACTICAL_CHIT_TEMPLATES.slice(0, 3).map((tmpl) => (
              <button
                key={tmpl.code}
                type="button"
                className={`btn btn-sm ${activeTemplate === tmpl.code ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '3px 9px', fontSize: '.72rem' }}
                onClick={() => applyTemplate(tmpl)}
              >
                {(d.templates as any)?.[tmpl.code]?.title || tmpl.defaultName}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ padding: '3px 10px', fontSize: '.72rem', fontWeight: 600 }}
              onClick={() => setShowTemplatesDrawer((v) => !v)}
            >
              {showTemplatesDrawer ? ui.hideTemplates : `${ui.showAllTemplates} (18)`}
            </button>
            <Link href="/settings?tab=chittypes" className="btn btn-ghost btn-sm" style={{ padding: '3px 8px', fontSize: '.72rem' }}>
              Settings
            </Link>
          </div>
        </div>

        {/* Expandable 18-Templates Drawer (keeps main form uncrowded & compact) */}
        {showTemplatesDrawer && (
          <div style={{ padding: '10px 12px', marginBottom: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-hover, #f8fafc)' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {[
                { id: 'ALL' as const, label: d.templateCatAll || 'All (18)' },
                { id: 'AUCTION' as const, label: d.templateCatAuction || 'Auction (4)' },
                { id: 'FIXED_CHART' as const, label: d.templateCatFixedChart || 'Fixed (7)' },
                { id: 'MICRO_COMMODITY' as const, label: d.templateCatMicroCommodity || 'Daily/Gold (4)' },
                { id: 'ENTERPRISE_HYBRID' as const, label: d.templateCatEnterpriseHybrid || 'Enterprise (3)' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`btn btn-sm ${selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '2px 9px', fontSize: '.72rem' }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
              {PRACTICAL_CHIT_TEMPLATES.filter((t) => selectedCategory === 'ALL' || t.category === selectedCategory).map((tmpl) => {
                const tData = (d.templates as Record<string, { title?: string; badge?: string }> | undefined)?.[tmpl.code];
                const title = tData?.title || tmpl.defaultName;
                const badge = tData?.badge || tmpl.defaultBadge;
                return (
                  <div
                    key={tmpl.code}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '7px',
                      background: '#fff',
                      border: activeTemplate === tmpl.code ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '5px',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '.79rem', display: 'block' }}>{title}</strong>
                      <span className="badge badge-pending" style={{ fontSize: '.66rem', marginTop: '2px' }}>{badge}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.72rem', color: 'var(--text-secondary)' }}>
                      <span>{currencySymbol}{tmpl.defaultChitValue.toLocaleString('en-IN')} · {tmpl.defaultTotalMembers}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: '.69rem' }} onClick={() => setExplainerTemplate(tmpl)}>Info</button>
                        <button type="button" className="btn btn-primary btn-sm" style={{ padding: '2px 8px', fontSize: '.69rem' }} onClick={() => applyTemplate(tmpl)}>Apply</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTemplate && (
          <div style={{ marginBottom: '10px', padding: '5px 10px', borderRadius: '6px', background: '#dcfce7', border: '1px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '.76rem' }}>
            <span style={{ color: '#15803d', fontWeight: 600 }}>✓ {d.templateActiveBadge || 'Template Applied — All fields remain 100% editable'}</span>
            <button type="button" onClick={() => setActiveTemplate(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '.72rem', textDecoration: 'underline' }}>
              {d.clearTemplate || 'Clear'}
            </button>
          </div>
        )}

        {error && (
          <div style={{ margin: '0 0 10px', padding: '8px 12px', background: '#fff0f0', border: '1px solid var(--danger)', borderRadius: '7px', color: 'var(--danger)', fontSize: '.82rem' }}>
            {error}
          </div>
        )}

        {/* SECTION 1: BASIC DETAILS — STRICTLY 3 COLUMNS PER ROW */}
        <div className="chit-section-box">
          <div className="chit-section-hdr">
            <h4>{ui.basicDetails}</h4>
            <span style={{ fontSize: '.72rem', color: 'var(--text-secondary)' }}>{ui.autoCalcHint}</span>
          </div>
          <div className="chit-grid-3">
            {/* Row 1: Group Name | Chit Value | Installment Amount */}
            <div className="form-group">
              <label className="form-label">
                {d.groupName} * <FieldHelpIcon title={d.groupName} text={getChitFieldTooltip('groupName', lang)} />
              </label>
              <input
                name="name"
                type="text"
                className="form-control"
                required
                placeholder="e.g. Gold 1L Monthly"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                {d.chitValue} ({currencySymbol}) * <FieldHelpIcon title={d.chitValue} text={getChitFieldTooltip('chitValue', lang)} />
              </label>
              <input
                name="chitValue"
                type="number"
                className="form-control"
                required
                min="1000"
                step="100"
                value={chitValue || ''}
                onChange={(e) => handleChitValueChange(Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                {d.installmentAmount} ({currencySymbol}) * <FieldHelpIcon title={d.installmentAmount} text={getChitFieldTooltip('installmentAmount', lang)} />
              </label>
              <input
                name="monthlyContrib"
                type="number"
                className="form-control"
                required
                min="10"
                step="10"
                value={monthlyContrib || ''}
                onChange={(e) => handleInstallmentChange(Number(e.target.value))}
              />
              {requiresStrictPotCheck && chitValue > 0 && monthlyContrib > 0 && chitValue !== monthlyContrib * totalMembers && (
                <div style={{ fontSize: '.68rem', color: '#B45309', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>= {currencySymbol}{(chitValue / totalMembers).toLocaleString('en-IN')} exact</span>
                  <button
                    type="button"
                    style={{ border: 'none', background: 'none', padding: 0, color: 'var(--primary)', fontSize: '.68rem', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => setMonthlyContrib(Math.round(chitValue / totalMembers))}
                  >
                    Sync
                  </button>
                </div>
              )}
            </div>

            {/* Row 2: Total Members | Tenure (Auto) | Start Date */}
            <div className="form-group">
              <label className="form-label">
                {d.totalMembers} * <FieldHelpIcon title={d.totalMembers} text={getChitFieldTooltip('totalMembers', lang)} />
              </label>
              <input
                name="totalMembers"
                type="number"
                className="form-control"
                required
                min="2"
                max="200"
                value={totalMembers}
                onChange={(e) => handleTotalMembersChange(Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                {ui.tenureAutoLabel} <FieldHelpIcon title={ui.tenureAutoLabel} text={getChitFieldTooltip('tenure', lang)} />
              </label>
              <input
                type="text"
                readOnly
                className="form-control"
                value={tenureDisplay}
                style={{ background: 'var(--bg-hover, #f1f5f9)', fontWeight: 700, color: 'var(--primary-dark, #0f766e)' }}
              />
              <input type="hidden" name="durationMonths" value={totalMembers} />
            </div>

            <div className="form-group">
              <label className="form-label">
                {d.startDate} * <FieldHelpIcon title={d.startDate} text={getChitFieldTooltip('startDate', lang)} />
              </label>
              <input
                name="startDate"
                type="date"
                className="form-control"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* Row 3: Compliance | Regulatory Tier | Scale Tier */}
            <div className="form-group">
              <label className="form-label">
                Compliance * <FieldHelpIcon title="Compliance" text={getChitFieldTooltip('compliance', lang)} />
              </label>
              <select
                name="chitType"
                className="form-control"
                value={chitType}
                onChange={(e) => {
                  setChitType(e.target.value);
                  setEngineConfig((c) => ({
                    ...c,
                    regulatoryTier: e.target.value === 'registered' ? 'REGISTERED_ACT_1982' : 'UNORGANIZED_INFORMAL',
                  }));
                }}
              >
                <option value="unregistered">Unregistered (private/informal)</option>
                <option value="registered">Registered (Chit Funds Act 1982)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                {d.regulatoryTier || 'Regulatory Tier'} <FieldHelpIcon title="Regulatory Tier" text={getChitFieldTooltip('regulatoryTier', lang)} />
              </label>
              <select
                className="form-control"
                value={engineConfig.regulatoryTier}
                onChange={(e) => {
                  const tier = e.target.value as ChitEngineConfig['regulatoryTier'];
                  setEngineConfig((c) => ({ ...c, regulatoryTier: tier }));
                  setChitType(tier === 'REGISTERED_ACT_1982' ? 'registered' : 'unregistered');
                }}
              >
                {REGULATORY_TIERS.map((tier) => (
                  <option key={tier} value={tier}>{tier.replaceAll('_', ' ')}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                {d.scaleTier || 'Scale Tier'} <FieldHelpIcon title="Scale Tier" text={getChitFieldTooltip('scaleTier', lang)} />
              </label>
              <select
                className="form-control"
                value={engineConfig.scaleTier}
                onChange={(e) =>
                  setEngineConfig((c) => ({ ...c, scaleTier: e.target.value as ChitEngineConfig['scaleTier'] }))
                }
              >
                {SCALE_TIERS.map((tier) => (
                  <option key={tier} value={tier}>{tier}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 2: CHIT STYLE, CADENCE & ENGINE PARAMETERS — 3 COLUMNS + TOOLTIPS */}
        <div className="chit-section-box">
          <div className="chit-section-hdr">
            <h4>{ui.chitStyleAndCadence}</h4>
            <code style={{ fontSize: '.72rem', color: 'var(--text-secondary)' }}>{selectedEngine}</code>
          </div>
          <div className="chit-grid-3">
            <div className="form-group chit-col-span-2">
              <label className="form-label">
                {d.selectChitType || 'Chit Engine Type'} <FieldHelpIcon title="Chit Engine Type" text={getChitFieldTooltip('engineType', lang)} />
              </label>
              <select
                className="form-control"
                value={selectedEngine}
                onChange={(e) => selectEngineType(e.target.value as ChitEngineType)}
              >
                {availableTypes.map((code) => {
                  const meta = CHIT_ENGINE_CATALOG[code];
                  return (
                    <option key={code} value={code}>
                      {meta.name} {meta.regionalNames ? `(${meta.regionalNames})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                {d.payoutAssetType || 'Payout Asset Type'} <FieldHelpIcon title="Payout Asset Type" text={getChitFieldTooltip('payoutAssetType', lang)} />
              </label>
              <select
                className="form-control"
                value={engineConfig.payoutAssetType}
                onChange={(e) =>
                  setEngineConfig((c) => ({
                    ...c,
                    payoutAssetType: e.target.value as ChitEngineConfig['payoutAssetType'],
                  }))
                }
              >
                {PAYOUT_ASSET_TYPES.map((asset) => (
                  <option key={asset} value={asset}>{asset.replaceAll('_', ' ')}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Auction / Resolution Mode * <FieldHelpIcon title="Auction Mode" text={getChitFieldTooltip('auctionMode', lang)} />
              </label>
              <select
                name="auctionType"
                className="form-control"
                value={auctionType}
                onChange={(e) => setAuctionType(e.target.value as any)}
              >
                <option value="open_manual">Open Auction (Manual Entry)</option>
                <option value="open_live">Open Live Bidding (Room)</option>
                <option value="sealed">Sealed Tender / Blind</option>
                <option value="lottery">Lottery / Lucky Draw</option>
                <option value="fixed_rotation">Fixed Rotation / Order</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                {d.biddingMode || 'Bidding Mode'} <FieldHelpIcon title="Bidding Mode" text={getChitFieldTooltip('biddingMode', lang)} />
              </label>
              <select
                className="form-control"
                value={engineConfig.biddingMode}
                onChange={(e) => {
                  const nextBid = e.target.value as ChitEngineConfig['biddingMode'];
                  setEngineConfig((c) => ({ ...c, biddingMode: nextBid }));
                  setAuctionType(mapBiddingModeToAuctionType(selectedEngine, nextBid));
                }}
              >
                {BIDDING_MODES.map((m) => (
                  <option key={m} value={m}>{m.replaceAll('_', ' ')}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                {d.frequency || 'Collection Frequency'} * <FieldHelpIcon title="Collection Frequency" text={getChitFieldTooltip('frequency', lang)} />
              </label>
              <select
                className="form-control"
                value={frequencyMode === 'custom' ? 'custom' : auctionFrequency}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setFrequencyMode('custom');
                  } else {
                    setFrequencyMode('preset');
                    setAuctionFrequency(val);
                    setEngineConfig((c) => ({
                      ...c,
                      collectionFrequency:
                        val === 'daily'
                          ? 'DAILY_30'
                          : val === 'weekly'
                            ? 'WEEKLY'
                            : val === 'fortnightly'
                              ? 'FORTNIGHTLY'
                              : val === 'yearly'
                                ? 'BI_MONTHLY'
                                : 'MONTHLY',
                    }));
                  }
                }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly (2 weeks)</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom interval…</option>
              </select>
            </div>

            {frequencyMode === 'custom' && (
              <>
                <div className="form-group">
                  <label className="form-label">
                    Interval Every <FieldHelpIcon text={getChitFieldTooltip('customInterval', lang)} />
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    max="365"
                    value={customInterval}
                    onChange={(e) => setCustomInterval(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Interval Unit <FieldHelpIcon text={getChitFieldTooltip('customInterval', lang)} />
                  </label>
                  <select
                    className="form-control"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as 'day' | 'week' | 'month')}
                  >
                    <option value="day">Day(s)</option>
                    <option value="week">Week(s)</option>
                    <option value="month">Month(s)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Weekdays (optional)</label>
                  <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                    {WEEKDAY_OPTIONS.map((w) => {
                      const active = customWeekdays.includes(w.value);
                      return (
                        <button
                          key={w.value}
                          type="button"
                          onClick={() => toggleWeekday(w.value)}
                          className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}`}
                          style={{ padding: '2px 6px', fontSize: '.7rem' }}
                        >
                          {w.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">
                Auction Mode <FieldHelpIcon text={getChitFieldTooltip('auctionMode', lang)} />
              </label>
              <select name="auctionMode" className="form-control" defaultValue="offline">
                <option value="offline">Offline / In-person</option>
                <option value="online">Online / Live room</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                Auction Day of Month <FieldHelpIcon text={getChitFieldTooltip('startDate', lang)} />
              </label>
              <input name="auctionDay" type="number" className="form-control" min="1" max="31" placeholder="e.g. 5" />
            </div>
            <div className="form-group">
              <label className="form-label">
                Auction Time <FieldHelpIcon text={getChitFieldTooltip('startDate', lang)} />
              </label>
              <input name="auctionTime" type="time" className="form-control" />
            </div>

            {previewDates.length > 0 && (
              <div className="chit-col-span-3" style={{ fontSize: '.72rem', color: 'var(--text-secondary)' }}>
                Upcoming cycles preview: {previewDates.map((dt) => dt.toLocaleDateString('en-IN')).join(' · ')}
              </div>
            )}

            {/* Engine-Specific Parameters cleanly placed in 3-col flow */}
            {selectedEngine === 'AUCTION_RESERVE_PRICE' && (
              <div className="form-group">
                <label className="form-label">{d.reservePriceStepPct || 'Reserve Floor Step % / Cycle'}</label>
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
              </div>
            )}

            {selectedEngine === 'AUCTION_MULTI_DIVISION' && (
              <>
                <div className="form-group">
                  <label className="form-label">{d.lotteryWinnersPerCycle || 'Lottery winners/cycle'}</label>
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
                  <label className="form-label">{d.auctionWinnersPerCycle || 'Auction winners/cycle'}</label>
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
              <div className="form-group chit-col-span-3">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.8rem' }}>
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
                  <label className="form-label">{d.prizedPremium || 'Post-prize premium/cycle'} ({currencySymbol})</label>
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

            {selectedEngine === 'MICRO_DAILY_COLLECTION' && (
              <>
                <div className="form-group">
                  <label className="form-label">Collection days/cycle</label>
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
                  <label className="form-label">Daily target ({currencySymbol})</label>
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
                  <label className="form-label">Commodity bundle</label>
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
                  <label className="form-label">{d.ascaLoanInterestPct || 'Internal loan interest %/mo'}</label>
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
                  <label className="form-label">Max loan multiplier</label>
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

            {selectedEngine === 'FIXED_CHART_ESCALATING' && (
              <div className="form-group chit-col-span-3">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Escalating Payout Table ({totalMembers} cycles)</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={generateEscalatingChart}>
                    Auto-fill Chart (82% → 115%)
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                  {Array.from({ length: totalMembers }, (_, i) => {
                    const p = i + 1;
                    const existing = engineConfig.escalatingPayouts?.find((r) => r.period === p)?.payoutAmount ?? chitValue;
                    return (
                      <label key={p} style={{ fontSize: '.72rem' }}>
                        P{p}
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
              <div className="form-group chit-col-span-3">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Fixed Dividend Schedule ({totalMembers} cycles)</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={generateTaperingDividends}>
                    Generate Tapering Schedule
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                  {Array.from({ length: totalMembers }, (_, i) => {
                    const p = i + 1;
                    const existing = engineConfig.fixedDividends?.find((r) => r.period === p)?.dividendPerTicket ?? 0;
                    return (
                      <label key={p} style={{ fontSize: '.72rem' }}>
                        P{p} Div
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

            {selectedEngine === 'CUSTOM_MANUAL_SCHEDULE' && (
              <div className="form-group chit-col-span-3">
                <label className="form-label">Custom CSV Schedule (period,non_prized_due,prized_due,payout,commission,dividend)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={csvScheduleText}
                    onChange={(e) => setCsvScheduleText(e.target.value)}
                    placeholder={'1,5000,6000,90000,5000,500'}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={parseManualCsv}>
                    Apply CSV ({engineConfig.customSchedule?.length ?? 0})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: FOREMEN (MULTIPLE) & COMMISSION — 3 COLUMNS + TOOLTIPS */}
        <div className="chit-section-box">
          <div className="chit-section-hdr">
            <h4>{ui.foremenAndCommission}</h4>
            <span style={{ fontSize: '.72rem', color: 'var(--text-secondary)' }}>
              {selectedForemen.length} foreman account(s) assigned
            </span>
          </div>
          <div className="chit-grid-3">
            <div className="form-group">
              <label className="form-label">
                {d.commission} (%) * <FieldHelpIcon title="Commission %" text={getChitFieldTooltip('commissionPct', lang)} />
              </label>
              <input
                name="commissionPct"
                type="number"
                className="form-control"
                required
                step="0.5"
                min="0"
                max="20"
                value={commissionPct}
                onChange={(e) => setCommissionPct(Number(e.target.value) || 0)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Commission Basis <FieldHelpIcon title="Commission Basis" text={getChitFieldTooltip('commissionBasis', lang)} />
              </label>
              <select
                name="commissionBasis"
                className="form-control"
                value={commissionBasis}
                onChange={(e) => setCommissionBasis(e.target.value as 'BID_DISCOUNT' | 'CHIT_VALUE')}
              >
                <option value="BID_DISCOUNT">Winning Bid Discount</option>
                <option value="CHIT_VALUE">Chit Value (Statutory)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Compensation Mode <FieldHelpIcon title="Foreman Compensation" text={getChitFieldTooltip('foremanCompensation', lang)} />
              </label>
              <select
                className="form-control"
                value={engineConfig.foremanCompensation.mode}
                onChange={(e) =>
                  setEngineConfig((c) => ({
                    ...c,
                    foremanCompensation: {
                      ...c.foremanCompensation,
                      mode: e.target.value as ChitEngineConfig['foremanCompensation']['mode'],
                    },
                  }))
                }
              >
                {FOREMAN_COMPENSATION_MODES.map((m) => (
                  <option key={m} value={m}>{m.replaceAll('_', ' ')}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                GST on Commission (%) <FieldHelpIcon title="GST %" text={getChitFieldTooltip('gstPct', lang)} />
              </label>
              <input name="gstPct" type="number" className="form-control" step="0.5" min="0" max="28" placeholder="Optional e.g. 18" />
            </div>

            <div className="form-group">
              <label className="form-label">
                Display Foreman Name <FieldHelpIcon title="Foreman Name" text={getChitFieldTooltip('foremen', lang)} />
              </label>
              <input
                name="foremanName"
                type="text"
                className="form-control"
                placeholder="Auto-filled from selected foremen below"
              />
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.78rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="hasForemanTicket"
                  value="true"
                  checked={hasForemanTicket}
                  onChange={(e) => setHasForemanTicket(e.target.checked)}
                />
                <span>Foreman Ticket (Period 1)</span>
                <FieldHelpIcon title="Foreman Ticket" text={getChitFieldTooltip('foremanTicket', lang)} />
              </label>
            </div>

            {/* Multiple Foremen Portal Assignment Row */}
            <div className="form-group chit-col-span-3" style={{ paddingTop: '6px', borderTop: '1px dashed var(--border)' }}>
              <label className="form-label" style={{ marginBottom: '6px' }}>
                {ui.foremenLabel} <FieldHelpIcon title="Multiple Foremen" text={getChitFieldTooltip('foremen', lang)} />
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  className="form-control"
                  style={{ flex: '1 1 220px', maxWidth: '300px' }}
                  value={pickForemanId}
                  onChange={(e) => {
                    const uid = e.target.value;
                    setPickForemanId(uid);
                    const found = staffUsers.find((u) => u.id === uid);
                    if (found) {
                      setPickForemanRole(found.customRoleName || found.customRole?.name || (selectedForemen.length === 0 ? 'Primary Foreman' : 'Co-Foreman'));
                    }
                  }}
                >
                  <option value="">Select staff / foreman login…</option>
                  {staffUsers
                    .filter((u) => !selectedForemen.some((f) => f.userId === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.customRoleName || u.customRole?.name || u.role})
                      </option>
                    ))}
                </select>
                <input
                  type="text"
                  className="form-control"
                  style={{ width: '150px' }}
                  value={pickForemanRole}
                  onChange={(e) => setPickForemanRole(e.target.value)}
                  placeholder="Role e.g. Co-Foreman"
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!pickForemanId}
                  onClick={() => {
                    if (!pickForemanId) return;
                    setSelectedForemen((prev) => [
                      ...prev,
                      {
                        userId: pickForemanId,
                        roleLabel: pickForemanRole.trim() || 'Foreman',
                        isPrimary: prev.length === 0,
                      },
                    ]);
                    setPickForemanId('');
                    setPickForemanRole('Co-Foreman');
                  }}
                >
                  {ui.addForemanBtn}
                </button>
              </div>
              {selectedForemen.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {selectedForemen.map((f, idx) => {
                    const u = staffUsers.find((s) => s.id === f.userId);
                    return (
                      <span
                        key={f.userId}
                        className="badge badge-info"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', fontSize: '.74rem' }}
                      >
                        <strong>{u?.name || f.userId}</strong> ({f.roleLabel})
                        <button
                          type="button"
                          title={f.isPrimary ? 'Primary Foreman' : 'Set as Primary'}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: f.isPrimary ? '#f59e0b' : 'inherit', fontWeight: 700 }}
                          onClick={() =>
                            setSelectedForemen((prev) => prev.map((x, i) => ({ ...x, isPrimary: i === idx })))
                          }
                        >
                          {f.isPrimary ? '★' : '☆'}
                        </button>
                        <button
                          type="button"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'inherit', fontWeight: 700 }}
                          onClick={() => setSelectedForemen((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 4: MULTI-TICKET CUSTOMER ENROLLMENT — FAST, COMPACT */}
        <div className="chit-section-box">
          <div className="chit-section-hdr">
            <h4>
              {ui.membersAndTickets} <FieldHelpIcon title="Multi-Ticket Enrollment" text={getChitFieldTooltip('multiTicketMembers', lang)} />
            </h4>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '.75rem' }}>
              <span className="badge badge-info">
                {selectedMembers.length} / {totalMembers} {ui.seatsOccupied}
              </span>
              <span className="badge badge-secondary">
                {groupedTickets.length} {ui.uniqueCustomers}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: groupedTickets.length ? '8px' : '0' }}>
            <select
              className="form-control"
              style={{ flex: '1 1 240px', maxWidth: '340px' }}
              value={pickCustomerId}
              onChange={(e) => setPickCustomerId(e.target.value)}
            >
              <option value="">Select customer (can add multiple times)…</option>
              {customers.map((c) => {
                const count = selectedMembers.filter((id) => id === c.id).length;
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.customerCode}){count > 0 ? ` — ×${count} added` : ''}
                  </option>
                );
              })}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ fontSize: '.74rem', color: 'var(--text-secondary)' }}>{ui.ticketQty}:</label>
              <input
                type="number"
                className="form-control"
                style={{ width: '64px' }}
                min={1}
                max={50}
                value={pickTicketQty}
                onChange={(e) => setPickTicketQty(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!pickCustomerId}
              onClick={() => {
                addTicketsForCustomer(pickCustomerId, pickTicketQty);
                setPickTicketQty(1);
              }}
            >
              {ui.addTicketBtn}
            </button>
          </div>

          {/* Hidden form inputs carrying exact duplicate customerIds for FormData */}
          {selectedMembers.filter(Boolean).map((cid, i) => (
            <input key={`${cid}-${i}`} type="hidden" name="memberIds" value={cid} />
          ))}

          {groupedTickets.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {groupedTickets.map(({ customerId, customer, ticketNumbers }) => (
                <div
                  key={customerId}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    borderRadius: '7px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-hover, #f8fafc)',
                    fontSize: '.76rem',
                  }}
                >
                  <strong>{customer?.name || customerId}</strong>
                  <span className="badge badge-info" style={{ fontSize: '.68rem' }}>
                    {ticketNumbers.length} {ticketNumbers.length === 1 ? 'ticket' : 'tickets'} (#{ticketNumbers.join(', #')})
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '1px 6px', fontSize: '.7rem' }}
                    title="Add +1 ticket for this customer"
                    onClick={() => addTicketsForCustomer(customerId, 1)}
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '1px 6px', fontSize: '.7rem' }}
                    title="Remove 1 ticket"
                    onClick={() => removeOneTicketForCustomer(customerId)}
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '1px 5px', fontSize: '.7rem', color: 'var(--danger)' }}
                    title="Remove all tickets for this customer"
                    onClick={() => removeAllTicketsForCustomer(customerId)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 5: COLLAPSIBLE BID LIMITS, DIVIDEND & DEFAULT RULES — 3 COLUMNS + TOOLTIPS */}
        <div className="chit-section-box">
          <div
            className="chit-section-hdr"
            style={{ marginBottom: openAdvanced ? '10px' : 0, borderBottom: openAdvanced ? '1px solid var(--border)' : 'none', paddingBottom: openAdvanced ? '6px' : 0, cursor: 'pointer' }}
            onClick={() => setOpenAdvanced((v) => !v)}
          >
            <h4>{ui.advancedBidDividend}</h4>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '.72rem', color: 'var(--text-secondary)' }}>
              <span>Div: {dividendPolicy} ({dividendDistribution}) · Cutoff: {engineConfig.defaultRules.substitutionCutoffPct}%</span>
              <span className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: '.72rem' }}>
                {openAdvanced ? 'Collapse ▲' : 'Configure ▼'}
              </span>
            </div>
          </div>

          {openAdvanced && (
            <div className="chit-grid-3">
              {!isDrawType && (
                <>
                  <div className="form-group">
                    <label className="form-label">
                      Min Bid Discount (%) <FieldHelpIcon text={getChitFieldTooltip('minDiscountPct', lang)} />
                    </label>
                    <input
                      name="minDiscountPct"
                      type="number"
                      className="form-control"
                      step="0.5"
                      min="0"
                      max="40"
                      value={minDiscountPct}
                      onChange={(e) => setMinDiscountPct(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Max Bid Discount (%) <FieldHelpIcon text={getChitFieldTooltip('maxDiscountPct', lang)} />
                    </label>
                    <input
                      name="maxDiscountPct"
                      type="number"
                      className="form-control"
                      step="0.5"
                      min="0"
                      max={engineConfig.discountRules.uncapped ? 90 : 40}
                      value={maxDiscountPct}
                      onChange={(e) => setMaxDiscountPct(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Min Bid Step ({currencySymbol}) <FieldHelpIcon text={getChitFieldTooltip('bidIncrement', lang)} />
                    </label>
                    <input name="bidIncrement" type="number" className="form-control" min="0" step="50" placeholder="e.g. 500" />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">
                  Dividend Policy <FieldHelpIcon text={getChitFieldTooltip('dividendPolicy', lang)} />
                </label>
                <select name="dividendPolicy" className="form-control" value={dividendPolicy} onChange={(e) => setDividendPolicy(e.target.value)}>
                  <option value="ALL_MEMBERS">All members</option>
                  <option value="NON_PRIZED_ONLY">Non-prized only</option>
                  <option value="NON_WINNERS_ONLY">Excludes winner</option>
                  <option value="NONE">No dividend</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Dividend Distribution <FieldHelpIcon text={getChitFieldTooltip('dividendDistribution', lang)} />
                </label>
                <select name="dividendDistribution" className="form-control" value={dividendDistribution} onChange={(e) => setDividendDistribution(e.target.value)}>
                  <option value="ADJUST_NEXT_DUE">Adjust next installment</option>
                  <option value="CASH_PAYOUT">Cash payout</option>
                  <option value="ACCUMULATE">Accumulate to closure</option>
                  <option value="DEFERRED_BONUS_POOL">Deferred bonus pool</option>
                  <option value="NONE">None</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Dividend Rounding ({currencySymbol}) <FieldHelpIcon text={getChitFieldTooltip('dividendRounding', lang)} />
                </label>
                <input name="dividendRounding" type="number" className="form-control" min="0" defaultValue={0} />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Substitution Cutoff (%) <FieldHelpIcon text={getChitFieldTooltip('defaultConsecutiveMissed', lang)} />
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="form-control"
                  value={engineConfig.defaultRules.substitutionCutoffPct}
                  onChange={(e) =>
                    setEngineConfig((c) => ({
                      ...c,
                      defaultRules: { ...c.defaultRules, substitutionCutoffPct: Math.max(0, Number(e.target.value) || 0) },
                    }))
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Late Fee Type <FieldHelpIcon text={getChitFieldTooltip('lateFeeType', lang)} />
                </label>
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
                  {LATE_FEE_TYPES.map((lt) => (
                    <option key={lt} value={lt}>{lt}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Late Fee Value <FieldHelpIcon text={getChitFieldTooltip('lateFeeValue', lang)} />
                </label>
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

              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.78rem' }}>
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
                  <span>Forfeit Dividend on Late Pay</span>
                  <FieldHelpIcon text={getChitFieldTooltip('graceDays', lang)} />
                </label>
              </div>
              {!isDrawType && (
                <div className="form-group">
                  <label className="form-label">
                    Tie Break Rule <FieldHelpIcon text={getChitFieldTooltip('tieBreakRule', lang)} />
                  </label>
                  <select name="tieBreakRule" className="form-control" defaultValue="EARLIEST_BID">
                    <option value="EARLIEST_BID">Earliest Bid</option>
                    <option value="LOTTERY_AMONG_TIED">Lottery Among Tied</option>
                    <option value="MANUAL_FOREMAN_PICK">Manual Foreman Pick</option>
                  </select>
                </div>
              )}
              {!isDrawType && (
                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.78rem' }}>
                    <input
                      type="checkbox"
                      checked={bidStartAtCommission}
                      onChange={(e) => setBidStartAtCommission(e.target.checked)}
                    />
                    <input type="hidden" name="bidStartAtCommission" value={bidStartAtCommission ? 'true' : 'false'} />
                    <span>Start bid at Commission %</span>
                    <FieldHelpIcon text={getChitFieldTooltip('bidStartAtCommission', lang)} />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 6: REGISTERED CHITS COMPLIANCE (SHOWN ONLY FOR REGISTERED) */}
        {chitType === 'registered' && (
          <div className="chit-section-box">
            <div className="chit-section-hdr">
              <h4>{ui.registrationCompliance}</h4>
            </div>
            <div className="chit-grid-3">
              <div className="form-group">
                <label className="form-label">PSO / Registration No <FieldHelpIcon text={getChitFieldTooltip('registrationNo', lang)} /></label>
                <input name="registrationNo" type="text" className="form-control" placeholder="e.g. CHIT-REG-2026-01" />
              </div>
              <div className="form-group">
                <label className="form-label">Registration Date</label>
                <input name="registrationDate" type="date" className="form-control" />
              </div>
              <div className="form-group">
                <label className="form-label">Registrar Office</label>
                <input name="registrarOffice" type="text" className="form-control" />
              </div>
              <div className="form-group">
                <label className="form-label">Bylaw / Clause Ref</label>
                <input name="bylawNo" type="text" className="form-control" />
              </div>
              <div className="form-group">
                <label className="form-label">Approved Bank</label>
                <input name="approvedBankName" type="text" className="form-control" />
              </div>
              <div className="form-group">
                <label className="form-label">Security Escrow Account No</label>
                <input name="approvedBankAccountNo" type="text" className="form-control" />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 7: COLLAPSIBLE SECURITY, LIVE ROOM & WINNER INTEREST — 3 COLUMNS + TOOLTIPS */}
        <div className="chit-section-box">
          <div
            className="chit-section-hdr"
            style={{ marginBottom: openSecurity ? '10px' : 0, borderBottom: openSecurity ? '1px solid var(--border)' : 'none', paddingBottom: openSecurity ? '6px' : 0, cursor: 'pointer' }}
            onClick={() => setOpenSecurity((v) => !v)}
          >
            <h4>{ui.securityAndLiveRoom}</h4>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '.72rem', color: 'var(--text-secondary)' }}>
              <span>Security: {engineConfig.securityRequirements.acceptedTypes[0] || 'NONE'} · Bell: {bellEnabled ? 'On' : 'Off'}</span>
              <span className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: '.72rem' }}>
                {openSecurity ? 'Collapse ▲' : 'Configure ▼'}
              </span>
            </div>
          </div>

          {openSecurity && (
            <div className="chit-grid-3">
              <div className="form-group">
                <label className="form-label">
                  Primary Collateral Type <FieldHelpIcon text={getChitFieldTooltip('securityType', lang)} />
                </label>
                <select
                  className="form-control"
                  value={engineConfig.securityRequirements.acceptedTypes[0] || 'NONE'}
                  onChange={(e) =>
                    setEngineConfig((c) => ({
                      ...c,
                      securityRequirements: {
                        ...c.securityRequirements,
                        requiredForPrized: e.target.value !== 'NONE',
                        acceptedTypes: e.target.value === 'NONE' ? [] : [e.target.value],
                      },
                    }))
                  }
                >
                  {CHIT_SECURITY_TYPES.map((st) => (
                    <option key={st} value={st}>{st.replaceAll('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.78rem' }}>
                  <input
                    type="checkbox"
                    checked={engineConfig.securityRequirements.autoHoldPayoutUntilVerified}
                    onChange={(e) =>
                      setEngineConfig((c) => ({
                        ...c,
                        securityRequirements: { ...c.securityRequirements, autoHoldPayoutUntilVerified: e.target.checked },
                      }))
                    }
                  />
                  <span>Hold Payout Until Verified</span>
                  <FieldHelpIcon text={getChitFieldTooltip('securityThreshold', lang)} />
                </label>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Live Room Admission <FieldHelpIcon text={getChitFieldTooltip('roomAdmission', lang)} />
                </label>
                <select name="roomAdmission" className="form-control" defaultValue="auto">
                  <option value="auto">Auto Admit Enrolled Members</option>
                  <option value="approval">Foreman Approval Queue</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Winner Extra Interest <FieldHelpIcon text={getChitFieldTooltip('winnerInterestType', lang)} />
                </label>
                <select
                  name="winnerInterestType"
                  className="form-control"
                  value={winnerInterestType}
                  onChange={(e) => setWinnerInterestType(e.target.value)}
                >
                  <option value="NONE">None</option>
                  <option value="FIXED">Fixed amount / cycle</option>
                  <option value="PERCENT">Percentage (%)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Interest Value <FieldHelpIcon text={getChitFieldTooltip('winnerInterestValue', lang)} />
                </label>
                <input
                  name="winnerInterestValue"
                  type="number"
                  className="form-control"
                  min="0"
                  step="0.01"
                  disabled={winnerInterestType === 'NONE'}
                  value={winnerInterestType === 'NONE' ? 0 : winnerInterestValue}
                  onChange={(e) => setWinnerInterestValue(Number(e.target.value) || 0)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Interest Cycles</label>
                <input
                  name="winnerInterestPeriods"
                  type="number"
                  className="form-control"
                  min="0"
                  max={totalMembers}
                  disabled={winnerInterestType === 'NONE'}
                  value={winnerInterestType === 'NONE' ? 0 : winnerInterestPeriods}
                  onChange={(e) => setWinnerInterestPeriods(Number(e.target.value) || 0)}
                />
                {winnerInterestType !== 'NONE' && (
                  <span style={{ fontSize: '.68rem', color: 'var(--text-secondary)' }}>
                    Winner due ≈ {currencySymbol}{winnerDuePreview.toLocaleString('en-IN')}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">
                  3-Bell Timer <FieldHelpIcon text={getChitFieldTooltip('bellEnabled', lang)} />
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="hidden" name="bellEnabled" value={bellEnabled ? 'true' : 'false'} />
                  <input type="hidden" name="bellAutoClose" value={bellAutoClose ? 'true' : 'false'} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.76rem' }}>
                    <input type="checkbox" checked={bellEnabled} onChange={(e) => setBellEnabled(e.target.checked)} />
                    Enable Bells
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.76rem' }}>
                    <input type="checkbox" checked={bellAutoClose} onChange={(e) => setBellAutoClose(e.target.checked)} />
                    Auto-close
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Bell Interval (sec)</label>
                <input name="bellIntervalSeconds" type="number" className="form-control" defaultValue={60} min={10} max={600} />
              </div>
              <div className="form-group">
                <label className="form-label">Bell Count</label>
                <input name="bellCount" type="number" className="form-control" defaultValue={3} min={1} max={10} />
              </div>

              <div className="form-group chit-col-span-3">
                <label className="form-label">Remarks / Bylaws Notes</label>
                <input name="remarks" type="text" className="form-control" placeholder="Optional group notes…" />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '.76rem', color: 'var(--text-secondary)' }}>
            Pot: <strong>{currencySymbol}{chitValue.toLocaleString('en-IN')}</strong> · {tenureDisplay} · {selectedMembers.length}/{totalMembers} tickets · {selectedForemen.length} foremen
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
              {d.cancel}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? d.creating : d.createGroup}
            </button>
          </div>
        </div>
      </form>

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
