'use client';

import React, { useMemo, useRef, useState, useTransition } from 'react';
import Link from '@/components/layout/DashboardLink';
import { formatCurrency, formatDate, formatDateLong } from '@/lib/utils';
import { fetchRecentActivities, type ActivityRange } from './actions';

// Web port of the mobile dashboard's "Recent Activities" section
// (mobile/lib/features/dashboard/dashboard_screen.dart → _RecentActivitiesSection).
// "Today" renders the dashboard's server data; other windows load on demand.

type Customer = { id: string; name: string; customerCode: string; phone?: string | null; route?: { id: string; name: string } | null };

export type PaidItem = {
  id: string;
  type: 'paid';
  receivedAmount: number;
  dueAmount: number;
  paymentMode: string;
  submittedAt: string | Date;
  customer: Customer;
  loan: { id: string; loanCode: string };
  agent?: { id: string; name: string } | null;
};
export type PendingItem = {
  id: string;
  type: 'pending';
  remainingAmount: number;
  dueDate: string | Date;
  status: 'pending' | 'partial' | 'missed';
  customer: Customer;
  loan: { id: string; loanCode: string; frequency?: string | null };
};
export type NewLoanItem = {
  id: string;
  type: 'new_loan';
  loanCode: string;
  principal: number;
  frequency: string;
  createdAt: string | Date;
  customer: Customer;
  createdBy?: { id: string; name: string } | null;
};
export type NewCustomerItem = {
  id: string;
  type: 'new_customer';
  name: string;
  customerCode: string;
  phone?: string | null;
  createdAt: string | Date;
  route?: { id: string; name: string } | null;
};
export type OtherItem = {
  id: string;
  type: 'closed_loan' | 'approval' | 'penalty';
  title: string;
  description: string;
  timestamp: string | Date;
  customerCode?: string | null;
  loanCode?: string | null;
  amount?: number | null;
};

export type ActivityBundle = {
  paidItems: PaidItem[];
  pendingItems: PendingItem[];
  newLoanItems: NewLoanItem[];
  newCustomerItems: NewCustomerItem[];
  otherItems: OtherItem[];
};

type DateFilter = 'today' | ActivityRange;
type Tab = 'all' | 'paid' | 'pending' | 'new_loans' | 'new_customers' | 'other';

