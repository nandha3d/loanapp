import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { assertValidPrizeAmount } from '@/lib/chits/validation';

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
  const memberId = body?.memberId ? String(body.memberId) : '';
  const prizeAmount = Number(body?.prizeAmount);
  if (!memberId || !Number.isFinite(prizeAmount)) return fail('memberId and prizeAmount are required', 400);

  try {
    const auction = await prisma.chitAuction.findFirst({
      where: {
        id: auctionId,
        chitGroupId: id,
        chitGroup: { tenantId: ctx.tenantId, appType: ctx.appType, ...scopedBranchWhere(ctx), deletedAt: null },
      },
      include: { chitGroup: true },
    });
    if (!auction) return fail('Auction not found', 404);
    if (['confirmed', 'paid', 'cancelled'].includes(auction.status)) return fail('Auction is locked', 409);
    const member = await prisma.chitMember.findFirst({ where: { id: memberId, chitGroupId: id } });
    if (!member) return fail('Member not found', 404);
    if (member.hasWon) return fail('Member has already won', 400);
    assertValidPrizeAmount({
      chitValue: Number(auction.chitGroup.chitValue),
      prizeAmount,
      maxDiscountPct: auction.chitGroup.maxDiscountPct ? Number(auction.chitGroup.maxDiscountPct) : null,
      minDiscountPct: auction.chitGroup.minDiscountPct ? Number(auction.chitGroup.minDiscountPct) : null,
      commissionPct: Number(auction.chitGroup.commissionPct),
    });

    const bid = await prisma.chitBid.create({
      data: {
        tenantId: ctx.tenantId,
        branchId: auction.chitGroup.branchId,
        auctionId,
        chitGroupId: id,
        memberId,
        bidAmount: prizeAmount,
        bidDiscount: Number(auction.chitGroup.chitValue) - prizeAmount,
        remarks: body?.remarks ?? null,
        createdById: ctx.userId,
      },
    });
    await prisma.chitAuction.update({
      where: { id: auctionId },
      data: { status: auction.status === 'pending' ? 'in_progress' : auction.status, startedAt: auction.startedAt ?? new Date() },
    });
    return ok(bid);
  } catch (e: any) {
    return fail(e?.message ?? 'Bid failed', 500);
  }
}
