import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail , failFromError} from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { getTopBids, getWinningBid } from '@/lib/chits/auction';
import { drawLotteryWinner, formatDrawEvidence } from '@/lib/chits/lottery';
import { finalizeAuctionInTx } from '@/lib/chits/finalize';

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
        chitGroup: { tenantId: ctx.tenantId, appType: 'chitfunds', ...scopedBranchWhere(ctx), deletedAt: null },
      },
      include: {
        chitGroup: { include: { branch: true } },
        bids: { include: { member: { include: { customer: true } } }, orderBy: { bidTime: 'asc' } },
        attendance: true,
      },
    });
    if (!auction) return fail('Auction not found', 404);
    if (['confirmed', 'paid'].includes(auction.status)) return fail('Auction already confirmed', 409);

    const comparableBids = auction.bids.map((bid) => ({ ...bid, bidDiscount: Number(bid.bidDiscount) }));
    let drawEvidence: string | null = null;
    let winningBid = body?.winningBidId
      ? auction.bids.find((bid) => bid.id === body.winningBidId)
      : undefined;
    if (!body?.winningBidId) {
      const topBids = getTopBids(comparableBids);
      if (topBids.length > 1 && auction.chitGroup.tieBreakRule === 'LOTTERY_AMONG_TIED') {
        const uniqueMembers = new Map<string, typeof topBids[number]>();
        for (const bid of topBids) if (!uniqueMembers.has(bid.memberId)) uniqueMembers.set(bid.memberId, bid);
        const draw = drawLotteryWinner({
          auctionId: auction.id,
          candidates: Array.from(uniqueMembers.values()).map((bid) => ({
            memberId: bid.memberId,
            ticketNo: bid.member.ticketNo ?? bid.member.memberNumber.toString(),
            memberName: bid.member.customer.name,
          })),
        });
        winningBid = auction.bids.find((bid) => bid.id === uniqueMembers.get(draw.winner.memberId)?.id);
        drawEvidence = `Tie at highest discount. ${formatDrawEvidence(draw)}`;
      } else {
        const winner = getWinningBid(comparableBids);
        winningBid = winner ? auction.bids.find((bid) => bid.id === winner.id) : undefined;
      }
    }
    if (!winningBid) return fail('At least one valid bid is required', 400);
    if (winningBid.status !== 'valid') return fail('Winning bid must be valid', 400);
    if (winningBid.member.hasWon) return fail('Winner has already won', 400);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await finalizeAuctionInTx(tx, {
        scope: { tenantId: ctx.tenantId, appType: 'chitfunds', userId: ctx.userId },
        auction,
        group: auction.chitGroup,
        branchCode: auction.chitGroup.branch?.code,
        selectedBid: winningBid,
        winnerName: winningBid.member.customer.name,
        winnerTicketNo: winningBid.member.ticketNo,
        presentCount: auction.attendance.filter((entry) => entry.status === 'present' || entry.status === 'proxy').length,
        minutesText: body?.minutesText ?? null,
        drawEvidence,
        auditAction: 'confirm_auction',
      });
      return result.auction;
    });
    return ok(updated);
  } catch (e: any) {
    return failFromError(e, 'Confirm auction failed');
  }
}
