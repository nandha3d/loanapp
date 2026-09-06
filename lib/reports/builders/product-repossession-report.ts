import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildProductRepossessionReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, status } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const items = await prisma.productFinanceItem.findMany({
    where: {
      tenantId,
      ...branchFilter,
      repossessionStatus: status ? status : { not: 'active' },
      repossessedAt: { gte: dateFrom, lte: dateTo },
      loan: { tenantId, appType, ...branchFilter },
    },
    include: {
      loan: { select: { loanCode: true, totalPayable: true, totalCollected: true, customer: { select: { name: true } } } },
    },
    orderBy: { repossessedAt: 'desc' },
  });

  let totalOutstanding = 0;
  let repossessedCount = 0;

  const rows = items.map((it) => {
    const outstanding = Math.max(0, Number(it.loan.totalPayable) - Number(it.loan.totalCollected));
    totalOutstanding += outstanding;
    if (it.repossessionStatus === 'repossessed') {
      repossessedCount++;
    }

    return {
      loanCode: it.loan.loanCode,
      customerName: it.loan.customer.name,
      productName: it.productName || '-',
      serialNo: it.serialNo || '-',
      outstanding,
      repossessionStatus: it.repossessionStatus,
      repossessedAt: it.repossessedAt,
    };
  });

  return {
    title: 'reports.productRepossession.title',
    columns: [
      { key: 'loanCode', label: 'reports.col.loanCode', align: 'left', type: 'text' },
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'productName', label: 'reports.col.product', align: 'left', type: 'text' },
      { key: 'serialNo', label: 'reports.col.serialNo', align: 'left', type: 'text' },
      { key: 'outstanding', label: 'reports.col.outstanding', align: 'right', type: 'currency', total: true },
      { key: 'repossessionStatus', label: 'reports.col.repoStatus', align: 'center', type: 'badge' },
      { key: 'repossessedAt', label: 'reports.col.repossessedDate', align: 'center', type: 'date' },
    ],
    rows,
    totals: {
      outstanding: totalOutstanding,
    },
    kpis: [
      { label: 'flagged', value: rows.length },
      { label: 'repossessed', value: repossessedCount },
      { label: 'outstandingAtRisk', value: totalOutstanding, tone: 'bad' },
    ],
    meta: { currencySymbol: '₹' },
  };
}
