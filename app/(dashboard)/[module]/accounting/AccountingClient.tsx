'use client';

import { useState, useMemo } from 'react';
import { addAccountEntry } from './actions';
import Modal from '@/components/Modal';

function formatCurrency(amount: number, symbol: string) {
  return `${symbol}${Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

function formatDate(date: Date | string) {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AccountingClient({
  summary,
  currencySymbol,
  dict,
  premiumEnabled,
  module,
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
    loans: any[];
    entries: any[];
  };
  currencySymbol: string;
  dict: any;
  premiumEnabled?: boolean;
  module?: string;
}) {
  const ac = dict.accounting || {};

  const TYPE_OPTIONS = [
    { value: 'capital_add', label: ac.capitalAddLabel || '💰 Capital Addition', color: 'var(--success)' },
    { value: 'capital_withdraw', label: ac.capitalWithdrawLabel || '🏧 Capital Withdrawal', color: 'var(--danger)' },
    { value: 'expense', label: ac.expenseLabel || '📤 Expense', color: 'var(--warning)' },
  ];

  const CATEGORY_OPTIONS = [
    { value: 'cash', label: ac.cashCategory || 'Cash' },
    { value: 'bank', label: ac.bankCategory || 'Bank Transfer' },
    { value: 'upi', label: ac.upiCategory || 'UPI' },
    { value: 'salary', label: ac.salaryCategory || 'Salary' },
    { value: 'rent', label: ac.rentCategory || 'Rent' },
    { value: 'other', label: ac.otherCategory || 'Other' },
  ];

  function getTypeInfo(type: string) {
    switch (type) {
      case 'capital_add': return { label: ac.capitalAdd || 'Capital Add', icon: 'add_circle', color: 'var(--success)', sign: '+' };
      case 'capital_withdraw': return { label: ac.withdraw || 'Capital Withdraw', icon: 'remove_circle', color: 'var(--danger)', sign: '-' };
      case 'loan_disburse': return { label: 'Loan Disbursed', icon: 'account_balance', color: '#E67E22', sign: '-' };
      case 'collection': return { label: 'Collection', icon: 'point_of_sale', color: 'var(--success)', sign: '+' };
      case 'expense': return { label: ac.expense || 'Expense', icon: 'receipt_long', color: 'var(--warning)', sign: '-' };
      case 'adjustment': return { label: 'Adjustment', icon: 'tune', color: 'var(--text-secondary)', sign: '±' };
      default: return { label: type, icon: 'help', color: 'var(--text-secondary)', sign: '' };
    }
  }

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('capital_add');
  const [loading, setLoading] = useState(false);

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [ledgerFrom, setLedgerFrom] = useState<string>('');
  const [ledgerTo, setLedgerTo] = useState<string>('');
  const [ledgerPage, setLedgerPage] = useState(1);
  const LEDGER_PAGE_SIZE = 20;

  const openModal = (type: string) => {
    setModalType(type);
    setIsModalOpen(true);
  };

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

  const filteredEntries = useMemo(() => {
    return summary.entries.filter((entry: any) => {
      const d = new Date(entry.entryDate);
      d.setHours(0, 0, 0, 0);
      if (fromDate) {
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        if (d < start) return false;
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      return true;
    });
  }, [summary.entries, fromDate, toDate]);

  const filteredLoans = useMemo(() => {
    return (summary.loans || []).filter((loan: any) => {
      const d = new Date(loan.startDate);
      d.setHours(0, 0, 0, 0);
      if (fromDate) {
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        if (d < start) return false;
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      return true;
    });
  }, [summary.loans, fromDate, toDate]);

  const metrics = useMemo(() => {
    let capitalIn = 0;
    let capitalOut = 0;
    let totalDisbursed = 0;
    let totalCollected = 0;
    let totalExpenses = 0;

    for (const entry of filteredEntries) {
      const amt = Number(entry.amount);
      switch (entry.type) {
        case 'capital_add':
          capitalIn += amt;
          break;
        case 'capital_withdraw':
          capitalOut += amt;
          break;
        case 'loan_disburse':
          totalDisbursed += amt;
          break;
        case 'collection':
          totalCollected += amt;
          break;
        case 'expense':
          totalExpenses += amt;
          break;
      }
    }

    const currentCapital = capitalIn - capitalOut - totalDisbursed + totalCollected - totalExpenses;
    const totalDeductions = filteredLoans.reduce((sum: number, loan: any) => sum + Number(loan.deduction), 0);
    const totalInterest = filteredLoans.reduce((sum: number, loan: any) => sum + Number(loan.totalPayable) - Number(loan.principal), 0);
    const projectedRevenue = totalDeductions + totalInterest;
    const projectedProfit = projectedRevenue - totalExpenses;

    return {
      capitalIn,
      capitalOut,
      totalDisbursed,
      totalCollected,
      totalExpenses,
      currentCapital,
      totalDeductions,
      totalInterest,
      projectedRevenue,
      projectedProfit,
    };
  }, [filteredEntries, filteredLoans]);

  return (
    <div>
      {/* Toggle if premium is enabled */}
      {premiumEnabled && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'var(--bg)', padding: '6px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <button className="btn btn-primary" style={{ flex: 1, pointerEvents: 'none' }}>Basic Accounting</button>
          <a href={`/${module}/accounting/premium`} className="btn btn-ghost" style={{ flex: 1, textAlign: 'center' }}>Premium Accounting</a>
        </div>
      )}

      {/* Date Range Filter */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>filter_alt</span>
            <span style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--text)' }}>{ac.filterPeriod || 'Filter P&L Period'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>{ac.from || 'From'}:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="form-control"
                style={{ width: '150px', padding: '6px 10px', fontSize: '.85rem' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>{ac.to || 'To'}:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="form-control"
                style={{ width: '150px', padding: '6px 10px', fontSize: '.85rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const now = new Date();
                  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                  setFromDate(firstDay.toISOString().split('T')[0]);
                  setToDate(now.toISOString().split('T')[0]);
                }}
                style={{ fontSize: '.75rem', background: 'var(--bg)', padding: '6px 12px' }}
              >{ac.thisMonth || 'This Month'}</button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const now = new Date();
                  const past30 = new Date();
                  past30.setDate(now.getDate() - 30);
                  setFromDate(past30.toISOString().split('T')[0]);
                  setToDate(now.toISOString().split('T')[0]);
                }}
                style={{ fontSize: '.75rem', background: 'var(--bg)', padding: '6px 12px' }}
              >{ac.last30Days || 'Last 30 Days'}</button>
              {(fromDate || toDate) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setFromDate('');
                    setToDate('');
                  }}
                  style={{ fontSize: '.75rem', color: 'var(--danger)', background: 'rgba(231, 76, 60, 0.1)', padding: '6px 12px' }}
                >{ac.clear || 'Clear'}</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon green"><span className="material-icons-outlined">savings</span></div>
          <div>
            <div className="kpi-value">{formatCurrency(summary.currentCapital, currencySymbol)}</div>
            <div className="kpi-label">{ac.currentCapital || 'Current Capital'}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon blue"><span className="material-icons-outlined">account_balance</span></div>
          <div>
            <div className="kpi-value">{formatCurrency(metrics.totalDisbursed, currencySymbol)}</div>
            <div className="kpi-label">{ac.totalDisbursed || 'Total Disbursed'}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange"><span className="material-icons-outlined">point_of_sale</span></div>
          <div>
            <div className="kpi-value">{formatCurrency(metrics.totalCollected, currencySymbol)}</div>
            <div className="kpi-label">{ac.totalCollected || 'Total Collected'}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className={`kpi-icon ${metrics.projectedProfit >= 0 ? 'green' : 'red'}`}>
            <span className="material-icons-outlined">{metrics.projectedProfit >= 0 ? 'trending_up' : 'trending_down'}</span>
          </div>
          <div>
            <div className="kpi-value" style={{ color: metrics.projectedProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {metrics.projectedProfit >= 0 ? '+' : '-'}{formatCurrency(metrics.projectedProfit, currencySymbol)}
            </div>
            <div className="kpi-label">{ac.projectedProfit || 'Projected Profit'}</div>
          </div>
        </div>
      </div>

      {/* Capital Flow Summary */}
      <div className="grid-60-40" style={{ marginTop: '20px' }}>
        <div className="card">
          <div className="card-header">
            <h3>💰 {ac.capitalFlow || 'Capital Flow'}</h3>
          </div>
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{ac.capitalAdded || 'Capital Added'}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)' }}>+{formatCurrency(metrics.capitalIn, currencySymbol)}</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{ac.capitalWithdrawn || 'Capital Withdrawn'}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--danger)' }}>-{formatCurrency(metrics.capitalOut, currencySymbol)}</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{ac.totalDeductions || 'Total Deductions (Upfront Fees)'}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(metrics.totalDeductions, currencySymbol)}</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{ac.totalInterest || 'Total Interest'}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(metrics.totalInterest, currencySymbol)}</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{ac.projectedRevenue || 'Projected Revenue'}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(metrics.projectedRevenue, currencySymbol)}</div>
                <div style={{ fontSize: '.7rem', color: 'var(--text-light)', marginTop: '2px' }}>{ac.deductionsInterest || 'Deductions + Interest'}</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{ac.expenses || 'Expenses'}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--warning)' }}>-{formatCurrency(metrics.totalExpenses, currencySymbol)}</div>
              </div>
            </div>
            <div style={{ padding: '16px', background: metrics.projectedProfit >= 0 ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)', borderRadius: 'var(--radius-sm)', border: `1px solid ${metrics.projectedProfit >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{ac.projectedProfitLabel || 'Projected Profit'}</div>
                <div style={{ fontSize: '.7rem', color: 'var(--text-light)' }}>{ac.projectedRevenueMinusExpenses || 'Projected Revenue − Expenses'}</div>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: metrics.projectedProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {metrics.projectedProfit >= 0 ? '' : '-'}{formatCurrency(metrics.projectedProfit, currencySymbol)}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>{ac.quickActions || 'Quick Actions'}</h3>
          </div>
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <button className="btn btn-primary" onClick={() => openModal('capital_add')}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>add_circle</span> {ac.capitalAdd || 'Capital Add'}
              </button>
              <button className="btn btn-danger" onClick={() => openModal('capital_withdraw')}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>remove_circle</span> {ac.withdraw || 'Withdraw'}
              </button>
              <button className="btn btn-warning" onClick={() => openModal('expense')}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>receipt_long</span> {ac.expense || 'Expense'}
              </button>
            </div>
            <p style={{ fontSize: '.8rem', color: 'var(--text-light)', textAlign: 'center', margin: '8px 0 0' }}>
              {ac.autoRecorded || 'Loan disbursements and collections are recorded automatically.'}
            </p>
          </div>
        </div>
      </div>

      {/* Transaction Ledger */}
      {(() => {
        const ledgerEntries = filteredEntries.filter((entry: any) => {
          const d = new Date(entry.entryDate);
          d.setHours(0, 0, 0, 0);
          if (ledgerFrom) {
            const start = new Date(ledgerFrom);
            start.setHours(0, 0, 0, 0);
            if (d < start) return false;
          }
          if (ledgerTo) {
            const end = new Date(ledgerTo);
            end.setHours(23, 59, 59, 999);
            if (d > end) return false;
          }
          return true;
        });
        const totalPages = Math.max(1, Math.ceil(ledgerEntries.length / LEDGER_PAGE_SIZE));
        const safePage = Math.min(ledgerPage, totalPages);
        const startIdx = (safePage - 1) * LEDGER_PAGE_SIZE;
        const pageEntries = ledgerEntries.slice(startIdx, startIdx + LEDGER_PAGE_SIZE);
        return (
      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>📒 {ac.transactionLedger || 'Transaction Ledger'}</h3>
            <span style={{ fontSize: '.78rem', color: 'var(--text-light)' }}>
              {ledgerEntries.length} {ac.entries || 'entries'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>{ac.from || 'From'}:</span>
              <input
                type="date"
                value={ledgerFrom}
                onChange={(e) => { setLedgerFrom(e.target.value); setLedgerPage(1); }}
                className="form-control"
                style={{ width: '140px', padding: '5px 8px', fontSize: '.8rem' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>{ac.to || 'To'}:</span>
              <input
                type="date"
                value={ledgerTo}
                onChange={(e) => { setLedgerTo(e.target.value); setLedgerPage(1); }}
                className="form-control"
                style={{ width: '140px', padding: '5px 8px', fontSize: '.8rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const now = new Date();
                  setLedgerFrom(new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0]);
                  setLedgerTo(now.toISOString().split('T')[0]);
                  setLedgerPage(1);
                }}
                style={{ fontSize: '.72rem', padding: '4px 10px', background: 'var(--bg)' }}
              >{ac.today || 'Today'}</button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const now = new Date();
                  const past7 = new Date();
                  past7.setDate(now.getDate() - 7);
                  setLedgerFrom(past7.toISOString().split('T')[0]);
                  setLedgerTo(now.toISOString().split('T')[0]);
                  setLedgerPage(1);
                }}
                style={{ fontSize: '.72rem', padding: '4px 10px', background: 'var(--bg)' }}
              >{ac.sevenDays || '7 Days'}</button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const now = new Date();
                  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                  setLedgerFrom(firstDay.toISOString().split('T')[0]);
                  setLedgerTo(now.toISOString().split('T')[0]);
                  setLedgerPage(1);
                }}
                style={{ fontSize: '.72rem', padding: '4px 10px', background: 'var(--bg)' }}
              >{ac.thisMonth || 'This Month'}</button>
              {(ledgerFrom || ledgerTo) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setLedgerFrom(''); setLedgerTo(''); setLedgerPage(1); }}
                  style={{ fontSize: '.72rem', padding: '4px 10px', color: 'var(--danger)', background: 'rgba(231,76,60,0.08)' }}
                >{ac.clear || 'Clear'}</button>
              )}
            </div>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{ac.date || 'Date'}</th>
                <th>{ac.type || 'Type'}</th>
                <th>{ac.category || 'Category'}</th>
                <th>{ac.amount || 'Amount'}</th>
                <th>{ac.description || 'Description'}</th>
                <th>{ac.by || 'By'}</th>
              </tr>
            </thead>
            <tbody>
              {pageEntries.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }}>account_balance_wallet</span>
                    {ac.noEntriesFound || 'No entries found.'}
                  </td>
                </tr>
              )}
              {pageEntries.map((entry: any) => {
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
                    <td style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>{entry.user?.name || ac.system || 'System'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid var(--border)', fontSize: '.82rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {ac.showing || 'Showing'} {startIdx + 1}–{Math.min(startIdx + LEDGER_PAGE_SIZE, ledgerEntries.length)} {ac.of || 'of'} {ledgerEntries.length}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={safePage <= 1}
                onClick={() => setLedgerPage(p => Math.max(1, p - 1))}
                style={{ padding: '4px 10px', fontSize: '.78rem', opacity: safePage <= 1 ? 0.4 : 1 }}
              >
                <span className="material-icons-outlined" style={{ fontSize: 16 }}>chevron_left</span> {ac.prev || 'Prev'}
              </button>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{ac.page || 'Page'} {safePage} / {totalPages}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={safePage >= totalPages}
                onClick={() => setLedgerPage(p => Math.min(totalPages, p + 1))}
                style={{ padding: '4px 10px', fontSize: '.78rem', opacity: safePage >= totalPages ? 0.4 : 1 }}
              >
                {ac.next || 'Next'} <span className="material-icons-outlined" style={{ fontSize: 16 }}>chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
        );
      })()}

      {/* Add Entry Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={ac.addAccountEntry || 'Add Account Entry'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{ac.entryType || 'Entry Type'} *</label>
            <select name="type" className="form-control" value={modalType} onChange={e => setModalType(e.target.value)} required>
              {TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{ac.amount || 'Amount'} ({currencySymbol}) *</label>
              <input type="number" name="amount" className="form-control" required min="1" step="0.01" />
            </div>
            <div className="form-group">
              <label className="form-label">{ac.category || 'Category'}</label>
              <select name="category" className="form-control">
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{ac.date || 'Date'}</label>
            <input type="date" name="entryDate" className="form-control" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="form-group">
            <label className="form-label">{ac.description || 'Description'}</label>
            <textarea name="description" className="form-control" rows={2} placeholder={ac.optionalNotes || 'Optional notes...'} />
          </div>
          <div className="form-actions" style={{ marginTop: '20px' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (ac.saving || 'Saving...') : (ac.addEntry || 'Add Entry')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>{ac.cancel || 'Cancel'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
