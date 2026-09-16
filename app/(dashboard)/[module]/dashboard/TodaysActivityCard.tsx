'use client';

import React, { useState, useMemo } from 'react';
import Link from '@/components/layout/DashboardLink';
import { formatCurrency, formatDate } from '@/lib/utils';

export interface TodayPaidItem {
  id: string;
  type: 'paid';
  receivedAmount: number;
  dueAmount: number;
  paymentMode: string;
  submittedAt: string | Date;
  verificationStatus: string;
  customer: {
    id: string;
    name: string;
    customerCode: string;
    phone?: string | null;
    route?: { id: string; name: string } | null;
  };
  loan: {
    id: string;
    loanCode: string;
    frequency?: string | null;
    principal?: number | null;
  };
  agent?: {
    id: string;
    name: string;
  } | null;
}

export interface TodayPendingItem {
  id: string;
  type: 'pending';
  dueAmount: number;
  receivedAmount: number;
  remainingAmount: number;
  dueDate: string | Date;
  status: 'pending' | 'partial' | 'missed';
  customer: {
    id: string;
    name: string;
    customerCode: string;
    phone?: string | null;
    route?: { id: string; name: string } | null;
  };
  loan: {
    id: string;
    loanCode: string;
    frequency?: string | null;
    perInstalment?: number | null;
  };
}

export interface TodayNewLoanItem {
  id: string;
  type: 'new_loan';
  loanCode: string;
  principal: number;
  frequency: string;
  tenure: number;
  createdAt: string | Date;
  customer: {
    id: string;
    name: string;
    customerCode: string;
    phone?: string | null;
    route?: { id: string; name: string } | null;
  };
  createdBy?: {
    id: string;
    name: string;
  } | null;
}

export interface TodayNewCustomerItem {
  id: string;
  type: 'new_customer';
  id_cust: string;
  name: string;
  customerCode: string;
  phone?: string | null;
  createdAt: string | Date;
  route?: {
    id: string;
    name: string;
  } | null;
}

export interface TodayOtherActivityItem {
  id: string;
  type: 'closed_loan' | 'approval' | 'penalty';
  title: string;
  description: string;
  timestamp: string | Date;
  status?: string | null;
  customerCode?: string | null;
  loanCode?: string | null;
  amount?: number | null;
}

export interface TodaysActivityProps {
  currencySymbol: string;
  paidItems: TodayPaidItem[];
  pendingItems: TodayPendingItem[];
  newLoanItems: TodayNewLoanItem[];
  newCustomerItems: TodayNewCustomerItem[];
  otherItems: TodayOtherActivityItem[];
  dict: {
    dashboard: Record<string, string>;
  };
}

type TabType = 'all' | 'paid' | 'pending' | 'new_loans' | 'new_customers' | 'other';

