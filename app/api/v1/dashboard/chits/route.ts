import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

// Chit-funds home dashboard for the mobile app — the chit counterpart of
// GET /api/v1/dashboard (which is lending-only). Mirrors the web module
// dashboard's getChitFundsDashboardData and adds the upcoming-auction list
// the mobile live room needs as an entry point.
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  // Anchor "today" to IST — same business-day boundary as the lending
  // dashboard (VPS runs UTC; an evening IST payment must not slip a day).
  const IST_OFFSET_MS = 330 * 60 * 1000;
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const istMidnightUtcMs =
    Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) -
    IST_OFFSET_MS;
  const today = new Date(istMidnightUtcMs);
  const tomorrow = new Date(istMidnightUtcMs + 24 * 60 * 60 * 1000);
  const monthStart = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1) - IST_OFFSET_MS);

  const baseGroup: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    ...scopedBranchWhere(ctx),
    deletedAt: null,
  };
  const memberScope = { chitGroup: baseGroup };

  try {
    const [
      activeGroups,
      totalMembers,
      auctionsThisMonth,
      pendingApprovals,
      todaySubscriptions,
      overdueRows,
      collectedTodayAgg,
      upcomingAuctions,
      liveAuctions,
      groupsList,
    ] = await Promise.all([
      prisma.chitGroup.count({ where: { ...baseGroup, status: 'active' } }),
      prisma.chitMember.count({ where: memberScope }),
      prisma.chitAuction.count({
        where: {
          chitGroup: baseGroup,
          auctionDate: { gte: monthStart, lt: tomorrow },
          status: 'completed',
        },
      }),
      prisma.approvalRequest.count({
        where: { tenantId: ctx.tenantId, appType: ctx.appType, status: 'pending' },
      }),
      prisma.chitSubscription.findMany({
        where: { member: memberScope, dueDate: { gte: today, lt: tomorrow } },
        select: { dueAmount: true, paidAmount: true },
      }),
      prisma.chitSubscription.findMany({
        where: {
          member: memberScope,
          dueDate: { lt: today },
          status: { notIn: ['paid', 'waived'] },
        },
        select: {
          id: true,
          dueDate: true,
          dueAmount: true,
          paidAmount: true,
          periodNumber: true,
          memberId: true,
          member: {
            select: {
              chitGroup: { select: { id: true, name: true } },
              customer: {
                select: { id: true, name: true, customerCode: true, profilePhoto: true },
              },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
      // Actual cash taken today — every chit contribution receipt posts an
      // AccountEntry(type 'collection', referenceType 'chit_subscription').
      prisma.accountEntry.aggregate({
        where: {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          type: 'collection',
          referenceType: 'chit_subscription',
          entryDate: { gte: today, lt: tomorrow },
          ...scopedBranchWhere(ctx),
        },
        _sum: { amount: true },
      }),
      prisma.chitAuction.findMany({
        where: {
          chitGroup: { ...baseGroup, status: 'active' },
          status: { not: 'completed' },
          auctionDate: { gte: today },
        },
        select: {
          id: true,
          periodNumber: true,
          auctionDate: true,
          scheduledAt: true,
          biddingOpensAt: true,
          roomStatus: true,
          status: true,
          chitGroup: { select: { id: true, name: true, chitValue: true } },
        },
        orderBy: { auctionDate: 'asc' },
        take: 5,
      }),
      // Rooms live right now (auctionDate may be today or slipped past).
      prisma.chitAuction.findMany({
        where: { chitGroup: { ...baseGroup, status: 'active' }, roomStatus: 'live' },
        select: {
          id: true,
          periodNumber: true,
          roomStatus: true,
          chitGroup: { select: { id: true, name: true, chitValue: true } },
        },
        take: 5,
      }),
      prisma.chitGroup.findMany({
        where: { ...baseGroup, status: 'active' },
        select: {
          id: true,
          name: true,
          groupCode: true,
          chitValue: true,
          monthlyContrib: true,
          totalMembers: true,
          durationMonths: true,
          startDate: true,
          _count: { select: { members: true } },
          auctions: {
            where: { status: 'completed' },
            select: { periodNumber: true },
            orderBy: { periodNumber: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const todayExpected = todaySubscriptions.reduce(
      (sum, s) => sum + Number(s.dueAmount), 0);
    const todayScheduledCollected = todaySubscriptions.reduce(
      (sum, s) => sum + Math.min(Number(s.paidAmount), Number(s.dueAmount)), 0);
    const collectedToday = Number(collectedTodayAgg._sum.amount ?? 0);
    const todayGap = Math.max(0, todayExpected - Math.min(collectedToday, todayExpected));
    const hitRate = todayExpected > 0
      ? Math.round((Math.min(collectedToday, todayExpected) / todayExpected) * 100)
      : 0;

    const dayMs = 24 * 60 * 60 * 1000;
    const overdueSubscriptions = overdueRows
      .map((s) => ({
        id: s.id,
        customerId: s.member.customer.id,
        customerName: s.member.customer.name,
        customerCode: s.member.customer.customerCode,
        customerPhoto: s.member.customer.profilePhoto ?? null,
        chitGroupId: s.member.chitGroup.id,
        chitGroupName: s.member.chitGroup.name,
        periodNumber: s.periodNumber,
        dueDate: s.dueDate,
        overdueAmount: Math.max(0, Number(s.dueAmount) - Number(s.paidAmount)),
        daysOverdue: Math.max(0, Math.floor((today.getTime() - new Date(s.dueDate).getTime()) / dayMs)),
        memberId: s.memberId,
      }))
      .filter((s) => s.overdueAmount > 0);

    const totalOverdueAmount = overdueSubscriptions.reduce((sum, s) => sum + s.overdueAmount, 0);
    const overdueMembersCount = new Set(overdueSubscriptions.map((s) => s.memberId)).size;

    return ok({
      activeGroups,
      totalMembers,
      auctionsThisMonth,
      pendingApprovals,
      todayExpected,
      todayCollected: collectedToday,
      todayScheduledCollected,
      todayGap,
      hitRate,
      totalOverdueAmount,
      overdueMembersCount,
      overdueSubscriptions: overdueSubscriptions.slice(0, 10),
      liveAuctions: liveAuctions.map((a) => ({
        id: a.id,
        chitGroupId: a.chitGroup.id,
        chitGroupName: a.chitGroup.name,
        chitValue: Number(a.chitGroup.chitValue),
        periodNumber: a.periodNumber,
        roomStatus: a.roomStatus,
      })),
      upcomingAuctions: upcomingAuctions.map((a) => ({
        id: a.id,
        chitGroupId: a.chitGroup.id,
        chitGroupName: a.chitGroup.name,
        chitValue: Number(a.chitGroup.chitValue),
        periodNumber: a.periodNumber,
        auctionDate: a.auctionDate,
        scheduledAt: a.scheduledAt ?? a.biddingOpensAt,
        roomStatus: a.roomStatus,
      })),
      groups: groupsList.map((g) => ({
        id: g.id,
        name: g.name,
        groupCode: g.groupCode,
        chitValue: Number(g.chitValue),
        monthlyContrib: Number(g.monthlyContrib),
        totalMembers: g.totalMembers,
        membersCount: g._count.members,
        durationMonths: g.durationMonths,
        currentPeriod: g.auctions[0]?.periodNumber ?? 0,
        startDate: g.startDate,
      })),
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Chit dashboard failed', 500);
  }
}
