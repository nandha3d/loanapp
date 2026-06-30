import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildPropertyMortgageStatus(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId, status } = params;

  const dateFrom = from ? new Date(from) : null;
  if (dateFrom) dateFrom.setHours(0, 0, 0, 0);
  const dateTo = to ? new Date(to) : null;
  if (dateTo) dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const properties = await prisma.propertyCollateral.findMany({
    where: {
      tenantId,
      ...branchFilter,
      ...(status ? { mortgageStatus: status } : {}),
      ...(dateFrom && dateTo ? { OR: [{ releasedAt: null }, { releasedAt: { gte: dateFrom, lte: dateTo } }] } : {}),
      loan: { tenantId, appType, ...branchFilter },
    },
    include: {
      loan: { select: { loanCode: true, status: true, customer: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  let mortgagedCount = 0;
  let releasedCount = 0;
  let underProcessCount = 0;
  let titlesHeldCount = 0;

  const rows = properties.map((p) => {
    const titleHeld = Boolean(p.titleDeedPath) && p.mortgageStatus !== 'released';
    if (p.mortgageStatus === 'mortgaged') mortgagedCount++;
    else if (p.mortgageStatus === 'released') releasedCount++;
    else underProcessCount++;
    if (titleHeld) titlesHeldCount++;

    return {
      loanCode: p.loan.loanCode,
      customerName: p.loan.customer.name,
      propertyType: p.propertyType || '-',
      mortgageStatus: p.mortgageStatus,
      titleHeld,
      releasedAt: p.releasedAt,
      releasedBy: p.releasedBy || '-',
      loanStatus: p.loan.status,
    };
  });

  return {
    title: 'reports.propertyMortgageStatus.title',
    columns: [
      { key: 'loanCode', label: 'reports.col.loanCode', align: 'left', type: 'text' },
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'propertyType', label: 'reports.col.propertyType', align: 'left', type: 'badge' },
      { key: 'mortgageStatus', label: 'reports.col.mortgageStatus', align: 'center', type: 'badge' },
      { key: 'titleHeld', label: 'reports.col.titleHeld', align: 'center', type: 'badge' },
      { key: 'releasedAt', label: 'reports.col.releasedDate', align: 'center', type: 'date' },
      { key: 'releasedBy', label: 'reports.col.releasedBy', align: 'left', type: 'text' },
      { key: 'loanStatus', label: 'reports.col.loanStatus', align: 'center', type: 'badge' },
    ],
    rows,
    kpis: [
      { label: 'mortgaged', value: mortgagedCount },
      { label: 'released', value: releasedCount },
      { label: 'underProcess', value: underProcessCount },
      { label: 'titlesHeld', value: titlesHeldCount },
    ],
    meta: { currencySymbol: '₹' },
  };
}
