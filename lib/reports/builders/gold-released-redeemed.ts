import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildGoldReleasedRedeemed(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, from, to, branchId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const pledges = await prisma.goldLoanCollateral.findMany({
    where: {
      tenantId,
      ...branchFilter,
      releaseStatus: { not: 'pledged' },
      releasedAt: { gte: dateFrom, lte: dateTo },
      loan: { tenantId, appType, ...branchFilter },
    },
    include: {
      loan: {
        select: {
          loanCode: true,
          startDate: true,
          principal: true,
          payments: {
            where: { paymentType: 'redemption' },
            select: { amount: true },
          },
        },
      },
      customer: { select: { name: true } },
    },
    orderBy: { releasedAt: 'desc' },
  });

  let totalNetWeight = 0;
  let totalPrincipal = 0;
  let totalInterestCollected = 0;
  let totalSettled = 0;

  const rows = pledges.map((p) => {
    const netWeightGrams = Number(p.netWeightGrams);
    const principal = Number(p.loan.principal);
    const redemptionPaid = p.loan.payments.reduce((sum, pay) => sum + Number(pay.amount), 0);
    const interestCollected = Math.max(0, redemptionPaid - principal);
    const totalSettledRow = redemptionPaid > 0 ? redemptionPaid : principal;

    totalNetWeight += netWeightGrams;
    totalPrincipal += principal;
    totalInterestCollected += interestCollected;
    totalSettled += totalSettledRow;

    return {
      packetNo: p.packetNo || '-',
      customerName: p.customer.name,
      pledgeDate: p.loan.startDate,
      releasedAt: p.releasedAt,
      netWeightGrams,
      principal,
      interestCollected,
      totalSettled: totalSettledRow,
    };
  });

  return {
    title: 'reports.goldReleased.title',
    columns: [
      { key: 'packetNo', label: 'reports.col.packetNo', align: 'left', type: 'text' },
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'pledgeDate', label: 'reports.col.pledgeDate', align: 'center', type: 'date' },
      { key: 'releasedAt', label: 'reports.col.releasedDate', align: 'center', type: 'date' },
      { key: 'netWeightGrams', label: 'reports.col.netReleased', align: 'right', type: 'number', total: true },
      { key: 'principal', label: 'reports.col.principal', align: 'right', type: 'currency', total: true },
      { key: 'interestCollected', label: 'reports.col.interestCollected', align: 'right', type: 'currency', total: true },
      { key: 'totalSettled', label: 'reports.col.totalSettled', align: 'right', type: 'currency', total: true },
    ],
    rows,
    totals: {
      netWeightGrams: totalNetWeight,
      principal: totalPrincipal,
      interestCollected: totalInterestCollected,
      totalSettled: totalSettled,
    },
    kpis: [
      { label: 'redeemedCount', value: rows.length },
      { label: 'netWeightReleased', value: totalNetWeight },
      { label: 'interestRealized', value: totalInterestCollected },
      { label: 'totalSettled', value: totalSettled },
    ],
    meta: { currencySymbol: '₹' },
  };
}
