'use client';
import Link from 'next/link';

interface Props {
  agentName:        string;
  todayExpected:    number;
  todayCollected:   number;
  weekData:         { date: string; collected: number; expected: number }[];
  monthCollected:   number;
  monthExpected:    number;
  activeLoanCount:  number;
  overdueCount:     number;
  myCustomerCount:  number;
  pendingTodayCount:number;
  recentCollections:{ customerName: string; customerCode: string; loanCode: string; amount: number; time: string }[];
  currencySymbol:   string;
  modulePrefix:     string;
  dict:             any;
}

export default function AgentDashboardClient(p: Props) {
  const fmt   = (n: number) => `${p.currencySymbol}${n.toLocaleString('en-IN')}`;
  const pct   = (a: number, b: number) => b === 0 ? 0 : Math.min(100, Math.round((a / b) * 100));
  const todayPct  = pct(p.todayCollected, p.todayExpected);
  const monthPct  = pct(p.monthCollected, p.monthExpected);
  const maxExpected = Math.max(...p.weekData.map(d => d.expected), 1);

  const hitColor = (h: number) => h >= 80 ? 'var(--success)' : h >= 50 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="page-content">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            {new Date().getHours() < 12 ? p.dict.dashboard.goodMorning : p.dict.dashboard.goodAfternoon},{' '}
            {p.agentName.split(' ')[0]} 👋
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link 
          href={`/${p.modulePrefix}/collection`} 
          className="btn btn-primary"
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>payments</span>
          {p.dict.collection.title}
        </Link>
      </div>

      {/* ── Today's progress card ──────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '16px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              {p.dict.dashboard.todayCollection}
            </div>
            <div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--primary)' }}>
              {fmt(p.todayCollected)}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {p.dict.reports.expected}: {fmt(p.todayExpected)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '40px', fontWeight: 800, color: hitColor(todayPct), lineHeight: 1 }}>
              {todayPct}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{p.dict.dashboard.hitRate}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background: 'var(--border)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
          <div style={{
            width: `${todayPct}%`, height: '100%',
            background: hitColor(todayPct),
            borderRadius: '4px',
            transition: 'width 0.6s ease',
          }} />
        </div>

        {/* Pending alert */}
        {p.pendingTodayCount > 0 && (
          <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--warning)', fontWeight: 500 }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>schedule</span>
            {p.pendingTodayCount} {p.dict.dashboard.pendingToday}
          </div>
        )}
      </div>

      {/* ── KPI grid ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: p.dict.dashboard.myCustomers, value: p.myCustomerCount, color: 'var(--primary)' },
          { label: p.dict.dashboard.activeLoans, value: p.activeLoanCount, color: 'var(--success)' },
          { label: `${p.dict.loansList.overdue} ${p.dict.sidebar.loans}`, value: p.overdueCount,    color: 'var(--danger)' },
          { label: p.dict.dashboard.monthRate,   value: `${monthPct}%`,    color: hitColor(monthPct) },
        ].map(k => (
          <div key={k.label} className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── 7-day bar chart ───────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '16px', padding: '20px' }}>
        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '14px' }}>{p.dict.dashboard.last7Days}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '100px' }}>
          {p.weekData.map((day, i) => {
            const expH  = Math.round((day.expected  / maxExpected) * 80);
            const colH  = Math.round((day.collected / maxExpected) * 80);
            const rate  = day.expected > 0 ? Math.round((day.collected / day.expected) * 100) : 0;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }} title={`${day.date}: ${rate}% (${fmt(day.collected)} of ${fmt(day.expected)})`}>
                <div style={{ position: 'relative', width: '100%', height: `${Math.max(expH, 6)}px`, background: 'var(--border)', borderRadius: '4px 4px 0 0', minHeight: '6px' }}>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${colH}px`, background: hitColor(rate), borderRadius: '4px 4px 0 0', minHeight: colH > 0 ? '4px' : '0', transition: 'height 0.5s ease' }} />
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{day.date}</div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: '12px', display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <span>■ <span style={{ color: 'var(--success)' }}>{p.dict.reports.collected}</span></span>
          <span>■ <span style={{ color: 'var(--border)' }}>{p.dict.reports.expected}</span></span>
          <span style={{ marginLeft: 'auto' }}>MTD: {fmt(p.monthCollected)} / {fmt(p.monthExpected)} ({monthPct}%)</span>
        </div>
      </div>

      {/* ── Recent collections ───────────────────────────────────── */}
      {p.recentCollections.length > 0 && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>{p.dict.dashboard.recentCollections}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {p.recentCollections.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < p.recentCollections.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{c.customerName}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {c.loanCode} ({c.customerCode}) · {c.time}
                  </div>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--success)' }}>{fmt(c.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
