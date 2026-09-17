'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';

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
  recentCollections:{ customerName: string; customerCode: string; loanCode: string; amount: number; time: string; preferredCollectionTime?: string | null }[];
  currencySymbol:   string;
  modulePrefix:     string;
  dict:             any;
}

export default function AgentDashboardClient(p: Props) {
  const [sessionFilter, setSessionFilter] = useState('');
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const fmt   = (n: number) => `${p.currencySymbol}${n.toLocaleString('en-IN')}`;
  const pct   = (a: number, b: number) => b === 0 ? 0 : Math.min(100, Math.round((a / b) * 100));
  const todayPct  = pct(p.todayCollected, p.todayExpected);
  const monthPct  = pct(p.monthCollected, p.monthExpected);

  // Safe ceiling that scales against BOTH collected and expected across all days, with a non-zero floor.
  // This guarantees bar height percentages can never exceed 100%.
  const maxVal = Math.max(1, ...p.weekData.flatMap(d => [d.expected, d.collected]));

  const hitColor = (h: number) => h >= 80 ? 'var(--success)' : h >= 50 ? 'var(--warning)' : 'var(--danger)';
  const visibleRecentCollections = useMemo(() => {
    const known = ['morning', 'afternoon', 'evening', 'night'];
    return p.recentCollections.filter((collection) => {
      const session = (collection.preferredCollectionTime || '').toLowerCase();
      return !sessionFilter
        || (sessionFilter === 'anytime' && !session)
        || (sessionFilter === 'other' && !!session && !known.includes(session))
        || session === sessionFilter;
    });
  }, [p.recentCollections, sessionFilter]);

  return (
    <div className="page-content">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
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
            <div style={{ fontSize: '36px', fontWeight: 800, color: hitColor(todayPct), lineHeight: 1 }}>
              {todayPct}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 600 }}>{p.dict.dashboard.hitRate}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background: 'var(--border)', borderRadius: '6px', height: '8px', overflow: 'hidden', width: '100%' }}>
          <div style={{
            width: `${Math.min(100, Math.max(0, todayPct))}%`, height: '100%',
            background: hitColor(todayPct),
            borderRadius: '6px',
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
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '12px',
        marginBottom: '16px'
      }}>
        {[
          { label: p.dict.dashboard.myCustomers, value: p.myCustomerCount, color: 'var(--primary)' },
          { label: p.dict.dashboard.activeLoans, value: p.activeLoanCount, color: 'var(--success)' },
          { label: `${p.dict.loansList.overdue} ${p.dict.sidebar.loans}`, value: p.overdueCount,    color: 'var(--danger)' },
          { label: p.dict.dashboard.monthRate,   value: `${monthPct}%`,    color: hitColor(monthPct) },
        ].map(k => (
          <div key={k.label} className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 500 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── 7-day bar chart ───────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '16px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>{p.dict.dashboard.last7Days}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--success)' }} />
              {p.dict.reports.collected}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#cbd5e1' }} />
              {p.dict.reports.expected}
            </span>
          </div>
        </div>

        {/* Scrollable container for mobile so bars remain well-spaced */}
        <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '4px' }}>
          <div style={{ minWidth: '380px', position: 'relative', height: '170px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            
            {/* Bars container */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${p.weekData.length}, 1fr)`, gap: '10px', alignItems: 'flex-end', height: '130px', position: 'relative' }}>
              {p.weekData.map((day, i) => {
                const expPct = Math.min(100, Math.round((day.expected / maxVal) * 100));
                const colPct = Math.min(100, Math.round((day.collected / maxVal) * 100));
                const rate   = day.expected > 0 ? Math.round((day.collected / day.expected) * 100) : (day.collected > 0 ? 100 : 0);
                const isHover = hoveredDay === i;

                return (
                  <div
                    key={i}
                    onMouseEnter={() => setHoveredDay(i)}
                    onMouseLeave={() => setHoveredDay(null)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: '100%',
                      justifyContent: 'flex-end',
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                  >
                    {/* Floating Tooltip */}
                    {isHover && (
                      <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#1e293b',
                        color: '#ffffff',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        whiteSpace: 'nowrap',
                        zIndex: 30,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                        pointerEvents: 'none',
                        lineHeight: 1.4,
                      }}>
                        <div style={{ fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '4px', marginBottom: '4px' }}>
                          {day.date}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#94a3b8' }} />
                          <span>{p.dict.reports.expected}: {fmt(day.expected)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--success)' }} />
                          <span>{p.dict.reports.collected}: {fmt(day.collected)}</span>
                        </div>
                        <div style={{ marginTop: '4px', fontWeight: 700, color: hitColor(rate) }}>
                          {rate}% {p.dict.dashboard.hitRate}
                        </div>
                      </div>
                    )}

                    {/* Dual Bars Track */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      gap: '4px',
                      width: '100%',
                      height: '100%',
                      padding: '0 4px',
                      overflow: 'hidden', // ABSOLUTE SHIELD: no inner bar can EVER escape this container
                    }}>
                      {/* Expected Bar */}
                      <div
                        style={{
                          flex: 1,
                          maxWidth: '16px',
                          height: `${day.expected > 0 ? Math.max(expPct, 4) : 0}%`,
                          maxHeight: '100%',
                          background: '#cbd5e1',
                          borderRadius: '4px 4px 0 0',
                          opacity: hoveredDay === null || isHover ? 1 : 0.45,
                          transition: 'height 0.4s ease, opacity 0.2s ease',
                        }}
                      />
                      {/* Collected Bar */}
                      <div
                        style={{
                          flex: 1,
                          maxWidth: '16px',
                          height: `${day.collected > 0 ? Math.max(colPct, 4) : 0}%`,
                          maxHeight: '100%',
                          background: hitColor(rate),
                          borderRadius: '4px 4px 0 0',
                          opacity: hoveredDay === null || isHover ? 1 : 0.45,
                          transition: 'height 0.4s ease, opacity 0.2s ease',
                        }}
                      />
                    </div>

                    {/* Baseline */}
                    <div style={{ width: '100%', height: '1px', background: 'var(--border)' }} />

                    {/* Date label */}
                    <div style={{
                      fontSize: '10px',
                      fontWeight: isHover ? 700 : 500,
                      color: isHover ? 'var(--primary)' : 'var(--text-secondary)',
                      marginTop: '6px',
                      whiteSpace: 'nowrap',
                    }}>
                      {day.date}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer info: MTD collection */}
        <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span>{p.dict.dashboard.monthRate}: <strong style={{ color: hitColor(monthPct) }}>{monthPct}%</strong></span>
          <span>MTD: <strong style={{ color: 'var(--text)' }}>{fmt(p.monthCollected)}</strong> / {fmt(p.monthExpected)}</span>
        </div>
      </div>

      {/* ── Recent collections ───────────────────────────────────── */}
      {p.recentCollections.length > 0 && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>{p.dict.dashboard.recentCollections}</div>
            <select
              className="form-control"
              value={sessionFilter}
              onChange={(event) => setSessionFilter(event.target.value)}
              style={{ width: '170px', padding: '6px 10px', fontSize: '.8rem' }}
              aria-label="Filter recent collections by session"
            >
              <option value="">All sessions</option>
              <option value="anytime">Anytime</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
              <option value="night">Night</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {visibleRecentCollections.length === 0 && (
              <div style={{ padding: '14px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>No recent collections for this session.</div>
            )}
            {visibleRecentCollections.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < visibleRecentCollections.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
