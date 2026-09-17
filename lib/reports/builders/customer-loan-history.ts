import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildCustomerLoanHistory(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, customerId, status, from, to } = params;

  if (!customerId) {
    throw new Error('Customer ID is required for Customer Loan History report');
  }

  const dateFrom = from ? new Date(from) : undefined;
  if (dateFrom) dateFrom.setHours(0, 0, 0, 0);
  const dateTo = to ? new Date(to) : undefined;
  if (dateTo) dateTo.setHours(23, 59, 59, 999);

  const where: any = {
    tenantId,
    appType,
    customerId,
    ...(status ? { status } : {}),
    ...(dateFrom && dateTo ? { startDate: { gte: dateFrom, lte: dateTo } } : {}),
  };

  const loans = await prisma.loan.findMany({
    where,
    orderBy: { startDate: 'desc' },
  });

  let totalDisbursed = 0;
  let totalRepaid = 0;
  let totalOutstanding = 0;

  const rows = loans.map((l) => {
    const disbursed = Number(l.disbursed || 0);
    const repaid = Number(l.totalCollected || 0);
    const payable = Number(l.totalPayable || 0);
    const outstanding = Math.max(0, payable - repaid);

    totalDisbursed += disbursed;
    totalRepaid += repaid;
    totalOutstanding += outstanding;

    return {
      loanCode: l.loanCode,
      loanType: l.loanType,
      disbursed,
      totalCollected: repaid,
      outstanding,
      startDate: l.startDate,
      endOrClosed: l.endDate,
      status: l.status,
    };
  });

  return {
    title: 'reports.customerLoanHistory.title',
    columns: [
      { key: 'loanCode', label: 'reports.col.loanNo', align: 'left', type: 'text' },
      { key: 'loanType', label: 'reports.col.loanType', align: 'left', type: 'badge' },
      { key: 'disbursed', label: 'reports.col.disbursed', align: 'right', type: 'currency', total: true },
      { key: 'totalCollected', label: 'reports.col.repaid', align: 'right', type: 'currency', total: true },
      { key: 'outstanding', label: 'reports.col.outstanding', align: 'right', type: 'currency', total: true },
      { key: 'startDate', label: 'reports.col.startDate', align: 'center', type: 'date' },
      { key: 'endOrClosed', label: 'reports.col.endOrClosed', align: 'center', type: 'date' },
      { key: 'status', label: 'reports.col.status', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      disbursed: totalDisbursed,
      totalCollected: totalRepaid,
      outstanding: totalOutstanding,
    },
    kpis: [
      { label: 'totalLoans', value: loans.length },
      { label: 'totalDisbursedLifetime', value: totalDisbursed },
      { label: 'totalRepaidLifetime', value: totalRepaid },
      { label: 'currentOutstanding', value: totalOutstanding },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
