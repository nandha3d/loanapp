'use client';

import { useState } from 'react';
import { addAccountEntry } from './actions';
import Modal from '@/components/Modal';

const TYPE_OPTIONS = [
  { value: 'capital_add', label: '💰 Capital Addition', color: 'var(--success)' },
  { value: 'capital_withdraw', label: '🏧 Capital Withdrawal', color: 'var(--danger)' },
  { value: 'expense', label: '📤 Expense', color: 'var(--warning)' },
  { value: 'adjustment', label: '🔧 Adjustment', color: 'var(--text-secondary)' },
];

const CATEGORY_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'salary', label: 'Salary' },
  { value: 'rent', label: 'Rent' },
  { value: 'other', label: 'Other' },
];

function formatCurrency(amount: number, symbol: string) {
  return `${symbol}${Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

function formatDate(date: Date | string) {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getTypeInfo(type: string) {
  switch (type) {
    case 'capital_add': return { label: 'Capital Add', icon: 'add_circle', color: 'var(--success)', sign: '+' };
    case 'capital_withdraw': return { label: 'Capital Withdraw', icon: 'remove_circle', color: 'var(--danger)', sign: '-' };
    case 'loan_disburse': return { label: 'Loan Disbursed', icon: 'account_balance', color: '#E67E22', sign: '-' };
    case 'collection': return { label: 'Collection', icon: 'point_of_sale', color: 'var(--success)', sign: '+' };
    case 'expense': return { label: 'Expense', icon: 'receipt_long', color: 'var(--warning)', sign: '-' };
    case 'adjustment': return { label: 'Adjustment', icon: 'tune', color: 'var(--text-secondary)', sign: '±' };
    default: return { label: type, icon: 'help', color: 'var(--text-secondary)', sign: '' };
  }
}

export default function AccountingClient({
  summary,
  currencySymbol,
}: {
  summary: {
    capitalIn: number;
    capitalOut: number;
    totalDisbursed: number;
    totalCollected: number;
    totalExpenses: number;
    currentCapital: number;
    grossProfit: number;
    netProfit: number;
    entries: any[];
  };
  currencySymbol: string;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await addAccountEntry(fd);
    setLoading(false);
    if (result.error) {
      alert(result.error);
    } else {
      setIsModalOpen(false);
      window.location.reload();
    }
  };

  return (
    <div>
      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon green"><span className="material-icons-outlined">savings</span></div>
          <div>
            <div className="kpi-value">{formatCurrency(summary.currentCapital, currencySymbol)}</div>
            <div className="kpi-label">Current Capital</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon blue"><span className="material-icons-outlined">account_balance</span></div>
          <div>
            <div className="kpi-value">{formatCurrency(summary.totalDisbursed, currencySymbol)}</div>
            <div className="kpi-label">Total Disbursed</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange"><span className="material-icons-outlined">point_of_sale</span></div>
          <div>
            <div className="kpi-value">{formatCurrency(summary.totalCollected, currencySymbol)}</div>
            <div className="kpi-label">Total Collected</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className={`kpi-icon ${summary.netProfit >= 0 ? 'green' : 'red'}`}>
            <span className="material-icons-outlined">{summary.netProfit >= 0 ? 'trending_up' : 'trending_down'}</span>
          </div>
          <div>
            <div className="kpi-value" style={{ color: summary.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {summary.netProfit >= 0 ? '+' : '-'}{formatCurrency(summary.netProfit, currencySymbol)}
            </div>
            <div className="kpi-label">Net P&L</div>
          </div>
        </div>
      </div>

      {/* Capital Flow Summary */}
      <div className="grid-60-40" style={{ marginTop: '20px' }}>
        <div className="card">
          <div className="card-header">
            <h3>💰 Capital Flow</h3>
          </div>
          <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Capital Added</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)' }}>+{formatCurrency(summary.capitalIn, currencySymbol)}</div>
            </div>
            <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Capital Withdrawn</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--danger)' }}>-{formatCurrency(summary.capitalOut, currencySymbol)}</div>
            </div>
            <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Gross Profit</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: summary.grossProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatCurrency(summary.grossProfit, currencySymbol)}
              </div>
            </div>
            <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Expenses</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--warning)' }}>-{formatCurrency(summary.totalExpenses, currencySymbol)}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Quick Actions</h3>
          </div>
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ width: '100%' }}>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>add</span> New Entry
            </button>
            <p style={{ fontSize: '.8rem', color: 'var(--text-light)', textAlign: 'center', margin: '8px 0 0' }}>
              Loan disbursements and collections are recorded automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Transaction Ledger */}
      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header">
          <h3>📒 Transaction Ledger</h3>
          <span style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>Latest 50 entries</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Description</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {summary.entries.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }}>account_balance_wallet</span>
                    No entries yet. Add capital or create a loan to get started.
                  </td>
                </tr>
              )}
              {summary.entries.map((entry: any) => {
                const info = getTypeInfo(entry.type);
                return (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.entryDate)}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '14px', color: info.color }}>{info.icon}</span>
                        <span style={{ fontSize: '.82rem' }}>{info.label}</span>
                      </span>
                    </td>
                    <td><span className="badge badge-pending" style={{ textTransform: 'capitalize' }}>{entry.category}</span></td>
                    <td style={{ fontWeight: 700, color: info.sign === '+' ? 'var(--success)' : info.sign === '-' ? 'var(--danger)' : 'var(--text)' }}>
                      {info.sign}{formatCurrency(Number(entry.amount), currencySymbol)}
                    </td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.description || '-'}
                    </td>
                    <td style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>{entry.user?.name || 'System'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Entry Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Account Entry">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Entry Type *</label>
            <select name="type" className="form-control" required>
              {TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Amount ({currencySymbol}) *</label>
              <input type="number" name="amount" className="form-control" required min="1" step="0.01" />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select name="category" className="form-control">
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" name="entryDate" className="form-control" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea name="description" className="form-control" rows={2} placeholder="Optional notes..." />
          </div>
          <div className="form-actions" style={{ marginTop: '20px' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Add Entry'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
