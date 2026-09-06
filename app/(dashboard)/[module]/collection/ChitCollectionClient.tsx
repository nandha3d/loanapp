'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { recordChitPayment } from '@/app/(dashboard)/[module]/chits/actions';
import { formatCurrency } from '@/lib/utils';

type Row = {
  id: string;
  memberId: string;
  periodNumber: number;
  customerName: string;
  customerPhone: string;
  groupName: string;
  baseContribution: number;
  dividendAdjustment: number;
  penalty: number;
  netDue: number;
  dueAmount: number;
  paidAmount: number;
  outstanding: number;
  dueDate: string;
  status: string;
  bucket: 'today' | 'overdue';
};

export default function ChitCollectionClient({
  rows,
  currencySymbol,
  dict,
}: {
  rows: Row[];
  currencySymbol: string;
  dict: any;
}) {
  const router = useRouter();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [modes, setModes] = useState<Record<string, string>>({});
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);

  const dueToday = rows.filter((r) => r.bucket === 'today');
  const overdue = rows.filter((r) => r.bucket === 'overdue');
  const expectedToday = dueToday.reduce((s, r) => s + r.outstanding, 0);
  const overdueTotal = overdue.reduce((s, r) => s + r.outstanding, 0);

  async function collect(row: Row) {
    setError(null);
    setReceipt(null);
    const raw = amounts[row.id];
    const amount = raw === undefined || raw === '' ? row.outstanding : Number(raw);
    if (!(amount > 0)) {
      setError('Enter a positive amount');
      return;
    }
    setBusyId(row.id);
    try {
      // recordChitPayment ADDS this amount to the existing paid amount and
      // returns the collection receipt number.
      const mode = modes[row.id] || 'cash';
      const result = await recordChitPayment(row.memberId, row.periodNumber, amount, mode, refs[row.id] || null);
      setReceipt(result?.receiptNo || null);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || 'Collection failed');
    } finally {
      setBusyId(null);
    }
  }

  const c = dict?.collection || {};

  function table(title: string, list: Row[], emptyText: string) {
    return (
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3>{title}</h3>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Chit Group</th>
                <th>Period</th>
                <th>Base</th>
                <th>Dividend</th>
                <th>Penalty</th>
                <th>Net Due</th>
                <th>Paid</th>
                <th>Outstanding</th>
                <th>Collect</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.id}>
                  <td data-label="Member">
                    <strong>{row.customerName}</strong>
                    {row.customerPhone ? (
                      <div style={{ fontSize: '.75rem', color: 'var(--text-light)' }}>{row.customerPhone}</div>
                    ) : null}
                  </td>
                  <td data-label="Chit Group">{row.groupName}</td>
                  <td data-label="Period">#{row.periodNumber}</td>
                  <td data-label="Base">{formatCurrency(row.baseContribution, currencySymbol)}</td>
                  <td data-label="Dividend">
                    {row.dividendAdjustment > 0 ? `-${formatCurrency(row.dividendAdjustment, currencySymbol)}` : '—'}
                  </td>
                  <td data-label="Penalty">
                    {row.penalty > 0 ? formatCurrency(row.penalty, currencySymbol) : '—'}
                  </td>
                  <td data-label="Net Due">{formatCurrency(row.netDue, currencySymbol)}</td>
                  <td data-label="Paid">{formatCurrency(row.paidAmount, currencySymbol)}</td>
                  <td data-label="Outstanding">
                    <strong>{formatCurrency(row.outstanding, currencySymbol)}</strong>
                  </td>
                  <td data-label="Collect">
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="number"
                        className="form-control"
                        style={{ width: 110 }}
                        placeholder={String(row.outstanding)}
                        value={amounts[row.id] ?? ''}
                        onChange={(e) => setAmounts((m) => ({ ...m, [row.id]: e.target.value }))}
                        disabled={busyId === row.id}
                      />
                      <select
                        className="form-control"
                        style={{ width: 90 }}
                        value={modes[row.id] ?? 'cash'}
                        onChange={(e) => setModes((m) => ({ ...m, [row.id]: e.target.value }))}
                        disabled={busyId === row.id}
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="bank">Bank</option>
                        <option value="cheque">Cheque</option>
                      </select>
                      {(modes[row.id] ?? 'cash') !== 'cash' && (
                        <input
                          type="text"
                          className="form-control"
                          style={{ width: 120 }}
                          placeholder="Ref no"
                          value={refs[row.id] ?? ''}
                          onChange={(e) => setRefs((m) => ({ ...m, [row.id]: e.target.value }))}
                          disabled={busyId === row.id}
                        />
                      )}
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => collect(row)}
                        disabled={busyId === row.id}
                      >
                        {busyId === row.id ? '…' : 'Collect'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 28, color: 'var(--text-light)' }}>
                    {emptyText}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>🧾 {c.collections || 'Chit Collection'}</h2>
        <p style={{ margin: '4px 0 0', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
          Collect members&apos; monthly chit contributions.
        </p>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-icon green"><span className="material-icons-outlined">event</span></div>
          <div>
            <div className="kpi-value">{formatCurrency(expectedToday, currencySymbol)}</div>
            <div className="kpi-label">Due Today ({dueToday.length})</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon red"><span className="material-icons-outlined">warning</span></div>
          <div>
            <div className="kpi-value">{formatCurrency(overdueTotal, currencySymbol)}</div>
            <div className="kpi-label">Overdue ({overdue.length})</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>
      )}
      {receipt && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f0fff4', border: '1px solid var(--success)', borderRadius: 'var(--radius)', color: 'var(--success)' }}>
          Collected — receipt {receipt}
        </div>
      )}

      {table(`Due Today (${dueToday.length})`, dueToday, 'No contributions due today.')}
      {table(`Overdue (${overdue.length})`, overdue, 'No overdue contributions.')}
    </div>
  );
}