function formatTime(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function TodaysActivityCard({
  currencySymbol,
  paidItems,
  pendingItems,
  newLoanItems,
  newCustomerItems,
  otherItems,
  dict,
}: TodaysActivityProps) {
  const d = dict.dashboard;
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate top KPI totals
  const totalPaidAmount = useMemo(
    () => paidItems.reduce((sum, item) => sum + item.receivedAmount, 0),
    [paidItems]
  );
  const totalPendingAmount = useMemo(
    () => pendingItems.reduce((sum, item) => sum + item.remainingAmount, 0),
    [pendingItems]
  );
  const totalDisbursedAmount = useMemo(
    () => newLoanItems.reduce((sum, item) => sum + item.principal, 0),
    [newLoanItems]
  );

  // Normalize all activities for the unified list & tab filtering
  type UnifiedActivity =
    | ({ kind: 'paid'; sortTime: number } & TodayPaidItem)
    | ({ kind: 'pending'; sortTime: number } & TodayPendingItem)
    | ({ kind: 'new_loan'; sortTime: number } & TodayNewLoanItem)
    | ({ kind: 'new_customer'; sortTime: number } & TodayNewCustomerItem)
    | ({ kind: 'other'; sortTime: number } & TodayOtherActivityItem);

  const allActivities: UnifiedActivity[] = useMemo(() => {
    const list: UnifiedActivity[] = [];

    paidItems.forEach((item) => {
      list.push({
        ...item,
        kind: 'paid',
        sortTime: new Date(item.submittedAt).getTime(),
      });
    });

    pendingItems.forEach((item) => {
      list.push({
        ...item,
        kind: 'pending',
        sortTime: new Date(item.dueDate).getTime(),
      });
    });

    newLoanItems.forEach((item) => {
      list.push({
        ...item,
        kind: 'new_loan',
        sortTime: new Date(item.createdAt).getTime(),
      });
    });

    newCustomerItems.forEach((item) => {
      list.push({
        ...item,
        kind: 'new_customer',
        sortTime: new Date(item.createdAt).getTime(),
      });
    });

    otherItems.forEach((item) => {
      list.push({
        ...item,
        kind: 'other',
        sortTime: new Date(item.timestamp).getTime(),
      });
    });

    return list.sort((a, b) => b.sortTime - a.sortTime);
  }, [paidItems, pendingItems, newLoanItems, newCustomerItems, otherItems]);

  // Filter by active tab and search query
  const filteredActivities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return allActivities.filter((item) => {
      // Tab filter
      if (activeTab === 'paid' && item.kind !== 'paid') return false;
      if (activeTab === 'pending' && item.kind !== 'pending') return false;
      if (activeTab === 'new_loans' && item.kind !== 'new_loan') return false;
      if (activeTab === 'new_customers' && item.kind !== 'new_customer') return false;
      if (activeTab === 'other' && item.kind !== 'other') return false;

      // Search query filter
      if (!query) return true;

      if (item.kind === 'paid') {
        return (
          item.customer.name.toLowerCase().includes(query) ||
          item.customer.customerCode.toLowerCase().includes(query) ||
          item.loan.loanCode.toLowerCase().includes(query) ||
          (item.agent?.name?.toLowerCase().includes(query) ?? false) ||
          (item.customer.route?.name?.toLowerCase().includes(query) ?? false)
        );
      }
      if (item.kind === 'pending') {
        return (
          item.customer.name.toLowerCase().includes(query) ||
          item.customer.customerCode.toLowerCase().includes(query) ||
          item.loan.loanCode.toLowerCase().includes(query) ||
          (item.customer.phone?.toLowerCase().includes(query) ?? false) ||
          (item.customer.route?.name?.toLowerCase().includes(query) ?? false)
        );
      }
      if (item.kind === 'new_loan') {
        return (
          item.customer.name.toLowerCase().includes(query) ||
          item.customer.customerCode.toLowerCase().includes(query) ||
          item.loanCode.toLowerCase().includes(query) ||
          (item.createdBy?.name?.toLowerCase().includes(query) ?? false)
        );
      }
      if (item.kind === 'new_customer') {
        return (
          item.name.toLowerCase().includes(query) ||
          item.customerCode.toLowerCase().includes(query) ||
          (item.phone?.toLowerCase().includes(query) ?? false) ||
          (item.route?.name?.toLowerCase().includes(query) ?? false)
        );
      }
      if (item.kind === 'other') {
        return (
          item.title.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          (item.customerCode?.toLowerCase().includes(query) ?? false) ||
          (item.loanCode?.toLowerCase().includes(query) ?? false)
        );
      }
      return true;
    });
  }, [allActivities, activeTab, searchQuery]);

  return (
    <div className="card" style={{ marginTop: '20px', borderRadius: '16px', overflow: 'hidden' }}>
      {/* Header with Title and Date Badge */}
      <div
        style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '22px' }}>
              today
            </span>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#1e293b' }}>
              {d.todaysActivity || "Today's Activity"}
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
              {formatDate(new Date(), 'dddd, dd MMMM yyyy')}
            </span>
          </div>
        </div>

        {/* Real-time search bar */}
        <div style={{ position: 'relative', minWidth: '240px', maxWidth: '360px', flex: '1 1 240px' }}>
          <span
            className="material-icons-outlined"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '18px',
              color: '#94a3b8',
            }}
          >
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={d.searchActivity || 'Search customer, loan number or agent...'}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              fontSize: '0.82rem',
              outline: 'none',
              transition: 'border-color 0.2s',
              background: '#f8fafc',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                fontSize: '14px',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* KPI Highlights Strip (Desktop 4-col, Mobile 2-col) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          padding: '16px 24px',
          background: '#f8fafc',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        {/* Paid Today KPI */}
        <div
          onClick={() => setActiveTab('paid')}
          style={{
            background: activeTab === 'paid' ? '#ecfdf5' : '#fff',
            border: activeTab === 'paid' ? '1.5px solid #10b981' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#d1fae5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px' }}>
              check_circle
            </span>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              {d.paidToday || 'Paid Today'}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#065f46' }}>
              {formatCurrency(totalPaidAmount, currencySymbol)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#059669' }}>
              {paidItems.length} {d.customersCount || 'customers'}
            </div>
          </div>
        </div>

        {/* Pending Today KPI */}
        <div
          onClick={() => setActiveTab('pending')}
          style={{
            background: activeTab === 'pending' ? '#fffbeb' : '#fff',
            border: activeTab === 'pending' ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#fef3c7',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px' }}>
              hourglass_top
            </span>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              {d.pendingTodayDues || 'Pending / Unpaid'}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#92400e' }}>
              {formatCurrency(totalPendingAmount, currencySymbol)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#d97706' }}>
              {pendingItems.length} {d.customersCount || 'customers'}
            </div>
          </div>
        </div>

        {/* New Loans Disbursed KPI */}
        <div
          onClick={() => setActiveTab('new_loans')}
          style={{
            background: activeTab === 'new_loans' ? '#eff6ff' : '#fff',
            border: activeTab === 'new_loans' ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#dbeafe',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px' }}>
              real_estate_agent
            </span>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              {d.newLoansToday || 'New Loans'}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e40af' }}>
              {formatCurrency(totalDisbursedAmount, currencySymbol)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#2563eb' }}>
              {newLoanItems.length} loans
            </div>
          </div>
        </div>

        {/* New Customers KPI */}
        <div
          onClick={() => setActiveTab('new_customers')}
          style={{
            background: activeTab === 'new_customers' ? '#fdf4ff' : '#fff',
            border: activeTab === 'new_customers' ? '1.5px solid #a855f7' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#f3e8ff',
              color: '#9333ea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px' }}>
              person_add
            </span>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              {d.newCustomersToday || 'New Customers'}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#6b21a8' }}>
              {newCustomerItems.length}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#9333ea' }}>
              registered today
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'none',
        }}
      >
        <button
          onClick={() => setActiveTab('all')}
          style={{
            border: 'none',
            background: activeTab === 'all' ? 'var(--primary, #2563eb)' : '#f1f5f9',
            color: activeTab === 'all' ? '#fff' : '#475569',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {d.allActivity || 'All'} ({allActivities.length})
        </button>

        <button
          onClick={() => setActiveTab('paid')}
          style={{
            border: 'none',
            background: activeTab === 'paid' ? '#059669' : '#ecfdf5',
            color: activeTab === 'paid' ? '#fff' : '#059669',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          ✓ {d.paidToday || 'Paid Today'} ({paidItems.length})
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          style={{
            border: 'none',
            background: activeTab === 'pending' ? '#d97706' : '#fffbeb',
            color: activeTab === 'pending' ? '#fff' : '#d97706',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          ⏳ {d.pendingTodayDues || 'Pending / Unpaid'} ({pendingItems.length})
        </button>

        <button
          onClick={() => setActiveTab('new_loans')}
          style={{
            border: 'none',
            background: activeTab === 'new_loans' ? '#2563eb' : '#eff6ff',
            color: activeTab === 'new_loans' ? '#fff' : '#2563eb',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {d.newLoansToday || 'New Loans'} ({newLoanItems.length})
        </button>

        <button
          onClick={() => setActiveTab('new_customers')}
          style={{
            border: 'none',
            background: activeTab === 'new_customers' ? '#9333ea' : '#fdf4ff',
            color: activeTab === 'new_customers' ? '#fff' : '#9333ea',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {d.newCustomersToday || 'New Customers'} ({newCustomerItems.length})
        </button>

        {otherItems.length > 0 && (
          <button
            onClick={() => setActiveTab('other')}
            style={{
              border: 'none',
              background: activeTab === 'other' ? '#475569' : '#f1f5f9',
              color: activeTab === 'other' ? '#fff' : '#475569',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {d.otherActivity || 'Other'} ({otherItems.length})
          </button>
        )}
      </div>

      {/* Main Content Area: Responsive Dual View */}
      <div>
        {filteredActivities.length === 0 ? (
          /* Empty State */
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <span
              className="material-icons-outlined"
              style={{
                fontSize: '48px',
                color: activeTab === 'pending' ? '#10b981' : '#cbd5e1',
                marginBottom: '12px',
              }}
            >
              {activeTab === 'pending' ? 'task_alt' : 'inventory_2'}
            </span>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155' }}>
              {activeTab === 'paid' && (d.noPaidToday || 'No collections recorded today yet.')}
              {activeTab === 'pending' && (d.noPendingToday || 'All scheduled dues for today have been collected!')}
              {activeTab === 'new_loans' && (d.noNewLoansToday || 'No new loans created today.')}
              {activeTab === 'new_customers' && (d.noNewCustomersToday || 'No new customers registered today.')}
              {activeTab === 'other' && (d.noOtherToday || 'No other activities recorded today.')}
              {activeTab === 'all' && (d.noActivityToday || 'No activity recorded for today yet.')}
            </div>
            {searchQuery && (
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px' }}>
                No results matching &quot;{searchQuery}&quot;
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View (visible on screen width >= 768px) */}
            <div className="table-wrapper desktop-only-view">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '0.78rem', color: '#64748b' }}>
                      Customer / Route
                    </th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.78rem', color: '#64748b' }}>
                      Type & Details
                    </th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '0.78rem', color: '#64748b' }}>
                      Amount
                    </th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: '0.78rem', color: '#64748b' }}>
                      Status
                    </th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.78rem', color: '#64748b' }}>
                      Agent / Recorded By
                    </th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '0.78rem', color: '#64748b' }}>
                      Time
                    </th>
                    <th style={{ textAlign: 'center', padding: '12px 20px', fontSize: '0.78rem', color: '#64748b' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivities.map((act) => {
                    if (act.kind === 'paid') {
                      return (
                        <tr key={`paid-${act.id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <strong style={{ color: '#1e293b', fontSize: '0.88rem' }}>
                              {act.customer.name}
                            </strong>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '3px' }}>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                {act.customer.customerCode}
                              </span>
                              {act.customer.route && (
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    background: '#f1f5f9',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    color: '#475569',
                                  }}
                                >
                                  {act.customer.route.name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>
                              {act.loan.loanCode}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'capitalize' }}>
                              {d.paidVia || 'Paid via'} {act.paymentMode}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <div style={{ color: '#059669', fontWeight: 700, fontSize: '0.92rem' }}>
                              {formatCurrency(act.receivedAmount, currencySymbol)}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              Due: {formatCurrency(act.dueAmount, currencySymbol)}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#d1fae5',
                                color: '#065f46',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '4px 10px',
                                borderRadius: '20px',
                                textTransform: 'uppercase',
                              }}
                            >
                              <span className="material-icons-outlined" style={{ fontSize: '12px' }}>
                                check
                              </span>
                              {d.paidStatus || 'Paid'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: '#475569' }}>
                            {act.agent?.name || '—'}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '0.78rem', color: '#64748b' }}>
                            {formatTime(act.submittedAt)}
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              {act.customer.phone && (
                                <a
                                  href={`tel:${act.customer.phone}`}
                                  className="btn btn-ghost btn-sm"
                                  title={`Call ${act.customer.name}`}
                                  style={{ padding: '4px 8px', color: '#059669' }}
                                >
                                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                                    call
                                  </span>
                                </a>
                              )}
                              <Link
                                href={`/customers/${act.customer.customerCode}`}
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              >
                                View
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    if (act.kind === 'pending') {
                      return (
                        <tr key={`pending-${act.id}`} style={{ borderBottom: '1px solid #f1f5f9', background: '#fffcf5' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <strong style={{ color: '#1e293b', fontSize: '0.88rem' }}>
                              {act.customer.name}
                            </strong>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '3px' }}>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                {act.customer.customerCode}
                              </span>
                              {act.customer.phone && (
                                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  📞 {act.customer.phone}
                                </span>
                              )}
                              {act.customer.route && (
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    background: '#fef3c7',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    color: '#92400e',
                                  }}
                                >
                                  {act.customer.route.name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>
                              {act.loan.loanCode}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#92400e', textTransform: 'capitalize' }}>
                              Due Today ({act.loan.frequency || 'daily'})
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <div style={{ color: '#d97706', fontWeight: 700, fontSize: '0.92rem' }}>
                              {formatCurrency(act.remainingAmount, currencySymbol)}
                            </div>
                            {act.receivedAmount > 0 && (
                              <div style={{ fontSize: '0.7rem', color: '#059669' }}>
                                Paid: {formatCurrency(act.receivedAmount, currencySymbol)}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: act.receivedAmount > 0 ? '#fef3c7' : '#fee2e2',
                                color: act.receivedAmount > 0 ? '#92400e' : '#991b1b',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '4px 10px',
                                borderRadius: '20px',
                                textTransform: 'uppercase',
                              }}
                            >
                              <span className="material-icons-outlined" style={{ fontSize: '12px' }}>
                                warning
                              </span>
                              {act.receivedAmount > 0 ? (d.partialStatus || 'Partial') : (d.pendingStatus || 'Pending')}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: '#64748b' }}>
                            —
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '0.78rem', color: '#64748b' }}>
                            {formatDate(act.dueDate)}
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              {act.customer.phone && (
                                <a
                                  href={`tel:${act.customer.phone}`}
                                  className="btn btn-sm"
                                  style={{
                                    padding: '4px 10px',
                                    background: '#ecfdf5',
                                    color: '#059669',
                                    border: '1px solid #a7f3d0',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                  }}
                                >
                                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
                                    call
                                  </span>
                                  {d.callCustomer || 'Call'}
                                </a>
                              )}
                              <Link
                                href={`/collection?search=${act.customer.customerCode}`}
                                className="btn btn-primary btn-sm"
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              >
                                {d.collectNow || 'Collect'}
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    if (act.kind === 'new_loan') {
                      return (
                        <tr key={`loan-${act.id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <strong style={{ color: '#1e293b', fontSize: '0.88rem' }}>
                              {act.customer.name}
                            </strong>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                              {act.customer.customerCode}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#1e40af' }}>
                              {act.loanCode}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'capitalize' }}>
                              {act.frequency} • {act.tenure} instalments
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <div style={{ color: '#1e40af', fontWeight: 700, fontSize: '0.92rem' }}>
                              {formatCurrency(act.principal, currencySymbol)}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              {d.principalDisbursed || 'Disbursed'}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#dbeafe',
                                color: '#1e40af',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '4px 10px',
                                borderRadius: '20px',
                                textTransform: 'uppercase',
                              }}
                            >
                              {d.loanDisbursed || 'New Loan'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: '#475569' }}>
                            {act.createdBy?.name || '—'}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '0.78rem', color: '#64748b' }}>
                            {formatTime(act.createdAt)}
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                            <Link
                              href={`/loans/${act.loanCode}`}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            >
                              View Loan
                            </Link>
                          </td>
                        </tr>
                      );
                    }

                    if (act.kind === 'new_customer') {
                      return (
                        <tr key={`cust-${act.id_cust || act.id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <strong style={{ color: '#1e293b', fontSize: '0.88rem' }}>
                              {act.name}
                            </strong>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                {act.customerCode}
                              </span>
                              {act.route && (
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    background: '#f3e8ff',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    color: '#7e22ce',
                                  }}
                                >
                                  {act.route.name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: '#475569' }}>
                            {act.phone ? `📞 ${act.phone}` : '—'}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '0.82rem', color: '#64748b' }}>
                            —
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#f3e8ff',
                                color: '#7e22ce',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '4px 10px',
                                borderRadius: '20px',
                                textTransform: 'uppercase',
                              }}
                            >
                              {d.customerRegistered || 'New Customer'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: '#64748b' }}>
                            —
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '0.78rem', color: '#64748b' }}>
                            {formatTime(act.createdAt)}
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                            <Link
                              href={`/customers/${act.customerCode}`}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            >
                              View Customer
                            </Link>
                          </td>
                        </tr>
                      );
                    }

                    if (act.kind === 'other') {
                      return (
                        <tr key={`other-${act.id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <strong style={{ color: '#1e293b', fontSize: '0.88rem' }}>
                              {act.title}
                            </strong>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                              {act.description}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: '#475569' }}>
                            {act.loanCode || act.customerCode || '—'}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>
                            {act.amount ? formatCurrency(act.amount, currencySymbol) : '—'}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#f1f5f9',
                                color: '#475569',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '4px 10px',
                                borderRadius: '20px',
                                textTransform: 'uppercase',
                              }}
                            >
                              {act.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: '#64748b' }}>
                            —
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '0.78rem', color: '#64748b' }}>
                            {formatTime(act.timestamp)}
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                            —
                          </td>
                        </tr>
                      );
                    }

                    return null;
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (visible on screen width < 768px) */}
            <div className="mobile-only-view" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredActivities.map((act) => {
                if (act.kind === 'paid') {
                  return (
                    <div
                      key={`m-paid-${act.id}`}
                      style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#d1fae5',
                            color: '#065f46',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                          }}
                        >
                          ✓ {d.paidStatus || 'PAID'} • {act.paymentMode.toUpperCase()}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {formatTime(act.submittedAt)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                            {act.customer.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                            {act.customer.customerCode} • {act.loan.loanCode}
                            {act.customer.route && ` • ${act.customer.route.name}`}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#059669', fontWeight: 700, fontSize: '1.05rem' }}>
                            {formatCurrency(act.receivedAmount, currencySymbol)}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            Due: {formatCurrency(act.dueAmount, currencySymbol)}
                          </div>
                        </div>
                      </div>

                      {act.agent && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                          {d.collectedBy || 'Collected by'}: <strong>{act.agent.name}</strong>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        {act.customer.phone && (
                          <a
                            href={`tel:${act.customer.phone}`}
                            className="btn btn-ghost btn-sm"
                            style={{ flex: 1, textAlign: 'center', padding: '6px', fontSize: '0.8rem', color: '#059669', border: '1px solid #d1fae5' }}
                          >
                            📞 {d.callCustomer || 'Call'}
                          </a>
                        )}
                        <Link
                          href={`/customers/${act.customer.customerCode}`}
                          className="btn btn-ghost btn-sm"
                          style={{ flex: 1, textAlign: 'center', padding: '6px', fontSize: '0.8rem', border: '1px solid #e2e8f0' }}
                        >
                          View Profile
                        </Link>
                      </div>
                    </div>
                  );
                }

                if (act.kind === 'pending') {
                  return (
                    <div
                      key={`m-pending-${act.id}`}
                      style={{
                        background: '#fffcf5',
                        border: '1px solid #fde68a',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: act.receivedAmount > 0 ? '#fef3c7' : '#fee2e2',
                            color: act.receivedAmount > 0 ? '#92400e' : '#991b1b',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                          }}
                        >
                          ⏳ {act.receivedAmount > 0 ? (d.partialStatus || 'PARTIAL') : (d.pendingStatus || 'PENDING')}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>
                          Due Today
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                            {act.customer.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                            {act.customer.customerCode} • {act.loan.loanCode}
                            {act.customer.route && ` • ${act.customer.route.name}`}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#d97706', fontWeight: 700, fontSize: '1.05rem' }}>
                            {formatCurrency(act.remainingAmount, currencySymbol)}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            Total Due: {formatCurrency(act.dueAmount, currencySymbol)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        {act.customer.phone && (
                          <a
                            href={`tel:${act.customer.phone}`}
                            className="btn btn-sm"
                            style={{
                              flex: 1,
                              textAlign: 'center',
                              padding: '8px',
                              fontSize: '0.8rem',
                              background: '#ecfdf5',
                              color: '#059669',
                              border: '1px solid #a7f3d0',
                              fontWeight: 600,
                              borderRadius: '8px',
                            }}
                          >
                            📞 {d.callCustomer || 'Call'}
                          </a>
                        )}
                        <Link
                          href={`/collection?search=${act.customer.customerCode}`}
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1, textAlign: 'center', padding: '8px', fontSize: '0.8rem', borderRadius: '8px' }}
                        >
                          {d.collectNow || 'Collect'}
                        </Link>
                      </div>
                    </div>
                  );
                }

                if (act.kind === 'new_loan') {
                  return (
                    <div
                      key={`m-loan-${act.id}`}
                      style={{
                        background: '#fff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span
                          style={{
                            background: '#dbeafe',
                            color: '#1e40af',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                          }}
                        >
                          {d.loanDisbursed || 'NEW LOAN'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {formatTime(act.createdAt)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                            {act.customer.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                            {act.loanCode} • {act.frequency} • {act.tenure} tenure
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#1e40af', fontWeight: 700, fontSize: '1.05rem' }}>
                            {formatCurrency(act.principal, currencySymbol)}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            {d.principalDisbursed || 'Disbursed'}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: '10px' }}>
                        <Link
                          href={`/loans/${act.loanCode}`}
                          className="btn btn-ghost btn-sm"
                          style={{ display: 'block', textAlign: 'center', padding: '6px', fontSize: '0.8rem', border: '1px solid #e2e8f0' }}
                        >
                          View Loan
                        </Link>
                      </div>
                    </div>
                  );
                }

                if (act.kind === 'new_customer') {
                  return (
                    <div
                      key={`m-cust-${act.id_cust || act.id}`}
                      style={{
                        background: '#fff',
                        border: '1px solid #e9d5ff',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span
                          style={{
                            background: '#f3e8ff',
                            color: '#7e22ce',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                          }}
                        >
                          {d.customerRegistered || 'NEW CUSTOMER'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {formatTime(act.createdAt)}
                        </span>
                      </div>

                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                        {act.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                        {act.customerCode}
                        {act.route && ` • ${act.route.name}`}
                        {act.phone && ` • 📞 ${act.phone}`}
                      </div>

                      <div style={{ marginTop: '10px' }}>
                        <Link
                          href={`/customers/${act.customerCode}`}
                          className="btn btn-ghost btn-sm"
                          style={{ display: 'block', textAlign: 'center', padding: '6px', fontSize: '0.8rem', border: '1px solid #e2e8f0' }}
                        >
                          View Customer
                        </Link>
                      </div>
                    </div>
                  );
                }

                if (act.kind === 'other') {
                  return (
                    <div
                      key={`m-other-${act.id}`}
                      style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span
                          style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            textTransform: 'uppercase',
                          }}
                        >
                          {act.type.replace('_', ' ')}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {formatTime(act.timestamp)}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                        {act.title}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                        {act.description}
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </>
        )}
      </div>

      {/* Embedded CSS for responsive breakpoint switching */}
      <style jsx>{`
        @media (min-width: 768px) {
          .desktop-only-view {
            display: block !important;
          }
          .mobile-only-view {
            display: none !important;
          }
        }
        @media (max-width: 767px) {
          .desktop-only-view {
            display: none !important;
          }
          .mobile-only-view {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
