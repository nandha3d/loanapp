import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { resolveNonAuctionPeriodInTx } from '@/lib/chits/groupService';

// Resolves a non-auction period (lottery, fixed rotation, reserve-floor fallback,
// consensus, gold/commodity, chart, fixed-dividend, hybrid phase 1, custom schedule).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id, auctionId } = await params;
  const body = (await req.json().catch(() => ({}))) as any;

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
    if (['confirmed', 'paid', 'cancelled'].includes(auction.status)) return fail('Auction is locked', 409);

    const resolved = await prisma.$transaction(async (tx) => {
      return resolveNonAuctionPeriodInTx(tx, {
        scope: { tenantId: ctx.tenantId, appType: 'chitfunds', userId: ctx.userId },
        auction,
        group: auction.chitGroup,
        branchCode: auction.chitGroup.branch?.code,
        presentCount: auction.attendance.filter((entry) => entry.status === 'present' || entry.status === 'proxy').length,
        selectedMemberId: body?.memberId ? String(body.memberId) : null,
        consensusReason: body?.consensusReason ? String(body.consensusReason) : null,
        goldRatePerGram: body?.goldRatePerGram != null ? Number(body.goldRatePerGram) : null,
      });
    });

    return ok({
      auctionId: resolved.auction.id,
      winnerMemberId: resolved.auction.winnerMemberId,
      winnerName: resolved.winnerMember.customer.name,
      ticketNo: resolved.winnerMember.ticketNo,
      prizeAmount: Number(resolved.auction.prizeAmount),
      bidDiscount: Number(resolved.auction.bidDiscount),
      drawEvidence: resolved.drawEvidence,
    });
  } catch (e: any) {
    const msg = e?.message ?? 'Draw failed';
    const isClient = /only available|required|eligible|use confirm/i.test(msg);
    return fail(msg, isClient ? 400 : 500);
  }
}
