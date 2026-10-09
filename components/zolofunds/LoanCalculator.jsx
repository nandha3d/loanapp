'use client';

import React, { useState, useMemo } from 'react';
import { Calculator, ArrowRight, TrendingUp, Calendar, Clock, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import { useScrollAnimation } from './hooks/useScrollAnimation';

/* ─── Generate Instalment Schedule ─── */
function generateSchedule(frequency, tenure, installmentAmount, principal) {
  const today = new Date();
  const instalments = [];
  const paidCount = Math.min(Math.floor(tenure * 0.15), tenure); // Simulate ~15% paid

  for (let i = 0; i < tenure; i++) {
    const date = new Date(today);

    if (frequency === 'daily') {
      // Skip Sundays
      let daysToAdd = i;
      let currentDate = new Date(today);
      let addedDays = 0;
      while (addedDays < daysToAdd) {
        currentDate.setDate(currentDate.getDate() + 1);
        if (currentDate.getDay() !== 0) addedDays++;
      }
      date.setTime(currentDate.getTime());
    } else if (frequency === 'weekly') {
      date.setDate(today.getDate() + i * 7);
    } else if (frequency === 'biweekly') {
      date.setDate(today.getDate() + i * 14);
    } else if (frequency === 'monthly') {
      date.setMonth(today.getMonth() + i);
    } else {
      date.setMonth(today.getMonth() + tenure);
    }

    let status = 'upcoming';
    let received = null;
    if (i < paidCount) {
      status = 'paid';
      received = installmentAmount;
    } else if (i === paidCount) {
      status = 'due_today';
    }

    instalments.push({
      num: i + 1,
      date,
      dateLabel: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      shortDate: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      dayName: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      amount: installmentAmount,
      received,
      status,
      time: status === 'paid' ? '10:48 am' : null
    });
  }
  return instalments;
}

export default function LoanCalculator({ onOpenDemo }) {
  const [principal, setPrincipal] = useState(50000);
  const [annualRate, setAnnualRate] = useState(18);
  const [tenure, setTenure] = useState(100);
  const [frequency, setFrequency] = useState('daily');
  const [interestModel, setInterestModel] = useState('flat_emi');
  const [hoveredInstalment, setHoveredInstalment] = useState(null);
  const [hoveredPos, setHoveredPos] = useState({ x: 0, y: 0 });
  const sectionRef = useScrollAnimation();

  const calc = useMemo(() => {
    const P = Number(principal);
    const R = Number(annualRate) / 100;
    const N = Number(tenure);
    let totalInterest = 0, netDisbursed = P, totalRepayable = 0, installmentAmount = 0;

    let timeInYears = 1;
    if (frequency === 'daily') timeInYears = N / 365;
    else if (frequency === 'weekly') timeInYears = N / 52;
    else if (frequency === 'biweekly') timeInYears = N / 26;
    else if (frequency === 'monthly') timeInYears = N / 12;
    else timeInYears = N / 12;

    if (interestModel === 'flat_emi') {
      totalInterest = Math.round(P * R * timeInYears);
      totalRepayable = P + totalInterest;
      installmentAmount = Math.ceil(totalRepayable / N);
    } else if (interestModel === 'upfront_flat') {
      totalInterest = Math.round(P * R * timeInYears);
      netDisbursed = P - totalInterest;
      totalRepayable = P;
      installmentAmount = Math.ceil(P / N);
    } else {
      let rP = 0;
      if (frequency === 'daily') rP = R / 365;
      else if (frequency === 'weekly') rP = R / 52;
      else if (frequency === 'biweekly') rP = R / 26;
      else if (frequency === 'monthly') rP = R / 12;
      else rP = R * timeInYears;

      if (frequency === 'single') {
        totalInterest = Math.round(P * R * timeInYears);
        totalRepayable = P + totalInterest;
        installmentAmount = totalRepayable;
      } else if (rP > 0) {
        const emi = (P * rP * Math.pow(1 + rP, N)) / (Math.pow(1 + rP, N) - 1);
        installmentAmount = Math.ceil(emi);
        totalRepayable = installmentAmount * N;
        totalInterest = totalRepayable - P;
      }
    }
    return { P, N, totalInterest, netDisbursed, totalRepayable, installmentAmount };
  }, [principal, annualRate, tenure, frequency, interestModel]);

  const schedule = useMemo(
    () => generateSchedule(frequency, tenure, calc.installmentAmount, principal),
    [frequency, tenure, calc.installmentAmount, principal]
  );

  const handleFrequencyChange = (f) => {
    setFrequency(f);
    if (f === 'daily') setTenure(100);
    else if (f === 'weekly') setTenure(24);
    else if (f === 'biweekly') setTenure(12);
    else if (f === 'monthly') setTenure(12);
    else setTenure(6);
  };

  const tenureLabel = frequency === 'daily' ? 'Days' : frequency === 'weekly' ? 'Weeks' : frequency === 'biweekly' ? 'Fortnights' : frequency === 'monthly' ? 'Months' : 'Months';
  const freqLabel = frequency === 'daily' ? 'Per Day' : frequency === 'weekly' ? 'Per Week' : frequency === 'biweekly' ? 'Every 2 Weeks' : frequency === 'monthly' ? 'Per Month' : 'Lump Sum';

  const paidCount = schedule.filter(s => s.status === 'paid').length;
  const dueCount = schedule.filter(s => s.status === 'due_today').length;
  const upcomingCount = schedule.filter(s => s.status === 'upcoming').length;
  const paidTotal = paidCount * calc.installmentAmount;
  const remainingTotal = (dueCount + upcomingCount) * calc.installmentAmount;

  // Status colors — exactly matching the loanapp dashboard
  const statusColor = (status) => {
    if (status === 'paid') return '#10B981';
    if (status === 'due_today') return '#F59E0B';
    return '#CBD5E1';
  };
  const statusBg = (status) => {
    if (status === 'paid') return '#10B981';
    if (status === 'due_today') return '#F59E0B';
    return '#E2E8F0';
  };
  const statusLabel = (status) => {
    if (status === 'paid') return 'Paid';
    if (status === 'due_today') return 'Due Today';
    return 'Upcoming';
  };
  const statusBadgeStyle = (status) => ({
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: '0.72rem',
    fontWeight: 800,
    color: status === 'paid' ? '#059669' : status === 'due_today' ? '#D97706' : '#64748B',
    background: status === 'paid' ? '#D1FAE5' : status === 'due_today' ? '#FEF3C7' : '#F1F5F9'
  });

  // Show max 30 squares in the heatmap strip, and limit the schedule table to 8 rows
  const displaySquares = schedule.slice(0, Math.min(schedule.length, 30));
  const schedulePreview = schedule.slice(0, 8);

  return (
    <section id="calculator" className="section" ref={sectionRef}>
      <div className="container">
        <div className="section-header animate-on-scroll">
          <div className="section-pill">Lender Yield Calculator</div>
          <h2 className="section-title">
            Calculate Your <span className="gradient-text">Portfolio Yield & Cashflow</span>
          </h2>
          <p className="section-subtitle">
            Simulate your disbursement, interest margins, and collection schedule across daily, weekly, bi-weekly, monthly, and single-lump loan products with custom interest rates.
          </p>
        </div>

        <div className="animate-on-scroll delay-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '28px', alignItems: 'start' }}>

          {/* Left: Calculator Controls */}
          <div className="glass-card" style={{ padding: '28px', border: '2px solid var(--brand-purple)', background: '#FFFFFF', boxShadow: 'var(--shadow-purple)' }}>

            {/* Interest Model */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 800, color: 'var(--brand-purple)', marginBottom: '7px' }}>
                Interest Structure:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '7px' }}>
                {[{ id: 'flat_emi', label: 'Flat EMI' }, { id: 'upfront_flat', label: 'Upfront Flat' }, { id: 'reducing', label: 'Reducing Bal.' }].map((m) => (
                  <button key={m.id} onClick={() => setInterestModel(m.id)} style={{
                    padding: '8px 6px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
                    background: interestModel === m.id ? 'var(--brand-purple)' : 'var(--bg-subtle)',
                    color: interestModel === m.id ? '#fff' : 'var(--text-title)',
                    border: '1.5px solid ' + (interestModel === m.id ? 'var(--brand-purple)' : 'var(--border-color)')
                  }}>{m.label}</button>
                ))}
              </div>
            </div>

            {/* Collection Frequency — 5 options */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 800, color: 'var(--brand-purple)', marginBottom: '7px' }}>
                Collection Frequency:
              </label>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {[
                  { id: 'daily', label: 'Daily', icon: '📅' },
                  { id: 'weekly', label: 'Weekly', icon: '📆' },
                  { id: 'biweekly', label: 'Bi-Weekly', icon: '🗓️' },
                  { id: 'monthly', label: 'Monthly', icon: '📋' },
                  { id: 'single', label: 'Single', icon: '💰' }
                ].map((f) => (
                  <button key={f.id} onClick={() => handleFrequencyChange(f.id)} style={{
                    padding: '7px 12px', borderRadius: '8px', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', flex: '1 1 auto',
                    background: frequency === f.id ? 'var(--brand-purple)' : 'var(--bg-subtle)',
                    color: frequency === f.id ? '#fff' : 'var(--text-title)',
                    border: '1.5px solid ' + (frequency === f.id ? 'var(--brand-purple)' : 'var(--border-color)')
                  }}><span style={{ marginRight: '3px' }}>{f.icon}</span>{f.label}</button>
                ))}
              </div>
            </div>

            {/* Principal */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-title)' }}>Loan Capital (₹)</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--brand-purple)' }}>₹{Number(principal).toLocaleString('en-IN')}</span>
              </div>
              <input type="range" min="5000" max="500000" step="5000" value={principal} onChange={(e) => setPrincipal(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--brand-purple)', cursor: 'pointer' }} />
            </div>

            {/* Rate & Tenure */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-title)', marginBottom: '3px' }}>Rate: {annualRate}% p.a.</div>
                <input type="range" min="6" max="48" step="0.5" value={annualRate} onChange={(e) => setAnnualRate(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--brand-purple)', cursor: 'pointer' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-title)', marginBottom: '3px' }}>Term: {tenure} {tenureLabel}</div>
                <input type="range" min={frequency === 'daily' ? 10 : frequency === 'weekly' ? 4 : frequency === 'biweekly' ? 2 : frequency === 'single' ? 1 : 3} max={frequency === 'daily' ? 365 : frequency === 'weekly' ? 104 : frequency === 'biweekly' ? 52 : frequency === 'single' ? 24 : 60} step={frequency === 'daily' ? 5 : 1} value={tenure} onChange={(e) => setTenure(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--brand-purple)', cursor: 'pointer' }} />
              </div>
            </div>

            {/* Results Box */}
            <div style={{ background: 'var(--brand-purple-light)', border: '2px solid var(--brand-purple-border)', borderRadius: '14px', padding: '16px', marginBottom: '12px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Periodic Inflow ({freqLabel})
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--brand-purple)', lineHeight: 1.1, margin: '3px 0' }}>
                ₹{calc.installmentAmount.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                {calc.N} {tenureLabel.toLowerCase()} · Total: <strong>₹{calc.totalRepayable.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--brand-purple-border)', fontSize: '0.8rem' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Disbursed: </span><strong style={{ color: 'var(--brand-purple-dark)' }}>₹{calc.netDisbursed.toLocaleString('en-IN')}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Profit: </span><strong style={{ color: '#D97706' }}>₹{calc.totalInterest.toLocaleString('en-IN')}</strong></div>
              </div>
            </div>

            <button onClick={onOpenDemo} className="btn btn-primary" style={{ width: '100%', gap: '8px' }}>
              <span>Test Live Portfolio Demo</span><ArrowRight size={16} />
            </button>
          </div>

          {/* Right: Loan Dashboard Preview — matching loanapp style */}
          <div>
            {/* Loan Info Header Bar */}
            <div className="glass-card" style={{ padding: '20px 22px', border: '2px solid var(--brand-purple-border)', background: '#fff', marginBottom: '14px' }}>

              {/* Top: Loan ID and Frequency */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-title)' }}>WL00034</span>
                  <span style={{ background: '#D1FAE5', color: '#059669', padding: '2px 10px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800 }}>Active</span>
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)' }}>
                  Frequency: <strong style={{ color: 'var(--brand-purple)' }}>{frequency === 'daily' ? 'Daily' : frequency === 'weekly' ? 'Weekly' : frequency === 'biweekly' ? 'Bi-Weekly' : frequency === 'monthly' ? 'Monthly' : 'Single'}</strong>
                </span>
              </div>

              {/* Stats Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                {[
                  { label: 'PRINCIPAL', val: `₹${Number(principal).toLocaleString('en-IN')}` },
                  { label: 'REPAYABLE', val: `₹${calc.totalRepayable.toLocaleString('en-IN')}` },
                  { label: 'PER INST.', val: `₹${calc.installmentAmount.toLocaleString('en-IN')}` },
                  { label: 'TENURE', val: `${tenure} ${tenureLabel}` },
                ].map((s, i) => (
                  <div key={i}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>{s.label}</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 900, color: 'var(--text-title)' }}>{s.val}</div>
                  </div>
                ))}
              </div>

              {/* ─── INSTALMENT HEATMAP STRIP — matching loanapp squares ─── */}
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)' }}>
                    Hover for info • Click to scroll & highlight
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--brand-purple)' }}>
                    {paidCount} PAID
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {displaySquares.map((inst, idx) => (
                    <div
                      key={idx}
                      onMouseEnter={(e) => { setHoveredInstalment(inst); setHoveredPos({ x: e.clientX, y: e.clientY }); }}
                      onMouseLeave={() => setHoveredInstalment(null)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: statusBg(inst.status),
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        border: hoveredInstalment?.num === inst.num ? '2px solid var(--brand-purple)' : '1px solid transparent',
                        transform: hoveredInstalment?.num === inst.num ? 'scale(1.25)' : 'scale(1)',
                        zIndex: hoveredInstalment?.num === inst.num ? 10 : 1,
                        boxShadow: hoveredInstalment?.num === inst.num ? '0 4px 12px rgba(125,40,126,0.25)' : 'none'
                      }}
                    >
                      {inst.status === 'paid' && (
                        <CheckCircle2 size={12} color="#fff" strokeWidth={3} />
                      )}
                    </div>
                  ))}
                  {schedule.length > 30 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)', padding: '0 6px' }}>
                      +{schedule.length - 30} more
                    </div>
                  )}
                </div>

                {/* Tooltip — loanapp style dark popup */}
                {hoveredInstalment && (
                  <div style={{
                    position: 'absolute',
                    top: '-110px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#1E293B',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    minWidth: '220px',
                    zIndex: 100,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                    fontSize: '0.82rem',
                    pointerEvents: 'none'
                  }}>
                    <div style={{ fontWeight: 900, marginBottom: '4px', fontSize: '0.88rem' }}>
                      Instalment #{hoveredInstalment.num}
                    </div>
                    <div style={{ color: '#94A3B8', marginBottom: '2px' }}>
                      Due: <strong style={{ color: '#fff' }}>{hoveredInstalment.dateLabel}</strong>
                    </div>
                    <div style={{ color: '#94A3B8', marginBottom: '2px' }}>
                      Expected: <strong style={{ color: '#fff' }}>₹{hoveredInstalment.amount.toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ color: '#94A3B8', marginBottom: '4px' }}>
                      Collected: <strong style={{ color: hoveredInstalment.received ? '#10B981' : '#F59E0B' }}>
                        {hoveredInstalment.received ? `₹${hoveredInstalment.received.toLocaleString('en-IN')}` : '₹0'}
                      </strong>
                    </div>
                    <div style={{ ...statusBadgeStyle(hoveredInstalment.status), marginTop: '2px' }}>
                      Status: {statusLabel(hoveredInstalment.status)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '6px', fontStyle: 'italic' }}>
                      Click to scroll & highlight
                    </div>
                    {/* Triangle pointer */}
                    <div style={{ position: 'absolute', bottom: '-6px', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #1E293B' }} />
                  </div>
                )}

                {/* Heatmap Legend */}
                <div style={{ display: 'flex', gap: '14px', marginTop: '10px' }}>
                  {[
                    { color: '#10B981', label: 'Paid' },
                    { color: '#F59E0B', label: 'Due Today' },
                    { color: '#E2E8F0', label: 'Upcoming' },
                  ].map((l, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: l.color }} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Payment Schedule Table — matching loanapp */}
            <div className="glass-card" style={{ padding: '20px 22px', border: '1.5px solid var(--border-color)', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={16} color="var(--brand-purple)" />
                  <span style={{ fontSize: '0.92rem', fontWeight: 900, color: 'var(--text-title)' }}>Payment Schedule</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                  Showing {schedulePreview.length} of {schedule.length} instalments
                </span>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                      {['#', 'DATE', 'TIME', 'DUE', 'RECEIVED', 'STATUS', 'ACTION'].map((h) => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {schedulePreview.map((inst) => (
                      <tr key={inst.num} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--brand-purple-light)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px', fontWeight: 700, color: 'var(--text-dim)' }}>{inst.num}</td>
                        <td style={{ padding: '10px', fontWeight: 700, color: 'var(--text-title)' }}>{inst.shortDate}</td>
                        <td style={{ padding: '10px', color: 'var(--text-dim)' }}>{inst.time || '—'}</td>
                        <td style={{ padding: '10px', fontWeight: 800, color: 'var(--text-title)' }}>₹{inst.amount.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px', fontWeight: 800, color: inst.received ? '#059669' : 'var(--text-dim)' }}>
                          {inst.received ? `₹${inst.received.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span style={statusBadgeStyle(inst.status)}>{statusLabel(inst.status)}</span>
                        </td>
                        <td style={{ padding: '10px' }}>
                          {inst.status === 'paid' ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', cursor: 'pointer' }}>✏️ Edit</span>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <span style={{ background: '#F97316', color: '#fff', padding: '3px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}>💵 Pay</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>🔗 Pay link</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {schedule.length > 8 && (
                <div style={{ textAlign: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', marginTop: '4px' }}>
                  <button onClick={onOpenDemo} style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--brand-purple)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    View All {schedule.length} Instalments <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '12px' }}>
              {[
                { label: 'Collected', val: `₹${paidTotal.toLocaleString('en-IN')}`, sub: `${paidCount} instalments`, color: '#059669' },
                { label: 'Remaining', val: `₹${remainingTotal.toLocaleString('en-IN')}`, sub: `${upcomingCount + dueCount} pending`, color: '#D97706' },
                { label: 'Yield', val: `${calc.P > 0 ? ((calc.totalInterest / calc.P) * 100).toFixed(1) : 0}%`, sub: 'on principal', color: 'var(--brand-purple)' }
              ].map((c, i) => (
                <div key={i} className="glass-card" style={{ padding: '14px', textAlign: 'center', border: '1.5px solid var(--border-color)', background: '#fff' }}>
                  <div style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '3px' }}>{c.label}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: c.color }}>{c.val}</div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{c.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

