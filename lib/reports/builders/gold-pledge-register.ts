import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildGoldPledgeRegister(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, status } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const where: any = {
    tenantId,
    ...branchFilter,
    loan: { tenantId, appType, ...branchFilter },
    createdAt: { gte: dateFrom, lte: dateTo },
    ...(status ? { releaseStatus: status } : {}),
  };

  const pledges = await prisma.goldLoanCollateral.findMany({
    where,
    include: {
      loan: { select: { loanCode: true, principal: true } },
      customer: { select: { name: true } },
      items: { select: { ornamentType: true, quantity: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  let totalGross = 0;
  let totalNet = 0;
  let totalAssessed = 0;
  let totalPrincipal = 0;
  let totalOutstanding = 0;
  let activeCount = 0;

  const rows = pledges.map((p) => {
    const grossWeightGrams = Number(p.grossWeightGrams);
    const netWeightGrams = Number(p.netWeightGrams);
    const assessedValue = Number(p.assessedValue || 0);
    const principal = Number(p.loan.principal);
    const outstandingPrincipal = Number(p.outstandingPrincipal ?? p.loan.principal);
    const ornamentSummary = p.items.map((i) => `${i.ornamentType} x${i.quantity}`).join(', ');

    totalGross += grossWeightGrams;
    totalNet += netWeightGrams;
    totalAssessed += assessedValue;
    totalPrincipal += principal;
    totalOutstanding += outstandingPrincipal;
    if (p.releaseStatus === 'pledged') activeCount++;

    return {
      packetNo: p.packetNo || '-',
      loanCode: p.loan.loanCode,
      customerName: p.customer.name,
      ornamentSummary: ornamentSummary || (p.ornamentDescription || '-'),
      grossWeightGrams,
      netWeightGrams,
      purityKarat: p.purityKarat,
      assessedValue,
      principal,
      outstandingPrincipal,
      releaseStatus: p.releaseStatus,
    };
  });

  return {
    title: 'reports.goldPledgeRegister.title',
    columns: [
      { key: 'packetNo', label: 'reports.col.packetNo', align: 'left', type: 'text' },
      { key: 'loanCode', label: 'reports.col.loanCode', align: 'left', type: 'text' },
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'ornamentSummary', label: 'reports.col.ornaments', align: 'left', type: 'text' },
      { key: 'grossWeightGrams', label: 'reports.col.gross', align: 'right', type: 'number', total: true },
      { key: 'netWeightGrams', label: 'reports.col.net', align: 'right', type: 'number', total: true },
      { key: 'purityKarat', label: 'reports.col.purity', align: 'center', type: 'text' },
      { key: 'assessedValue', label: 'reports.col.assessedValue', align: 'right', type: 'currency', total: true },
      { key: 'principal', label: 'reports.col.loanAmount', align: 'right', type: 'currency', total: true },
      { key: 'outstandingPrincipal', label: 'reports.col.osPrincipal', align: 'right', type: 'currency', total: true },
      { key: 'releaseStatus', label: 'reports.col.status', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      grossWeightGrams: totalGross,
      netWeightGrams: totalNet,
      assessedValue: totalAssessed,
      principal: totalPrincipal,
      outstandingPrincipal: totalOutstanding,
    },
    kpis: [
      { label: 'activePledges', value: activeCount },
      { label: 'totalNetWeight', value: totalNet },
      { label: 'totalAssessedValue', value: totalAssessed },
      { label: 'totalOutstanding', value: totalOutstanding },
    ],
    meta: { currencySymbol: '₹' },
  };
}
