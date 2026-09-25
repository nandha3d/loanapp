'use client';

import React, { useState } from 'react';
import Link from '@/components/layout/DashboardLink';
import { formatCurrency } from '@/lib/utils';

export type FrequencyKey = 'daily' | 'weekly' | 'monthly' | 'custom';
export type FilterFrequency = 'all' | FrequencyKey;
export type LoanStatusFilter = 'all' | 'active' | 'inactive';

export interface StatusSubMetrics {
  expected: number;
  collected: number;
  remaining: number;
  loanCount: number;
  customerCount: number;
  pct: number;
}

export interface TodayFrequencyMetrics {
  total: StatusSubMetrics;
  active: StatusSubMetrics;
  inactive: StatusSubMetrics;
}

export interface OverdueStatusSubMetrics {
  totalOverdue: number;
  collectedToday: number;
  remaining: number;
  loanCount: number;
  customerCount: number;
  pct: number;
}

export interface OverdueFrequencyMetrics {
  total: OverdueStatusSubMetrics;
  active: OverdueStatusSubMetrics;
  inactive: OverdueStatusSubMetrics;
}

export interface CollectionBreakdownCardsProps {
  todayData: {
    total: StatusSubMetrics;
    active: StatusSubMetrics;
    inactive: StatusSubMetrics;
    breakdown: Record<FrequencyKey, TodayFrequencyMetrics>;
  };
  overdueData: {
    total: OverdueStatusSubMetrics;
    active: OverdueStatusSubMetrics;
    inactive: OverdueStatusSubMetrics;
    breakdown: Record<FrequencyKey, OverdueFrequencyMetrics>;
  };
  currencySymbol: string;
  dict: {
    dashboard: Record<string, string>;
    reports: Record<string, string>;
    loanDetail: Record<string, string>;
  };
}

