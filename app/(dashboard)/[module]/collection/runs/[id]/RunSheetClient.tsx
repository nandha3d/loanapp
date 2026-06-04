'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';
import { collectRunAction, closeRunAction, reconcileRunAction } from '../../runActions';

type SheetRow = {
  stopSeq: number;
  customerId: string;
  name: string;
  customerCode: string | null;
  loanCode: string;
  instalmentId: string;
  instalmentNo: number;
  outstanding: number;
  overdue: boolean;
  daysOverdue: number;
};
type Run = {
  id: string;
  status: string;
  date: string;
  expectedTotal: number;
  collectedTotal: number;
  cashCollected: number;
  digitalCollected: number;
  stopsExpected: number;
  stopsCollected: number;
  cashDeposited: number | null;
  varianceAmount: number | null;
};

const inr = (n: number) => '₹' + n.toLocaleString('en-IN');

export default function RunSheetClient({
  run,
  sheet,
  backPath,
}: {
  run: Run;
  sheet: SheetRow[];
  backPath: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(sheet.map((r) => [r.instalmentId, ''])),
  );
  const [modes, setModes] = useState<Record<string, string>>(() =>
    Object.fromEntries(sheet.map((r) => [r.instalmentId, 'cash'])),
  );
  const [deposit, setDeposit] = useState('');
  const locked = run.status === 'closed' || run.status === 'reconciled';

  const stagedTotal = useMemo(
    () => Object.values(amounts).reduce((s, v) => s + (Number(v) || 0), 0),
    [amounts],
  );

  function fillAllSuggested() {
    setAmounts(Object.fromEntries(sheet.map((r) => [r.instalmentId, String(r.outstanding)])));
  }

  function submitBatch() {
    const lines = sheet
      .map((r) => ({
        instalmentId: r.instalmentId,
        receivedAmount: Number(amounts[r.instalmentId]) || 0,
        paymentMode: modes[r.instalmentId] || 'cash',
      }))
      .filter((l) => l.receivedAmount > 0);
    if (lines.length === 0) { setMsg('Enter at least one amount.'); return; }
    setMsg(null);
    start(async () => {
      const res = await collectRunAction(run.id, lines);
      if (res.success && 'posted' in res) {
        const skipped = res.skipped.length;
        setMsg(`Posted ${res.posted.length} collection(s)${skipped ? `, ${skipped} skipped` : ''}.`);
        router.refresh();
      } else setMsg(('error' in res && res.error) || 'Failed');
    });
  }

  function doClose() {
    start(async () => {
      const res = await closeRunAction(run.id);
      setMsg(res.success ? 'Run closed. Reconcile the cash below.' : res.error ?? 'Failed');
      router.refresh();
    });
  }

  function doReconcile() {
    const amt = Number(deposit);
    if (!Number.isFinite(amt) || amt < 0) { setMsg('Enter deposit amount.'); return; }
    start(async () => {
      const res = await reconcileRunAction(run.id, amt);
      if (res.success) {
        setMsg(res.variance === 0 ? 'Reconciled — exact match.' : `Reconciled with variance ${inr(res.variance ?? 0)} (approval raised).`);
        router.refresh();
      } else setMsg(res.error ?? 'Failed');
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: 20 }}>
        <Link href="/collection/runs" className="btn btn-sm" style={{ marginBottom: 12 }}>← All runs</Link>
        <h2 style={{ margin: '0 0 4px' }}>Run · {run.date}</h2>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 12 }}>
          <Stat label="Status" value={run.status} />
          <Stat label="Expected" value={inr(run.expectedTotal)} />
          <Stat label="Collected" value={inr(run.collectedTotal)} />
          <Stat label="Cash" value={inr(run.cashCollected)} />
          <Stat label="Digital" value={inr(run.digitalCollected)} />
          <Stat label="Stops" value={`${run.stopsCollected}/${run.stopsExpected}`} />
        </div>
      </div>

      {msg && <div className="card" style={{ padding: 12, fontSize: 14 }}>{msg}</div>}

      {!locked && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14 }}>
            <strong>Collection sheet ({sheet.length} due)</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" onClick={fillAllSuggested} disabled={pending}>Fill suggested</button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'center' }}>
                Staged: {inr(stagedTotal)}
              </span>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={th}>#</th>
                <th style={th}>Customer</th>
                <th style={th}>Loan</th>
                <th style={th}>Due</th>
                <th style={th}>Amount</th>
                <th style={th}>Mode</th>
              </tr>
            </thead>
            <tbody>
              {sheet.length === 0 && <tr><td style={td} colSpan={6}>Nothing due on this route.</td></tr>}
              {sheet.map((r) => (
                <tr key={r.instalmentId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>{r.stopSeq === 9999 ? '–' : r.stopSeq}</td>
                  <td style={td}>
                    {r.name}
                    {r.overdue && (
                      <span style={{ marginLeft: 6, color: '#dc2626', fontSize: 12 }}>
                         overdue {r.daysOverdue}d
                      </span>
                    )}
                  </td>
                  <td style={td}>{r.loanCode} · #{r.instalmentNo}</td>
                  <td style={td}>{inr(r.outstanding)}</td>
                  <td style={td}>
                    <input
                      className="form-control"
                      type="number"
                      inputMode="decimal"
                      value={amounts[r.instalmentId] ?? ''}
                      placeholder="0"
                      style={{ width: 100 }}
                      onChange={(e) => setAmounts((a) => ({ ...a, [r.instalmentId]: e.target.value }))}
                    />
                  </td>
                  <td style={td}>
                    <select
                      className="form-control"
                      value={modes[r.instalmentId] ?? 'cash'}
                      style={{ width: 100 }}
                      onChange={(e) => setModes((m) => ({ ...m, [r.instalmentId]: e.target.value }))}
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8, padding: 14, justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={submitBatch} disabled={pending || sheet.length === 0}>
              {pending ? 'Posting…' : `Collect (${inr(stagedTotal)})`}
            </button>
            <button className="btn" onClick={doClose} disabled={pending}>Close run</button>
          </div>
        </div>
      )}

      {(run.status === 'closed' || run.status === 'reconciled') && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>Cash reconciliation</h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Cash collected this run: <strong>{inr(run.cashCollected)}</strong>
          </p>
          {run.status === 'reconciled' ? (
            <p style={{ fontSize: 14 }}>
              Deposited {inr(run.cashDeposited ?? 0)} · variance{' '}
              <strong style={{ color: (run.varianceAmount ?? 0) === 0 ? '#16a34a' : '#dc2626' }}>
                {inr(run.varianceAmount ?? 0)}
              </strong>
            </p>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="form-control"
                type="number"
                placeholder="Cash deposited"
                value={deposit}
                style={{ width: 160 }}
                onChange={(e) => setDeposit(e.target.value)}
              />
              <button className="btn btn-primary" onClick={doReconcile} disabled={pending}>
                Deposit &amp; reconcile
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px 14px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '10px 14px' };
