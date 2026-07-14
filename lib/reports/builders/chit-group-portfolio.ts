import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

// "40 chits at a glance" — one row per group with completion %, next auction
// date and cash-vs-credited dividend split, so an operator running many groups
// can scan the whole portfolio without opening each group individually.
// Deliberately a new slug (not an extension of chit-group-ledger) to avoid
// changing that report's existing contract.

function groupWhere(params: ReportBuilderParams) {
  return {
    tenantId: params.tenantId,
    appType: params.appType,
    deletedAt: null,
    ...(params.branchId ? { branchId: params.branchId } : {}),
    ...(params.groupId ? { id: params.groupId } : {}),
    ...(params.status ? { status: params.status } : {}),
  };
}

function total(rows: Record<string, any>[], key: string) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

export async function buildChitGroupPortfolio(params: ReportBuilderParams): Promise<ReportPayload> {
  const groups = await prisma.chitGroup.findMany({
    where: groupWhere(params),
    include: {
      auctions: { orderBy: { periodNumber: 'asc' } },
      members: { include: { subscriptions: true } },
    },
    orderBy: { startDate: 'desc' },
  });

  const today = new Date();

  const rows = groups.map((g) => {
    const subs = g.members.flatMap((m) => m.subscriptions);
    const collected = subs.reduce((sum, s) => sum + Number(s.paidAmount), 0);
    const outstanding = subs.reduce((sum, s) => sum + Number(s.dueAmount), 0);
    const completedAuctions = g.auctions.filter((a) => ['confirmed', 'paid', 'completed'].includes(a.status));
    const prizesPaid = completedAuctions.reduce((sum, a) => sum + Number(a.prizeAmount || 0), 0);
    const commissionEarned = completedAuctions.reduce((sum, a) => sum + Number(a.commission || 0), 0);
    const gstCollected = completedAuctions.reduce((sum, a) => sum + Number(a.gstAmount || 0), 0);
    const dividendTotal = completedAuctions.reduce((sum, a) => sum + Number(a.dividend || 0), 0);
    const dividendCash = g.dividendDistribution === 'CASH_PAYOUT' ? dividendTotal : 0;
    const dividendCredited = g.dividendDistribution !== 'CASH_PAYOUT' ? dividendTotal : 0;
    const nextAuction = g.auctions.find(
      (a) => ['pending', 'notice_sent', 'in_progress'].includes(a.status) && a.auctionDate >= today,
    ) ?? g.auctions.find((a) => ['pending', 'notice_sent', 'in_progress'].includes(a.status));
    const completionPct = g.totalMembers > 0 ? Math.round((completedAuctions.length / g.totalMembers) * 1000) / 10 : 0;

    return {
      chitName: g.name,
      groupCode: g.groupCode ?? '—',
      status: g.status,
      chitValue: Number(g.chitValue),
      members: g.members.length,
      totalMembers: g.totalMembers,
      completionPct,
      collected,
      outstanding,
      prizesPaid,
      commissionEarned,
      gstCollected,
      dividendCash,
      dividendCredited,
      nextAuctionDate: nextAuction ? nextAuction.auctionDate.toISOString().slice(0, 10) : '—',
    };
  });

  return {
    title: 'reports.chitGroupPortfolio.title',
    columns: [
      { key: 'chitName', label: 'reports.col.chitName', type: 'text' },
      { key: 'groupCode', label: 'reports.col.groupCode', type: 'text' },
      { key: 'status', label: 'reports.col.status', type: 'badge', align: 'center' },
      { key: 'chitValue', label: 'reports.col.value', type: 'currency', align: 'right', total: true },
      { key: 'members', label: 'reports.col.members', type: 'number', align: 'right', total: true },
      { key: 'completionPct', label: 'reports.col.completionPct', type: 'percent', align: 'right' },
      { key: 'collected', label: 'reports.col.collected', type: 'currency', align: 'right', total: true },
      { key: 'outstanding', label: 'reports.col.outstanding', type: 'currency', align: 'right', total: true },
      { key: 'prizesPaid', label: 'reports.col.prizesPaid', type: 'currency', align: 'right', total: true },
      { key: 'commissionEarned', label: 'reports.col.commissionEarned', type: 'currency', align: 'right', total: true },
      { key: 'gstCollected', label: 'reports.col.gstCollected', type: 'currency', align: 'right', total: true },
      { key: 'dividendCash', label: 'reports.col.dividendCash', type: 'currency', align: 'right', total: true },
      { key: 'dividendCredited', label: 'reports.col.dividendCredited', type: 'currency', align: 'right', total: true },
      { key: 'nextAuctionDate', label: 'reports.col.nextAuctionDate', type: 'text', align: 'center' },
    ],
    rows,
    totals: {
      chitValue: total(rows, 'chitValue'),
      members: total(rows, 'members'),
      collected: total(rows, 'collected'),
      outstanding: total(rows, 'outstanding'),
      prizesPaid: total(rows, 'prizesPaid'),
      commissionEarned: total(rows, 'commissionEarned'),
      gstCollected: total(rows, 'gstCollected'),
      dividendCash: total(rows, 'dividendCash'),
      dividendCredited: total(rows, 'dividendCredited'),
    },
    kpis: [
      { label: 'groups', value: rows.length },
      { label: 'totalCollected', value: total(rows, 'collected') },
      { label: 'totalOutstanding', value: total(rows, 'outstanding') },
      { label: 'totalPrizesPaid', value: total(rows, 'prizesPaid') },
    ],
    meta: { currencySymbol: '₹' },
  };
}
