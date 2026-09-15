import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildProductFinanceRegister(params: ReportBuilderParams): Promise<ReportPayload> {
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
      createdAt: { gte: dateFrom, lte: dateTo },
      ...(status ? { repossessionStatus: status } : {}),
      loan: { tenantId, appType, ...branchFilter },
    },
    include: {
      loan: { select: { loanCode: true, customer: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  let totalInvoice = 0;
  let totalDownPayment = 0;
  let totalFinanced = 0;
  let activeCount = 0;

  const rows = items.map((it) => {
    const invoiceAmount = Number(it.invoiceAmount || 0);
    const downPayment = Number(it.downPayment || 0);
    const financedAmount = Number(it.financedAmount || 0);
    const brandModel = [it.brand, it.modelNo].filter(Boolean).join(' / ') || '-';

    totalInvoice += invoiceAmount;
    totalDownPayment += downPayment;
    totalFinanced += financedAmount;
    if (it.repossessionStatus === 'active') activeCount++;

    return {
      loanCode: it.loan.loanCode,
      customerName: it.loan.customer.name,
      productName: it.productName || '-',
      brandModel,
      serialNo: it.serialNo || '-',
      dealerName: it.dealerName || '-',
      invoiceAmount,
      downPayment,
      financedAmount,
      tenureMonths: it.tenureMonths ?? null,
      repossessionStatus: it.repossessionStatus,
    };
  });

  const avgTicket = rows.length > 0 ? totalFinanced / rows.length : 0;

  return {
    title: 'reports.productRegister.title',
    columns: [
      { key: 'loanCode', label: 'reports.col.loanCode', align: 'left', type: 'text' },
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'productName', label: 'reports.col.product', align: 'left', type: 'text' },
      { key: 'brandModel', label: 'reports.col.brandModel', align: 'left', type: 'text' },
      { key: 'serialNo', label: 'reports.col.serialNo', align: 'left', type: 'text' },
      { key: 'dealerName', label: 'reports.col.dealer', align: 'left', type: 'text' },
      { key: 'invoiceAmount', label: 'reports.col.invoice', align: 'right', type: 'currency', total: true },
      { key: 'downPayment', label: 'reports.col.downPayment', align: 'right', type: 'currency', total: true },
      { key: 'financedAmount', label: 'reports.col.financed', align: 'right', type: 'currency', total: true },
      { key: 'tenureMonths', label: 'reports.col.tenure', align: 'right', type: 'number' },
      { key: 'repossessionStatus', label: 'reports.col.status', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      invoiceAmount: totalInvoice,
      downPayment: totalDownPayment,
      financedAmount: totalFinanced,
    },
    kpis: [
      { label: 'activeItems', value: activeCount },
      { label: 'totalFinanced', value: totalFinanced },
      { label: 'totalDownPayment', value: totalDownPayment },
      { label: 'avgTicket', value: Math.round(avgTicket) },
    ],
    meta: { currencySymbol: '₹' },
  };
}
