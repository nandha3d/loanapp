'use client';

import { useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { requestFloatHandoverAction } from './actions';

type Txn = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string | null;
  refType: string | null;
  createdAt: string;
};

type Handover = {
  id: string;
  amount: number;
  status: string;
  requestedAt: string;
  confirmedAt: string | null;
  remarks: string | null;
};

// Human labels for the wallet transaction `type` column.
const TYPE_LABEL: Record<string, string> = {
  release: 'Float released to you',
  disburse: 'Loan disbursed',
  collection: 'Collection received',
  inject: 'Cash added',
  deposit: 'Handed over to office',
  adjustment: 'Adjustment',
};

const HANDOVER_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: 'Awaiting collection', bg: 'rgba(245,158,11,.12)', color: '#D97706' },
  confirmed: { label: 'Collected', bg: 'rgba(16,185,129,.12)', color: 'var(--success)' },
  rejected: { label: 'Rejected', bg: 'rgba(239,68,68,.12)', color: 'var(--danger)' },
};

export default function AgentWalletClient({
  agentName,
  balance,
  transactions,
  handovers,
  currencySymbol,
}: {
  agentName: string;
  balance: number;
  transactions: Txn[];
  handovers: Handover[];
  currencySymbol: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <div>
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-icons-outlined" style={{ color: 'var(--primary)' }}>payments</span>
          Agent Wallet
        </h3>
        <p style={{ fontSize: '.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          {agentName} — cash currently with you in the field. Hand it over to the office below; an admin confirms collection.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '20px', textAlign: 'center', padding: '24px' }}>
        <div style={{ fontSize: '.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          Float Balance (cash in hand)
        </div>
        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: balance > 0 ? 'var(--primary)' : 'var(--text)', marginTop: '6px' }}>
          {formatCurrency(balance, currencySymbol)}
        </div>
      </div>

      {/* Hand over cash to office */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '.95rem', margin: '0 0 4px' }}>Hand over cash to office</h3>
        <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
          Raise a handover for the cash you are returning. The admin collects it and your float reduces once confirmed.
        </p>
        {error && (
          <div className="login-error" style={{ marginBottom: '12px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>error</span>{error}
          </div>
        )}
        <form
          action={async (fd) => {
            setError('');
            const amt = Number(fd.get('amount'));
            if (!amt || amt <= 0) { setError('Enter a valid amount.'); return; }
            if (amt > balance) { setError('Amount exceeds your float balance.'); return; }
            if (!confirm(`Hand over ${formatCurrency(amt, currencySymbol)} to the office?`)) return;
            setBusy(true);
            try {
              await requestFloatHandoverAction(fd);
            } catch (e: any) {
              setError(e?.message || 'Failed to raise handover.');
            } finally {
              setBusy(false);
            }
          }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', alignItems: 'end' }}
        >
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Amount ({currencySymbol}) *</label>
            <input name="amount" type="number" min="1" step="any" max={balance || undefined} className="form-control" placeholder="0" required />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Note</label>
            <input name="note" type="text" className="form-control" placeholder="Optional" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy || balance <= 0} style={{ justifyContent: 'center', whiteSpace: 'nowrap' }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{busy ? 'autorenew' : 'upload'}</span>
            {busy ? 'Submitting…' : 'Hand over'}
          </button>
        </form>
      </div>

      {/* Handover history */}
      {handovers.length > 0 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '.95rem', margin: '0 0 12px' }}>Handovers</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Requested</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {handovers.map((h) => {
                  const badge = HANDOVER_BADGE[h.status] || { label: h.status, bg: 'var(--bg)', color: 'var(--text-secondary)' };
                  return (
                    <tr key={h.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(h.requestedAt)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(h.amount, currencySymbol)}</td>
                      <td>
                        <span style={{ background: badge.bg, color: badge.color, fontSize: '.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px' }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-light)', fontSize: '.8rem' }}>{h.remarks || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ fontSize: '.95rem', margin: '0 0 12px' }}>Recent Float Activity</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Activity</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const credit = t.amount >= 0;
                return (
                  <tr key={t.id}>
                    <td data-label="Date" style={{ whiteSpace: 'nowrap' }}>{formatDate(t.createdAt)}</td>
                    <td data-label="Activity">
                      {TYPE_LABEL[t.type] || t.type}
                      {t.note ? <span style={{ color: 'var(--text-light)', fontSize: '.78rem' }}> · {t.note}</span> : null}
                    </td>
                    <td data-label="Amount" style={{ textAlign: 'right', fontWeight: 600, color: credit ? 'var(--success)' : 'var(--danger)' }}>
                      {credit ? '+' : '−'}{formatCurrency(Math.abs(t.amount), currencySymbol)}
                    </td>
                    <td data-label="Balance" style={{ textAlign: 'right' }}>{formatCurrency(t.balanceAfter, currencySymbol)}</td>
                  </tr>
                );
              })}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-light)' }}>
                    No float activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
