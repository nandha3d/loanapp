'use client';

/**
 * Auto Finance Customer 360° panel.
 *
 * Four tabs over one HP account — the due chart (with dynamic split rows for
 * partial payments), guarantors, asset photos, and printable documents — plus
 * the bulk-allocation EMI receipt modal.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { buildLedgerRows, summarizeLedger, type LedgerInstalment } from '@/lib/autofinance/ledger';
import { previewHpReceipt, recordHpReceipt } from './hpReceiptActions';

type Guarantor = {
  id: string; name: string; phone: string; relation: string | null;
  address: string | null; photo: string | null;
};
type Photo = { id: string; kind: string; path: string; caption: string | null };

type PlanLine = {
  instalmentId: string; instalmentNo: number; dueDate: string;
  bucket: 'penalty' | 'due'; overdue: boolean;
  outstandingBefore: number; applied: number; outstandingAfter: number; cleared: boolean;
};

const TABS = [
  { id: 'ledger', label: 'Due Chart', icon: 'table_rows' },
  { id: 'guarantors', label: 'Guarantors', icon: 'groups' },
  { id: 'assets', label: 'Asset Photos', icon: 'photo_library' },
  { id: 'prints', label: 'Documents & Prints', icon: 'print' },
] as const;

const TONE_STYLES: Record<string, { background: string; color?: string }> = {
  // White = settled, red = overdue, green = upcoming.
  paid: { background: 'transparent' },
  overdue: { background: 'var(--danger-bg, #fee2e2)', color: 'var(--danger)' },
  upcoming: { background: 'var(--success-bg, #dcfce7)' },
};

export default function HpCustomer360({
  loanId,
  loanCode,
  registrationNo,
  instalments,
  guarantors,
  photos,
  rcDocPath,
  currencySymbol,
  canRecordReceipt,
  formatDate,
}: {
  loanId: string;
  loanCode: string;
  registrationNo: string | null;
  instalments: LedgerInstalment[];
  guarantors: Guarantor[];
  photos: Photo[];
  rcDocPath: string | null;
  currencySymbol: string;
  canRecordReceipt: boolean;
  formatDate: (d: Date | string | null) => string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('ledger');
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [penaltyOverride, setPenaltyOverride] = useState('');
  const [plan, setPlan] = useState<{ lines: PlanLine[]; duePaid: number; penaltyPaid: number; unapplied: number; instalmentsCleared: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const rows = useMemo(() => buildLedgerRows(instalments), [instalments]);
  const totals = useMemo(() => summarizeLedger(rows), [rows]);
  const money = (n: number) => `${currencySymbol}${Math.round(n).toLocaleString('en-IN')}`;

  async function refreshPreview() {
    const value = Number(amount);
    if (!value || value <= 0) { setPlan(null); return; }
    setBusy(true);
    const result = await previewHpReceipt(
      loanId,
      value,
      penaltyOverride === '' ? undefined : Number(penaltyOverride),
    );
    setBusy(false);
    if ('error' in result) { setError(result.error ?? 'Preview failed'); setPlan(null); }
    else { setError(null); setPlan(result.plan as any); }
  }

  return (
    <div className="card" style={{ marginTop: '20px' }}>
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
        <h3>📇 Customer 360° — {registrationNo || loanCode}</h3>
        {canRecordReceipt && (
          <button className="btn btn-primary btn-sm" onClick={() => { setReceiptOpen(true); setDone(null); }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>receipt</span> EMI Receipt
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', marginBottom: '16px', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '.82rem', fontWeight: 700,
              color: tab === t.id ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: `2px solid ${tab === t.id ? 'var(--primary)' : 'transparent'}`,
              marginBottom: '-1px',
            }}>
            <span className="material-icons-outlined" style={{ fontSize: '17px' }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Due chart ─────────────────────────────────────────── */}
      {tab === 'ledger' && (
        <div>
          <div className="kpi-grid" style={{ marginBottom: '16px' }}>
            <Stat label="Collected" value={money(totals.totalPaid)} />
            <Stat label="Overdue" value={money(totals.totalOverdue)} tone="danger" />
            <Stat label="Upcoming" value={money(totals.totalUpcoming)} />
            <Stat label="Penalty Due" value={money(totals.totalPenalty)} tone="danger" />
          </div>

          <div style={{ display: 'flex', gap: '16px', fontSize: '.72rem', color: 'var(--text-secondary)', marginBottom: '10px', flexWrap: 'wrap' }}>
            <Legend swatch="transparent" label="Paid" bordered />
            <Legend swatch="var(--danger-bg, #fee2e2)" label="Overdue" />
            <Legend swatch="var(--success-bg, #dcfce7)" label="Upcoming" />
            <span>Partially paid instalments split into two rows.</span>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Due Date</th><th>Receipt No</th><th>Paid Date</th>
                  <th style={{ textAlign: 'right' }}>Principal</th>
                  <th style={{ textAlign: 'right' }}>Interest</th>
                  <th style={{ textAlign: 'right' }}>Penalty</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-light)' }}>No instalments.</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.key} style={TONE_STYLES[r.tone]}>
                    <td>
                      {r.instalmentNo}
                      {r.isSplit && (
                        <span className="badge badge-secondary" style={{ marginLeft: '6px', fontSize: '.6rem' }}>
                          {r.segment === 'paid' ? 'part paid' : 'balance'}
                        </span>
                      )}
                    </td>
                    <td>{formatDate(r.dueDate)}</td>
                    <td>{r.receiptNo || '—'}</td>
                    <td>{r.paidDate ? formatDate(r.paidDate) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{r.principal ? money(r.principal) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{r.interest ? money(r.interest) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{r.penalty ? money(r.penalty) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(r.amount)}</td>
                    <td style={{ textAlign: 'right' }}>{money(r.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 2: Guarantors ────────────────────────────────────────── */}
      {tab === 'guarantors' && (
        guarantors.length === 0 ? (
          <p style={{ color: 'var(--text-light)' }}>No guarantors recorded for this customer.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {guarantors.map((g) => (
              <div key={g.id} className="card" style={{ padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {g.photo
                    ? <img src={g.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span className="material-icons-outlined" style={{ color: 'var(--text-light)' }}>person</span>}
                </div>
                <div style={{ fontSize: '.82rem' }}>
                  <strong>{g.name}</strong>
                  <div style={{ color: 'var(--text-secondary)' }}>{g.phone}</div>
                  {g.relation && <div style={{ color: 'var(--text-light)' }}>{g.relation}</div>}
                  {g.address && <div style={{ color: 'var(--text-light)', fontSize: '.74rem' }}>{g.address}</div>}
                  <a href={`tel:${g.phone}`} className="btn btn-ghost btn-sm" style={{ padding: '2px 0', color: 'var(--primary)' }}>Call</a>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Tab 3: Asset photos ──────────────────────────────────────── */}
      {tab === 'assets' && (
        (photos.length === 0 && !rcDocPath) ? (
          <p style={{ color: 'var(--text-light)' }}>No asset photos or RC book uploaded.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {rcDocPath && (
              <a href={rcDocPath} target="_blank" rel="noreferrer" className="card" style={{ padding: '12px', textAlign: 'center' }}>
                <span className="material-icons-outlined" style={{ fontSize: '40px', color: 'var(--primary)' }}>description</span>
                <div style={{ fontSize: '.8rem', fontWeight: 700 }}>RC Book</div>
              </a>
            )}
            {photos.map((p) => (
              <a key={p.id} href={p.path} target="_blank" rel="noreferrer" className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <img src={p.path} alt={p.caption || p.kind} style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                <div style={{ padding: '8px 10px', fontSize: '.76rem' }}>
                  <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{p.kind}</span>
                  {p.caption && <div style={{ color: 'var(--text-light)', marginTop: '4px' }}>{p.caption}</div>}
                </div>
              </a>
            ))}
          </div>
        )
      )}

      {/* ── Tab 4: Prints ────────────────────────────────────────────── */}
      {tab === 'prints' && (
        <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {[
            { doc: 'ledger-sheet', icon: 'receipt_long', title: 'Legal Ledger Sheet', desc: 'Full due chart for filing.' },
            { doc: 'due-card', icon: 'badge', title: 'Due Card (Pocket)', desc: 'Customer pocket card.' },
            { doc: 'seizing-letter', icon: 'gavel', title: 'Seizing Letter', desc: 'Pre-seizure legal notice.' },
            { doc: 'noc', icon: 'verified', title: 'NOC', desc: 'Issued on full closure.' },
          ].map((d) => (
            <a key={d.doc}
              href={`/api/v1/loans/${loanId}/print/${d.doc}`}
              target="_blank" rel="noreferrer"
              className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <span className="material-icons-outlined" style={{ fontSize: '32px', color: 'var(--primary)' }}>{d.icon}</span>
              <div style={{ fontWeight: 700, fontSize: '.86rem', marginTop: '6px' }}>{d.title}</div>
              <div style={{ fontSize: '.74rem', color: 'var(--text-light)' }}>{d.desc}</div>
            </a>
          ))}
        </div>
      )}

      {/* ── EMI receipt modal ────────────────────────────────────────── */}
      <Modal isOpen={receiptOpen} onClose={() => setReceiptOpen(false)} title={`EMI Receipt — ${loanCode}`}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--success, #16a34a)' }}>check_circle</span>
            <h4 style={{ margin: '10px 0' }}>Receipt {done} recorded</h4>
            <button className="btn btn-primary" onClick={() => { setReceiptOpen(false); router.refresh(); }}>Done</button>
          </div>
        ) : (
          <form action={async (fd: FormData) => {
            setBusy(true); setError(null);
            const result = await recordHpReceipt(fd);
            setBusy(false);
            if (result?.error) setError(result.error);
            else { setDone(result.receiptNo ?? 'OK'); router.refresh(); }
          }}>
            <input type="hidden" name="loanId" value={loanId} />
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Amount Paid ({currencySymbol}) *</label>
                <input name="amount" type="number" min="1" step="0.01" className="form-control" required
                  value={amount} onChange={(e) => setAmount(e.target.value)} onBlur={refreshPreview} />
              </div>
              <div className="form-group">
                <label className="form-label">Penalty Override ({currencySymbol})</label>
                <input name="penaltyOverride" type="number" min="0" step="0.01" className="form-control"
                  value={penaltyOverride} onChange={(e) => setPenaltyOverride(e.target.value)} onBlur={refreshPreview}
                  placeholder={String(totals.totalPenalty)} />
                <small style={{ color: 'var(--text-light)' }}>Blank = charge accrued penalty. 0 = waive.</small>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Mode</label>
                <select name="paymentMode" className="form-control" defaultValue="cash">
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input name="paymentDate" type="date" className="form-control" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="form-group">
                <label className="form-label">Reference</label>
                <input name="referenceNumber" className="form-control" />
              </div>
            </div>

            {/* Waterfall preview */}
            <div style={{ margin: '14px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '.85rem' }}>Allocation preview</strong>
                <button type="button" className="btn btn-ghost btn-sm" onClick={refreshPreview} disabled={busy}>
                  {busy ? 'Calculating…' : 'Recalculate'}
                </button>
              </div>
              {!plan ? (
                <p style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>
                  Enter an amount to see which instalments and penalties it clears.
                </p>
              ) : (
                <>
                  <div className="table-wrapper" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr><th>#</th><th>Due Date</th><th>Head</th><th style={{ textAlign: 'right' }}>Owed</th><th style={{ textAlign: 'right' }}>Applied</th><th>Result</th></tr>
                      </thead>
                      <tbody>
                        {plan.lines.filter((l) => l.applied > 0).map((l, i) => (
                          <tr key={`${l.instalmentId}-${l.bucket}-${i}`} style={l.overdue ? TONE_STYLES.overdue : undefined}>
                            <td>{l.instalmentNo}</td>
                            <td>{formatDate(l.dueDate)}</td>
                            <td style={{ textTransform: 'capitalize' }}>{l.bucket}</td>
                            <td style={{ textAlign: 'right' }}>{money(l.outstandingBefore)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(l.applied)}</td>
                            <td>
                              <span className={`badge badge-${l.cleared ? 'success' : 'warning'}`}>
                                {l.cleared ? 'cleared' : `${money(l.outstandingAfter)} left`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '10px', fontSize: '.8rem' }}>
                    <span>Dues <strong>{money(plan.duePaid)}</strong></span>
                    <span>Penalty <strong>{money(plan.penaltyPaid)}</strong></span>
                    <span>Instalments cleared <strong>{plan.instalmentsCleared}</strong></span>
                    {plan.unapplied > 0 && (
                      <span style={{ color: 'var(--warning, #d97706)' }}>Advance <strong>{money(plan.unapplied)}</strong></span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Remarks</label>
              <input name="remarks" className="form-control" />
            </div>

            {error && <div style={{ color: 'var(--danger)', fontSize: '.82rem', marginBottom: '10px' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setReceiptOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy || !amount}>
                {busy ? 'Saving…' : 'Confirm Receipt'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <div className="kpi-card">
      <div>
        <div className="kpi-value" style={tone === 'danger' ? { color: 'var(--danger)' } : undefined}>{value}</div>
        <div className="kpi-label">{label}</div>
      </div>
    </div>
  );
}

function Legend({ swatch, label, bordered }: { swatch: string; label: string; bordered?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <span style={{
        width: '14px', height: '14px', borderRadius: '3px', background: swatch,
        border: bordered ? '1px solid var(--border)' : 'none', display: 'inline-block',
      }} />
      {label}
    </span>
  );
}
