'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatIndianCurrency } from '@/lib/accounting/utils';
import {
  AcStyles, AcKpiCard, AcCard, AcButton, AcEmpty,
  AcSectionHead, AcPageHeader, AcAmt, AcBadge, AcSelect,
} from './ui';

interface DashboardClientProps {
  module: string;
  period: { from: string; to: string; label: string };
  cashBankNow: number;
  cashBankPrev: number;
  pnl: number;
  pnlPrev: number;
  ar: number;
  ap: number;
  cashflowSeries: Array<{ date: string; inflow: number; outflow: number }>;
  topExpenses: Array<{ accountId: string; name: string; total: number }>;
  pendingApprovals: any[];
  billsDueSoon: any[];
  periodStatus: { status: string; lastLockedAt: string | null } | null;
}

const PERIOD_OPTIONS = [
  { value: 'this_month',   label: 'This Month' },
  { value: 'last_month',   label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year',    label: 'This Year' },
];

const EXPENSE_COLORS = ['#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe'];

function pctDelta(now: number, prev: number): number {
  if (prev === 0) return Infinity;
  return ((now - prev) / Math.abs(prev)) * 100;
}

function shortDate(s: string) {
  const [, m, d] = s.split('-');
  return `${d}/${m}`;
}

const PERIOD_STATUS_MAP: Record<string, string> = {
  open: 'open', soft_locked: 'soft_locked', locked: 'locked', closed: 'closed',
};

export default function DashboardClient({
  module, period, cashBankNow, cashBankPrev, pnl, pnlPrev,
  ar, ap, cashflowSeries, topExpenses, pendingApprovals, billsDueSoon, periodStatus,
}: DashboardClientProps) {
  const selectedPeriod = PERIOD_OPTIONS.find(o => o.label === period.label)?.value ?? 'this_month';
  const totalExpense = topExpenses.reduce((s, e) => s + e.total, 0);
  const psKey = periodStatus ? (PERIOD_STATUS_MAP[periodStatus.status] ?? 'open') : null;

  const PERIOD_STATUS_LABELS: Record<string, string> = {
    open: 'Open', soft_locked: 'Soft Locked', locked: 'Locked', closed: 'Closed',
  };

  const quickActions = [
    { label: 'New Journal Entry', icon: 'add_circle', href: `/${module}/accounting/premium/journal/new`, color:'#6366f1' },
    { label: 'Add Bill',          icon: 'receipt',    href: `/${module}/accounting/premium/vendors`,     color:'#f59e0b' },
    { label: 'Bank Reconcile',    icon: 'sync_alt',   href: `/${module}/accounting/premium/bank-rec`,   color:'#10b981' },
    { label: 'GST Report',        icon: 'description',href: `/${module}/accounting/premium/tax`,         color:'#3b82f6' },
    { label: 'Tally Export',      icon: 'upload_file',href: `/${module}/accounting/premium/export`,      color:'#8b5cf6' },
  ];

  return (
    <>
      <AcStyles />
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Toggle if premium is enabled */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'var(--bg)', padding: '6px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <a href={`/${module}/accounting`} className="btn btn-ghost" style={{ flex: 1, textAlign: 'center' }}>Basic Accounting</a>
          <button className="btn btn-primary" style={{ flex: 1, pointerEvents: 'none' }}>Premium Accounting</button>
        </div>

        {/* Page header */}
        <AcPageHeader
          title="Accounting Overview"
          subtitle={period.label}
          badge={psKey ? (
            <AcBadge status={psKey}>{PERIOD_STATUS_LABELS[psKey] ?? psKey}</AcBadge>
          ) : undefined}
          actions={
            <AcSelect
              value={selectedPeriod}
              onChange={e => { window.location.href = `/${module}/accounting/premium?period=${e.target.value}`; }}
              style={{ minWidth: 140 }}
            >
              {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </AcSelect>
          }
        />

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14, marginBottom: 20 }}>
          <AcKpiCard
            label="Cash & Bank"
            value={formatIndianCurrency(cashBankNow)}
            icon="account_balance_wallet"
            iconColor="#6366f1"
            accent="#6366f1"
            delta={{ value: pctDelta(cashBankNow, cashBankPrev), label: 'vs prev period' }}
          />
          <AcKpiCard
            label="Net Profit / Loss"
            value={formatIndianCurrency(pnl)}
            icon="trending_up"
            iconColor="#10b981"
            accent="#10b981"
            delta={{ value: pctDelta(pnl, pnlPrev), label: 'vs prev period' }}
          />
          <AcKpiCard
            label="Loans Receivable"
            value={formatIndianCurrency(ar)}
            icon="payments"
            iconColor="#3b82f6"
            accent="#3b82f6"
          />
          <AcKpiCard
            label="Bills Payable"
            value={formatIndianCurrency(ap)}
            icon="receipt_long"
            iconColor="#f59e0b"
            accent="#f59e0b"
            delta={ap > 0 ? { value: 0, invert: true } : undefined}
          />
        </div>

        {/* Charts + Expenses */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, marginBottom: 16 }}>

          {/* Cashflow chart */}
          <AcCard>
            <AcSectionHead
              title="Cash Flow"
              action={
                <div style={{ display: 'flex', gap: 14, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  <span><span style={{ display: 'inline-block', width: 10, height: 3, background: '#6366f1', borderRadius: 2, verticalAlign: 'middle', marginRight: 4 }} />Inflow</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 3, background: '#f43f5e', borderRadius: 2, verticalAlign: 'middle', marginRight: 4 }} />Outflow</span>
                </div>
              }
            />
            {cashflowSeries.length === 0 ? (
              <AcEmpty icon="show_chart" text="No cashflow data this period" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={cashflowSeries} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="ig" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="og" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fill: '#9ca3af' }}
                    interval={Math.max(0, Math.floor(cashflowSeries.length / 8))} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => v >= 100000 ? `${(v/100000).toFixed(0)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                  <Tooltip
                    formatter={(v: any, n: any) => [formatIndianCurrency(Number(v)), n === 'inflow' ? 'Inflow' : 'Outflow']}
                    labelFormatter={(l: any) => `Date: ${l}`}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}
                  />
                  <Area type="monotone" dataKey="inflow"  stroke="#6366f1" strokeWidth={2} fill="url(#ig)" dot={false} />
                  <Area type="monotone" dataKey="outflow" stroke="#f43f5e" strokeWidth={2} fill="url(#og)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </AcCard>

          {/* Top Expenses */}
          <AcCard>
            <AcSectionHead title="Top Expenses" />
            {topExpenses.length === 0 ? (
              <AcEmpty icon="pie_chart" text="No expenses this period." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topExpenses.map((exp, i) => {
                  const pct = totalExpense > 0 ? (exp.total / totalExpense) * 100 : 0;
                  return (
                    <a key={exp.accountId} href={`/${module}/accounting/premium/journal?accountId=${exp.accountId}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 3 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%', fontWeight: 500 }}>{exp.name}</span>
                        <AcAmt value={exp.total} color={EXPENSE_COLORS[i] ?? '#6b7280'} />
                      </div>
                      <div style={{ height: 5, borderRadius: 99, background: 'var(--border,#e5e7eb)' }}>
                        <div style={{ height: 5, borderRadius: 99, width: `${pct}%`, background: EXPENSE_COLORS[i] ?? '#6366f1', transition: 'width .3s' }} />
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </AcCard>
        </div>

        {/* Approvals + Bills */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* Pending approvals */}
          <AcCard>
            <AcSectionHead
              title="Pending Approvals"
              action={
                <AcButton as="a" variant="link" size="sm" href={`/${module}/accounting/premium/approvals`}>
                  View all →
                </AcButton>
              }
            />
            {pendingApprovals.length === 0 ? (
              <AcEmpty icon="check_circle" text="All clear — no pending approvals" />
            ) : pendingApprovals.slice(0, 5).map((ap: any) => (
              <div key={ap.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border,#f3f4f6)' }}>
                <div>
                  <div style={{ fontSize: '0.83rem', fontWeight: 600 }}>
                    {ap.entityType === 'journal_entry' ? 'Journal Entry' : ap.entityType}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>by {ap.requestedBy?.name ?? '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <AcAmt value={ap.amount} />
                  <div style={{ marginTop: 2 }}>
                    <AcBadge status="pending">L{ap.level}</AcBadge>
                  </div>
                </div>
              </div>
            ))}
          </AcCard>

          {/* Bills due soon */}
          <AcCard>
            <AcSectionHead
              title="Bills Due Soon"
              action={
                <AcButton as="a" variant="link" size="sm" href={`/${module}/accounting/premium/vendors?tab=bills`}>
                  View all →
                </AcButton>
              }
            />
            {billsDueSoon.length === 0 ? (
              <AcEmpty icon="event_available" text="No bills due soon" />
            ) : billsDueSoon.slice(0, 5).map((bill: any) => {
              const outstanding = Number(bill.totalAmount) - Number(bill.paidAmount);
              const daysLeft = Math.ceil((new Date(bill.dueDate).getTime() - Date.now()) / 86400000);
              return (
                <div key={bill.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border,#f3f4f6)' }}>
                  <div>
                    <div style={{ fontSize: '0.83rem', fontWeight: 600 }}>{bill.billNo}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{bill.vendor?.name ?? '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <AcAmt value={outstanding} color="#dc2626" />
                    <div style={{ marginTop: 2 }}>
                      <AcBadge status={daysLeft <= 0 ? 'overdue' : daysLeft <= 2 ? 'warning' : 'pending'}>
                        {daysLeft <= 0 ? 'Overdue' : `${daysLeft}d left`}
                      </AcBadge>
                    </div>
                  </div>
                </div>
              );
            })}
          </AcCard>
        </div>

        {/* Quick Actions */}
        <AcCard>
          <AcSectionHead title="Quick Actions" />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {quickActions.map(a => (
              <AcButton
                key={a.href}
                as="a"
                variant="ghost"
                icon={a.icon}
                href={a.href}
              >
                {a.label}
              </AcButton>
            ))}
          </div>
        </AcCard>

      </div>
    </>
  );
}
