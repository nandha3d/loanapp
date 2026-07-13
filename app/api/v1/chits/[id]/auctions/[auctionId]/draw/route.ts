import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { calculateFixedDiscountPrize } from '@/lib/chits/calculations';
import { drawLotteryWinner, formatDrawEvidence } from '@/lib/chits/lottery';
import { finalizeAuctionInTx } from '@/lib/chits/finalize';

// Resolves a lottery or fixed_rotation period without bids: lottery uses the
// seed-audited random draw; fixed_rotation takes the lowest unprized ticket.
// Creates a synthetic winning bid at the group's fixed discount so bid history,
// reports, and the security/payout flow behave exactly like auctions.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id, auctionId } = await params;

  try {
    const auction = await prisma.chitAuction.findFirst({
      where: {
        id: auctionId,
        chitGroupId: id,
        chitGroup: { tenantId: ctx.tenantId, appType: 'chitfunds', ...scopedBranchWhere(ctx), deletedAt: null },
      },
      include: { chitGroup: { include: { branch: true } }, attendance: true },
    });
    if (!auction) return fail('Auction not found', 404);
    if (!['lottery', 'fixed_rotation'].includes(auction.chitGroup.auctionType)) {
      return fail('Draw is only available for lottery or fixed rotation chits', 400);
    }
    if (['confirmed', 'paid', 'cancelled'].includes(auction.status)) return fail('Auction is locked', 409);

    const eligible = await prisma.chitMember.findMany({
      where: {
        chitGroupId: id,
        hasWon: false,
        subscriberStatus: 'active',
        ticketNo: { not: null },
      },
      include: { customer: true },
    });
    if (!eligible.length) return fail('No eligible tickets for this period', 400);

    let winnerMember: (typeof eligible)[number];
    let drawEvidence: string;
    if (auction.chitGroup.auctionType === 'lottery') {
      const draw = drawLotteryWinner({
        auctionId: auction.id,
        candidates: eligible.map((member) => ({
          memberId: member.id,
          ticketNo: member.ticketNo as string,
          memberName: member.customer.name,
        })),
      });
      winnerMember = eligible.find((member) => member.id === draw.winner.memberId) as (typeof eligible)[number];
      drawEvidence = formatDrawEvidence(draw);
    } else {
      winnerMember = [...eligible].sort((a, b) =>
        (a.ticketNo as string).localeCompare(b.ticketNo as string, undefined, { numeric: true })
      )[0];
      drawEvidence = `Fixed rotation: ticket ${winnerMember.ticketNo} is next in payout order.`;
    }

    const fixed = calculateFixedDiscountPrize({
      chitValue: Number(auction.chitGroup.chitValue),
      fixedDiscountPct: auction.chitGroup.fixedDiscountPct ? Number(auction.chitGroup.fixedDiscountPct) : 0,
    });

    const updated = await prisma.$transaction(async (tx) => {
      const bid = await tx.chitBid.create({
        data: {
          tenantId: ctx.tenantId,
          branchId: auction.chitGroup.branchId,
          auctionId: auction.id,
          chitGroupId: id,
          memberId: winnerMember.id,
          bidAmount: fixed.prizeAmount,
          bidDiscount: fixed.bidDiscount,
          remarks: drawEvidence,
          createdById: ctx.userId,
        },
      });
      const result = await finalizeAuctionInTx(tx, {
        scope: { tenantId: ctx.tenantId, appType: 'chitfunds', userId: ctx.userId },
        auction,
        group: auction.chitGroup,
        branchCode: auction.chitGroup.branch?.code,
        selectedBid: bid,
        winnerName: winnerMember.customer.name,
        winnerTicketNo: winnerMember.ticketNo,
        presentCount: auction.attendance.filter((entry) => entry.status === 'present' || entry.status === 'proxy').length,
        drawEvidence,
        auditAction: 'draw_winner',
      });
      return result.auction;
    });
    return ok({
      auctionId: updated.id,
      winnerMemberId: updated.winnerMemberId,
      winnerName: winnerMember.customer.name,
      ticketNo: winnerMember.ticketNo,
      prizeAmount: Number(updated.prizeAmount),
      bidDiscount: Number(updated.bidDiscount),
      drawEvidence,
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Draw failed', 500);
  }
}
