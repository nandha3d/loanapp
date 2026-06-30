import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildPaymentByMode(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, paymentMode, paymentStatus, status } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  // Fetch payments
  const payments = await prisma.payment.findMany({
    where: {
      tenantId,
      paymentDate: { gte: dateFrom, lte: dateTo },
      ...(paymentMode ? { paymentMode } : {}),
      ...(paymentStatus ? { paymentType: paymentStatus } : {}),
      ...(status ? { status } : {}),
      loan: {
        appType,
        ...branchFilter,
      },
    },
    include: {
      loan: {
        select: {
          loanCode: true,
          customer: { select: { name: true } },
        },
      },
    },
    orderBy: { paymentDate: 'desc' },
  });

  const totalsByMode: Record<string, number> = {};
  let totalAmount = 0;

  const rows = payments.map((p) => {
    const amt = Number(p.amount);
    totalAmount += amt;

    const mode = p.paymentMode || 'general';
    totalsByMode[mode] = (totalsByMode[mode] || 0) + amt;

    return {
      paymentDate: p.paymentDate,
      loanCode: p.loan.loanCode,
      customerName: p.loan.customer.name,
      paymentMode: p.paymentMode,
      paymentType: p.paymentType,
      amount: amt,
      status: p.status,
    };
  });

  // Prepare KPIs for each mode
  const modeKpis = Object.entries(totalsByMode).map(([mode, sum]) => ({
    label: `${mode.toUpperCase()} Total`,
    value: sum,
  }));

  return {
    title: 'reports.paymentByMode.title',
    columns: [
      { key: 'paymentDate', label: 'reports.col.date', align: 'left', type: 'date' },
      { key: 'loanCode', label: 'reports.col.loanNo', align: 'left', type: 'text' },
      { key: 'customerName', label: 'reports.col.customer', align: 'left', type: 'text' },
      { key: 'paymentMode', label: 'reports.col.mode', align: 'center', type: 'badge' },
      { key: 'paymentType', label: 'reports.col.type', align: 'center', type: 'badge' },
      { key: 'amount', label: 'reports.col.amount', align: 'right', type: 'currency', total: true },
      { key: 'status', label: 'reports.col.status', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      amount: totalAmount,
    },
    kpis: [
      { label: 'transactionCount', value: payments.length },
      { label: 'totalPaymentsReceived', value: totalAmount },
      ...modeKpis.slice(0, 2), // include top 2 modes as KPIs
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
