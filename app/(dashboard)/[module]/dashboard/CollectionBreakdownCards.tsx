'use client';

import React, { useState } from 'react';
import Link from '@/components/layout/DashboardLink';
import { formatCurrency } from '@/lib/utils';

export type FrequencyKey = 'daily' | 'weekly' | 'monthly';
export type FilterFrequency = 'all' | FrequencyKey;

export interface FrequencyCollectionMetrics {
  expected: number;
  collected: number;
  remaining: number;
  count: number;
  pct: number;
}

export interface FrequencyOverdueMetrics {
  totalOverdue: number;
  collectedToday: number;
  remaining: number;
  customerCount: number;
  pct: number;
}

export interface CollectionBreakdownCardsProps {
  todayData: {
    expected: number;
    collected: number;
    remaining: number;
    pct: number;
    breakdown: Record<FrequencyKey, FrequencyCollectionMetrics>;
  };
  overdueData: {
    totalOverdue: number;
    collectedToday: number;
    remaining: number;
    pct: number;
    breakdown: Record<FrequencyKey, FrequencyOverdueMetrics>;
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
  const [todayFreq, setTodayFreq] = useState<FilterFrequency>('all');
  const [overdueFreq, setOverdueFreq] = useState<FilterFrequency>('all');

  const d = dict.dashboard;

  // Selected values for Today's Collection Card
  const activeToday =
    todayFreq === 'all'
      ? {
          expected: todayData.expected,
          collected: todayData.collected,
          remaining: todayData.remaining,
          pct: todayData.pct,
        }
      : {
          expected: todayData.breakdown[todayFreq].expected,
          collected: todayData.breakdown[todayFreq].collected,
          remaining: todayData.breakdown[todayFreq].remaining,
          pct: todayData.breakdown[todayFreq].pct,
        };

  const todayRemainingPct = 100 - activeToday.pct;

  // Selected values for Overdue Collection Card
  const activeOverdue =
    overdueFreq === 'all'
      ? {
          totalOverdue: overdueData.totalOverdue,
          collectedToday: overdueData.collectedToday,
          remaining: overdueData.remaining,
          pct: overdueData.pct,
        }
      : {
          totalOverdue: overdueData.breakdown[overdueFreq].totalOverdue,
          collectedToday: overdueData.breakdown[overdueFreq].collectedToday,
          remaining: overdueData.breakdown[overdueFreq].remaining,
          pct: overdueData.breakdown[overdueFreq].pct,
        };

  const overdueRemainingPct = 100 - activeOverdue.pct;

  const frequencies: Array<{ key: FrequencyKey; label: string; icon: string; color: string; bg: string }> = [
    { key: 'daily', label: d.daily || 'Daily', icon: 'today', color: '#2563eb', bg: '#eff6ff' },
    { key: 'weekly', label: d.weekly || 'Weekly', icon: 'date_range', color: '#7c3aed', bg: '#f5f3ff' },
    { key: 'monthly', label: d.monthly || 'Monthly', icon: 'calendar_month', color: '#059669', bg: '#ecfdf5' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '14px' }}>
      {/* ── Today's Collection Card ── */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #f8faff 0%, #ffffff 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Card Top Header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '22px' }}>today</span>
              </div>
              <div>
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>
                  {d.todayCollection}
                </span>
                <span style={{ fontSize: '.75rem', color: '#64748b', display: 'block', marginTop: '1px' }}>
                  {todayFreq === 'all'
                    ? `${d.allFrequencies || 'All'} ${d.frequency || 'Frequency'}`
                    : `${frequencies.find((f) => f.key === todayFreq)?.label} ${d.frequency || 'Frequency'}`}
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
                  padding: '5px 12px',
                  borderRadius: '20px',
                }}
              >
                <span
                  className="material-icons-outlined"
                  style={{
                    fontSize: '15px',
                    color: activeToday.pct >= 100 ? '#16a34a' : activeToday.pct > 50 ? '#d97706' : '#dc2626',
                  }}
                >
                  {activeToday.pct >= 100 ? 'check_circle' : 'schedule'}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '.82rem',
                    color: activeToday.pct >= 100 ? '#16a34a' : activeToday.pct > 50 ? '#d97706' : '#dc2626',
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
                  gap: '4px',
                  fontSize: '.78rem',
                  fontWeight: 600,
                  color: 'var(--primary, #2563eb)',
                  textDecoration: 'none',
                  padding: '5px 10px',
                  borderRadius: '8px',
                  background: '#f1f5f9',
                  transition: 'background 0.2s',
                }}
                title={d.viewCollection || 'View in Collections'}
              >
                <span>{d.viewCollection || 'View in Collections'}</span>
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
              </Link>
            </div>
          </div>

          {/* Frequency Segmented Control */}
          <div
            style={{
              display: 'inline-flex',
              background: '#f1f5f9',
              padding: '3px',
              borderRadius: '10px',
              gap: '2px',
              marginBottom: '16px',
              width: '100%',
              maxWidth: '380px',
            }}
          >
            <button
              type="button"
              onClick={() => setTodayFreq('all')}
              style={{
                flex: 1,
                padding: '6px 12px',
                fontSize: '.78rem',
                fontWeight: todayFreq === 'all' ? 700 : 500,
                color: todayFreq === 'all' ? '#1e293b' : '#64748b',
                background: todayFreq === 'all' ? '#ffffff' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                boxShadow: todayFreq === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {d.allFrequencies || 'All'}
            </button>
            {frequencies.map((f) => {
              const isSelected = todayFreq === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setTodayFreq(f.key)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    fontSize: '.78rem',
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? f.color : '#64748b',
                    background: isSelected ? '#ffffff' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>

          {/* 3 Headline Metric Boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#ffffff', borderRadius: '12px', padding: '12px 14px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '15px', color: '#64748b' }}>trending_up</span>
                <span style={{ fontSize: '.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {dict.reports.expected}
                </span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                {formatCurrency(activeToday.expected, currencySymbol)}
              </div>
            </div>

            <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '12px 14px', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '15px', color: '#16a34a' }}>check_circle</span>
                <span style={{ fontSize: '.7rem', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {dict.reports.collected}
                </span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#15803d' }}>
                {formatCurrency(activeToday.collected, currencySymbol)}
              </div>
            </div>

            <div
              style={{
                background: activeToday.remaining > 0 ? '#fef2f2' : '#f0fdf4',
                borderRadius: '12px',
                padding: '12px 14px',
                border: `1px solid ${activeToday.remaining > 0 ? '#fecaca' : '#bbf7d0'}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '15px', color: activeToday.remaining > 0 ? '#dc2626' : '#16a34a' }}>
                  {activeToday.remaining > 0 ? 'pending' : 'check_circle'}
                </span>
                <span style={{ fontSize: '.7rem', color: activeToday.remaining > 0 ? '#dc2626' : '#16a34a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {dict.loanDetail.remaining}
                </span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: activeToday.remaining > 0 ? '#b91c1c' : '#15803d' }}>
                {formatCurrency(activeToday.remaining, currencySymbol)}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
              {activeToday.pct > 0 && (
                <div
                  style={{
                    width: `${activeToday.pct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)',
                    borderRadius: activeToday.pct >= 100 ? '6px' : '6px 0 0 6px',
                    transition: 'width 0.4s ease',
                  }}
                />
              )}
              {todayRemainingPct > 0 && activeToday.pct > 0 && (
                <div style={{ width: `${todayRemainingPct}%`, height: '100%', background: '#fecaca' }} />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '.68rem', color: '#94a3b8' }}>
              <span>{currencySymbol}0</span>
              <span style={{ color: '#10B981', fontWeight: 600 }}>
                {formatCurrency(activeToday.collected, currencySymbol)} {d.collected || 'collected'}
              </span>
              <span>{formatCurrency(activeToday.expected, currencySymbol)}</span>
            </div>
          </div>
        </div>

        {/* Breakdown by Frequency Strip */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', marginTop: 'auto' }}>
          <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{d.frequencyBreakdown || 'Breakdown by Frequency'}</span>
            <span style={{ fontSize: '.68rem', fontWeight: 500, color: '#94a3b8' }}>
              {todayFreq !== 'all' ? `Filtered by ${frequencies.find((f) => f.key === todayFreq)?.label}` : 'All Frequencies'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {frequencies.map((freq) => {
              const b = todayData.breakdown[freq.key];
              const isSelected = todayFreq === freq.key;
              return (
                <div
                  key={freq.key}
                  onClick={() => setTodayFreq(isSelected ? 'all' : freq.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: isSelected ? freq.bg : '#ffffff',
                    border: `1px solid ${isSelected ? freq.color : '#e2e8f0'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title={`Click to filter by ${freq.label}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '95px' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '16px', color: freq.color }}>
                      {freq.icon}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '.82rem', color: '#1e293b' }}>
                      {freq.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, justifyContent: 'flex-end' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.65rem', color: '#64748b' }}>{dict.reports.expected}</div>
                      <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#1e293b' }}>
                        {formatCurrency(b.expected, currencySymbol)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.65rem', color: '#16a34a' }}>{dict.reports.collected}</div>
                      <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#16a34a' }}>
                        {formatCurrency(b.collected, currencySymbol)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.65rem', color: b.remaining > 0 ? '#dc2626' : '#64748b' }}>
                        {dict.loanDetail.remaining}
                      </div>
                      <div style={{ fontSize: '.8rem', fontWeight: 600, color: b.remaining > 0 ? '#b91c1c' : '#15803d' }}>
                        {formatCurrency(b.remaining, currencySymbol)}
                      </div>
                    </div>

                    <div style={{ width: '50px', textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '.72rem',
                          fontWeight: 700,
                          color: b.pct >= 100 ? '#16a34a' : b.pct > 50 ? '#d97706' : '#dc2626',
                          background: b.pct >= 100 ? '#dcfce7' : b.pct > 50 ? '#fef3c7' : '#fee2e2',
                          padding: '2px 6px',
                          borderRadius: '6px',
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

      {/* ── Overdue Collection Card ── */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #fff7f7 0%, #ffffff 100%)',
          border: '1px solid #fecaca',
          borderRadius: '16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Card Top Header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626',
                }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '22px' }}>warning_amber</span>
              </div>
              <div>
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>
                  {d.overdueCollection}
                </span>
                <span style={{ fontSize: '.75rem', color: '#64748b', display: 'block', marginTop: '1px' }}>
                  {overdueFreq === 'all'
                    ? `${d.allFrequencies || 'All'} ${d.frequency || 'Frequency'}`
                    : `${frequencies.find((f) => f.key === overdueFreq)?.label} ${d.frequency || 'Frequency'}`}
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
                  padding: '5px 12px',
                  borderRadius: '20px',
                }}
              >
                <span
                  className="material-icons-outlined"
                  style={{
                    fontSize: '15px',
                    color: activeOverdue.pct >= 100 ? '#16a34a' : '#dc2626',
                  }}
                >
                  {activeOverdue.pct >= 100 ? 'check_circle' : 'history'}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '.82rem',
                    color: activeOverdue.pct >= 100 ? '#16a34a' : '#dc2626',
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
                  gap: '4px',
                  fontSize: '.78rem',
                  fontWeight: 600,
                  color: '#dc2626',
                  textDecoration: 'none',
                  padding: '5px 10px',
                  borderRadius: '8px',
                  background: '#fee2e2',
                  transition: 'background 0.2s',
                }}
                title={d.viewCollection || 'View in Collections'}
              >
                <span>{d.viewCollection || 'View in Collections'}</span>
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
              </Link>
            </div>
          </div>

          <div style={{ fontSize: '.72rem', color: '#94a3b8', marginBottom: '14px', lineHeight: 1.4 }}>
            {d.overdueExplainer || "Past dues only (not today's). 'Total' is what was overdue at the start of today; it re-bases tomorrow as anything unpaid rolls over."}
          </div>

          {/* Frequency Segmented Control */}
          <div
            style={{
              display: 'inline-flex',
              background: '#f1f5f9',
              padding: '3px',
              borderRadius: '10px',
              gap: '2px',
              marginBottom: '16px',
              width: '100%',
              maxWidth: '380px',
            }}
          >
            <button
              type="button"
              onClick={() => setOverdueFreq('all')}
              style={{
                flex: 1,
                padding: '6px 12px',
                fontSize: '.78rem',
                fontWeight: overdueFreq === 'all' ? 700 : 500,
                color: overdueFreq === 'all' ? '#1e293b' : '#64748b',
                background: overdueFreq === 'all' ? '#ffffff' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                boxShadow: overdueFreq === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {d.allFrequencies || 'All'}
            </button>
            {frequencies.map((f) => {
              const isSelected = overdueFreq === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setOverdueFreq(f.key)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    fontSize: '.78rem',
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? f.color : '#64748b',
                    background: isSelected ? '#ffffff' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>

          {/* 3 Headline Metric Boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#ffffff', borderRadius: '12px', padding: '12px 14px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '15px', color: '#64748b' }}>receipt_long</span>
                <span style={{ fontSize: '.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {d.totalOverdue}
                </span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                {formatCurrency(activeOverdue.totalOverdue, currencySymbol)}
              </div>
            </div>

            <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '12px 14px', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '15px', color: '#16a34a' }}>check_circle</span>
                <span style={{ fontSize: '.7rem', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {d.collectedToday}
                </span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#15803d' }}>
                {formatCurrency(activeOverdue.collectedToday, currencySymbol)}
              </div>
            </div>

            <div
              style={{
                background: activeOverdue.remaining > 0 ? '#fef2f2' : '#f0fdf4',
                borderRadius: '12px',
                padding: '12px 14px',
                border: `1px solid ${activeOverdue.remaining > 0 ? '#fecaca' : '#bbf7d0'}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '15px', color: activeOverdue.remaining > 0 ? '#dc2626' : '#16a34a' }}>
                  {activeOverdue.remaining > 0 ? 'pending' : 'check_circle'}
                </span>
                <span style={{ fontSize: '.7rem', color: activeOverdue.remaining > 0 ? '#dc2626' : '#16a34a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {dict.loanDetail.remaining}
                </span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: activeOverdue.remaining > 0 ? '#b91c1c' : '#15803d' }}>
                {formatCurrency(activeOverdue.remaining, currencySymbol)}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
              {activeOverdue.pct > 0 && (
                <div
                  style={{
                    width: `${activeOverdue.pct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)',
                    borderRadius: activeOverdue.pct >= 100 ? '6px' : '6px 0 0 6px',
                    transition: 'width 0.4s ease',
                  }}
                />
              )}
              {overdueRemainingPct > 0 && activeOverdue.pct > 0 && (
                <div style={{ width: `${overdueRemainingPct}%`, height: '100%', background: '#fecaca' }} />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '.68rem', color: '#94a3b8' }}>
              <span>{currencySymbol}0</span>
              <span style={{ color: '#dc2626', fontWeight: 600 }}>
                {formatCurrency(activeOverdue.remaining, currencySymbol)} {d.stillDue || 'still due'}
              </span>
              <span>{formatCurrency(activeOverdue.totalOverdue, currencySymbol)}</span>
            </div>
          </div>
        </div>

        {/* Breakdown by Frequency Strip */}
        <div style={{ borderTop: '1px solid #fecaca', paddingTop: '14px', marginTop: 'auto' }}>
          <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{d.frequencyBreakdown || 'Breakdown by Frequency'}</span>
            <span style={{ fontSize: '.68rem', fontWeight: 500, color: '#94a3b8' }}>
              {overdueFreq !== 'all' ? `Filtered by ${frequencies.find((f) => f.key === overdueFreq)?.label}` : 'All Frequencies'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {frequencies.map((freq) => {
              const b = overdueData.breakdown[freq.key];
              const isSelected = overdueFreq === freq.key;
              return (
                <div
                  key={freq.key}
                  onClick={() => setOverdueFreq(isSelected ? 'all' : freq.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: isSelected ? freq.bg : '#ffffff',
                    border: `1px solid ${isSelected ? freq.color : '#fecaca'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title={`Click to filter by ${freq.label}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '95px' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '16px', color: freq.color }}>
                      {freq.icon}
                    </span>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '.82rem', color: '#1e293b', display: 'block' }}>
                        {freq.label}
                      </span>
                      {b.customerCount > 0 && (
                        <span style={{ fontSize: '.65rem', color: '#64748b' }}>
                          {b.customerCount} {d.activeCustomers || 'customers'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, justifyContent: 'flex-end' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.65rem', color: '#64748b' }}>{d.totalOverdue}</div>
                      <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#1e293b' }}>
                        {formatCurrency(b.totalOverdue, currencySymbol)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.65rem', color: '#16a34a' }}>{d.collectedToday}</div>
                      <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#16a34a' }}>
                        {formatCurrency(b.collectedToday, currencySymbol)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.65rem', color: b.remaining > 0 ? '#dc2626' : '#64748b' }}>
                        {dict.loanDetail.remaining}
                      </div>
                      <div style={{ fontSize: '.8rem', fontWeight: 600, color: b.remaining > 0 ? '#b91c1c' : '#15803d' }}>
                        {formatCurrency(b.remaining, currencySymbol)}
                      </div>
                    </div>

                    <div style={{ width: '50px', textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '.72rem',
                          fontWeight: 700,
                          color: b.pct >= 100 ? '#16a34a' : b.pct > 50 ? '#d97706' : '#dc2626',
                          background: b.pct >= 100 ? '#dcfce7' : b.pct > 50 ? '#fef3c7' : '#fee2e2',
                          padding: '2px 6px',
                          borderRadius: '6px',
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
