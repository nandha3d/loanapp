import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { calculateChitAuction } from '@/lib/chits/calculations';
import { assertValidPrizeAmount } from '@/lib/chits/validation';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  try {
    const group = await prisma.chitGroup.findFirst({
      where: { id, tenantId: ctx.tenantId, appType: ctx.appType, ...scopedBranchWhere(ctx), deletedAt: null },
      select: { id: true },
    });
    if (!group) return fail('Chit group not found', 404);
    const auctions = await prisma.chitAuction.findMany({
      where: { chitGroupId: id },
      include: {
        winnerMember: { include: { customer: { select: { id: true, name: true, phone: true } } } },
        bids: { orderBy: { bidTime: 'asc' } },
        attendance: true,
      },
      orderBy: { periodNumber: 'asc' },
    });
    return ok(auctions);
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to load auctions', 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id } = await params;

  try {
    const body = await req.json();
    const periodNumber = Number(body?.periodNumber);
    const winnerMemberId = body?.winnerMemberId ? String(body.winnerMemberId) : null;
    const prizeAmount = body?.prizeAmount == null ? null : Number(body.prizeAmount);
    if (!Number.isInteger(periodNumber)) return fail('periodNumber is required', 400);

    const group = await prisma.chitGroup.findFirst({
      where: { id, tenantId: ctx.tenantId, appType: ctx.appType, ...scopedBranchWhere(ctx), deletedAt: null },
      select: {
        id: true,
        branchId: true,
        chitValue: true,
        totalMembers: true,
        commissionPct: true,
        maxDiscountPct: true,
        minDiscountPct: true,
        dividendPolicy: true,
        dividendDistribution: true,
        commissionBasis: true,
        gstPct: true,
        dividendRounding: true,
      },
    });
    if (!group) return fail('Chit group not found', 404);

    const auction = await prisma.chitAuction.findUnique({
      where: { chitGroupId_periodNumber: { chitGroupId: id, periodNumber } },
    });
    if (!auction) return fail('Auction not found; activate the chit group first', 404);

    if (!winnerMemberId || !prizeAmount) return ok(auction);
    const winner = await prisma.chitMember.findFirst({ where: { id: winnerMemberId, chitGroupId: id } });
    if (!winner) return fail('Winner member not found', 404);
    if (winner.hasWon) return fail('Winner has already won', 400);
    assertValidPrizeAmount({
      chitValue: Number(group.chitValue),
      prizeAmount,
      maxDiscountPct: group.maxDiscountPct ? Number(group.maxDiscountPct) : null,
      minDiscountPct: group.minDiscountPct ? Number(group.minDiscountPct) : null,
      commissionPct: Number(group.commissionPct),
    });
    const calc = calculateChitAuction({
      chitValue: Number(group.chitValue),
      prizeAmount,
      commissionPct: Number(group.commissionPct),
      totalMembers: group.totalMembers,
      dividendPolicy: group.dividendPolicy as any,
      commissionBasis: group.commissionBasis as any,
      gstPct: group.gstPct ? Number(group.gstPct) : null,
      dividendRounding: group.dividendRounding,
    });

    const updated = await prisma.$transaction(async (tx) => {
      const bid = await tx.chitBid.create({
        data: {
          tenantId: ctx.tenantId,
          branchId: group.branchId,
          auctionId: auction.id,
          chitGroupId: id,
          memberId: winnerMemberId,
          bidAmount: prizeAmount,
          bidDiscount: calc.bidDiscount,
          status: 'winning',
          remarks: 'Recorded from legacy mobile auction endpoint',
          createdById: ctx.userId,
        },
      });
      const saved = await tx.chitAuction.update({
        where: { id: auction.id },
        data: {
          winnerMemberId,
          prizeAmount: calc.prizeAmount,
          bidDiscount: calc.bidDiscount,
          commission: calc.commission,
          dividend: calc.dividend,
          gstAmount: calc.gstAmount,
          roundingIncome: calc.roundingIncome,
          status: 'confirmed',
          payoutStatus: 'security_pending',
          confirmedById: ctx.userId,
          confirmedAt: new Date(),
          completedAt: new Date(),
        },
      });
      await tx.chitMember.update({ where: { id: winnerMemberId }, data: { hasWon: true, wonAt: new Date() } });
      await tx.chitSecurity.create({
        data: {
          tenantId: ctx.tenantId,
          branchId: group.branchId,
          chitGroupId: id,
          auctionId: auction.id,
          winnerMemberId,
          status: 'pending',
        },
      });
      return { ...saved, winningBidId: bid.id };
    });
    return ok(updated);
  } catch (e: any) {
    return fail(e?.message ?? 'Auction update failed', 500);
  }
}
