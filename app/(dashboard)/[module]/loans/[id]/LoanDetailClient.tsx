'use client';

import { useMemo, useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { formatCurrency, formatDate, getBadgeClass, calcPercentage } from '@/lib/utils';
import { markInstalmentPaid, requestCollectionEdit, waiveLoanPenalty, settleLoanPenalty, closeLoan, renewLoan, precloseLoanAdmin } from './actions';
import Link from '@/components/layout/DashboardLink';
import { useRouter } from 'next/navigation';
import { calculateCreditScore } from '@/lib/creditScore';
import { getCreditScoreGaugePresentation } from '@/lib/creditScoreGauge';
import { useDashboardPath } from '@/components/layout/useDashboardPath';

const CreditScoreGauge = ({ score, grade }: { score: number, grade: string }) => {
  const gauge = getCreditScoreGaugePresentation(score, grade);

  return (
    <div style={{ textAlign: 'center', width: '120px' }}>
      <div style={{ position: 'relative', height: '65px', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
        <svg viewBox="0 0 100 55" role="img" aria-label={gauge.ariaLabel} style={{ width: '110px' }}>
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#F1F5F9" strokeWidth="10" strokeLinecap="round" />
          <path d="M 10 50 A 40 40 0 0 1 30 15.3" fill="none" stroke="#EF4444" strokeWidth="10" />
          <path d="M 30 15.3 A 40 40 0 0 1 50 10" fill="none" stroke="#F59E0B" strokeWidth="10" />
          <path d="M 50 10 A 40 40 0 0 1 70 15.3" fill="none" stroke="#EAB308" strokeWidth="10" />
          <path d="M 70 15.3 A 40 40 0 0 1 90 50" fill="none" stroke="#16A34A" strokeWidth="10" />
          <g style={{ transform: `rotate(${gauge.rotation}deg)`, transformOrigin: '50px 50px', transition: 'all 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            <circle cx="50" cy="10" r="5" fill="#FFF" stroke={gauge.color} strokeWidth="2" />
          </g>
        </svg>
        <div style={{ position: 'absolute', bottom: '2px', fontSize: '1.6rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px' }}>{score}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.55rem', color: 'var(--text-light)', marginTop: '-8px', padding: '0 8px', fontWeight: 700, width: '110px', margin: '0 auto' }}>
        <span>300</span>
        <span>850</span>
      </div>
      <div style={{ fontSize: '.68rem', fontWeight: 800, color: gauge.color, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>{grade}</div>
    </div>
  );
};

export default function LoanDetailClient({
  loan,
  currencySymbol,
  dict,
  userRole,
  userId,
  receiptPdfEnabled = false,
}: {
  loan: any;
  currencySymbol: string;
  dict: any;
  userRole: string;
  userId?: string;
  receiptPdfEnabled?: boolean;
}) {
  const d = dict.loanDetail;
  const router = useRouter();
  const dashboardPath = useDashboardPath();
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
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today (don't mark missed until tomorrow)

    if (viewMode === 'actual') {
      return loan.instalments.map((inst: any) => {
        const dueDate = new Date(inst.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const isPaid = Number(inst.receivedAmount) >= Number(inst.dueAmount);
        const isPartial = Number(inst.receivedAmount) > 0 && Number(inst.receivedAmount) < Number(inst.dueAmount);
        
        let dynamicStatus = inst.status;
        if (inst.status !== 'paid' && inst.status !== 'partial') {
          if (isPaid) {
            dynamicStatus = 'paid';
          } else if (isPartial) {
            dynamicStatus = 'partial';
          } else if (dueDate < today) {
            dynamicStatus = 'missed';
          }
        }
        return { ...inst, status: dynamicStatus };
      });
    }
    
    const dist = JSON.parse(JSON.stringify(loan.instalments));
    let remaining = totalCollected;

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
    }
    return dist;
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
    const unpaidCount = displayInstalments.filter((inst: any) => inst.status !== 'paid').length;
    return unpaidCount || 1;
  }, [displayInstalments]);

  const adjustedInstallment = useMemo(() => {
    return Math.round((outstanding / (dynamicRemainingCount || 1)) * 100) / 100;
  }, [outstanding, dynamicRemainingCount]);

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
  const [precloseModal, setPrecloseModal] = useState(false);
  const [chequeReturned, setChequeReturned] = useState(false);
  const [loading, setLoading] = useState(false);

  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState('cash');
  const [payRemarks, setPayRemarks] = useState('');
  const [payReason, setPayReason] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    if (payMode === 'upi' && payAmount > 0) {
      // Create a standard UPI URI.
      const upiId = 'admin@upi'; // Default placeholder, can be made dynamic per branch later
      const upiUri = `upi://pay?pa=${upiId}&pn=Kandhu&am=${payAmount}&cu=INR`;
      QRCode.toDataURL(upiUri, { width: 180, margin: 1 }, (err, url) => {
        if (!err) setQrCodeUrl(url);
      });
    } else {
      setQrCodeUrl('');
    }
  }, [payMode, payAmount]);

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
        alert(d.editRequestSubmittedOk);
      } else {
        alert(result.error || d.failedToSubmitRequest);
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
      router.push(dashboardPath(`/loans/${(result as any).newLoanId}`));
    } else {
      alert((result as any).error || d.failedToRenewLoan);
    }
  };

  const handlePrecloseLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmount < outstanding) {
      alert(`${d.preclosureRequiresFull} ${formatCurrency(outstanding, currencySymbol)}`);
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.set('loanId', loan.id);
    fd.set('amount', String(payAmount));
    fd.set('paymentMode', payMode);
    fd.set('remarks', payRemarks);

    const result = await precloseLoanAdmin(fd);
    setLoading(false);
    if (result.success) {
      setPrecloseModal(false);
      router.refresh();
    } else {
      alert((result as any).error || d.failedToPrecloseLoan);
    }
  };

  const { score: creditScore, grade: creditGrade } = calculateCreditScore(loan.customer.loans || []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Calculate total scheduled/expected payments up to today
  const totalExpectedUpToToday = displayInstalments
    .filter((inst: any) => {
      const dueDate = new Date(inst.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    })
    .reduce((sum: number, inst: any) => sum + Number(inst.dueAmount), 0);

  // True dues pending is the scheduled expectation minus total collections (capped at 0)
  const duesPending = Math.max(0, totalExpectedUpToToday - totalCollected);

  const duesPendingBox = duesPending > 0 && (
    <div style={{ 
      background: 'rgba(239, 68, 68, 0.08)', 
      border: '1px solid rgba(239, 68, 68, 0.16)', 
      borderRadius: 'var(--radius-sm)', 
      padding: '16px', 
      marginBottom: '16px' 
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '.75rem', color: 'var(--danger)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{d.duesPendingOverdue}</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--danger)', marginTop: '2px', lineHeight: 1.1 }}>
            {formatCurrency(duesPending, currencySymbol)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{d.totalOutstandingLabel}</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', marginTop: '2px', lineHeight: 1.1 }}>
            {formatCurrency(outstanding, currencySymbol)}
          </div>
        </div>
      </div>
    </div>
  );

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

      <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/loans" className="btn btn-ghost btn-sm">
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          {d.backToLoans}
        </Link>
        {receiptPdfEnabled && (
          <a
            href={`/api/loans/${loan.id}/statement`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>download</span>
            Download Statement
          </a>
        )}
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
              >{d.actual}</button>
              <button
                type="button"
                onClick={() => setViewMode('distributed')}
                style={{ padding: '4px 10px', fontSize: '.7rem', fontWeight: 600, border: 'none', background: viewMode === 'distributed' ? '#fff' : 'transparent', color: viewMode === 'distributed' ? 'var(--primary)' : 'var(--text-secondary)', borderRadius: '4px', cursor: 'pointer', boxShadow: viewMode === 'distributed' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
              >{d.distributed}</button>
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
                <div className="cm-label">{d.paidPeriod}</div>
                <div className="cm-value" style={{ color: 'var(--success)' }}>
                  {dynamicPaidCount} {loan.frequency === 'daily' ? d.daysWord : loan.frequency === 'weekly' ? d.weeksWord : d.monthsWord}
                </div>
              </div>
              <div>
                <div className="cm-label">{d.remaining}</div>
                <div className="cm-value" style={{ color: 'var(--danger)' }}>
                  {dynamicRemainingCount} {loan.frequency === 'daily' ? d.daysWord : loan.frequency === 'weekly' ? d.weeksWord : d.monthsWord}
                </div>
              </div>

              {outstanding > 0 && (
                <div style={{ gridColumn: 'span 4', borderTop: '1px dashed var(--border)', paddingTop: '12px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>💡 {d.finishingRate}</span>
                    <p style={{ fontSize: '.68rem', color: 'var(--text-light)', margin: '2px 0 0' }}>
                      {d.toSettleOutstanding} {formatCurrency(outstanding, currencySymbol)} {d.onTimeAcrossRemaining} {dynamicRemainingCount} {d.scheduledWord} {loan.frequency === 'daily' ? d.daysWord.toLowerCase() : loan.frequency === 'weekly' ? d.weeksWord.toLowerCase() : d.monthsWord.toLowerCase()}:
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '.9rem', fontWeight: 800, color: 'var(--primary)' }}>
                      {formatCurrency(adjustedInstallment, currencySymbol)}
                    </span>
                    <span style={{ fontSize: '.68rem', color: 'var(--text-light)' }}> / {loan.frequency === 'daily' ? d.dayWord : loan.frequency === 'weekly' ? d.weekWord : d.monthWord}</span>
                  </div>
                </div>
              )}
            </div>
 
            <div className="heatmap-col">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '1px solid #F1F5F9', paddingBottom: '4px' }}>
                <span style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>📊 {d.calendarTracker}</span>
                <span style={{ fontSize: '.65rem', color: 'var(--text-light)' }}>{d.hoverInfoClickScroll}</span>
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
                          {d.instalmentHash} #{inst.instalmentNo}
                        </div>
                        <div>{d.dueLabel}: <strong>{formatDate(inst.dueDate)}</strong></div>
                        <div>{d.expectedLabel}: <strong>{formatCurrency(inst.dueAmount, currencySymbol)}</strong></div>
                        <div>{d.collectedTooltip}: <strong>{formatCurrency(inst.receivedAmount || 0, currencySymbol)}</strong></div>
                        <div style={{ textTransform: 'capitalize', marginTop: '2px', fontWeight: 700, color: inst.status === 'paid' ? '#4ADE80' : inst.status === 'partial' ? '#FBBF24' : '#F87171' }}>
                          {d.statusLabel}: {inst.status}
                        </div>
                        <div style={{ fontSize: '.58rem', color: '#94A3B8', marginTop: '4px', textAlign: 'center', fontStyle: 'italic' }}>
                          {d.clickScrollHighlight}
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
                <strong>{d.showRestructuredRate}</strong>
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
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {loan.status !== 'closed' && (
                            <button className="btn btn-primary btn-sm" onClick={() => openPaymentModal(inst)} style={{ padding: '8px 12px', minHeight: '36px' }}>
                              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
                                {isPaid ? (isAdmin ? 'edit' : 'history_edu') : 'payments'}
                              </span>{' '}
                              {isPaid ? (isAdmin ? d.edit : d.requestWord) : d.pay}
                            </button>
                          )}
                          {receiptPdfEnabled && inst.collectionEntry?.id && (
                            <a
                              href={`/api/receipts/${inst.collectionEntry.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                              title="Download Receipt"
                            >
                              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>receipt_long</span>
                              Receipt
                            </a>
                          )}
                        </div>
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
                <h3>{isAdmin ? `🔧 ${d.adminActions}` : `⚙️ ${d.actionsLabel}`}</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                <Link href={`/loans/${loan.loanCode}/edit`} className="btn btn-ghost" style={{ justifyContent: 'center', border: '1px solid var(--border)' }}>
                  {isAdmin ? d.editLoan : d.requestLoanEdit}
                </Link>
                {isAdmin && (
                  <>
                    <button className="btn btn-warning" style={{ background: '#F59E0B', color: '#fff', border: 'none' }} onClick={() => {
                      setPayAmount(outstanding);
                      setPayMode('cash');
                      setPayRemarks(d.preclosureFullRef);
                      setPrecloseModal(true);
                    }}>{d.precloseAndSettle}</button>
                    <button className="btn btn-danger" onClick={() => setCloseModal(true)}>{d.closeLoan}</button>
                    <button className="btn btn-secondary" onClick={() => setRenewModal(true)}>{d.renewLoan}</button>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header"><h3>📄 {d.collateralDetailsLabel} ({loan.loanType})</h3></div>
            <div style={{ padding: '0 16px 16px' }}>
              {(() => {
                let col: any = {};
                try {
                  if (loan.collateralDetails) col = JSON.parse(loan.collateralDetails);
                } catch(e) {}

                if (loan.loanType === 'gold') {
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '.85rem' }}>
                      <div><strong style={{ color: 'var(--text-secondary)' }}>{d.weight}:</strong><br />{col.grams || '—'} g</div>
                      <div><strong style={{ color: 'var(--text-secondary)' }}>{d.purity}:</strong><br />{col.carat || '—'}</div>
                      <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--text-secondary)' }}>{d.items}:</strong><br />{col.items || '—'}</div>
                    </div>
                  );
                }
                
                if (loan.loanType === 'property') {
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '.85rem' }}>
                      <div><strong style={{ color: 'var(--text-secondary)' }}>{d.typeLabel}:</strong><br /><span style={{ textTransform: 'capitalize' }}>{col.type || '—'}</span></div>
                      <div><strong style={{ color: 'var(--text-secondary)' }}>{d.estValue}:</strong><br />{formatCurrency(col.value || 0, currencySymbol)}</div>
                      <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--text-secondary)' }}>{d.addressLabel}:</strong><br />{col.address || '—'}</div>
                    </div>
                  );
                }

                // Default to Cheque (shows both legacy relational cheques and new JSON format)
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {col.bankName && (
                      <div style={{ fontSize: '.85rem' }}>
                        <div><strong style={{ color: 'var(--text-secondary)' }}>{d.bankLabel}:</strong> {col.bankName}</div>
                        <div><strong style={{ color: 'var(--text-secondary)' }}>{d.chequeNoLabel}:</strong> {col.chequeNumber}</div>
                        <div><strong style={{ color: 'var(--text-secondary)' }}>{d.amountLabel2}:</strong> {formatCurrency(col.chequeAmount || 0, currencySymbol)}</div>
                      </div>
                    )}
                    {loan.customer?.securityCheques?.map((ch: any) => (
                      <div key={ch.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: '.82rem' }}>
                        <span>{ch.bankName} — {ch.chequeNumber}</span>
                        <span className={getBadgeClass(ch.status)}>{ch.status}</span>
                      </div>
                    ))}
                    {!col.bankName && (!loan.customer?.securityCheques || loan.customer.securityCheques.length === 0) && (
                      <p style={{ fontSize: '.8rem', color: 'var(--text-light)', margin: 0 }}>{d.noCollateralRecorded}</p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {paymentModal && (() => {
        return (
          <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setPaymentModal(null); }}>
            <div className="modal">
              <div className="modal-header">
                <h3>💰 {Number(paymentModal.receivedAmount) > 0 ? (isAdmin ? d.editPayment : d.requestEditTitle) : d.submit}</h3>
                <button className="modal-close material-icons-outlined" onClick={() => setPaymentModal(null)}>close</button>
              </div>
              <div className="modal-body">
                {duesPendingBox}

                <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.9rem' }}>
                    <span><strong>{loan.customer.name}</strong></span>
                    <span style={{ color: 'var(--text-secondary)' }}>{d.instalmentHash} #{paymentModal.instalmentNo}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    <span>{d.dueDateLabel}: {formatDate(paymentModal.dueDate)}</span>
                    <span>{Number(paymentModal.receivedAmount) > 0 ? d.previouslyPaid : d.amountLabel}: <strong>{formatCurrency(Number(paymentModal.receivedAmount) > 0 ? paymentModal.receivedAmount : paymentModal.dueAmount, currencySymbol)}</strong></span>
                  </div>
                </div>

              {Number(paymentModal.receivedAmount) > 0 && !isAdmin ? (
                <div className="form-group">
                  <label className="form-label">{d.correctAmount} ({currencySymbol}) *</label>
                  <input type="number" className="form-control" style={{ fontSize: '1.1rem', padding: '12px' }} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} min={0} required />
                  <div style={{ marginTop: '12px' }}>
                    <label className="form-label">{d.reasonForChange} *</label>
                    <textarea className="form-control" value={payReason} onChange={(e) => setPayReason(e.target.value)} placeholder={d.explainChange} required rows={3} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">{Number(paymentModal.receivedAmount) > 0 ? d.correctedTotal : d.receivedAmount} ({currencySymbol}) *</label>
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
                  {payMode === 'upi' && qrCodeUrl && (
                    <div style={{ textAlign: 'center', margin: '16px 0', padding: '16px', background: '#fff', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                      <p style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', marginTop: 0 }}>{d.scanToPayUpi}</p>
                      <img src={qrCodeUrl} alt="UPI QR Code" style={{ display: 'block', margin: '0 auto', width: '150px', height: '150px' }} />
                    </div>
                  )}
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
                {loading ? (Number(paymentModal.receivedAmount) > 0 && !isAdmin ? d.sending : d.submitting) : (Number(paymentModal.receivedAmount) > 0 ? (isAdmin ? d.updatePayment : d.sendRequest) : d.submitPayment)}
              </button>
            </div>
          </div>
        </div>
      );
      })()}

      {/* Penalty Modal */}
      {penaltyModal && (
        <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setPenaltyModal(null); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>⚖️ {penAction === 'waive' ? d.waisePenalty : d.settlePenalty}</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setPenaltyModal(null)}>close</button>
            </div>
            <div className="modal-body">
              {duesPendingBox}

              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px' }}>
                <p style={{ fontSize: '.85rem' }}><strong>{loan.customer.name}</strong> — {loan.loanCode}</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)', marginTop: '6px' }}>
                  {d.grossPenalty}: {formatCurrency(penaltyModal.grossPenalty, currencySymbol)}
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">{penAction === 'waive' ? d.waive : d.settlement} {d.amountLabel2} ({currencySymbol})</label>
                <input type="number" className="form-control" value={penAmount} onChange={(e) => setPenAmount(Number(e.target.value))} min={0} />
              </div>
              <div className="form-group">
                <label className="form-label">{d.notes}</label>
                <input type="text" className="form-control" value={penNotes} onChange={(e) => setPenNotes(e.target.value)} placeholder={d.notesPlaceholder} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPenaltyModal(null)}>{d.cancel}</button>
              <button className="btn btn-primary" onClick={handleSubmitPenalty} disabled={loading}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>check</span>
                {loading ? dict.penalties.processing : dict.penalties.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preclose Loan Modal */}
      {precloseModal && (
        <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setPrecloseModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>⚡ {d.preclose}</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setPrecloseModal(false)}>close</button>
            </div>
            <div className="modal-body">
              {duesPendingBox}

              <div style={{ background: '#FFFBEB', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px', border: '1px solid #FCD34D' }}>
                <p style={{ fontSize: '.9rem', fontWeight: 600, color: '#92400E' }}>{d.preclosureFullSettlement}</p>
                <p style={{ fontSize: '.82rem', color: '#B45309', marginTop: '6px' }}>
                  {d.preclosureDescStart} <strong>{formatCurrency(outstanding, currencySymbol)}</strong>{d.preclosureDescEnd} <strong>{d.closedUpper}</strong>.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">{d.preclosureTotal} ({currencySymbol})</label>
                <input type="number" className="form-control" style={{ fontSize: '1.1rem', padding: '12px' }} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} min={0} disabled />
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
                <label className="form-label">{d.remarksReference}</label>
                <input type="text" className="form-control" style={{ fontSize: '1rem', padding: '12px' }} value={payRemarks} onChange={(e) => setPayRemarks(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPrecloseModal(false)}>{d.cancel}</button>
              <button className="btn btn-warning" style={{ background: '#F59E0B', color: '#fff', border: 'none' }} onClick={handlePrecloseLoan} disabled={loading || payAmount < outstanding}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>done_all</span>
                {loading ? dict.penalties.processing : d.settleAndClose}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Loan Modal */}
      {closeModal && (
        <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setCloseModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>🔒 {d.closeLoan}</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setCloseModal(false)}>close</button>
            </div>
            <div className="modal-body">
              {duesPendingBox}

              <div style={{ background: '#FEF2F2', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px' }}>
                <p style={{ fontSize: '.9rem', fontWeight: 600, color: '#991B1B' }}>{d.confirmCloseQuestion}</p>
                <p style={{ fontSize: '.82rem', color: '#B91C1C', marginTop: '6px' }}>
                  {d.willPermanentlyMark} <strong>{loan.loanCode}</strong> {d.asClosed}
                  {loan.paidCount < loan.totalInstalments && (
                    <span> {loan.totalInstalments - loan.paidCount} {d.instalmentUnpaid}</span>
                  )}
                </p>
              </div>

              {/* Security cheque return checklist */}
              {(() => {
                const activeChqs = (loan.customer?.securityCheques ?? []).filter((c: any) => c.status === 'active');
                if (activeChqs.length === 0) return null;
                return (
                  <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
                    <p style={{ fontSize: '.88rem', fontWeight: 600, color: '#92400E', marginBottom: '10px' }}>
                      ⚠️ {activeChqs.length} {d.securityChequeWord}{activeChqs.length > 1 ? 's' : ''} {d.chequesOnFileReturn}
                    </p>
                    <ul style={{ fontSize: '.82rem', color: '#78350F', marginBottom: '12px', paddingLeft: '18px' }}>
                      {activeChqs.map((c: any) => (
                        <li key={c.id}>{c.bankName} — #{c.chequeNumber}</li>
                      ))}
                    </ul>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '.85rem' }}>
                      <input
                        type="checkbox"
                        checked={chequeReturned}
                        onChange={(e) => setChequeReturned(e.target.checked)}
                      />
                      {d.confirmChequesReturned}
                    </label>
                  </div>
                );
              })()}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCloseModal(false)}>{d.cancel}</button>
              <button className="btn btn-danger" onClick={handleCloseLoan} disabled={loading}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>lock</span>
                {loading ? d.closing : d.closeLoan}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renew Loan Modal */}
      {renewModal && (
        <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setRenewModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>🔄 {d.renewLoan}</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setRenewModal(false)}>close</button>
            </div>
            <div className="modal-body">
              {duesPendingBox}

              <div style={{ background: '#EFF6FF', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '12px' }}>
                <p style={{ fontSize: '.9rem', fontWeight: 600, color: '#1E40AF' }}>{d.renewQuestion} <strong>{loan.loanCode}</strong>?</p>
                <p style={{ fontSize: '.82rem', color: '#1D4ED8', marginTop: '6px' }}>
                  {d.renewLoanDesc}
                  ({loan.frequency}, {loan.tenure} {d.instalmentsStarting}
                  {d.oldLoanPreserved}
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRenewModal(false)}>{d.cancel}</button>
              <button className="btn btn-primary" onClick={handleRenewLoan} disabled={loading}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>autorenew</span>
                {loading ? d.renewing : d.renewLoan}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
