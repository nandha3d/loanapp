import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildAdvancePaymentReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, agentId, loanType } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  // Advance/early payers: paid instalments whose receivedAt predates dueDate,
  // or instalments where the received amount exceeds what was due (surplus).
  const instalments = await prisma.instalment.findMany({
    where: {
      dueDate: { gte: dateFrom, lte: dateTo },
      status: 'paid',
      receivedAt: { not: null },
      ...(agentId ? { agentId } : {}),
      loan: {
        tenantId,
        appType,
        ...branchFilter,
        ...(loanType ? { loanType } : {}),
      },
    },
    include: {
      loan: { select: { loanCode: true, customer: { select: { name: true } } } },
    },
    orderBy: { receivedAt: 'asc' },
  });

  let totalAmount = 0;
  let totalAdvance = 0;
  let daysEarlySum = 0;

  const rows: Record<string, any>[] = [];

  instalments.forEach((inst) => {
    const due = Number(inst.dueAmount);
    const received = Number(inst.receivedAmount || 0);
    const dueTime = new Date(inst.dueDate).getTime();
    const receivedTime = new Date(inst.receivedAt as Date).getTime();

    const daysEarly = Math.floor((dueTime - receivedTime) / 86400000);
    const surplus = Math.max(0, received - due);

    // Qualifies if paid strictly before the due date, or paid more than due.
    if (!(daysEarly > 0 || surplus > 0)) return;

    const advance = surplus;

    totalAmount += received;
    totalAdvance += advance;
    daysEarlySum += Math.max(0, daysEarly);

    rows.push({
      customerName: inst.loan?.customer?.name || '—',
      loanCode: inst.loan?.loanCode || '—',
      dueDate: inst.dueDate,
      receivedAt: inst.receivedAt,
      daysEarly: Math.max(0, daysEarly),
      receivedAmount: received,
      advance,
    });
  });

  const avgDaysEarly = rows.length > 0 ? Math.round(daysEarlySum / rows.length) : 0;

  return {
    title: 'reports.advancePayment.title',
    columns: [
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'loanCode', label: 'reports.col.loanCode', align: 'left', type: 'text' },
      { key: 'dueDate', label: 'reports.col.dueDate', align: 'center', type: 'date' },
      { key: 'receivedAt', label: 'reports.col.paidDate', align: 'center', type: 'date' },
      { key: 'daysEarly', label: 'reports.col.daysEarly', align: 'right', type: 'number' },
      { key: 'receivedAmount', label: 'reports.col.amount', align: 'right', type: 'currency', total: true },
      { key: 'advance', label: 'reports.col.advance', align: 'right', type: 'currency', total: true },
    ],
    rows,
    totals: {
      receivedAmount: totalAmount,
      advance: totalAdvance,
    },
    kpis: [
      { label: 'advancePayingCustomers', value: rows.length, tone: 'good' },
      { label: 'totalAdvanceAmount', value: totalAdvance },
      { label: 'avgDaysEarly', value: avgDaysEarly },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
