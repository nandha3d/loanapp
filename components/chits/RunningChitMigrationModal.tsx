'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';
import {
  commitMigrateRunningChitAction,
  dryRunMigrateRunningChitAction,
} from '@/app/(dashboard)/[module]/chits/actions';
import type {
  MigrateRunningChitInput,
  MigrationDryRunSummary,
  RunningChitMigrationMemberInput,
} from '@/lib/chits/migrateRunningChit';
import { formatCurrency } from '@/lib/utils';

const OPEN_MIGRATION_EVENT = 'zolofund:open-chit-migration';

export function RunningChitMigrationButton({
  label = 'Import Running Chit (Mid-Cycle)',
  className = 'chits-hero-btn-glass',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      data-testid="open-running-chit-migration-btn"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_MIGRATION_EVENT))}
    >
      <span className="material-icons-outlined" style={{ fontSize: '16px' }}>upload_file</span>
      {label}
    </button>
  );
}

function makeEmptyMemberRow(index: number): RunningChitMigrationMemberInput {
  return {
    ticketNumber: String(index + 1),
    name: '',
    phone: '',
    alreadyPrized: false,
    prizedCycleNumber: null,
    historicalPrizeAmount: null,
    historicalPayoutPendingAmount: 0,
    openingArrearsAmount: 0,
    openingAdvanceAmount: 0,
    nomineeName: '',
  };
}

