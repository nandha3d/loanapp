import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { releaseChitPrizePayout } from '@/lib/chits/payout';
import { assertCanReleasePrizePayout } from '@/lib/chits/security';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id, auctionId } = await params;
  const body = await req.json().catch(() => ({})) as any;

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
    const security = await prisma.chitSecurity.findFirst({ where: { auctionId }, orderBy: { updatedAt: 'desc' } });
    assertCanReleasePrizePayout({
      auctionStatus: auction.status,
      payoutStatus: auction.payoutStatus,
      securityStatus: security?.status,
      winnerMemberId: auction.winnerMemberId,
      prizeAmount: auction.prizeAmount ? Number(auction.prizeAmount) : null,
    });
    const result = await prisma.$transaction(async (tx) => {
      const payout = await releaseChitPrizePayout(tx, {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        branchId: auction.chitGroup.branchId,
        auctionId,
        amount: Number(auction.prizeAmount),
        periodNumber: auction.periodNumber,
        userId: ctx.userId,
        paymentMode: body?.paymentMode ?? 'cash',
        referenceNo: body?.referenceNo ?? null,
        notes: body?.notes ?? null,
      });
      const updated = await tx.chitAuction.update({ where: { id: auctionId }, data: { payoutStatus: 'paid', status: 'paid' } });
      return { ...payout, auction: updated };
    });
    return ok(result);
  } catch (e: any) {
    return fail(e?.message ?? 'Payout failed', 500);
  }
}
