'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  activateChitGroup,
  addChitMemberTicketsAction,
  autoAssignChitTicketNumbers,
  cancelChitGroup,
  drawAuctionWinner,
  markPaymentMissed,
  recordChitPayment,
  updateChitGroupForemenAction,
  updateChitMemberDetails,
  markChitAgreementSigned,
  recordAscaPoolTransaction,
  rescheduleAuction,
  verifyChitAgreement,
} from '../actions';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PDF_LANGUAGES, resolvePdfLang } from '@/lib/reports/pdfLanguages';
import Link from '@/components/layout/DashboardLink';
import { useRegisterBreadcrumbLabel } from '@/components/layout/BreadcrumbLabelContext';
import { parseFrequency, frequencyLabel, periodWindow } from '@/lib/chits/frequency';
import PaymentIntentsQueue from '@/components/chits/PaymentIntentsQueue';
import MemberDividendLedgerPanel from '@/components/chits/MemberDividendLedgerPanel';
import { computeSubscriptionBalances } from '@/lib/chits/engineCalculator';
import {
  CHIT_ENGINE_CATALOG,
  isBiddingEnabledForPeriod,
  parseChitEngineConfig,
  resolveEngineTypeFromGroup,
} from '@/lib/chits/engineTypes';
import type { ChitGroupDividendLedger } from '@/lib/chits/memberDividendLedger';

interface ChitGroupDetailClientProps {
  group: any;
  dividendLedger?: ChitGroupDividendLedger | null;
  poolTransactions?: any[];
  staffUsers?: Array<{ id: string; name: string; phone: string; role: string; customRoleName?: string | null; customRole?: { name: string } | null }>;
  customers?: Array<{ id: string; name: string; customerCode: string }>;
  currencySymbol: string;
  lang?: string;
  dict: any;
}

const AUCTION_TYPE_LABELS: Record<string, string> = {
  open_manual: 'Open auction (manual entry)',
  open_live: 'Open live bidding',
  sealed: 'Sealed tender',
  lottery: 'Lottery draw',
  fixed_rotation: 'Fixed rotation',
};

const DISTRIBUTION_LABELS: Record<string, string> = {
  ADJUST_NEXT_DUE: 'Reduces next installment',
  CASH_PAYOUT: 'Paid out in cash',
  ACCUMULATE: 'Accumulated to closure',
  DEFERRED_BONUS_POOL: 'Deferred maturity bonus pool',
  NONE: 'None (no dividend)',
};

