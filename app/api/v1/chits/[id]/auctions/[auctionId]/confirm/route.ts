import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { calculateChitAuction } from '@/lib/chits/calculations';
import { generateAuctionMinutes, getWinningBid } from '@/lib/chits/auction';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id, auctionId } = await params;
  const body = await req.json().catch(() => null) as any;

  try {
    const auction = await prisma.chitAuction.findFirst({
      where: {
        id: auctionId,
        chitGroupId: id,
        chitGroup: { tenantId: ctx.tenantId, appType: ctx.appType, ...scopedBranchWhere(ctx), deletedAt: null },
      },
      include: {
        chitGroup: true,
        bids: { include: { member: { include: { customer: true } } }, orderBy: { bidTime: 'asc' } },
        attendance: true,
      },
    });
    if (!auction) return fail('Auction not found', 404);
    if (['confirmed', 'paid'].includes(auction.status)) return fail('Auction already confirmed', 409);
    const winningBid = body?.winningBidId
      ? auction.bids.find((bid) => bid.id === body.winningBidId)
      : getWinningBid(auction.bids.map((bid) => ({ ...bid, bidDiscount: Number(bid.bidDiscount) })));
    if (!winningBid) return fail('At least one valid bid is required', 400);
    if (winningBid.member.hasWon) return fail('Winner has already won', 400);
    const calc = calculateChitAuction({
      chitValue: Number(auction.chitGroup.chitValue),
      prizeAmount: Number(winningBid.bidAmount),
      commissionPct: Number(auction.chitGroup.commissionPct),
      totalMembers: auction.chitGroup.totalMembers,
      dividendPolicy: auction.chitGroup.dividendPolicy as any,
      commissionBasis: auction.chitGroup.commissionBasis as any,
      gstPct: auction.chitGroup.gstPct ? Number(auction.chitGroup.gstPct) : null,
      dividendRounding: auction.chitGroup.dividendRounding,
    });
    const minutesText = body?.minutesText ?? generateAuctionMinutes({
      groupName: auction.chitGroup.name,
      periodNumber: auction.periodNumber,
      auctionDate: auction.auctionDate,
      totalMembers: auction.chitGroup.totalMembers,
      presentCount: auction.attendance.filter((entry) => entry.status === 'present' || entry.status === 'proxy').length,
      winnerName: winningBid.member.customer.name,
      prizeAmount: calc.prizeAmount,
      bidDiscount: calc.bidDiscount,
      commission: calc.commission,
      dividend: calc.dividend,
    });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.chitBid.updateMany({ where: { auctionId }, data: { status: 'valid' } });
      await tx.chitBid.update({ where: { id: winningBid.id }, data: { status: 'winning' } });
      const saved = await tx.chitAuction.update({
        where: { id: auctionId },
        data: {
          winnerMemberId: winningBid.memberId,
          prizeAmount: calc.prizeAmount,
          bidDiscount: calc.bidDiscount,
          commission: calc.commission,
          dividend: calc.dividend,
          gstAmount: calc.gstAmount,
          roundingIncome: calc.roundingIncome,
          status: 'confirmed',
          payoutStatus: 'security_pending',
          completedAt: new Date(),
          confirmedAt: new Date(),
          confirmedById: ctx.userId,
          minutesText,
        },
      });
      await tx.chitMember.update({ where: { id: winningBid.memberId }, data: { hasWon: true, wonAt: new Date() } });
      await tx.chitSecurity.create({
        data: {
          tenantId: ctx.tenantId,
          branchId: auction.chitGroup.branchId,
          chitGroupId: id,
          auctionId,
          winnerMemberId: winningBid.memberId,
          status: 'pending',
        },
      });
      return saved;
    });
    return ok(updated);
  } catch (e: any) {
    return fail(e?.message ?? 'Confirm auction failed', 500);
  }
}
