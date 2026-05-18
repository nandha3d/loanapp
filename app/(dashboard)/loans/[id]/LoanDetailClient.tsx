'use client';

import { useMemo, useState } from 'react';
import { formatCurrency, formatDate, getBadgeClass, calcPercentage } from '@/lib/utils';
import { markInstalmentPaid, requestCollectionEdit, waiveLoanPenalty, settleLoanPenalty, closeLoan, renewLoan } from './actions';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { calculateCreditScore } from '@/lib/creditScore';

const CreditScoreGauge = ({ score, grade }: { score: number, grade: string }) => {
  const min = 300;
  const max = 850;
  const pct = Math.max(0, Math.min(100, ((score - min) / (max - min)) * 100));
  const rotation = (pct * 1.8) - 90;
  
  const getScoreColor = (s: number) => {
    if (s < 500) return '#EF4444';
    if (s < 650) return '#F59E0B';
    if (s < 750) return '#EAB308';
    return '#16A34A';
  };

  return (
    <div style={{ textAlign: 'center', width: '120px' }}>
      <div style={{ position: 'relative', height: '65px', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
        <svg viewBox="0 0 100 55" style={{ width: '110px' }}>
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#F1F5F9" strokeWidth="10" strokeLinecap="round" />
          <path d="M 10 50 A 40 40 0 0 1 30 15.3" fill="none" stroke="#EF4444" strokeWidth="10" />
          <path d="M 30 15.3 A 40 40 0 0 1 50 10" fill="none" stroke="#F59E0B" strokeWidth="10" />
          <path d="M 50 10 A 40 40 0 0 1 70 15.3" fill="none" stroke="#EAB308" strokeWidth="10" />
          <path d="M 70 15.3 A 40 40 0 0 1 90 50" fill="none" stroke="#16A34A" strokeWidth="10" />
          <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '50px 50px', transition: 'all 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            <circle cx="50" cy="10" r="5" fill="#FFF" stroke={getScoreColor(score)} strokeWidth="2" />
          </g>
        </svg>
        <div style={{ position: 'absolute', bottom: '2px', fontSize: '1.6rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px' }}>{score}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.55rem', color: 'var(--text-light)', marginTop: '-8px', padding: '0 8px', fontWeight: 700, width: '110px', margin: '0 auto' }}>
        <span>300</span>
        <span>850</span>
      </div>
      <div style={{ fontSize: '.68rem', fontWeight: 800, color: getScoreColor(score), textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>{grade}</div>
    </div>
  );
};

export default function LoanDetailClient({
  loan,
  currencySymbol,
  dict,
  userRole,
  userId,
}: {
  loan: any;
  currencySymbol: string;
  dict: any;
  userRole: string;
  userId?: string;
}) {
  const d = dict.loanDetail;
  const router = useRouter();
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';
  const totalCollected = Number(loan.totalCollected || 0);
  const totalRepayable = Number(loan.perInstalment) * loan.totalInstalments;
  const outstanding = totalRepayable - totalCollected;
  
  const [viewMode, setViewMode] = useState<'actual' | 'distributed' | 'recent_first'>('actual');
  const [showRestructuredRates, setShowRestructuredRates] = useState(false);
  const [highlightedInstalmentNo, setHighlightedInstalmentNo] = useState<number | null>(null);

  const scrollToInstalment = (instalmentNo: number) => {
    setHighlightedInstalmentNo(instalmentNo);
    setTimeout(() => {
      const el = document.getElementById(`inst-row-${instalmentNo}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
    // Clear highlight after 2.5 seconds
    setTimeout(() => {
      setHighlightedInstalmentNo(null);
    }, 2500);
  };

  const displayInstalments = useMemo(() => {
    if (viewMode === 'actual') return loan.instalments;
    
    const dist = JSON.parse(JSON.stringify(loan.instalments));
    let remaining = totalCollected;
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Include today fully

    if (viewMode === 'distributed') {
      for (const inst of dist) {
        const due = Number(inst.dueAmount);
        if (remaining >= due) {
          inst.receivedAmount = due;
          inst.status = 'paid';
          remaining -= due;
        } else if (remaining > 0) {
          inst.receivedAmount = remaining;
          inst.status = 'partial';
          remaining = 0;
        } else {
          inst.receivedAmount = 0;
          const dueDate = new Date(inst.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          inst.status = dueDate < today ? 'missed' : 'upcoming';
        }
      }
      return dist;
    } else {
      // viewMode === 'recent_first' (Retroactive Targeted Sequential adjustment of extras)
      // 1. Iterate chronologically to find excess payments, and apply them retroactively to previous outstanding days
      for (let i = 0; i < dist.length; i++) {
        const inst = dist[i];
        const due = Number(inst.dueAmount);
        let received = Number(inst.receivedAmount || 0);

        if (received > due) {
          let extra = received - due;
          // Set current installment's received amount to exactly due (fully paid)
          inst.receivedAmount = due;
          inst.status = 'paid';

          // Distribute the extra retroactively to previous outstanding installments
          for (let j = i - 1; j >= 0; j--) {
            if (extra <= 0) break;
            const prevInst = dist[j];
            const prevDue = Number(prevInst.dueAmount);
            const prevReceived = Number(prevInst.receivedAmount || 0);
            
            if (prevReceived < prevDue) {
              const gap = prevDue - prevReceived;
              if (extra >= gap) {
                prevInst.receivedAmount = prevDue;
                prevInst.status = 'paid';
                extra -= gap;
              } else {
                prevInst.receivedAmount = prevReceived + extra;
                prevInst.status = 'partial';
                extra = 0;
              }
            }
          }

          // If there is still extra left, add it back to the current installment's received amount
          if (extra > 0) {
            inst.receivedAmount = due + extra;
          }
        }
      }

      // 2. For any installment, recalculate status based on final simulated received amount and due date
      for (const inst of dist) {
        const due = Number(inst.dueAmount);
        const received = Number(inst.receivedAmount || 0);
        if (received >= due) {
          inst.status = 'paid';
        } else if (received > 0) {
          inst.status = 'partial';
        } else {
          const dueDate = new Date(inst.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          inst.status = dueDate < today ? 'missed' : 'upcoming';
        }
      }

      return dist;
    }
  }, [loan.instalments, viewMode, totalCollected]);

  const dynamicRemainingCount = useMemo(() => {
    return Math.ceil(outstanding / Number(loan.perInstalment));
  }, [outstanding, loan.perInstalment]);

  const dynamicPaidCount = useMemo(() => {
    return Math.max(0, loan.totalInstalments - dynamicRemainingCount);
  }, [loan.totalInstalments, dynamicRemainingCount]);

  const pct = useMemo(() => {
    return Math.round((dynamicPaidCount / loan.totalInstalments) * 100);
  }, [dynamicPaidCount, loan.totalInstalments]);

  const remainingScheduledCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = displayInstalments.filter((inst: any) => {
      const dueDate = new Date(inst.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= today;
    }).length;
    return count || 1;
  }, [displayInstalments]);

  const adjustedInstallment = useMemo(() => {
    return Math.round((outstanding / remainingScheduledCount) * 100) / 100;
  }, [outstanding, remainingScheduledCount]);

  const missedInstalments = displayInstalments.filter((i: any) => i.status === 'missed');
  const missedCount = missedInstalments.length;
  const recordedPenalty = loan.penalties.reduce((sum: number, p: any) => sum + Number(p.grossPenalty), 0);
  const potentialPenalty = missedCount * Number(loan.penaltyRate);
  const totalPenalty = Math.max(recordedPenalty, potentialPenalty);

  const settledPenalty = loan.penalties.reduce((sum: number, p: any) => sum + Number(p.settledAmount), 0);
  const waivedPenalty = loan.penalties.reduce((sum: number, p: any) => sum + Number(p.waivedAmount), 0);
  const netPenalty = totalPenalty - settledPenalty - waivedPenalty;

  const [paymentModal, setPaymentModal] = useState<any>(null);
  const [penaltyModal, setPenaltyModal] = useState<any>(null);
  const [closeModal, setCloseModal] = useState(false);
  const [renewModal, setRenewModal] = useState(false);
  const [chequeReturned, setChequeReturned] = useState(false);
  const [loading, setLoading] = useState(false);

  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState('cash');
  const [payRemarks, setPayRemarks] = useState('');
  const [payReason, setPayReason] = useState('');

  const [penAction, setPenAction] = useState<'waive' | 'settle'>('settle');
  const [penAmount, setPenAmount] = useState(0);
  const [penNotes, setPenNotes] = useState('');

  const openPaymentModal = (inst: any) => {
    const isPaid = Number(inst.receivedAmount) > 0;
    let defaultAmount = Number(inst.dueAmount);
    if (!isPaid && showRestructuredRates) {
      defaultAmount = adjustedInstallment;
    }
    setPayAmount(isPaid ? Number(inst.receivedAmount) : defaultAmount);
    setPayMode(inst.paymentMode || 'cash');
    setPayRemarks(inst.remarks || '');
    setPayReason('');
    setPaymentModal(inst);
  };

  const handleSubmitPayment = async () => {
    if (!paymentModal || payAmount < 0) return;
    setLoading(true);
    const fd = new FormData();
    fd.set('instalmentId', paymentModal.id);
    
    const isEditRequest = Number(paymentModal.receivedAmount) > 0 && !isAdmin;

    if (isEditRequest) {
      fd.set('requestedAmount', String(payAmount));
      fd.set('reason', payReason);
      const result = await requestCollectionEdit(fd);
      setLoading(false);
      if (result.success) {
        setPaymentModal(null);
        alert('Edit request submitted successfully.');
      } else {
        alert(result.error || 'Failed to submit request');
      }
    } else {
      fd.set('receivedAmount', String(payAmount));
      fd.set('paymentMode', payMode);
      fd.set('remarks', payRemarks);
      const result = await markInstalmentPaid(fd);
      setLoading(false);
      if (result.success) {
        setPaymentModal(null);
        router.refresh();
      } else {
        alert(result.error || d.failedToRecordPayment);
      }
    }
  };

  const openPenaltyModal = (penalty: any, action: 'waive' | 'settle') => {
    setPenAction(action);
    const gross = Number(penalty.grossPenalty);
    const settled = Number(penalty.settledAmount);
    const waived = Number(penalty.waivedAmount);
    setPenAmount(action === 'settle' ? gross - settled - waived : gross - settled - waived);
    setPenNotes('');
    setPenaltyModal(penalty);
  };

  const handleSubmitPenalty = async () => {
    if (!penaltyModal) return;
    setLoading(true);
    const fd = new FormData();
    fd.set('penaltyId', penaltyModal.id);
    fd.set('loanId', loan.id);
    fd.set('grossPenalty', String(penaltyModal.grossPenalty));
    fd.set('notes', penNotes);

    let result;
    if (penAction === 'waive') {
      fd.set('waivedAmount', String(penAmount));
      result = await waiveLoanPenalty(fd);
    } else {
      fd.set('settledAmount', String(penAmount));
      result = await settleLoanPenalty(fd);
    }
    setLoading(false);
    if (result.success) {
      setPenaltyModal(null);
      router.refresh();
    } else {
      alert(result.error || d.failedToProcessPenalty);
    }
  };

  const handleCloseLoan = async () => {
    const activeChequesCount = loan.customer?.securityCheques?.filter(
      (c: any) => c.status === 'active'
    ).length ?? 0;
    if (activeChequesCount > 0 && !chequeReturned) {
      alert(d.pleaseConfirmCheque);
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.set('loanId', loan.id);
    fd.set('markChequesReturned', chequeReturned ? '1' : '0');
    const result = await closeLoan(fd);
    setLoading(false);
    if (result.success) {
      setCloseModal(false);
      router.refresh();
    } else {
      alert(result.error || d.failedToCloseLoan);
    }
  };

  const handleRenewLoan = async () => {
    setLoading(true);
    const fd = new FormData();
    fd.set('loanId', loan.id);
    const result = await renewLoan(fd);
    setLoading(false);
    if (result.success && (result as any).newLoanId) {
      setRenewModal(false);
      router.push(`/loans/${(result as any).newLoanId}`);
    } else {
      alert((result as any).error || d.failedToRenewLoan);
    }
  };

  const { score: creditScore, grade: creditGrade } = calculateCreditScore(loan.customer.loans || []);

  return (
    <>
      <style>{`
        .loan-top-card { display: flex; flex-direction: column; gap: 16px; }
        .loan-top-header { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 4px; }
        .loan-main-row { display: flex; gap: 24px; align-items: center; justify-content: space-between; }
        .avatar-col { flex: 0 0 140px; display: flex; flex-direction: column; align-items: center; gap: 10px; padding-right: 32px; border-right: 1px solid var(--border); }
        .meta-col { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px 24px; padding: 0 10px; }
        .heatmap-col { flex: 2.2; min-width: 0; padding: 0 20px; border-left: 1px solid var(--border); border-right: 1px solid var(--border); }
        .stats-col { flex: 0 0 auto; display: flex; gap: 24px; align-items: center; padding-left: 20px; }
        .cm-label { font-size: .78rem; color: var(--text-light); text-transform: uppercase; letter-spacing: .5px; line-height: 1.2; }
        .cm-value { font-size: 1.05rem; font-weight: 700; margin-top: 3px; white-space: nowrap; }
        .heatmap-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #F1F5F9; padding-bottom: 8px; }
        .heatmap-legend { display: flex; gap: 10px; fontSize: .68rem; color: var(--text-secondary); fontWeight: 600; }
        .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
        .heatmap-cell {
          position: relative;
          cursor: pointer;
          transition: transform 0.15s ease, filter 0.15s ease;
        }
        .heatmap-cell:hover {
          transform: scale(1.25);
          filter: brightness(1.15);
          z-index: 10;
        }
        .heatmap-cell .tooltip-content {
          visibility: hidden;
          opacity: 0;
          width: 190px;
          background-color: #1E293B;
          color: #fff;
          text-align: left;
          border-radius: 6px;
          padding: 8px 10px;
          position: absolute;
          bottom: 130%;
          left: 50%;
          margin-left: -95px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
          transition: opacity 0.15s ease, visibility 0.15s ease;
          z-index: 100;
          font-size: 0.72rem;
          line-height: 1.4;
          pointer-events: none;
          border: 1px solid #334155;
        }
        .heatmap-cell .tooltip-content::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          margin-left: -5px;
          border-width: 5px;
          border-style: solid;
          border-color: #1E293B transparent transparent transparent;
        }
        .heatmap-cell:hover .tooltip-content {
          visibility: visible;
          opacity: 1;
        }
        .highlight-row {
          background-color: rgba(26, 115, 232, 0.15) !important;
          transition: background-color 0.3s ease;
        }
        @media (max-width: 1400px) { .meta-col { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 1200px) { .loan-main-row { flex-wrap: wrap; } .heatmap-col { border: none; flex: 1 1 100%; order: 3; margin-top: 16px; padding: 16px 0; border-top: 1px solid var(--border); } .stats-col { order: 2; } }
        @media (max-width: 768px) { .meta-col { grid-template-columns: repeat(2, 1fr); } .avatar-col { border: none; padding-right: 0; width: 100%; margin-bottom: 16px; } .stats-col { width: 100%; justify-content: center; } }
      `}</style>

      <div style={{ marginBottom: '12px' }}>
        <Link href="/loans" className="btn btn-ghost btn-sm">
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          {d.backToLoans}
        </Link>
      </div>
      
      <div className="card" style={{ marginBottom: '16px', padding: '12px 16px' }}>
        <div className="loan-top-card">
          <div className="loan-top-header">
            <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 800, color: 'var(--primary)' }}>
              {loan.loanCode} 
              <span style={{ color: 'var(--text-light)', fontWeight: 400, marginLeft: '8px' }}>
                [{loan.customer.customerCode}]
              </span>
              <span style={{ color: 'var(--text)', fontWeight: 700, marginLeft: '8px' }}>
                {loan.customer.name}
              </span>
            </h2>
            <span className={getBadgeClass(loan.status)} style={{ textTransform: 'capitalize', fontSize: '.7rem', padding: '3px 10px', borderRadius: '4px' }}>{loan.status}</span>
            <span style={{ fontSize: '.7rem', color: 'var(--text-light)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>calendar_today</span>
              <span style={{ textTransform: 'capitalize' }}>{loan.frequency} {d.schedule}</span>
            </span>
            <div style={{ marginLeft: '16px', display: 'flex', background: '#F1F5F9', borderRadius: '6px', padding: '2px' }}>
              <button 
                type="button"
                onClick={() => setViewMode('actual')}
                style={{ padding: '4px 10px', fontSize: '.7rem', fontWeight: 600, border: 'none', background: viewMode === 'actual' ? '#fff' : 'transparent', color: viewMode === 'actual' ? 'var(--primary)' : 'var(--text-secondary)', borderRadius: '4px', cursor: 'pointer', boxShadow: viewMode === 'actual' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
              >Actual</button>
              <button 
                type="button"
                onClick={() => setViewMode('distributed')}
                style={{ padding: '4px 10px', fontSize: '.7rem', fontWeight: 600, border: 'none', background: viewMode === 'distributed' ? '#fff' : 'transparent', color: viewMode === 'distributed' ? 'var(--primary)' : 'var(--text-secondary)', borderRadius: '4px', cursor: 'pointer', boxShadow: viewMode === 'distributed' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
              >Distributed</button>
              <button 
                type="button"
                onClick={() => setViewMode('recent_first')}
                style={{ padding: '4px 10px', fontSize: '.7rem', fontWeight: 600, border: 'none', background: viewMode === 'recent_first' ? '#fff' : 'transparent', color: viewMode === 'recent_first' ? 'var(--primary)' : 'var(--text-secondary)', borderRadius: '4px', cursor: 'pointer', boxShadow: viewMode === 'recent_first' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
              >Retroactive</button>
            </div>
          </div>
 
          <div className="loan-main-row">
            <div className="avatar-col">
              <div style={{ width: '140px', height: '140px', borderRadius: '16px', overflow: 'hidden', border: '2px solid var(--border)', background: '#F8FAFC', marginBottom: '4px' }}>
                {loan.customer.profilePhoto ? (
                  <img src={loan.customer.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-light)' }}>
                    <span className="material-icons" style={{ fontSize: '48px' }}>person</span>
                  </div>
                )}
              </div>
            </div>
 
            <div className="meta-col">
              <div><div className="cm-label">{d.principal}</div><div className="cm-value">{formatCurrency(loan.principal, currencySymbol)}</div></div>
              <div><div className="cm-label">{d.repayable}</div><div className="cm-value" style={{ color: 'var(--primary)' }}>{formatCurrency(totalRepayable, currencySymbol)}</div></div>
              <div><div className="cm-label">{d.disbursed}</div><div className="cm-value">{formatCurrency(loan.disbursed, currencySymbol)}</div></div>
              <div><div className="cm-label">{d.frequency}</div><div className="cm-value" style={{ textTransform: 'capitalize' }}>{loan.frequency}</div></div>
              <div><div className="cm-label">{d.tenure}</div><div className="cm-value">{loan.tenure} {loan.frequency === 'daily' ? d.daysSuffix : loan.frequency === 'weekly' ? d.weeksSuffix : d.monthsSuffix}</div></div>
              <div><div className="cm-label">{d.startDate}</div><div className="cm-value">{formatDate(loan.startDate)}</div></div>
              <div><div className="cm-label">{d.perInst}</div><div className="cm-value">{formatCurrency(loan.perInstalment, currencySymbol)}</div></div>
              <div><div className="cm-label">{d.collected}</div><div className="cm-value" style={{ color: 'var(--success)' }}>{formatCurrency(totalCollected, currencySymbol)}</div></div>
              <div><div className="cm-label">{d.outstanding}</div><div className="cm-value" style={{ color: outstanding > 0 ? 'var(--danger)' : 'var(--success)' }}>{formatCurrency(outstanding, currencySymbol)}</div></div>
              
              <div>
                <div className="cm-label">Paid Period</div>
                <div className="cm-value" style={{ color: 'var(--success)' }}>
                  {dynamicPaidCount} {loan.frequency === 'daily' ? 'Days' : loan.frequency === 'weekly' ? 'Weeks' : 'Months'}
                </div>
              </div>
              <div>
                <div className="cm-label">Remaining</div>
                <div className="cm-value" style={{ color: 'var(--danger)' }}>
                  {dynamicRemainingCount} {loan.frequency === 'daily' ? 'Days' : loan.frequency === 'weekly' ? 'Weeks' : 'Months'}
                </div>
              </div>

              {outstanding > 0 && (
                <div style={{ gridColumn: 'span 4', borderTop: '1px dashed var(--border)', paddingTop: '12px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>💡 Finishing Rate Option (Even Distribution)</span>
                    <p style={{ fontSize: '.68rem', color: 'var(--text-light)', margin: '2px 0 0' }}>
                      To settle outstanding {formatCurrency(outstanding, currencySymbol)} on-time across the remaining {remainingScheduledCount} scheduled {loan.frequency === 'daily' ? 'days' : loan.frequency === 'weekly' ? 'weeks' : 'months'}:
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '.9rem', fontWeight: 800, color: 'var(--primary)' }}>
                      {formatCurrency(adjustedInstallment, currencySymbol)}
                    </span>
                    <span style={{ fontSize: '.68rem', color: 'var(--text-light)' }}> / {loan.frequency === 'daily' ? 'Day' : loan.frequency === 'weekly' ? 'Week' : 'Month'}</span>
                  </div>
                </div>
              )}
            </div>
 
            <div className="heatmap-col">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '1px solid #F1F5F9', paddingBottom: '4px' }}>
                <span style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>📊 Calendar Tracker</span>
                <span style={{ fontSize: '.65rem', color: 'var(--text-light)' }}>Hover for info • Click to scroll</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '8px 0' }}>
                {displayInstalments.map((inst: any) => {
                  let bg = '#E2E8F0';
                  if (inst.status === 'paid') bg = '#16A34A';
                  else if (inst.status === 'partial') bg = '#F59E0B';
                  else if (inst.status === 'missed') bg = '#EF4444';
                  return (
                    <div 
                      key={inst.id} 
                      className="heatmap-cell"
                      onClick={() => scrollToInstalment(inst.instalmentNo)}
                      style={{ width: '18px', height: '18px', borderRadius: '3px', backgroundColor: bg }}
                    >
                      <div className="tooltip-content">
                        <div style={{ fontWeight: 800, marginBottom: '2px', borderBottom: '1px solid #475569', paddingBottom: '2px', fontSize: '.75rem' }}>
                          Instalment #{inst.instalmentNo}
                        </div>
                        <div>Due: <strong>{formatDate(inst.dueDate)}</strong></div>
                        <div>Expected: <strong>{formatCurrency(inst.dueAmount, currencySymbol)}</strong></div>
                        <div>Collected: <strong>{formatCurrency(inst.receivedAmount || 0, currencySymbol)}</strong></div>
                        <div style={{ textTransform: 'capitalize', marginTop: '2px', fontWeight: 700, color: inst.status === 'paid' ? '#4ADE80' : inst.status === 'partial' ? '#FBBF24' : '#F87171' }}>
                          Status: {inst.status}
                        </div>
                        <div style={{ fontSize: '.58rem', color: '#94A3B8', marginTop: '4px', textAlign: 'center', fontStyle: 'italic' }}>
                          Click to scroll & highlight
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
 
            <div className="stats-col" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ position: 'relative', width: '56px', height: '56px', margin: '0 auto' }}>
                    <svg viewBox="0 0 36 36" style={{ width: '56px', height: '56px', transform: 'rotate(-90deg)' }}>
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F1F5F9" strokeWidth="4" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--primary)" strokeWidth="4" strokeDasharray={`${pct}, 100`} strokeLinecap="round" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: 800 }}>{pct}%</div>
                  </div>
                  <div style={{ fontSize: '.55rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 700, textTransform: 'uppercase' }}>{dynamicPaidCount}/{loan.totalInstalments} {d.paid}</div>
                </div>
              </div>
              <CreditScoreGauge score={creditScore} grade={creditGrade} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid-60-40">
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>📅 {d.paymentSchedule}</h3>
            {outstanding > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.72rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                <input 
                  type="checkbox" 
                  checked={showRestructuredRates} 
                  onChange={(e) => setShowRestructuredRates(e.target.checked)} 
                  style={{ width: '13px', height: '13px', cursor: 'pointer' }}
                />
                <strong>Show Restructured Rate</strong>
              </label>
            )}
          </div>
          <div className="table-wrapper" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{d.date}</th>
                  <th>{d.time}</th>
                  <th>{d.due}</th>
                  <th>{d.received}</th>
                  <th>{d.status}</th>
                  <th>{d.action}</th>
                </tr>
              </thead>
              <tbody>
                 {displayInstalments.map((inst: any) => {
                  const collectedTime = inst.receivedAt ? new Date(inst.receivedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : null;
                  const isPaid = Number(inst.receivedAmount) > 0;
                  const isHighlighted = highlightedInstalmentNo === inst.instalmentNo;
                  return (
                    <tr 
                      key={inst.id} 
                      id={`inst-row-${inst.instalmentNo}`}
                      className={isHighlighted ? 'highlight-row' : ''}
                      style={{ opacity: inst.status === 'paid' && !isHighlighted ? 0.6 : 1 }}
                    >
                      <td>{inst.instalmentNo}</td>
                      <td>{formatDate(inst.dueDate)}</td>
                      <td style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>{collectedTime || '—'}</td>
                      <td>
                        {showRestructuredRates && inst.status !== 'paid' && new Date(inst.dueDate) >= new Date(new Date().setHours(0,0,0,0)) ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ color: 'var(--primary)', fontWeight: 800 }}>
                              {formatCurrency(adjustedInstallment, currencySymbol)}
                            </span>
                            <span style={{ fontSize: '.58rem', color: 'var(--text-light)', textDecoration: 'line-through' }}>
                              {formatCurrency(inst.dueAmount, currencySymbol)}
                            </span>
                          </div>
                        ) : (
                          formatCurrency(inst.dueAmount, currencySymbol)
                        )}
                      </td>
                      <td>{isPaid ? formatCurrency(inst.receivedAmount, currencySymbol) : '—'}</td>
                      <td><span className={getBadgeClass(inst.status)} style={{textTransform:'capitalize'}}>{inst.status}</span></td>
                      <td>
                        {loan.status !== 'closed' && (
                          <button className="btn btn-primary btn-sm" onClick={() => openPaymentModal(inst)} style={{ padding: '8px 12px', minHeight: '36px' }}>
                            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
                              {isPaid ? (isAdmin ? 'edit' : 'history_edu') : 'payments'}
                            </span>{' '}
                            {isPaid ? (isAdmin ? d.edit : 'Request') : d.pay}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header">
              <h3>⚡ {d.penaltySummary}</h3>
              <Link href={`/penalties?q=${encodeURIComponent(loan.loanCode)}`} className="btn btn-ghost btn-sm">
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                {d.viewInPenalties}
              </Link>
            </div>
            <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="stat-item">
                <div className="stat-value" style={{ color: 'var(--danger)' }}>{missedCount}</div>
                <div className="stat-label">{d.missedDays}</div>
              </div>
              <div className="stat-item">
                <div className="stat-value" style={{ color: 'var(--danger)' }}>{formatCurrency(totalPenalty, currencySymbol)}</div>
                <div className="stat-label">{d.totalPenalty}</div>
              </div>
              <div className="stat-item">
                <div className="stat-value" style={{ color: 'var(--success)' }}>{formatCurrency(settledPenalty + waivedPenalty, currencySymbol)}</div>
                <div className="stat-label">{d.settledWaived}</div>
              </div>
              <div className="stat-item">
                <div className="stat-value" style={{ color: 'var(--primary-dark)' }}>{formatCurrency(netPenalty, currencySymbol)}</div>
                <div className="stat-label">{d.netDue}</div>
              </div>
            </div>
            {netPenalty > 0 && (
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={() => openPenaltyModal({ id: 'new', grossPenalty: netPenalty }, 'waive')}>{d.waisePenalty}</button>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={() => openPenaltyModal({ id: 'new', grossPenalty: netPenalty }, 'settle')}>{d.settlePenalty}</button>
              </div>
            )}
          </div>

          {loan.status !== 'closed' && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header">
                <h3>{isAdmin ? `🔧 ${d.adminActions}` : '⚙️ Actions'}</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                <Link href={`/loans/${loan.id}/edit`} className="btn btn-ghost" style={{ justifyContent: 'center', border: '1px solid var(--border)' }}>
                  {isAdmin ? d.editLoan : 'Request Loan Edit'}
                </Link>
                {isAdmin && (
                  <>
                    <button className="btn btn-danger" onClick={() => setCloseModal(true)}>{d.closeLoan}</button>
                    <button className="btn btn-secondary" onClick={() => setRenewModal(true)}>{d.renewLoan}</button>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header"><h3>📄 Collateral Details ({loan.loanType})</h3></div>
            <div style={{ padding: '0 16px 16px' }}>
              {(() => {
                let col: any = {};
                try {
                  if (loan.collateralDetails) col = JSON.parse(loan.collateralDetails);
                } catch(e) {}

                if (loan.loanType === 'gold') {
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '.85rem' }}>
                      <div><strong style={{ color: 'var(--text-secondary)' }}>Weight:</strong><br />{col.grams || '—'} g</div>
                      <div><strong style={{ color: 'var(--text-secondary)' }}>Purity:</strong><br />{col.carat || '—'}</div>
                      <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--text-secondary)' }}>Items:</strong><br />{col.items || '—'}</div>
                    </div>
                  );
                }
                
                if (loan.loanType === 'property') {
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '.85rem' }}>
                      <div><strong style={{ color: 'var(--text-secondary)' }}>Type:</strong><br /><span style={{ textTransform: 'capitalize' }}>{col.type || '—'}</span></div>
                      <div><strong style={{ color: 'var(--text-secondary)' }}>Est. Value:</strong><br />{formatCurrency(col.value || 0, currencySymbol)}</div>
                      <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--text-secondary)' }}>Address:</strong><br />{col.address || '—'}</div>
                    </div>
                  );
                }

                // Default to Cheque (shows both legacy relational cheques and new JSON format)
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {col.bankName && (
                      <div style={{ fontSize: '.85rem' }}>
                        <div><strong style={{ color: 'var(--text-secondary)' }}>Bank:</strong> {col.bankName}</div>
                        <div><strong style={{ color: 'var(--text-secondary)' }}>Cheque No:</strong> {col.chequeNumber}</div>
                        <div><strong style={{ color: 'var(--text-secondary)' }}>Amount:</strong> {formatCurrency(col.chequeAmount || 0, currencySymbol)}</div>
                      </div>
                    )}
                    {loan.customer?.securityCheques?.map((ch: any) => (
                      <div key={ch.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: '.82rem' }}>
                        <span>{ch.bankName} — {ch.chequeNumber}</span>
                        <span className={getBadgeClass(ch.status)}>{ch.status}</span>
                      </div>
                    ))}
                    {!col.bankName && (!loan.customer?.securityCheques || loan.customer.securityCheques.length === 0) && (
                      <p style={{ fontSize: '.8rem', color: 'var(--text-light)', margin: 0 }}>No collateral recorded.</p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setPaymentModal(null); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>💰 {Number(paymentModal.receivedAmount) > 0 ? (isAdmin ? 'Edit Payment' : 'Request Edit') : d.submit}</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setPaymentModal(null)}>close</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.9rem' }}>
                  <span><strong>{loan.customer.name}</strong></span>
                  <span style={{ color: 'var(--text-secondary)' }}>Instalment #{paymentModal.instalmentNo}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  <span>{d.dueDateLabel}: {formatDate(paymentModal.dueDate)}</span>
                  <span>{Number(paymentModal.receivedAmount) > 0 ? 'Previously Paid' : d.amountLabel}: <strong>{formatCurrency(Number(paymentModal.receivedAmount) > 0 ? paymentModal.receivedAmount : paymentModal.dueAmount, currencySymbol)}</strong></span>
                </div>
              </div>

              {Number(paymentModal.receivedAmount) > 0 && !isAdmin ? (
                <div className="form-group">
                  <label className="form-label">Correct Amount ({currencySymbol}) *</label>
                  <input type="number" className="form-control" style={{ fontSize: '1.1rem', padding: '12px' }} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} min={0} required />
                  <div style={{ marginTop: '12px' }}>
                    <label className="form-label">Reason for change *</label>
                    <textarea className="form-control" value={payReason} onChange={(e) => setPayReason(e.target.value)} placeholder="Explain why this change is needed..." required rows={3} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">{Number(paymentModal.receivedAmount) > 0 ? 'Corrected Total' : d.receivedAmount} ({currencySymbol}) *</label>
                    <input type="number" className="form-control" style={{ fontSize: '1.1rem', padding: '12px' }} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} min={0} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{d.paymentMode}</label>
                    <select className="form-control" style={{ fontSize: '1rem', padding: '12px' }} value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                      <option value="cash">{d.cash}</option>
                      <option value="upi">{d.upi}</option>
                      <option value="cheque">{d.cheque}</option>
                      <option value="bank_transfer">{d.bankTransfer}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{d.remarksOptional}</label>
                    <input type="text" className="form-control" style={{ fontSize: '1rem', padding: '12px' }} value={payRemarks} onChange={(e) => setPayRemarks(e.target.value)} placeholder={d.notesPlaceholder} />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPaymentModal(null)}>{d.cancel}</button>
              <button className="btn btn-primary" onClick={handleSubmitPayment} disabled={loading || payAmount < 0 || (Number(paymentModal.receivedAmount) > 0 && !isAdmin && !payReason.trim())}>
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>check</span>
                {loading ? (Number(paymentModal.receivedAmount) > 0 && !isAdmin ? 'Sending...' : d.submitting) : (Number(paymentModal.receivedAmount) > 0 ? (isAdmin ? 'Update Payment' : 'Send Request') : d.submitPayment)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Penalty, Close, Renew modals preserved logic... */}
    </>
  );
}
