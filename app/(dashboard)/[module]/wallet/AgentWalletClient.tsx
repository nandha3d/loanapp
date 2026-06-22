'use client';

import { formatCurrency, formatDate } from '@/lib/utils';

type Txn = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string | null;
  refType: string | null;
  createdAt: string;
};

// Human labels for the wallet transaction `type` column.
const TYPE_LABEL: Record<string, string> = {
  release: 'Float released to you',
  disburse: 'Loan disbursed',
  collection: 'Collection received',
  inject: 'Cash added',
  adjustment: 'Adjustment',
};

export default function AgentWalletClient({
  agentName,
  balance,
  transactions,
  currencySymbol,
}: {
  agentName: string;
  balance: number;
  transactions: Txn[];
  currencySymbol: string;
}) {
  return (
    <div>
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-icons-outlined" style={{ color: 'var(--primary)' }}>payments</span>
          Cash Float
        </h3>
        <p style={{ fontSize: '.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          {agentName} — cash currently with you in the field. Hand over collected cash from the Collection page.
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
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(t.createdAt)}</td>
                    <td>
                      {TYPE_LABEL[t.type] || t.type}
                      {t.note ? <span style={{ color: 'var(--text-light)', fontSize: '.78rem' }}> · {t.note}</span> : null}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: credit ? 'var(--success)' : 'var(--danger)' }}>
                      {credit ? '+' : '−'}{formatCurrency(Math.abs(t.amount), currencySymbol)}
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(t.balanceAfter, currencySymbol)}</td>
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
