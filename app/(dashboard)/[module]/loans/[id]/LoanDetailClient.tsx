'use client';

import { useMemo, useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { formatCurrency, formatDate, getBadgeClass, calcPercentage } from '@/lib/utils';
import { markInstalmentPaid, markLoanCollection, requestCollectionEdit, waiveLoanPenalty, settleLoanPenalty, closeLoan, renewLoan, precloseLoanAdmin, recordGoldServicing } from './actions';
import { createSelfPayLinkAction } from '../../collection/runActions';
import Link from '@/components/layout/DashboardLink';
import { useRouter } from 'next/navigation';
import { calculateCreditScore } from '@/lib/creditScore';
import { computeExtendedSchedule } from '@/lib/restructure';
import { getCreditScoreGaugePresentation } from '@/lib/creditScoreGauge';
import NachPanel from './NachPanel';
import LoanTimeline from './LoanTimeline';
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

// Gold pledge servicing panel — outstanding, interest due, redemption + actions.
function GoldServicingPanel({ data, loanId, currencySymbol }: { data: any; loanId: string; currencySymbol: string }) {
  const [interestAmt, setInterestAmt] = useState<number>(Math.round(Number(data?.interestDue) || Number(data?.monthlyInterest) || 0));
  const [partAmt, setPartAmt] = useState<number>(0);
  const [busy, setBusy] = useState<string | null>(null);
  const fmt = (n: number) => `${currencySymbol}${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
  const closed = data?.status === 'closed';

  const run = async (action: 'interest' | 'part' | 'redeem', amount: number) => {
    if (busy) return;
    if ((action === 'interest' || action === 'part') && (!amount || amount <= 0)) return;
    if (action === 'redeem' && !window.confirm(`Redeem this pledge for ${fmt(data?.redemptionAmount)}? This closes the loan and releases the ornaments.`)) return;
    setBusy(action);
    const res = await recordGoldServicing(loanId, action, amount);
    setBusy(null);
    if (res && 'error' in res && res.error) { alert(res.error); return; }
    window.location.reload();
  };

  return (
    <div className="card" style={{ borderTop: '3px solid var(--primary)', marginBottom: 16 }}>
      <div className="card-header"><h3>🏅 Gold Pledge Servicing</h3>{closed && <span className="badge" style={{ background: 'var(--success-bg,#dcfce7)', color: 'var(--success)' }}>Redeemed</span>}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '4px 0 14px' }}>
        <div><div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>Outstanding</div><b>{fmt(data?.outstandingPrincipal)}</b></div>
        <div><div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>Monthly interest</div><b>{fmt(data?.monthlyInterest)}</b></div>
        <div><div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>Interest due ({data?.monthsDue} mo)</div><b>{fmt(data?.interestDue)}</b></div>
        <div><div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>Redemption</div><b>{fmt(data?.redemptionAmount)}</b></div>
      </div>
      {!closed && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '0 1 160px' }}>
            <label className="form-label">Pay interest</label>
            <input type="number" className="form-control" value={interestAmt} onChange={e => setInterestAmt(Number(e.target.value))} />
          </div>
          <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => run('interest', interestAmt)}>{busy === 'interest' ? '…' : 'Pay Interest'}</button>
          <div className="form-group" style={{ flex: '0 1 160px' }}>
            <label className="form-label">Part payment</label>
            <input type="number" className="form-control" value={partAmt || ''} onChange={e => setPartAmt(Number(e.target.value))} placeholder="0" />
          </div>
          <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => run('part', partAmt)}>{busy === 'part' ? '…' : 'Part Pay'}</button>
          <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} disabled={!!busy} onClick={() => run('redeem', Number(data?.redemptionAmount) || 0)}>{busy === 'redeem' ? '…' : 'Redeem / Close'}</button>
        </div>
      )}
      {Array.isArray(data?.payments) && data.payments.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>History</div>
          {data.payments.slice(0, 6).map((p: any) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', padding: '3px 0', borderTop: '1px solid var(--border)' }}>
              <span>{p.paymentType} · {new Date(p.paymentDate).toLocaleDateString('en-IN')}</span>
              <span>{fmt(p.amount)} · {p.paymentMode}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LoanDetailClient({
  loan,
  currencySymbol,
  dict,
  userRole,
  userId,
  receiptPdfEnabled = false,
  upiId = '',
  payeeName = 'LoanTrack',
  goldServicing = null,
}: {
  loan: any;
  currencySymbol: string;
  dict: any;
  userRole: string;
  userId?: string;
  receiptPdfEnabled?: boolean;
  upiId?: string;
  payeeName?: string;
  goldServicing?: any;
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

    const toDateStr = (dateInput: Date | string) => {
      const d = new Date(dateInput);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const todayStr = toDateStr(today);

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
          } else if (toDateStr(dueDate) === todayStr) {
            dynamicStatus = 'due today';
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
          inst.status = dueDate < today ? 'missed' : (toDateStr(dueDate) === todayStr ? 'due today' : 'upcoming');
        }
      }
      return dist;
    }
    return dist;
  }, [loan.instalments, viewMode, totalCollected]);

  const dynamicRemainingCount = useMemo(() => {
    return Math.ceil(outstanding / Number(loan.perInstalment));
  }, [outstanding, loan.perInstalment]);

  // DEFAULT "extend days" projection: keep paying the normal per-instalment, slide
  // the finish out one period per unpaid due. Recomputed live from outstanding.
  const extended = useMemo(
    () => computeExtendedSchedule(loan.instalments || [], Number(loan.perInstalment), loan.frequency, new Date()),
    [loan.instalments, loan.perInstalment, loan.frequency],
  );
  // Projected rows BEYOND the original schedule's last date — appended (muted) to
  // the schedule in extend mode so the extra days are visible.
  const projectedExtraRows = useMemo(() => {
    if (extended.extraPeriods <= 0) return [] as { no: number; date: Date; amount: number }[];
    const per = Number(loan.perInstalment) || 0;
    const startNo = loan.totalInstalments + 1;
    const dates = extended.projectedDates.slice(-extended.extraPeriods);
    return dates.map((date, idx) => ({
      no: startNo + idx,
      date,
      amount: idx === dates.length - 1 ? extended.finalPartial : per,
    }));
  }, [extended, loan.perInstalment, loan.totalInstalments]);

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

  // Restructure: keep paying the normal per-period due, and spread ONLY the
  // backlog (dues pending up to today) across the remaining periods:
  //   rate = perInstalment + (overdueTillDate / remainingPeriods)
  //   • Paid on schedule → overdueTillDate 0 → rate = perInstalment (no change).
  //   • Fell behind      → rate slightly above normal, clears backlog on time.
  // Restructure: spread the entire outstanding amount across the actual remaining days/periods:
  //   rate = outstanding / actualRemainingCount
  const { restructureRemainingCount, adjustedInstallment } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = loan.endDate ? new Date(loan.endDate) : new Date();
    endDate.setHours(0, 0, 0, 0);
    const calendarDays = Math.ceil((endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    
    let actualCount = 0;
    if (calendarDays > 0) {
      if (loan.frequency === 'weekly') {
        actualCount = Math.max(1, Math.ceil(calendarDays / 7));
      } else if (loan.frequency === 'monthly') {
        actualCount = Math.max(1, Math.ceil(calendarDays / 30));
      } else {
        actualCount = Math.max(1, calendarDays);
      }
    }
    
    const divisor = actualCount || 1;
    const rate = Math.round((outstanding / divisor) * 100) / 100;
    
    return {
      restructureRemainingCount: actualCount,
      adjustedInstallment: rate,
    };
  }, [loan.endDate, loan.frequency, outstanding]);

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

  // Loan-wide collect popup (same UX as the collection page): two preset cards
  // (today's due / total due), editable amount, spread oldest-first server-side.
  const [collectOpen, setCollectOpen] = useState(false);
  const [collectAmount, setCollectAmount] = useState(0);
  const [collectCard, setCollectCard] = useState<'today' | 'total'>('today');
  const [collectMode, setCollectMode] = useState('cash');
  const [collectRemarks, setCollectRemarks] = useState('');

  const todayISO = new Date().toISOString().slice(0, 10);
  // Today's due across this loan = outstanding on the instalment dated today.
  const todayDueForLoan = useMemo(() => {
    return loan.instalments.reduce((sum: number, inst: any) => {
      const due = new Date(inst.dueDate).toISOString().slice(0, 10);
      if (due !== todayISO) return sum;
      return sum + Math.max(0, Number(inst.dueAmount) - Number(inst.receivedAmount || 0));
    }, 0);
  }, [loan.instalments, todayISO]);

  // "Total Due" = everything payable UP TO today (previous overdue + today's
  // due) — NOT the full loan outstanding, which includes instalments not yet
  // due. The amount field stays editable for an early full settlement.
  const dueTillTodayForLoan = useMemo(() => {
    return loan.instalments.reduce((sum: number, inst: any) => {
      const due = new Date(inst.dueDate).toISOString().slice(0, 10);
      if (due > todayISO) return sum; // future instalment — not due yet
      return sum + Math.max(0, Number(inst.dueAmount) - Number(inst.receivedAmount || 0));
    }, 0);
  }, [loan.instalments, todayISO]);

  const openCollectModal = () => {
    const defaultAmt = todayDueForLoan > 0 ? todayDueForLoan : dueTillTodayForLoan;
    setCollectCard(todayDueForLoan > 0 ? 'today' : 'total');
    setCollectAmount(defaultAmt);
    setCollectMode('cash');
    setCollectRemarks('');
    setCollectOpen(true);
  };

  const handleCollect = async () => {
    if (collectAmount <= 0) return;
    setLoading(true);
    const fd = new FormData();
    fd.set('loanId', loan.id);
    fd.set('amount', String(collectAmount));
    fd.set('paymentMode', collectMode);
    fd.set('remarks', collectRemarks);
    try {
      const result = await markLoanCollection(fd);
      setLoading(false);
      if (result.success) {
        setCollectOpen(false);
        router.refresh();
      } else {
        alert(result.error || d.failedToRecordPayment);
      }
    } catch (err: any) {
      setLoading(false);
      alert(err?.message || d.failedToRecordPayment);
    }
  };

  useEffect(() => {
    // Build a UPI intent QR against the TENANT's own VPA (no hardcoded payee).
    // If the tenant hasn't configured a UPI ID, show no QR rather than a QR
    // that pays the wrong account.
    if (payMode === 'upi' && payAmount > 0 && upiId) {
      const params = new URLSearchParams({ pa: upiId, pn: payeeName, am: String(payAmount), cu: 'INR' });
      params.set('tn', `Loan ${loan.loanCode}`);
      const upiUri = `upi://pay?${params.toString()}`;
      QRCode.toDataURL(upiUri, { width: 180, margin: 1 }, (err, url) => {
        if (!err) setQrCodeUrl(url);
      });
    } else {
      setQrCodeUrl('');
    }
  }, [payMode, payAmount, upiId, payeeName, loan.loanCode]);

  const [penAction, setPenAction] = useState<'waive' | 'settle'>('settle');
  const [penAmount, setPenAmount] = useState(0);
  const [penNotes, setPenNotes] = useState('');

  // mCollect-B: generate + share a borrower self-pay link for an instalment.
  const [payLinkBusyId, setPayLinkBusyId] = useState<string | null>(null);
  const [payLinkModal, setPayLinkModal] = useState<{ url: string; amount: number; instNo: number } | null>(null);
  const [payLinkCopied, setPayLinkCopied] = useState(false);

  const sendPayLink = async (inst: any) => {
    setPayLinkBusyId(inst.id);
    try {
      const res = await createSelfPayLinkAction(inst.id);
      if (res.success && res.link) {
        let url = res.link.payUrl as string;
        if (url.startsWith('/')) url = window.location.origin + url;
        setPayLinkCopied(false);
        setPayLinkModal({ url, amount: res.link.amount, instNo: inst.instalmentNo });
      } else {
        alert(res.error || 'Could not create payment link');
      }
    } finally {
      setPayLinkBusyId(null);
    }
  };

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
      router.push(dashboardPath(`/loans/${(result as any).newLoanId}`));
    } else {
      alert((result as any).error || d.failedToRenewLoan);
    }
  };

  const handlePrecloseLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmount < outstanding) {
      alert(`Preclose requires the full outstanding amount of ${formatCurrency(outstanding, currencySymbol)}`);
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
      alert((result as any).error || 'Failed to preclose loan');
    }
  };

  const { score: creditScore, grade: creditGrade } = calculateCreditScore(loan.customer.loans || []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Overdue = sum of the STILL-UNPAID amount on each instalment whose due date
  // has already passed (today's instalment is not overdue yet). This mirrors the
  // collection page exactly. The previous formula — (total expected up to today)
  // minus (ALL collections ever) — drifted toward the full outstanding balance
  // and overstated the overdue figure, so the loan page disagreed with the
  // collection page.
  const duesPending = (loan.instalments || [])
    .filter((inst: any) => {
      const dueDate = new Date(inst.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    })
    .reduce(
      (sum: number, inst: any) =>
        sum + Math.max(0, Number(inst.dueAmount) - Number(inst.receivedAmount || 0)),
      0,
    );

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
          <span style={{ fontSize: '.75rem', color: 'var(--danger)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dues Pending (Overdue)</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--danger)', marginTop: '2px', lineHeight: 1.1 }}>
            {formatCurrency(duesPending, currencySymbol)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Outstanding</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', marginTop: '2px', lineHeight: 1.1 }}>
            {formatCurrency(outstanding, currencySymbol)}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {goldServicing && <GoldServicingPanel data={goldServicing} loanId={loan.id} currencySymbol={currencySymbol} />}
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
              >Actual</button>
              <button 
                type="button"
                onClick={() => setViewMode('distributed')}
                style={{ padding: '4px 10px', fontSize: '.7rem', fontWeight: 600, border: 'none', background: viewMode === 'distributed' ? '#fff' : 'transparent', color: viewMode === 'distributed' ? 'var(--primary)' : 'var(--text-secondary)', borderRadius: '4px', cursor: 'pointer', boxShadow: viewMode === 'distributed' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
              >Distributed</button>
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
                <div className="cm-label">Remaining (Actual)</div>
                <div className="cm-value" style={{ color: 'var(--danger)' }}>
                  {restructureRemainingCount} {loan.frequency === 'daily' ? 'Days' : loan.frequency === 'weekly' ? 'Weeks' : 'Months'}
                </div>
              </div>
              <div>
                <div className="cm-label">Remaining (Extended)</div>
                <div className="cm-value" style={{ color: 'var(--danger)' }}>
                  {dynamicRemainingCount} {loan.frequency === 'daily' ? 'Days' : loan.frequency === 'weekly' ? 'Weeks' : 'Months'}
                </div>
              </div>

              {outstanding > 0 && (
                showRestructuredRates ? (
                  // RESTRUCTURE (toggle on): keep the original tenure, raise the rate
                  // so the backlog clears by the original end date. Unchanged.
                  <div style={{ gridColumn: 'span 4', borderTop: '1px dashed var(--border)', paddingTop: '12px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>💡 Finishing Rate Option</span>
                      <p style={{ fontSize: '.68rem', color: 'var(--text-light)', margin: '2px 0 0' }}>
                        {restructureRemainingCount > 0
                          ? `Outstanding balance spread across the remaining ${restructureRemainingCount} ${loan.frequency === 'daily' ? 'days' : loan.frequency === 'weekly' ? 'weeks' : 'months'} to finish on time:`
                          : 'Outstanding balance (overdue past end date):'}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '.9rem', fontWeight: 800, color: 'var(--primary)' }}>
                        {formatCurrency(adjustedInstallment, currencySymbol)}
                      </span>
                      <span style={{ fontSize: '.68rem', color: 'var(--text-light)' }}> / {loan.frequency === 'daily' ? 'Day' : loan.frequency === 'weekly' ? 'Week' : 'Month'}</span>
                    </div>
                  </div>
                ) : (
                  // DEFAULT — extend the term at the normal rate; finish slides out.
                  // Same flex layout as the restructure panel so the ₹/Day on the
                  // right keeps its position (no wrap / no shift).
                  <div style={{ gridColumn: 'span 4', borderTop: '1px dashed var(--border)', paddingTop: '12px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ minWidth: 0, paddingRight: '12px' }}>
                      <span style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>📅 Extended Plan (normal rate)</span>
                      <p style={{ fontSize: '.68rem', color: 'var(--text-light)', margin: '2px 0 0' }}>
                        {extended.remainingPayments} more {loan.frequency === 'daily' ? 'days' : loan.frequency === 'weekly' ? 'weeks' : loan.frequency === 'monthly' ? 'months' : 'periods'} at {formatCurrency(loan.perInstalment, currencySymbol)}
                        {extended.extraPeriods > 0 ? ` · +${extended.extraPeriods} beyond the original term` : ''}
                        {' · '}finishes <strong style={{ color: 'var(--text-secondary)' }}>{formatDate(extended.projectedEndDate)}</strong>
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontSize: '.9rem', fontWeight: 800, color: 'var(--primary)' }}>
                        {formatCurrency(loan.perInstalment, currencySymbol)}
                      </span>
                      <span style={{ fontSize: '.68rem', color: 'var(--text-light)' }}> / {loan.frequency === 'daily' ? 'Day' : loan.frequency === 'weekly' ? 'Week' : 'Month'}</span>
                    </div>
                  </div>
                )
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
                {/* Extended days (extend mode) — projected term beyond the original. */}
                {!showRestructuredRates && projectedExtraRows.map((r) => (
                  <div
                    key={`cal-proj-${r.no}`}
                    className="heatmap-cell"
                    style={{ width: '18px', height: '18px', borderRadius: '3px', backgroundColor: '#C7D2FE', border: '1px dashed #6366F1' }}
                  >
                    <div className="tooltip-content">
                      <div style={{ fontWeight: 800, marginBottom: '2px', borderBottom: '1px solid #475569', paddingBottom: '2px', fontSize: '.75rem' }}>
                        #{r.no} (Projected)
                      </div>
                      <div>Due: <strong>{formatDate(r.date)}</strong></div>
                      <div>Amount: <strong>{formatCurrency(r.amount, currencySymbol)}</strong></div>
                      <div style={{ marginTop: '2px', fontWeight: 700, color: '#A5B4FC' }}>Extended day</div>
                    </div>
                  </div>
                ))}
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
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h3>📅 {d.paymentSchedule}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {outstanding > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.72rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }} title="Default: extend the term at the normal rate. Check to keep the original tenure and raise the rate instead.">
                  <input
                    type="checkbox"
                    checked={showRestructuredRates}
                    onChange={(e) => setShowRestructuredRates(e.target.checked)}
                    style={{ width: '13px', height: '13px', cursor: 'pointer' }}
                  />
                  <strong>Show Restructured Rate</strong>
                  <span style={{ fontSize: '.64rem', color: 'var(--text-light)' }}>({showRestructuredRates ? 'keep tenure, higher rate' : 'default: extend term'})</span>
                </label>
              )}
              {loan.status !== 'closed' && outstanding > 0 && (
                <button className="btn btn-primary btn-sm" onClick={openCollectModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>payments</span>
                  {d.recordPayment || 'Record Payment'}
                </button>
              )}
            </div>
          </div>
          <div className="table-wrapper schedule-table-wrap" style={{ maxHeight: '500px', overflowY: 'auto' }}>
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
                  // Overdue = past-due and not fully paid. These rows are shown
                  // dull red and read-only (no per-row Pay) — collection happens
                  // via the single "Record Payment" popup, which clears the
                  // backlog oldest-first. Admin keeps an Edit to correct a date.
                  const isOverdue = inst.status === 'missed';
                  return (
                    <tr
                      key={inst.id}
                      id={`inst-row-${inst.instalmentNo}`}
                      className={isHighlighted ? 'highlight-row' : ''}
                      style={{
                        opacity: inst.status === 'paid' && !isHighlighted ? 0.6 : 1,
                        background: isOverdue && !isHighlighted ? 'rgba(239,68,68,0.06)' : undefined,
                        color: isOverdue ? '#b91c1c' : undefined,
                      }}
                    >
                      <td>{inst.instalmentNo}</td>
                      <td>{formatDate(inst.dueDate)}</td>
                      <td style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>{collectedTime || '—'}</td>
                      <td>
                        {showRestructuredRates && Number(inst.receivedAmount) < Number(inst.dueAmount) && new Date(inst.dueDate) >= new Date(new Date().setHours(0,0,0,0)) ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ color: 'var(--primary)', fontWeight: 800 }}>
                              {formatCurrency(adjustedInstallment, currencySymbol)}
                            </span>
                            {/* Only strike through the original when restructuring actually
                                changed the figure (i.e. there were missed dues to catch up). */}
                            {Math.abs(adjustedInstallment - Number(inst.dueAmount)) >= 0.01 && (
                              <span style={{ fontSize: '.58rem', color: 'var(--text-light)', textDecoration: 'line-through' }}>
                                {formatCurrency(inst.dueAmount, currencySymbol)}
                              </span>
                            )}
                          </div>
                        ) : (
                          formatCurrency(inst.dueAmount, currencySymbol)
                        )}
                      </td>
                      <td>{isPaid ? formatCurrency(inst.receivedAmount, currencySymbol) : '—'}</td>
                      <td><span className={getBadgeClass(inst.status)} style={{textTransform:'capitalize'}}>{inst.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {loan.status !== 'closed' && isPaid && (
                            // Paid → edit/correct this specific instalment.
                            <button className="btn btn-ghost btn-sm" onClick={() => openPaymentModal(inst)} style={{ padding: '6px 10px' }}>
                              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
                                {isAdmin ? 'edit' : 'history_edu'}
                              </span>{' '}
                              {isAdmin ? d.edit : 'Request'}
                            </button>
                          )}
                          {loan.status !== 'closed' && !isPaid && isOverdue && isAdmin && (
                            // Overdue → dull red row, no Pay. Admin-only Edit to
                            // manually correct this date if ever needed.
                            <button className="btn btn-ghost btn-sm" onClick={() => openPaymentModal(inst)} style={{ padding: '6px 10px', color: '#b91c1c' }}>
                              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>edit</span>{' '}
                              {d.edit}
                            </button>
                          )}
                          {loan.status !== 'closed' && !isPaid && !isOverdue && (
                            // Today / upcoming → collect via the loan-wide popup.
                            <>
                              <button className="btn btn-primary btn-sm" onClick={openCollectModal} style={{ padding: '8px 12px', minHeight: '36px' }}>
                                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>payments</span>{' '}
                                {d.pay}
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => sendPayLink(inst)}
                                disabled={payLinkBusyId === inst.id}
                                title="Generate a UPI self-pay link for the borrower"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>qr_code_2</span>
                                {payLinkBusyId === inst.id ? '…' : 'Pay link'}
                              </button>
                            </>
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
                {/* Projected extra days (extend mode only) — the term sliding out
                    past the original schedule. Display-only, non-actionable. */}
                {!showRestructuredRates && projectedExtraRows.map((r) => (
                  <tr key={`proj-${r.no}`} style={{ background: 'rgba(99,102,241,0.05)', color: 'var(--text-light)' }}>
                    <td>{r.no}</td>
                    <td>{formatDate(r.date)}</td>
                    <td>—</td>
                    <td>{formatCurrency(r.amount, currencySymbol)}</td>
                    <td>—</td>
                    <td><span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366F1' }}>Projected</span></td>
                    <td>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Compact mobile schedule — one tight row per instalment instead of
              the table reflowing into a giant card per row. */}
          <div className="schedule-mobile">
            {displayInstalments.map((inst: any) => {
              const isPaid = Number(inst.receivedAmount) > 0;
              const isOverdue = inst.status === 'missed';
              const collectedTime = inst.receivedAt ? new Date(inst.receivedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : null;
              const accent = inst.status === 'paid' ? 'var(--success)' : isOverdue ? 'var(--danger)' : 'var(--primary)';
              return (
                <div
                  key={inst.id}
                  id={`inst-row-m-${inst.instalmentNo}`}
                  className="sched-row"
                  style={{ borderLeft: `3px solid ${accent}`, opacity: inst.status === 'paid' ? 0.75 : 1 }}
                >
                  <div className="sched-main">
                    <span className="sched-no">#{inst.instalmentNo}</span>
                    <span className="sched-date">{formatDate(inst.dueDate)}</span>
                    {showRestructuredRates && Number(inst.receivedAmount) < Number(inst.dueAmount) && new Date(inst.dueDate) >= new Date(new Date().setHours(0, 0, 0, 0)) ? (
                      <span className="sched-amt" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
                        <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{formatCurrency(adjustedInstallment, currencySymbol)}</span>
                        {Math.abs(adjustedInstallment - Number(inst.dueAmount)) >= 0.01 && (
                          <span style={{ fontSize: '.62rem', color: 'var(--text-light)', textDecoration: 'line-through' }}>{formatCurrency(inst.dueAmount, currencySymbol)}</span>
                        )}
                      </span>
                    ) : (
                      <span className="sched-amt">{formatCurrency(inst.dueAmount, currencySymbol)}</span>
                    )}
                    <span className={getBadgeClass(inst.status)} style={{ textTransform: 'capitalize', marginLeft: 'auto' }}>{inst.status}</span>
                  </div>
                  <div className="sched-sub">
                    <span style={{ color: 'var(--text-light)' }}>
                      {isPaid ? `${d.received}: ${formatCurrency(inst.receivedAmount, currencySymbol)}${collectedTime ? ` · ${collectedTime}` : ''}` : ''}
                    </span>
                    {loan.status !== 'closed' && (
                      isPaid ? (
                        <button className="btn btn-ghost btn-sm" onClick={() => openPaymentModal(inst)} style={{ minHeight: 36 }}>
                          <span className="material-icons-outlined" style={{ fontSize: 14 }}>{isAdmin ? 'edit' : 'history_edu'}</span> {isAdmin ? d.edit : 'Request'}
                        </button>
                      ) : isOverdue ? (
                        isAdmin ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => openPaymentModal(inst)} style={{ minHeight: 36, color: '#b91c1c' }}>
                            <span className="material-icons-outlined" style={{ fontSize: 14 }}>edit</span> {d.edit}
                          </button>
                        ) : null
                      ) : (
                        <button className="btn btn-primary btn-sm" onClick={openCollectModal} style={{ minHeight: 36 }}>
                          <span className="material-icons-outlined" style={{ fontSize: 14 }}>payments</span> {d.pay}
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
            {!showRestructuredRates && projectedExtraRows.map((r) => (
              <div key={`proj-m-${r.no}`} className="sched-row" style={{ borderLeft: '3px solid #6366F1', background: 'rgba(99,102,241,0.05)' }}>
                <div className="sched-main">
                  <span className="sched-no">#{r.no}</span>
                  <span className="sched-date">{formatDate(r.date)}</span>
                  <span className="sched-amt">{formatCurrency(r.amount, currencySymbol)}</span>
                  <span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366F1', marginLeft: 'auto' }}>Projected</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          {/* Overdue Summary Card */}
          <div className="card" style={{ marginBottom: '16px', padding: '14px' }}>
            <div className="card-header" style={{ marginBottom: '12px' }}>
              <h3 style={{ fontSize: '.9rem', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--danger)' }}>report_problem</span>
                Overdues
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: 'var(--bg)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '.72rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '.3px' }}>{d.missedDays}</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger)', marginTop: '2px' }}>
                  {missedCount}
                </div>
              </div>
              <div style={{ background: 'var(--bg)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '.72rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '.3px' }}>Overdue Amount</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger)', marginTop: '2px' }}>
                  {formatCurrency(duesPending, currencySymbol)}
                </div>
              </div>
            </div>
          </div>

          {/* Penalty Summary Card */}
          <div className="card" style={{ marginBottom: '20px', padding: '14px' }}>
            <div className="card-header" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '.9rem', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>gavel</span>
                {d.penaltySummary}
              </h3>
              <Link href={`/penalties?q=${encodeURIComponent(loan.loanCode)}`} className="btn btn-ghost btn-xs" style={{ padding: '2px 6px', fontSize: '.7rem', height: 'auto', minHeight: 'auto' }}>
                <span className="material-icons-outlined" style={{ fontSize: '12px', marginRight: '3px' }}>open_in_new</span>
                View
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '4px' }}>
              <div style={{ background: 'var(--bg)', padding: '8px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <span style={{ fontSize: '.65rem', color: 'var(--text-light)', textTransform: 'uppercase' }}>Total</span>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--danger)', marginTop: '2px' }}>
                  {formatCurrency(totalPenalty, currencySymbol)}
                </div>
              </div>
              <div style={{ background: 'var(--bg)', padding: '8px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <span style={{ fontSize: '.65rem', color: 'var(--text-light)', textTransform: 'uppercase' }}>{d.settledWaived}</span>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--success)', marginTop: '2px' }}>
                  {formatCurrency(settledPenalty + waivedPenalty, currencySymbol)}
                </div>
              </div>
              <div style={{ background: 'var(--bg)', padding: '8px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <span style={{ fontSize: '.65rem', color: 'var(--text-light)', textTransform: 'uppercase' }}>{d.netDue}</span>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary-dark)', marginTop: '2px' }}>
                  {formatCurrency(netPenalty, currencySymbol)}
                </div>
              </div>
            </div>
            {netPenalty > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', gap: '6px' }}>
                <button className="btn btn-ghost btn-xs" style={{ flex: 1, border: '1px solid var(--border)', padding: '6px 8px', fontSize: '.75rem', minHeight: 'auto' }} onClick={() => openPenaltyModal({ id: 'new', grossPenalty: netPenalty }, 'waive')}>{d.waisePenalty}</button>
                <button className="btn btn-ghost btn-xs" style={{ flex: 1, border: '1px solid var(--border)', padding: '6px 8px', fontSize: '.75rem', minHeight: 'auto' }} onClick={() => openPenaltyModal({ id: 'new', grossPenalty: netPenalty }, 'settle')}>{d.settlePenalty}</button>
              </div>
            )}
          </div>

          {loan.status !== 'closed' && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header">
                <h3>{isAdmin ? `🔧 ${d.adminActions}` : '⚙️ Actions'}</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                <Link href={`/loans/${loan.loanCode}/edit`} className="btn btn-ghost" style={{ justifyContent: 'center', border: '1px solid var(--border)' }}>
                  {isAdmin ? d.editLoan : 'Request Loan Edit'}
                </Link>
                {isAdmin && (
                  <>
                    <button className="btn btn-warning" style={{ background: '#F59E0B', color: '#fff', border: 'none' }} onClick={() => {
                      setPayAmount(outstanding);
                      setPayMode('cash');
                      setPayRemarks('Preclosure Full Settlement');
                      setPrecloseModal(true);
                    }}>Preclose & Settle</button>
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
                } catch(e) { console.error('collateralDetails parse error', e); }

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

          {['active', 'overdue'].includes(loan.status) && (
            <NachPanel
              loanId={loan.id}
              customerId={loan.customerId ?? loan.customer?.id}
              customerName={loan.customer?.name}
              customerPhone={loan.customer?.phone}
              customerEmail={loan.customer?.email ?? undefined}
              defaultMaxAmount={Number(loan.perInstalment) || undefined}
              currencySymbol={currencySymbol}
              isAdmin={isAdmin}
            />
          )}

          <LoanTimeline loanId={loan.id} currencySymbol={currencySymbol} />
        </div>
      </div>

      {/* Loan-wide collect popup — same UX as the collection page. Pick a preset
          (today's due / total due), edit if needed; the server spreads it across
          open instalments oldest-first and records it today. */}
      {collectOpen && (
        <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setCollectOpen(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>💰 {d.recordPayment || 'Record Payment'}</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setCollectOpen(false)}>close</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.9rem' }}>
                  <span><strong>{loan.customer.name}</strong></span>
                  <span style={{ color: 'var(--text-secondary)' }}>{loan.loanCode}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => { setCollectCard('today'); setCollectAmount(todayDueForLoan); }}
                  style={{
                    flex: 1, textAlign: 'left', cursor: 'pointer',
                    background: collectCard === 'today' ? 'rgba(245,158,11,0.08)' : 'var(--bg)',
                    border: `2px solid ${collectCard === 'today' ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                  }}
                >
                  <div style={{ fontSize: '.72rem', fontWeight: 600, color: collectCard === 'today' ? 'var(--primary)' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Today&apos;s Due</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '4px' }}>{formatCurrency(todayDueForLoan, currencySymbol)}</div>
                </button>
                <button
                  type="button"
                  onClick={() => { setCollectCard('total'); setCollectAmount(dueTillTodayForLoan); }}
                  style={{
                    flex: 1, textAlign: 'left', cursor: 'pointer',
                    background: collectCard === 'total' ? 'rgba(239,68,68,0.08)' : 'var(--bg)',
                    border: `2px solid ${collectCard === 'total' ? 'var(--danger)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                  }}
                >
                  <div style={{ fontSize: '.72rem', fontWeight: 600, color: collectCard === 'total' ? 'var(--danger)' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total Due</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '4px' }}>{formatCurrency(dueTillTodayForLoan, currencySymbol)}</div>
                  {dueTillTodayForLoan > todayDueForLoan && (
                    <div style={{ fontSize: '.66rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Includes previous overdue</div>
                  )}
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">{d.receivedAmount} ({currencySymbol}) *</label>
                <input type="number" className="form-control" style={{ fontSize: '1.1rem', padding: '12px' }} value={collectAmount} onChange={(e) => setCollectAmount(Number(e.target.value))} min={0} required />
              </div>
              <div className="form-group">
                <label className="form-label">{d.paymentMode}</label>
                <select className="form-control" style={{ fontSize: '1rem', padding: '12px' }} value={collectMode} onChange={(e) => setCollectMode(e.target.value)}>
                  <option value="cash">{d.cash}</option>
                  <option value="upi">{d.upi}</option>
                  <option value="cheque">{d.cheque}</option>
                  <option value="bank_transfer">{d.bankTransfer}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{d.remarksOptional}</label>
                <input type="text" className="form-control" style={{ fontSize: '1rem', padding: '12px' }} value={collectRemarks} onChange={(e) => setCollectRemarks(e.target.value)} placeholder={d.notesPlaceholder} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCollectOpen(false)}>{d.cancel}</button>
              <button className="btn btn-primary" onClick={handleCollect} disabled={loading || collectAmount <= 0}>
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>check</span>
                {loading ? d.submitting : d.submitPayment}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentModal && (() => {
        return (
          <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setPaymentModal(null); }}>
            <div className="modal">
              <div className="modal-header">
                <h3>💰 {Number(paymentModal.receivedAmount) > 0 ? (isAdmin ? 'Edit Payment' : 'Request Edit') : d.submit}</h3>
                <button className="modal-close material-icons-outlined" onClick={() => setPaymentModal(null)}>close</button>
              </div>
              <div className="modal-body">
                {duesPendingBox}

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
                  {payMode === 'upi' && qrCodeUrl && (
                    <div style={{ textAlign: 'center', margin: '16px 0', padding: '16px', background: '#fff', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                      <p style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', marginTop: 0 }}>Scan to Pay via UPI{upiId ? ` · ${upiId}` : ''}</p>
                      <img src={qrCodeUrl} alt="UPI QR Code" style={{ display: 'block', margin: '0 auto', width: '150px', height: '150px' }} />
                    </div>
                  )}
                  {payMode === 'upi' && !upiId && (
                    <p style={{ fontSize: '.78rem', color: 'var(--danger, #dc2626)', margin: '12px 0', textAlign: 'center' }}>
                      No UPI ID configured. Set it in Payments Gateway settings to show a pay QR.
                    </p>
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
                {loading ? (Number(paymentModal.receivedAmount) > 0 && !isAdmin ? 'Sending...' : d.submitting) : (Number(paymentModal.receivedAmount) > 0 ? (isAdmin ? 'Update Payment' : 'Send Request') : d.submitPayment)}
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
              <h3>⚖️ {penAction === 'waive' ? 'Waive' : 'Settle'} Penalty</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setPenaltyModal(null)}>close</button>
            </div>
            <div className="modal-body">
              {duesPendingBox}

              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px' }}>
                <p style={{ fontSize: '.85rem' }}><strong>{loan.customer.name}</strong> — {loan.loanCode}</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)', marginTop: '6px' }}>
                  Gross Penalty: {formatCurrency(penaltyModal.grossPenalty, currencySymbol)}
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">{penAction === 'waive' ? 'Waive' : 'Settlement'} Amount ({currencySymbol})</label>
                <input type="number" className="form-control" value={penAmount} onChange={(e) => setPenAmount(Number(e.target.value))} min={0} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input type="text" className="form-control" value={penNotes} onChange={(e) => setPenNotes(e.target.value)} placeholder="Add notes..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPenaltyModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmitPenalty} disabled={loading}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>check</span>
                {loading ? 'Processing...' : 'Confirm'}
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
              <h3>⚡ Preclose Loan</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setPrecloseModal(false)}>close</button>
            </div>
            <div className="modal-body">
              {duesPendingBox}

              <div style={{ background: '#FFFBEB', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px', border: '1px solid #FCD34D' }}>
                <p style={{ fontSize: '.9rem', fontWeight: 600, color: '#92400E' }}>Preclose & Full Settlement</p>
                <p style={{ fontSize: '.82rem', color: '#B45309', marginTop: '6px' }}>
                  This action will collect the full outstanding amount of <strong>{formatCurrency(outstanding, currencySymbol)}</strong>. All unpaid instalments will be marked as paid and the loan will be <strong>CLOSED</strong>.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Preclosure Total ({currencySymbol})</label>
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
                <label className="form-label">Remarks / Reference</label>
                <input type="text" className="form-control" style={{ fontSize: '1rem', padding: '12px' }} value={payRemarks} onChange={(e) => setPayRemarks(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPrecloseModal(false)}>Cancel</button>
              <button className="btn btn-warning" style={{ background: '#F59E0B', color: '#fff', border: 'none' }} onClick={handlePrecloseLoan} disabled={loading || payAmount < outstanding}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>done_all</span>
                {loading ? 'Processing...' : 'Settle & Close'}
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
              <h3>🔒 Close Loan</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setCloseModal(false)}>close</button>
            </div>
            <div className="modal-body">
              {duesPendingBox}

              <div style={{ background: '#FEF2F2', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px' }}>
                <p style={{ fontSize: '.9rem', fontWeight: 600, color: '#991B1B' }}>Are you sure you want to close this loan?</p>
                <p style={{ fontSize: '.82rem', color: '#B91C1C', marginTop: '6px' }}>
                  This will permanently mark <strong>{loan.loanCode}</strong> as closed. 
                  {loan.paidCount < loan.totalInstalments && (
                    <span> {loan.totalInstalments - loan.paidCount} instalments are still unpaid.</span>
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
                      ⚠️ {activeChqs.length} security cheque{activeChqs.length > 1 ? 's' : ''} on file — please return to borrower
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
                      I confirm all security cheques have been returned to the borrower
                    </label>
                  </div>
                );
              })()}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCloseModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleCloseLoan} disabled={loading}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>lock</span>
                {loading ? 'Closing...' : 'Close Loan'}
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
              <h3>🔄 Renew Loan</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setRenewModal(false)}>close</button>
            </div>
            <div className="modal-body">
              {duesPendingBox}

              <div style={{ background: '#EFF6FF', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '12px' }}>
                <p style={{ fontSize: '.9rem', fontWeight: 600, color: '#1E40AF' }}>Renew <strong>{loan.loanCode}</strong>?</p>
                <p style={{ fontSize: '.82rem', color: '#1D4ED8', marginTop: '6px' }}>
                  This will close the current loan and create a fresh loan with the same principal 
                  ({loan.frequency}, {loan.tenure} instalments) starting today.
                  The old loan code will be preserved for reference.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRenewModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRenewLoan} disabled={loading}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>autorenew</span>
                {loading ? 'Renewing...' : 'Renew Loan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {payLinkModal && (
        <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setPayLinkModal(null); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>📲 Self-Pay Link</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setPayLinkModal(null)}>close</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '.9rem', marginBottom: '10px' }}>
                Instalment #{payLinkModal.instNo} · <strong>{formatCurrency(payLinkModal.amount, currencySymbol)}</strong>
              </p>
              <input
                readOnly
                value={payLinkModal.url}
                onFocus={(e) => e.currentTarget.select()}
                style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '.82rem', marginBottom: '10px' }}
              />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { navigator.clipboard.writeText(payLinkModal.url); setPayLinkCopied(true); }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                  {payLinkCopied ? 'Copied' : 'Copy'}
                </button>
                {loan.customer?.phone && (
                  <a
                    className="btn btn-primary btn-sm"
                    href={`https://wa.me/${String(loan.customer.phone).replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(`Pay ${formatCurrency(payLinkModal.amount, currencySymbol)} for loan ${loan.loanCode}: ${payLinkModal.url}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>chat</span>
                    WhatsApp
                  </a>
                )}
                <a className="btn btn-ghost btn-sm" href={payLinkModal.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  Open
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
