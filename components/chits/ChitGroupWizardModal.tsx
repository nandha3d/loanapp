'use client';

import { useEffect, useRef, useState } from 'react';
import { createChitGroup } from '@/app/(dashboard)/[module]/chits/actions';
import InlineAddPicker from '@/components/chits/InlineAddPicker';
import FieldHelpIcon from '@/components/chits/FieldHelpIcon';
import { getChitWizardUi } from '@/lib/chits/chitConfigExplainI18n';
import { formatChitTenure } from '@/lib/chits/formTooltipsI18n';
import {
  collectionFrequencyToConfig,
  nextPeriodDate,
  type FrequencyConfig,
} from '@/lib/chits/frequency';
import {
  CHIT_ENGINE_CATALOG,
  CHIT_SECURITY_TYPES,
  DEFAULT_ENABLED_CHIT_ENGINE_TYPES,
  FOREMAN_COMPENSATION_MODES,
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
import { formatCurrency } from '@/lib/utils';
import './chit-wizard.css';

const OPEN_EVENT = 'zolofund:open-chit-wizard';
const DRAFT_CHANGED_EVENT = 'zolofund:chit-wizard-draft-changed';

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

interface WizardDraftSnapshot {
  step: number;
  activeTemplate: ChitTemplateCode | 'CUSTOM' | null;
  selectedEngine: ChitEngineType;
  engineConfig: ChitEngineConfig;
  chitType: 'unregistered' | 'registered';
  groupName: string;
  chitValue: number;
  totalMembers: number;
  monthlyContrib: number;
  startDate: string;
  auctionType: 'open_manual' | 'open_live' | 'sealed' | 'lottery' | 'fixed_rotation';
  auctionFrequency: string;
  frequencyMode: 'preset' | 'custom';
  customUnit: 'day' | 'week' | 'month';
  customInterval: number;
  customWeekdays: number[];
  auctionMode: 'online' | 'offline';
  auctionDay: string;
  auctionTime: string;
  commissionPct: number;
  commissionBasis: 'BID_DISCOUNT' | 'CHIT_VALUE';
  gstPct: string;
  hasForemanTicket: boolean;
  foremanName: string;
  selectedForemen: ForemanEntry[];
  minDiscountPct: string;
  maxDiscountPct: string;
  bidIncrement?: number;
  strictBidMultiple?: boolean;
  dividendPolicy: string;
  dividendDistribution: string;
  bellEnabled: boolean;
  bellIntervalSeconds?: number;
  bellAutoClose: boolean;
  tableCashEnabled?: boolean;
  roomAdmission: 'auto' | 'approval';
  winnerInterestType: string;
  winnerInterestValue: number;
  winnerInterestPeriods: number;
  registrationNo: string;
  registrationDate: string;
  registrarOffice: string;
  bylawNo: string;
  commencementCertificate: string;
  approvedBankName: string;
  approvedBankAccountNo: string;
  stateCode?: 'TN' | 'DL' | 'GENERIC';
  priorSanctionNumber?: string;
  registeredOfficeAddress?: string;
  remarks: string;
  selectedMembers: string[];
  savedAt: string;
}

const AUCTION_TYPE_INFO: Record<string, string> = {
  open_live:
    'Live Online Bidding Room: Members join together at scheduled time and bid down in real time with a 3-bell timer.',
  open_manual:
    'Offline / Staff Entry Auction: Hold bidding in person or over phone, then foreman enters the winning amount here.',
  sealed:
    'Sealed Secret Bids: Every eligible member submits one hidden bid amount. Bids unlock automatically after the close.',
  lottery:
    'Lucky Draw (Chit Lot): No price bidding! One eligible member is picked by random draw for the full pot.',
  fixed_rotation:
    'Fixed Turn Order: Payout follows ticket order (#1 gets cycle 1, #2 gets cycle 2, etc.) with zero bidding.',
};

const DIVIDEND_POLICY_INFO: Record<string, string> = {
  ALL_MEMBERS:
    'Everyone in the group (both winners and non-winners) receives an equal share of the bid discount.',
  NON_PRIZED_ONLY:
    'Only members who have NOT won a prize yet receive dividend savings; past winners pay the full installment.',
  NON_WINNERS_ONLY:
    'Everyone except this single cycle’s winner shares the bid discount dividend.',
  NONE: 'Zero discount dividend is distributed — used for fixed savings / lottery pots.',
};

const DIVIDEND_DIST_INFO: Record<string, string> = {
  ADJUST_NEXT_DUE:
    'Most common: Today’s dividend automatically lowers what each member needs to pay next cycle.',
  CASH_PAYOUT:
    'Members pay the full fixed amount each cycle and dividend shares are paid out separately.',
  ACCUMULATE:
    'Dividends are saved inside the pool and settled together when the chit group finishes.',
  DEFERRED_BONUS_POOL:
    'Holds extra discount as a loyalty bonus paid out at group completion.',
  NONE: 'No separate dividend settlement needed.',
};

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

function readDraft(storageKey: string): WizardDraftSnapshot | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as WizardDraftSnapshot;
  } catch {
    return null;
  }
}

export function ChitWizardOpenButton({
  label,
  className,
  icon = 'add',
  mode = 'auto',
}: {
  label: string;
  className?: string;
  icon?: string;
  mode?: 'auto' | 'new' | 'resume';
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { mode } }));
      }}
    >
      <span className="material-icons-outlined" style={{ fontSize: '18px' }}>{icon}</span>
      {label}
    </button>
  );
}

type ChitTemplateDictMap = Record<string, { title?: string; summary?: string }>;
type ChitWizardDict = {
  chits: {
    templates?: ChitTemplateDictMap;
    engineNames?: Record<string, string>;
  } & Record<string, unknown>;
};

export function ChitWizardResumeBanner({
  storageKey,
  dict,
}: {
  storageKey: string;
  dict: ChitWizardDict;
}) {
  const [draft, setDraft] = useState<WizardDraftSnapshot | null>(null);
  const d = dict.chits as Record<string, string> & {
    templates?: ChitTemplateDictMap;
    engineNames?: Record<string, string>;
  };

  useEffect(() => {
    const refresh = () => setDraft(readDraft(storageKey));
    refresh();
    window.addEventListener(DRAFT_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(DRAFT_CHANGED_EVENT, refresh);
  }, [storageKey]);

  if (!draft) return null;

  const savedTime = draft.savedAt
    ? new Date(draft.savedAt).toLocaleString([], {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
    : '';

  const mappedStep = Math.min(4, Math.max(1, draft.step > 4 ? 4 : draft.step || 1));

  return (
    <div className="chit-resume-banner">
      <div className="chit-resume-left">
        <div className="chit-resume-badge">
          <span className="material-icons-outlined" style={{ fontSize: '22px' }}>edit_note</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="chit-resume-title">
            {d.wizardResumeBannerTitle}:{' '}
            <span style={{ color: 'var(--primary-dark)' }}>
              {draft.groupName?.trim() || 'Untitled Chit Group'}
            </span>
          </div>
          <div className="chit-resume-meta">
            {mappedStep} / 4 ·{' '}
            {draft.chitType === 'registered' ? d.act1982 : d.privateChit} ·{' '}
            {draft.totalMembers || 10} {d.members}
            {savedTime ? ` · ${savedTime}` : ''}
          </div>
        </div>
      </div>

      <div className="chit-resume-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { mode: 'resume' } }));
          }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '17px' }}>play_arrow</span>
          {d.wizardResumeBtn}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            try {
              window.localStorage.removeItem(storageKey);
            } catch {
              /* ignore */
            }
            setDraft(null);
            window.dispatchEvent(new CustomEvent(DRAFT_CHANGED_EVENT));
          }}
        >
          {d.wizardDiscardDraft}
        </button>
      </div>
    </div>
  );
}

