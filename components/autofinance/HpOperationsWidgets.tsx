'use client';

/**
 * Auto Finance staff dashboard widgets: today's due list with quick actions,
 * promise-to-pay follow-ups, an EMI calculator and the day-closing gate.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';
import Modal from '@/components/Modal';
import { calculateHpQuote } from '@/lib/autofinance/hp';
import { closeBusinessDay, logCustomerCall } from '@/app/(dashboard)/[module]/operations/actions';

export type DueRow = {
  loanId: string;
  loanCode: string;
  customerId: string;
  customerName: string;
  phone: string;
  registrationNo: string | null;
  dueAmount: number;
  outstanding: number;
  daysOverdue: number;
};

export type PromiseRow = {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  loanCode: string | null;
  promisedDate: string;
  promisedAmount: number | null;
  remarks: string | null;
  overdue: boolean;
};

export type ClosingSnapshot = {
  businessDate: string;
  alreadyClosed: boolean;
  openingCash: number;
  collectedCash: number;
  disbursedCash: number;
  expectedClosing: number;
  receiptCount: number;
};

export default function HpOperationsWidgets({
  dueToday,
  promises,
  closing,
  gateBlocked,
  gateMessage,
  currencySymbol,
}: {
  dueToday: DueRow[];
  promises: PromiseRow[];
  closing: ClosingSnapshot | null;
  gateBlocked: boolean;
  gateMessage: string | null;
  currencySymbol: string;
}) {
  const router = useRouter();
  const [dueOpen, setDueOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [remarkFor, setRemarkFor] = useState<DueRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const money = (n: number) => `${currencySymbol}${Math.round(n).toLocaleString('en-IN')}`;
  const totalDue = dueToday.reduce((s, r) => s + r.outstanding, 0);
  const promisedTotal = promises.reduce((s, p) => s + (p.promisedAmount ?? 0), 0);

  return (
    <>
      {gateBlocked && (
        <div className="card" style={{ background: 'var(--danger-bg, #fee2e2)', border: '1px solid var(--danger)', marginBottom: '16px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <strong style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>lock_clock</span>
            {gateMessage}
          </strong>
          <button className="btn btn-danger btn-sm" onClick={() => setCloseOpen(true)}>Close the day now</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginBottom: '20px' }}>
        {/* Today's due list */}
        <div className="card">
          <div className="card-header">
            <h3>📅 Today&apos;s Due List</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setDueOpen(true)}>View all</button>
          </div>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
            <div><div className="kpi-value">{dueToday.length}</div><div className="kpi-label">accounts</div></div>
            <div><div className="kpi-value">{money(totalDue)}</div><div className="kpi-label">to collect</div></div>
          </div>
          {dueToday.slice(0, 4).map((r) => (
            <DueLine key={r.loanId} row={r} money={money} onRemark={() => setRemarkFor(r)} />
          ))}
          {dueToday.length === 0 && <p style={{ color: 'var(--text-light)', fontSize: '.85rem' }}>Nothing due today.</p>}
        </div>

        {/* Promised customers */}
        <div className="card">
          <div className="card-header"><h3>🤝 Promised Customers</h3></div>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
            <div><div className="kpi-value">{promises.length}</div><div className="kpi-label">promises</div></div>
            <div><div className="kpi-value">{money(promisedTotal)}</div><div className="kpi-label">promised</div></div>
          </div>
          {promises.length === 0 ? (
            <p style={{ color: 'var(--text-light)', fontSize: '.85rem' }}>No open promise-to-pay records.</p>
          ) : promises.slice(0, 5).map((p) => (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
              padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '.82rem',
            }}>
              <div>
                <strong>{p.customerName}</strong>
                {p.loanCode && <span style={{ color: 'var(--text-light)' }}> · {p.loanCode}</span>}
                <div style={{ color: p.overdue ? 'var(--danger)' : 'var(--text-secondary)', fontSize: '.75rem' }}>
                  {p.overdue ? 'Promise broken' : 'Promised'} {p.promisedDate}
                  {p.promisedAmount ? ` · ${money(p.promisedAmount)}` : ''}
                </div>
              </div>
              <a href={`tel:${p.phone}`} className="btn btn-ghost btn-sm">Call</a>
            </div>
          ))}
        </div>

        {/* EMI calculator + day closing */}
        <div className="card">
          <div className="card-header"><h3>🧮 Quick Tools</h3></div>
          <div style={{ display: 'grid', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={() => setCalcOpen(true)}>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>calculate</span> EMI Calculator
            </button>
            <button className="btn btn-secondary" onClick={() => setCloseOpen(true)} disabled={closing?.alreadyClosed}>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>event_available</span>
              {closing?.alreadyClosed ? 'Day already closed' : 'Day Closing'}
            </button>
            <Link href="/pending-tasks" className="btn btn-secondary">
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>fact_check</span> Pending Tasks
            </Link>
          </div>
          {closing && (
            <div style={{ marginTop: '12px', fontSize: '.78rem', color: 'var(--text-secondary)', display: 'grid', gap: '3px' }}>
              <span>Collected today <strong>{money(closing.collectedCash)}</strong> ({closing.receiptCount} receipts)</span>
              <span>Disbursed today <strong>{money(closing.disbursedCash)}</strong></span>
              <span>Expected cash <strong>{money(closing.expectedClosing)}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* ── Full due list ─────────────────────────────────────────────── */}
      <Modal isOpen={dueOpen} onClose={() => setDueOpen(false)} title="Today's Due List">
        <div className="table-wrapper" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <table>
            <thead><tr><th>Customer</th><th>Vehicle</th><th className="r">Due</th><th>Overdue</th><th></th></tr></thead>
            <tbody>
              {dueToday.map((r) => (
                <tr key={r.loanId} style={r.daysOverdue > 0 ? { background: 'var(--danger-bg, #fee2e2)' } : undefined}>
                  <td><strong>{r.customerName}</strong><br /><span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{r.loanCode}</span></td>
                  <td>{r.registrationNo ?? '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(r.outstanding)}</td>
                  <td>{r.daysOverdue > 0 ? `${r.daysOverdue}d` : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <a href={`tel:${r.phone}`} className="btn btn-ghost btn-sm">Call</a>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setDueOpen(false); setRemarkFor(r); }}>Remark</button>
                    <Link href={`/loans/${r.loanCode}`} className="btn btn-ghost btn-sm">Ledger</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* ── Remark + promise ──────────────────────────────────────────── */}
      <Modal isOpen={Boolean(remarkFor)} onClose={() => setRemarkFor(null)} title={`Log call — ${remarkFor?.customerName ?? ''}`}>
        {remarkFor && (
          <form action={async (fd: FormData) => {
            setBusy(true); setError(null);
            const result = await logCustomerCall(fd);
            setBusy(false);
            if (result?.error) setError(result.error);
            else { setRemarkFor(null); router.refresh(); }
          }}>
            <input type="hidden" name="customerId" value={remarkFor.customerId} />
            <input type="hidden" name="loanId" value={remarkFor.loanId} />
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Channel</label>
                <select name="channel" className="form-control" defaultValue="call">
                  <option value="call">Call</option>
                  <option value="visit">Visit</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Outcome</label>
                <select name="outcome" className="form-control" defaultValue="promised">
                  <option value="promised">Promised to pay</option>
                  <option value="no_answer">No answer</option>
                  <option value="refused">Refused</option>
                  <option value="wrong_number">Wrong number</option>
                  <option value="paid">Already paid</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Next Promise Date</label>
                <input name="promisedDate" type="date" className="form-control" />
              </div>
              <div className="form-group">
                <label className="form-label">Promised Amount ({currencySymbol})</label>
                <input name="promisedAmount" type="number" min="0" step="0.01" className="form-control"
                  defaultValue={Math.round(remarkFor.outstanding)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Remarks</label>
              <textarea name="remarks" className="form-control" rows={3} />
            </div>
            {error && <div style={{ color: 'var(--danger)', fontSize: '.82rem', marginBottom: '10px' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setRemarkFor(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        )}
      </Modal>

      <EmiCalculatorModal isOpen={calcOpen} onClose={() => setCalcOpen(false)} currencySymbol={currencySymbol} />

      {/* ── Day closing ───────────────────────────────────────────────── */}
      <Modal isOpen={closeOpen} onClose={() => setCloseOpen(false)} title="Day Closing">
        {!closing ? <p>Nothing to close.</p> : (
          <form action={async (fd: FormData) => {
            setBusy(true); setError(null);
            const result = await closeBusinessDay(fd);
            setBusy(false);
            if (result?.error) setError(result.error);
            else { setCloseOpen(false); router.refresh(); }
          }}>
            <input type="hidden" name="businessDate" value={closing.businessDate} />
            <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', marginBottom: '14px', fontSize: '.84rem', display: 'grid', gap: '4px' }}>
              <span>Business date <strong>{closing.businessDate}</strong></span>
              <span>Collected <strong>{money(closing.collectedCash)}</strong> across {closing.receiptCount} receipts</span>
              <span>Disbursed <strong>{money(closing.disbursedCash)}</strong></span>
              <span>Expected closing cash <strong>{money(closing.expectedClosing)}</strong></span>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Opening Cash ({currencySymbol})</label>
                <input name="openingCash" type="number" min="0" step="0.01" className="form-control" defaultValue={closing.openingCash} />
              </div>
              <div className="form-group">
                <label className="form-label">Cash Counted ({currencySymbol}) *</label>
                <input name="countedClosing" type="number" min="0" step="0.01" className="form-control" required defaultValue={closing.expectedClosing} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Remarks</label>
              <textarea name="remarks" className="form-control" rows={2} placeholder="Explain any variance" />
            </div>
            {error && <div style={{ color: 'var(--danger)', fontSize: '.82rem', marginBottom: '10px' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setCloseOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Closing…' : 'Close Day'}</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

function DueLine({ row, money, onRemark }: { row: DueRow; money: (n: number) => string; onRemark: () => void }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
      padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '.82rem',
    }}>
      <div>
        <strong>{row.customerName}</strong>
        <div style={{ color: row.daysOverdue > 0 ? 'var(--danger)' : 'var(--text-secondary)', fontSize: '.75rem' }}>
          {row.registrationNo ?? row.loanCode}
          {row.daysOverdue > 0 && ` · ${row.daysOverdue}d overdue`}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <strong>{money(row.outstanding)}</strong>
        <a href={`tel:${row.phone}`} className="btn btn-ghost btn-sm" title="Call">
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>call</span>
        </a>
        <button className="btn btn-ghost btn-sm" onClick={onRemark} title="Add remark">
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>edit_note</span>
        </button>
      </div>
    </div>
  );
}

function EmiCalculatorModal({
  isOpen, onClose, currencySymbol,
}: { isOpen: boolean; onClose: () => void; currencySymbol: string }) {
  const [value, setValue] = useState('100000');
  const [down, setDown] = useState('20000');
  const [rate, setRate] = useState('12');
  const [months, setMonths] = useState('24');
  const [method, setMethod] = useState<'flat' | 'diminishing'>('flat');
  const [roundOff, setRoundOff] = useState(true);

  const quote = useMemo(() => {
    try {
      return calculateHpQuote({
        vehicleValue: Number(value),
        downPayment: Number(down) || 0,
        interestRate: Number(rate),
        interestMethod: method,
        tenureMonths: Number(months),
        roundOffEmi: roundOff,
      });
    } catch {
      return null;
    }
  }, [value, down, rate, months, method, roundOff]);

  const money = (n: number) => `${currencySymbol}${Math.round(n).toLocaleString('en-IN')}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="EMI Calculator">
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Vehicle Value</label>
          <input type="number" className="form-control" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Down Payment</label>
          <input type="number" className="form-control" value={down} onChange={(e) => setDown(e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Rate (% p.a.)</label>
          <input type="number" step="0.01" className="form-control" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Tenure (months)</label>
          <input type="number" className="form-control" value={months} onChange={(e) => setMonths(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Method</label>
          <select className="form-control" value={method}
            onChange={(e) => setMethod(e.target.value === 'diminishing' ? 'diminishing' : 'flat')}>
            <option value="flat">Flat</option>
            <option value="diminishing">Diminishing</option>
          </select>
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 16px', cursor: 'pointer' }}>
        <input type="checkbox" checked={roundOff} onChange={(e) => setRoundOff(e.target.checked)} />
        <span>Round off EMI</span>
      </label>

      {quote ? (
        <div className="kpi-grid">
          <div><div className="kpi-label">Financed</div><div className="kpi-value">{money(quote.principal)}</div></div>
          <div><div className="kpi-label">Interest</div><div className="kpi-value">{money(quote.totalInterest)}</div></div>
          <div><div className="kpi-label">Total Payable</div><div className="kpi-value">{money(quote.totalPayable)}</div></div>
          <div><div className="kpi-label">Monthly EMI</div><div className="kpi-value" style={{ color: 'var(--primary)' }}>{money(quote.emi)}</div></div>
        </div>
      ) : (
        <p style={{ color: 'var(--text-light)' }}>Enter valid figures to see the EMI.</p>
      )}
    </Modal>
  );
}
