'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  activateChitGroup,
  addChitMemberTicketsAction,
  autoAssignChitTicketNumbers,
  cancelChitGroupAction,
  deleteChitGroupAction,
  drawAuctionWinner,
  markPaymentMissed,
  recordChitPayment,
  updateChitGroupForemenAction,
  updateChitMemberDetails,
  markChitAgreementSigned,
  recordAscaPoolTransaction,
  verifyChitAgreement,
} from '../actions';
import CashDenominationCounter from '@/components/chits/CashDenominationCounter';
import AuctionScheduleModal from '@/components/chits/AuctionScheduleModal';
import QuickAddAndBulkImportPanel from '@/components/chits/QuickAddAndBulkImportPanel';
import type { CashDenominationMode } from '@/lib/chits/denominations';
import {
  STATUTORY_REGISTER_TYPES,
  normalizeStateCode,
  resolveStatutoryTemplate,
  type StatutoryStateCode,
} from '@/lib/chits/statutory/templates';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PDF_LANGUAGES, resolvePdfLang } from '@/lib/reports/pdfLanguages';
import Link from '@/components/layout/DashboardLink';
import { useRegisterBreadcrumbLabel } from '@/components/layout/BreadcrumbLabelContext';
import { parseFrequency, periodWindow } from '@/lib/chits/frequency';
import PaymentIntentsQueue from '@/components/chits/PaymentIntentsQueue';
import MemberDividendLedgerPanel from '@/components/chits/MemberDividendLedgerPanel';
import InlineAddPicker from '@/components/chits/InlineAddPicker';
import FieldHelpIcon from '@/components/chits/FieldHelpIcon';
import {
  explainAuctionType,
  explainCommissionMode,
  explainDividendDistribution,
  explainDividendPolicy,
  explainFrequency,
  explainLateFeeType,
  explainPayoutAsset,
  explainRegulatoryTier,
  explainScaleTier,
  explainTieBreak,
  getChitConfigMeta,
  getChitDetailUi,
} from '@/lib/chits/chitConfigExplainI18n';
import { formatChitTenure } from '@/lib/chits/formTooltipsI18n';
import { computeSubscriptionBalances } from '@/lib/chits/engineCalculator';
import {
  CHIT_ENGINE_CATALOG,
  isBiddingEnabledForPeriod,
  parseChitEngineConfig,
  resolveEngineTypeFromGroup,
} from '@/lib/chits/engineTypes';
import type { ChitGroupDividendLedger } from '@/lib/chits/memberDividendLedger';
import {
  ChitHeroBarsBg,
  ChitKpiSparkline,
  ChitPotHeroIllustration,
} from '@/components/chits/ChitHubIllustrations';
import './chits-detail.css';

interface ChitGroupDetailClientProps {
  group: any;
  dividendLedger?: ChitGroupDividendLedger | null;
  poolTransactions?: any[];
  staffUsers?: Array<{ id: string; name: string; phone: string; role: string; customRoleName?: string | null; customRole?: { name: string } | null }>;
  customers?: Array<{ id: string; name: string; customerCode: string }>;
  cashDenominationMode?: CashDenominationMode;
  canExportStatutoryRegisters?: boolean;
  currencySymbol: string;
  lang?: string;
  dict: any;
}