export default function ChitGroupDetailClient({
  group,
  dividendLedger = null,
  poolTransactions = [],
  staffUsers = [],
  customers = [],
  currencySymbol,
  lang,
  dict,
}: ChitGroupDetailClientProps) {
  const d = dict.chits;
  const router = useRouter();
  useRegisterBreadcrumbLabel(group.groupCode ?? group.id, group.name);
  const [pdfLang, setPdfLang] = useState<string>(() => resolvePdfLang(lang));
  const [paymentModal, setPaymentModal] = useState<any>(null);
  const [memberModal, setMemberModal] = useState<any>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const engineType = resolveEngineTypeFromGroup(group);
  const engineCfg = parseChitEngineConfig(group.engineConfig, engineType);
  const engineCatalog = CHIT_ENGINE_CATALOG[engineType];
  const isGoldWeight = engineType === 'GOLD_WEIGHT_ACCUMULATION';
  const [payGoldRate, setPayGoldRate] = useState<number>(
    engineCfg.goldScheme?.defaultGoldRatePerGram ?? 0,
  );
  const [lastReceipt, setLastReceipt] = useState('');
  const [rescheduleModal, setRescheduleModal] = useState<any>(null);
  const [rescheduleValue, setRescheduleValue] = useState('');
  const [foremenModal, setForemenModal] = useState<boolean>(false);
  const [foremenDraft, setForemenDraft] = useState<Array<{ userId: string; roleLabel: string; isPrimary: boolean }>>(() =>
    (group.foremen ?? []).map((f: any) => ({
      userId: f.userId,
      roleLabel: f.roleLabel || 'Foreman',
      isPrimary: Boolean(f.isPrimary),
    })),
  );
  const [pickForemanId, setPickForemanId] = useState('');
  const [pickForemanRole, setPickForemanRole] = useState('Co-Foreman');
  const [addCustId, setAddCustId] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
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
        setError(res.error || 'Action failed');
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
    try {
      const result = await recordChitPayment(
        paymentModal.memberId,
        paymentModal.periodNumber,
        payAmount,
        payMode,
        payRef || null,
        payNotes || null,
        isGoldWeight ? payGoldRate : null,
      );
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

  const handleReschedule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!rescheduleModal || !rescheduleValue) return;
    await run('reschedule', async () => {
      await rescheduleAuction(rescheduleModal.id, new Date(rescheduleValue).toISOString());
      setRescheduleModal(null);
      setRescheduleValue('');
    });
  };

  const agreementBadge = (status: string) => {
    const cls = status === 'verified' ? 'success' : status === 'signed' ? 'info' : status === 'rejected' ? 'danger' : 'warning';
    return <span className={`badge badge-${cls}`}>{status}</span>;
  };

  const complianceRows: [string, React.ReactNode][] = group.chitType === 'registered'
    ? [
        ['Registration no', group.registrationNo || <span style={{ color: 'var(--danger)' }}>missing</span>],
        ['Registrar office', group.registrarOffice || <span style={{ color: 'var(--danger)' }}>missing</span>],
        ['By-law no', group.bylawNo || <span style={{ color: 'var(--danger)' }}>missing</span>],
        ['Commencement cert.', group.commencementCertificate || <span style={{ color: 'var(--danger)' }}>missing</span>],
        ['Approved bank', group.approvedBankName || <span style={{ color: 'var(--danger)' }}>missing</span>],
        ['Foreman', group.foremanName || <span style={{ color: 'var(--danger)' }}>missing</span>],
      ]
    : [['Compliance', 'Unregistered chit — registration details not required']];

  return (
    <>
      {error && <div className="alert alert-danger" style={{ marginBottom: '16px', padding: '10px 14px', background: '#fff0f0', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', color: 'var(--danger)' }}>{error}</div>}
      {lastReceipt && (
        <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#f0fff4', border: '1px solid var(--success)', borderRadius: 'var(--radius)', color: 'var(--success)' }}>
          Payment recorded — receipt {lastReceipt}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Link href={`/chits/${group.id}/room`} className="btn btn-primary btn-sm">
          💬 Group Chat &amp; Live Room
        </Link>
        <Link href={`/chits/${group.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
        {group.status === 'draft' && membersMissingTicketNo > 0 && (
          <button
            className="btn btn-secondary btn-sm"
            disabled={busy === 'auto-assign'}
            onClick={() => run('auto-assign', () => autoAssignChitTicketNumbers(group.id))}
          >
            {busy === 'auto-assign' ? 'Assigning…' : `Auto-assign ticket numbers (${membersMissingTicketNo})`}
          </button>
        )}
        {group.status === 'draft' && (
          <button
            className="btn btn-primary btn-sm"
            disabled={busy === 'activate'}
            onClick={() => run('activate', () => activateChitGroup(group.id))}
          >
            {busy === 'activate' ? 'Activating…' : 'Activate Group'}
          </button>
        )}
        {group.status === 'active' && (
          <button
            className="btn btn-danger btn-sm"
            disabled={busy === 'cancel'}
            onClick={() => {
              if (confirm('Cancel this chit group? All pending auctions will be cancelled.')) {
                run('cancel', () => cancelChitGroup(group.id));
              }
            }}
          >
            {busy === 'cancel' ? 'Cancelling…' : 'Cancel Group'}
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="kpi-grid" style={{ marginBottom: '20px' }}>
        <div className="kpi-card">
          <div className="kpi-icon green"><span className="material-icons-outlined">savings</span></div>
          <div><div className="kpi-value">{formatCurrency(Number(group.chitValue), currencySymbol)}</div><div className="kpi-label">{d.chitValue}</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon blue"><span className="material-icons-outlined">payments</span></div>
          <div><div className="kpi-value">{formatCurrency(Number(group.monthlyContrib), currencySymbol)}</div><div className="kpi-label">Installment ({frequencyLabel(parseFrequency(group))})</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange"><span className="material-icons-outlined">groups</span></div>
          <div><div className="kpi-value">{group.members.length}/{group.totalMembers}</div><div className="kpi-label">{d.membersEnrolled}</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon purple"><span className="material-icons-outlined">gavel</span></div>
          <div><div className="kpi-value">{completedAuctions.length}/{group.totalMembers}</div><div className="kpi-label">{d.auctionsCompleted}</div></div>
        </div>
      </div>

      {/* Configuration & compliance */}
      <div className="grid-60-40" style={{ marginBottom: '20px' }}>
        <div className="card">
          <div className="card-header"><h3>⚙️ Chit configuration</h3></div>
          <div className="table-wrapper">
            <table>
              <tbody>
                <tr>
                  <td>Engine &amp; Type</td>
                  <td>
                    <strong>{engineCatalog.name}</strong> (<code>{engineType}</code>) ·{' '}
                    {group.chitType === 'registered' ? 'Registered' : 'Unregistered'} ·{' '}
                    {AUCTION_TYPE_LABELS[group.auctionType] ?? group.auctionType}
                  </td>
                </tr>
                <tr>
                  <td>Tier &amp; Asset</td>
                  <td>
                    {engineCfg.regulatoryTier} · {engineCfg.scaleTier} · Asset: {engineCfg.payoutAssetType} · Cadence: {engineCfg.collectionFrequency}
                  </td>
                </tr>
                <tr><td>Commission</td>
                  <td>
                    {engineCfg.foremanCompensation.mode} · {Number(group.commissionPct)}% of {group.commissionBasis === 'CHIT_VALUE' ? 'chit value' : 'bid discount'}
                    {engineCfg.foremanCompensation.flatFeeAmount > 0 ? ` / flat ${formatCurrency(engineCfg.foremanCompensation.flatFeeAmount, currencySymbol)}` : ''}
                    {group.gstPct ? ` + GST ${Number(group.gstPct)}%` : ''}
                  </td>
                </tr>
                <tr>
                  <td>Foremen</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {(group.foremen ?? []).length > 0 ? (
                        (group.foremen ?? []).map((f: any) => (
                          <span key={f.id} className="badge badge-info" style={{ fontSize: '.72rem' }}>
                            {f.user?.name || 'Foreman'} · {f.roleLabel}{f.isPrimary ? ' ★' : ''}
                          </span>
                        ))
                      ) : group.foremanName ? (
                        <span>{group.foremanName}</span>
                      ) : (
                        <span style={{ color: 'var(--text-light)' }}>Not assigned</span>
                      )}
                      {staffUsers.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 8px', fontSize: '.72rem' }}
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
                          Manage Foremen
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                <tr><td>Dividend</td><td>{group.dividendPolicy} · {DISTRIBUTION_LABELS[group.dividendDistribution] ?? group.dividendDistribution}{group.dividendRounding ? ` · rounded to ${currencySymbol}${group.dividendRounding}` : ''}</td></tr>
                <tr><td>Default time</td><td>{group.auctionTime || 'Not set'}</td></tr>
                <tr><td>Winner interest</td><td>{group.winnerInterestType === 'NONE' ? 'None' : `${group.winnerInterestType} ${group.winnerInterestValue ?? ''} for ${group.winnerInterestPeriods ?? 0} period(s)`}</td></tr>
                <tr>
                  <td>Default &amp; security</td>
                  <td>
                    {engineCfg.defaultRules.forfeitDividendOnLate ? 'Forfeit dividend on late' : 'Keep dividend on late'} · Late fee {engineCfg.defaultRules.lateFeeType} ({engineCfg.defaultRules.lateFeeValue}) · Substitution cutoff {engineCfg.defaultRules.substitutionCutoffPct}%
                  </td>
                </tr>
                {!isDrawType && (
                  <tr><td>Bid rules</td><td>
                    Discount {group.minDiscountPct ? `${Number(group.minDiscountPct)}%` : `${Number(group.commissionPct)}% (commission floor)`} – {engineCfg.discountRules.uncapped ? 'uncapped' : group.maxDiscountPct ? `${Number(group.maxDiscountPct)}%` : 'no cap'}
                    {group.bidIncrement ? ` · step ${formatCurrency(Number(group.bidIncrement), currencySymbol)}` : ''}
                    {` · tie: ${group.tieBreakRule}`}
                  </td></tr>
                )}
                {isDrawType && (
                  <tr><td>Fixed discount</td><td>{group.fixedDiscountPct ? `${Number(group.fixedDiscountPct)}%` : 'None (full chit value prize)'}</td></tr>
                )}
                {group.hasForemanTicket && <tr><td>Foreman ticket</td><td>Period-1 prize goes to the foreman ticket without auction</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>📋 Compliance</h3></div>
          <div className="table-wrapper">
            <table>
              <tbody>
                {complianceRows.map(([label, valueNode]) => (
                  <tr key={label}><td>{label}</td><td>{valueNode}</td></tr>
                ))}
                <tr><td>Status</td><td><span className={`badge badge-${group.complianceStatus === 'active' ? 'success' : 'secondary'}`}>{group.complianceStatus}</span></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detailed Chit & Member Dividend Ledger (post-chit & live breakdown) */}
      {dividendLedger && (
        <MemberDividendLedgerPanel
          ledger={dividendLedger}
          currencySymbol={currencySymbol}
          dict={dict}
        />
      )}

      {/* ASCA / SHG Revolving Pool Transactions */}
      {engineType === 'ASCA_SHG_REVOLVING' && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header"><h3>🤝 ASCA / SHG Revolving Pool Ledger</h3></div>
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

      {/* Auctions */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0 }}>🔨 {d.auctionHistory}</h3>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>PDF Language:</span>
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
          <p style={{ padding: '16px', color: 'var(--text-secondary)' }}>{group.status === 'draft' ? 'Auctions are generated when the group is activated.' : d.noAuctions}</p>
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
                  <th>Payout</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {group.auctions.map((a: any) => (
                  <tr key={a.id}>
                    <td>Period {a.periodNumber}</td>
                    <td>
                      {formatDate(a.auctionDate)}
                      {a.scheduledAt && <div style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                    </td>
                    <td>{a.winnerMember?.customer?.name || '—'}</td>
                    <td>{a.prizeAmount ? formatCurrency(Number(a.prizeAmount), currencySymbol) : '—'}</td>
                    <td>{a.dividend ? formatCurrency(Number(a.dividend), currencySymbol) : '—'}</td>
                    <td><span className={`badge badge-${['confirmed', 'paid'].includes(a.status) ? 'success' : a.status === 'cancelled' ? 'danger' : a.status === 'in_progress' ? 'info' : 'warning'}`}>{a.status}</span></td>
                    <td>{a.winnerMemberId ? <span className={`badge badge-${a.payoutStatus === 'paid' ? 'success' : a.payoutStatus === 'ready' ? 'info' : 'warning'}`}>{a.payoutStatus}</span> : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link href={`/chits/${group.id}/auctions/${a.id}`} className="btn btn-ghost btn-sm">Manage</Link>
                      <a
                        href={`/api/chits/${group.id}/auctions/${a.id}/report?lang=${pdfLang}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ marginLeft: '4px' }}
                        title={`Download Period ${a.periodNumber} Settlement & Ledger PDF (${pdfLang})`}
                      >
                        📄 PDF
                      </a>
                      {group.auctionType === 'open_live' && (
                        <Link href={`/chits/${group.id}/auctions/${a.id}`} className="btn btn-secondary btn-sm" style={{ marginLeft: '4px' }}>Enter room</Link>
                      )}
                      {['pending', 'notice_sent'].includes(a.status) && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ marginLeft: '4px' }}
                          disabled={busy === 'reschedule'}
                          onClick={() => {
                            setRescheduleModal(a);
                            const initial = a.scheduledAt ? new Date(a.scheduledAt) : new Date(a.auctionDate);
                            const local = new Date(initial.getTime() - initial.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
                            setRescheduleValue(local);
                          }}
                        >
                          Reschedule
                        </button>
                      )}
                      {(!isBiddingEnabledForPeriod(group, a.periodNumber)) && !['confirmed', 'paid', 'cancelled'].includes(a.status) && group.status === 'active' && engineType !== 'NEED_BASED_CONSENSUS' && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ marginLeft: '4px' }}
                          disabled={busy === `draw-${a.id}`}
                          onClick={() => run(`draw-${a.id}`, () => drawAuctionWinner(a.id))}
                        >
                          {busy === `draw-${a.id}` ? 'Drawing…' : group.auctionType === 'lottery' ? 'Draw' : 'Resolve'}
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

      {/* Members */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0 }}>👥 {d.members} ({group.members.length}/{group.totalMembers})</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {customers.length > 0 && group.members.length < group.totalMembers && !['completed', 'cancelled'].includes(group.status) && (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <select
                  className="form-control"
                  value={addCustId}
                  onChange={(e) => setAddCustId(e.target.value)}
                  style={{ width: '175px', padding: '4px 8px', fontSize: '.78rem' }}
                >
                  <option value="">+ Select customer ticket</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.customerCode})</option>
                  ))}
                </select>
                <input
                  type="number"
                  className="form-control"
                  min={1}
                  max={Math.max(1, group.totalMembers - group.members.length)}
                  value={addQty}
                  onChange={(e) => setAddQty(Math.max(1, Number(e.target.value) || 1))}
                  style={{ width: '56px', padding: '4px 6px', fontSize: '.78rem' }}
                  title="Tickets to add"
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!addCustId || !!busy}
                  onClick={() => run('add-tickets', () => addChitMemberTicketsAction(group.id, addCustId, addQty))}
                >
                  {busy === 'add-tickets' ? 'Adding…' : '+ Add Ticket'}
                </button>
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
                {busy === 'verify-all-agreements' ? 'Verifying…' : '✓ Sign & Verify All Agreements'}
              </button>
            )}
          </div>
        </div>
        {group.members.length === 0 ? (
          <p style={{ padding: '16px', color: 'var(--text-secondary)' }}>{d.noMembers}</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>{d.customer}</th>
                  <th>Share</th>
                  <th>Agreement</th>
                  <th>Nominee</th>
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
                    <td>{Number(m.ticketShare) === 1 ? 'Full' : Number(m.ticketShare)}</td>
                    <td>
                      {agreementBadge(m.agreementStatus)}
                      {m.agreementStatus === 'pending' && (
                        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => run(`sign-${m.id}`, () => markChitAgreementSigned(m.id))}>Sign</button>
                      )}
                      {m.agreementStatus === 'signed' && (
                        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => run(`verify-${m.id}`, () => verifyChitAgreement(m.id))}>Verify</button>
                      )}
                    </td>
                    <td>{m.nomineeName || <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                    <td><span className={`badge badge-${m.subscriberStatus === 'active' ? 'success' : 'secondary'}`}>{m.subscriberStatus}</span></td>
                    <td>{m.hasWon ? <span className="badge badge-success">{d.won} {formatDate(m.wonAt)}</span> : <span className="badge badge-secondary">{d.pending}</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setMemberModal(m); setError(''); }}>Edit</button>
                        {group.members.length < group.totalMembers && !['completed', 'cancelled'].includes(group.status) && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '.7rem', padding: '2px 6px' }}
                            disabled={!!busy}
                            title="Add another ticket for this customer"
                            onClick={() => run(`dup-${m.id}`, () => addChitMemberTicketsAction(group.id, m.customerId, 1))}
                          >
                            +1 Ticket
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Doc 19: customer-submitted payment proofs awaiting review, scoped to this group */}
      <div className="card">
        <div className="card-header"><h3>🧾 Payment proofs</h3></div>
        <PaymentIntentsQueue chitGroupId={group.id} currencySymbol={currencySymbol} />
      </div>

      {/* Subscription Payments */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0 }}>💳 {d.memberPayments}</h3>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(['current', 'overdue', 'all'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`btn btn-sm ${subTab === tab ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSubTab(tab)}
              >
                {tab === 'current' ? 'Current' : tab === 'overdue' ? 'Overdue' : 'All'}
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
                  Period {p}
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
              All Periods
            </button>
            {selectedPeriod !== 'all' && (() => {
              const periodAuction = group.auctions.find((a: any) => Number(a.periodNumber) === selectedPeriod);
              return periodAuction ? (
                <a
                  href={`/api/chits/${group.id}/auctions/${periodAuction.id}/report`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
                >
                  📄 Period {selectedPeriod} PDF Report
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
                <th>Base</th>
                <th>{d.dividend}</th>
                <th>Penalty</th>
                <th>Net due</th>
                <th>{d.paid}</th>
                <th>Outstanding</th>
                <th>Receipt</th>
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
                    <td><span className={`badge badge-${s.status === 'paid' ? 'success' : s.status === 'missed' ? 'danger' : s.status === 'partial' ? 'warning' : 'secondary'}`}>{s.status}</span></td>
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

      {/* Payment Modal */}
      {paymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '400px', padding: '24px' }}>
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
              <input type="number" className="form-control" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} />
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
              <button className="btn btn-primary btn-sm" onClick={handleRecordPayment} disabled={loading || payAmount <= 0}>
                {loading ? d.saving : d.recordPayment}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form className="card" style={{ width: '420px', padding: '24px' }} onSubmit={handleReschedule}>
            <h3 style={{ marginBottom: '12px' }}>Reschedule period {rescheduleModal.periodNumber}</h3>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '10px', fontSize: '.85rem' }}>{error}</p>}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">New date and time</label>
              <input
                type="datetime-local"
                className="form-control"
                value={rescheduleValue}
                onChange={(e) => setRescheduleValue(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRescheduleModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy === 'reschedule'}>
                {busy === 'reschedule' ? 'Saving...' : 'Save schedule'}
              </button>
            </div>
          </form>
        </div>
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
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <select
                className="form-control"
                style={{ flex: 1, minWidth: '170px' }}
                value={pickForemanId}
                onChange={(e) => {
                  const uid = e.target.value;
                  setPickForemanId(uid);
                  const found = staffUsers.find((u) => u.id === uid);
                  if (found) {
                    setPickForemanRole(found.customRoleName || found.customRole?.name || (foremenDraft.length === 0 ? 'Primary Foreman' : 'Co-Foreman'));
                  }
                }}
              >
                <option value="">Select staff / foreman…</option>
                {staffUsers
                  .filter((u) => !foremenDraft.some((d) => d.userId === u.id))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.customRoleName || u.customRole?.name || u.role})
                    </option>
                  ))}
              </select>
              <input
                type="text"
                className="form-control"
                style={{ width: '140px' }}
                value={pickForemanRole}
                onChange={(e) => setPickForemanRole(e.target.value)}
                placeholder="Role label"
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!pickForemanId}
                onClick={() => {
                  if (!pickForemanId) return;
                  setForemenDraft((prev) => [
                    ...prev,
                    { userId: pickForemanId, roleLabel: pickForemanRole || 'Foreman', isPrimary: prev.length === 0 },
                  ]);
                  setPickForemanId('');
                }}
              >
                + Add
              </button>
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
    </>
  );
}