export default function ChitGroupWizardModal({
  storageKey,
  customers,
  staffUsers = [],
  currentUserId,
  currencySymbol,
  dict,
  lang = 'en',
  enabledChitTypes,
  typeDefaults,
}: {
  storageKey: string;
  customers: { id: string; name: string; customerCode: string }[];
  staffUsers?: StaffUserOption[];
  currentUserId?: string;
  currencySymbol: string;
  dict: ChitWizardDict;
  lang?: string;
  enabledChitTypes?: ChitEngineType[];
  typeDefaults?: Partial<Record<ChitEngineType, ChitEngineConfig>>;
}) {
  const d = dict.chits as Record<string, string> & {
    templates?: ChitTemplateDictMap;
    engineNames?: Record<string, string>;
  };
  const railRef = useRef<HTMLDivElement | null>(null);
  const availableTypes =
    enabledChitTypes && enabledChitTypes.length > 0
      ? enabledChitTypes
      : [...DEFAULT_ENABLED_CHIT_ENGINE_TYPES];

  const defaultEngine = availableTypes[0];
  const makeInitialCfg = (code: ChitEngineType): ChitEngineConfig =>
    typeDefaults?.[code]
      ? structuredClone(typeDefaults[code]!)
      : structuredClone(CHIT_ENGINE_CATALOG[code].defaultConfig);

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | ChitEngineCategory>('ALL');

  const [activeTemplate, setActiveTemplate] = useState<ChitTemplateCode | 'CUSTOM' | null>(null);
  const [selectedEngine, setSelectedEngine] = useState<ChitEngineType>(defaultEngine);
  const [engineConfig, setEngineConfig] = useState<ChitEngineConfig>(() => makeInitialCfg(defaultEngine));
  const [chitType, setChitType] = useState<'unregistered' | 'registered'>(
    engineConfig.regulatoryTier === 'REGISTERED_ACT_1982' ? 'registered' : 'unregistered',
  );
  const [groupName, setGroupName] = useState('');
  const [chitValue, setChitValue] = useState(100000);
  const [totalMembers, setTotalMembers] = useState(10);
  const [monthlyContrib, setMonthlyContrib] = useState(10000);
  const [startDate, setStartDate] = useState('');
  const [auctionType, setAuctionType] = useState<
    'open_manual' | 'open_live' | 'sealed' | 'lottery' | 'fixed_rotation'
  >(mapBiddingModeToAuctionType(defaultEngine, engineConfig.biddingMode));
  const [auctionFrequency, setAuctionFrequency] = useState('monthly');
  const [frequencyMode, setFrequencyMode] = useState<'preset' | 'custom'>('preset');
  const [customUnit, setCustomUnit] = useState<'day' | 'week' | 'month'>('month');
  const [customInterval, setCustomInterval] = useState(1);
  const [customWeekdays, setCustomWeekdays] = useState<number[]>([]);
  const [auctionMode, setAuctionMode] = useState<'online' | 'offline'>('online');
  const [auctionDay, setAuctionDay] = useState('');
  const [auctionTime, setAuctionTime] = useState('19:30');
  const [commissionPct, setCommissionPct] = useState(engineConfig.foremanCompensation.commissionPct);
  const [commissionBasis, setCommissionBasis] = useState<'BID_DISCOUNT' | 'CHIT_VALUE'>('BID_DISCOUNT');
  const [gstPct, setGstPct] = useState('');
  const [hasForemanTicket, setHasForemanTicket] = useState(false);
  const [foremanName, setForemanName] = useState('');
  const [selectedForemen, setSelectedForemen] = useState<ForemanEntry[]>(() => {
    if (currentUserId && staffUsers.some((u) => u.id === currentUserId)) {
      return [{ userId: currentUserId, roleLabel: 'Organizer / Foreman', isPrimary: true }];
    }
    return [];
  });
  const [minDiscountPct, setMinDiscountPct] = useState(
    engineConfig.discountRules.minDiscountPct > 0 ? String(engineConfig.discountRules.minDiscountPct) : '',
  );
  const [maxDiscountPct, setMaxDiscountPct] = useState(
    engineConfig.discountRules.maxDiscountPct != null ? String(engineConfig.discountRules.maxDiscountPct) : '',
  );
  const [bidIncrement, setBidIncrement] = useState<number>(
    engineConfig.discountRules.bidIncrementMultiple > 0 ? engineConfig.discountRules.bidIncrementMultiple : 100,
  );
  const [strictBidMultiple, setStrictBidMultiple] = useState<boolean>(
    engineConfig.discountRules.strictBidMultiple ??
    (engineConfig.discountRules.bidIncrementMultiple > 1 || engineConfig.discountRules.bidIncrementMultiple === 0),
  );
  const [dividendPolicy, setDividendPolicy] = useState('ALL_MEMBERS');
  const [dividendDistribution, setDividendDistribution] = useState('ADJUST_NEXT_DUE');
  const [bellEnabled, setBellEnabled] = useState(true);
  const [bellIntervalSeconds, setBellIntervalSeconds] = useState(60);
  const [bellAutoClose, setBellAutoClose] = useState(true);
  const [tableCashEnabled, setTableCashEnabled] = useState(false);
  const [roomAdmission, setRoomAdmission] = useState<'auto' | 'approval'>('auto');
  const [winnerInterestType, setWinnerInterestType] = useState('NONE');
  const [winnerInterestValue, setWinnerInterestValue] = useState(0);
  const [winnerInterestPeriods, setWinnerInterestPeriods] = useState(0);

  const [registrationNo, setRegistrationNo] = useState('');
  const [registrationDate, setRegistrationDate] = useState('');
  const [registrarOffice, setRegistrarOffice] = useState('');
  const [bylawNo, setBylawNo] = useState('');
  const [commencementCertificate, setCommencementCertificate] = useState('');
  const [approvedBankName, setApprovedBankName] = useState('');
  const [approvedBankAccountNo, setApprovedBankAccountNo] = useState('');
  const [stateCode, setStateCode] = useState<'TN' | 'DL' | 'GENERIC'>('TN');
  const [priorSanctionNumber, setPriorSanctionNumber] = useState('');
  const [registeredOfficeAddress, setRegisteredOfficeAddress] = useState('');
  const [remarks, setRemarks] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [limitWarningModal, setLimitWarningModal] = useState<{
    customerId: string;
    customerName: string;
    nextTotal: number;
  } | null>(null);

  const resetWizardState = () => {
    const cfg = makeInitialCfg(defaultEngine);
    setStep(1);
    setError('');
    setActiveTemplate(null);
    setSelectedEngine(defaultEngine);
    setEngineConfig(cfg);
    setChitType(cfg.regulatoryTier === 'REGISTERED_ACT_1982' ? 'registered' : 'unregistered');
    setGroupName('');
    setChitValue(100000);
    setTotalMembers(10);
    setMonthlyContrib(10000);
    setStartDate('');
    setAuctionType(mapBiddingModeToAuctionType(defaultEngine, cfg.biddingMode));
    setAuctionFrequency('monthly');
    setFrequencyMode('preset');
    setCustomUnit('month');
    setCustomInterval(1);
    setCustomWeekdays([]);
    setAuctionMode('online');
    setAuctionDay('');
    setAuctionTime('19:30');
    setCommissionPct(cfg.foremanCompensation.commissionPct);
    setCommissionBasis('BID_DISCOUNT');
    setGstPct('');
    setHasForemanTicket(false);
    setForemanName('');
    setSelectedForemen(
      currentUserId && staffUsers.some((u) => u.id === currentUserId)
        ? [{ userId: currentUserId, roleLabel: 'Organizer / Foreman', isPrimary: true }]
        : [],
    );
    setMinDiscountPct(cfg.discountRules.minDiscountPct > 0 ? String(cfg.discountRules.minDiscountPct) : '');
    setMaxDiscountPct(cfg.discountRules.maxDiscountPct != null ? String(cfg.discountRules.maxDiscountPct) : '');
    const initInc = cfg.discountRules.bidIncrementMultiple > 0 ? cfg.discountRules.bidIncrementMultiple : 100;
    setBidIncrement(initInc);
    setStrictBidMultiple(cfg.discountRules.strictBidMultiple ?? initInc > 1);
    setDividendPolicy('ALL_MEMBERS');
    setDividendDistribution('ADJUST_NEXT_DUE');
    setBellEnabled(true);
    setBellIntervalSeconds(60);
    setBellAutoClose(true);
    setTableCashEnabled(Boolean(cfg.tableCash?.enabled));
    setRoomAdmission('auto');
    setWinnerInterestType('NONE');
    setWinnerInterestValue(0);
    setWinnerInterestPeriods(0);
    setRegistrationNo('');
    setRegistrationDate('');
    setRegistrarOffice('');
    setBylawNo('');
    setCommencementCertificate('');
    setApprovedBankName('');
    setApprovedBankAccountNo('');
    setStateCode('TN');
    setPriorSanctionNumber('');
    setRegisteredOfficeAddress('');
    setRemarks('');
    setSelectedMembers([]);
  };

  const restoreFromDraft = (draft: WizardDraftSnapshot) => {
    const safeEngine = availableTypes.includes(draft.selectedEngine)
      ? draft.selectedEngine
      : defaultEngine;
    setStep(Math.min(4, Math.max(1, draft.step > 4 ? 4 : draft.step || 1)));
    setActiveTemplate(draft.activeTemplate ?? null);
    setSelectedEngine(safeEngine);
    setEngineConfig(draft.engineConfig ?? makeInitialCfg(safeEngine));
    setChitType(draft.chitType === 'registered' ? 'registered' : 'unregistered');
    setGroupName(draft.groupName ?? '');
    setChitValue(Number(draft.chitValue) || 100000);
    setTotalMembers(Number(draft.totalMembers) || 10);
    setMonthlyContrib(Number(draft.monthlyContrib) || 10000);
    setStartDate(draft.startDate ?? '');
    setAuctionType(draft.auctionType ?? 'open_live');
    setAuctionFrequency(draft.auctionFrequency ?? 'monthly');
    setFrequencyMode(draft.frequencyMode === 'custom' ? 'custom' : 'preset');
    setCustomUnit(draft.customUnit ?? 'month');
    setCustomInterval(Number(draft.customInterval) || 1);
    setCustomWeekdays(Array.isArray(draft.customWeekdays) ? draft.customWeekdays : []);
    setAuctionMode(draft.auctionMode === 'offline' ? 'offline' : 'online');
    setAuctionDay(draft.auctionDay ?? '');
    setAuctionTime(draft.auctionTime ?? '19:30');
    setCommissionPct(Number.isFinite(Number(draft.commissionPct)) ? Number(draft.commissionPct) : 5);
    setCommissionBasis(draft.commissionBasis === 'CHIT_VALUE' ? 'CHIT_VALUE' : 'BID_DISCOUNT');
    setGstPct(draft.gstPct ?? '');
    setHasForemanTicket(Boolean(draft.hasForemanTicket));
    setForemanName(draft.foremanName ?? '');
    const restoredForemen = Array.isArray(draft.selectedForemen) ? draft.selectedForemen : [];
    setSelectedForemen(
      restoredForemen.length > 0
        ? restoredForemen
        : currentUserId && staffUsers.some((u) => u.id === currentUserId)
          ? [{ userId: currentUserId, roleLabel: 'Organizer / Foreman', isPrimary: true }]
          : [],
    );
    setMinDiscountPct(draft.minDiscountPct ?? '');
    setMaxDiscountPct(draft.maxDiscountPct ?? '');
    const restoredInc =
      Number(draft.bidIncrement) > 0
        ? Number(draft.bidIncrement)
        : draft.engineConfig?.discountRules?.bidIncrementMultiple > 0
          ? draft.engineConfig.discountRules.bidIncrementMultiple
          : 100;
    setBidIncrement(restoredInc);
    setStrictBidMultiple(
      draft.strictBidMultiple !== undefined ? Boolean(draft.strictBidMultiple) : restoredInc > 1,
    );
    setDividendPolicy(draft.dividendPolicy ?? 'ALL_MEMBERS');
    setDividendDistribution(draft.dividendDistribution ?? 'ADJUST_NEXT_DUE');
    setBellEnabled(draft.bellEnabled !== false);
    setBellIntervalSeconds(Math.max(5, Number(draft.bellIntervalSeconds) || 60));
    setBellAutoClose(draft.bellAutoClose !== false);
    setTableCashEnabled(Boolean(draft.tableCashEnabled ?? draft.engineConfig?.tableCash?.enabled));
    setRoomAdmission(draft.roomAdmission === 'approval' ? 'approval' : 'auto');
    setWinnerInterestType(draft.winnerInterestType ?? 'NONE');
    setWinnerInterestValue(Number(draft.winnerInterestValue) || 0);
    setWinnerInterestPeriods(Number(draft.winnerInterestPeriods) || 0);
    setRegistrationNo(draft.registrationNo ?? '');
    setRegistrationDate(draft.registrationDate ?? '');
    setRegistrarOffice(draft.registrarOffice ?? '');
    setBylawNo(draft.bylawNo ?? '');
    setCommencementCertificate(draft.commencementCertificate ?? '');
    setApprovedBankName(draft.approvedBankName ?? '');
    setApprovedBankAccountNo(draft.approvedBankAccountNo ?? '');
    if (draft.stateCode) setStateCode(draft.stateCode);
    setPriorSanctionNumber(draft.priorSanctionNumber ?? '');
    setRegisteredOfficeAddress(draft.registeredOfficeAddress ?? '');
    setRemarks(draft.remarks ?? '');
    setSelectedMembers(Array.isArray(draft.selectedMembers) ? draft.selectedMembers : []);
    setError('');
  };

  const buildSnapshot = (): WizardDraftSnapshot => ({
    step,
    activeTemplate,
    selectedEngine,
    engineConfig,
    chitType,
    groupName,
    chitValue,
    totalMembers,
    monthlyContrib,
    startDate,
    auctionType,
    auctionFrequency,
    frequencyMode,
    customUnit,
    customInterval,
    customWeekdays,
    auctionMode,
    auctionDay,
    auctionTime,
    commissionPct,
    commissionBasis,
    gstPct,
    hasForemanTicket,
    foremanName,
    selectedForemen,
    minDiscountPct,
    maxDiscountPct,
    bidIncrement,
    strictBidMultiple,
    dividendPolicy,
    dividendDistribution,
    bellEnabled,
    bellIntervalSeconds,
    bellAutoClose,
    tableCashEnabled,
    roomAdmission,
    winnerInterestType,
    winnerInterestValue,
    winnerInterestPeriods,
    registrationNo,
    registrationDate,
    registrarOffice,
    bylawNo,
    commencementCertificate,
    approvedBankName,
    approvedBankAccountNo,
    stateCode,
    priorSanctionNumber,
    registeredOfficeAddress,
    remarks,
    selectedMembers,
    savedAt: new Date().toISOString(),
  });

  const persistDraftNow = () => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(buildSnapshot()));
      window.dispatchEvent(new CustomEvent(DRAFT_CHANGED_EVENT));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const onOpen = (ev: Event) => {
      const detail = (ev as CustomEvent<{ mode?: 'auto' | 'new' | 'resume' }>).detail;
      const mode = detail?.mode || 'auto';
      const existing = readDraft(storageKey);
      if (mode === 'new') {
        resetWizardState();
      } else if (existing) {
        restoreFromDraft(existing);
      } else {
        resetWizardState();
      }
      setIsOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [storageKey]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      persistDraftNow();
    }, 180);
    return () => clearTimeout(t);
  }, [
    isOpen, step, activeTemplate, selectedEngine, engineConfig, chitType, groupName,
    chitValue, totalMembers, monthlyContrib, startDate, auctionType, auctionFrequency,
    frequencyMode, customUnit, customInterval, customWeekdays, auctionMode, auctionDay,
    auctionTime, commissionPct, commissionBasis, gstPct, hasForemanTicket, foremanName,
    selectedForemen, minDiscountPct, maxDiscountPct, bidIncrement, strictBidMultiple, dividendPolicy, dividendDistribution,
    bellEnabled, bellIntervalSeconds, bellAutoClose, tableCashEnabled, roomAdmission, winnerInterestType, winnerInterestValue,
    winnerInterestPeriods, registrationNo, registrationDate, registrarOffice, bylawNo,
    commencementCertificate, approvedBankName, approvedBankAccountNo, stateCode,
    priorSanctionNumber, registeredOfficeAddress, remarks, selectedMembers,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        persistDraftNow();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, step, groupName]);

  if (!isOpen) return null;

  const selectEngineType = (code: ChitEngineType) => {
    setSelectedEngine(code);
    const nextCfg = makeInitialCfg(code);
    setEngineConfig(nextCfg);
    setChitType(nextCfg.regulatoryTier === 'REGISTERED_ACT_1982' ? 'registered' : 'unregistered');
    setAuctionType(mapBiddingModeToAuctionType(code, nextCfg.biddingMode));
    setCommissionPct(nextCfg.foremanCompensation.commissionPct);
    setMinDiscountPct(nextCfg.discountRules.minDiscountPct > 0 ? String(nextCfg.discountRules.minDiscountPct) : '');
    setMaxDiscountPct(nextCfg.discountRules.maxDiscountPct != null ? String(nextCfg.discountRules.maxDiscountPct) : '');
    const engInc = nextCfg.discountRules.bidIncrementMultiple > 0 ? nextCfg.discountRules.bidIncrementMultiple : 100;
    setBidIncrement(engInc);
    setStrictBidMultiple(nextCfg.discountRules.strictBidMultiple ?? engInc > 1);
  };

  const applyTemplate = (tmpl: ChitTemplateDefinition) => {
    setActiveTemplate(tmpl.code);
    const targetEngine: ChitEngineType = availableTypes.includes(tmpl.engineType)
      ? tmpl.engineType
      : availableTypes[0];
    selectEngineType(targetEngine);
    const localizedTitle = d.templates?.[tmpl.code]?.title || tmpl.defaultName;
    setGroupName(localizedTitle);
    setChitValue(tmpl.defaultChitValue);
    setTotalMembers(tmpl.defaultTotalMembers);
    setMonthlyContrib(tmpl.defaultMonthlyContrib);
    setChitType(tmpl.defaultChitType);
    setAuctionType(tmpl.defaultAuctionType);
    setAuctionMode(tmpl.defaultAuctionType === 'open_live' ? 'online' : 'offline');
    setCommissionPct(tmpl.defaultCommissionPct);
    setHasForemanTicket(tmpl.defaultHasForemanTicket);
    setDividendPolicy(tmpl.defaultDividendPolicy);
    setDividendDistribution(tmpl.defaultDividendDistribution);
    setWinnerInterestType(tmpl.defaultWinnerInterestType);
    if (tmpl.defaultWinnerInterestValue != null) setWinnerInterestValue(tmpl.defaultWinnerInterestValue);
    if (tmpl.defaultFixedDiscountPct != null) {
      setMinDiscountPct(String(tmpl.defaultFixedDiscountPct));
      setMaxDiscountPct(String(tmpl.defaultFixedDiscountPct));
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

  const handleChitValueChange = (val: number) => {
    const clean = Math.max(0, Number.isFinite(val) ? val : 0);
    setChitValue(clean);
    if (totalMembers > 0) setMonthlyContrib(Math.round(clean / totalMembers));
  };

  const handleTotalMembersChange = (count: number) => {
    const nextMembers = Math.max(2, Math.min(200, Math.round(Number(count) || 2)));
    setTotalMembers(nextMembers);
    if (chitValue > 0) setMonthlyContrib(Math.round(chitValue / nextMembers));
    if (selectedMembers.length > nextMembers) setSelectedMembers((prev) => prev.slice(0, nextMembers));
  };

  const currentFreqConfig: FrequencyConfig =
    frequencyMode === 'custom'
      ? { unit: customUnit, interval: Math.max(1, customInterval), weekdays: customWeekdays.length ? customWeekdays : null }
      : collectionFrequencyToConfig(auctionFrequency);
  const tenureDisplay = formatChitTenure(totalMembers, currentFreqConfig, lang);

  const previewDates = (() => {
    const base = startDate ? new Date(startDate) : null;
    if (!base || Number.isNaN(base.getTime())) return [];
    return [1, 2, 3].map((p) => nextPeriodDate(base, p, currentFreqConfig));
  })();

  const groupedTickets = (() => {
    const map = new Map<string, number[]>();
    selectedMembers.forEach((cid, idx) => {
      const arr = map.get(cid) ?? [];
      arr.push(idx + 1);
      map.set(cid, arr);
    });
    return Array.from(map.entries()).map(([customerId, ticketNumbers]) => ({
      customerId,
      customer: customers.find((c) => c.id === customerId),
      ticketNumbers,
    }));
  })();

  const filteredTemplates =
    selectedCategory === 'ALL'
      ? PRACTICAL_CHIT_TEMPLATES
      : PRACTICAL_CHIT_TEMPLATES.filter((t) => t.category === selectedCategory);

  const wizardUi = getChitWizardUi(lang);
  const stepTitles = wizardUi.steps;
  const stepGuides = wizardUi.guides;

  const goNext = () => {
    setError('');
    if (step === 2 && !groupName.trim()) {
      setError(wizardUi.groupNameRequiredErr);
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const handleSaveAndExit = () => {
    persistDraftNow();
    setIsOpen(false);
  };

  const handleStartFresh = () => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    resetWizardState();
    window.dispatchEvent(new CustomEvent(DRAFT_CHANGED_EVENT));
  };

  const handleSubmitCreate = async () => {
    if (!groupName.trim()) {
      setError('Chit group name is required.');
      setStep(2);
      return;
    }
    setLoading(true);
    setError('');

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
        bidIncrementMultiple: Math.max(1, Math.round(Number(bidIncrement) || 1)),
        strictBidMultiple: bidIncrement > 1 ? strictBidMultiple : false,
      },
      tableCash: {
        enabled: tableCashEnabled,
        allowWinnerSettleAfterAuction: true,
      },
    };

    const fd = new FormData();
    fd.set('name', groupName.trim());
    fd.set('chitValue', String(chitValue));
    fd.set('monthlyContrib', String(monthlyContrib));
    fd.set('totalMembers', String(totalMembers));
    fd.set('durationMonths', String(totalMembers));
    if (startDate) fd.set('startDate', startDate);
    fd.set('chitType', chitType);
    fd.set('chitEngineType', selectedEngine);
    fd.set('engineConfig', JSON.stringify(syncedConfig));
    fd.set('auctionType', auctionType);
    fd.set('auctionMode', auctionMode);
    if (auctionDay) fd.set('auctionDay', auctionDay);
    if (auctionTime) fd.set('auctionTime', auctionTime);

    if (frequencyMode === 'custom') {
      fd.set('auctionFrequency', 'custom');
      fd.set('frequencyUnit', customUnit);
      fd.set('frequencyInterval', String(customInterval));
      fd.set('frequencyWeekdays', customWeekdays.join(','));
    } else {
      fd.set('auctionFrequency', auctionFrequency);
    }

    fd.set('commissionPct', String(commissionPct));
    fd.set('commissionBasis', commissionBasis);
    if (gstPct) fd.set('gstPct', gstPct);
    fd.set('hasForemanTicket', hasForemanTicket ? 'true' : 'false');
    if (foremanName.trim()) fd.set('foremanName', foremanName.trim());
    fd.set('foremenJson', JSON.stringify(selectedForemen));
    if (minDiscountPct) fd.set('minDiscountPct', minDiscountPct);
    if (maxDiscountPct) fd.set('maxDiscountPct', maxDiscountPct);
    const cleanStep = Math.max(1, Math.round(Number(bidIncrement) || 1));
    fd.set('bidIncrement', String(cleanStep));
    fd.set('strictBidMultiple', cleanStep > 1 && strictBidMultiple ? 'true' : 'false');
    fd.set('bidStartAtCommission', 'true');
    fd.set('dividendPolicy', dividendPolicy);
    fd.set('dividendDistribution', dividendDistribution);
    fd.set('winnerInterestType', winnerInterestType);
    fd.set('winnerInterestValue', String(winnerInterestValue));
    fd.set('winnerInterestPeriods', String(winnerInterestPeriods));
    fd.set('bellEnabled', !['lottery', 'fixed_rotation', 'sealed'].includes(auctionType) && bellEnabled ? 'true' : 'false');
    fd.set('bellIntervalSeconds', String(Math.max(5, Math.min(300, Math.round(bellIntervalSeconds || 60)))));
    fd.set('bellAutoClose', !['lottery', 'fixed_rotation', 'sealed'].includes(auctionType) && bellAutoClose ? 'true' : 'false');
    fd.set('roomAdmission', roomAdmission);

    if (chitType === 'registered') {
      if (registrationNo.trim()) fd.set('registrationNo', registrationNo.trim());
      if (registrationDate) fd.set('registrationDate', registrationDate);
      if (registrarOffice.trim()) fd.set('registrarOffice', registrarOffice.trim());
      if (bylawNo.trim()) fd.set('bylawNo', bylawNo.trim());
      if (commencementCertificate.trim()) fd.set('commencementCertificate', commencementCertificate.trim());
      if (approvedBankName.trim()) fd.set('approvedBankName', approvedBankName.trim());
      if (approvedBankAccountNo.trim()) fd.set('approvedBankAccountNo', approvedBankAccountNo.trim());
    }
    fd.set('stateCode', stateCode);
    if (priorSanctionNumber.trim()) fd.set('priorSanctionNumber', priorSanctionNumber.trim());
    if (registeredOfficeAddress.trim()) fd.set('registeredOfficeAddress', registeredOfficeAddress.trim());
    if (remarks.trim()) fd.set('remarks', remarks.trim());
    selectedMembers.forEach((cid) => fd.append('memberIds', cid));

    try {
      try {
        window.localStorage.removeItem(storageKey);
        window.dispatchEvent(new CustomEvent(DRAFT_CHANGED_EVENT));
      } catch {
        /* ignore */
      }
      await createChitGroup(fd);
    } catch (err: unknown) {
      const e = err as { digest?: string; message?: string };
      if (e?.digest?.startsWith?.('NEXT_REDIRECT') || e?.message === 'NEXT_REDIRECT') {
        throw err;
      }
      persistDraftNow();
      setError(e?.message || d.failed || 'Failed to create chit group');
      setLoading(false);
    }
  };

  const scrollRail = (dir: -1 | 1) => {
    if (!railRef.current) return;
    railRef.current.scrollBy({ left: dir * 350, behavior: 'smooth' });
  };

  const selectedTemplateObj =
    activeTemplate && activeTemplate !== 'CUSTOM'
      ? PRACTICAL_CHIT_TEMPLATES.find((t) => t.code === activeTemplate) ?? null
      : null;

  return (
    <div
      className="chit-wiz-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={d.wizardTitle}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSaveAndExit();
      }}
    >
      <div className="chit-wiz-dialog">
        {/* Header + 4 Streamlined Steps */}
        <div className="chit-wiz-header">
          <div className="chit-wiz-header-top">
            <div>
              <h2 className="chit-wiz-title">{d.wizardTitle}</h2>
              <p className="chit-wiz-subtitle">{d.wizardSubtitle}</p>
            </div>
            <div className="chit-wiz-header-pills">
              <span className="chit-wiz-pill">{wizardUi.potLabel}: {formatCurrency(chitValue, currencySymbol)}</span>
              <span className="chit-wiz-pill">{tenureDisplay}</span>
              <span className="chit-wiz-pill">
                {selectedMembers.length}/{totalMembers} {d.members}
              </span>
              <button type="button" className="chit-wiz-fresh-btn" onClick={handleStartFresh}>
                ↺ {d.wizardStartFresh}
              </button>
              <button
                type="button"
                className="chit-wiz-close-btn"
                aria-label={d.wizardSaveAndExit}
                onClick={handleSaveAndExit}
              >
                <span className="material-icons-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>
          </div>

          <div className="chit-wiz-stepper">
            {stepTitles.map((title, idx) => {
              const num = idx + 1;
              const isActive = step === num;
              const isDone = step > num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setError('');
                    setStep(num);
                  }}
                  className={`chit-wiz-step-btn${isActive ? ' chit-wiz-step-btn--active' : ''}${isDone ? ' chit-wiz-step-btn--done' : ''}`}
                >
                  <span className="chit-wiz-step-num">{isDone ? '✓' : num}</span>
                  <span className="chit-wiz-step-label">{title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="chit-wiz-body">
          <div className="chit-wiz-guide">
            <span className="material-icons-outlined" style={{ fontSize: '22px', flexShrink: 0, color: 'var(--primary)' }}>
              lightbulb
            </span>
            <span>{stepGuides[step - 1]}</span>
          </div>

          {error && (
            <div
              style={{
                padding: '13px 16px',
                borderRadius: '12px',
                background: 'var(--danger-bg)',
                border: '1.5px solid var(--danger)',
                color: 'var(--danger)',
                fontSize: '0.95rem',
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          )}

          {/* STEP 1: HORIZONTAL SCROLLING TEMPLATES */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                className="chit-wiz-section-card chit-wiz-section-card--padded"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ fontSize: '0.95rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <strong>Already have an active chit running?</strong>
                  <span style={{ color: 'var(--text-secondary)' }}>Move existing books mid-cycle instead of starting at Period 1.</span>
                  <FieldHelpIcon
                    title="Mid-Cycle Running Chit Migration"
                    text="Use this if your chit already completed several months (e.g. Month 8 of 20). You can carry forward old winners, arrears, and cash without fake back-dated dues."
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.9rem', padding: '8px 14px' }}
                  onClick={() => {
                    setIsOpen(false);
                    window.dispatchEvent(new CustomEvent('zolofund:open-chit-migration'));
                  }}
                >
                  🔄 Import Running Chit (Mid-Cycle)
                </button>
              </div>

              <div className="chit-wiz-rail-head">
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(['ALL', 'AUCTION', 'FIXED_CHART', 'MICRO_COMMODITY', 'ENTERPRISE_HYBRID'] as const).map((cat) => {
                    const active = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.9rem', padding: '7px 14px' }}
                        onClick={() => setSelectedCategory(cat)}
                      >
                        {cat === 'ALL'
                          ? wizardUi.allPlans
                          : cat === 'AUCTION'
                            ? wizardUi.catAuction
                            : cat === 'FIXED_CHART'
                              ? wizardUi.catFixed
                              : cat === 'MICRO_COMMODITY'
                                ? wizardUi.catMicroGold
                                : wizardUi.catEnterprise}
                      </button>
                    );
                  })}
                </div>

                <div className="chit-wiz-rail-controls">
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {wizardUi.scrollCards}
                  </span>
                  <button
                    type="button"
                    aria-label="Scroll templates left"
                    className="chit-wiz-rail-arrow"
                    onClick={() => scrollRail(-1)}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Scroll templates right"
                    className="chit-wiz-rail-arrow"
                    onClick={() => scrollRail(1)}
                  >
                    ›
                  </button>
                </div>
              </div>

              <div ref={railRef} className="chit-wiz-tpl-rail">
                {/* Custom Template Card */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTemplate('CUSTOM');
                  }}
                  className={`chit-wiz-tpl-card${activeTemplate === 'CUSTOM' ? ' chit-wiz-tpl-card--selected' : ''}`}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="badge badge-info" style={{ fontSize: '0.78rem' }}>Manual Setup</span>
                      <FieldHelpIcon
                        title="Custom From Scratch"
                        text="Choose this if your group has a special custom installment, pot amount, or schedule that does not match the preset cards."
                      />
                    </div>
                    <h3 className="chit-wiz-tpl-title">🛠️ {d.wizardCustomTemplate}</h3>
                    <p className="chit-wiz-tpl-summary" style={{ marginTop: '8px' }}>
                      Set up every rule yourself: pot value, member count, commission, and schedule from a blank slate.
                    </p>
                  </div>
                  <div className="chit-wiz-tpl-metrics">
                    <span>Full Manual Control</span>
                  </div>
                </button>

                {filteredTemplates.map((tmpl) => {
                  const selected = activeTemplate === tmpl.code;
                  const title = d.templates?.[tmpl.code]?.title || tmpl.defaultName;
                  const desc = d.templates?.[tmpl.code]?.summary || tmpl.defaultBadge;
                  const engineInfo = CHIT_ENGINE_CATALOG[tmpl.engineType];
                  return (
                    <div
                      key={tmpl.code}
                      role="button"
                      tabIndex={0}
                      onClick={() => applyTemplate(tmpl)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          applyTemplate(tmpl);
                        }
                      }}
                      className={`chit-wiz-tpl-card${selected ? ' chit-wiz-tpl-card--selected' : ''}`}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span
                            className={`badge ${tmpl.defaultChitType === 'registered' ? 'badge-info' : 'badge-pending'}`}
                            style={{ fontSize: '0.78rem' }}
                          >
                            {tmpl.defaultChitType === 'registered' ? d.act1982 : d.privateChit}
                          </span>
                          <FieldHelpIcon
                            title={title}
                            text={`${engineInfo?.description || desc} Example: Pot ${formatCurrency(tmpl.defaultChitValue, currencySymbol)}, ${tmpl.defaultTotalMembers} members paying ${formatCurrency(tmpl.defaultMonthlyContrib, currencySymbol)} each ${tmpl.defaultFrequency}.`}
                          />
                        </div>
                        <h3 className="chit-wiz-tpl-title">{title}</h3>
                        <p className="chit-wiz-tpl-summary" style={{ marginTop: '8px' }}>
                          {desc}
                        </p>
                      </div>

                      <div className="chit-wiz-tpl-metrics">
                        <span>{wizardUi.potLabel} {formatCurrency(tmpl.defaultChitValue, currencySymbol)}</span>
                        <span>·</span>
                        <span>{tmpl.defaultTotalMembers} {wizardUi.membersUnit}</span>
                        <span>·</span>
                        <span>{tmpl.defaultCommissionPct}% {wizardUi.feeLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Plain-English Selected Option Breakdown */}
              <div className="chit-wiz-section-card chit-wiz-section-card--padded">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)' }}>
                      {selectedTemplateObj
                        ? `Selected Plan: ${d.templates?.[selectedTemplateObj.code]?.title || selectedTemplateObj.defaultName}`
                        : activeTemplate === 'CUSTOM'
                          ? 'Selected Plan: Custom Setup'
                          : 'Click any plan card above to pre-fill your chit group'}
                    </div>
                    <div style={{ fontSize: '0.93rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                      {selectedTemplateObj
                        ? `${CHIT_ENGINE_CATALOG[selectedTemplateObj.engineType]?.description || selectedTemplateObj.defaultBadge} Pot: ${formatCurrency(chitValue, currencySymbol)} · Each member contributes ${formatCurrency(monthlyContrib, currencySymbol)} (${auctionFrequency}).`
                        : 'Once you select a card, Pot Money, Installment, Commission, and Schedule are automatically prepared so you finish in just a few clicks.'}
                    </div>
                  </div>
                  {(selectedTemplateObj || activeTemplate === 'CUSTOM') && (
                    <button type="button" className="btn btn-primary" style={{ fontSize: '0.96rem', padding: '10px 18px' }} onClick={goNext}>
                      {wizardUi.usePlanContinue}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: REGISTRATION TYPE + POOL MONEY + SCHEDULE */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="chit-wiz-section-card">
                <div className="chit-wiz-section-head">
                  <div>
                    <h3 className="chit-wiz-section-title">
                      {wizardUi.regSectionTitle}
                      <FieldHelpIcon
                        title="Private vs Government Registered Chit"
                        text="Pick Private/Mutual if you run an informal community or business circle. Pick Registered (Act 1982) only if this chit is formally licensed by your State Chit Registrar."
                      />
                    </h3>
                    <p className="chit-wiz-section-desc">
                      {wizardUi.regSectionDesc}
                    </p>
                  </div>
                </div>

                <div className="chit-wiz-section-inner">
                  <div className="chit-wiz-grid-2">
                    <button
                      type="button"
                      onClick={() => setChitType('unregistered')}
                      className={`chit-wiz-reg-card${chitType === 'unregistered' ? ' chit-wiz-reg-card--selected' : ''}`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '1.1rem', color: 'var(--text)' }}>🤝 {d.wizardUnregisteredTitle}</strong>
                        {chitType === 'unregistered' && <span className="badge badge-active">Selected</span>}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.48 }}>
                        Fast setup for friends, neighbourhood, or trader circles. No Registrar filing numbers needed.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setChitType('registered')}
                      className={`chit-wiz-reg-card${chitType === 'registered' ? ' chit-wiz-reg-card--selected' : ''}`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '1.1rem', color: 'var(--text)' }}>🏛️ {d.wizardRegisteredTitle}</strong>
                        {chitType === 'registered' && <span className="badge badge-active">Selected</span>}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.48 }}>
                        For licensed Chit Fund companies filing State Registrar Form I–VIII statutory books.
                      </p>
                    </button>
                  </div>

                  {chitType === 'registered' && (
                    <div className="chit-wiz-grid-3" style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">
                          Registration No.
                          <FieldHelpIcon title="Registration Number" text="Official PSO / Chit registration number issued by your State Chit Registrar." />
                        </label>
                        <input className="form-control" value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} placeholder="e.g. CHIT/TN/2026/001" />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">
                          State Jurisdiction
                          <FieldHelpIcon title="State Act Rules" text="Formats Form I–VIII statutory register exports (Tamil Nadu 1984 Rules, Delhi 2007 Rules, or Central 1982 Act)." />
                        </label>
                        <select className="form-control" value={stateCode} onChange={(e) => setStateCode(e.target.value as 'TN' | 'DL' | 'GENERIC')}>
                          <option value="TN">Tamil Nadu (TN Rules 1984)</option>
                          <option value="DL">Delhi (DL Rules 2007)</option>
                          <option value="GENERIC">Other States (Central Act 1982)</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">
                          Prior Sanction Order (PSO)
                          <FieldHelpIcon title="Prior Sanction Number" text="Previous sanction order number printed on subscriber agreements." />
                        </label>
                        <input className="form-control" value={priorSanctionNumber} onChange={(e) => setPriorSanctionNumber(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Registrar Office</label>
                        <input className="form-control" value={registrarOffice} onChange={(e) => setRegistrarOffice(e.target.value)} placeholder="e.g. Erode Sub-Registrar" />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Bylaw &amp; Certificate No.</label>
                        <input className="form-control" value={bylawNo} onChange={(e) => setBylawNo(e.target.value)} placeholder="Bylaw / Commencement no." />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Registered Office Address</label>
                        <input className="form-control" value={registeredOfficeAddress} onChange={(e) => setRegisteredOfficeAddress(e.target.value)} placeholder="Foreman / Branch Office Address" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="chit-wiz-section-card">
                <div className="chit-wiz-section-head">
                  <div>
                    <h3 className="chit-wiz-section-title">
                      {wizardUi.poolSectionTitle}
                      <FieldHelpIcon
                        title="How Pool & Installment Work"
                        text="Each cycle's base installment is automatically calculated as Total Pot Value divided by Number of Members."
                      />
                    </h3>
                    <p className="chit-wiz-section-desc">
                      {wizardUi.poolSectionDesc}
                    </p>
                  </div>
                </div>

                <div className="chit-wiz-section-inner">
                  <div className="chit-wiz-grid-3">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        {d.chitGroupName} *
                        <FieldHelpIcon title="Group Name" text="Name subscribers see on receipts and in the Live Room (for example: 'Diwali 1L Gold Chit')." />
                      </label>
                      <input className="form-control" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Gold 1L Monthly" required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        Total Chit Pot ({currencySymbol}) *
                        <FieldHelpIcon title="Gross Pot Value" text="The full prize pool amount collected every cycle before any auction discount or foreman fee." />
                      </label>
                      <input type="number" min="100" className="form-control" value={chitValue} onChange={(e) => handleChitValueChange(Number(e.target.value))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        Each Member Pays ({currencySymbol}) *
                        <FieldHelpIcon title="Base Installment" text="Maximum regular contribution per ticket before dividend discount lowers it." />
                      </label>
                      <input type="number" min="1" className="form-control" value={monthlyContrib} onChange={(e) => setMonthlyContrib(Math.max(1, Number(e.target.value) || 0))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        Total Members (Cycles) *
                        <FieldHelpIcon title="Members & Total Duration" text="1 member ticket = 1 cycle. A 20-member monthly chit automatically runs for 20 months." />
                      </label>
                      <input type="number" min="2" max="200" className="form-control" value={totalMembers} onChange={(e) => handleTotalMembersChange(Number(e.target.value))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        How Winner Is Picked
                        <FieldHelpIcon title="Winner Selection Method" text={AUCTION_TYPE_INFO[auctionType] || 'Choose between Live Room bidding, Offline entry, Secret bids, Lucky Draw lottery, or Fixed order.'} />
                      </label>
                      <select className="form-control" value={auctionType} onChange={(e) => setAuctionType(e.target.value as typeof auctionType)}>
                        <option value="open_live">Online Live Bidding Room</option>
                        <option value="open_manual">Offline / Manual Bid Entry</option>
                        <option value="sealed">Sealed Secret Bids</option>
                        <option value="lottery">Lucky Draw Lottery (No Bidding)</option>
                        <option value="fixed_rotation">Fixed Turn Order (No Bidding)</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        Collection Schedule ({tenureDisplay})
                        <FieldHelpIcon title="Repeat Schedule" text="How often members pay and a winner is chosen (Monthly, Every 2 weeks, Weekly, or Daily)." />
                      </label>
                      <select
                        className="form-control"
                        value={frequencyMode === 'custom' ? 'custom' : auctionFrequency}
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            setFrequencyMode('custom');
                          } else {
                            setFrequencyMode('preset');
                            setAuctionFrequency(e.target.value);
                          }
                        }}
                      >
                        <option value="monthly">Monthly (Once a month)</option>
                        <option value="fortnightly">Fortnightly (Every 14 days)</option>
                        <option value="weekly">Weekly (Once a week)</option>
                        <option value="daily">Daily Micro-Chit</option>
                        <option value="custom">Custom Days / Interval</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        Start Date
                        <FieldHelpIcon title="Cycle 1 Date" text="Date of the first cycle. All future due dates are scheduled from this date automatically." />
                      </label>
                      <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        Auction Time &amp; Room Mode
                        <FieldHelpIcon title="Online vs Offline Room" text="Online lets members log in and bid live with chat & 3-bell timer. Offline records manual results." />
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select className="form-control" value={auctionMode} onChange={(e) => setAuctionMode(e.target.value as 'online' | 'offline')}>
                          <option value="online">Online Live</option>
                          <option value="offline">In-Person / Offline</option>
                        </select>
                        <input type="time" className="form-control" value={auctionTime} onChange={(e) => setAuctionTime(e.target.value)} style={{ width: '135px' }} />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Chit Engine Formula</label>
                      <select className="form-control" value={selectedEngine} onChange={(e) => selectEngineType(e.target.value as ChitEngineType)}>
                        {availableTypes.map((code) => (
                          <option key={code} value={code}>
                            {CHIT_ENGINE_CATALOG[code].name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {previewDates.length > 0 && (
                    <div style={{ marginTop: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      First 3 Cycles Preview:{' '}
                      {previewDates.map((dt, i) => `Cycle ${i + 1}: ${dt.toLocaleDateString()}`).join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: RULES & MEMBERS (Split 2 Columns: Left = Rules, Right = Members & Foremen) */}
          {step === 3 && (
            <div className="chit-wiz-step3-split">
              <div className="chit-wiz-section-card">
                <div className="chit-wiz-section-head">
                  <div>
                    <h3 className="chit-wiz-section-title">
                      {wizardUi.rulesSectionTitle}
                      <FieldHelpIcon
                        title="Pre-Filled Rules"
                        text="These financial rules are pre-filled safely for your selected template. Hover or tap any 'i' button to understand what each rule does."
                      />
                    </h3>
                    <p className="chit-wiz-section-desc">
                      {wizardUi.rulesSectionDesc}
                    </p>
                  </div>
                </div>

                <div className="chit-wiz-section-inner">
                  <div className="chit-wiz-grid-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        Foreman Fee (%) *
                        <FieldHelpIcon title="Foreman Commission" text="Organizer fee percentage earned every cycle (standard 5% under the Chit Funds Act)." />
                      </label>
                      <input type="number" step="0.1" min="0" max="50" className="form-control" value={commissionPct} onChange={(e) => setCommissionPct(Number(e.target.value) || 0)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        Commission Calculated On
                        <FieldHelpIcon title="Commission Basis" text="Gross Chit Value (5% of full pot — Indian standard) vs Bid Discount only." />
                      </label>
                      <select className="form-control" value={commissionBasis} onChange={(e) => setCommissionBasis(e.target.value as 'BID_DISCOUNT' | 'CHIT_VALUE')}>
                        <option value="BID_DISCOUNT">Winning Bid Discount</option>
                        <option value="CHIT_VALUE">Total Pot Value (Standard 5%)</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        Who Gets Auction Dividend?
                        <FieldHelpIcon title="Dividend Recipients" text={DIVIDEND_POLICY_INFO[dividendPolicy] || 'Controls which members share the savings left after foreman commission.'} />
                      </label>
                      <select className="form-control" value={dividendPolicy} onChange={(e) => setDividendPolicy(e.target.value)}>
                        <option value="ALL_MEMBERS">Equal to All Members</option>
                        <option value="NON_PRIZED_ONLY">Non-Winners Only (Who Haven’t Won)</option>
                        <option value="NON_WINNERS_ONLY">Everyone Except Current Winner</option>
                        <option value="NONE">No Dividend (Fixed Pool)</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        How Dividend Is Paid
                        <FieldHelpIcon title="Dividend Distribution" text={DIVIDEND_DIST_INFO[dividendDistribution] || 'How members receive their share of the bid discount.'} />
                      </label>
                      <select className="form-control" value={dividendDistribution} onChange={(e) => setDividendDistribution(e.target.value)}>
                        <option value="ADJUST_NEXT_DUE">Reduce Next Installment (Standard)</option>
                        <option value="CASH_PAYOUT">Pay Out Separately</option>
                        <option value="ACCUMULATE">Save Until Chit Finishes</option>
                        <option value="DEFERRED_BONUS_POOL">Deferred Maturity Bonus</option>
                        <option value="NONE">None</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        Max Bid Discount Cap (%)
                        <FieldHelpIcon title="Bid Discount Ceiling" text="Protects pot value by capping how low members can bid (commonly 30% or 40% under Act 1982). Leave blank for uncapped." />
                      </label>
                      <input type="number" step="0.5" className="form-control" placeholder="e.g. 40 (optional)" value={maxDiscountPct} onChange={(e) => setMaxDiscountPct(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        Foreman Mode &amp; GST %
                        <FieldHelpIcon title="Compensation Mode & GST" text="How the organizer recovers fee, plus optional GST percentage on foreman fee." />
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
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
                            <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        <input type="number" step="0.1" className="form-control" placeholder="GST%" style={{ width: '90px' }} value={gstPct} onChange={(e) => setGstPct(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  {!['lottery', 'fixed_rotation'].includes(auctionType) && (
                    <div
                      style={{
                        marginTop: '14px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <label className="form-label" style={{ margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          Bid Multiplier &amp; Narrow Bid Rule ({currencySymbol})
                          <FieldHelpIcon
                            title="Bid Multiplier & Narrow Bids"
                            text="Sets the step size between bids. Pick ₹1 to allow narrow bids like 5,000 → 5,001 → 5,002, or pick ₹100 / ₹500 with Strict Multiples to block ₹1 tricks. You can also adjust this live mid-auction."
                          />
                        </label>
                        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: bidIncrement > 1 && strictBidMultiple ? 'var(--primary-dark)' : 'var(--text-secondary)' }}>
                          {bidIncrement <= 1
                            ? `Narrow ${currencySymbol}1 increments allowed`
                            : strictBidMultiple
                              ? `Multiples of ${currencySymbol}${bidIncrement.toLocaleString('en-IN')} enforced`
                              : `Min jump ${currencySymbol}${bidIncrement.toLocaleString('en-IN')}`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {[
                          { step: 1, label: `${currencySymbol}1 (Narrow)` },
                          { step: 10, label: `${currencySymbol}10` },
                          { step: 50, label: `${currencySymbol}50` },
                          { step: 100, label: `${currencySymbol}100` },
                          { step: 500, label: `${currencySymbol}500` },
                          { step: 1000, label: `${currencySymbol}1,000` },
                        ].map((preset) => (
                          <button
                            key={preset.step}
                            type="button"
                            onClick={() => {
                              setBidIncrement(preset.step);
                              setStrictBidMultiple(preset.step > 1);
                            }}
                            className={`btn btn-sm ${bidIncrement === preset.step ? 'btn-primary' : 'btn-secondary'}`}
                          >
                            {preset.label}
                          </button>
                        ))}
                        <input
                          type="number"
                          min={1}
                          step={1}
                          className="form-control"
                          style={{ width: '120px' }}
                          value={bidIncrement}
                          onChange={(e) => {
                            const val = Math.max(1, Math.round(Number(e.target.value) || 1));
                            setBidIncrement(val);
                            if (val <= 1) setStrictBidMultiple(false);
                          }}
                          aria-label="Custom Bid Multiplier"
                        />
                        {bidIncrement > 1 && (
                          <label className="checkbox-label" style={{ marginLeft: '4px' }}>
                            <input
                              type="checkbox"
                              checked={strictBidMultiple}
                              onChange={(e) => setStrictBidMultiple(e.target.checked)}
                            />
                            <span>Restrict Narrow Bids (Exact {currencySymbol}{bidIncrement} multiples)</span>
                          </label>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginTop: '14px', alignItems: 'center' }}>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={hasForemanTicket} onChange={(e) => setHasForemanTicket(e.target.checked)} />
                      <span>Foreman Takes Period 1 Pot</span>
                      <FieldHelpIcon title="Foreman First Pot" text="If checked, Cycle 1 goes directly to the organizer/foreman without auctioning." />
                    </label>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={tableCashEnabled} onChange={(e) => setTableCashEnabled(e.target.checked)} />
                      <span>💵 Table Cash Before Auction</span>
                      <FieldHelpIcon
                        title="Table Cash Before Auction"
                        text="When ON, Start Live becomes Collect Cash so members settle the period installment before bidding begins (with a Start Live Anyway override, and post-auction settlement for the winner)."
                      />
                    </label>
                    {!['lottery', 'fixed_rotation', 'sealed'].includes(auctionType) && (
                      <>
                        <label className="checkbox-label">
                          <input type="checkbox" checked={bellEnabled} onChange={(e) => setBellEnabled(e.target.checked)} />
                          <span>Enable 3-Bell Auction Timer</span>
                          <FieldHelpIcon title="3-Bell Countdown" text="Adds idle countdown bars (with 5-second final countdown) for Going Once, Going Twice, Sold inside the Live Room." />
                        </label>
                        {bellEnabled && (
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.86rem', fontWeight: 600 }}>
                            <span>Idle Bell Time:</span>
                            <select
                              className="form-control"
                              style={{ width: 'auto', minHeight: '34px', padding: '4px 10px', fontSize: '0.86rem' }}
                              value={bellIntervalSeconds}
                              onChange={(e) => setBellIntervalSeconds(Math.max(5, Number(e.target.value) || 60))}
                            >
                              <option value={10}>10 sec</option>
                              <option value={15}>15 sec</option>
                              <option value={20}>20 sec</option>
                              <option value={30}>30 sec</option>
                              <option value={45}>45 sec</option>
                              <option value={60}>60 sec (Standard)</option>
                            </select>
                          </label>
                        )}
                        <label className="checkbox-label">
                          <input type="checkbox" checked={bellAutoClose} onChange={(e) => setBellAutoClose(e.target.checked)} />
                          <span>Auto-Lock Winner on 3rd Bell</span>
                        </label>
                      </>
                    )}
                  </div>

                  <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                      {d.acceptedSecurityTypes}
                      <FieldHelpIcon
                        title="Winner Collateral Security"
                        text="Before releasing prize money, the winner must provide one of these securities to protect the group against future payment defaults."
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                      {CHIT_SECURITY_TYPES.filter((s) => s !== 'NONE').map((sec) => {
                        const checked = engineConfig.securityRequirements.acceptedTypes.includes(sec);
                        return (
                          <label key={sec} className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setEngineConfig((c) => {
                                  const list = c.securityRequirements.acceptedTypes.filter((x) => x !== sec);
                                  if (e.target.checked) list.push(sec);
                                  return {
                                    ...c,
                                    securityRequirements: {
                                      ...c.securityRequirements,
                                      acceptedTypes: list,
                                      requiredForPrized: list.length > 0,
                                    },
                                  };
                                })
                              }
                            />
                            <span>{sec.replace(/_/g, ' ')}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="chit-wiz-section-card">
                <div className="chit-wiz-section-head">
                  <div>
                    <h3 className="chit-wiz-section-title">
                      {wizardUi.membersSectionTitle} ({selectedMembers.length} / {totalMembers})
                      <FieldHelpIcon
                        title="Enroll Now or Later"
                        text="You can select customers now OR leave empty and use Quick-Add (Name + Phone) / Excel Import inside the group page later."
                      />
                    </h3>
                    <p className="chit-wiz-section-desc">
                      {wizardUi.membersSectionDesc}
                    </p>
                  </div>
                </div>

                <div className="chit-wiz-section-inner">
                  <InlineAddPicker
                    placeholder="Search customer by name or code, click + to add ticket..."
                    summaryText={`${selectedMembers.length} / ${totalMembers} tickets`}
                    allowMultiple
                    maxTotalReached={selectedMembers.length >= totalMembers}
                    onExceedMax={(cid) => {
                      const cust = customers.find((c) => c.id === cid);
                      setLimitWarningModal({
                        customerId: cid,
                        customerName: cust?.name || 'Customer',
                        nextTotal: selectedMembers.length + 1,
                      });
                    }}
                    items={customers.map((c) => ({
                      id: c.id,
                      label: c.name,
                      subLabel: c.customerCode,
                      count: selectedMembers.filter((id) => id === c.id).length,
                    }))}
                    onIncrement={(cid) => {
                      if (selectedMembers.length >= totalMembers) return;
                      setSelectedMembers((prev) => [...prev, cid]);
                    }}
                    onDecrement={(cid) =>
                      setSelectedMembers((prev) => {
                        const idx = prev.lastIndexOf(cid);
                        return idx === -1 ? prev : prev.filter((_, i) => i !== idx);
                      })
                    }
                    footerAction={{ label: 'New Customer', href: '/customers/new' }}
                  />

                  {limitWarningModal && (
                    <div style={{ marginTop: '10px', padding: '12px 14px', borderRadius: '10px', background: 'var(--warning-bg)', border: '1px solid var(--warning)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontSize: '0.92rem', color: 'var(--warning)', fontWeight: 700 }}>
                        ⚠️ Expanding beyond {totalMembers} members will update group size to {limitWarningModal.nextTotal} tickets.
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            const nextList = [...selectedMembers, limitWarningModal.customerId];
                            setSelectedMembers(nextList);
                            handleTotalMembersChange(nextList.length);
                            setLimitWarningModal(null);
                          }}
                        >
                          Yes, Expand &amp; Add
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLimitWarningModal(null)}>
                          {d.cancel}
                        </button>
                      </div>
                    </div>
                  )}

                  {groupedTickets.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                      {groupedTickets.map((item) => (
                        <div
                          key={item.customerId}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 12px',
                            borderRadius: '999px',
                            background: 'var(--primary-light)',
                            border: '1px solid var(--primary-border)',
                            fontSize: '0.88rem',
                            fontWeight: 700,
                            color: 'var(--primary-dark)',
                          }}
                        >
                          <span>{item.customer?.name || 'Member'}</span>
                          <span style={{ opacity: 0.8 }}>#{item.ticketNumbers.join(', #')}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedMembers((prev) => prev.filter((id) => id !== item.customerId))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800, color: 'inherit', fontSize: '1rem' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
                      Foremen / Co-Foremen Assigned ({selectedForemen.length})
                    </div>
                    <InlineAddPicker
                      compact
                      placeholder="Optional: search staff & assign foreman..."
                      summaryText={`${selectedForemen.length} foreman(s)`}
                      allowMultiple={false}
                      items={staffUsers.map((u) => ({
                        id: u.id,
                        label: u.name,
                        subLabel: `${u.customRole?.name || u.customRoleName || u.role} · ${u.phone}`,
                        count: selectedForemen.some((f) => f.userId === u.id) ? 1 : 0,
                      }))}
                      onIncrement={(uid) => {
                        if (selectedForemen.some((f) => f.userId === uid)) return;
                        setSelectedForemen((prev) => [
                          ...prev,
                          { userId: uid, roleLabel: prev.length === 0 ? 'Primary Foreman' : 'Co-Foreman', isPrimary: prev.length === 0 },
                        ]);
                      }}
                      onDecrement={(uid) => setSelectedForemen((prev) => prev.filter((f) => f.userId !== uid))}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: PLAIN-LANGUAGE REVIEW & CREATE */}
          {step === 4 && (
            <div className="chit-wiz-grid-2">
              <div className="chit-wiz-section-card">
                <div className="chit-wiz-section-head">
                  <h3 className="chit-wiz-section-title">{wizardUi.reviewGroupTitle}</h3>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStep(2)}>{wizardUi.editStepBtn}</button>
                </div>
                <div className="chit-wiz-section-inner" style={{ fontSize: '0.98rem', display: 'flex', flexDirection: 'column', gap: '9px', color: 'var(--text)' }}>
                  <div><strong>{d.chitGroupName}:</strong> {groupName || '—'}</div>
                  <div><strong>{d.status}:</strong> {chitType === 'registered' ? `${d.act1982} (${stateCode})` : d.privateChit}</div>
                  <div><strong>{d.engineTypeLabel}:</strong> {(d.engineNames as Record<string, string> | undefined)?.[selectedEngine] || CHIT_ENGINE_CATALOG[selectedEngine].name}</div>
                  <div><strong>{d.biddingMode}:</strong> {AUCTION_TYPE_INFO[auctionType]?.split(':')[0] || auctionType}</div>
                  <div><strong>{tenureDisplay}</strong></div>
                </div>
              </div>

              <div className="chit-wiz-section-card">
                <div className="chit-wiz-section-head">
                  <h3 className="chit-wiz-section-title">{wizardUi.reviewMoneyTitle}</h3>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStep(3)}>{wizardUi.editStepBtn}</button>
                </div>
                <div className="chit-wiz-section-inner" style={{ fontSize: '0.98rem', display: 'flex', flexDirection: 'column', gap: '9px', color: 'var(--text)' }}>
                  <div><strong>{d.chitValue}:</strong> {formatCurrency(chitValue, currencySymbol)}</div>
                  <div><strong>{d.baseInstalment}:</strong> {formatCurrency(monthlyContrib, currencySymbol)}</div>
                  <div><strong>{d.commission}:</strong> {commissionPct}% ({commissionBasis === 'CHIT_VALUE' ? d.chitValue : d.bidDiscount})</div>
                  {!['lottery', 'fixed_rotation'].includes(auctionType) && (
                    <div>
                      <strong>Bid Multiplier:</strong>{' '}
                      {bidIncrement <= 1
                        ? `${currencySymbol}1 (Narrow Bids Allowed)`
                        : `${currencySymbol}${bidIncrement.toLocaleString('en-IN')} (${strictBidMultiple ? 'Exact Multiples · Narrow Restricted' : 'Min Step'})`}
                    </div>
                  )}
                  <div>
                    <strong>Table Cash Before Auction:</strong>{' '}
                    {tableCashEnabled ? 'ON (Collect before live start · Winner settles after)' : 'OFF'}
                  </div>
                  {!['lottery', 'fixed_rotation', 'sealed'].includes(auctionType) && bellEnabled && (
                    <div>
                      <strong>3-Bell Idle Timer:</strong> Every {bellIntervalSeconds}s ({bellAutoClose ? 'Auto-lock on 3rd bell' : 'Manual close'})
                    </div>
                  )}
                  <div><strong>{d.dividendMode}:</strong> {dividendPolicy.replace(/_/g, ' ')}</div>
                  <div><strong>{d.members}:</strong> {selectedMembers.length} / {totalMembers} ({groupedTickets.length})</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="chit-wiz-footer">
          <span className="chit-wiz-saved-note">
            <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--success)' }}>cloud_done</span>
            {d.wizardDraftSavedNote}
          </span>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {step > 1 && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.95rem', padding: '9px 16px' }}
                onClick={() => {
                  setError('');
                  setStep((s) => Math.max(1, s - 1));
                }}
              >
                ← {d.wizardPrevStep}
              </button>
            )}
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.95rem', padding: '9px 16px' }} onClick={handleSaveAndExit}>
              💾 {d.wizardSaveAndExit}
            </button>
            {step < 4 ? (
              <button type="button" className="btn btn-primary" style={{ fontSize: '0.98rem', padding: '10px 20px' }} onClick={goNext}>
                {d.wizardNextStep} →
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: '1rem', padding: '10px 22px' }}
                disabled={loading}
                onClick={handleSubmitCreate}
              >
                {loading ? d.creating : `✓ ${d.createGroup}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
