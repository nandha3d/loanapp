import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildChitGroupReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, branchId, status } = params;

  const branchFilter = branchId ? { branchId } : {};

  const groups = await prisma.chitGroup.findMany({
    where: {
      tenantId,
      appType: 'chitfunds',
      ...branchFilter,
      deletedAt: null,
      ...(status ? { status } : {}),
    },
    include: {
      members: { select: { id: true } },
      auctions: {
        select: { periodNumber: true, prizeAmount: true, status: true },
      },
    },
    orderBy: { startDate: 'desc' },
  });

  // Subscription totals (collected) per chit group, computed via members.
  const groupIds = groups.map((g) => g.id);
  const subsByGroup = new Map<string, { collected: number }>();
  if (groupIds.length > 0) {
    const members = await prisma.chitMember.findMany({
      where: { chitGroupId: { in: groupIds } },
      select: {
        chitGroupId: true,
        subscriptions: { select: { paidAmount: true } },
      },
    });
    for (const m of members) {
      const entry = subsByGroup.get(m.chitGroupId) || { collected: 0 };
      entry.collected += m.subscriptions.reduce((sum, s) => sum + Number(s.paidAmount), 0);
      subsByGroup.set(m.chitGroupId, entry);
    }
  }

  let totalChitValue = 0;
  let totalCollected = 0;
  let totalMembers = 0;
  let activeCount = 0;

  const rows = groups.map((g) => {
    const chitValue = Number(g.chitValue);
    const memberCount = g.members.length;
    const collected = subsByGroup.get(g.id)?.collected || 0;
    const completedAuctions = g.auctions.filter((a) => a.status === 'completed' || a.status === 'won');
    const disbursed = completedAuctions.reduce((sum, a) => sum + Number(a.prizeAmount || 0), 0);
    const currentMonth = `${completedAuctions.length}/${g.durationMonths}`;

    totalChitValue += chitValue;
    totalCollected += collected;
    totalMembers += memberCount;
    if (g.status === 'active') activeCount++;

    return {
      chitName: g.name,
      chitValue,
      memberCount,
      currentMonth,
      collected,
      disbursed,
      status: g.status,
    };
  });

  return {
    title: 'reports.chitGroup.title',
    columns: [
      { key: 'chitName', label: 'reports.col.chitName', align: 'left', type: 'text' },
      { key: 'chitValue', label: 'reports.col.value', align: 'right', type: 'currency', total: true },
      { key: 'memberCount', label: 'reports.col.members', align: 'right', type: 'number', total: true },
      { key: 'currentMonth', label: 'reports.col.month', align: 'center', type: 'text' },
      { key: 'collected', label: 'reports.col.collected', align: 'right', type: 'currency', total: true },
      { key: 'disbursed', label: 'reports.col.disbursed', align: 'right', type: 'currency', total: true },
      { key: 'status', label: 'reports.col.status', align: 'center', type: 'badge' },
    ],
    rows,
    totals: {
      chitValue: totalChitValue,
      memberCount: totalMembers,
      collected: totalCollected,
      disbursed: rows.reduce((sum, r) => sum + r.disbursed, 0),
    },
    kpis: [
      { label: 'activeChits', value: activeCount },
      { label: 'totalChitValue', value: totalChitValue },
      { label: 'totalCollected', value: totalCollected },
      { label: 'members', value: totalMembers },
    ],
    meta: { currencySymbol: '₹' },
  };
}
