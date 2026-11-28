import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { calculateWinnerPayoutSummary, releaseChitPrizePayout } from '@/lib/chits/payout';
import { assertCanReleasePrizePayout } from '@/lib/chits/security';
import { findActiveGuaranteeLock } from '@/lib/chits/groupService';
import { getChitMobileCapabilities } from '@/lib/chits/access';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id, auctionId } = await params;

  try {
    const auction = await prisma.chitAuction.findFirst({
      where: {
        id: auctionId,
        chitGroupId: id,
        chitGroup: { tenantId: ctx.tenantId, appType: 'chitfunds', ...scopedBranchWhere(ctx), deletedAt: null },
      },
      select: { id: true },
    });
    if (!auction) return fail('Auction not found', 404);

    const url = new URL(req.url);
    const deductArrears = url.searchParams.get('deductArrears') !== 'false';
    const waivePenalties = url.searchParams.get('waivePenalties') === 'true';
    const customRaw = url.searchParams.get('customArrearsAmount');
    const customArrearsAmount = customRaw != null && customRaw !== '' ? Number(customRaw) : null;

    const summary = await calculateWinnerPayoutSummary(prisma, ctx.tenantId, auctionId, {
      deductArrears,
      waivePenalties,
      customArrearsAmount,
    });
    return ok(summary);
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to calculate payout summary', 400);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const caps = await getChitMobileCapabilities(ctx);
  if (!caps.canReleasePayout) return fail('Forbidden', 403);
  const { id, auctionId } = await params;
  const body = (await req.json().catch(() => ({}))) as any;

  try {
    const auction = await prisma.chitAuction.findFirst({
      where: {
        id: auctionId,
        chitGroupId: id,
        chitGroup: { tenantId: ctx.tenantId, appType: 'chitfunds', ...scopedBranchWhere(ctx), deletedAt: null },
      },
      include: { chitGroup: true },
    });
    if (!auction) return fail('Auction not found', 404);

    const security = await prisma.chitSecurity.findFirst({
      where: { auctionId },
      orderBy: { updatedAt: 'desc' },
    });
    const activeGuaranteeLock = auction.winnerMemberId
      ? await findActiveGuaranteeLock(prisma, { chitGroupId: id, memberId: auction.winnerMemberId })
      : null;

    assertCanReleasePrizePayout({
      auctionStatus: auction.status,
      payoutStatus: auction.payoutStatus,
      securityStatus: security?.status,
      winnerMemberId: auction.winnerMemberId,
      prizeAmount: auction.prizeAmount ? Number(auction.prizeAmount) : null,
      activeGuaranteeLock,
    });

    const idempotencyKey =
      typeof body?.idempotencyKey === 'string' && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim().slice(0, 191)
        : null;

    const result = await prisma.$transaction(async (tx) => {
      return releaseChitPrizePayout(tx, {
        tenantId: ctx.tenantId,
        appType: 'chitfunds',
        branchId: auction.chitGroup.branchId,
        auctionId,
        amount: Number(auction.prizeAmount),
        periodNumber: auction.periodNumber,
        userId: ctx.userId,
        paymentMode: body?.paymentMode ?? 'cash',
        referenceNo: body?.referenceNo ?? null,
        notes: body?.notes ?? null,
        idempotencyKey,
        cashDenominations: body?.denominationBreakdown ?? body?.cashDenominations ?? null,
        deductArrears: body?.deductArrears !== undefined ? Boolean(body.deductArrears) : true,
        customArrearsAmount:
          body?.customArrearsAmount != null ? Number(body.customArrearsAmount) : null,
        waivePenalties: Boolean(body?.waivePenalties),
        disburseNowAmount:
          body?.disburseNowAmount != null
            ? Number(body.disburseNowAmount)
            : body?.amount != null
              ? Number(body.amount)
              : null,
      });
    });

    return ok(result);
  } catch (e: any) {
    const msg = e?.message ?? 'Payout failed';
    const isClientErr =
      msg.includes('exceeds') ||
      msg.includes('denomination') ||
      msg.includes('Custom arrears') ||
      msg.includes('negative') ||
      msg.includes('greater than zero') ||
      msg.includes('Security must') ||
      msg.includes('not ready') ||
      msg.includes('Jameen');
    return fail(msg, isClientErr ? 400 : 500);
  }
}
