import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildEmiSchedule(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, loanId, customerId } = params;

  let targetLoanId = loanId;

  // If no loanId but customerId is provided, find the most recent active/overdue loan
  if (!targetLoanId && customerId) {
    const activeLoan = await prisma.loan.findFirst({
      where: { tenantId, appType, customerId, status: { in: ['active', 'overdue'] } },
      orderBy: { startDate: 'desc' },
      select: { id: true },
    });
    if (activeLoan) {
      targetLoanId = activeLoan.id;
    }
  }

  if (!targetLoanId) {
    throw new Error('Loan ID or Customer ID is required for EMI Schedule report');
  }

  // Fetch loan details and its instalments
  const loan = await prisma.loan.findFirst({
    where: { id: targetLoanId, tenantId, appType },
    include: {
      customer: { select: { name: true } },
      instalments: {
        orderBy: { instalmentNo: 'asc' },
      },
      penalties: {
        select: {
          instalmentId: true,
          grossPenalty: true,
          instalment: { select: { instalmentNo: true } }
        },
      },
    },
  });

  if (!loan) {
    throw new Error(`Loan with ID '${targetLoanId}' not found`);
  }

  const penaltyMap = new Map<number, number>();
  (loan.penalties as any[]).forEach(p => {
    const instNo = p.instalment?.instalmentNo;
    if (instNo) {
      const cur = penaltyMap.get(instNo) || 0;
      penaltyMap.set(instNo, cur + Number(p.grossPenalty));
    }
  });

  let runningBalance = Number(loan.totalPayable);
  let totalPaid = 0;
  let totalPenalty = 0;
  let missedCount = 0;

  const rows = (loan.instalments as any[]).map((inst) => {
    const due = Number(inst.dueAmount);
    const received = Number(inst.receivedAmount || 0);
    const penalty = penaltyMap.get(inst.instalmentNo) || 0;
    
    totalPaid += received;
    totalPenalty += penalty;
    runningBalance = Math.max(0, runningBalance - received);

    if (inst.status === 'missed') {
      missedCount++;
    }

    let delay = 0;
    if (inst.receivedAt) {
      const dueTime = new Date(inst.dueDate).getTime();
      const recTime = new Date(inst.receivedAt).getTime();
      if (recTime > dueTime) {
        delay = Math.floor((recTime - dueTime) / 86400000);
      }
    }

    return {
      instalmentNo: inst.instalmentNo,
      dueDate: inst.dueDate,
      receivedAt: inst.receivedAt || null,
      delay,
      dueAmount: due,
      receivedAmount: received,
      penalty,
      balance: runningBalance,
      status: inst.status,
    };
  });

  return {
    title: 'reports.emiSchedule.title',
    columns: [
      { key: 'instalmentNo', label: 'reports.col.instalmentNo', align: 'center', type: 'number' },
      { key: 'dueDate', label: 'reports.col.dueDate', align: 'center', type: 'date' },
      { key: 'receivedAt', label: 'reports.col.paidDate', align: 'center', type: 'date' },
      { key: 'delay', label: 'reports.col.delay', align: 'right', type: 'number' },
      { key: 'dueAmount', label: 'reports.col.due', align: 'right', type: 'currency', total: true },
      { key: 'receivedAmount', label: 'reports.col.paid', align: 'right', type: 'currency', total: true },
      { key: 'penalty', label: 'reports.col.penalty', align: 'right', type: 'currency', total: true },
      { key: 'balance', label: 'reports.col.balance', align: 'right', type: 'currency' },
      { key: 'status', label: 'reports.col.status', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      dueAmount: Number(loan.totalPayable),
      receivedAmount: totalPaid,
      penalty: totalPenalty,
    },
    kpis: [
      { label: 'totalInstalments', value: loan.instalments.length },
      { label: 'paidInstalments', value: (loan.instalments as any[]).filter(i => i.status === 'paid').length },
      { label: 'missedInstalments', value: missedCount },
      { label: 'totalPenaltyApplied', value: totalPenalty },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