export default function RunningChitMigrationModal({
  currencySymbol = '₹',
}: {
  currencySymbol?: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [planLimitBlocked, setPlanLimitBlocked] = useState(false);

  // Step 1 fields
  const [name, setName] = useState('');
  const [chitValue, setChitValue] = useState(100000);
  const [totalMembers, setTotalMembers] = useState(20);
  const [monthlyContrib, setMonthlyContrib] = useState(5000);
  const [currentActiveCycle, setCurrentActiveCycle] = useState(12);
  const [commissionPct, setCommissionPct] = useState(5);
  const [auctionFrequency, setAuctionFrequency] = useState<'monthly' | 'weekly' | 'fortnightly' | 'daily'>('monthly');
  const [auctionType, setAuctionType] = useState<'open_manual' | 'open_live' | 'sealed' | 'lottery' | 'fixed_rotation'>('open_manual');
  const [chitType, setChitType] = useState<'unregistered' | 'registered'>('unregistered');
  const [stateCode, setStateCode] = useState<'TN' | 'DL' | 'GENERIC'>('TN');
  const [registrationNo, setRegistrationNo] = useState('');
  const [foremanName, setForemanName] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 11);
    return d.toISOString().slice(0, 10);
  });

  // Step 2: Member roster & opening positions
  const [members, setMembers] = useState<RunningChitMigrationMemberInput[]>(() =>
    Array.from({ length: 5 }, (_, idx) => makeEmptyMemberRow(idx)),
  );

  // Step 3: Opening balances
  const [openingCashBalance, setOpeningCashBalance] = useState(0);
  const [openingForemanCommissionBalance, setOpeningForemanCommissionBalance] = useState(0);
  const [notes, setNotes] = useState('');

  // Step 4: Dry-run validation preview
  const [dryRun, setDryRun] = useState<MigrationDryRunSummary | null>(null);

  useEffect(() => {
    const onOpen = () => {
      setIsOpen(true);
      setError('');
      setPlanLimitBlocked(false);
    };
    window.addEventListener(OPEN_MIGRATION_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_MIGRATION_EVENT, onOpen);
  }, []);

  if (!isOpen) return null;

  const buildPayload = (): MigrateRunningChitInput => ({
    name: name.trim(),
    chitValue: Number(chitValue),
    monthlyContrib: Number(monthlyContrib),
    totalMembers: Math.max(2, Math.trunc(totalMembers)),
    totalCycles: Math.max(2, Math.trunc(totalMembers)),
    currentActiveCycle: Math.max(1, Math.trunc(currentActiveCycle)),
    commissionPct: Number(commissionPct) || 5,
    auctionFrequency,
    auctionType,
    chitType,
    stateCode,
    registrationNo: registrationNo.trim() || undefined,
    foremanName: foremanName.trim() || undefined,
    startDate,
    openingCashBalance: Number(openingCashBalance) || 0,
    openingForemanCommissionBalance: Number(openingForemanCommissionBalance) || 0,
    notes: notes.trim() || undefined,
    members: members.filter((m) => m.name.trim() || m.phone.trim()),
  });

  const handleUploadSpreadsheet = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.set('kind', 'migration');
      fd.set('file', file);
      const res = await fetch('/api/chits/templates/parse', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.rows)) {
        setError(data.error || 'Could not parse migration sheet');
      } else {
        setMembers(data.rows);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Spreadsheet upload failed');
    }
    setUploading(false);
  };

  const runDryValidation = async () => {
    setBusy(true);
    setError('');
    setPlanLimitBlocked(false);
    try {
      const res = await dryRunMigrateRunningChitAction(buildPayload());
      if (res.ok) {
        setDryRun(res.summary);
        setStep(4);
      } else {
        setError(res.error || 'Dry-run validation failed');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Dry-run failed');
    }
    setBusy(false);
  };

  const handleCommit = async () => {
    setBusy(true);
    setError('');
    setPlanLimitBlocked(false);
    try {
      const res = await commitMigrateRunningChitAction(buildPayload());
      if (res.ok) {
        setIsOpen(false);
        router.push(`/chits/${res.groupId}`);
        router.refresh();
      } else {
        const resCode = 'code' in res ? (res as { code?: string }).code : undefined;
        if (resCode === 'CHIT_PLAN_LIMIT_REACHED' || String(res.error || '').toLowerCase().includes('plan allows')) {
          setPlanLimitBlocked(true);
        }
        setError(res.error || 'Failed to import running chit group');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import commit failed');
    }
    setBusy(false);
  };

  const prizedMembers = members.filter((m) => m.alreadyPrized);
  const totalArrearsPreview = members.reduce((s, m) => s + (Number(m.openingArrearsAmount) || 0), 0);
  const totalAdvancesPreview = members.reduce((s, m) => s + (Number(m.openingAdvanceAmount) || 0), 0);
  const totalPendingPrizePreview = members.reduce((s, m) => s + (Number(m.historicalPayoutPendingAmount) || 0), 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import Running Chit (Mid-Cycle)"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.62)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1250,
        padding: '16px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '960px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, var(--primary-dark, #5a195b), var(--primary, #7d287e))',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.08rem', color: '#fff' }}>
              🔄 Import Running Chit (Mid-Cycle Onboarding)
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', opacity: 0.9 }}>
              Step {step} of 4 · Move live WhatsApp / Excel chit books in at Cycle k/{totalMembers} with zero phantom dues
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              background: 'rgba(255,255,255,0.18)',
              border: 'none',
              color: '#fff',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.84rem' }}>
              {error}
              {planLimitBlocked && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span>You have reached the Free Tier limit of 1 active running chit group.</span>
                  <Link href="/subscription" className="btn btn-primary btn-sm">
                    Upgrade Plan →
                  </Link>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Chit Group Name *</label>
                <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lakshmi 1L Series-B" />
              </div>
              <div className="form-group">
                <label className="form-label">Total Chit Pot Value ({currencySymbol}) *</label>
                <input
                  type="number"
                  min={100}
                  className="form-control"
                  value={chitValue}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value));
                    setChitValue(v);
                    if (totalMembers > 0) setMonthlyContrib(Math.round(v / totalMembers));
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Total Members / Cycles (N) *</label>
                <input
                  type="number"
                  min={2}
                  max={200}
                  className="form-control"
                  value={totalMembers}
                  onChange={(e) => {
                    const n = Math.max(2, Math.trunc(Number(e.target.value) || 2));
                    setTotalMembers(n);
                    setMonthlyContrib(Math.round(chitValue / n));
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Current Active Cycle (k of N) *</label>
                <input
                  type="number"
                  min={1}
                  max={totalMembers}
                  className="form-control"
                  value={currentActiveCycle}
                  onChange={(e) => setCurrentActiveCycle(Math.max(1, Math.min(totalMembers, Math.trunc(Number(e.target.value) || 1))))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Base Monthly Installment ({currencySymbol})</label>
                <input type="number" min={1} className="form-control" value={monthlyContrib} onChange={(e) => setMonthlyContrib(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Original Start Date *</label>
                <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Foreman Commission (%)</label>
                <input type="number" step="0.1" min={0} max={25} className="form-control" value={commissionPct} onChange={(e) => setCommissionPct(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Frequency</label>
                <select className="form-control" value={auctionFrequency} onChange={(e) => setAuctionFrequency(e.target.value as 'monthly' | 'weekly' | 'fortnightly' | 'daily')}>
                  <option value="monthly">Monthly</option>
                  <option value="fortnightly">Fortnightly</option>
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Auction Format</label>
                <select className="form-control" value={auctionType} onChange={(e) => setAuctionType(e.target.value as 'open_manual' | 'open_live' | 'sealed' | 'lottery' | 'fixed_rotation')}>
                  <option value="open_manual">Open Manual</option>
                  <option value="open_live">Open Live</option>
                  <option value="sealed">Sealed</option>
                  <option value="lottery">Lottery</option>
                  <option value="fixed_rotation">Fixed Rotation</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Regulatory Type</label>
                <select className="form-control" value={chitType} onChange={(e) => setChitType(e.target.value as 'unregistered' | 'registered')}>
                  <option value="unregistered">Private / Mutual</option>
                  <option value="registered">Registered (Chit Funds Act 1982)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">State Rules</label>
                <select className="form-control" value={stateCode} onChange={(e) => setStateCode(e.target.value as 'TN' | 'DL' | 'GENERIC')}>
                  <option value="TN">Tamil Nadu (TN)</option>
                  <option value="DL">Delhi (DL)</option>
                  <option value="GENERIC">Other / Generic India</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Foreman Name (Optional)</label>
                <input className="form-control" value={foremanName} onChange={(e) => setForemanName(e.target.value)} />
              </div>
              {chitType === 'registered' && (
                <div className="form-group">
                  <label className="form-label">Registration / PSO No.</label>
                  <input className="form-control" value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} />
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.82rem' }}>
                  <strong>Download Excel Template</strong>, fill subscribers &amp; upload, or edit rows directly below.
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <a href="/api/chits/templates/migration" download="chit-running-migration-template.xlsx" className="btn btn-secondary btn-sm">
                    ⬇ Migration Template (.xlsx)
                  </a>
                  <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                    {uploading ? 'Parsing…' : '📤 Upload Filled .xlsx / .csv'}
                    <input
                      type="file"
                      accept=".xlsx,.csv"
                      style={{ display: 'none' }}
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadSpreadsheet(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setMembers((prev) => [...prev, makeEmptyMemberRow(prev.length)])}
                  >
                    + Add Row
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
                <table className="data-table" style={{ margin: 0, fontSize: '0.78rem' }}>
                  <thead>
                    <tr>
                      <th>Tkt #</th>
                      <th>Full Name *</th>
                      <th>Phone *</th>
                      <th>Prized?</th>
                      <th>Cycle</th>
                      <th>Hist. Prize</th>
                      <th>Pending Payout</th>
                      <th>Opening Arrears</th>
                      <th>Opening Advance</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m, idx) => (
                      <tr key={idx}>
                        <td>
                          <input
                            className="form-control"
                            style={{ width: '56px', padding: '4px 6px' }}
                            value={m.ticketNumber ?? ''}
                            onChange={(e) => setMembers((prev) => prev.map((r, i) => (i === idx ? { ...r, ticketNumber: e.target.value } : r)))}
                          />
                        </td>
                        <td>
                          <input
                            className="form-control"
                            style={{ minWidth: '140px', padding: '4px 6px' }}
                            value={m.name}
                            onChange={(e) => setMembers((prev) => prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)))}
                          />
                        </td>
                        <td>
                          <input
                            className="form-control"
                            style={{ width: '115px', padding: '4px 6px' }}
                            value={m.phone}
                            onChange={(e) => setMembers((prev) => prev.map((r, i) => (i === idx ? { ...r, phone: e.target.value } : r)))}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={m.alreadyPrized}
                            onChange={(e) =>
                              setMembers((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, alreadyPrized: e.target.checked } : r)),
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            max={Math.max(1, currentActiveCycle - 1)}
                            disabled={!m.alreadyPrized}
                            className="form-control"
                            style={{ width: '64px', padding: '4px 6px' }}
                            value={m.prizedCycleNumber ?? ''}
                            onChange={(e) =>
                              setMembers((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, prizedCycleNumber: e.target.value ? Number(e.target.value) : null } : r)),
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            disabled={!m.alreadyPrized}
                            className="form-control"
                            style={{ width: '88px', padding: '4px 6px' }}
                            value={m.historicalPrizeAmount ?? ''}
                            onChange={(e) =>
                              setMembers((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, historicalPrizeAmount: e.target.value ? Number(e.target.value) : null } : r)),
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            disabled={!m.alreadyPrized}
                            className="form-control"
                            style={{ width: '86px', padding: '4px 6px' }}
                            value={m.historicalPayoutPendingAmount ?? 0}
                            onChange={(e) =>
                              setMembers((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, historicalPayoutPendingAmount: Number(e.target.value) || 0 } : r)),
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            className="form-control"
                            style={{ width: '84px', padding: '4px 6px' }}
                            value={m.openingArrearsAmount ?? 0}
                            onChange={(e) =>
                              setMembers((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, openingArrearsAmount: Number(e.target.value) || 0 } : r)),
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            className="form-control"
                            style={{ width: '84px', padding: '4px 6px' }}
                            value={m.openingAdvanceAmount ?? 0}
                            onChange={(e) =>
                              setMembers((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, openingAdvanceAmount: Number(e.target.value) || 0 } : r)),
                              )
                            }
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setMembers((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Opening Cash in Pool ({currencySymbol})</label>
                  <input
                    type="number"
                    min={0}
                    className="form-control"
                    value={openingCashBalance}
                    onChange={(e) => setOpeningCashBalance(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Earned Foreman Commission Carried Forward ({currencySymbol})</label>
                  <input
                    type="number"
                    min={0}
                    className="form-control"
                    value={openingForemanCommissionBalance}
                    onChange={(e) => setOpeningForemanCommissionBalance(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Migration Notes / Legacy Book Reference</label>
                  <input className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Imported from Ledger Book #4" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '10px', background: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Historical Closed Cycles</div>
                  <strong>1 to {Math.max(0, currentActiveCycle - 1)}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Prized Subscribers Marked</div>
                  <strong>{prizedMembers.length}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Opening Arrears (Cycle k-1)</div>
                  <strong style={{ color: '#b45309' }}>{formatCurrency(totalArrearsPreview, currencySymbol)}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Opening Advances (Cycle k)</div>
                  <strong style={{ color: '#047857' }}>{formatCurrency(totalAdvancesPreview, currencySymbol)}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Pending Winner Payouts</div>
                  <strong style={{ color: 'var(--primary-dark, var(--primary))' }}>{formatCurrency(totalPendingPrizePreview, currencySymbol)}</strong>
                </div>
              </div>
            </div>
          )}

          {step === 4 && dryRun && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dryRun.warnings.length > 0 && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: '0.82rem' }}>
                  <strong>Warnings:</strong>
                  <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                    {dryRun.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {!dryRun.valid ? (
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.84rem' }}>
                  <strong>Fix validation errors before importing:</strong>
                  <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                    {dryRun.errors.map((errMsg, i) => <li key={i}>{errMsg}</li>)}
                  </ul>
                </div>
              ) : (
                <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
                  <strong>✓ Dry-Run Reconciliation Passed</strong>
                  <div style={{ marginTop: '6px', fontSize: '0.82rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '6px' }}>
                    <span>Active Cycle: <strong>#{dryRun.currentActiveCycle} / {dryRun.totalMembers}</strong></span>
                    <span>Historical Closed: <strong>{dryRun.historicalCyclesCount}</strong></span>
                    <span>Subscribers Ready: <strong>{dryRun.enrolledMembersCount}</strong></span>
                    <span>Arrears to Carry: <strong>{formatCurrency(dryRun.totalOpeningArrears, currencySymbol)}</strong></span>
                    <span>Advances Credited: <strong>{formatCurrency(dryRun.totalOpeningAdvances, currencySymbol)}</strong></span>
                    <span>Pending Prize Payout: <strong>{formatCurrency(dryRun.totalHistoricalPayoutPending, currencySymbol)}</strong></span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => (step === 1 ? setIsOpen(false) : setStep((s) => (s - 1) as 1 | 2 | 3 | 4))}
            disabled={busy}
          >
            {step === 1 ? 'Cancel' : '← Back'}
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {step < 3 && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setError('');
                  if (step === 1 && (!name.trim() || chitValue <= 0)) {
                    setError('Enter group name and positive pot value.');
                    return;
                  }
                  setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
                }}
              >
                Next →
              </button>
            )}
            {step === 3 && (
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={runDryValidation}>
                {busy ? 'Validating…' : 'Validate & Preview Reconciliation →'}
              </button>
            )}
            {step === 4 && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy || !dryRun?.valid}
                onClick={handleCommit}
              >
                {busy ? 'Importing Group…' : '✓ Confirm & Activate Running Chit'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