type Unified =
  | { kind: 'paid'; at: number; item: PaidItem }
  | { kind: 'pending'; at: number; item: PendingItem }
  | { kind: 'new_loan'; at: number; item: NewLoanItem }
  | { kind: 'new_customer'; at: number; item: NewCustomerItem }
  | { kind: 'other'; at: number; item: OtherItem };

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDay(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function RecentActivityCard({
  currencySymbol,
  today,
  clearLabel,
  dict,
}: {
  currencySymbol: string;
  today: ActivityBundle;
  clearLabel: string;
  dict: { dashboard: Record<string, string> };
}) {
  const d = dict.dashboard;
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [ranged, setRanged] = useState<ActivityBundle | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const requestSeq = useRef(0);
  const [showCustom, setShowCustom] = useState(false);
  const now = new Date();
  const [customFrom, setCustomFrom] = useState(isoDay(new Date(now.getTime() - 7 * DAY_MS)));
  const [customTo, setCustomTo] = useState(isoDay(now));
  const [appliedCustom, setAppliedCustom] = useState<{ from: string; to: string } | null>(null);

  const bundle = dateFilter === 'today' ? today : ranged;

  function load(range: ActivityRange, custom?: { from: string; to: string }) {
    setError(false);
    const requestId = ++requestSeq.current;
    startTransition(async () => {
      try {
        const res = await fetchRecentActivities({ range, ...custom });
        if (requestId !== requestSeq.current) return; // a newer range was picked
        if (res.ok) setRanged(res.data as unknown as ActivityBundle);
        else setError(true);
      } catch {
        if (requestId === requestSeq.current) setError(true);
      }
    });
  }

  function selectFilter(filter: DateFilter) {
    if (filter === 'custom') {
      setShowCustom((v) => !v);
      return;
    }
    setShowCustom(false);
    setDateFilter(filter);
    setRanged(null);
    if (filter !== 'today') load(filter);
    else {
      requestSeq.current++; // drop any in-flight range response
      setError(false);
    }
  }

  function applyCustom() {
    if (!customFrom || !customTo || customFrom > customTo) return;
    const range = { from: customFrom, to: customTo };
    setAppliedCustom(range);
    setDateFilter('custom');
    setShowCustom(false);
    setRanged(null);
    load('custom', range);
  }

  const subtitle = useMemo(() => {
    const today0 = new Date();
    switch (dateFilter) {
      case 'today':
        return `${d.filterToday} · ${formatDateLong(today0)}`;
      case 'yesterday':
        return `${d.filterYesterday} · ${formatDateLong(new Date(today0.getTime() - DAY_MS))}`;
      case 'last7':
        return `${d.filterLast7Days} · ${formatDate(new Date(today0.getTime() - 7 * DAY_MS), 'dd MMM')} – ${formatDate(today0)}`;
      case 'last30':
        return `${d.filterLast30Days} · ${formatDate(new Date(today0.getTime() - 30 * DAY_MS), 'dd MMM')} – ${formatDate(today0)}`;
      case 'custom':
        return appliedCustom
          ? `${d.filterCustomRange} · ${formatDate(appliedCustom.from)} – ${formatDate(appliedCustom.to)}`
          : d.filterCustomRange;
    }
  }, [dateFilter, appliedCustom, d]);

  const all: Unified[] = useMemo(() => {
    if (!bundle) return [];
    const list: Unified[] = [
      ...bundle.paidItems.map((item) => ({ kind: 'paid' as const, at: new Date(item.submittedAt).getTime(), item })),
      ...bundle.pendingItems.map((item) => ({ kind: 'pending' as const, at: new Date(item.dueDate).getTime(), item })),
      ...bundle.newLoanItems.map((item) => ({ kind: 'new_loan' as const, at: new Date(item.createdAt).getTime(), item })),
      ...bundle.newCustomerItems.map((item) => ({ kind: 'new_customer' as const, at: new Date(item.createdAt).getTime(), item })),
      ...bundle.otherItems.map((item) => ({ kind: 'other' as const, at: new Date(item.timestamp).getTime(), item })),
    ];
    return list.sort((a, b) => b.at - a.at);
  }, [bundle]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tabKind: Record<Tab, Unified['kind'] | null> = {
      all: null,
      paid: 'paid',
      pending: 'pending',
      new_loans: 'new_loan',
      new_customers: 'new_customer',
      other: 'other',
    };
    return all.filter((u) => {
      const want = tabKind[tab];
      if (want && u.kind !== want) return false;
      if (!q) return true;
      const fields: (string | null | undefined)[] =
        u.kind === 'paid'
          ? [u.item.customer.name, u.item.customer.customerCode, u.item.customer.phone, u.item.customer.route?.name, u.item.loan.loanCode, u.item.agent?.name]
          : u.kind === 'pending'
            ? [u.item.customer.name, u.item.customer.customerCode, u.item.customer.phone, u.item.customer.route?.name, u.item.loan.loanCode]
            : u.kind === 'new_loan'
              ? [u.item.customer.name, u.item.customer.customerCode, u.item.customer.phone, u.item.customer.route?.name, u.item.loanCode, u.item.createdBy?.name]
              : u.kind === 'new_customer'
                ? [u.item.name, u.item.customerCode, u.item.phone, u.item.route?.name]
                : [u.item.title, u.item.description, u.item.customerCode, u.item.loanCode];
      return fields.some((f) => f?.toLowerCase().includes(q));
    });
  }, [all, tab, query]);

  const totals = useMemo(
    () => ({
      paid: bundle?.paidItems.reduce((s, i) => s + i.receivedAmount, 0) ?? 0,
      pending: bundle?.pendingItems.reduce((s, i) => s + i.remainingAmount, 0) ?? 0,
      disbursed: bundle?.newLoanItems.reduce((s, i) => s + i.principal, 0) ?? 0,
    }),
    [bundle],
  );

  function timeLabel(at: string | Date) {
    const t = new Date(at);
    const time = t.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
    const today0 = new Date();
    if (t.toDateString() === today0.toDateString()) return time;
    if (t.toDateString() === new Date(today0.getTime() - DAY_MS).toDateString()) return `${d.filterYesterday}, ${time}`;
    return `${formatDate(t, 'dd MMM')}, ${time}`;
  }

  const dateChips: { key: DateFilter; label: string; icon: string }[] = [
    { key: 'today', label: d.filterToday, icon: 'today' },
    { key: 'yesterday', label: d.filterYesterday, icon: 'history' },
    { key: 'last7', label: d.filterLast7Days, icon: 'date_range' },
    { key: 'last30', label: d.filterLast30Days, icon: 'calendar_month' },
    {
      key: 'custom',
      label: appliedCustom ? `${formatDate(appliedCustom.from, 'dd MMM')} – ${formatDate(appliedCustom.to, 'dd MMM')}` : d.filterCustomRange,
      icon: 'tune',
    },
  ];

  const kpis: { tab: Tab; icon: string; bg: string; color: string; title: string; value: string; sub: string }[] = [
    { tab: 'paid', icon: 'check_circle', bg: '#d1fae5', color: '#059669', title: d.paidStatus, value: formatCurrency(totals.paid, currencySymbol), sub: `${bundle?.paidItems.length ?? 0} ${d.recordsCount}` },
    { tab: 'pending', icon: 'hourglass_top', bg: '#fef3c7', color: '#d97706', title: d.pendingTodayDues, value: formatCurrency(totals.pending, currencySymbol), sub: `${bundle?.pendingItems.length ?? 0} ${d.recordsCount}` },
    { tab: 'new_loans', icon: 'request_quote', bg: '#dbeafe', color: '#2563eb', title: d.newLoansToday, value: formatCurrency(totals.disbursed, currencySymbol), sub: `${bundle?.newLoanItems.length ?? 0} ${d.loansCount}` },
    { tab: 'new_customers', icon: 'person_add_alt_1', bg: '#f3e8ff', color: '#9333ea', title: d.newCustomersToday, value: String(bundle?.newCustomerItems.length ?? 0), sub: d.customersCount },
  ];

  const pills: { tab: Tab; label: string; count: number }[] = [
    { tab: 'all', label: d.allActivity, count: all.length },
    { tab: 'paid', label: d.paidStatus, count: bundle?.paidItems.length ?? 0 },
    { tab: 'pending', label: d.pendingTodayDues, count: bundle?.pendingItems.length ?? 0 },
    { tab: 'new_loans', label: d.newLoansToday, count: bundle?.newLoanItems.length ?? 0 },
    { tab: 'new_customers', label: d.newCustomersToday, count: bundle?.newCustomerItems.length ?? 0 },
    { tab: 'other', label: d.otherActivity, count: bundle?.otherItems.length ?? 0 },
  ];

  const chip = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '.78rem',
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    border: `1px solid ${active ? 'var(--primary)' : '#e2e8f0'}`,
    background: active ? 'var(--primary)' : '#f8fafc',
    color: active ? '#fff' : '#334155',
    transition: 'all .15s ease',
  });

  return (
    <div className="card" style={{ marginTop: '20px', borderRadius: '16px', padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)', flexShrink: 0 }}>
            <span className="material-icons-outlined" style={{ fontSize: '22px' }}>history</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {d.recentActivities}
              {all.length > 0 && (
                <span style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--primary)', background: '#eff6ff', padding: '2px 8px', borderRadius: '12px' }}>{all.length}</span>
              )}
            </h3>
            <span style={{ fontSize: '.78rem', color: '#64748b' }}>{subtitle}</span>
          </div>
        </div>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '360px' }}>
          <span className="material-icons-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: '#94a3b8' }}>search</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={d.searchActivity}
            aria-label={d.searchActivity}
            style={{ width: '100%', padding: '8px 32px 8px 36px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '.82rem', outline: 'none', background: '#f8fafc' }}
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label={clearLabel} title={clearLabel}style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>close</span>
            </button>
          )}
        </div>
      </div>

      {/* Date filter */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px', marginBottom: showCustom ? '10px' : '16px', scrollbarWidth: 'none' }}>
        {dateChips.map((c) => (
          <button key={c.key} type="button" onClick={() => selectFilter(c.key)} style={chip(dateFilter === c.key)}>
            <span className="material-icons-outlined" style={{ fontSize: '15px' }}>{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>
      {showCustom && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '16px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '.72rem', fontWeight: 600, color: '#64748b' }}>
            {d.fromDate}
            <input type="date" className="form-control" value={customFrom} min={isoDay(new Date(now.getTime() - 365 * DAY_MS))} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '.72rem', fontWeight: 600, color: '#64748b' }}>
            {d.toDate}
            <input type="date" className="form-control" value={customTo} min={customFrom} max={isoDay(now)} onChange={(e) => setCustomTo(e.target.value)} />
          </label>
          <button type="button" className="btn btn-primary btn-sm" onClick={applyCustom} disabled={!customFrom || !customTo || customFrom > customTo}>
            {d.apply}
          </button>
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        {kpis.map((k) => {
          const active = tab === k.tab;
          return (
            <button
              key={k.tab}
              type="button"
              onClick={() => setTab(active ? 'all' : k.tab)}
              style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', background: active ? `${k.bg}80` : '#fff', border: `${active ? 1.5 : 1}px solid ${active ? k.color : '#e2e8f0'}`, transition: 'all .15s ease' }}
            >
              <span style={{ width: '34px', height: '34px', borderRadius: '8px', background: k.bg, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-icons-outlined" style={{ fontSize: '19px' }}>{k.icon}</span>
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.title}</span>
                <span style={{ display: 'block', fontSize: '1rem', fontWeight: 800, color: active ? k.color : '#1e293b' }}>{k.value}</span>
                <span style={{ display: 'block', fontSize: '.7rem', color: '#94a3b8' }}>{k.sub}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px', marginBottom: '14px', scrollbarWidth: 'none' }}>
        {pills.map((p) => (
          <button key={p.tab} type="button" onClick={() => setTab(p.tab)} style={chip(tab === p.tab)}>
            {p.label} ({p.count})
          </button>
        ))}
      </div>

      {/* List */}
      {pending && dateFilter !== 'today' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))', gap: '8px' }} aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: '58px', borderRadius: '12px' }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <span className="material-icons-outlined" style={{ fontSize: '32px', color: 'var(--danger)' }}>cloud_off</span>
          <p style={{ margin: '8px 0', fontSize: '.85rem', color: '#475569' }}>{d.activitiesLoadFailed}</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => (dateFilter === 'custom' && appliedCustom ? load('custom', appliedCustom) : dateFilter !== 'today' && load(dateFilter))}
          >
            {d.retry}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <span className="material-icons-outlined" style={{ fontSize: '40px', color: '#cbd5e1' }}>event_available</span>
          <p style={{ marginTop: '8px', fontSize: '.88rem', fontWeight: 600, color: '#475569' }}>
            {query ? d.noSearchResults : dateFilter === 'today' ? d.noActivityToday : d.noActivityRange}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))', gap: '8px', maxHeight: '560px', overflowY: 'auto', paddingRight: '2px' }}>
          {filtered.map((u) => (
            <ActivityTile key={`${u.kind}-${u.item.id}`} u={u} d={d} currencySymbol={currencySymbol} timeLabel={timeLabel} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityTile({
  u,
  d,
  currencySymbol,
  timeLabel,
}: {
  u: Unified;
  d: Record<string, string>;
  currencySymbol: string;
  timeLabel: (at: string | Date) => string;
}) {
  let icon: string, iconBg: string, iconColor: string, badge: string, badgeColor: string, title: string, amount = '', amountColor = '#1e293b';
  let meta: (string | null | undefined)[];
  let href: string | null;

  switch (u.kind) {
    case 'paid': {
      const p = u.item;
      icon = 'south'; iconBg = '#d1fae5'; iconColor = '#059669';
      badge = `${d.paidStatus} · ${p.paymentMode.toUpperCase()}`; badgeColor = '#065f46';
      title = p.customer.name;
      meta = [p.customer.customerCode, p.loan.loanCode, p.customer.route?.name, p.agent?.name, timeLabel(p.submittedAt)];
      amount = `+${formatCurrency(p.receivedAmount, currencySymbol)}`; amountColor = '#059669';
      href = `/customers/${p.customer.customerCode}`;
      break;
    }
    case 'pending': {
      const p = u.item;
      const missed = p.status === 'missed';
      icon = 'hourglass_top'; iconBg = missed ? '#fee2e2' : '#fef3c7'; iconColor = missed ? '#dc2626' : '#d97706';
      badge = missed ? d.missedStatus : p.status === 'partial' ? d.partialStatus : d.dueStatus; badgeColor = missed ? '#991b1b' : '#92400e';
      title = p.customer.name;
      meta = [p.customer.customerCode, p.loan.loanCode, p.customer.route?.name, formatDate(p.dueDate, 'dd MMM')];
      amount = formatCurrency(p.remainingAmount, currencySymbol); amountColor = missed ? 'var(--danger)' : '#d97706';
      href = `/collection?search=${encodeURIComponent(p.customer.customerCode)}`;
      break;
    }
    case 'new_loan': {
      const l = u.item;
      icon = 'receipt_long'; iconBg = '#dbeafe'; iconColor = '#2563eb';
      badge = d.newLoanBadge; badgeColor = '#1e40af';
      title = l.customer.name;
      meta = [l.loanCode, l.frequency?.toUpperCase(), l.createdBy?.name, timeLabel(l.createdAt)];
      amount = formatCurrency(l.principal, currencySymbol); amountColor = '#1e40af';
      href = `/loans/${l.loanCode}`;
      break;
    }
    case 'new_customer': {
      const c = u.item;
      icon = 'person_add'; iconBg = '#f3e8ff'; iconColor = '#9333ea';
      badge = d.newCustomerBadge; badgeColor = '#6b21a8';
      title = c.name;
      meta = [c.customerCode, c.route?.name, c.phone, timeLabel(c.createdAt)];
      href = `/customers/${c.customerCode}`;
      break;
    }
    default: {
      const o = u.item;
      icon = o.type === 'closed_loan' ? 'task_alt' : 'notifications_active'; iconBg = '#f1f5f9'; iconColor = '#475569';
      badge = o.type === 'closed_loan' ? d.loanClosed : o.type === 'approval' ? d.approvalUpdated : d.penaltySettled; badgeColor = '#475569';
      title = o.title;
      meta = [o.description, timeLabel(o.timestamp)];
      if (o.amount) amount = formatCurrency(o.amount, currencySymbol);
      href = o.type === 'approval' ? '/approvals' : o.loanCode ? `/loans/${o.loanCode}` : null;
    }
  }

  const body = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px' }}>
      <span style={{ width: '38px', height: '38px', borderRadius: '10px', background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span className="material-icons-outlined" style={{ fontSize: '20px' }}>{icon}</span>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: '.86rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
          <span style={{ flexShrink: 0, fontSize: '.62rem', fontWeight: 800, textTransform: 'uppercase', color: badgeColor, background: iconBg, padding: '2px 6px', borderRadius: '5px', letterSpacing: '.02em' }}>{badge}</span>
        </span>
        <span style={{ display: 'block', fontSize: '.72rem', color: '#64748b', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {meta.filter(Boolean).join(' · ')}
        </span>
      </span>
      {amount && <span style={{ fontWeight: 800, fontSize: '.9rem', color: amountColor, whiteSpace: 'nowrap' }}>{amount}</span>}
      {href && <span className="material-icons-outlined" style={{ fontSize: '18px', color: '#cbd5e1' }}>chevron_right</span>}
    </div>
  );

  const box: React.CSSProperties = { display: 'block', background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: '12px', textDecoration: 'none', color: 'inherit' };
  return href ? (
    <Link href={href} style={box}>{body}</Link>
  ) : (
    <div style={box}>{body}</div>
  );
}