export default function CollectionBreakdownCards({
  todayData,
  overdueData,
  currencySymbol,
  dict,
}: CollectionBreakdownCardsProps) {
  // Today's Collection filter state
  const [todayFreq, setTodayFreq] = useState<FilterFrequency>('all');
  const [todayStatus, setTodayStatus] = useState<LoanStatusFilter>('all');

  // Overdue Collection filter state
  const [overdueFreq, setOverdueFreq] = useState<FilterFrequency>('all');
  const [overdueStatus, setOverdueStatus] = useState<LoanStatusFilter>('all');

  const d = dict.dashboard;

  const getTodayMetrics = (
    data: { total: StatusSubMetrics; active: StatusSubMetrics; inactive: StatusSubMetrics },
    status: LoanStatusFilter,
  ): StatusSubMetrics => {
    if (status === 'active') return data.active;
    if (status === 'inactive') return data.inactive;
    return data.total;
  };

  const getOverdueMetrics = (
    data: { total: OverdueStatusSubMetrics; active: OverdueStatusSubMetrics; inactive: OverdueStatusSubMetrics },
    status: LoanStatusFilter,
  ): OverdueStatusSubMetrics => {
    if (status === 'active') return data.active;
    if (status === 'inactive') return data.inactive;
    return data.total;
  };

  const emptyTodayMetrics: TodayFrequencyMetrics = {
    total: { expected: 0, collected: 0, remaining: 0, loanCount: 0, customerCount: 0, pct: 0 },
    active: { expected: 0, collected: 0, remaining: 0, loanCount: 0, customerCount: 0, pct: 0 },
    inactive: { expected: 0, collected: 0, remaining: 0, loanCount: 0, customerCount: 0, pct: 0 },
  };

  const emptyOverdueMetrics: OverdueFrequencyMetrics = {
    total: { totalOverdue: 0, collectedToday: 0, remaining: 0, loanCount: 0, customerCount: 0, pct: 0 },
    active: { totalOverdue: 0, collectedToday: 0, remaining: 0, loanCount: 0, customerCount: 0, pct: 0 },
    inactive: { totalOverdue: 0, collectedToday: 0, remaining: 0, loanCount: 0, customerCount: 0, pct: 0 },
  };

  // Compute selected metrics for Today's Card
  const activeToday =
    todayFreq === 'all'
      ? getTodayMetrics(todayData, todayStatus)
      : getTodayMetrics(todayData.breakdown?.[todayFreq] || emptyTodayMetrics, todayStatus);

  const todayRemainingPct = Math.max(0, 100 - activeToday.pct);

  // Compute selected metrics for Overdue Card
  const activeOverdue =
    overdueFreq === 'all'
      ? getOverdueMetrics(overdueData, overdueStatus)
      : getOverdueMetrics(overdueData.breakdown?.[overdueFreq] || emptyOverdueMetrics, overdueStatus);

  const overdueRemainingPct = Math.max(0, 100 - activeOverdue.pct);

  const frequencies: Array<{ key: FrequencyKey; label: string; icon: string; color: string; bg: string }> = [
    { key: 'daily', label: d.daily || 'Daily', icon: 'today', color: '#2563eb', bg: '#eff6ff' },
    { key: 'weekly', label: d.weekly || 'Weekly', icon: 'date_range', color: '#7c3aed', bg: '#f5f3ff' },
    { key: 'monthly', label: d.monthly || 'Monthly', icon: 'calendar_month', color: '#059669', bg: '#ecfdf5' },
    { key: 'custom', label: d.custom || 'Custom', icon: 'tune', color: '#ea580c', bg: '#fff7ed' },
  ];

  const statusOptions: Array<{ key: LoanStatusFilter; label: string; icon: string }> = [
    { key: 'all', label: d.allLoans || 'All Loans', icon: 'layers' },
    { key: 'active', label: d.activeLoansTab || 'Active Loans', icon: 'check_circle' },
    { key: 'inactive', label: d.inactiveLoansTab || 'Inactive / Defaulted', icon: 'warning' },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 500px), 1fr))',
        gap: '20px',
        marginBottom: '18px',
      }}
    >
      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── Today's Collection Card ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div
        className="card"
        style={{
          padding: '24px 28px',
          background: 'linear-gradient(135deg, #f8faff 0%, #ffffff 100%)',
          border: '1.5px solid #cbd5e1',
          borderRadius: '18px',
          boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '18px',
        }}
      >
        {/* Top Header Row */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.12)',
                }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '26px' }}>today</span>
              </div>
              <div>
                <h2 style={{ margin: 0, fontWeight: 750, fontSize: '1.3rem', color: '#0f172a', letterSpacing: '-0.01em' }}>
                  {d.todayCollection}
                </h2>
                <span style={{ fontSize: '.84rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                  {todayStatus === 'all' ? (d.allLoans || 'All Loans') : todayStatus === 'active' ? (d.activeLoansTab || 'Active Loans') : (d.inactiveLoansTab || 'Inactive / Defaulted')}
                  {' • '}
                  {todayFreq === 'all'
                    ? (d.allFrequencies || 'All Frequencies')
                    : `${frequencies.find((f) => f.key === todayFreq)?.label}`}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: activeToday.pct >= 100 ? '#dcfce7' : activeToday.pct > 50 ? '#fef3c7' : '#fee2e2',
                  padding: '6px 14px',
                  borderRadius: '24px',
                  border: `1px solid ${activeToday.pct >= 100 ? '#86efac' : activeToday.pct > 50 ? '#fde047' : '#fca5a5'}`,
                }}
              >
                <span
                  className="material-icons-outlined"
                  style={{
                    fontSize: '17px',
                    color: activeToday.pct >= 100 ? '#16a34a' : activeToday.pct > 50 ? '#d97706' : '#dc2626',
                  }}
                >
                  {activeToday.pct >= 100 ? 'check_circle' : 'schedule'}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '.88rem',
                    color: activeToday.pct >= 100 ? '#15803d' : activeToday.pct > 50 ? '#b45309' : '#b91c1c',
                  }}
                >
                  {activeToday.pct}% {d.collected || 'collected'}
                </span>
              </div>

              <Link
                href="/collection"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '.85rem',
                  fontWeight: 650,
                  color: '#2563eb',
                  textDecoration: 'none',
                  padding: '7px 14px',
                  borderRadius: '10px',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.2s ease',
                }}
                title={d.viewCollection || 'View in Collections'}
              >
                <span>{d.viewCollection || 'View in Collections'}</span>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
              </Link>
            </div>
          </div>

          {/* ── Active vs Inactive Classification Highlight Strip ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            {/* Active Loans Classification Block */}
            <div
              onClick={() => setTodayStatus(todayStatus === 'active' ? 'all' : 'active')}
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: todayStatus === 'active' ? '#ecfdf5' : '#ffffff',
                border: `1.5px solid ${todayStatus === 'active' ? '#10b981' : '#e2e8f0'}`,
                boxShadow: todayStatus === 'active' ? '0 0 0 2px rgba(16, 185, 129, 0.18)' : '0 1px 3px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Click to filter by Active Loans"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#10b981',
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '.03em' }}>
                    {d.activeDue || 'Active Loans Due'}
                  </span>
                </div>
                <span style={{ fontSize: '.75rem', fontWeight: 650, color: '#059669', background: '#d1fae5', padding: '1px 7px', borderRadius: '12px' }}>
                  {todayData.active.loanCount} {d.loansCount || 'loans'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  {formatCurrency(todayData.active.expected, currencySymbol)}
                </span>
                <span style={{ fontSize: '.78rem', color: '#64748b' }}>
                  {todayData.active.collected > 0 ? `${formatCurrency(todayData.active.collected, currencySymbol)} rec.` : '0 rec.'}
                </span>
              </div>
            </div>

            {/* Inactive Loans Classification Block */}
            <div
              onClick={() => setTodayStatus(todayStatus === 'inactive' ? 'all' : 'inactive')}
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: todayStatus === 'inactive' ? '#fff7ed' : '#ffffff',
                border: `1.5px solid ${todayStatus === 'inactive' ? '#f97316' : '#e2e8f0'}`,
                boxShadow: todayStatus === 'inactive' ? '0 0 0 2px rgba(249, 115, 22, 0.18)' : '0 1px 3px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Click to filter by Inactive Loans"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#f97316',
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '.03em' }}>
                    {d.inactiveDue || 'Inactive Loans Due'}
                  </span>
                </div>
                <span style={{ fontSize: '.75rem', fontWeight: 650, color: '#ea580c', background: '#ffedd5', padding: '1px 7px', borderRadius: '12px' }}>
                  {todayData.inactive.loanCount} {d.loansCount || 'loans'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  {formatCurrency(todayData.inactive.expected, currencySymbol)}
                </span>
                <span style={{ fontSize: '.78rem', color: '#64748b' }}>
                  {todayData.inactive.collected > 0 ? `${formatCurrency(todayData.inactive.collected, currencySymbol)} rec.` : '0 rec.'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Dual Interactive Controls: Status & Frequency Filters ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
            {/* Row 1: Loan Status Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', minWidth: '70px' }}>
                {d.loanClassification || 'Loan Status'}:
              </span>
              <div
                style={{
                  display: 'inline-flex',
                  background: '#f1f5f9',
                  padding: '3px',
                  borderRadius: '10px',
                  gap: '3px',
                  flex: 1,
                }}
              >
                {statusOptions.map((opt) => {
                  const isSel = todayStatus === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setTodayStatus(opt.key)}
                      style={{
                        flex: 1,
                        padding: '7px 12px',
                        fontSize: '.82rem',
                        fontWeight: isSel ? 700 : 500,
                        color: isSel ? '#0f172a' : '#64748b',
                        background: isSel ? '#ffffff' : 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: isSel ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 2: Frequency Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', minWidth: '70px' }}>
                {d.frequency || 'Frequency'}:
              </span>
              <div
                style={{
                  display: 'inline-flex',
                  background: '#f1f5f9',
                  padding: '3px',
                  borderRadius: '10px',
                  gap: '3px',
                  flex: 1,
                }}
              >
                <button
                  type="button"
                  onClick={() => setTodayFreq('all')}
                  style={{
                    flex: 1,
                    padding: '7px 12px',
                    fontSize: '.82rem',
                    fontWeight: todayFreq === 'all' ? 700 : 500,
                    color: todayFreq === 'all' ? '#0f172a' : '#64748b',
                    background: todayFreq === 'all' ? '#ffffff' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: todayFreq === 'all' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {d.allFrequencies || 'All'}
                </button>
                {frequencies.map((f) => {
                  const isSel = todayFreq === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setTodayFreq(f.key)}
                      style={{
                        flex: 1,
                        padding: '7px 12px',
                        fontSize: '.82rem',
                        fontWeight: isSel ? 700 : 500,
                        color: isSel ? f.color : '#64748b',
                        background: isSel ? '#ffffff' : 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: isSel ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── 3 Large Executive Metric Boxes ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '18px' }}>
            {/* Box 1: Expected */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '14px',
                padding: '16px 18px',
                border: '1.5px solid #e2e8f0',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '18px', color: '#64748b' }}>trending_up</span>
                <span style={{ fontSize: '.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {dict.reports.expected}
                </span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1, marginBottom: '4px' }}>
                {formatCurrency(activeToday.expected, currencySymbol)}
              </div>
              <div style={{ fontSize: '.74rem', color: '#64748b' }}>
                {activeToday.loanCount} {d.loansCount || 'loans due'}
              </div>
            </div>

            {/* Box 2: Collected */}
            <div
              style={{
                background: '#f0fdf4',
                borderRadius: '14px',
                padding: '16px 18px',
                border: '1.5px solid #bbf7d0',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>check_circle</span>
                <span style={{ fontSize: '.78rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {dict.reports.collected}
                </span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#15803d', lineHeight: 1.1, marginBottom: '4px' }}>
                {formatCurrency(activeToday.collected, currencySymbol)}
              </div>
              <div style={{ fontSize: '.74rem', color: '#16a34a', fontWeight: 600 }}>
                {activeToday.pct}% {d.collected || 'collected'}
              </div>
            </div>

            {/* Box 3: Remaining */}
            <div
              style={{
                background: activeToday.remaining > 0 ? '#fef2f2' : '#f0fdf4',
                borderRadius: '14px',
                padding: '16px 18px',
                border: `1.5px solid ${activeToday.remaining > 0 ? '#fecaca' : '#bbf7d0'}`,
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '18px', color: activeToday.remaining > 0 ? '#dc2626' : '#16a34a' }}>
                  {activeToday.remaining > 0 ? 'pending' : 'check_circle'}
                </span>
                <span style={{ fontSize: '.78rem', color: activeToday.remaining > 0 ? '#dc2626' : '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {dict.loanDetail.remaining}
                </span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: activeToday.remaining > 0 ? '#b91c1c' : '#15803d', lineHeight: 1.1, marginBottom: '4px' }}>
                {formatCurrency(activeToday.remaining, currencySymbol)}
              </div>
              <div style={{ fontSize: '.74rem', color: activeToday.remaining > 0 ? '#b91c1c' : '#15803d' }}>
                {activeToday.remaining > 0 ? (d.stillDue || 'still due') : (d.collected || 'all collected')}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '8px', overflow: 'hidden', display: 'flex' }}>
              {activeToday.pct > 0 && (
                <div
                  style={{
                    width: `${activeToday.pct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)',
                    borderRadius: activeToday.pct >= 100 ? '8px' : '8px 0 0 8px',
                    transition: 'width 0.4s ease',
                  }}
                />
              )}
              {todayRemainingPct > 0 && activeToday.pct > 0 && (
                <div style={{ width: `${todayRemainingPct}%`, height: '100%', background: '#fecaca' }} />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '.78rem', color: '#64748b' }}>
              <span>{currencySymbol}0</span>
              <span style={{ color: '#10B981', fontWeight: 700 }}>
                {formatCurrency(activeToday.collected, currencySymbol)} {d.collected || 'collected'}
              </span>
              <span>{formatCurrency(activeToday.expected, currencySymbol)}</span>
            </div>
          </div>
        </div>

        {/* ── Breakdown by Frequency Strip with Active/Inactive Split ── */}
        <div style={{ borderTop: '1.5px solid #e2e8f0', paddingTop: '16px', marginTop: 'auto' }}>
          <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{d.frequencyBreakdown || 'Breakdown by Frequency'}</span>
            <span style={{ fontSize: '.74rem', fontWeight: 600, color: '#64748b' }}>
              {todayFreq !== 'all' ? `Filtered: ${frequencies.find((f) => f.key === todayFreq)?.label}` : (d.allFrequencies || 'All Frequencies')}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {frequencies.map((freq) => {
              const freqData = todayData.breakdown?.[freq.key] || emptyTodayMetrics;
              const b = getTodayMetrics(freqData, todayStatus);
              const isSelected = todayFreq === freq.key;

              return (
                <div
                  key={freq.key}
                  onClick={() => setTodayFreq(isSelected ? 'all' : freq.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: isSelected ? freq.bg : '#ffffff',
                    border: `1.5px solid ${isSelected ? freq.color : '#e2e8f0'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                  }}
                  title={`Click to filter by ${freq.label}`}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '130px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-icons-outlined" style={{ fontSize: '19px', color: freq.color }}>
                        {freq.icon}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '.92rem', color: '#0f172a' }}>
                        {freq.label}
                      </span>
                    </div>
                    {/* Active vs Inactive Pill */}
                    <div style={{ fontSize: '.72rem', color: '#64748b' }}>
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>Active: {formatCurrency(freqData.active.expected, currencySymbol)}</span>
                      {freqData.inactive.expected > 0 && (
                        <span style={{ color: '#ea580c', fontWeight: 600, marginLeft: '6px' }}>
                          • Inactive: {formatCurrency(freqData.inactive.expected, currencySymbol)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, justifyContent: 'flex-end' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.7rem', color: '#64748b', fontWeight: 600 }}>{dict.reports.expected}</div>
                      <div style={{ fontSize: '.9rem', fontWeight: 700, color: '#0f172a' }}>
                        {formatCurrency(b.expected, currencySymbol)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.7rem', color: '#16a34a', fontWeight: 600 }}>{dict.reports.collected}</div>
                      <div style={{ fontSize: '.9rem', fontWeight: 700, color: '#16a34a' }}>
                        {formatCurrency(b.collected, currencySymbol)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.7rem', color: b.remaining > 0 ? '#dc2626' : '#64748b', fontWeight: 600 }}>
                        {dict.loanDetail.remaining}
                      </div>
                      <div style={{ fontSize: '.9rem', fontWeight: 700, color: b.remaining > 0 ? '#b91c1c' : '#15803d' }}>
                        {formatCurrency(b.remaining, currencySymbol)}
                      </div>
                    </div>

                    <div style={{ minWidth: '54px', textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '.78rem',
                          fontWeight: 750,
                          color: b.pct >= 100 ? '#15803d' : b.pct > 50 ? '#b45309' : '#b91c1c',
                          background: b.pct >= 100 ? '#dcfce7' : b.pct > 50 ? '#fef3c7' : '#fee2e2',
                          padding: '4px 8px',
                          borderRadius: '8px',
                          display: 'inline-block',
                        }}
                      >
                        {b.pct}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── Overdue Collection Card ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div
        className="card"
        style={{
          padding: '24px 28px',
          background: 'linear-gradient(135deg, #fff8f8 0%, #ffffff 100%)',
          border: '1.5px solid #fecaca',
          borderRadius: '18px',
          boxShadow: '0 4px 16px -2px rgba(220, 38, 38, 0.05), 0 2px 6px -1px rgba(220, 38, 38, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '18px',
        }}
      >
        {/* Top Header Row */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.12)',
                }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '26px' }}>warning_amber</span>
              </div>
              <div>
                <h2 style={{ margin: 0, fontWeight: 750, fontSize: '1.3rem', color: '#0f172a', letterSpacing: '-0.01em' }}>
                  {d.overdueCollection}
                </h2>
                <span style={{ fontSize: '.84rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                  {overdueStatus === 'all' ? (d.allLoans || 'All Loans') : overdueStatus === 'active' ? (d.activeLoansTab || 'Active Loans') : (d.inactiveLoansTab || 'Inactive / Defaulted')}
                  {' • '}
                  {overdueFreq === 'all'
                    ? (d.allFrequencies || 'All Frequencies')
                    : `${frequencies.find((f) => f.key === overdueFreq)?.label}`}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: activeOverdue.pct >= 100 ? '#dcfce7' : '#fee2e2',
                  padding: '6px 14px',
                  borderRadius: '24px',
                  border: `1px solid ${activeOverdue.pct >= 100 ? '#86efac' : '#fca5a5'}`,
                }}
              >
                <span
                  className="material-icons-outlined"
                  style={{
                    fontSize: '17px',
                    color: activeOverdue.pct >= 100 ? '#16a34a' : '#dc2626',
                  }}
                >
                  {activeOverdue.pct >= 100 ? 'check_circle' : 'history'}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '.88rem',
                    color: activeOverdue.pct >= 100 ? '#15803d' : '#b91c1c',
                  }}
                >
                  {activeOverdue.pct}% {d.recoveredToday || 'recovered today'}
                </span>
              </div>

              <Link
                href="/collection?tab=overdue"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '.85rem',
                  fontWeight: 650,
                  color: '#dc2626',
                  textDecoration: 'none',
                  padding: '7px 14px',
                  borderRadius: '10px',
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  transition: 'all 0.2s ease',
                }}
                title={d.viewCollection || 'View in Collections'}
              >
                <span>{d.viewCollection || 'View in Collections'}</span>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
              </Link>
            </div>
          </div>

          <div style={{ fontSize: '.78rem', color: '#64748b', marginBottom: '16px', lineHeight: 1.4 }}>
            {d.overdueExplainer || "Past dues only (not today's). 'Total' is what was overdue at the start of today; it re-bases tomorrow as anything unpaid rolls over."}
          </div>

          {/* ── Active vs Inactive Classification Highlight Strip ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            {/* Active Loans Overdue Block */}
            <div
              onClick={() => setOverdueStatus(overdueStatus === 'active' ? 'all' : 'active')}
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: overdueStatus === 'active' ? '#ecfdf5' : '#ffffff',
                border: `1.5px solid ${overdueStatus === 'active' ? '#10b981' : '#fecaca'}`,
                boxShadow: overdueStatus === 'active' ? '0 0 0 2px rgba(16, 185, 129, 0.18)' : '0 1px 3px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Click to filter by Active Loans Overdue"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#10b981',
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '.03em' }}>
                    {d.activeOverdue || 'Active Loans Overdue'}
                  </span>
                </div>
                <span style={{ fontSize: '.75rem', fontWeight: 650, color: '#059669', background: '#d1fae5', padding: '1px 7px', borderRadius: '12px' }}>
                  {overdueData.active.customerCount} {d.activeCustomers || 'customers'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  {formatCurrency(overdueData.active.totalOverdue, currencySymbol)}
                </span>
                <span style={{ fontSize: '.78rem', color: '#64748b' }}>
                  {overdueData.active.collectedToday > 0 ? `${formatCurrency(overdueData.active.collectedToday, currencySymbol)} rec.` : '0 rec.'}
                </span>
              </div>
            </div>

            {/* Inactive Loans Overdue Block */}
            <div
              onClick={() => setOverdueStatus(overdueStatus === 'inactive' ? 'all' : 'inactive')}
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: overdueStatus === 'inactive' ? '#fef2f2' : '#ffffff',
                border: `1.5px solid ${overdueStatus === 'inactive' ? '#ef4444' : '#fecaca'}`,
                boxShadow: overdueStatus === 'inactive' ? '0 0 0 2px rgba(239, 68, 68, 0.18)' : '0 1px 3px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Click to filter by Inactive Loans Overdue"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#ef4444',
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '.03em' }}>
                    {d.inactiveOverdue || 'Inactive Loans Overdue'}
                  </span>
                </div>
                <span style={{ fontSize: '.75rem', fontWeight: 650, color: '#dc2626', background: '#fee2e2', padding: '1px 7px', borderRadius: '12px' }}>
                  {overdueData.inactive.customerCount} {d.activeCustomers || 'customers'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  {formatCurrency(overdueData.inactive.totalOverdue, currencySymbol)}
                </span>
                <span style={{ fontSize: '.78rem', color: '#64748b' }}>
                  {overdueData.inactive.collectedToday > 0 ? `${formatCurrency(overdueData.inactive.collectedToday, currencySymbol)} rec.` : '0 rec.'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Dual Interactive Controls: Status & Frequency Filters ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
            {/* Row 1: Loan Status Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', minWidth: '70px' }}>
                {d.loanClassification || 'Loan Status'}:
              </span>
              <div
                style={{
                  display: 'inline-flex',
                  background: '#f1f5f9',
                  padding: '3px',
                  borderRadius: '10px',
                  gap: '3px',
                  flex: 1,
                }}
              >
                {statusOptions.map((opt) => {
                  const isSel = overdueStatus === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setOverdueStatus(opt.key)}
                      style={{
                        flex: 1,
                        padding: '7px 12px',
                        fontSize: '.82rem',
                        fontWeight: isSel ? 700 : 500,
                        color: isSel ? '#0f172a' : '#64748b',
                        background: isSel ? '#ffffff' : 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: isSel ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 2: Frequency Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', minWidth: '70px' }}>
                {d.frequency || 'Frequency'}:
              </span>
              <div
                style={{
                  display: 'inline-flex',
                  background: '#f1f5f9',
                  padding: '3px',
                  borderRadius: '10px',
                  gap: '3px',
                  flex: 1,
                }}
              >
                <button
                  type="button"
                  onClick={() => setOverdueFreq('all')}
                  style={{
                    flex: 1,
                    padding: '7px 12px',
                    fontSize: '.82rem',
                    fontWeight: overdueFreq === 'all' ? 700 : 500,
                    color: overdueFreq === 'all' ? '#0f172a' : '#64748b',
                    background: overdueFreq === 'all' ? '#ffffff' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: overdueFreq === 'all' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {d.allFrequencies || 'All'}
                </button>
                {frequencies.map((f) => {
                  const isSel = overdueFreq === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setOverdueFreq(f.key)}
                      style={{
                        flex: 1,
                        padding: '7px 12px',
                        fontSize: '.82rem',
                        fontWeight: isSel ? 700 : 500,
                        color: isSel ? f.color : '#64748b',
                        background: isSel ? '#ffffff' : 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: isSel ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── 3 Large Executive Metric Boxes ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '18px' }}>
            {/* Box 1: Total Overdue */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '14px',
                padding: '16px 18px',
                border: '1.5px solid #fecaca',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '18px', color: '#64748b' }}>receipt_long</span>
                <span style={{ fontSize: '.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {d.totalOverdue}
                </span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1, marginBottom: '4px' }}>
                {formatCurrency(activeOverdue.totalOverdue, currencySymbol)}
              </div>
              <div style={{ fontSize: '.74rem', color: '#64748b' }}>
                {activeOverdue.customerCount} {d.activeCustomers || 'customers'} ({activeOverdue.loanCount} {d.loansCount || 'loans'})
              </div>
            </div>

            {/* Box 2: Collected Today */}
            <div
              style={{
                background: '#f0fdf4',
                borderRadius: '14px',
                padding: '16px 18px',
                border: '1.5px solid #bbf7d0',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>check_circle</span>
                <span style={{ fontSize: '.78rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {d.collectedToday}
                </span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#15803d', lineHeight: 1.1, marginBottom: '4px' }}>
                {formatCurrency(activeOverdue.collectedToday, currencySymbol)}
              </div>
              <div style={{ fontSize: '.74rem', color: '#16a34a', fontWeight: 600 }}>
                {activeOverdue.pct}% {d.recoveredToday || 'recovered today'}
              </div>
            </div>

            {/* Box 3: Remaining Overdue */}
            <div
              style={{
                background: activeOverdue.remaining > 0 ? '#fef2f2' : '#f0fdf4',
                borderRadius: '14px',
                padding: '16px 18px',
                border: `1.5px solid ${activeOverdue.remaining > 0 ? '#fecaca' : '#bbf7d0'}`,
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '18px', color: activeOverdue.remaining > 0 ? '#dc2626' : '#16a34a' }}>
                  {activeOverdue.remaining > 0 ? 'warning' : 'check_circle'}
                </span>
                <span style={{ fontSize: '.78rem', color: activeOverdue.remaining > 0 ? '#dc2626' : '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {dict.loanDetail.remaining}
                </span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: activeOverdue.remaining > 0 ? '#b91c1c' : '#15803d', lineHeight: 1.1, marginBottom: '4px' }}>
                {formatCurrency(activeOverdue.remaining, currencySymbol)}
              </div>
              <div style={{ fontSize: '.74rem', color: activeOverdue.remaining > 0 ? '#b91c1c' : '#15803d' }}>
                {activeOverdue.remaining > 0 ? (d.stillDue || 'still due') : (d.collected || 'cleared')}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '8px', overflow: 'hidden', display: 'flex' }}>
              {activeOverdue.pct > 0 && (
                <div
                  style={{
                    width: `${activeOverdue.pct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)',
                    borderRadius: activeOverdue.pct >= 100 ? '8px' : '8px 0 0 8px',
                    transition: 'width 0.4s ease',
                  }}
                />
              )}
              {overdueRemainingPct > 0 && activeOverdue.pct > 0 && (
                <div style={{ width: `${overdueRemainingPct}%`, height: '100%', background: '#fecaca' }} />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '.78rem', color: '#64748b' }}>
              <span>{currencySymbol}0</span>
              <span style={{ color: '#dc2626', fontWeight: 700 }}>
                {formatCurrency(activeOverdue.remaining, currencySymbol)} {d.stillDue || 'still due'}
              </span>
              <span>{formatCurrency(activeOverdue.totalOverdue, currencySymbol)}</span>
            </div>
          </div>
        </div>

        {/* ── Breakdown by Frequency Strip with Active/Inactive Split ── */}
        <div style={{ borderTop: '1.5px solid #fecaca', paddingTop: '16px', marginTop: 'auto' }}>
          <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{d.frequencyBreakdown || 'Breakdown by Frequency'}</span>
            <span style={{ fontSize: '.74rem', fontWeight: 600, color: '#64748b' }}>
              {overdueFreq !== 'all' ? `Filtered: ${frequencies.find((f) => f.key === overdueFreq)?.label}` : (d.allFrequencies || 'All Frequencies')}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {frequencies.map((freq) => {
              const freqData = overdueData.breakdown?.[freq.key] || emptyOverdueMetrics;
              const b = getOverdueMetrics(freqData, overdueStatus);
              const isSelected = overdueFreq === freq.key;

              return (
                <div
                  key={freq.key}
                  onClick={() => setOverdueFreq(isSelected ? 'all' : freq.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: isSelected ? freq.bg : '#ffffff',
                    border: `1.5px solid ${isSelected ? freq.color : '#fecaca'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                  }}
                  title={`Click to filter by ${freq.label}`}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '130px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-icons-outlined" style={{ fontSize: '19px', color: freq.color }}>
                        {freq.icon}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '.92rem', color: '#0f172a' }}>
                        {freq.label}
                      </span>
                    </div>
                    {/* Active vs Inactive Pill */}
                    <div style={{ fontSize: '.72rem', color: '#64748b' }}>
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>Active: {formatCurrency(freqData.active.totalOverdue, currencySymbol)}</span>
                      {freqData.inactive.totalOverdue > 0 && (
                        <span style={{ color: '#ea580c', fontWeight: 600, marginLeft: '6px' }}>
                          • Inactive: {formatCurrency(freqData.inactive.totalOverdue, currencySymbol)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, justifyContent: 'flex-end' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.7rem', color: '#64748b', fontWeight: 600 }}>{d.totalOverdue}</div>
                      <div style={{ fontSize: '.9rem', fontWeight: 700, color: '#0f172a' }}>
                        {formatCurrency(b.totalOverdue, currencySymbol)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.7rem', color: '#16a34a', fontWeight: 600 }}>{d.collectedToday}</div>
                      <div style={{ fontSize: '.9rem', fontWeight: 700, color: '#16a34a' }}>
                        {formatCurrency(b.collectedToday, currencySymbol)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.7rem', color: b.remaining > 0 ? '#dc2626' : '#64748b', fontWeight: 600 }}>
                        {dict.loanDetail.remaining}
                      </div>
                      <div style={{ fontSize: '.9rem', fontWeight: 700, color: b.remaining > 0 ? '#b91c1c' : '#15803d' }}>
                        {formatCurrency(b.remaining, currencySymbol)}
                      </div>
                    </div>

                    <div style={{ minWidth: '54px', textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '.78rem',
                          fontWeight: 750,
                          color: b.pct >= 100 ? '#15803d' : b.pct > 50 ? '#b45309' : '#b91c1c',
                          background: b.pct >= 100 ? '#dcfce7' : b.pct > 50 ? '#fef3c7' : '#fee2e2',
                          padding: '4px 8px',
                          borderRadius: '8px',
                          display: 'inline-block',
                        }}
                      >
                        {b.pct}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
