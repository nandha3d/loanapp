'use client';

import { useState } from 'react';
import { formatCurrency, formatDate, getBadgeClass, calcPercentage } from '@/lib/utils';
import { markInstalmentPaid, waiveLoanPenalty, settleLoanPenalty, closeLoan, renewLoan } from './actions';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { calculateCreditScore } from '@/lib/creditScore';

const CreditScoreGauge = ({ score, grade }: { score: number, grade: string }) => {
  const min = 300;
  const max = 850;
  const pct = Math.max(0, Math.min(100, ((score - min) / (max - min)) * 100));
  // Map pct to degrees: 0% -> -90deg, 100% -> 90deg
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
          {/* Background Track */}
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#F1F5F9" strokeWidth="10" strokeLinecap="round" />
          
          {/* Colored Segments */}
          <path d="M 10 50 A 40 40 0 0 1 30 15.3" fill="none" stroke="#EF4444" strokeWidth="10" />
          <path d="M 30 15.3 A 40 40 0 0 1 50 10" fill="none" stroke="#F59E0B" strokeWidth="10" />
          <path d="M 50 10 A 40 40 0 0 1 70 15.3" fill="none" stroke="#EAB308" strokeWidth="10" />
          <path d="M 70 15.3 A 40 40 0 0 1 90 50" fill="none" stroke="#16A34A" strokeWidth="10" />
          
          {/* Indicator Dot */}
          <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '50px 50px', transition: 'all 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            <circle cx="50" cy="10" r="5" fill="#FFF" stroke={getScoreColor(score)} strokeWidth="2" />
          </g>
        </svg>
        <div style={{ position: 'absolute', bottom: '2px', fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{score}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.55rem', color: 'var(--text-light)', marginTop: '-2px', padding: '0 12px', fontWeight: 600 }}>
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
}: {
  loan: any;
  currencySymbol: string;
  dict: any;
}) {
  const d = dict.loanDetail;
  const router = useRouter();
  const pct = calcPercentage(loan.paidCount, loan.totalInstalments);
  
  // Calculate penalty summary dynamically
  const missedInstalments = loan.instalments.filter((i: any) => i.status === 'missed');
  const missedCount = missedInstalments.length;
  
  // Total Penalty is dynamically calculated from missed days, or from recorded penalties if higher
  const recordedPenalty = loan.penalties.reduce((sum: number, p: any) => sum + Number(p.grossPenalty), 0);
  const potentialPenalty = missedCount * Number(loan.penaltyRate);
  const totalPenalty = Math.max(recordedPenalty, potentialPenalty);

  const settledPenalty = loan.penalties.reduce((sum: number, p: any) => sum + Number(p.settledAmount), 0);
  const waivedPenalty = loan.penalties.reduce((sum: number, p: any) => sum + Number(p.waivedAmount), 0);
  const netPenalty = totalPenalty - settledPenalty - waivedPenalty;

  // Modal states
  const [paymentModal, setPaymentModal] = useState<any>(null);
  const [penaltyModal, setPenaltyModal] = useState<any>(null);
  const [closeModal, setCloseModal] = useState(false);
  const [renewModal, setRenewModal] = useState(false);
  const [chequeReturned, setChequeReturned] = useState(false);
  const [loading, setLoading] = useState(false);

  // Payment form state
  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState('cash');
  const [payRemarks, setPayRemarks] = useState('');

  // Penalty form state
  const [penAction, setPenAction] = useState<'waive' | 'settle'>('settle');
  const [penAmount, setPenAmount] = useState(0);
  const [penNotes, setPenNotes] = useState('');

  const openPaymentModal = (inst: any) => {
    setPayAmount(Number(inst.receivedAmount) > 0 ? Number(inst.receivedAmount) : Number(inst.dueAmount));
    setPayMode(inst.paymentMode || 'cash');
    setPayRemarks(inst.remarks || '');
    setPaymentModal(inst);
  };

  const handleSubmitPayment = async () => {
    if (!paymentModal || payAmount <= 0) return;
    setLoading(true);
    const fd = new FormData();
    fd.set('instalmentId', paymentModal.id);
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
    if (result.success && result.newLoanId) {
      setRenewModal(false);
      router.push(`/loans/${result.newLoanId}`);
    } else {
      alert((result as any).error || d.failedToRenewLoan);
    }
  };

  const totalCollected = Number(loan.totalCollected || 0);
  const totalRepayable = Number(loan.perInstalment) * loan.totalInstalments;
  const outstanding = totalRepayable - totalCollected;

  // Use shared credit score logic
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
        .heatmap-grid-container { display: flex; gap: 4px; flex-wrap: wrap; }
        .month-block { display: flex; flex-direction: column; gap: 4px; }
        .month-name { fontSize: .65rem; fontWeight: 800; color: var(--primary); text-transform: uppercase; marginBottom: 2px; }
        .day-labels { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; marginBottom: 4px; }
        .day-label { fontSize: .45rem; color: var(--text-light); textAlign: center; fontWeight: 800; opacity: 0.6; text-transform: uppercase; }
        .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
        
        @media (max-width: 1400px) {
          .meta-col { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 1200px) {
          .loan-main-row { flex-wrap: wrap; }
          .heatmap-col { border: none; flex: 1 1 100%; order: 3; margin-top: 16px; padding: 16px 0; border-top: 1px solid var(--border); }
          .stats-col { order: 2; }
        }
        @media (max-width: 768px) {
          .meta-col { grid-template-columns: repeat(2, 1fr); }
          .avatar-col { border: none; padding-right: 0; width: 100%; margin-bottom: 16px; }
          .stats-col { width: 100%; justify-content: center; }
        }
      `}</style>

      <div style={{ marginBottom: '12px' }}>
        <Link href="/loans" className="btn btn-ghost btn-sm">
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          {d.backToLoans}
        </Link>
      </div>
      
      <div className="card" style={{ marginBottom: '16px', padding: '12px 16px' }}>
        <div className="loan-top-card">
          {/* Row 1: Header Info */}
          <div className="loan-top-header">
            <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 800, color: 'var(--primary)' }}>{loan.loanCode}</h2>
            <span className={getBadgeClass(loan.status)} style={{ textTransform: 'capitalize', fontSize: '.7rem', padding: '3px 10px', borderRadius: '4px' }}>{loan.status}</span>
            <span style={{ fontSize: '.7rem', color: 'var(--text-light)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>calendar_today</span>
              <span style={{ textTransform: 'capitalize' }}>{loan.frequency} {d.schedule}</span>
            </span>
          </div>

          <div className="loan-main-row">
            {/* Column 0: Avatar */}
            <div className="avatar-col">
              <div style={{ width: '68px', height: '68px', borderRadius: '16px', overflow: 'hidden', border: '2px solid var(--border)', background: '#F8FAFC', marginBottom: '4px' }}>
                {loan.customer.profilePhoto ? (
                  <img src={loan.customer.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-light)' }}>
                    <span className="material-icons" style={{ fontSize: '32px' }}>person</span>
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'center' }}>
                <Link href={`/customers/${loan.customer.customerCode}`} style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '.8rem', display: 'block' }}>{loan.customer.name}</Link>
                <div style={{ fontSize: '.6rem', color: 'var(--text-light)', fontWeight: 700, marginTop: '2px' }}>{loan.customer.customerCode}</div>
              </div>
            </div>

            {/* Column 1: Meta Grid */}
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
            </div>

            {/* Column 2: Heatmap */}
            <div className="heatmap-col">
              {(() => {
                const instalments = loan.instalments as any[];
                if (!instalments.length) return <p style={{ fontSize: '.7rem', color: 'var(--text-light)' }}>No data</p>;

                const loanStartDate = new Date(instalments[0].dueDate);
                const loanEndDate = new Date(instalments[instalments.length - 1].dueDate);

                const getColor = (status: string, received: number, due: number) => {
                  if (status === 'paid') return (due > 0 && received / due >= 1) ? '#16A34A' : '#4ADE80';
                  if (status === 'partial') return '#F59E0B';
                  if (status === 'missed') return '#EF4444';
                  return '#E2E8F0';
                };

                if (loan.frequency === 'daily') {
                  const dateMap: Record<string, any> = {};
                  instalments.forEach(inst => {
                    const d = new Date(inst.dueDate);
                    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
                    dateMap[key] = inst;
                  });

                  // Get all unique months in the range
                  const months: { month: string, year: number, monthIdx: number }[] = [];
                  let curr = new Date(Date.UTC(loanStartDate.getUTCFullYear(), loanStartDate.getUTCMonth(), 1));
                  const last = new Date(Date.UTC(loanEndDate.getUTCFullYear(), loanEndDate.getUTCMonth(), 1));
                  
                  while (curr <= last) {
                    months.push({
                      month: curr.toLocaleString('default', { month: 'short', timeZone: 'UTC' }),
                      year: curr.getUTCFullYear(),
                      monthIdx: curr.getUTCMonth()
                    });
                    curr = new Date(Date.UTC(curr.getUTCFullYear(), curr.getUTCMonth() + 1, 1));
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div className="heatmap-header">
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <span className="material-icons-outlined" style={{ fontSize: '14px', color: 'var(--text-light)' }}>calendar_view_month</span>
                          <span style={{ fontSize: '.72rem', fontWeight: 800, color: 'var(--text-secondary)' }}>{d.activityTracker}</span>
                        </div>
                        <div className="heatmap-legend">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#16A34A' }} /> {d.paid}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#F59E0B' }} /> {d.partial}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#EF4444' }} /> {d.missed}</div>
                        </div>
                      </div>
                      
                      <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
                        <div style={{ display: 'flex', gap: '20px' }}>
                          {months.map((m, mi) => {
                            // Generate full calendar grid for this month
                            const firstDay = new Date(Date.UTC(m.year, m.monthIdx, 1));
                            const lastDay = new Date(Date.UTC(m.year, m.monthIdx + 1, 0));
                            
                            // Start grid from the previous Monday
                            const gridStart = new Date(firstDay);
                            gridStart.setUTCDate(gridStart.getUTCDate() - ((gridStart.getUTCDay() + 6) % 7));
                            
                            // End grid at the following Sunday
                            const gridEnd = new Date(lastDay);
                            gridEnd.setUTCDate(gridEnd.getUTCDate() + (7 - (gridEnd.getUTCDay() === 0 ? 7 : gridEnd.getUTCDay())));

                            const weeks = [];
                            let iter = new Date(gridStart);
                            while (iter <= gridEnd) {
                              const week = [];
                              for (let i = 0; i < 7; i++) {
                                week.push(new Date(iter));
                                iter.setUTCDate(iter.getUTCDate() + 1);
                              }
                              weeks.push(week);
                            }

                            return (
                              <div key={mi} className="month-block" style={{ minWidth: '120px' }}>
                                <div className="month-name">{m.month} {m.year}</div>
                                <div className="day-labels">
                                  {['M','T','W','T','F','S','S'].map((d, i) => (
                                    <div key={i} className="day-label">{d}</div>
                                  ))}
                                </div>
                                <div className="calendar-grid">
                                  {weeks.flat().map((day, di) => {
                                    const key = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, '0')}-${String(day.getUTCDate()).padStart(2, '0')}`;
                                    const inst = dateMap[key];
                                    const inLoanRange = day >= loanStartDate && day <= loanEndDate;
                                    const inMonthRange = day.getUTCMonth() === m.monthIdx;
                                    
                                    if (!inMonthRange) return <div key={di} style={{ width: '14px', height: '14px' }} />;

                                    return (
                                      <div key={di}
                                        title={inst ? `#${inst.instalmentNo} ${formatDate(inst.dueDate)}` : (inLoanRange ? formatDate(day) : '')}
                                        style={{
                                          width: `14px`, height: `14px`, borderRadius: '2px',
                                          backgroundColor: inst ? getColor(inst.status, Number(inst.receivedAmount), Number(inst.dueAmount)) : (inLoanRange ? '#F1F5F9' : '#E2E8F0'),
                                          border: inst ? 'none' : (inLoanRange ? '1px solid #E2E8F0' : 'none'),
                                          opacity: inLoanRange ? 1 : 0.3,
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '8px 0' }}>
                      {instalments.map((inst: any) => {
                        let bg = '#E2E8F0';
                        if (inst.status === 'paid') bg = '#16A34A';
                        else if (inst.status === 'partial') bg = '#F59E0B';
                        else if (inst.status === 'missed') bg = '#EF4444';
                        return (
                          <div key={inst.id} title={`#${inst.instalmentNo}`} style={{ width: '18px', height: '18px', borderRadius: '3px', backgroundColor: bg }} />
                        );
                      })}
                    </div>
                  );
                }
              })()}
            </div>

            {/* Column 3: Stats (Progress + Credit Score) */}
            <div className="stats-col">
              {/* Progress Ring */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ position: 'relative', width: '64px', height: '64px', margin: '0 auto' }}>
                  <svg viewBox="0 0 36 36" style={{ width: '64px', height: '64px', transform: 'rotate(-90deg)' }}>
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F1F5F9" strokeWidth="4" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--primary)" strokeWidth="4" strokeDasharray={`${pct}, 100`} strokeLinecap="round" />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.85rem', fontWeight: 800 }}>{pct}%</div>
                </div>
                <div style={{ fontSize: '.6rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 700, textTransform: 'uppercase' }}>{loan.paidCount}/{loan.totalInstalments} {d.paid}</div>
              </div>

              {/* Credit Score Gauge */}
              <CreditScoreGauge score={creditScore} grade={creditGrade} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid-60-40">
        <div className="card">
          <div className="card-header"><h3>📅 {d.paymentSchedule}</h3></div>
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
                {loan.instalments.map((inst: any) => {
                  const canPay = true;
                  const collectedTime = inst.receivedAt ? new Date(inst.receivedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : null;
                  return (
                    <tr key={inst.id} style={{ opacity: inst.status === 'paid' ? 0.6 : 1 }}>
                      <td>{inst.instalmentNo}</td>
                      <td>{formatDate(inst.dueDate)}</td>
                      <td style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>
                        {collectedTime || '—'}
                      </td>
                      <td>{formatCurrency(inst.dueAmount, currencySymbol)}</td>
                      <td>{Number(inst.receivedAmount) > 0 ? formatCurrency(inst.receivedAmount, currencySymbol) : '—'}</td>
                      <td>
                        <span className={getBadgeClass(inst.status)} style={{textTransform:'capitalize'}}>
                          {inst.status}
                        </span>
                      </td>
                      <td>
                        {canPay && loan.status !== 'closed' && (
                          <button className="btn btn-primary btn-sm" onClick={() => openPaymentModal(inst)} style={{ padding: '8px 12px', minHeight: '36px' }}>
                            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>{inst.status === 'paid' ? 'edit' : 'payments'}</span> {inst.status === 'paid' ? d.edit : d.pay}
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
              <div className="stat-item" title={`Missed Days (${missedCount}) x Penalty Rate (${formatCurrency(loan.penaltyRate, currencySymbol)})`}>
                <div className="stat-value" style={{ color: 'var(--danger)' }}>{formatCurrency(totalPenalty, currencySymbol)}</div>
                <div className="stat-label">{d.totalPenalty}</div>
                <div style={{fontSize:'.6rem', opacity: .7, marginTop: '2px'}}>({missedCount}d × {formatCurrency(loan.penaltyRate, currencySymbol)})</div>
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
                <button 
                  className="btn btn-ghost btn-sm" 
                  style={{ flex: 1, border: '1px solid var(--border)', color: 'var(--text-light)' }}
                  onClick={() => openPenaltyModal({ id: 'new', grossPenalty: netPenalty, settledAmount: 0, waivedAmount: 0 }, 'waive')}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>money_off</span> {d.waisePenalty}
                </button>
                <button 
                  className="btn btn-ghost btn-sm" 
                  style={{ flex: 1, border: '1px solid var(--border)', color: 'var(--primary)' }}
                  onClick={() => openPenaltyModal({ id: 'new', grossPenalty: netPenalty, settledAmount: 0, waivedAmount: 0 }, 'settle')}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>payments</span> {d.settlePenalty}
                </button>
              </div>
            )}
            {loan.penalties.length > 0 && (
              <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                {loan.penalties.map((p: any) => {
                  const pNet = Number(p.grossPenalty) - Number(p.settledAmount) - Number(p.waivedAmount);
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '.82rem' }}>
                      <div>
                        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{formatCurrency(p.grossPenalty, currencySymbol)}</span>
                        <span style={{ color: 'var(--text-light)', marginLeft: '8px' }}>{p.missedDays} days</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {p.status === 'pending' && (
                          <>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: '.72rem' }} onClick={() => openPenaltyModal(p, 'settle')}>{d.settle}</button>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: '.72rem', color: 'var(--text-light)' }} onClick={() => openPenaltyModal(p, 'waive')}>{d.waive}</button>
                          </>
                        )}
                        <span className={getBadgeClass(p.status)} style={{textTransform:'capitalize', fontSize: '.7rem'}}>{p.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {loan.status !== 'closed' && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header"><h3>🔧 {d.adminActions}</h3></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                <Link href={`/loans/${loan.id}/edit`} className="btn btn-ghost" style={{ justifyContent: 'center', border: '1px solid var(--border)' }}>
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>edit</span> {d.editLoan}
                </Link>
                <button className="btn btn-danger" onClick={() => setCloseModal(true)}>
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>lock</span> {d.closeLoan}
                </button>
                <button className="btn btn-secondary" onClick={() => setRenewModal(true)}>
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>autorenew</span> {d.renewLoan}
                </button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header"><h3>📄 {d.securityCheques}</h3></div>
            <div>
              {loan.customer.securityCheques.map((ch: any) => (
                <div key={ch.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '.82rem' }}>
                  <span>{ch.bankName} — {ch.chequeNumber}</span>
                  <span className={getBadgeClass(ch.status)} style={{textTransform:'capitalize'}}>{ch.status}</span>
                </div>
              ))}
              {loan.customer.securityCheques.length === 0 && (
                <p style={{ color: 'var(--text-light)', fontSize: '.85rem' }}>{d.noCheques}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setPaymentModal(null); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>💰 {d.submit}</h3>
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
                  <span>{d.amountLabel}: <strong style={{ color: 'var(--text)' }}>{formatCurrency(paymentModal.dueAmount, currencySymbol)}</strong></span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{d.receivedAmount} ({currencySymbol}) *</label>
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
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" style={{ padding: '10px 16px', fontSize: '1rem' }} onClick={() => setPaymentModal(null)}>{d.cancel}</button>
              <button className="btn btn-primary" style={{ padding: '10px 16px', fontSize: '1rem' }} onClick={handleSubmitPayment} disabled={loading || payAmount < 0}>
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>check</span>
                {loading ? d.submitting : d.submitPayment}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Penalty Modal */}
      {penaltyModal && (
        <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setPenaltyModal(null); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>⚖️ {penAction === 'waive' ? d.waive : d.settle} {d.penaltySummary}</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setPenaltyModal(null)}>close</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px' }}>
                <p style={{ fontSize: '.85rem' }}><strong>{loan.customer.name}</strong> — {loan.loanCode}</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)', marginTop: '6px' }}>
                  {d.grossPenalty}: {formatCurrency(penaltyModal.grossPenalty, currencySymbol)}
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">{penAction === 'waive' ? d.waive : d.settlement} {d.amountLabel} ({currencySymbol})</label>
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
                {loading ? d.submitting : d.settle}
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
              <div style={{ background: '#FEF2F2', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px' }}>
                <p style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--danger)' }}>{d.confirmCloseLoan}</p>
                <p style={{ fontSize: '.82rem', color: '#B91C1C', marginTop: '6px' }}>
                  This will permanently mark <strong>{loan.loanCode}</strong> as closed. 
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
                      ⚠️ {activeChqs.length} {d.chequeOnFile}
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
                      {d.chequeReturnConfirm}
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
