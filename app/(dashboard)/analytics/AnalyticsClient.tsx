'use client';

import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import type { AnalyticsData } from './actions';
import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
} from 'recharts';

export default function AnalyticsClient({ data, currencySymbol }: { data: AnalyticsData; currencySymbol: string }) {
  const [borrowerFilter, setBorrowerFilter] = useState<'volume' | 'nodela' | 'overdue'>('volume');
  const fc = (n: number) => formatCurrency(n, currencySymbol);
  const eff = data.collectionEfficiency;
  const p = data.portfolio;
  const wow = data.prevWeekCollected > 0
    ? Math.round(((data.currentWeekCollected - data.prevWeekCollected) / data.prevWeekCollected) * 100)
    : 0;

  const sortedBorrowers = [...data.borrowerLeaderboard].filter(b => {
    if (borrowerFilter === 'nodela') {
      return b.totalActivePrincipal > 0 && b.overdueAmount === 0;
    }
    if (borrowerFilter === 'overdue') {
      return b.overdueAmount > 0;
    }
    return b.totalActivePrincipal > 0; // volume
  }).sort((a, b) => {
    if (borrowerFilter === 'nodela' || borrowerFilter === 'volume') {
      return b.totalActivePrincipal - a.totalActivePrincipal;
    }
    return b.overdueAmount - a.overdueAmount;
  }).slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── TOP KPI ROW ── */}
      <div className="kpi-grid">
        {/* Efficiency */}
        <div className="kpi-card" style={{ background: `linear-gradient(135deg, ${eff.color}22, ${eff.color}11)`, border: `1px solid ${eff.color}33` }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: eff.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.1rem', fontWeight: 800, flexShrink: 0 }}>
            {eff.pct}%
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: eff.color }}>{eff.label}</div>
            <div className="kpi-label">Collection Efficiency</div>
            <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>{fc(eff.collected)} / {fc(eff.expected)}</div>
          </div>
        </div>

        {/* Capital */}
        <div className="kpi-card">
          <div className={`kpi-icon ${data.capitalBalance >= 0 ? 'green' : 'red'}`}><span className="material-icons-outlined">savings</span></div>
          <div>
            <div className="kpi-value">{fc(data.capitalBalance)}</div>
            <div className="kpi-label">Capital Balance</div>
          </div>
        </div>

        {/* Active Portfolio */}
        <div className="kpi-card">
          <div className="kpi-icon blue"><span className="material-icons-outlined">account_balance</span></div>
          <div>
            <div className="kpi-value">{fc(p.activePrincipal)}</div>
            <div className="kpi-label">Active Portfolio</div>
            <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)' }}>{p.activeCount} loans</div>
          </div>
        </div>

        {/* Recovery */}
        <div className="kpi-card">
          <div className="kpi-icon green"><span className="material-icons-outlined">trending_up</span></div>
          <div>
            <div className="kpi-value">{p.recoveryRatio}%</div>
            <div className="kpi-label">Recovery Ratio</div>
          </div>
        </div>
      </div>

      {/* ── COLLECTION TREND + FUNNEL ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>
        <div className="card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-icons-outlined" style={{ color: 'var(--primary)', fontSize: 20 }}>show_chart</span>
              Collection Trend (7 Days)
            </h3>
            {wow !== 0 && (
              <span style={{ fontSize: '.78rem', fontWeight: 700, color: wow > 0 ? '#10B981' : '#EF4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="material-icons-outlined" style={{ fontSize: 16 }}>{wow > 0 ? 'trending_up' : 'trending_down'}</span>
                {wow > 0 ? '+' : ''}{wow}% vs last week
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.trend7d}>
              <defs>
                <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} /><stop offset="100%" stopColor="#3B82F6" stopOpacity={0} /></linearGradient>
                <linearGradient id="gCol" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10B981" stopOpacity={0} /></linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v: any) => fc(v)} contentStyle={{ borderRadius: 10, fontSize: '.82rem' }} />
              <Area type="monotone" dataKey="expected" stroke="#3B82F6" fill="url(#gExp)" strokeWidth={2} name="Expected" />
              <Area type="monotone" dataKey="collected" stroke="#10B981" fill="url(#gCol)" strokeWidth={2} name="Collected" />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: '.75rem' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#3B82F6', borderRadius: 2, marginRight: 4 }} />Expected</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#10B981', borderRadius: 2, marginRight: 4 }} />Collected</span>
          </div>
        </div>

        {/* Collection Funnel */}
        <div className="card">
          <div className="card-header"><h3>Collection Funnel</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
            {data.collectionFunnel.map((step, i) => {
              const maxCount = Math.max(1, data.collectionFunnel[0]?.count || 1);
              const pct = Math.max(8, (step.count / maxCount) * 100);
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                    <span>{step.label}</span><span>{step.count}</span>
                  </div>
                  <div style={{ height: 10, borderRadius: 5, background: '#f1f5f9', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: step.color, borderRadius: 5, transition: 'width .5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
          {/* Cash/UPI split */}
          {(data.todayCashCollected > 0 || data.todayUpiCollected > 0) && (
            <div style={{ marginTop: 12, padding: '12px', background: '#f8fafc', borderRadius: 10 }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>Today&apos;s Split</div>
              <div style={{ display: 'flex', gap: 16, fontSize: '.8rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#27AE60' }} />Cash: <b>{fc(data.todayCashCollected)}</b></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#8E44AD' }} />UPI: <b>{fc(data.todayUpiCollected)}</b></span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RISK & AGING ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
        {/* Risk Score */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <h3 style={{ fontSize: '.9rem', fontWeight: 700, margin: '0 0 8px' }}>Portfolio Risk Score</h3>
          <div style={{ width: 140, height: 140 }}>
            <ResponsiveContainer>
              <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" startAngle={180} endAngle={0} data={[{ value: data.riskScore.score, fill: data.riskScore.color }]}>
                <RadialBar dataKey="value" cornerRadius={10} background={{ fill: '#f1f5f9' }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: -20, textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: data.riskScore.color }}>{data.riskScore.score}</div>
            <div style={{ fontSize: '.85rem', fontWeight: 700, color: data.riskScore.color, marginTop: 2 }}>{data.riskScore.label} Risk</div>
          </div>
          <div style={{ marginTop: 16, fontSize: '.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Based on overdue ratio, missed EMIs, and penalty accumulation
          </div>
        </div>

        {/* Aging Analysis */}
        <div className="card">
          <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-icons-outlined" style={{ color: 'var(--primary)', fontSize: 20 }}>timer</span>
              Aging Analysis (Overdue Tracker)
            </h3>
            <p style={{ margin: 0, fontSize: '.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Categorizes total unpaid amount by how many days late it is. 1–7 days means recently missed (low risk), while 90+ days indicates long-term default (NPA). This helps lenders evaluate portfolio risk and prioritize collection follow-ups.
            </p>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Overdue Age</th><th style={{ textAlign: 'center' }}>Count</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
              </thead>
              <tbody>
                {data.agingBuckets.map((b, i) => (
                  <tr key={i}>
                    <td><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: b.color, marginRight: 8 }} />{b.label}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{b.count}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: b.color }}>{fc(b.amount)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                  <td>Total</td>
                  <td style={{ textAlign: 'center' }}>{data.agingBuckets.reduce((s, b) => s + b.count, 0)}</td>
                  <td style={{ textAlign: 'right', color: '#EF4444' }}>{fc(data.agingBuckets.reduce((s, b) => s + b.amount, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── AGENT LEADERBOARD & FREQUENCY PORTFOLIO ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Shrunk Agent Leaderboard */}
        <div className="card" style={{ height: 'fit-content' }}>
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-icons-outlined" style={{ fontSize: 18, color: '#F59E0B' }}>emoji_events</span>
              Agent Leaderboard (This Week)
            </h3>
          </div>
          {data.agentLeaderboard.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>#</th><th>Agent</th><th style={{ textAlign: 'right' }}>Collections</th></tr></thead>
                <tbody>
                  {data.agentLeaderboard.slice(0, 5).map((a, i) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 700, color: i === 0 ? '#F59E0B' : 'var(--text-secondary)' }}>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{a.name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{fc(a.collected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-light)', fontSize: '.85rem' }}>No collection data this week.</div>
          )}
        </div>

        {/* Loan Frequency Portfolio Card */}
        <div className="card" style={{ height: 'fit-content' }}>
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-icons-outlined" style={{ fontSize: 18, color: 'var(--primary)' }}>pie_chart</span>
              Portfolio by Frequency
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
            {(() => {
              const freqItems = [
                { label: 'Daily', value: data.frequencyTotals.daily, color: '#3B82F6' },
                { label: 'Weekly', value: data.frequencyTotals.weekly, color: '#10B981' },
                { label: 'Bi-Weekly', value: data.frequencyTotals.biweekly, color: '#F59E0B' },
                { label: 'Monthly', value: data.frequencyTotals.monthly, color: '#8B5CF6' },
              ];
              const maxVal = Math.max(1, ...freqItems.map(f => f.value));
              return freqItems.map((f, i) => {
                const pct = Math.max(8, (f.value / maxVal) * 100);
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                      <span>{f.label}</span><span>{fc(f.value)}</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 5, background: '#f1f5f9', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: f.color, borderRadius: 5, transition: 'width .5s ease' }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* ── ROUTE HEALTH ── */}
      {data.routeHealth.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {data.routeHealth.map((r, i) => (
            <div key={i} className="card" style={{ padding: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: 8 }}>{r.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', color: 'var(--text-secondary)' }}>
                <span>{r.customers} customers</span>
                <span style={{ color: r.overdue > 0 ? '#EF4444' : '#10B981', fontWeight: 700 }}>
                  {r.overdue > 0 ? fc(r.overdue) + ' overdue' : '✓ Clear'}
                </span>
              </div>
              {r.collected > 0 && <div style={{ fontSize: '.72rem', color: '#10B981', marginTop: 4 }}>Collected today: {fc(r.collected)}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ── BORROWER LEADERBOARD ── */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-icons-outlined" style={{ fontSize: 18, color: '#3B82F6' }}>groups</span>
            Borrower Leaderboard
          </h3>
          <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
            {[
              { id: 'volume', label: 'Highest Loan' },
              { id: 'nodela', label: 'No Delayers' },
              { id: 'overdue', label: 'Critical Overdue' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setBorrowerFilter(tab.id as any)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  fontSize: '.72rem',
                  fontWeight: 600,
                  border: 'none',
                  background: borrowerFilter === tab.id ? '#fff' : 'transparent',
                  color: borrowerFilter === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  boxShadow: borrowerFilter === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {sortedBorrowers.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th style={{ textAlign: 'right' }}>Active Principal</th>
                  <th style={{ textAlign: 'right' }}>Overdue Amount</th>
                  <th style={{ textAlign: 'center' }}>Missed EMIs</th>
                </tr>
              </thead>
              <tbody>
                {sortedBorrowers.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.name}</strong><br />
                      <span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{b.customerCode}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fc(b.totalActivePrincipal)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: b.overdueAmount > 0 ? '#EF4444' : '#10B981' }}>{fc(b.overdueAmount)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{b.missedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-light)', fontSize: '.85rem' }}>No borrowers found for this filter.</div>
        )}
      </div>

      {/* ── SEGMENTS + FORECAST ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
        {/* Borrower Segments */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="card-header" style={{ width: '100%' }}><h3>Borrower Segments</h3></div>
          <div style={{ width: 200, height: 200 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data.borrowerSegments.filter(s => s.count > 0)} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {data.borrowerSegments.filter(s => s.count > 0).map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 }}>
            {data.borrowerSegments.filter(s => s.count > 0).map((s, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '.72rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />{s.label}: <b>{s.count}</b>
              </span>
            ))}
          </div>
        </div>

        {/* Cashflow Forecast */}
        <div className="card">
          <div className="card-header">
            <h3>Cashflow Forecast</h3>
            <div style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>
              30-day expected: <b style={{ color: 'var(--primary)' }}>{fc(data.cashflowForecast30d.total)}</b>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.cashflowForecast7d}>
              <defs>
                <linearGradient id="gFc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} /><stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} /></linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v: any) => fc(v)} contentStyle={{ borderRadius: 10, fontSize: '.82rem' }} />
              <Area type="monotone" dataKey="expected" stroke="#8B5CF6" fill="url(#gFc)" strokeWidth={2} name="Expected Inflow" />
              <Area type="monotone" dataKey="cumulative" stroke="#3B82F6" fill="none" strokeWidth={2} strokeDasharray="5 5" name="Cumulative" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── PORTFOLIO SUMMARY ── */}
      <div className="card">
        <div className="card-header"><h3>Portfolio Summary</h3></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
          {[
            { label: 'Total Disbursed', value: fc(p.totalDisbursed), icon: 'payments', color: '#3B82F6' },
            { label: 'Active Principal', value: fc(p.activePrincipal), icon: 'account_balance', color: '#F59E0B' },
            { label: 'Total Recovered', value: fc(p.totalRecovered), icon: 'savings', color: '#10B981' },
            { label: 'NPA / Overdue', value: fc(p.npaAmount), icon: 'warning', color: '#EF4444' },
            { label: 'Avg Loan Size', value: fc(p.avgLoanSize), icon: 'bar_chart', color: '#8B5CF6' },
            { label: 'EMI Pressure', value: `${data.emiPressure.count} customers`, icon: 'schedule', color: '#F97316' },
          ].map((item, i) => (
            <div key={i} style={{ padding: '14px', background: `${item.color}08`, borderRadius: 12, border: `1px solid ${item.color}20` }}>
              <span className="material-icons-outlined" style={{ fontSize: 18, color: item.color }}>{item.icon}</span>
              <div style={{ fontSize: '1rem', fontWeight: 800, marginTop: 4 }}>{item.value}</div>
              <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ATTENTION + INSIGHTS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>
        {/* Loans Requiring Attention */}
        <div className="card">
          <div className="card-header"><h3 style={{ color: '#EF4444' }}>⚠ Loans Requiring Attention</h3></div>
          {data.attentionLoans.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Customer</th><th>Overdue</th><th>Amount</th><th>Risk</th><th>Action</th></tr></thead>
                <tbody>
                  {data.attentionLoans.map((loan, i) => (
                    <tr key={i}>
                      <td>
                        <strong>{loan.customerName}</strong><br />
                        <span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{loan.loanCode}</span>
                      </td>
                      <td>{loan.overdueDays}d</td>
                      <td style={{ fontWeight: 700, color: '#EF4444' }}>{fc(loan.overdueAmount)}</td>
                      <td>
                        <span style={{ background: `${loan.riskColor}18`, color: loan.riskColor, padding: '2px 8px', borderRadius: 10, fontSize: '.7rem', fontWeight: 700 }}>
                          {loan.riskLevel}
                        </span>
                        {loan.badges.map((b, j) => (
                          <span key={j} style={{ display: 'block', fontSize: '.65rem', color: '#EF4444', marginTop: 2 }}>• {b}</span>
                        ))}
                      </td>
                      <td><Link href={`/loans/${loan.loanId}`} className="btn btn-ghost btn-sm">View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--success)' }}>
              <span className="material-icons-outlined" style={{ fontSize: 36 }}>check_circle</span>
              <p style={{ marginTop: 8, fontSize: '.85rem' }}>No urgent loans requiring attention.</p>
            </div>
          )}
        </div>

        {/* Smart Insights + Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-header"><h3>💡 Smart Insights</h3></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.smartInsights.map((ins, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: `${ins.color}0A`, borderRadius: 10, border: `1px solid ${ins.color}20` }}>
                  <span className="material-icons-outlined" style={{ color: ins.color, fontSize: 20 }}>{ins.icon}</span>
                  <span style={{ fontSize: '.82rem', color: 'var(--text-primary)' }}>{ins.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Recent Activity</h3></div>
            <div style={{ maxHeight: 250, overflow: 'auto' }}>
              {data.operationalFeed.slice(0, 8).map(log => (
                <div className="activity-item" key={log.id}>
                  <div className="activity-dot" />
                  <div style={{ flex: 1 }}>
                    <div className="activity-text"><strong>{log.user}</strong> — {log.action} {log.entity}</div>
                    <div className="activity-time">{formatDate(log.time)}</div>
                  </div>
                </div>
              ))}
              {data.operationalFeed.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-light)', fontSize: '.85rem' }}>No activity.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
