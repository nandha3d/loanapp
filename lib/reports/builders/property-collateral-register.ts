import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildPropertyCollateralRegister(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, status } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const properties = await prisma.propertyCollateral.findMany({
    where: {
      tenantId,
      ...branchFilter,
      createdAt: { gte: dateFrom, lte: dateTo },
      ...(status ? { mortgageStatus: status } : {}),
      loan: { tenantId, appType, ...branchFilter },
    },
    include: {
      loan: { select: { loanCode: true, principal: true, customer: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  let totalMarketValue = 0;
  let totalEligibleAmount = 0;
  let totalPrincipal = 0;
  let activeCount = 0;
  let docsIncompleteCount = 0;

  const rows = properties.map((p) => {
    const marketValue = Number(p.marketValue || 0);
    const eligibleAmount = Number(p.eligibleAmount || 0);
    const principal = Number(p.loan.principal);
    const extent = p.extentValue ? `${Number(p.extentValue)} ${p.extentUnit || ''}`.trim() : '-';
    const docsComplete = Boolean(p.titleDeedPath && p.ecPath && p.taxReceiptPath);

    totalMarketValue += marketValue;
    totalEligibleAmount += eligibleAmount;
    totalPrincipal += principal;
    if (p.mortgageStatus === 'mortgaged') activeCount++;
    if (!docsComplete) docsIncompleteCount++;

    return {
      loanCode: p.loan.loanCode,
      customerName: p.loan.customer.name,
      propertyType: p.propertyType || '-',
      address: p.address || '-',
      surveyNo: p.surveyNo || '-',
      extent,
      marketValue,
      eligibleAmount,
      principal,
      docsComplete,
      mortgageStatus: p.mortgageStatus,
    };
  });

  return {
    title: 'reports.propertyRegister.title',
    columns: [
      { key: 'loanCode', label: 'reports.col.loanCode', align: 'left', type: 'text' },
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'propertyType', label: 'reports.col.propertyType', align: 'left', type: 'badge' },
      { key: 'address', label: 'reports.col.address', align: 'left', type: 'text' },
      { key: 'surveyNo', label: 'reports.col.surveyNo', align: 'left', type: 'text' },
      { key: 'extent', label: 'reports.col.extent', align: 'right', type: 'text' },
      { key: 'marketValue', label: 'reports.col.marketValue', align: 'right', type: 'currency', total: true },
      { key: 'eligibleAmount', label: 'reports.col.eligibleAmount', align: 'right', type: 'currency', total: true },
      { key: 'principal', label: 'reports.col.loanAmount', align: 'right', type: 'currency', total: true },
      { key: 'docsComplete', label: 'reports.col.docs', align: 'center', type: 'badge' },
      { key: 'mortgageStatus', label: 'reports.col.status', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      marketValue: totalMarketValue,
      eligibleAmount: totalEligibleAmount,
      principal: totalPrincipal,
    },
    kpis: [
      { label: 'activeMortgages', value: activeCount },
      { label: 'totalMarketValue', value: totalMarketValue },
      { label: 'totalExposure', value: totalPrincipal },
      { label: 'docsIncompleteCount', value: docsIncompleteCount, tone: docsIncompleteCount > 0 ? 'warn' : 'good' },
    ],
    meta: { currencySymbol: '₹' },
  };
}