export default function ChitGroupDetailClient({
  group,
  dividendLedger = null,
  poolTransactions = [],
  staffUsers = [],
  customers = [],
  cashDenominationMode = 'OPTIONAL',
  canExportStatutoryRegisters = false,
  currencySymbol,
  lang,
  dict,
}: ChitGroupDetailClientProps) {
  const d = dict.chits;
  const ui = getChitDetailUi(lang);
  const cfgMeta = getChitConfigMeta(lang);
  const router = useRouter();
  useRegisterBreadcrumbLabel(group.groupCode ?? group.id, group.name);
  const [pdfLang, setPdfLang] = useState<string>(() => resolvePdfLang(lang));
  const [membersTableOpen, setMembersTableOpen] = useState<boolean>(true);
  const [paymentModal, setPaymentModal] = useState<any>(null);
  const [memberModal, setMemberModal] = useState<any>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payDenomCounts, setPayDenomCounts] = useState<Record<number, number>>({});
  const [payDenomJson, setPayDenomJson] = useState<string | null>(null);
  const [payDenomMatched, setPayDenomMatched] = useState(true);
  const paymentIdempotencyRef = useRef<string>('');
  const [planLimitModal, setPlanLimitModal] = useState<string | null>(null);
  const [confirmGroupAction, setConfirmGroupAction] = useState<'cancel' | 'delete' | null>(null);
  const [groupActionError, setGroupActionError] = useState('');
  const [statState, setStatState] = useState<StatutoryStateCode>(() => normalizeStateCode(group.stateCode));
  const engineType = resolveEngineTypeFromGroup(group);
  const engineCfg = parseChitEngineConfig(group.engineConfig, engineType);
  const engineCatalog = CHIT_ENGINE_CATALOG[engineType];
  const isGoldWeight = engineType === 'GOLD_WEIGHT_ACCUMULATION';
  const [payGoldRate, setPayGoldRate] = useState<number>(
    engineCfg.goldScheme?.defaultGoldRatePerGram ?? 0,
  );
  const [lastReceipt, setLastReceipt] = useState('');
  const [rescheduleModal, setRescheduleModal] = useState<any>(null);
  const [foremenModal, setForemenModal] = useState<boolean>(false);
  const [foremenDraft, setForemenDraft] = useState<Array<{ userId: string; roleLabel: string; isPrimary: boolean }>>(() =>
    (group.foremen ?? []).map((f: any) => ({
      userId: f.userId,
      roleLabel: f.roleLabel || 'Foreman',
      isPrimary: Boolean(f.isPrimary),
    })),
  );
  const [pickForemanRole, setPickForemanRole] = useState('Co-Foreman');
  const [detailLimitWarning, setDetailLimitWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [detailTab, setDetailTab] = useState<
    'overview' | 'auctions' | 'ledger' | 'members' | 'payments' | 'registers'
  >('overview');
  const [subTab, setSubTab] = useState<'current' | 'overdue' | 'all'>('current');
  const periodNumbers = Array.from(
    new Set<number>(
      group.members.flatMap((m: any) =>
        (m.subscriptions ?? []).map((s: any) => Number(s.periodNumber)),
      ),
    ),
  ).sort((a, b) => a - b);
  const defaultPeriod = (() => {
    for (const p of periodNumbers) {
      const hasUnpaid = group.members.some((m: any) =>
        (m.subscriptions ?? []).some(
          (s: any) => Number(s.periodNumber) === p && s.status !== 'paid',
        ),
      );
      if (hasUnpaid) return p;
    }
    return periodNumbers[0] ?? 'all';
  })();
  const [selectedPeriod, setSelectedPeriod] = useState<number | 'all'>(defaultPeriod);

  const isDrawType = !engineCatalog.supportsBidding || ['lottery', 'fixed_rotation'].includes(group.auctionType);
  const completedAuctions = group.auctions.filter((a: any) => ['confirmed', 'paid', 'completed'].includes(a.status));
  const membersMissingTicketNo = group.members.filter((m: any) => !m.ticketNo).length;

  const ledgerRowByMemberPeriod = new Map<string, any>();
  if (dividendLedger) {
    for (const ms of dividendLedger.memberStatements) {
      for (const pr of ms.periods) {
        ledgerRowByMemberPeriod.set(`${ms.memberId}:${pr.periodNumber}`, pr);
      }
    }
  }

  const subscriptionBreakdown = (s: any) => {
    const serverRow = ledgerRowByMemberPeriod.get(`${s.memberId}:${s.periodNumber}`);
    if (serverRow) {
      return {
        baseContribution: serverRow.baseDue,
        dividendAdjustment: serverRow.dividendEarned,
        deferredDividend: serverRow.deferredDividend,
        premium: serverRow.premiumAmount,
        interest: serverRow.interestAmount,
        penalty: serverRow.penaltyAmount,
        netDue: serverRow.netDue,
        paid: serverRow.paidAmount,
        outstanding: serverRow.outstanding,
        goldGramsCredited: serverRow.goldGramsCredited,
      };
    }
    const bal = computeSubscriptionBalances(s, group.dividendDistribution);
    return {
      baseContribution: bal.baseDueAmount,
      dividendAdjustment: bal.dividendAmount,
      deferredDividend: bal.deferredDividendAmount,
      premium: bal.premiumAmount,
      interest: bal.interestAmount,
      penalty: bal.penaltyAmount,
      netDue: bal.netDue,
      paid: bal.paidAmount,
      outstanding: bal.outstanding,
      goldGramsCredited: Number(s.goldGramsCredited || 0),
    };
  };

  const run = async (label: string, fn: () => Promise<any>) => {
    setBusy(label);
    setError('');
    try {
      const res = await fn();
      if (res && typeof res === 'object' && 'ok' in res && res.ok === false) {
        if (res.code === 'CHIT_PLAN_LIMIT_REACHED') {
          setPlanLimitModal(res.error || 'Free plan allows 1 active running chit group.');
        } else {
          setError(res.error || 'Action failed');
        }
        setBusy('');
        return;
      }
      router.refresh();
    } catch (e: any) {
      setError(e?.message || 'Unexpected error occurred');
    }
    setBusy('');
  };

  const handleRecordPayment = async () => {
    if (!paymentModal) return;
    setLoading(true);
    setError('');
    if (!paymentIdempotencyRef.current) {
      paymentIdempotencyRef.current =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `chit-pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    try {
      const result = await recordChitPayment(
        paymentModal.memberId,
        paymentModal.periodNumber,
        payAmount,
        payMode,
        payRef || null,
        payNotes || null,
        isGoldWeight ? payGoldRate : null,
        payMode === 'cash' ? payDenomJson : null,
        paymentIdempotencyRef.current,
      );
      paymentIdempotencyRef.current = '';
      setPayDenomCounts({});
      setPayDenomJson(null);
      setLastReceipt(result?.receiptNo || '');
      setPaymentModal(null);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleSaveMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!memberModal) return;
    setLoading(true);
    setError('');
    try {
      await updateChitMemberDetails(memberModal.id, new FormData(e.currentTarget));
      setMemberModal(null);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const agreementBadge = (status: string) => {
    const cls = status === 'verified' ? 'success' : status === 'signed' ? 'info' : status === 'rejected' ? 'danger' : 'warning';
    return <span className={`badge badge-${cls}`}>{ui.agreementLabels[status] || status}</span>;
  };

  const localizedEngineName = d.engineNames?.[engineType] || engineCatalog.name;
  const localizedEngineDesc = d.engineDescs?.[engineType] || engineCatalog.description;
  const unverifiedMembersCount = (group.members ?? []).filter((m: any) => m.agreementStatus !== 'verified').length;
  const allMembersVerifiedAndFull =
    (group.members ?? []).length > 0 &&
    (group.members ?? []).length >= group.totalMembers &&
    unverifiedMembersCount === 0;
  const hasPrimaryLedgerTable = Boolean(dividendLedger && dividendLedger.memberStatements.length > 0);
  const tenureDisplay = formatChitTenure(group.totalMembers, parseFrequency(group), lang);

  const wonAuctions = (group.auctions ?? []).filter((a: any) => Boolean(a.winnerMemberId || a.winnerMember));
  const nextPendingAuction = (group.auctions ?? []).find((a: any) => ['pending', 'notice_sent', 'in_progress'].includes(a.status));
  const totalCollectedAmt = (group.members ?? []).reduce(
    (sum: number, m: any) =>
      sum + (m.subscriptions ?? []).reduce((s2: number, sub: any) => s2 + Number(sub.paidAmount || 0), 0),
    0,
  );
  const totalPrizeDisbursedAmt = wonAuctions.reduce((sum: number, a: any) => sum + Number(a.prizeAmount || 0), 0);
  const totalDividendsAmt = wonAuctions.reduce((sum: number, a: any) => sum + Number(a.dividend || 0), 0);
  const totalCommissionAmt = wonAuctions.reduce((sum: number, a: any) => sum + Number(a.commissionAmount || 0), 0);
  const verifiedAgreementsCount = (group.members ?? []).filter((m: any) => m.agreementStatus === 'verified').length;
  const pendingPayoutsCount = wonAuctions.filter((a: any) => a.payoutStatus !== 'paid').length;

  const allAuctions = group.auctions ?? [];
  const defaultAuction =
    allAuctions.find((a: any) => ['open', 'extended'].includes(a.roomStatus)) ??
    allAuctions.find((a: any) => ['in_progress', 'notice_sent', 'pending'].includes(a.status)) ??
    allAuctions[allAuctions.length - 1] ??
    null;
  const roomHref = defaultAuction
    ? `/chits/${group.id}/auctions/${defaultAuction.id}`
    : `/chits/${group.id}/room`;
  const memberPct = group.totalMembers > 0 ? Math.min(100, Math.round((group.members.length / group.totalMembers) * 100)) : 0;
  const cyclePct = group.totalMembers > 0 ? Math.min(100, Math.round((completedAuctions.length / group.totalMembers) * 100)) : 0;

  return (
    <div className="chit-detail-hub">
      {error && <div className="alert alert-danger" style={{ padding: '10px 14px', background: '#fff0f0', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', color: 'var(--danger)' }}>{error}</div>}
      {lastReceipt && (
        <div style={{ padding: '10px 14px', background: '#f0fff4', border: '1px solid var(--success)', borderRadius: 'var(--radius)', color: 'var(--success)' }}>
          Payment recorded — receipt {lastReceipt}
        </div>
      )}

      {/* Unified Theme-Harmonized Hero Header */}
      <section className="chit-detail-hero">
        <ChitHeroBarsBg />
        <div className="chit-detail-hero-left">
          <ChitPotHeroIllustration />
          <div style={{ minWidth: 0 }}>
            <Link href="/chits" className="chit-detail-back">
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>arrow_back</span>
              {d.detailBackToGroups}
            </Link>
            <h2 className="chit-detail-title">{group.name}</h2>
            <div className="chit-detail-pills">
              <span className="chit-detail-pill">
                <span className="chits-hero-dot chits-hero-dot--active" style={{ width: '7px', height: '7px', borderRadius: '50%', background: group.status === 'active' ? '#4ade80' : '#fde047', display: 'inline-block' }} />
                {ui.statusLabels[group.status] || group.status}
              </span>
              <span className="chit-detail-pill">{group.groupCode ?? group.id}</span>
              <span className="chit-detail-pill">{localizedEngineName}</span>
              <span className="chit-detail-pill">{tenureDisplay}</span>
              <span className="chit-detail-pill">{group.chitType === 'registered' ? d.act1982 : d.privateChit}</span>
            </div>
          </div>
        </div>

        <div className="chit-detail-actions">
          <Link href={roomHref} className="chit-detail-btn-primary">
            <span className="material-icons-outlined" style={{ fontSize: '17px' }}>forum</span>
            {d.detailLiveRoomBtn}
          </Link>
          <Link href={`/chits/${group.id}/edit`} className="chit-detail-btn-glass">
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>edit</span>
            {ui.editGroupBtn}
          </Link>
          {group.status === 'draft' && membersMissingTicketNo > 0 && (
            <button
              className="chit-detail-btn-glass"
              disabled={busy === 'auto-assign'}
              onClick={() => run('auto-assign', () => autoAssignChitTicketNumbers(group.id))}
            >
              {busy === 'auto-assign' ? ui.assigningBtn : `${ui.autoAssignBtn} (${membersMissingTicketNo})`}
            </button>
          )}
          {group.status === 'draft' && (
            <button
              className="chit-detail-btn-glass"
              style={{ background: 'rgba(255,255,255,0.24)', borderColor: '#ffffff' }}
              disabled={busy === 'activate'}
              onClick={() => run('activate', () => activateChitGroup(group.id))}
            >
              {busy === 'activate' ? ui.activatingBtn : ui.activateGroupBtn}
            </button>
          )}
          {['draft', 'active'].includes(group.status) && (
            <button
              type="button"
              className="chit-detail-btn-glass"
              disabled={busy === 'cancel'}
              onClick={() => {
                setGroupActionError('');
                setConfirmGroupAction('cancel');
              }}
            >
              {busy === 'cancel' ? ui.cancellingBtn : ui.cancelGroupBtn}
            </button>
          )}
          <button
            type="button"
            className="chit-detail-btn-danger-glass"
            disabled={busy === 'delete'}
            onClick={() => {
              setGroupActionError('');
              setConfirmGroupAction('delete');
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>delete_outline</span>
            {d.deleteGroupMenuBtn || 'Delete Group'}
          </button>
        </div>
      </section>

      {/* Elevated 4-Card Sparkline KPI Strip */}
      <section className="chit-detail-kpi-grid">
        <div className="chit-detail-kpi-card">
          <div className="kpi-icon green" style={{ position: 'relative', zIndex: 1 }}><span className="material-icons-outlined">savings</span></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="kpi-value">{formatCurrency(Number(group.chitValue), currencySymbol)}</div>
            <div className="kpi-label">{d.chitValue}</div>
          </div>
          <ChitKpiSparkline color="#16A34A" variant={0} />
        </div>
        <div className="chit-detail-kpi-card">
          <div className="kpi-icon blue" style={{ position: 'relative', zIndex: 1 }}><span className="material-icons-outlined">payments</span></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="kpi-value">{formatCurrency(Number(group.monthlyContrib), currencySymbol)}</div>
            <div className="kpi-label">{ui.installmentWord} ({explainFrequency(engineCfg.collectionFrequency || group.auctionFrequency, lang)})</div>
          </div>
          <ChitKpiSparkline color="#0EA5E9" variant={1} />
        </div>
        <div className="chit-detail-kpi-card">
          <div className="kpi-icon orange" style={{ position: 'relative', zIndex: 1 }}><span className="material-icons-outlined">groups</span></div>
          <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0 }}>
            <div className="kpi-value">{group.members.length}/{group.totalMembers}</div>
            <div className="kpi-label">{d.membersEnrolled}</div>
            <div style={{ height: '5px', background: 'var(--border)', borderRadius: '999px', marginTop: '6px', overflow: 'hidden', maxWidth: '140px' }}>
              <div style={{ width: `${memberPct}%`, height: '100%', background: 'var(--primary)', borderRadius: '999px' }} />
            </div>
          </div>
          <ChitKpiSparkline color="#8B5CF6" variant={2} />
        </div>
        <div className="chit-detail-kpi-card">
          <div className="kpi-icon purple" style={{ position: 'relative', zIndex: 1 }}><span className="material-icons-outlined">gavel</span></div>
          <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0 }}>
            <div className="kpi-value">{completedAuctions.length}/{group.totalMembers}</div>
            <div className="kpi-label">{d.auctionsCompleted}</div>
            <div style={{ height: '5px', background: 'var(--border)', borderRadius: '999px', marginTop: '6px', overflow: 'hidden', maxWidth: '140px' }}>
              <div style={{ width: `${cyclePct}%`, height: '100%', background: 'var(--success)', borderRadius: '999px' }} />
            </div>
          </div>
          <ChitKpiSparkline color="#F59E0B" variant={3} />
        </div>
      </section>

      {/* Tab Navigation Under KPI Info Boxes */}
      <nav className="chit-detail-tabs" aria-label="Chit group sections" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={detailTab === 'overview'}
          onClick={() => setDetailTab('overview')}
          className={`chit-detail-tab${detailTab === 'overview' ? ' chit-detail-tab--active' : ''}`}
        >
          <span className="material-icons-outlined" style={{ fontSize: '17px' }}>tune</span>
          <span>{d.tabOverview || 'Overview & Rules'}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={detailTab === 'auctions'}
          onClick={() => setDetailTab('auctions')}
          className={`chit-detail-tab${detailTab === 'auctions' ? ' chit-detail-tab--active' : ''}`}
        >
          <span className="material-icons-outlined" style={{ fontSize: '17px' }}>gavel</span>
          <span>{d.tabAuctions || 'Auctions'}</span>
          <span className="chit-detail-tab-badge">{group.auctions.length}</span>
        </button>

        {(dividendLedger || engineType === 'ASCA_SHG_REVOLVING') && (
          <button
            type="button"
            role="tab"
            aria-selected={detailTab === 'ledger'}
            onClick={() => setDetailTab('ledger')}
            className={`chit-detail-tab${detailTab === 'ledger' ? ' chit-detail-tab--active' : ''}`}
          >
            <span className="material-icons-outlined" style={{ fontSize: '17px' }}>account_balance</span>
            <span>{d.tabLedger || 'Dividend Ledger'}</span>
          </button>
        )}

        <button
          type="button"
          role="tab"
          aria-selected={detailTab === 'members'}
          onClick={() => setDetailTab('members')}
          className={`chit-detail-tab${detailTab === 'members' ? ' chit-detail-tab--active' : ''}`}
        >
          <span className="material-icons-outlined" style={{ fontSize: '17px' }}>groups</span>
          <span>{d.tabMembers || 'Members'}</span>
          <span className="chit-detail-tab-badge">
            {group.members.length}/{group.totalMembers}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={detailTab === 'payments'}
          onClick={() => setDetailTab('payments')}
          className={`chit-detail-tab${detailTab === 'payments' ? ' chit-detail-tab--active' : ''}`}
        >
          <span className="material-icons-outlined" style={{ fontSize: '17px' }}>payments</span>
          <span>{d.tabPayments || 'Payments & Proofs'}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={detailTab === 'registers'}
          onClick={() => setDetailTab('registers')}
          className={`chit-detail-tab${detailTab === 'registers' ? ' chit-detail-tab--active' : ''}`}
        >
          <span className="material-icons-outlined" style={{ fontSize: '17px' }}>description</span>
          <span>{d.tabRegisters || 'Statutory Registers'}</span>
        </button>
      </nav>

      {/* Tab 1: Overview & Rules */}
      {detailTab === 'overview' && (
      <div className="grid-60-40">
        <div className="chit-detail-card">
          <div className="chit-detail-card-head">
            <div>
              <h3 style={{ margin: 0 }}>⚙️ {ui.configSectionTitle}</h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {ui.configSectionSub}
              </p>
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <tbody>
                <tr>
                  <td style={{ minWidth: '175px', fontWeight: 700, verticalAlign: 'top' }}>
                    {cfgMeta.engineLabel}
                    <FieldHelpIcon title={cfgMeta.engineHelpTitle} text={cfgMeta.engineHelp} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                      {localizedEngineName} · {group.chitType === 'registered' ? d.act1982 : d.privateChit}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.45 }}>
                      {explainAuctionType(group.auctionType, lang)} — {localizedEngineDesc}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, verticalAlign: 'top' }}>
                    {cfgMeta.scaleLabel}
                    <FieldHelpIcon title={cfgMeta.scaleHelpTitle} text={cfgMeta.scaleHelp} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {explainRegulatoryTier(engineCfg.regulatoryTier, lang)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.45 }}>
                      {explainScaleTier(engineCfg.scaleTier, lang)} · {explainPayoutAsset(engineCfg.payoutAssetType, lang)} · {explainFrequency(engineCfg.collectionFrequency, lang)} ({tenureDisplay})
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, verticalAlign: 'top' }}>
                    {cfgMeta.commissionLabel}
                    <FieldHelpIcon title={cfgMeta.commissionHelpTitle} text={cfgMeta.commissionHelp} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {Number(group.commissionPct)}%{' '}
                      {group.commissionBasis === 'CHIT_VALUE' ? ui.ofGrossPot : ui.ofBidDiscount}
                      {group.gstPct ? ` + GST ${Number(group.gstPct)}%` : ''}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                      {explainCommissionMode(engineCfg.foremanCompensation.mode, lang)}
                      {engineCfg.foremanCompensation.flatFeeAmount > 0
                        ? ` (${formatCurrency(engineCfg.foremanCompensation.flatFeeAmount, currencySymbol)} ${ui.flatFeeSuffix})`
                        : ''}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, verticalAlign: 'top' }}>
                    {cfgMeta.foremenLabel}
                    <FieldHelpIcon title={cfgMeta.foremenHelpTitle} text={cfgMeta.foremenHelp} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {(group.foremen ?? []).length > 0 ? (
                        (group.foremen ?? []).map((f: any) => (
                          <span key={f.id} className="badge badge-info" style={{ fontSize: '.74rem' }}>
                            {f.user?.name || 'Foreman'} · {f.roleLabel}{f.isPrimary ? ' ★' : ''}
                          </span>
                        ))
                      ) : group.foremanName ? (
                        <span>{group.foremanName}</span>
                      ) : (
                        <span style={{ color: 'var(--text-light)' }}>{ui.notAssigned}</span>
                      )}
                      {staffUsers.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 8px', fontSize: '.74rem' }}
                          onClick={() => {
                            setForemenDraft(
                              (group.foremen ?? []).map((f: any) => ({
                                userId: f.userId,
                                roleLabel: f.roleLabel || 'Foreman',
                                isPrimary: Boolean(f.isPrimary),
                              })),
                            );
                            setForemenModal(true);
                          }}
                        >
                          {ui.manageForemenBtn}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, verticalAlign: 'top' }}>
                    {cfgMeta.dividendLabel}
                    <FieldHelpIcon title={cfgMeta.dividendHelpTitle} text={cfgMeta.dividendHelp} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {explainDividendPolicy(group.dividendPolicy, lang)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                      {explainDividendDistribution(group.dividendDistribution, lang)}
                      {group.dividendRounding ? ` (${currencySymbol}${group.dividendRounding} rounding)` : ''}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, verticalAlign: 'top' }}>
                    {cfgMeta.timeLabel}
                    <FieldHelpIcon title={cfgMeta.timeHelpTitle} text={cfgMeta.timeHelp} />
                  </td>
                  <td>{group.auctionTime || '—'}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, verticalAlign: 'top' }}>
                    {cfgMeta.winnerIntLabel}
                    <FieldHelpIcon title={cfgMeta.winnerIntHelpTitle} text={cfgMeta.winnerIntHelp} />
                  </td>
                  <td>
                    {group.winnerInterestType === 'NONE'
                      ? explainLateFeeType('NONE', lang)
                      : `${group.winnerInterestValue ?? 0}% (${group.winnerInterestPeriods ?? 0})`}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, verticalAlign: 'top' }}>
                    {cfgMeta.defaultSecLabel}
                    <FieldHelpIcon title={cfgMeta.defaultSecHelpTitle} text={cfgMeta.defaultSecHelp} />
                  </td>
                  <td>
                    <div style={{ color: 'var(--text)' }}>
                      {engineCfg.defaultRules.forfeitDividendOnLate ? ui.forfeitedOnLate : ui.keptOnLate}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                      {explainLateFeeType(engineCfg.defaultRules.lateFeeType, lang)}
                      {engineCfg.defaultRules.lateFeeValue > 0 ? ` (${engineCfg.defaultRules.lateFeeValue})` : ''} · {ui.substCutoffLabel} {engineCfg.defaultRules.substitutionCutoffPct}%
                    </div>
                  </td>
                </tr>
                {!isDrawType && (
                  <tr>
                    <td style={{ fontWeight: 700, verticalAlign: 'top' }}>
                      {cfgMeta.bidRulesLabel}
                      <FieldHelpIcon title={cfgMeta.bidRulesHelpTitle} text={cfgMeta.bidRulesHelp} />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                        {group.minDiscountPct
                          ? `${Number(group.minDiscountPct)}%`
                          : `${Number(group.commissionPct)}% (${ui.commissionFloor})`}{' '}
                        {ui.upToPct}{' '}
                        {engineCfg.discountRules.uncapped
                          ? ui.uncapped
                          : group.maxDiscountPct
                            ? `${Number(group.maxDiscountPct)}%`
                            : ui.noCap}
                        {group.bidIncrement ? ` · +${formatCurrency(Number(group.bidIncrement), currencySymbol)}` : ''}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                        {explainTieBreak(group.tieBreakRule, lang)}
                      </div>
                    </td>
                  </tr>
                )}
                {isDrawType && (
                  <tr>
                    <td style={{ fontWeight: 700 }}>{cfgMeta.fixedDiscLabel}</td>
                    <td>{group.fixedDiscountPct ? `${Number(group.fixedDiscountPct)}%` : ui.fixedDiscountNone}</td>
                  </tr>
                )}
                {group.hasForemanTicket && (
                  <tr>
                    <td style={{ fontWeight: 700 }}>{cfgMeta.foremanTicketLabel}</td>
                    <td>{ui.foremanFirstPotExplain}</td>
                  </tr>
                )}
                {(group.registrationNo || group.priorSanctionNumber || group.bylawNo) && (
                  <tr>
                    <td style={{ fontWeight: 700 }}>{cfgMeta.bylawLabel}</td>
                    <td>
                      {[
                        group.registrationNo ? `Reg: ${group.registrationNo}` : null,
                        group.priorSanctionNumber ? `PSO: ${group.priorSanctionNumber}` : null,
                        group.bylawNo ? `Bylaw: ${group.bylawNo}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="chit-detail-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="chit-detail-card-head">
            <h3>🏆 {ui.winnerSectionTitle}</h3>
            <span className="badge badge-info" style={{ fontSize: '.72rem' }}>
              {wonAuctions.length} / {group.durationMonths} {ui.wonSuffix}
            </span>
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Pool Financial Insights */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '9px', padding: '8px 10px' }}>
              <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{ui.totalCollected}</div>
              <div style={{ fontSize: '.95rem', fontWeight: 800, color: 'var(--text)', marginTop: '2px' }}>
                {formatCurrency(totalCollectedAmt, currencySymbol)}
              </div>
            </div>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '9px', padding: '8px 10px' }}>
              <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{ui.prizeDisbursed}</div>
              <div style={{ fontSize: '.95rem', fontWeight: 800, color: 'var(--primary-dark)', marginTop: '2px' }}>
                {formatCurrency(totalPrizeDisbursedAmt, currencySymbol)}
              </div>
            </div>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '9px', padding: '8px 10px' }}>
              <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{ui.dividendsShared}</div>
              <div style={{ fontSize: '.92rem', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>
                {formatCurrency(totalDividendsAmt, currencySymbol)}
              </div>
            </div>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '9px', padding: '8px 10px' }}>
              <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{ui.foremanCommission}</div>
              <div style={{ fontSize: '.92rem', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>
                {formatCurrency(totalCommissionAmt, currencySymbol)}
              </div>
            </div>
          </div>

          {/* Operational Readiness Strip */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '.75rem', padding: '8px 10px', borderRadius: '9px', background: 'var(--primary-light)', color: 'var(--primary-dark)', fontWeight: 600 }}>
            <span>{ui.agreementsCountLabel}: {verifiedAgreementsCount}/{group.members.length}</span>
            <span>·</span>
            <span>{ui.pendingPayoutsLabel}: {pendingPayoutsCount}</span>
            {nextPendingAuction && (
              <>
                <span>·</span>
                <span>{ui.nextLabel}: {d.periodLabel} {nextPendingAuction.periodNumber} ({formatDate(nextPendingAuction.scheduledAt ?? nextPendingAuction.auctionDate)})</span>
              </>
            )}
          </div>

          {/* Winner History Table / Empty State */}
          {wonAuctions.length === 0 ? (
            <div style={{ padding: '18px 14px', borderRadius: '10px', background: 'var(--bg)', border: '1px dashed var(--border)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '.84rem', lineHeight: 1.5 }}>
              {ui.noWinnersYet}
            </div>
          ) : (
            <div className="table-wrapper" style={{ maxHeight: '240px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{d.period}</th>
                    <th>{d.winner}</th>
                    <th>{d.prize}</th>
                    <th>{d.dividend}</th>
                    <th>{ui.payoutCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {wonAuctions.map((a: any) => (
                    <tr key={a.id}>
                      <td><strong>P{a.periodNumber}</strong></td>
                      <td>
                        <Link href={`/chits/${group.id}/auctions/${a.id}`} style={{ fontWeight: 600 }}>
                          {a.winnerMember?.customer?.name || d.winner}
                        </Link>
                        {a.winnerMember?.ticketNo && (
                          <span style={{ fontSize: '.72rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>#{a.winnerMember.ticketNo}</span>
                        )}
                      </td>
                      <td><strong>{a.prizeAmount ? formatCurrency(Number(a.prizeAmount), currencySymbol) : '—'}</strong></td>
                      <td>{a.dividend ? formatCurrency(Number(a.dividend), currencySymbol) : '—'}</td>
                      <td>
                        <span className={`badge badge-${a.payoutStatus === 'paid' ? 'success' : a.payoutStatus === 'ready' ? 'info' : 'warning'}`} style={{ fontSize: '.68rem' }}>
                          {ui.payoutLabels[a.payoutStatus] || a.payoutStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>
      </div>
      )}

      {/* Tab 3: Detailed Chit & Member Dividend Ledger + ASCA Pool */}
      {detailTab === 'ledger' && (
        <>
          {dividendLedger && (
            <MemberDividendLedgerPanel
              ledger={dividendLedger}
              currencySymbol={currencySymbol}
              lang={lang}
              dict={dict}
            />
          )}

          {/* ASCA / SHG Revolving Pool Transactions */}
          {engineType === 'ASCA_SHG_REVOLVING' && (
        <div className="chit-detail-card">
          <div className="chit-detail-card-head"><h3>🤝 ASCA / SHG Revolving Pool Ledger</h3></div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              await run('asca-txn', () => recordAscaPoolTransaction(group.id, fd));
              (e.currentTarget as HTMLFormElement).reset();
            }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', padding: '0 16px 14px', alignItems: 'end' }}
          >
            <div className="form-group">
              <label className="form-label">Type</label>
              <select name="txnType" className="form-control" required>
                <option value="internal_loan_disburse">Internal Loan Disburse</option>
                <option value="internal_loan_repay">Internal Loan Repay</option>
                <option value="interest_income">Interest Income</option>
                <option value="admin_expense">Admin Expense</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Member</label>
              <select name="memberId" className="form-control">
                <option value="">Group-level</option>
                {group.members.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.ticketNo ?? m.memberNumber}. {m.customer.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Principal ({currencySymbol})</label>
              <input name="principalAmount" type="number" min="0" step="0.01" defaultValue="0" className="form-control" />
            </div>
            <div className="form-group">
              <label className="form-label">Interest ({currencySymbol})</label>
              <input name="interestAmount" type="number" min="0" step="0.01" defaultValue="0" className="form-control" />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input name="notes" type="text" className="form-control" />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy === 'asca-txn'}>
              {busy === 'asca-txn' ? 'Saving...' : 'Record Entry'}
            </button>
          </form>
          {poolTransactions.length > 0 && (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Date</th><th>Type</th><th>Principal</th><th>Interest</th><th>Notes</th></tr></thead>
                <tbody>
                  {poolTransactions.map((t: any) => (
                    <tr key={t.id}>
                      <td>{formatDate(t.txnDate)}</td>
                      <td>{t.txnType}</td>
                      <td>{formatCurrency(Number(t.principalAmount), currencySymbol)}</td>
                      <td>{formatCurrency(Number(t.interestAmount), currencySymbol)}</td>
                      <td>{t.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
          )}
        </>
      )}

      {/* Tab 2: Auctions */}
      {detailTab === 'auctions' && (
      <div className="chit-detail-card">
        <div className="chit-detail-card-head">
          <h3>🔨 {d.auctionHistory || ui.auctionHistoryTitle}</h3>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{ui.pdfLangLabel}</span>
            <select
              aria-label="Period PDF Language"
              className="form-control"
              style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}
              value={pdfLang}
              onChange={(e) => setPdfLang(e.target.value)}
            >
              {PDF_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.nativeName}</option>
              ))}
            </select>
          </div>
        </div>
        {group.auctions.length === 0 ? (
          <p style={{ padding: '16px', color: 'var(--text-secondary)' }}>{group.status === 'draft' ? ui.draftAuctionsMsg : d.noAuctions}</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{d.period}</th>
                  <th>{d.date}</th>
                  <th>{d.winner}</th>
                  <th>{d.prize}</th>
                  <th>{d.dividend}</th>
                  <th>{d.status}</th>
                  <th>{ui.payoutCol}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {group.auctions.map((a: any) => (
                  <tr key={a.id}>
                    <td>{d.periodLabel} {a.periodNumber}</td>
                    <td>
                      {formatDate(a.auctionDate)}
                      {a.scheduledAt && <div style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                    </td>
                    <td>{a.winnerMember?.customer?.name || '—'}</td>
                    <td>{a.prizeAmount ? formatCurrency(Number(a.prizeAmount), currencySymbol) : '—'}</td>
                    <td>{a.dividend ? formatCurrency(Number(a.dividend), currencySymbol) : '—'}</td>
                    <td><span className={`badge badge-${['confirmed', 'paid'].includes(a.status) ? 'success' : a.status === 'cancelled' ? 'danger' : a.status === 'in_progress' ? 'info' : 'warning'}`}>{a.status}</span></td>
                    <td>{a.winnerMemberId ? <span className={`badge badge-${a.payoutStatus === 'paid' ? 'success' : a.payoutStatus === 'ready' ? 'info' : 'warning'}`}>{ui.payoutLabels[a.payoutStatus] || a.payoutStatus}</span> : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link href={`/chits/${group.id}/auctions/${a.id}`} className="btn btn-ghost btn-sm">{ui.manageBtn}</Link>
                      <a
                        href={`/api/chits/${group.id}/auctions/${a.id}/report?lang=${pdfLang}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ marginLeft: '4px' }}
                        title={`PDF (${pdfLang})`}
                      >
                        📄 PDF
                      </a>
                      {group.auctionType === 'open_live' && (
                        <Link href={`/chits/${group.id}/auctions/${a.id}`} className="btn btn-secondary btn-sm" style={{ marginLeft: '4px' }}>{ui.enterRoomBtn}</Link>
                      )}
                      {!['confirmed', 'paid', 'cancelled'].includes(a.status) && !a.winnerMemberId && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ marginLeft: '4px' }}
                          disabled={busy === 'reschedule'}
                          onClick={() => setRescheduleModal(a)}
                        >
                          {ui.rescheduleBtn}
                        </button>
                      )}
                      {(!isBiddingEnabledForPeriod(group, a.periodNumber)) && !['confirmed', 'paid', 'cancelled'].includes(a.status) && group.status === 'active' && engineType !== 'NEED_BASED_CONSENSUS' && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ marginLeft: '4px' }}
                          disabled={busy === `draw-${a.id}`}
                          onClick={() => run(`draw-${a.id}`, () => drawAuctionWinner(a.id))}
                        >
                          {busy === `draw-${a.id}` ? ui.drawingBtn : group.auctionType === 'lottery' ? ui.drawBtn : ui.resolveBtn}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Tab 4: Members */}
      {detailTab === 'members' && (
        <div className="chit-detail-card">
          <div className="chit-detail-card-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>👥 {d.members} ({group.members.length}/{group.totalMembers})</h3>
              {unverifiedMembersCount > 0 && (
                <span className="badge badge-warning" style={{ fontSize: '.74rem' }}>
                  {unverifiedMembersCount} {ui.membersNeedReviewBadge}
                </span>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                aria-expanded={membersTableOpen}
                onClick={() => setMembersTableOpen((v) => !v)}
              >
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                  {membersTableOpen ? 'expand_less' : 'expand_more'}
                </span>
                {membersTableOpen ? ui.membersExpandedBtn : ui.membersCollapsedBtn}
              </button>
            </div>
            {membersTableOpen && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {!['completed', 'cancelled'].includes(group.status) && (
                  <QuickAddAndBulkImportPanel
                    groupId={group.id}
                    currentCount={group.members.length}
                    totalMembers={group.totalMembers}
                    disabled={!!busy}
                  />
                )}
                {customers.length > 0 && !['completed', 'cancelled'].includes(group.status) && (
                  <div style={{ minWidth: '290px', maxWidth: '380px', flex: '1 1 290px' }}>
                    <InlineAddPicker
                      compact
                      disabled={busy === 'add-tickets'}
                      placeholder={busy === 'add-tickets' ? '...' : 'Search customer & click +...'}
                      summaryText={`${group.members.length}/${group.totalMembers}`}
                      allowMultiple
                      maxTotalReached={group.members.length >= group.totalMembers}
                      onExceedMax={(cid) => {
                        const cust = customers.find((c) => c.id === cid);
                        setDetailLimitWarning(cust ? `${cust.name} (${cust.customerCode})` : 'Customer');
                      }}
                      items={customers.map((c) => {
                        const count = group.members.filter((m: any) => m.customerId === c.id).length;
                        return {
                          id: c.id,
                          label: c.name,
                          subLabel: c.customerCode,
                          count,
                        };
                      })}
                      onIncrement={(cid) => run('add-tickets', () => addChitMemberTicketsAction(group.id, cid, 1))}
                      footerAction={{ label: 'New Customer', href: '/customers/new' }}
                    />
                  </div>
                )}
                {group.members.some((m: any) => m.agreementStatus !== 'verified') && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy === 'verify-all-agreements'}
                    onClick={() =>
                      run('verify-all-agreements', async () => {
                        for (const m of group.members) {
                          if (m.agreementStatus !== 'verified') {
                            await verifyChitAgreement(m.id);
                          }
                        }
                      })
                    }
                  >
                    {busy === 'verify-all-agreements' ? ui.verifyingAllBtn : `✓ ${ui.signVerifyAllBtn}`}
                  </button>
                )}
              </div>
            )}
          </div>
          {membersTableOpen && (
            group.members.length === 0 ? (
              <p style={{ padding: '16px', color: 'var(--text-secondary)' }}>{d.noMembers}</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>{ui.ticketCol}</th>
                      <th>{d.customer}</th>
                      <th>{ui.shareCol}</th>
                      <th>{ui.agreementCol}</th>
                      <th>{ui.nomineeCol}</th>
                      <th>{d.status}</th>
                      <th>{d.won}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.members.map((m: any) => (
                      <tr key={m.id}>
                        <td>{m.ticketNo ?? m.memberNumber}{m.fractionNo ? `-${m.fractionNo}` : ''}{m.isForemanTicket ? ' ★' : ''}</td>
                        <td>
                          <Link href={`/customers/${m.customer.customerCode}`}>{m.customer.name}</Link>
                          <br /><span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{m.customer.customerCode}</span>
                        </td>
                        <td>{Number(m.ticketShare) === 1 ? ui.fullShare : Number(m.ticketShare)}</td>
                        <td>
                          {agreementBadge(m.agreementStatus)}
                          {m.agreementStatus === 'pending' && (
                            <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => run(`sign-${m.id}`, () => markChitAgreementSigned(m.id))}>{ui.signBtn}</button>
                          )}
                          {m.agreementStatus === 'signed' && (
                            <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => run(`verify-${m.id}`, () => verifyChitAgreement(m.id))}>{ui.verifyBtn}</button>
                          )}
                        </td>
                        <td>{m.nomineeName || <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                        <td><span className={`badge badge-${m.subscriberStatus === 'active' ? 'success' : 'secondary'}`}>{m.subscriberStatus}</span></td>
                        <td>{m.hasWon ? <span className="badge badge-success">{d.won} {formatDate(m.wonAt)}</span> : <span className="badge badge-secondary">{d.pending}</span>}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setMemberModal(m); setError(''); }}>{ui.editBtn}</button>
                            {group.members.length < group.totalMembers && !['completed', 'cancelled'].includes(group.status) && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '.7rem', padding: '2px 6px' }}
                                disabled={!!busy}
                                onClick={() => run(`dup-${m.id}`, () => addChitMemberTicketsAction(group.id, m.customerId, 1))}
                              >
                                {ui.addOneTicketBtn}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      {/* Tab 5: Payments & Proofs */}
      {detailTab === 'payments' && (
        <>
      {/* Doc 19: customer-submitted payment proofs awaiting review, scoped to this group */}
      <div className="chit-detail-card">
        <div className="chit-detail-card-head"><h3>🧾 {ui.paymentProofsTitle}</h3></div>
        <div style={{ padding: '14px 16px' }}>
          <PaymentIntentsQueue chitGroupId={group.id} currencySymbol={currencySymbol} />
        </div>
      </div>

      {/* Subscription Payments */}
      <div className="chit-detail-card">
        <div className="chit-detail-card-head">
          <h3>💳 {d.memberPayments || ui.memberPaymentsTitle}</h3>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(['current', 'overdue', 'all'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`btn btn-sm ${subTab === tab ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSubTab(tab)}
              >
                {tab === 'current' ? ui.tabCurrent : tab === 'overdue' ? ui.tabOverdue : ui.tabAll}
              </button>
            ))}
          </div>
        </div>
        {periodNumbers.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '6px',
              padding: '0 16px 12px',
              overflowX: 'auto',
              alignItems: 'center',
            }}
          >
            {periodNumbers.map((p) => {
              const active = selectedPeriod === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPeriod(p)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: active ? 700 : 600,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: active ? 'var(--primary)' : 'var(--bg)',
                    color: active ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {d.periodLabel} {p}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setSelectedPeriod('all')}
              style={{
                padding: '5px 14px',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: selectedPeriod === 'all' ? 700 : 600,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                border: selectedPeriod === 'all' ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: selectedPeriod === 'all' ? 'var(--primary)' : 'var(--bg)',
                color: selectedPeriod === 'all' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {ui.allPeriodsBtn}
            </button>
            {selectedPeriod !== 'all' && (() => {
              const periodAuction = group.auctions.find((a: any) => Number(a.periodNumber) === selectedPeriod);
              return periodAuction ? (
                <a
                  href={`/api/chits/${group.id}/auctions/${periodAuction.id}/report?lang=${pdfLang}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
                >
                  📄 {d.periodLabel} {selectedPeriod} PDF
                </a>
              ) : null;
            })()}
          </div>
        )}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{d.member}</th>
                <th>{d.period}</th>
                <th>{d.dueDate}</th>
                <th>{ui.baseCol}</th>
                <th>{d.dividend}</th>
                <th>{ui.penaltyCol}</th>
                <th>{ui.netDueCol}</th>
                <th>{d.paid}</th>
                <th>{ui.outstandingCol}</th>
                <th>{ui.receiptCol}</th>
                <th>{d.status}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {group.members.flatMap((m: any) =>
                m.subscriptions
                  .filter((s: any) => {
                    if (selectedPeriod !== 'all' && Number(s.periodNumber) !== selectedPeriod) {
                      return false;
                    }
                    if (subTab === 'all') return true;
                    if (s.status === 'paid') return false;
                    const freq = parseFrequency(group);
                    const { to } = periodWindow(new Date(group.startDate), s.periodNumber, freq);
                    const isOverdue = new Date() >= to;
                    return subTab === 'overdue' ? isOverdue : !isOverdue;
                  })
                  .map((s: any) => {
                  const b = subscriptionBreakdown(s);
                  const periodDone = completedAuctions.some((a: any) => Number(a.periodNumber) === Number(s.periodNumber));
                  const displayStatus =
                    s.status === 'upcoming' && (periodDone || new Date(s.dueDate).getTime() <= Date.now())
                      ? 'pending'
                      : s.status;
                  return (
                  <tr key={s.id}>
                    <td>{m.customer.name}</td>
                    <td>Period {s.periodNumber}</td>
                    <td>{formatDate(s.dueDate)}</td>
                    <td>{formatCurrency(b.baseContribution, currencySymbol)}</td>
                    <td>{Number(s.dividendAmount) > 0 ? formatCurrency(Number(s.dividendAmount), currencySymbol) : '—'}</td>
                    <td>{b.penalty > 0 ? formatCurrency(b.penalty, currencySymbol) : '—'}</td>
                    <td>{formatCurrency(b.netDue, currencySymbol)}</td>
                    <td>{formatCurrency(b.paid, currencySymbol)}</td>
                    <td><strong>{formatCurrency(b.outstanding, currencySymbol)}</strong></td>
                    <td style={{ fontSize: '.75rem' }}>{s.lastReceiptNo || '—'}</td>
                    <td><span className={`badge badge-${displayStatus === 'paid' ? 'success' : displayStatus === 'missed' ? 'danger' : displayStatus === 'partial' || displayStatus === 'pending' ? 'warning' : 'secondary'}`}>{displayStatus}</span></td>
                    <td style={{ display: 'flex', gap: '4px' }}>
                      {s.status !== 'paid' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setPaymentModal({ subscriptionId: s.id, memberId: m.id, periodNumber: s.periodNumber, dueAmount: s.dueAmount, ...b });
                            setPayAmount(b.outstanding);
                            setPayMode('cash');
                            setPayRef('');
                            setPayNotes('');
                            setPayDenomCounts({});
                            setPayDenomJson(null);
                            setPayDenomMatched(cashDenominationMode !== 'REQUIRED');
                            paymentIdempotencyRef.current = '';
                            setError('');
                          }}
                        >
                          {d.recordPayment}
                        </button>
                      )}
                      {s.status !== 'paid' && s.status !== 'missed' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => run(`missed-${s.id}`, () => markPaymentMissed(s.id))}
                          disabled={!!busy}
                        >
                          Missed
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="card" style={{ width: '100%', maxWidth: payMode === 'cash' && cashDenominationMode !== 'DISABLED' ? '560px' : '420px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <h3 style={{ marginBottom: '12px' }}>{d.recordPayment} — Period {paymentModal.periodNumber}
              <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)', fontWeight: 'normal', marginLeft: '8px' }}>
                Outstanding: {formatCurrency(Number(paymentModal.outstanding), currencySymbol)}
              </span>
            </h3>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '10px', fontSize: '.85rem' }}>{error}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginBottom: '12px', fontSize: '.8rem', color: 'var(--text-secondary)' }}>
              <span>Base: {formatCurrency(Number(paymentModal.baseContribution), currencySymbol)}</span>
              <span>Dividend: {Number(paymentModal.dividendAdjustment) > 0 ? `-${formatCurrency(Number(paymentModal.dividendAdjustment), currencySymbol)}` : '—'}</span>
              <span>Interest: {Number(paymentModal.interest) > 0 ? formatCurrency(Number(paymentModal.interest), currencySymbol) : '—'}</span>
              <span>Penalty: {Number(paymentModal.penalty) > 0 ? formatCurrency(Number(paymentModal.penalty), currencySymbol) : '—'}</span>
              <span>Net due: {formatCurrency(Number(paymentModal.netDue), currencySymbol)}</span>
              <span>Paid: {formatCurrency(Number(paymentModal.paid), currencySymbol)}</span>
              <strong style={{ color: 'var(--text-primary)' }}>Outstanding: {formatCurrency(Number(paymentModal.outstanding), currencySymbol)}</strong>
            </div>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">{d.amountPaid} ({currencySymbol})</label>
              <input type="number" className="form-control" value={payAmount} onChange={(e) => { setPayAmount(Number(e.target.value)); paymentIdempotencyRef.current = ''; }} />
            </div>
            {isGoldWeight && (
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Bullion rate ({currencySymbol} / g)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  className="form-control"
                  value={payGoldRate}
                  onChange={(e) => setPayGoldRate(Number(e.target.value))}
                />
                {payGoldRate > 0 && payAmount > 0 && (
                  <p style={{ fontSize: '.75rem', color: 'var(--success)', margin: '4px 0 0' }}>
                    Credits {(payAmount / payGoldRate).toFixed(4)} g gold
                  </p>
                )}
              </div>
            )}
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Payment mode</label>
              <select className="form-control" value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank">Bank transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            {payMode === 'cash' && cashDenominationMode !== 'DISABLED' && (
              <div style={{ marginBottom: '12px' }}>
                <CashDenominationCounter
                  compact
                  expectedAmount={payAmount}
                  mode={cashDenominationMode}
                  value={payDenomCounts}
                  currencySymbol={currencySymbol}
                  onChange={(next, meta) => {
                    setPayDenomCounts(next);
                    setPayDenomJson(meta.json);
                    setPayDenomMatched(meta.isMatch);
                  }}
                />
              </div>
            )}
            {payMode !== 'cash' && (
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Reference no</label>
                <input type="text" className="form-control" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="UPI/txn reference" />
              </div>
            )}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Notes</label>
              <input type="text" className="form-control" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPaymentModal(null)}>{d.cancel}</button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleRecordPayment}
                disabled={loading || payAmount <= 0 || (payMode === 'cash' && cashDenominationMode === 'REQUIRED' && !payDenomMatched)}
              >
                {loading ? d.saving : d.recordPayment}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meet-style Auction Schedule & Early Override Modal */}
      {rescheduleModal && (
        <AuctionScheduleModal
          open
          onClose={() => setRescheduleModal(null)}
          auctionId={rescheduleModal.id}
          groupName={group.name}
          periodNumber={rescheduleModal.periodNumber}
          initialScheduledAt={rescheduleModal.scheduledAt ?? rescheduleModal.auctionDate}
          initialDurationMinutes={engineCfg.meetingSchedule?.defaultDurationMinutes ?? 30}
          initialAutoStart={Boolean(engineCfg.meetingSchedule?.autoStartAtScheduledTime)}
          isBiddingRoom={!['lottery', 'fixed_rotation'].includes(group.auctionType)}
          dict={dict}
          onCompleted={() => router.refresh()}
        />
      )}

      {/* Member Edit Modal */}
      {memberModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form className="card" style={{ width: '460px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }} onSubmit={handleSaveMember}>
            <h3 style={{ marginBottom: '12px' }}>Edit member — {memberModal.customer.name}</h3>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '10px', fontSize: '.85rem' }}>{error}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Ticket no</label>
                <input name="ticketNo" type="text" className="form-control" defaultValue={memberModal.ticketNo ?? ''} />
              </div>
              <div className="form-group">
                <label className="form-label">Fraction no</label>
                <input name="fractionNo" type="text" className="form-control" defaultValue={memberModal.fractionNo ?? ''} placeholder="e.g. A" />
              </div>
              <div className="form-group">
                <label className="form-label">Ticket share</label>
                <select name="ticketShare" className="form-control" defaultValue={String(Number(memberModal.ticketShare))}>
                  <option value="1">Full (1.00)</option>
                  <option value="0.5">Half (0.50)</option>
                  <option value="0.25">Quarter (0.25)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Subscriber status</label>
                <select name="subscriberStatus" className="form-control" defaultValue={memberModal.subscriberStatus}>
                  <option value="active">Active</option>
                  <option value="vacant">Vacant (company-held)</option>
                  <option value="defaulted">Defaulted</option>
                  <option value="substituted">Substituted</option>
                  <option value="removed">Removed</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Agreement status</label>
                <select name="agreementStatus" className="form-control" defaultValue={memberModal.agreementStatus}>
                  <option value="pending">Pending</option>
                  <option value="signed">Signed</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Introduced by</label>
                <input name="introducedBy" type="text" className="form-control" defaultValue={memberModal.introducedBy ?? ''} />
              </div>
              <div className="form-group">
                <label className="form-label">Nominee name</label>
                <input name="nomineeName" type="text" className="form-control" defaultValue={memberModal.nomineeName ?? ''} />
              </div>
              <div className="form-group">
                <label className="form-label">Nominee relation</label>
                <input name="nomineeRelation" type="text" className="form-control" defaultValue={memberModal.nomineeRelation ?? ''} />
              </div>
              <div className="form-group">
                <label className="form-label">Nominee phone</label>
                <input name="nomineePhone" type="tel" className="form-control" defaultValue={memberModal.nomineePhone ?? ''} />
              </div>
              {group.hasForemanTicket && (
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.85rem' }}>
                    <input name="isForemanTicket" type="checkbox" value="true" defaultChecked={memberModal.isForemanTicket} />
                    This is the foreman/company ticket
                  </label>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMemberModal(null)}>{d.cancel}</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>{loading ? d.saving : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      {foremenModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '18px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px' }}>🏛️ Assign Foremen ({foremenDraft.length})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 130px', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
              <InlineAddPicker
                compact
                allowMultiple={false}
                placeholder="Search staff & click + to assign..."
                summaryText={`${foremenDraft.length} selected`}
                items={staffUsers.map((u) => ({
                  id: u.id,
                  label: u.name,
                  subLabel: u.phone || undefined,
                  badgeText: u.customRoleName || u.customRole?.name || u.role,
                  count: foremenDraft.some((fd) => fd.userId === u.id) ? 1 : 0,
                }))}
                onIncrement={(uid) => {
                  const found = staffUsers.find((u) => u.id === uid);
                  if (!found) return;
                  setForemenDraft((prev) => {
                    if (prev.some((x) => x.userId === uid)) return prev;
                    const role = found.customRoleName || found.customRole?.name || pickForemanRole.trim() || (prev.length === 0 ? 'Primary Foreman' : 'Co-Foreman');
                    return [...prev, { userId: uid, roleLabel: role, isPrimary: prev.length === 0 }];
                  });
                }}
                onDecrement={(uid) => {
                  setForemenDraft((prev) => {
                    const next = prev.filter((x) => x.userId !== uid);
                    if (next.length > 0 && !next.some((x) => x.isPrimary)) {
                      next[0] = { ...next[0], isPrimary: true };
                    }
                    return next;
                  });
                }}
              />
              <input
                type="text"
                className="form-control"
                value={pickForemanRole}
                onChange={(e) => setPickForemanRole(e.target.value)}
                placeholder="Role label"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
              {foremenDraft.map((f, idx) => {
                const u = staffUsers.find((s) => s.id === f.userId);
                return (
                  <div key={f.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '.82rem' }}>
                    <span>
                      <strong>{u?.name || f.userId}</strong> · {f.roleLabel} {f.isPrimary && <span className="badge badge-info">Primary</span>}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {!f.isPrimary && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: '.72rem' }}
                          onClick={() => setForemenDraft((prev) => prev.map((x, i) => ({ ...x, isPrimary: i === idx })))}
                        >
                          Make Primary
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)', fontSize: '.72rem' }}
                        onClick={() => setForemenDraft((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
              {foremenDraft.length === 0 && (
                <p style={{ margin: 0, fontSize: '.8rem', color: 'var(--text-secondary)' }}>No foremen assigned.</p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForemenModal(false)}>{d.cancel}</button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!!busy}
                onClick={async () => {
                  await run('save-foremen', () => updateChitGroupForemenAction(group.id, foremenDraft));
                  setForemenModal(false);
                }}
              >
                {busy === 'save-foremen' ? 'Saving…' : 'Save Foremen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: State-Configurable Statutory Registers (Enterprise) */}
      {detailTab === 'registers' && (
      <div className="chit-detail-card" data-testid="statutory-registers-card">
        <div className="chit-detail-card-head">
          <div>
            <h3 style={{ margin: 0 }}>🏛️ {ui.statutoryTitle}</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {ui.statutoryDesc}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="form-control"
              value={statState}
              onChange={(e) => setStatState(e.target.value as StatutoryStateCode)}
              style={{ width: '190px', fontWeight: 600 }}
            >
              <option value="TN">Tamil Nadu Rules (1984)</option>
              <option value="DL">Delhi Chit Rules (2007)</option>
              <option value="GENERIC">Central Act (1982)</option>
            </select>
            {!canExportStatutoryRegisters && (
              <Link href="/subscription" className="btn btn-primary btn-sm">
                🔒 {ui.upgradeEnterpriseBtn}
              </Link>
            )}
          </div>
        </div>

        <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
          {STATUTORY_REGISTER_TYPES.map((regType) => {
            const meta = resolveStatutoryTemplate(statState, regType);
            const pdfHref = `/api/chits/${group.id}/statutory?register=${regType}&state=${statState}&format=pdf&lang=${pdfLang}`;
            const xlsxHref = `/api/chits/${group.id}/statutory?register=${regType}&state=${statState}&format=xlsx`;
            return (
              <div
                key={regType}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  background: 'var(--bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.84rem' }}>{meta.title}</strong>
                    <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>{meta.formCode}</span>
                  </div>
                  <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {meta.subtitle}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {canExportStatutoryRegisters ? (
                    <>
                      <a href={pdfHref} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                        PDF
                      </a>
                      <a href={xlsxHref} className="btn btn-ghost btn-sm">
                        Excel (.xlsx)
                      </a>
                    </>
                  ) : (
                    <Link href="/subscription" className="btn btn-secondary btn-sm" style={{ opacity: 0.78 }}>
                      {ui.enterpriseOnlyBtn}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Themed Group Cancel / Delete Confirmation Modal */}
      {confirmGroupAction && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.58)',
            backdropFilter: 'blur(4px)',
            zIndex: 1450,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => !busy && setConfirmGroupAction(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: '18px',
              boxShadow: '0 24px 56px -12px rgba(15, 23, 42, 0.38)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '16px 20px',
                background: confirmGroupAction === 'delete' ? 'var(--danger-bg)' : 'var(--warning-bg)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.08rem',
                  fontWeight: 800,
                  color: confirmGroupAction === 'delete' ? 'var(--danger)' : 'var(--warning)',
                }}
              >
                {confirmGroupAction === 'delete' ? `Delete "${group.name}"?` : `Cancel "${group.name}"?`}
              </h3>
            </div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text)', lineHeight: 1.5 }}>
                {confirmGroupAction === 'delete'
                  ? `Deleting removes "${group.name}" from active chit lists. Groups with recorded payments or prize payouts cannot be deleted — cancel them instead to keep accounting history.`
                  : `Cancelling "${group.name}" halts all upcoming pending auctions while preserving member subscriptions and payment history.`}
              </p>
              {groupActionError && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'var(--danger-bg)',
                    border: '1px solid var(--danger)',
                    color: 'var(--danger)',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <span>{groupActionError}</span>
                  {confirmGroupAction === 'delete' && ['draft', 'active'].includes(group.status) && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ alignSelf: 'flex-start' }}
                      onClick={() => {
                        setGroupActionError('');
                        setConfirmGroupAction('cancel');
                      }}
                    >
                      Switch to Cancel Group Instead
                    </button>
                  )}
                </div>
              )}
            </div>
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={Boolean(busy)}
                onClick={() => setConfirmGroupAction(null)}
              >
                {d.cancel}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${confirmGroupAction === 'delete' ? 'btn-danger' : 'btn-primary'}`}
                disabled={Boolean(busy)}
                onClick={async () => {
                  const actionName = confirmGroupAction;
                  setGroupActionError('');
                  setBusy(actionName);
                  try {
                    const res =
                      actionName === 'delete'
                        ? await deleteChitGroupAction(group.id)
                        : await cancelChitGroupAction(group.id);
                    if (res && !res.ok) {
                      setGroupActionError(res.error || 'Action failed');
                      setBusy('');
                      return;
                    }
                    setConfirmGroupAction(null);
                    setBusy('');
                    if (actionName === 'delete') {
                      router.push('/chits');
                    } else {
                      router.refresh();
                    }
                  } catch (e: unknown) {
                    setGroupActionError((e as { message?: string })?.message || 'Action failed');
                    setBusy('');
                  }
                }}
              >
                {busy === confirmGroupAction
                  ? 'Processing…'
                  : confirmGroupAction === 'delete'
                    ? d.deleteGroupMenuBtn || 'Delete Group'
                    : ui.cancelGroupBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task 5: Free-Tier 1-Active-Chit Limit Upgrade Modal */}
      {planLimitModal && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="chit-plan-limit-modal"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.58)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1250,
            padding: '16px',
          }}
          onClick={() => setPlanLimitModal(null)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: '460px', padding: 0, overflow: 'hidden', borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, var(--primary-dark, #5a195b), var(--primary, #7d287e))', color: '#fff' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff' }}>🚀 Running Chit Limit Reached</h3>
            </div>
            <div style={{ padding: '18px 20px' }}>
              <p style={{ margin: '0 0 12px', fontSize: '0.88rem', lineHeight: 1.5 }}>{planLimitModal}</p>
              <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                The Free plan includes <strong>1 concurrent active chit group with unlimited members</strong>. Upgrade to run multiple simultaneous chit groups, statutory registers, and multi-branch teams.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPlanLimitModal(null)}>
                  Close
                </button>
                <Link href="/subscription" className="btn btn-primary btn-sm">
                  View Plans &amp; Upgrade →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailLimitWarning && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '16px',
          }}
          onClick={() => setDetailLimitWarning(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              border: '1px solid #CBD5E1',
              boxShadow: '0 20px 44px -10px rgba(15, 23, 42, 0.3)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '13px 16px', background: 'linear-gradient(90deg, var(--warning), var(--primary-dark))', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '20px' }}>warning_amber</span>
              <h4 style={{ margin: 0, fontSize: '.98rem', fontWeight: 800, color: '#FFFFFF' }}>
                {d.members} ({group.totalMembers})
              </h4>
            </div>
            <div style={{ padding: '16px', background: 'var(--surface)' }}>
              <p style={{ margin: '0 0 12px', fontSize: '.86rem', color: 'var(--text)', lineHeight: 1.5 }}>
                <strong>{detailLimitWarning}</strong> — <strong>{group.members.length} / {group.totalMembers}</strong>
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDetailLimitWarning(null)}>
                  Close
                </button>
                {group.status === 'draft' && (
                  <Link href={`/chits/${group.id}/edit`} className="btn btn-primary btn-sm">
                    Increase Limit in Edit Group
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
