import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildChitAuctionReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, from, to, branchId } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  const auctions = await prisma.chitAuction.findMany({
    where: {
      auctionDate: { gte: dateFrom, lte: dateTo },
      chitGroup: { tenantId, appType: 'chitfunds', ...branchFilter, deletedAt: null },
    },
    include: {
      chitGroup: { select: { name: true, totalMembers: true } },
      winnerMember: { include: { customer: { select: { name: true } } } },
    },
    orderBy: { auctionDate: 'desc' },
  });

  let totalDiscount = 0;
  let totalDividend = 0;

  const rows = auctions.map((a) => {
    const discount = Number(a.bidDiscount || 0);
    const prizeAmount = Number(a.prizeAmount || 0);
    const dividend = Number(a.dividend || 0);
    const memberCount = a.chitGroup.totalMembers || 1;
    const dividendPerMember = memberCount > 0 ? dividend / memberCount : 0;

    totalDiscount += discount;
    totalDividend += dividend;

    return {
      chitName: a.chitGroup.name,
      month: `Period ${a.periodNumber}`,
      auctionDate: a.auctionDate,
      winnerName: a.winnerMember?.customer.name || '-',
      discount,
      prizeAmount,
      dividendPerMember,
    };
  });

  return {
    title: 'reports.chitAuction.title',
    columns: [
      { key: 'chitName', label: 'reports.col.chitName', align: 'left', type: 'text' },
      { key: 'month', label: 'reports.col.month', align: 'center', type: 'text' },
      { key: 'auctionDate', label: 'reports.col.auctionDate', align: 'center', type: 'date' },
      { key: 'winnerName', label: 'reports.col.winner', align: 'left', type: 'text' },
      { key: 'discount', label: 'reports.col.discount', align: 'right', type: 'currency', total: true },
      { key: 'prizeAmount', label: 'reports.col.prizeAmount', align: 'right', type: 'currency', total: true },
      { key: 'dividendPerMember', label: 'reports.col.dividend', align: 'right', type: 'currency' },
    ],
    rows,
    totals: {
      discount: totalDiscount,
      prizeAmount: rows.reduce((sum, r) => sum + r.prizeAmount, 0),
    },
    kpis: [
      { label: 'auctionsHeld', value: rows.length },
      { label: 'totalDiscount', value: totalDiscount },
      { label: 'totalDividendDistributed', value: totalDividend },
    ],
    meta: { currencySymbol: '₹' },
  };
}
