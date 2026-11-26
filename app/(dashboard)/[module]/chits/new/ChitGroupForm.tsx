'use client';

import { useState } from 'react';
import { createChitGroup } from '../actions';
import { useRouter } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';
import FieldHelpIcon from '@/components/chits/FieldHelpIcon';
import InlineAddPicker from '@/components/chits/InlineAddPicker';
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
  DEFAULT_ENABLED_CHIT_ENGINE_TYPES,
  FOREMAN_COMPENSATION_MODES,
  LATE_FEE_TYPES,
  PAYOUT_ASSET_TYPES,
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

function deriveRegulatoryTier(
  chitType: string,
  engine: ChitEngineType,
): ChitEngineConfig['regulatoryTier'] {
  if (chitType === 'registered') return 'REGISTERED_ACT_1982';
  if (engine === 'ASCA_SHG_REVOLVING') return 'SHG_COOPERATIVE';
  if (
    engine === 'GOLD_VALUE_ACCUMULATION' ||
    engine === 'GOLD_WEIGHT_ACCUMULATION' ||
    engine === 'FESTIVAL_COMMODITY'
  ) {
    return 'MERCHANT_SAVINGS';
  }
  return 'UNORGANIZED_INFORMAL';
}

function deriveScaleTier(val: number): ChitEngineConfig['scaleTier'] {
  if (val <= 50_000) return 'MICRO';
  if (val <= 500_000) return 'HOUSEHOLD';
  if (val <= 2_500_000) return 'SME_TRADER';
  return 'ENTERPRISE';
}

