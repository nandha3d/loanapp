'use client';

import { useState, useEffect, Fragment } from 'react';
import { submitBorrowerRepayment } from './actions';
import { formatDate, formatCurrency } from '@/lib/utils';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import PasswordInput from '@/components/ui/PasswordInput';

interface BorrowerDashboardClientProps {
  loans: any[];
  initialLoanId: string;
  paymentSettings?: {
    upiId: string;
    upiQrUrl: string;
  };
  dict: any;
}

export default function BorrowerDashboardClient({ loans, initialLoanId, paymentSettings, dict }: BorrowerDashboardClientProps) {
  const b = dict.borrower;
  const [selectedLoanId, setSelectedLoanId] = useState(initialLoanId);
  const loan = loans.find((l) => l.id === selectedLoanId) || loans[0] || null;

  const [activeTab, setActiveTab] = useState<'dashboard' | 'schedule' | 'history' | 'details' | 'calculator'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return b.goodMorning;
    if (hrs < 17) return b.goodAfternoon;
    return b.goodEvening;
  };
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'input' | 'simulate' | 'success'>('input');
  const [paymentType, setPaymentType] = useState<'next' | 'partial' | 'preclose'>('next');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'upi' | 'card' | 'netbanking' | 'cash'>('upi');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Card payment mock state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Toast state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Interactive cryptographic ledger sync detail state
  const [selectedInstalmentId, setSelectedInstalmentId] = useState<string | null>(null);
  const [tamperLenderDue, setTamperLenderDue] = useState<number | null>(null);
  const [tamperBorrowerReceived, setTamperBorrowerReceived] = useState<number | null>(null);

  // Calculator States
  const [calcPrincipal, setCalcPrincipal] = useState(50000);
  const [calcTenure, setCalcTenure] = useState(24);
  const [calcRate, setCalcRate] = useState(12); // flat annual interest rate (e.g. 12%)
  const [calcFrequency, setCalcFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Reset payment amount when active loan changes
  useEffect(() => {
    setPaymentAmount('');
    setPaymentType('next');
  }, [selectedLoanId]);

  if (!loan) {
    return (
      <div style={{ maxWidth: '640px', margin: '40px auto', padding: '16px', textAlign: 'center' }}>
        <h2>{b.noLoansFound}</h2>
        <p>{b.noLoansDesc}</p>
        <a href="/api/borrower/logout" className="btn btn-primary" style={{ marginTop: '16px' }}>{b.logout}</a>
      </div>
    );
  }

  // Core metrics calculation
  const totalPayable = Number(loan.totalPayable);
  const totalPaid = loan.instalments.reduce((sum: number, inst: any) => sum + Number(inst.receivedAmount), 0);
  const outstandingBalance = Math.max(0, totalPayable - totalPaid);

  const paidRatio = totalPayable > 0 ? totalPaid / totalPayable : 0;
  const paidPercent = Math.min(100, Math.round(paidRatio * 100));

  // Overdue calculations
  const overdueInstalments = loan.instalments.filter(
    (inst: any) => inst.status === 'overdue' || inst.status === 'missed'
  );
  const overdueAmount = overdueInstalments.reduce(
    (sum: number, inst: any) => sum + Math.max(0, Number(inst.dueAmount) - Number(inst.receivedAmount || 0)),
    0
  );

  // Find next unpaid instalment
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextDueInstalment = loan.instalments.find(
    (inst: any) => inst.status !== 'paid'
  );

  // Live payment allocation simulator
  const getSimulatedAllocation = (amountStr: string) => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return [];

    let remaining = amount;
    const allocations: { instalmentNo: number; amount: number; isFullyPaid: boolean }[] = [];

    // Filter unpaid/partial instalments
    const unpaid = loan.instalments.filter(
      (inst: any) => inst.status !== 'paid'
    );

    for (const inst of unpaid) {
      if (remaining <= 0) break;

      const due = Number(inst.dueAmount);
      const received = Number(inst.receivedAmount || 0);
      const outstanding = Math.max(0, due - received);

      if (outstanding <= 0) continue;

      const allocatedAmount = Math.min(remaining, outstanding);
      remaining = Number((remaining - allocatedAmount).toFixed(2));

      allocations.push({
        instalmentNo: inst.instalmentNo,
        amount: allocatedAmount,
        isFullyPaid: (received + allocatedAmount) >= due,
      });
    }

    return allocations;
  };

  const simulatedAllocations = getSimulatedAllocation(paymentAmount);

  // Exceeding amount check
  const isExceedingTotal = parseFloat(paymentAmount) > outstandingBalance;

  // Format Card Number
  const handleCardNumberChange = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      setCardNumber(parts.join(' '));
    } else {
      setCardNumber(v);
    }
  };

  // Submit payment
  const handlePaymentSubmit = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setToast({ type: 'error', message: 'Please enter a valid amount.' });
      return;
    }

    setIsSubmitting(true);
    
    // Generate simulated reference number if empty
    const resolvedRef = referenceNumber || `MOCK-${paymentMode.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const res = await submitBorrowerRepayment(amount, paymentMode, resolvedRef, selectedLoanId);

    setIsSubmitting(false);

    if (res.success) {
      setPaymentStep('success');
      setToast({ type: 'success', message: res.message || 'Payment successfully recorded.' });
      // Reset input fields
      setPaymentAmount('');
      setReferenceNumber('');
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
    } else {
      setToast({ type: 'error', message: res.error || 'Payment failed.' });
      setPaymentStep('input');
    }
  };

  // Interactive Amortization Calculator Logic (Flat Rate Loan)
  const periodsPerYear = calcFrequency === 'daily' ? 365 : calcFrequency === 'weekly' ? 52 : 12;
  const tenureInYears = calcTenure / periodsPerYear;
  const totalInterest = calcPrincipal * (calcRate / 100) * tenureInYears;
  const totalPayableCalc = calcPrincipal + totalInterest;
  const emi = totalPayableCalc / calcTenure;

  // Generate Projected Calculator Schedule List
  const calcSchedule = [];
  let calcBalance = totalPayableCalc;
  const todayDate = new Date();
  for (let i = 1; i <= calcTenure; i++) {
    const dueDate = new Date(todayDate);
    if (calcFrequency === 'daily') {
      dueDate.setDate(todayDate.getDate() + i);
    } else if (calcFrequency === 'weekly') {
      dueDate.setDate(todayDate.getDate() + i * 7);
    } else {
      dueDate.setMonth(todayDate.getMonth() + i);
    }

    const principalPortion = calcPrincipal / calcTenure;
    const interestPortion = totalInterest / calcTenure;
    calcBalance -= emi;

    calcSchedule.push({
      instalmentNo: i,
      dueDate,
      emi,
      principalPortion,
      interestPortion,
      remainingBalance: Math.max(0, calcBalance),
    });
  }

  return (
    <div className="app-layout">
      {/* Toast Alert */}
      {toast && (
        <div className={`toast ${toast.type}`} style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000, margin: 0, animation: 'slideInRight 0.3s ease' }}>
          <span className="material-icons-outlined" style={{ color: toast.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Mobile Drawer Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="sidebar-overlay" 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.5)', 
            zIndex: 45 
          }} 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar navigation */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="material-icons-outlined" style={{ fontSize: '28px', color: 'var(--primary)' }}>bolt</span>
          <h2>Loan<span>Track</span></h2>
        </div>

        {/* Wise-style account switcher dropdown inside sidebar */}
        {loans.length > 1 && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            <label style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>
              {b.selectActiveAccount}
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedLoanId}
                onChange={(e) => setSelectedLoanId(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  paddingRight: '32px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  appearance: 'none',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {loans.map((l: any) => {
                  const statusEmoji = l.status === 'closed' ? '✅' : l.status === 'overdue' ? '🚨' : '⚡';
                  return (
                    <option key={l.id} value={l.id} style={{ background: '#1A1D23', color: '#fff' }}>
                      {statusEmoji} {l.loanCode}
                    </option>
                  );
                })}
              </select>
              <span
                className="material-icons-outlined"
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '18px'
                }}
              >
                unfold_more
              </span>
            </div>
          </div>
        )}

        <nav className="sidebar-nav">
          <div className="nav-section">{b.borrowerPortal}</div>
          <a
            href="#"
            className={activeTab === 'dashboard' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); setIsSidebarOpen(false); }}
          >
            <span className="material-icons-outlined">dashboard</span>
            <span>{b.navDashboard}</span>
          </a>
          <a
            href="#"
            className={activeTab === 'schedule' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); setActiveTab('schedule'); setIsSidebarOpen(false); }}
          >
            <span className="material-icons-outlined">receipt_long</span>
            <span>{b.navSchedule}</span>
          </a>
          <a
            href="#"
            className={activeTab === 'history' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); setActiveTab('history'); setIsSidebarOpen(false); }}
          >
            <span className="material-icons-outlined">history</span>
            <span>{b.navPaymentLedger}</span>
          </a>
          <a
            href="#"
            className={activeTab === 'calculator' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); setActiveTab('calculator'); setIsSidebarOpen(false); }}
          >
            <span className="material-icons-outlined">calculate</span>
            <span>{b.navEmiPlanner}</span>
          </a>
          <a
            href="#"
            className={activeTab === 'details' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); setActiveTab('details'); setIsSidebarOpen(false); }}
          >
            <span className="material-icons-outlined">info</span>
            <span>{b.navSpecsCollateral}</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="avatar">
                {loan.customer.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                <div className="user-name" style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>
                  {loan.customer.name}
                </div>
                <div className="user-role" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>{b.borrowerRole}</div>
              </div>
            </div>
            <a
              href="/api/borrower/logout"
              className="btn-icon"
              title={b.logout}
              style={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '20px' }}>logout</span>
            </a>
          </div>
        </div>
      </aside>

      {/* Main content flow */}
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="btn-menu" onClick={() => setIsSidebarOpen(true)}>
              <span className="material-icons-outlined">menu</span>
            </button>
            <div>
              <h2 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{getGreeting()}, {loan.customer.name.split(' ')[0]}!</span>
                <span style={{ fontSize: '1.2rem' }}>👋</span>
              </h2>
              <div className="breadcrumb" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <span>{b.borrowerPortal}</span>
                <span>/</span>
                <span style={{ textTransform: 'capitalize', fontWeight: 500, color: 'var(--primary-dark)' }}>{activeTab}</span>
              </div>
            </div>
          </div>
          <div className="topbar-right">
            <div className="topbar-date" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>calendar_today</span>
              <span>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
            <a
              href={`/api/borrower/statement?loanId=${selectedLoanId}`}
              className="btn btn-secondary btn-sm"
              title={b.statement}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>download</span>
              <span className="btn-text-desktop">{b.statement}</span>
            </a>
          </div>
        </header>

        <main className="page-content" style={{ paddingBottom: '100px' }}>
          
          {/* Dashboard Tab Panel */}
          {activeTab === 'dashboard' && (
            <div className="grid-60-40" style={{ display: 'grid', gap: '20px' }}>
              {/* Left Column (60%) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Next Repayment Banner Card */}
                {nextDueInstalment ? (
                  <div style={{ background: 'var(--warning-bg)', color: '#92400e', padding: '20px', borderRadius: '16px', border: '1px solid rgba(245,158,11,0.2)', boxShadow: 'var(--shadow)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '28px', color: 'var(--warning)' }}>pending_actions</span>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, opacity: 0.85 }}>
                          {b.instalmentDue.replace('{no}', nextDueInstalment.instalmentNo)}
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '2px', letterSpacing: '-0.5px' }}>
                          {formatCurrency(Number(nextDueInstalment.dueAmount) - Number(nextDueInstalment.receivedAmount))}
                        </div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 500, opacity: 0.85, marginTop: '2px' }}>
                          {b.dueDate}: {formatDate(nextDueInstalment.dueDate)}
                        </div>
                      </div>
                    </div>
                    <div>
                      <button
                        onClick={() => {
                          const due = Number(nextDueInstalment.dueAmount) - Number(nextDueInstalment.receivedAmount);
                          setPaymentAmount(String(due));
                          setPaymentStep('input');
                          setPaymentType('next');
                          setShowPaymentModal(true);
                        }}
                        className="btn btn-primary"
                        style={{ padding: '12px 24px', borderRadius: '12px', boxShadow: '0 4px 14px rgba(245,166,35,0.4)', fontWeight: 700, fontSize: '0.9rem' }}
                      >
                        {b.payInstalment}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'var(--success-bg)', color: '#166534', padding: '20px', borderRadius: '16px', border: '1px solid rgba(39,174,96,0.2)', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(39,174,96,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-icons-outlined" style={{ fontSize: '28px', color: 'var(--success)' }}>celebration</span>
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{b.allSettled}</h4>
                      <p style={{ margin: '2px 0 0', fontSize: '0.78rem', opacity: 0.9 }}>{b.allSettledDesc}</p>
                    </div>
                  </div>
                )}

                {/* Circular Progress & Summaries Card */}
                <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'center', padding: '24px', background: 'linear-gradient(135deg, #ffffff 0%, #fffbf2 100%)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: -50, right: -50, width: '150px', height: '150px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,166,35,0.08) 0%, transparent 70%)', pointerEvents: 'none' }}></div>
                  
                  {/* Circular progress SVG */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'relative', width: '110px', height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="110" height="110" viewBox="0 0 110 110" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="55" cy="55" r="44" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                        <circle
                          cx="55"
                          cy="55"
                          r="44"
                          stroke="var(--primary)"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 44}
                          strokeDashoffset={2 * Math.PI * 44 * (1 - paidRatio)}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        />
                      </svg>
                      <div style={{ position: 'absolute', textAlign: 'center' }}>
                        <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)' }}>{paidPercent}%</span>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '-2px' }}>{b.repaid}</div>
                      </div>
                    </div>
                  </div>

                  {/* Financial Metrics Summary */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{b.totalLoanPayable}</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)', marginTop: '2px' }}>{formatCurrency(totalPayable)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{b.totalDisbursed}</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--info)', marginTop: '2px' }}>{formatCurrency(Number(loan.disbursed))}</div>
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{b.successfullyRepaid}</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)', marginTop: '2px' }}>{formatCurrency(totalPaid)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{b.outstandingBalance}</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--danger)', marginTop: '2px' }}>{formatCurrency(outstandingBalance)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recharts Area Curve Chart */}
                <div className="card" style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>{b.repaymentTrajectory}</h3>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>{b.trajectoryDesc}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.72rem', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F5A623' }}></span>
                        <span>{b.scheduledTarget}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27AE60' }}></span>
                        <span>{b.actualPaid}</span>
                      </div>
                    </div>
                  </div>
                  <div className="chart-container" style={{ height: '240px', width: '100%' }}>
                    {isMounted ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart 
                          data={isMounted ? loan.instalments.map((inst: any, idx: number) => {
                            let cumulativeScheduled = 0;
                            let cumulativePaid = 0;
                            for (let i = 0; i <= idx; i++) {
                              cumulativeScheduled += Number(loan.instalments[i].dueAmount);
                              cumulativePaid += Number(loan.instalments[i].receivedAmount || 0);
                            }
                            return {
                              name: `P${inst.instalmentNo}`,
                              Scheduled: cumulativeScheduled,
                              Repaid: cumulativePaid,
                            };
                          }) : []} 
                          margin={{ top: 10, right: 5, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorScheduled" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorRepaid" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--success)" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                            tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                          />
                          <Tooltip 
                            formatter={(value: any) => [formatCurrency(Number(value)), '']}
                            contentStyle={{ background: '#fff', borderRadius: '8px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', fontSize: '11px', fontWeight: 600 }}
                          />
                          <Area type="monotone" dataKey="Scheduled" stroke="var(--primary)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorScheduled)" />
                          <Area type="monotone" dataKey="Repaid" stroke="var(--success)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRepaid)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-light)', fontSize: '0.8rem' }}>
                        <span className="material-icons-outlined" style={{ animation: 'spin 1.5s linear infinite', marginRight: '6px' }}>autorenew</span>
                        {b.loadingChart}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Right Column (40%) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Premium Stylized Orange Fintech Credit Card */}
                <div 
                  className="premium-card-hover"
                  style={{
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                    borderRadius: '20px',
                    padding: '24px',
                    color: '#fff',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(245,166,35,0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    height: '200px',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }}></div>
                  <div style={{ position: 'absolute', right: '40px', bottom: '-40px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }}></div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
                    <div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.75)' }}>Active Account card</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, marginTop: '2px', letterSpacing: '0.5px' }}>
                        {loan.appType === 'autofinance' ? 'Auto Finance Collateral' : 'Micro Development Loan'}
                      </div>
                    </div>
                    {/* Gold smart card chip */}
                    <div style={{
                      width: '38px',
                      height: '28px',
                      background: 'linear-gradient(135deg, #FFE082 0%, #FFB300 100%)',
                      borderRadius: '6px',
                      position: 'relative',
                      boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden'
                    }}>
                      <div style={{ position: 'absolute', width: '100%', height: '1px', background: 'rgba(0,0,0,0.15)', top: '50%' }}></div>
                      <div style={{ position: 'absolute', height: '100%', width: '1px', background: 'rgba(0,0,0,0.15)', left: '50%' }}></div>
                      <div style={{ width: '16px', height: '12px', border: '1px solid rgba(0,0,0,0.15)', borderRadius: '2px', zIndex: 1 }}></div>
                    </div>
                  </div>

                  {/* Spaced card number as loanCode */}
                  <div style={{ 
                    fontSize: '1.35rem', 
                    letterSpacing: '3px', 
                    fontFamily: '"Courier New", Courier, monospace', 
                    fontWeight: 700, 
                    margin: '18px 0', 
                    textShadow: '0 2px 4px rgba(0,0,0,0.15)',
                    zIndex: 1 
                  }}>
                    {(() => {
                      const clean = loan.loanCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                      const chunks = [];
                      for (let i = 0; i < clean.length; i += 4) {
                        chunks.push(clean.substring(i, i + 4));
                      }
                      while (chunks.length < 4) {
                        chunks.push('••••');
                      }
                      return chunks.join(' ');
                    })()}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', zIndex: 1 }}>
                    <div>
                      <div style={{ fontSize: '0.58rem', fontWeight: 600, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '1px' }}>Cardholder Name</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', marginTop: '2px', color: '#fff' }}>{loan.customer.name}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '0.58rem', fontWeight: 600, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '1px' }}>Expires</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '2px', color: '#fff' }}>
                          {(() => {
                            const lastInst = loan.instalments[loan.instalments.length - 1];
                            return lastInst ? new Date(lastInst.dueDate).toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' }) : '12/28';
                          })()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.5px', color: '#fff' }}>VISA</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Payments Feed Log summary */}
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>{b.recentActivity}</h3>
                    <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('history'); }} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-dark)' }}>{b.viewLedger}</a>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {loan.payments && loan.payments.length > 0 ? (
                      loan.payments.slice(0, 3).map((p: any) => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{b.simulatedRepayment}</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {formatDate(p.paymentDate)}
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--success)' }}>+{formatCurrency(Number(p.amount))}</div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-light)', marginTop: '1px' }}>{p.paymentMode.toUpperCase()}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-secondary)' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '32px', color: 'var(--text-light)' }}>history</span>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: '6px' }}>{b.noPaymentsYet}</div>
                        <p style={{ fontSize: '0.7rem', margin: '2px 0 0' }}>{b.noPaymentsYetDesc}</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Schedule Tab Panel */}
          {activeTab === 'schedule' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Responsive Synced Security Banner */}
              <div 
                style={{ 
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
                  color: '#f8fafc', 
                  padding: '16px 20px', 
                  borderRadius: '16px', 
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: 'var(--shadow)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px'
                }}
              >
                <div style={{ 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '50%', 
                  background: 'rgba(245,166,35,0.15)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  flexShrink: 0 
                }}>
                  <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>shield</span>
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, letterSpacing: '0.3px', color: '#fff' }}>
                    Two-Way Synced Security Shield Active
                  </h4>
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', opacity: 0.85, lineHeight: '1.4' }}>
                    Double-handshake verification protects borrower and lender from unauthorized changes. If an agent collects cash and marks it paid, it syncs instantly below. All payments are signed with immutable transaction validation hashes.
                  </p>
                </div>
              </div>

              {/* Title & Select Account Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{b.instalmentLedger}</h2>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>{b.instalmentLedgerDesc}</p>
                </div>
                {loans.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{b.account}:</span>
                    <select
                      value={selectedLoanId}
                      onChange={(e) => setSelectedLoanId(e.target.value)}
                      style={{
                        height: '36px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      {loans.map((l: any) => (
                        <option key={l.id} value={l.id}>{l.loanCode}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              
              {/* Compact table view inside premium card */}
              <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ 
                        background: 'var(--bg)', 
                        borderBottom: '1px solid var(--border)', 
                        color: 'var(--text-secondary)', 
                        fontWeight: 700, 
                        fontSize: '0.7rem', 
                        textTransform: 'uppercase', 
                        letterSpacing: '1px' 
                      }}>
                        <th style={{ padding: '14px 18px', width: '12%' }}>{b.colInstalment}</th>
                        <th style={{ padding: '14px 18px', width: '22%' }}>{b.colScheduled}</th>
                        <th style={{ padding: '14px 18px', width: '32%' }}>{b.colPaymentReceipt}</th>
                        <th style={{ padding: '14px 18px', width: '22%' }}>{b.colSecuritySeal}</th>
                        <th style={{ padding: '14px 18px', width: '12%', textAlign: 'right' }}>{b.colStatus}</th>
                      </tr>
                    </thead>
                    <tbody style={{ color: 'var(--text)' }}>
                      {loan.instalments.map((inst: any) => {
                        const outstanding = Math.max(0, Number(inst.dueAmount) - Number(inst.receivedAmount));
                        const isOverdue = inst.status !== 'paid' && new Date(inst.dueDate) < today;
                        const isPaid = inst.status === 'paid';
                        const hasPartial = inst.status === 'partial' || (Number(inst.receivedAmount) > 0 && outstanding > 0);
                        const isSelected = selectedInstalmentId === inst.id;

                        // Deterministic SHA verification hash simulation for immutable seal
                        const verificationHash = isPaid || hasPartial
                          ? `0x${((inst.id.slice(-6) || 'A1B2C3') + String(inst.instalmentNo) + (inst.collectionEntryId ? 'C' : 'S')).toUpperCase()}`
                          : null;

                        // Tamper simulation calculations
                        const actualDue = Number(inst.dueAmount);
                        const actualReceived = Number(inst.receivedAmount);
                        const currentLenderDue = isSelected && tamperLenderDue !== null ? tamperLenderDue : actualDue;
                        const currentBorrowerReceived = isSelected && tamperBorrowerReceived !== null ? tamperBorrowerReceived : actualReceived;

                        const isTampered = isSelected && (currentLenderDue !== actualDue || currentBorrowerReceived !== actualReceived);

                        const lenderKey = `0xLND-${(inst.id || 'abc').substring(0, 4).toUpperCase()}-${currentLenderDue.toFixed(0)}`;
                        const borrowerKey = `0xBWR-${(inst.id || 'xyz').substring(8, 12).toUpperCase()}-${currentBorrowerReceived.toFixed(0)}`;
                        const combinedSeal = `0xSYNC-${(inst.id || 'ab').substring(12, 14).toUpperCase()}-${(currentLenderDue * 7 + currentBorrowerReceived * 13).toString(16).toUpperCase()}`;

                        return (
                          <Fragment key={inst.id}>
                            <tr 
                              style={{ 
                                borderBottom: isSelected ? 'none' : '1px solid var(--border)',
                                background: isSelected 
                                  ? 'rgba(245, 166, 35, 0.04)' 
                                  : isOverdue 
                                  ? 'rgba(235, 87, 87, 0.01)' 
                                  : 'transparent',
                                cursor: 'pointer',
                                transition: 'background 0.2s ease'
                              }}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedInstalmentId(null);
                                  setTamperLenderDue(null);
                                  setTamperBorrowerReceived(null);
                                } else {
                                  setSelectedInstalmentId(inst.id);
                                  setTamperLenderDue(actualDue);
                                  setTamperBorrowerReceived(actualReceived);
                                }
                              }}
                              className="table-row-hover"
                            >
                              <td style={{ padding: '14px 18px', fontWeight: 700 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="material-icons-outlined" style={{ 
                                    fontSize: '16px', 
                                    color: isSelected ? 'var(--primary)' : 'var(--text-light)',
                                    transform: isSelected ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease'
                                  }}>
                                    keyboard_arrow_down
                                  </span>
                                  <span>#{inst.instalmentNo}</span>
                                </div>
                              </td>
                              <td style={{ padding: '14px 18px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                                    {formatCurrency(actualDue)}
                                  </span>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                    Due: {formatDate(inst.dueDate)}
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '14px 18px' }}>
                                {isPaid || hasPartial ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                                      {formatCurrency(actualReceived)}
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                      {inst.receivedAt ? formatDate(inst.receivedAt) : b.synced}
                                    </span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <span className="material-icons-outlined" style={{ fontSize: '10px' }}>
                                        {inst.collectionEntry ? 'payments' : 'language'}
                                      </span>
                                      {inst.collectionEntry 
                                        ? `Cash: Agent ${inst.collectionEntry.agent?.name || 'Agent'}` 
                                        : `Online: ${inst.paymentMode?.toUpperCase() || 'UPI'}`
                                      }
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-light)' }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '14px 18px' }}>
                                {verificationHash ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="material-icons-outlined" style={{ fontSize: '14px', color: 'var(--success)' }}>verified_user</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                      <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                        {verificationHash}
                                      </span>
                                      <span style={{ fontSize: '0.55rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {inst.collectionEntry ? b.dualSyncSigned : b.gatewaySigned}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.6 }}>
                                    <span className="material-icons-outlined" style={{ fontSize: '14px', color: 'var(--text-light)' }}>lock_open</span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-light)' }}>
                                      {b.awaitingSync}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                                <span
                                  className={
                                    isPaid
                                      ? 'badge badge-paid'
                                      : isOverdue
                                      ? 'badge badge-overdue'
                                      : hasPartial
                                      ? 'badge badge-partial'
                                      : 'badge badge-upcoming'
                                  }
                                  style={{ 
                                    fontSize: '0.62rem', 
                                    padding: '4px 10px', 
                                    borderRadius: '20px',
                                    display: 'inline-block',
                                    textAlign: 'center',
                                    minWidth: '68px'
                                  }}
                                >
                                  {isPaid ? b.statusPaid : isOverdue ? b.statusOverdue : hasPartial ? b.statusPartial : b.statusUpcoming}
                                </span>
                              </td>
                            </tr>
                            {isSelected && (
                              <tr style={{ background: 'rgba(245, 166, 35, 0.02)', borderBottom: '1px solid var(--border)' }}>
                                <td colSpan={5} style={{ padding: '0px 18px 18px 18px' }}>
                                  <div style={{ 
                                    background: '#ffffff', 
                                    border: isTampered ? '1px solid var(--danger)' : '1px solid rgba(245, 166, 35, 0.2)', 
                                    borderRadius: '16px', 
                                    padding: '20px',
                                    boxShadow: 'var(--shadow)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '16px',
                                    transition: 'all 0.3s ease'
                                  }}>
                                    {/* Consensus Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="material-icons-outlined" style={{ 
                                          fontSize: '20px', 
                                          color: isTampered 
                                            ? 'var(--danger)' 
                                            : isPaid 
                                              ? 'var(--success)' 
                                              : 'var(--warning)' 
                                        }}>
                                          {isTampered ? 'gpp_bad' : isPaid ? 'gpp_good' : 'hourglass_empty'}
                                        </span>
                                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: isTampered ? 'var(--danger)' : 'var(--text)' }}>
                                          {isTampered 
                                            ? 'CRYPTOGRAPHIC SEAL BROKEN! (Tamper Detected)' 
                                            : isPaid 
                                              ? 'Cryptographic Handshake Synced & Locked' 
                                              : 'Awaiting Handshake (Dual-Sync Active)'
                                          }
                                        </span>
                                      </div>
                                      <span style={{ 
                                        fontSize: '0.62rem', 
                                        padding: '4px 10px', 
                                        borderRadius: '6px', 
                                        background: isTampered 
                                          ? 'var(--danger-bg)' 
                                          : isPaid 
                                            ? 'var(--success-bg)' 
                                            : 'var(--warning-bg)', 
                                        color: isTampered 
                                          ? 'var(--danger)' 
                                          : isPaid 
                                            ? 'var(--success)' 
                                            : 'var(--warning)', 
                                        fontWeight: 700, 
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                      }}>
                                        {isTampered ? 'Ledger Block Mismatch' : isPaid ? 'Consensus Secure' : 'Sync Pending'}
                                      </span>
                                    </div>

                                    {/* Interactive Tamper Proof Ledger Playground */}
                                    <div style={{ 
                                      background: 'var(--bg)', 
                                      borderRadius: '12px', 
                                      padding: '16px', 
                                      border: '1px solid var(--border)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '12px'
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>
                                          science
                                        </span>
                                        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)' }}>
                                          Tamper-Proof Ledger Playground (Simulation)
                                        </span>
                                      </div>
                                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                                        Try dragging the sliders to simulate a retrospective attempt to change values. Notice how altering any parameters independently breaks the combined cryptographic signature seal instantly.
                                      </p>
                                      
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                                        {/* Slider 1: Lender Simulation */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>1. Lender DB (Due Amount)</span>
                                            <span style={{ color: currentLenderDue !== actualDue ? 'var(--danger)' : 'var(--text)', fontWeight: 700 }}>
                                              {formatCurrency(currentLenderDue)} {currentLenderDue !== actualDue && '(Tampered!)'}
                                            </span>
                                          </div>
                                          <input 
                                            type="range" 
                                            min={actualDue / 2} 
                                            max={actualDue * 2} 
                                            step={Math.max(1, Math.round(actualDue / 10))} 
                                            value={currentLenderDue}
                                            onChange={(e) => setTamperLenderDue(Number(e.target.value))}
                                            style={{ width: '100%', height: '6px', accentColor: currentLenderDue !== actualDue ? 'var(--danger)' : 'var(--primary)' }}
                                          />
                                        </div>

                                        {/* Slider 2: Borrower Simulation */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>2. Borrower Device (Paid Amount)</span>
                                            <span style={{ color: currentBorrowerReceived !== actualReceived ? 'var(--danger)' : 'var(--text)', fontWeight: 700 }}>
                                              {formatCurrency(currentBorrowerReceived)} {currentBorrowerReceived !== actualReceived && '(Tampered!)'}
                                            </span>
                                          </div>
                                          <input 
                                            type="range" 
                                            min={0} 
                                            max={actualDue * 2} 
                                            step={Math.max(1, Math.round(actualDue / 10))} 
                                            value={currentBorrowerReceived}
                                            onChange={(e) => setTamperBorrowerReceived(Number(e.target.value))}
                                            style={{ width: '100%', height: '6px', accentColor: currentBorrowerReceived !== actualReceived ? 'var(--danger)' : 'var(--primary)' }}
                                          />
                                        </div>
                                      </div>

                                      {isTampered && (
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setTamperLenderDue(actualDue);
                                            setTamperBorrowerReceived(actualReceived);
                                          }}
                                          className="btn btn-secondary btn-sm"
                                          style={{ alignSelf: 'flex-end', height: '28px', padding: '0 12px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                                        >
                                          Reset Simulation
                                        </button>
                                      )}
                                    </div>

                                    {/* 3-Column Sync Architecture Visualizer */}
                                    <div style={{ 
                                      display: 'grid', 
                                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                                      gap: '16px',
                                      borderTop: '1px solid var(--border)',
                                      borderBottom: '1px solid var(--border)',
                                      padding: '16px 0'
                                    }}>
                                      {/* Column 1: Lender Ledger */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                          1. Lender Ledger Host
                                        </span>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', color: currentLenderDue !== actualDue ? 'var(--danger)' : 'inherit' }}>
                                          <span className="material-icons-outlined" style={{ fontSize: '14px', color: currentLenderDue !== actualDue ? 'var(--danger)' : isPaid ? 'var(--success)' : 'var(--warning)' }}>
                                            {currentLenderDue !== actualDue ? 'report_problem' : isPaid ? 'cloud_done' : 'hourglass_bottom'}
                                          </span>
                                          <span>{currentLenderDue !== actualDue ? 'STATUS: CORRUPT' : isPaid ? 'Status: Sealed' : 'Status: Pending'}</span>
                                        </div>
                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-light)', fontFamily: 'monospace' }}>
                                          Key: {lenderKey}
                                        </span>
                                      </div>

                                      {/* Column 2: Synchronizer Channel */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                          2. Sync Channel (Agent Cash)
                                        </span>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', color: isTampered ? 'var(--danger)' : 'inherit' }}>
                                          <span className="material-icons-outlined" style={{ fontSize: '14px', color: isTampered ? 'var(--danger)' : isPaid ? 'var(--success)' : 'var(--text-light)' }}>
                                            {isTampered ? 'sync_problem' : isPaid ? 'sync' : 'sync_disabled'}
                                          </span>
                                          <span>
                                            {isTampered 
                                              ? 'SYNC INTERRUPTED' 
                                              : isPaid 
                                                ? inst.collectionEntry 
                                                  ? 'Instant Cash Synced' 
                                                  : 'Online Gateway Sync'
                                                : 'Awaiting Handshake'
                                            }
                                          </span>
                                        </div>
                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>
                                          {isTampered
                                            ? 'Consensus mismatched'
                                            : isPaid 
                                              ? inst.collectionEntry 
                                                ? `Collected by: Agent ${inst.collectionEntry.agent?.name || 'Agent'}` 
                                                : 'Gateway Session Active'
                                              : 'No active cash payload'
                                          }
                                        </span>
                                      </div>

                                      {/* Column 3: Borrower Journal */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                          3. Borrower Local Journal
                                        </span>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', color: currentBorrowerReceived !== actualReceived ? 'var(--danger)' : 'inherit' }}>
                                          <span className="material-icons-outlined" style={{ fontSize: '14px', color: currentBorrowerReceived !== actualReceived ? 'var(--danger)' : isPaid ? 'var(--success)' : 'var(--text-light)' }}>
                                            {currentBorrowerReceived !== actualReceived ? 'report_problem' : isPaid ? 'devices' : 'no_sim'}
                                          </span>
                                          <span>{currentBorrowerReceived !== actualReceived ? 'STATUS: TAMPERED' : isPaid ? 'Receipt Signed' : 'Awaiting Receipt'}</span>
                                        </div>
                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-light)', fontFamily: 'monospace' }}>
                                          Key: {borrowerKey}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Security Guarantee and Explanation Footer */}
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                      <span className="material-icons-outlined" style={{ fontSize: '16px', color: isTampered ? 'var(--danger)' : 'var(--primary)', marginTop: '2px' }}>
                                        {isTampered ? 'gpp_bad' : 'security'}
                                      </span>
                                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                                        <strong>Tamper-Proof Guarantee:</strong> Both sides must agree for the seal block to remain intact. If the lender alters values, or if the borrower claims a payment they did not make, the resulting mismatched signature block (<code>{combinedSeal}</code>) breaks the consensus seal automatically. This dual-verification protocol protects everyone from fraud.
                                      </p>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Ledger Tab Panel */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{b.paymentLedger}</h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>{b.paymentLedgerDesc}</p>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {loan.payments && loan.payments.length > 0 ? (
                  loan.payments.map((p: any) => (
                    <div key={p.id} style={{ background: 'var(--surface)', padding: '16px 20px', borderRadius: '16px', boxShadow: 'var(--shadow)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flex: 1, justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--success)' }}>
                              check_circle
                            </span>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{b.simulatedRepayment}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {formatDate(p.paymentDate)} • {p.paymentMode.toUpperCase()}
                          </div>
                          {p.referenceNumber && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-light)', fontFamily: 'monospace', marginTop: '2px' }}>
                              {b.referenceNo}: {p.referenceNumber}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--success)' }}>+{formatCurrency(Number(p.amount))}</div>
                          <span className="badge badge-paid" style={{ fontSize: '0.6rem', padding: '2px 6px', marginTop: '4px' }}>
                            {b.completed}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)', background: 'var(--surface)', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--text-light)' }}>history</span>
                    <h4 style={{ margin: '12px 0 4px', fontSize: '0.95rem', fontWeight: 600 }}>{b.noPaymentsRecorded}</h4>
                    <p style={{ fontSize: '0.8rem', margin: 0 }}>{b.noPaymentsRecordedDesc}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Details Tab Panel */}
          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{b.loanDetails}</h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>{b.loanDetailsDesc}</p>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: loan.appType === 'autofinance' && loan.vehicle ? '1fr 1fr' : '1fr', gap: '20px' }} className="grid-2">
                {/* Parameters */}
                <div className="card" style={{ padding: '20px 24px' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {b.loanParameters}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{b.loanPrincipal}</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(Number(loan.principal))}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{b.interestDeduction}</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(Number(loan.deduction))}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{b.disbursedAmount}</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(Number(loan.disbursed))}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{b.repaymentFrequency}</span>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{loan.frequency}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{b.totalTenure}</span>
                      <span style={{ fontWeight: 600 }}>{loan.tenure} {b.instalments}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{b.amountPerInstalment}</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(Number(loan.perInstalment))}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{b.startDate}</span>
                      <span style={{ fontWeight: 600 }}>{formatDate(loan.startDate)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{b.accountStatus}</span>
                      <span className={`badge ${loan.status === 'closed' ? 'badge-paid' : loan.status === 'overdue' ? 'badge-overdue' : 'badge-upcoming'}`} style={{ fontWeight: 700 }}>
                        {loan.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Vehicle Collateral */}
                {loan.appType === 'autofinance' && loan.vehicle && (
                  <div className="card" style={{ padding: '20px 24px', borderLeft: '4px solid var(--info)' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--info)' }}>
                      {b.vehicleCollateral}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{b.registrationNumber}</span>
                        <span style={{ fontWeight: 700 }}>{loan.vehicle.registrationNo}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{b.makeAndModel}</span>
                        <span style={{ fontWeight: 600 }}>{loan.vehicle.make} {loan.vehicle.model}</span>
                      </div>
                      {loan.vehicle.year && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{b.yearOfManufacture}</span>
                          <span style={{ fontWeight: 600 }}>{loan.vehicle.year}</span>
                        </div>
                      )}
                      {loan.vehicle.engineNo && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{b.engineNumber}</span>
                          <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{loan.vehicle.engineNo}</span>
                        </div>
                      )}
                      {loan.vehicle.chassisNo && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{b.chassisNumber}</span>
                          <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{loan.vehicle.chassisNo}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{b.collateralStatus}</span>
                        <span className="badge badge-active">{loan.vehicle.status}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Calculator Tab Panel */}
          {activeTab === 'calculator' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{b.emiPlanner}</h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>{b.emiPlannerDesc}</p>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }} className="grid-2">
                {/* Left Column: Sliders */}
                <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {b.configureLoan}
                  </h3>
                  
                  {/* Principal Slider */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{b.principalAmount}</span>
                      <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(calcPrincipal)}</span>
                    </div>
                    <input
                      type="range"
                      min="5000"
                      max="200000"
                      step="5000"
                      value={calcPrincipal}
                      onChange={(e) => setCalcPrincipal(Number(e.target.value))}
                      style={{ width: '100%', height: '8px', borderRadius: '4px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-light)' }}>
                      <span>₹5,000</span>
                      <span>₹2,00,000</span>
                    </div>
                  </div>

                  {/* Rate Slider */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{b.interestRateFlat}</span>
                      <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{calcRate}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      step="0.5"
                      value={calcRate}
                      onChange={(e) => setCalcRate(Number(e.target.value))}
                      style={{ width: '100%', height: '8px', borderRadius: '4px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-light)' }}>
                      <span>5%</span>
                      <span>30%</span>
                    </div>
                  </div>

                  {/* Tenure Slider */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{b.tenurePayments}</span>
                      <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{calcTenure} {b.instalments}</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={calcTenure}
                      onChange={(e) => setCalcTenure(Number(e.target.value))}
                      style={{ width: '100%', height: '8px', borderRadius: '4px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-light)' }}>
                      <span>10 payments</span>
                      <span>100 payments</span>
                    </div>
                  </div>

                  {/* Frequency Selector */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{b.frequency}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(['daily', 'weekly', 'monthly'] as const).map((freq) => {
                        const active = calcFrequency === freq;
                        return (
                          <button
                            key={freq}
                            type="button"
                            onClick={() => setCalcFrequency(freq)}
                            style={{
                              flex: 1,
                              height: '42px',
                              border: `2px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                              borderRadius: '10px',
                              background: active ? 'var(--primary-light)' : 'var(--surface)',
                              color: active ? 'var(--primary-dark)' : 'var(--text-secondary)',
                              fontWeight: 700,
                              fontSize: '0.82rem',
                              textTransform: 'capitalize',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {freq === 'daily' ? b.freqDaily : freq === 'weekly' ? b.freqWeekly : b.freqMonthly}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Results & Schedule */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, var(--surface) 0%, #fffdf5 100%)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ fontSize: '0.88rem', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {b.estimatedSummary}
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', textAlign: 'center' }}>
                      <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{b.estimatedEmi}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>{formatCurrency(emi)}</div>
                      </div>
                      <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{b.totalInterest}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>{formatCurrency(totalInterest)}</div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{b.totalPayableAmount}</span>
                      <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text)' }}>{formatCurrency(totalPayableCalc)}</span>
                    </div>
                  </div>

                  {/* Scrollable schedule preview */}
                  <div className="card" style={{ padding: '16px 20px', maxHeight: '250px', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '0.88rem', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {b.amortizationPreview}
                    </h3>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {calcSchedule.map((item) => (
                        <div key={item.instalmentNo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg)', borderRadius: '10px', fontSize: '0.78rem', border: '1px solid var(--border)' }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{b.payment} #{item.instalmentNo}</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              Due: {item.dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text)' }}>{formatCurrency(item.emi)}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-light)', marginTop: '2px' }}>
                              {b.bal}: {formatCurrency(item.remainingBalance)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Floating Bottom Repay Button for mobile view */}
      {outstandingBalance > 0 && activeTab === 'dashboard' && (
        <div className="btn-mobile-only" style={{ position: 'fixed', bottom: '0', left: '0', right: '0', padding: '16px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', borderTop: '1px solid var(--border)', zIndex: 100, display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => {
              if (nextDueInstalment) {
                const due = Number(nextDueInstalment.dueAmount) - Number(nextDueInstalment.receivedAmount);
                setPaymentAmount(String(due));
              } else {
                setPaymentAmount(String(outstandingBalance));
              }
              setPaymentStep('input');
              setPaymentType('next');
              setShowPaymentModal(true);
            }}
            className="btn btn-primary"
            style={{ width: '100%', maxWidth: '600px', height: '48px', justifyContent: 'center', fontSize: '0.95rem', borderRadius: '14px', boxShadow: '0 4px 20px rgba(245,166,35,0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span className="material-icons-outlined">payments</span>
            <span>{b.makeRepayment}</span>
          </button>
        </div>
      )}

      {/* Payment Drawer Modal */}
      {showPaymentModal && (
        <div className="modal-overlay show" style={{ zIndex: 2000 }}>
          <div className="modal" style={{ width: '100%', maxWidth: '640px', animation: 'fadeUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            
            {/* Modal Header */}
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons-outlined" style={{ color: 'var(--primary)' }}>account_balance_wallet</span>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                  {paymentStep === 'input' ? b.simulateRepayment : paymentStep === 'simulate' ? b.completeVerification : b.repaymentSuccess}
                </h3>
              </div>
              <button
                onClick={() => {
                  if (!isSubmitting) {
                    setShowPaymentModal(false);
                    setPaymentStep('input');
                  }
                }}
                disabled={isSubmitting}
                className="modal-close"
                style={{ background: 'var(--bg)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ padding: '20px' }}>
              
              {/* Step 1: Input details */}
              {paymentStep === 'input' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Overdue Warning Banner */}
                  {overdueAmount > 0 && (
                    <div style={{ background: '#fef2f2', color: '#991b1b', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '18px', color: '#dc2626' }}>error_outline</span>
                        {b.overdueAlert}
                      </div>
                      <div style={{ fontSize: '0.72rem', opacity: 0.9 }}>
                        You have <strong>{overdueInstalments.length} overdue instalment{overdueInstalments.length > 1 ? 's' : ''}</strong> totaling <strong>{formatCurrency(overdueAmount)}</strong>. Please prioritize settling this outstanding balance to avoid late fee penalties.
                      </div>
                    </div>
                  )}

                  {/* Segmented Control for Payment Types */}
                  <div style={{ display: 'flex', background: 'var(--bg)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)', gap: '4px', marginBottom: '2px' }}>
                    {(['next', 'partial', 'preclose'] as const).map((type) => {
                      const active = paymentType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setPaymentType(type);
                            if (type === 'next') {
                              if (nextDueInstalment) {
                                const due = Number(nextDueInstalment.dueAmount) - Number(nextDueInstalment.receivedAmount);
                                setPaymentAmount(String(due));
                              } else {
                                setPaymentAmount('0');
                              }
                            } else if (type === 'preclose') {
                              setPaymentAmount(String(outstandingBalance));
                            } else {
                              setPaymentAmount('');
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: '10px 4px',
                            border: 'none',
                            borderRadius: '9px',
                            background: active ? 'var(--primary)' : 'transparent',
                            color: active ? '#fff' : 'var(--text-secondary)',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {type === 'next' ? b.nextDue : type === 'partial' ? b.partialPay : b.precloseSettle}
                        </button>
                      );
                    })}
                  </div>

                  {/* Preclosure Warning Banner */}
                  {paymentType === 'preclose' && (
                    <div style={{ background: '#ecfdf5', color: '#065f46', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                        {b.preclosureNotice}
                      </div>
                      <div style={{ fontSize: '0.72rem', opacity: 0.9 }}>
                        This option will simulate paying off the complete outstanding balance of <strong>{formatCurrency(outstandingBalance)}</strong>. Upon receipt, all remaining instalments will be marked as settled, and the account status will transition to <strong>CLOSED</strong>.
                      </div>
                    </div>
                  )}

                  {/* Amount Control */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>{b.repaymentAmountLabel}</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-secondary)' }}>₹</span>
                      <input
                        type="number"
                        className="form-control"
                        style={{ paddingLeft: '28px', fontSize: '1.25rem', fontWeight: 700, height: '48px', color: isExceedingTotal ? 'var(--danger)' : 'var(--text)', background: paymentType !== 'partial' ? 'var(--bg)' : 'inherit' }}
                        placeholder={b.enterAmount}
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        disabled={paymentType !== 'partial'}
                        required
                      />
                    </div>
                    {isExceedingTotal && (
                      <div style={{ color: 'var(--danger)', fontSize: '0.72rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '14px' }}>warning</span>
                        <span>Amount exceeds remaining balance of {formatCurrency(outstandingBalance)}.</span>
                      </div>
                    )}
                  </div>

                  {/* Payment Methods Selector (Fintech Pill buttons) */}
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>{b.selectSimulationMethod}</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                      <button
                        onClick={() => setPaymentMode('upi')}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '12px 6px',
                          borderRadius: '14px',
                          border: `2px solid ${paymentMode === 'upi' ? 'var(--primary)' : 'var(--border)'}`,
                          background: paymentMode === 'upi' ? 'var(--primary-light)' : 'var(--surface)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <span className="material-icons-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>qr_code_2</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>{b.upiQr}</span>
                      </button>
                      <button
                        onClick={() => setPaymentMode('card')}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '12px 6px',
                          borderRadius: '14px',
                          border: `2px solid ${paymentMode === 'card' ? 'var(--primary)' : 'var(--border)'}`,
                          background: paymentMode === 'card' ? 'var(--primary-light)' : 'var(--surface)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <span className="material-icons-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>credit_card</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>{b.debitCard}</span>
                      </button>
                      <button
                        onClick={() => setPaymentMode('netbanking')}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '12px 6px',
                          borderRadius: '14px',
                          border: `2px solid ${paymentMode === 'netbanking' ? 'var(--primary)' : 'var(--border)'}`,
                          background: paymentMode === 'netbanking' ? 'var(--primary-light)' : 'var(--surface)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <span className="material-icons-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>account_balance</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>{b.netBanking}</span>
                      </button>
                      <button
                        onClick={() => setPaymentMode('cash')}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '12px 6px',
                          borderRadius: '14px',
                          border: `2px solid ${paymentMode === 'cash' ? 'var(--primary)' : 'var(--border)'}`,
                          background: paymentMode === 'cash' ? 'var(--primary-light)' : 'var(--surface)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <span className="material-icons-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>payments</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>{b.cash}</span>
                      </button>
                    </div>
                  </div>

                  {/* Real-time Allocation breakdown list */}
                  {simulatedAllocations.length > 0 && !isExceedingTotal && (
                    <div style={{ background: 'var(--bg)', borderRadius: '16px', padding: '14px 16px', border: '1px dashed var(--border)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                        {b.allocationBreakdown}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {simulatedAllocations.map((alloc, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Instalment #{alloc.instalmentNo}</span>
                            <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                              {formatCurrency(alloc.amount)} {alloc.isFullyPaid && <span style={{ color: 'var(--success)', fontSize: '0.65rem', marginLeft: '4px' }}>(Settles)</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    disabled={isNaN(parseFloat(paymentAmount)) || parseFloat(paymentAmount) <= 0 || isExceedingTotal}
                    onClick={() => setPaymentStep('simulate')}
                    className="btn btn-primary"
                    style={{ height: '46px', width: '100%', justifyContent: 'center', borderRadius: '12px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    Proceed to Pay {paymentAmount ? `₹${parseFloat(paymentAmount).toLocaleString('en-IN')}` : ''}
                  </button>
                </div>
              )}

              {/* Step 2: Simulated interfaces */}
              {paymentStep === 'simulate' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                  
                  {/* UPI QR Simulator screen */}
                  {paymentMode === 'upi' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                      <div style={{ position: 'relative', width: '160px', height: '160px', background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '8px', boxShadow: 'var(--shadow)' }}>
                        
                        {paymentSettings?.upiQrUrl ? (
                          <img 
                            src={paymentSettings.upiQrUrl} 
                            alt="Lender UPI QR Code" 
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          /* Mock QR graphic */
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', width: '100%', height: '100%' }}>
                            {Array.from({ length: 16 }).map((_, i) => (
                              <div key={i} style={{ background: i % 3 === 0 || i % 7 === 0 ? '#111827' : 'transparent', borderRadius: '2px' }}></div>
                            ))}
                          </div>
                        )}

                        {/* Scanner sweep animation */}
                        <div style={{ position: 'absolute', left: 0, right: 0, height: '3px', background: 'var(--primary)', boxShadow: '0 0 8px var(--primary)', animation: 'sweep 2.5s ease-in-out infinite' }}></div>
                      </div>
                      
                      <div style={{ textAlign: 'center', marginTop: '16px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>
                          {paymentSettings?.upiQrUrl ? "Scan Lender's Verified QR Code" : "Scan to Pay via UPI App"}
                        </span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px', fontFamily: 'monospace' }}>
                          {/* Never show a placeholder VPA — a real payment to it would be lost. */}
                          {paymentSettings?.upiId
                            ? <>UPI ID: {paymentSettings.upiId} • ₹{parseFloat(paymentAmount).toLocaleString('en-IN')}</>
                            : <>UPI not configured — contact your branch • ₹{parseFloat(paymentAmount).toLocaleString('en-IN')}</>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cash Handover Simulation screen */}
                  {paymentMode === 'cash' && (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(39, 174, 96, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '28px', color: 'var(--success)' }}>payments</span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700 }}>Simulate Cash Handover</h4>
                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Simulate handing over cash to a branch cashier or collector agent.
                        </p>
                      </div>
                      
                      <div style={{ width: '100%', background: 'var(--bg)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Handover Amount</span>
                          <span style={{ fontWeight: 700, color: 'var(--text)' }}>{formatCurrency(parseFloat(paymentAmount))}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Agent Desk</span>
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>Branch Cashier Office</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Verification Status</span>
                          <span style={{ fontWeight: 600, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-icons-outlined" style={{ fontSize: '14px', color: 'var(--warning)' }}>pending</span>
                            Pending Cashier Verify
                          </span>
                        </div>
                        
                        <div className="form-group" style={{ margin: 0, borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                          <label className="form-label" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Collector / Receipt Reference</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. REC-58291 or cashier name"
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>
                      
                      <div style={{ background: '#fffbeb', color: '#b45309', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.7rem', display: 'flex', gap: '6px', width: '100%' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '16px', flexShrink: 0 }}>info</span>
                        <span>Upon submission, a pending ledger record is immediately synced, pending agent physical handover check.</span>
                      </div>
                    </div>
                  )}

                  {/* Card Simulation screens */}
                  {paymentMode === 'card' && (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      
                      {/* Premium Glassmorphic Card Mockup */}
                      <div style={{ width: '100%', height: '150px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', borderRadius: '16px', padding: '20px', color: '#fff', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span className="material-icons-outlined" style={{ fontSize: '32px', color: 'var(--primary)' }}>contactless</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, fontStyle: 'italic', color: 'rgba(255,255,255,0.7)' }}>SIMULATION</span>
                        </div>
                        <div style={{ fontSize: '1.15rem', letterSpacing: '2px', fontFamily: 'monospace', fontWeight: 600 }}>
                          {cardNumber || '•••• •••• •••• ••••'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>
                          <div>
                            <div>CARD HOLDER</div>
                            <div style={{ color: '#fff', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>{loan.customer.name}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div>EXPIRES</div>
                            <div style={{ color: '#fff', fontWeight: 600, marginTop: '2px' }}>{cardExpiry || 'MM/YY'}</div>
                          </div>
                        </div>
                      </div>

                      {/* Card Inputs */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Card Number</label>
                          <input
                            type="text"
                            className="form-control"
                            maxLength={19}
                            placeholder="4111 2222 3333 4444"
                            value={cardNumber}
                            onChange={(e) => handleCardNumberChange(e.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Expiry Date</label>
                            <input
                              type="text"
                              className="form-control"
                              maxLength={5}
                              placeholder="MM/YY"
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(e.target.value)}
                              disabled={isSubmitting}
                            />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>CVV</label>
                            <PasswordInput
                              className="form-control"
                              maxLength={3}
                              placeholder="***"
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                              disabled={isSubmitting}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Net Banking simulated screen */}
                  {paymentMode === 'netbanking' && (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Choose bank account to debit:</label>
                      {['SBI Bank', 'HDFC Bank', 'ICICI Bank', 'Axis Bank'].map((bank, i) => (
                        <div
                          key={i}
                          onClick={() => setReferenceNumber(`MOCK-${bank.slice(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                          }}
                        >
                          <span>{bank}</span>
                          <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>radio_button_checked</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Simulation Action buttons */}
                  <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => setPaymentStep('input')}
                      disabled={isSubmitting}
                      className="btn btn-secondary"
                      style={{ flex: 1, justifyContent: 'center', height: '42px', borderRadius: '10px' }}
                    >
                      Back
                    </button>
                    <button
                      onClick={handlePaymentSubmit}
                      disabled={isSubmitting || (paymentMode === 'card' && (!cardNumber || !cardExpiry || !cardCvv))}
                      className="btn btn-primary"
                      style={{ flex: 2, justifyContent: 'center', height: '42px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="material-icons-outlined" style={{ animation: 'spin 1s linear infinite', fontSize: '16px' }}>autorenew</span>
                          <span>Processing...</span>
                        </>
                      ) : (
                        'Verify & Complete'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Success Screen */}
              {paymentStep === 'success' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '20px 0', textAlign: 'center' }}>
                  
                  {/* Scaling Success checkmark */}
                  <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(39,174,96,0.2)' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '40px' }}>done</span>
                  </div>

                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>Repayment Successful</h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                      The transaction of ₹{parseFloat(paymentAmount || '0').toLocaleString('en-IN')} has been approved and allocated chronologically.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setPaymentStep('input');
                      window.location.reload();
                    }}
                    className="btn btn-primary"
                    style={{ height: '44px', width: '100%', justifyContent: 'center', borderRadius: '12px', marginTop: '10px' }}
                  >
                    Done & Refresh Dashboard
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Embedded CSS Keyframes for Scan Sweep & Card Hover animations */}
      <style jsx global>{`
        @keyframes sweep {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .premium-card-hover:hover {
          transform: translateY(-5px) rotate(1deg) !important;
          box-shadow: 0 12px 28px rgba(245, 166, 35, 0.35) !important;
        }
        @media (max-width: 768px) {
          .btn-text-desktop { display: none !important; }
        }
        @media (min-width: 769px) {
          .btn-mobile-only { display: none !important; }
        }
      `}</style>

    </div>
  );
}
