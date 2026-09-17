import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildCustomerCollectionHistory(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, customerId, from, to, loanId, paymentMode } = params;

  if (!customerId) {
    throw new Error('Customer ID is required for Customer Collection History report');
  }

  const dateFrom = from ? new Date(from) : undefined;
  if (dateFrom) dateFrom.setHours(0, 0, 0, 0);
  const dateTo = to ? new Date(to) : undefined;
  if (dateTo) dateTo.setHours(23, 59, 59, 999);

  // All loans for this customer (scoped to tenant/appType), used both to
  // restrict the payment query and to compute total outstanding.
  const loans = await prisma.loan.findMany({
    where: {
      tenantId,
      appType,
      customerId,
      ...(loanId ? { id: loanId } : {}),
    },
    select: { id: true, loanCode: true, totalPayable: true, totalCollected: true },
  });
  const loanIds = loans.map((l) => l.id);
  const loanCodeById = new Map(loans.map((l) => [l.id, l.loanCode]));

  const totalPayableAcrossLoans = loans.reduce((sum, l) => sum + Number(l.totalPayable), 0);
  const totalCollectedAcrossLoans = loans.reduce((sum, l) => sum + Number(l.totalCollected || 0), 0);
  const outstandingAcrossLoans = Math.max(0, totalPayableAcrossLoans - totalCollectedAcrossLoans);

  if (loanIds.length === 0) {
    return {
      title: 'reports.customerHistory.title',
      columns: [
        { key: 'date', label: 'reports.col.date', align: 'left', type: 'date' },
        { key: 'loanCode', label: 'reports.col.loanCode', align: 'left', type: 'text' },
        { key: 'amount', label: 'reports.col.amount', align: 'right', type: 'currency', total: true },
        { key: 'paymentMode', label: 'reports.col.mode', align: 'center', type: 'badge' },
        { key: 'paymentType', label: 'reports.col.type', align: 'center', type: 'badge' },
        { key: 'agentName', label: 'reports.col.agent', align: 'left', type: 'text' },
        { key: 'balance', label: 'reports.col.balance', align: 'right', type: 'currency' },
      ],
      rows: [],
      totals: { amount: 0 },
      kpis: [
        { label: 'totalPaid', value: 0 },
        { label: 'loansCount', value: 0 },
        { label: 'lastPaymentDate', value: '—' },
        { label: 'outstandingAcrossLoans', value: 0 },
      ],
      meta: { currencySymbol: '₹' },
    };
  }

  // Payments across all of the customer's loans, ordered chronologically.
  const payments = await prisma.payment.findMany({
    where: {
      tenantId,
      loanId: { in: loanIds },
      ...(dateFrom && dateTo ? { paymentDate: { gte: dateFrom, lte: dateTo } } : {}),
      ...(paymentMode ? { paymentMode } : {}),
      status: 'completed',
    },
    orderBy: { paymentDate: 'asc' },
  });

  // CollectionEntry rows carry the agent who collected the money. Match by
  // loan + date (same day) to attribute an agent name where possible, since
  // Payment itself has no agentId.
  const entries = await prisma.collectionEntry.findMany({
    where: {
      tenantId,
      loanId: { in: loanIds },
      ...(dateFrom && dateTo ? { submittedAt: { gte: dateFrom, lte: dateTo } } : {}),
    },
    include: { agent: { select: { name: true } } },
    orderBy: { submittedAt: 'asc' },
  });

  const agentByLoanAndDay = new Map<string, string>();
  for (const e of entries) {
    const day = e.submittedAt.toISOString().split('T')[0];
    agentByLoanAndDay.set(`${e.loanId}_${day}`, e.agent.name);
  }

  let runningBalance = totalPayableAcrossLoans;
  let totalPaid = 0;

  const rows = payments.map((p) => {
    const amount = Number(p.amount);
    totalPaid += amount;
    runningBalance = Math.max(0, runningBalance - amount);

    const day = p.paymentDate.toISOString().split('T')[0];
    const agentName = agentByLoanAndDay.get(`${p.loanId}_${day}`) || '—';

    return {
      date: p.paymentDate,
      loanCode: loanCodeById.get(p.loanId) || '—',
      amount,
      paymentMode: p.paymentMode,
      paymentType: p.paymentType,
      agentName,
      balance: runningBalance,
    };
  });

  const lastPaymentDate = rows.length > 0 ? rows[rows.length - 1].date : null;

  return {
    title: 'reports.customerHistory.title',
    columns: [
      { key: 'date', label: 'reports.col.date', align: 'left', type: 'date' },
      { key: 'loanCode', label: 'reports.col.loanCode', align: 'left', type: 'text' },
      { key: 'amount', label: 'reports.col.amount', align: 'right', type: 'currency', total: true },
      { key: 'paymentMode', label: 'reports.col.mode', align: 'center', type: 'badge' },
      { key: 'paymentType', label: 'reports.col.type', align: 'center', type: 'badge' },
      { key: 'agentName', label: 'reports.col.agent', align: 'left', type: 'text' },
      { key: 'balance', label: 'reports.col.balance', align: 'right', type: 'currency' },
    ],
    rows,
    totals: {
      amount: totalPaid,
    },
    kpis: [
      { label: 'totalPaid', value: totalPaid },
      { label: 'loansCount', value: loans.length },
      { label: 'lastPaymentDate', value: lastPaymentDate ? lastPaymentDate.toISOString().split('T')[0] : '—' },
      { label: 'outstandingAcrossLoans', value: outstandingAcrossLoans },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