function stripStepPrefix(title: string): string {
  return String(title || '').replace(/^\d+\.\s*/, '');
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
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(true);
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
  const [defaultForemanRole, setDefaultForemanRole] = useState('Foreman');

  // Collapsible secondary sections (compact layout)
  const [openAdvanced, setOpenAdvanced] = useState(false);
  const [openSecurity, setOpenSecurity] = useState(false);

  // Member limit exceeded confirmation popup
  const [limitWarningModal, setLimitWarningModal] = useState<{
    customerId: string;
    customerName: string;
    qty: number;
    nextTotal: number;
  } | null>(null);

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
  const commitAddTickets = (customerId: string, count: number, expandLimit: boolean) => {
    const additions = Array.from({ length: count }, () => customerId);
    const nextList = [...selectedMembers, ...additions];
    setSelectedMembers(nextList);
    if (expandLimit && nextList.length > totalMembers) {
      handleTotalMembersChange(nextList.length);
    }
  };

  const addTicketsForCustomer = (customerId: string, qty: number) => {
    if (!customerId) return;
    const count = Math.max(1, Math.min(50, Math.round(qty) || 1));
    const nextTotal = selectedMembers.length + count;
    if (nextTotal > totalMembers) {
      const cust = customers.find((c) => c.id === customerId);
      setLimitWarningModal({
        customerId,
        customerName: cust ? `${cust.name} (${cust.customerCode})` : 'Customer',
        qty: count,
        nextTotal,
      });
      return;
    }
    commitAddTickets(customerId, count, false);
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
      regulatoryTier: deriveRegulatoryTier(chitType, selectedEngine),
      scaleTier: deriveScaleTier(chitValue),
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
    <div style={{ width: '100%' }}>
      <style>{`
        .chit-create-shell {
          display: grid;
          grid-template-columns: ${showTemplatesPanel ? '348px minmax(0, 1fr)' : '48px minmax(0, 1fr)'};
          gap: 16px;
          align-items: start;
          width: 100%;
          transition: grid-template-columns .2s ease;
        }
        @media (max-width: 1080px) {
          .chit-create-shell {
            grid-template-columns: 1fr !important;
          }
          .chit-tpl-sidebar {
            position: static !important;
            max-height: none !important;
          }
        }
        .chit-tpl-sidebar {
          position: sticky;
          top: 14px;
          max-height: calc(100vh - 86px);
          display: flex;
          flex-direction: column;
          border-radius: 16px;
          background: #F4F7FA;
          border: 1px solid #CBD5E1;
          box-shadow: 0 6px 20px -6px rgba(15, 23, 42, 0.08);
          overflow: hidden;
        }
        .chit-tpl-scroll {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 9px;
          padding: 4px 5px 10px 2px;
        }
        .chit-tpl-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .chit-tpl-scroll::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.4);
          border-radius: 4px;
        }
        .chit-compact-form {
          background: linear-gradient(180deg, #F8FAFC 0%, #EEF2F6 100%);
          border: 1px solid #DCE3EC;
          box-shadow: 0 6px 22px -8px rgba(15, 23, 42, 0.08);
          border-radius: 16px;
          padding: 16px 18px;
        }
        .chit-compact-form .form-control {
          background-color: #F4F7FA;
          border: 1.5px solid #CBD5E1;
          border-radius: 9px;
          padding: 7px 11px;
          font-size: .84rem;
          min-height: 36px;
          color: #0F172A;
          box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.03);
          transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;
        }
        .chit-compact-form .form-control:hover {
          background-color: #EDF2F7;
          border-color: #94A3B8;
        }
        .chit-compact-form .form-control:focus {
          background-color: #FFFFFF;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 24%, transparent);
          outline: none;
        }
        .chit-compact-form .form-label {
          font-size: .78rem;
          font-weight: 600;
          margin-bottom: 5px;
          display: inline-flex;
          align-items: center;
          color: #334155;
        }
        .chit-compact-form .form-group {
          margin-bottom: 0;
        }
        .chit-section-box {
          padding: 0 18px 16px;
          border: 1px solid #CBD5E1;
          border-radius: 14px;
          background: #FFFFFF;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.05);
          margin-bottom: 16px;
          overflow: visible;
          transition: box-shadow .18s ease, border-color .18s ease;
        }
        .chit-section-box.is-collapsed {
          padding-bottom: 0;
        }
        .chit-section-box:hover {
          border-color: color-mix(in srgb, var(--primary) 42%, #CBD5E1);
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
        }
        .chit-section-box:focus-within {
          border-color: var(--primary);
          box-shadow: 0 6px 22px rgba(15, 23, 42, 0.08), 0 0 0 2px color-mix(in srgb, var(--primary) 22%, transparent);
        }
        .chit-section-hdr {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin: 0 -18px 15px;
          padding: 12px 18px;
          border-radius: 13px 13px 0 0;
          background: var(--primary-light);
          color: var(--primary-dark);
          border-bottom: 1.5px solid color-mix(in srgb, var(--primary) 24%, #DCE3EC);
        }
        .chit-section-box.is-collapsed .chit-section-hdr {
          margin-bottom: 0;
          border-radius: 13px;
          border-bottom: none;
        }
        .chit-section-hdr h4 {
          margin: 0;
          font-size: 1.04rem;
          font-weight: 800;
          color: var(--primary-dark);
          display: inline-flex;
          align-items: center;
          gap: 9px;
          letter-spacing: 0.01em;
        }
        .chit-step-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          height: 24px;
          padding: 0 8px;
          border-radius: 8px;
          background: #FFFFFF;
          color: var(--primary-dark);
          border: 1px solid color-mix(in srgb, var(--primary) 32%, #CBD5E1);
          font-size: .78rem;
          font-weight: 800;
          letter-spacing: .03em;
          flex-shrink: 0;
        }
        .chit-hdr-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.28);
          color: #FFFFFF;
          font-size: .75rem;
          font-weight: 700;
          white-space: nowrap;
        }
        .chit-section-hdr .chit-hdr-chip {
          background: #FFFFFF;
          border: 1px solid color-mix(in srgb, var(--primary) 28%, #CBD5E1);
          color: var(--primary-dark);
        }
        .chit-hdr-chip-soft {
          font-size: .78rem;
          color: var(--primary-dark);
          opacity: 0.85;
          font-weight: 600;
        }
        .chit-hero-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 14px;
          margin-bottom: 16px;
          padding: 16px 20px;
          border-radius: 15px;
          background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%);
          color: #FFFFFF;
          box-shadow: 0 10px 26px -8px color-mix(in srgb, var(--primary) 38%, rgba(15, 23, 42, 0.25));
        }
        .chit-compliance-seg {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 3px;
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.25);
        }
        .chit-compliance-btn {
          border: none;
          border-radius: 7px;
          padding: 5px 12px;
          font-size: .77rem;
          font-weight: 700;
          cursor: pointer;
          transition: all .15s ease;
          background: transparent;
          color: rgba(255, 255, 255, 0.82);
          white-space: nowrap;
        }
        .chit-compliance-btn.active {
          background: #FFFFFF;
          color: #0F172A;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.18);
        }
        .chit-compliance-btn.active-reg {
          background: #FEF3C7;
          color: #92400E;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.18);
        }
        .chit-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px 14px;
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

      <div className="chit-create-shell">
        {/* LEFT SIDE PANEL: TOGGLEABLE CHIT TEMPLATES */}
        <aside className="chit-tpl-sidebar" style={{ padding: showTemplatesPanel ? '14px' : '10px 4px' }}>
          {!showTemplatesPanel ? (
            <button
              type="button"
              onClick={() => setShowTemplatesPanel(true)}
              title={`${ui.showAllTemplates} (18)`}
              style={{
                width: '100%',
                minHeight: '240px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                color: 'var(--primary)',
                fontWeight: 700,
                fontSize: '.84rem',
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '20px' }}>chevron_right</span>
              <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '.04em' }}>
                {d.quickTemplatesTitle || 'Chit Templates'} (18)
              </span>
            </button>
          ) : (
            <>
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '-14px -14px 12px',
                  padding: '12px 16px',
                  background: 'var(--primary-light)',
                  color: 'var(--primary-dark)',
                  borderBottom: '1.5px solid color-mix(in srgb, var(--primary) 24%, #DCE3EC)',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
                    {d.quickTemplatesTitle || 'Chit Templates'}
                  </h3>
                  <span style={{ fontSize: '.78rem', color: '#475569', fontWeight: 600 }}>
                    18 presets · click Apply
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTemplatesPanel(false)}
                  title={ui.hideTemplates}
                  className="btn btn-sm"
                  style={{
                    padding: '4px 8px',
                    fontSize: '.78rem',
                    backgroundColor: '#FFFFFF',
                    color: 'var(--primary-dark)',
                    border: '1px solid color-mix(in srgb, var(--primary) 28%, #CBD5E1)',
                  }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
                </button>
              </div>

              <div style={{ flexShrink: 0, display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
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
                    style={{
                      padding: '5px 10px',
                      fontSize: '.76rem',
                      backgroundColor: selectedCategory === cat.id ? undefined : '#FFFFFF',
                      borderColor: selectedCategory === cat.id ? undefined : '#CBD5E1',
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="chit-tpl-scroll">
                {PRACTICAL_CHIT_TEMPLATES.filter((t) => selectedCategory === 'ALL' || t.category === selectedCategory).map((tmpl) => {
                  const isSelected = activeTemplate === tmpl.code;
                  const tData = (d.templates as Record<string, { title?: string; badge?: string; desc?: string }> | undefined)?.[tmpl.code];
                  const title = tData?.title || tmpl.defaultName;
                  const badge = tData?.badge || tmpl.defaultBadge;
                  return (
                    <div
                      key={tmpl.code}
                      style={{
                        padding: '11px 12px',
                        borderRadius: '11px',
                        background: isSelected ? 'var(--primary-light)' : '#FFFFFF',
                        border: isSelected ? '1.5px solid var(--primary)' : '1px solid #DCE3EC',
                        boxShadow: isSelected
                          ? '0 4px 14px var(--primary-glow)'
                          : '0 1px 4px rgba(15, 23, 42, 0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '7px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                        <strong style={{ fontSize: '.88rem', lineHeight: 1.35, color: '#0F172A' }}>{title}</strong>
                        {isSelected && <span className="badge badge-success" style={{ fontSize: '.7rem', padding: '2px 7px' }}>✓</span>}
                      </div>
                      <span className="badge badge-pending" style={{ fontSize: '.74rem', padding: '3px 9px', alignSelf: 'flex-start' }}>{badge}</span>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.8rem', color: '#475569', paddingTop: '6px', borderTop: '1px solid #EEF2F6' }}>
                        <span style={{ fontWeight: 600 }}>{currencySymbol}{tmpl.defaultChitValue.toLocaleString('en-IN')} · {tmpl.defaultTotalMembers}</span>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '4px 9px', fontSize: '.76rem' }} onClick={() => setExplainerTemplate(tmpl)}>Info</button>
                          <button type="button" className="btn btn-primary btn-sm" style={{ padding: '4px 11px', fontSize: '.76rem' }} onClick={() => applyTemplate(tmpl)}>
                            {isSelected ? 'Applied' : 'Apply'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </aside>

        {/* MAIN FORM PANEL ON THE RIGHT */}
        <form onSubmit={handleSubmit} className="chit-compact-form">
        <input type="hidden" name="chitType" value={chitType} />
        <div className="chit-hero-banner">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '11px',
                backgroundColor: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.28)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '22px', color: '#FFFFFF' }}>savings</span>
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                {d.createGroup}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '.8rem', color: 'rgba(255,255,255,0.86)' }}>
                Saved as draft until members, tickets &amp; compliance details are ready.
              </p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '9px' }}>
                <span className="chit-hdr-chip">Pot: {currencySymbol}{chitValue.toLocaleString('en-IN')}</span>
                <span className="chit-hdr-chip">{tenureDisplay}</span>
                <span className="chit-hdr-chip">{selectedMembers.length} / {totalMembers} tickets</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Compliance segmented switch moved near Settings */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <div className="chit-compliance-seg" role="group" aria-label="Compliance Classification">
                <button
                  type="button"
                  className={`chit-compliance-btn ${chitType !== 'registered' ? 'active' : ''}`}
                  onClick={() => {
                    setChitType('unregistered');
                    setEngineConfig((c) => ({
                      ...c,
                      regulatoryTier: deriveRegulatoryTier('unregistered', selectedEngine),
                    }));
                  }}
                >
                  Unregistered
                </button>
                <button
                  type="button"
                  className={`chit-compliance-btn ${chitType === 'registered' ? 'active-reg' : ''}`}
                  onClick={() => {
                    setChitType('registered');
                    setEngineConfig((c) => ({
                      ...c,
                      regulatoryTier: 'REGISTERED_ACT_1982',
                    }));
                  }}
                >
                  Registered · Act 1982
                </button>
              </div>
              <FieldHelpIcon title="Compliance" text={getChitFieldTooltip('compliance', lang)} inverted />
            </div>

            <button
              type="button"
              className="btn btn-sm"
              style={{
                padding: '6px 12px',
                fontSize: '.78rem',
                fontWeight: 700,
                backgroundColor: 'rgba(255,255,255,0.16)',
                color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.32)',
              }}
              onClick={() => setShowTemplatesPanel((v) => !v)}
            >
              {showTemplatesPanel ? ui.hideTemplates : `${ui.showAllTemplates} (18)`}
            </button>
            <Link
              href="/settings?tab=chittypes"
              className="btn btn-sm"
              style={{
                padding: '6px 12px',
                fontSize: '.78rem',
                fontWeight: 700,
                backgroundColor: '#FFFFFF',
                color: 'var(--primary-dark)',
                border: 'none',
                boxShadow: '0 3px 10px rgba(0,0,0,0.14)',
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '15px' }}>tune</span>
              Settings
            </Link>
          </div>
        </div>

        {activeTemplate && (
          <div style={{ marginBottom: '12px', padding: '7px 12px', borderRadius: '9px', background: '#DCFCE7', border: '1px solid #86EFAC', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '.78rem' }}>
            <span style={{ color: '#15803D', fontWeight: 600 }}>✓ {d.templateActiveBadge || 'Template Applied — All fields remain 100% editable'}</span>
            <button type="button" onClick={() => setActiveTemplate(null)} style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '.74rem', textDecoration: 'underline' }}>
              {d.clearTemplate || 'Clear'}
            </button>
          </div>
        )}

        {error && (
          <div style={{ margin: '0 0 12px', padding: '9px 13px', background: '#FEF2F2', border: '1px solid var(--danger)', borderRadius: '9px', color: 'var(--danger)', fontSize: '.84rem', fontWeight: 500 }}>
            {error}
          </div>
        )}

        {/* SECTION 1: BASIC DETAILS — STRICTLY 3 COLUMNS PER ROW (Regulatory & Scale Tier Auto-Derived) */}
        <div className="chit-section-box">
          <div className="chit-section-hdr">
            <h4><span className="chit-step-pill">01</span>{stripStepPrefix(ui.basicDetails)}</h4>
            <span className="chit-hdr-chip-soft">{ui.autoCalcHint}</span>
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
                {d.installmentAmount || d.monthlyContribution || 'Installment Amount'} ({currencySymbol}) * <FieldHelpIcon title={d.installmentAmount || d.monthlyContribution || 'Installment Amount'} text={getChitFieldTooltip('installmentAmount', lang)} />
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
                <div style={{ fontSize: '.7rem', color: '#B45309', marginTop: '3px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>= {currencySymbol}{(chitValue / totalMembers).toLocaleString('en-IN')} exact</span>
                  <button
                    type="button"
                    style={{ border: 'none', background: 'none', padding: 0, color: 'var(--primary)', fontSize: '.7rem', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
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
                style={{ backgroundColor: 'var(--primary-light)', borderColor: 'var(--primary-border, #CBD5E1)', fontWeight: 700, color: 'var(--primary-dark)' }}
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
          </div>
        </div>

        {/* SECTION 2: CHIT STYLE, CADENCE & ENGINE PARAMETERS — 3 COLUMNS + TOOLTIPS */}
        <div className="chit-section-box">
          <div className="chit-section-hdr">
            <h4><span className="chit-step-pill">02</span>{stripStepPrefix(ui.chitStyleAndCadence)}</h4>
            <code className="chit-hdr-chip">{selectedEngine}</code>
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
            <h4><span className="chit-step-pill">03</span>{stripStepPrefix(ui.foremenAndCommission)}</h4>
            <span className="chit-hdr-chip">
              {selectedForemen.length} foreman account(s) assigned
            </span>
          </div>
          <div className="chit-grid-3">
            <div className="form-group">
              <label className="form-label">
                {(d.commission || 'Commission').replace(/\s*%\s*$/, '')} (%) * <FieldHelpIcon title="Commission %" text={getChitFieldTooltip('commissionPct', lang)} />
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

            {/* Multiple Foremen Portal Assignment Row — Inline + Add Picker */}
            <div className="form-group chit-col-span-3" style={{ paddingTop: '10px', borderTop: '1px dashed #CBD5E1' }}>
              <label className="form-label" style={{ marginBottom: '6px' }}>
                {ui.foremenLabel} <FieldHelpIcon title="Multiple Foremen" text={getChitFieldTooltip('foremen', lang)} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) 170px', gap: '8px', alignItems: 'center' }}>
                <InlineAddPicker
                  compact
                  allowMultiple={false}
                  placeholder="Search staff / foreman & click + to assign..."
                  emptyText="No staff accounts found. Add staff in Settings."
                  summaryText={selectedForemen.length > 0 ? `${selectedForemen.length} assigned` : undefined}
                  items={staffUsers.map((u) => {
                    const isAssigned = selectedForemen.some((f) => f.userId === u.id);
                    const roleText = u.customRoleName || u.customRole?.name || u.role;
                    return {
                      id: u.id,
                      label: u.name,
                      subLabel: u.phone || undefined,
                      badgeText: roleText,
                      count: isAssigned ? 1 : 0,
                    };
                  })}
                  onIncrement={(uid) => {
                    const found = staffUsers.find((u) => u.id === uid);
                    if (!found) return;
                    setSelectedForemen((prev) => {
                      if (prev.some((f) => f.userId === uid)) return prev;
                      const derivedRole =
                        found.customRoleName ||
                        found.customRole?.name ||
                        defaultForemanRole.trim() ||
                        (prev.length === 0 ? 'Primary Foreman' : 'Co-Foreman');
                      return [
                        ...prev,
                        {
                          userId: uid,
                          roleLabel: derivedRole,
                          isPrimary: prev.length === 0,
                        },
                      ];
                    });
                  }}
                  onDecrement={(uid) => {
                    setSelectedForemen((prev) => {
                      const next = prev.filter((f) => f.userId !== uid);
                      if (next.length > 0 && !next.some((f) => f.isPrimary)) {
                        next[0] = { ...next[0], isPrimary: true };
                      }
                      return next;
                    });
                  }}
                />
                <input
                  type="text"
                  className="form-control"
                  value={defaultForemanRole}
                  onChange={(e) => setDefaultForemanRole(e.target.value)}
                  placeholder="Fallback role label"
                  title="Default role label if staff user has no custom designation"
                />
              </div>
              {selectedForemen.length > 0 && (
                <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {selectedForemen.map((f, idx) => {
                    const u = staffUsers.find((s) => s.id === f.userId);
                    return (
                      <span
                        key={f.userId}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '7px',
                          padding: '5px 10px',
                          borderRadius: '9px',
                          border: f.isPrimary ? '1px solid var(--primary)' : '1px solid #CBD5E1',
                          background: f.isPrimary ? 'var(--primary-light)' : '#F8FAFC',
                          color: '#0F172A',
                          fontSize: '.78rem',
                          fontWeight: 500,
                        }}
                      >
                        <strong>{u?.name || f.userId}</strong>
                        <span style={{ fontSize: '.72rem', color: '#475569' }}>({f.roleLabel})</span>
                        <button
                          type="button"
                          title={f.isPrimary ? 'Primary Foreman' : 'Set as Primary'}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: f.isPrimary ? '#D97706' : '#94A3B8', fontWeight: 700, fontSize: '.9rem' }}
                          onClick={() =>
                            setSelectedForemen((prev) => prev.map((x, i) => ({ ...x, isPrimary: i === idx })))
                          }
                        >
                          {f.isPrimary ? '★' : '☆'}
                        </button>
                        <button
                          type="button"
                          title="Remove foreman"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#DC2626', fontWeight: 700, fontSize: '.9rem' }}
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

        {/* SECTION 4: MULTI-TICKET CUSTOMER ENROLLMENT — INLINE + PICKER */}
        <div className="chit-section-box">
          <div className="chit-section-hdr">
            <h4>
              <span className="chit-step-pill">04</span>
              {stripStepPrefix(ui.membersAndTickets)}{' '}
              <FieldHelpIcon title="Multi-Ticket Enrollment" text={getChitFieldTooltip('multiTicketMembers', lang)} />
            </h4>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span className="chit-hdr-chip" style={selectedMembers.length >= totalMembers ? { background: '#FEF3C7', borderColor: '#F59E0B', color: '#92400E' } : undefined}>
                {selectedMembers.length} / {totalMembers} {ui.seatsOccupied}
              </span>
              <span className="chit-hdr-chip">
                {groupedTickets.length} {ui.uniqueCustomers}
              </span>
            </div>
          </div>

          <div style={{ marginBottom: groupedTickets.length ? '10px' : '0' }}>
            <InlineAddPicker
              placeholder="Search customer & click + right inside dropdown (multi-ticket supported)..."
              emptyText="No customers found."
              summaryText={`${selectedMembers.length} / ${totalMembers} tickets`}
              allowMultiple
              maxTotalReached={selectedMembers.length >= totalMembers}
              onExceedMax={(cid) => addTicketsForCustomer(cid, 1)}
              items={customers.map((c) => {
                const count = selectedMembers.filter((id) => id === c.id).length;
                return {
                  id: c.id,
                  label: c.name,
                  subLabel: c.customerCode,
                  count,
                };
              })}
              onIncrement={(cid) => addTicketsForCustomer(cid, 1)}
              onDecrement={(cid) => removeOneTicketForCustomer(cid)}
              footerAction={{ label: 'New Customer', href: '/customers/new' }}
            />
          </div>

          {/* Hidden form inputs carrying exact duplicate customerIds for FormData */}
          {selectedMembers.filter(Boolean).map((cid, i) => (
            <input key={`${cid}-${i}`} type="hidden" name="memberIds" value={cid} />
          ))}

          {groupedTickets.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
              {groupedTickets.map(({ customerId, customer, ticketNumbers }) => (
                <div
                  key={customerId}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '5px 10px',
                    borderRadius: '9px',
                    border: '1px solid #CBD5E1',
                    background: '#F4F7FA',
                    fontSize: '.78rem',
                  }}
                >
                  <strong style={{ color: '#0F172A' }}>{customer?.name || customerId}</strong>
                  <span className="badge badge-info" style={{ fontSize: '.7rem' }}>
                    {ticketNumbers.length} {ticketNumbers.length === 1 ? 'ticket' : 'tickets'} (#{ticketNumbers.join(', #')})
                  </span>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ padding: '2px 7px', fontSize: '.72rem' }}
                    title="Add +1 ticket for this customer"
                    onClick={() => addTicketsForCustomer(customerId, 1)}
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 7px', fontSize: '.72rem', backgroundColor: '#FFFFFF' }}
                    title="Remove 1 ticket"
                    onClick={() => removeOneTicketForCustomer(customerId)}
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 5px', fontSize: '.76rem', color: 'var(--danger)' }}
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
        <div className={`chit-section-box ${openAdvanced ? '' : 'is-collapsed'}`}>
          <div
            className="chit-section-hdr"
            style={{ cursor: 'pointer' }}
            onClick={() => setOpenAdvanced((v) => !v)}
          >
            <h4><span className="chit-step-pill">05</span>{stripStepPrefix(ui.advancedBidDividend)}</h4>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className="chit-hdr-chip-soft">Div: {dividendPolicy} ({dividendDistribution}) · Cutoff: {engineConfig.defaultRules.substitutionCutoffPct}%</span>
              <span className="chit-hdr-chip">
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
              <h4><span className="chit-step-pill">06</span>{stripStepPrefix(ui.registrationCompliance)}</h4>
              <span className="chit-hdr-chip">Act 1982 Filing</span>
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
        <div className={`chit-section-box ${openSecurity ? '' : 'is-collapsed'}`}>
          <div
            className="chit-section-hdr"
            style={{ cursor: 'pointer' }}
            onClick={() => setOpenSecurity((v) => !v)}
          >
            <h4><span className="chit-step-pill">{chitType === 'registered' ? '07' : '06'}</span>{stripStepPrefix(ui.securityAndLiveRoom)}</h4>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className="chit-hdr-chip-soft">Security: {engineConfig.securityRequirements.acceptedTypes[0] || 'NONE'} · Bell: {bellEnabled ? 'On' : 'Off'}</span>
              <span className="chit-hdr-chip">
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
      </div>

      <ChitTemplateExplainerModal
        template={explainerTemplate}
        currencySymbol={currencySymbol}
        lang={lang}
        dict={dict as Record<string, unknown>}
        isApplied={Boolean(explainerTemplate && activeTemplate === explainerTemplate.code)}
        onApply={(tmpl, customOverrides) => applyTemplate(tmpl, customOverrides)}
        onClose={() => setExplainerTemplate(null)}
      />

      {limitWarningModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="member-limit-warning-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '16px',
          }}
          onClick={() => setLimitWarningModal(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '470px',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #CBD5E1',
              boxShadow: '0 22px 48px -12px rgba(15, 23, 42, 0.32)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '14px 18px',
                background: 'linear-gradient(90deg, #B45309 0%, #D97706 100%)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '22px' }}>warning_amber</span>
                <h4 id="member-limit-warning-title" style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Member Limit Exceeded ({totalMembers} Members)
                </h4>
              </div>
              <button
                type="button"
                aria-label="Close warning"
                onClick={() => setLimitWarningModal(null)}
                style={{ border: 'none', background: 'rgba(255,255,255,0.2)', color: '#FFFFFF', borderRadius: '8px', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 700 }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '18px' }}>
              <p style={{ margin: '0 0 12px', fontSize: '.9rem', color: '#0F172A', lineHeight: 1.5 }}>
                Adding <strong>{limitWarningModal.customerName}</strong> exceeds the limit of{' '}
                <strong>{totalMembers}</strong> members set for this group (total becomes{' '}
                <strong>{limitWarningModal.nextTotal}</strong>).
              </p>
              <p style={{ margin: '0 0 14px', fontSize: '.86rem', color: '#475569', fontWeight: 600 }}>
                Do you want to increase the limit to {limitWarningModal.nextTotal} members and add more customer?
              </p>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #FDE68A',
                  fontSize: '.78rem',
                  color: '#92400E',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <span>New limit: <strong>{limitWarningModal.nextTotal} members</strong></span>
                <span>Updated installment: <strong>{currencySymbol}{Math.round(chitValue / limitWarningModal.nextTotal).toLocaleString('en-IN')}</strong></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ backgroundColor: '#F8FAFC' }}
                  onClick={() => setLimitWarningModal(null)}
                >
                  Cancel (Keep {totalMembers})
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    commitAddTickets(limitWarningModal.customerId, limitWarningModal.qty, true);
                    setLimitWarningModal(null);
                  }}
                >
                  Yes, Add More Customer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
