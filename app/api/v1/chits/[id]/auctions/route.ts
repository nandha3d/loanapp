import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

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
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!group) return fail('Chit group not found', 404);

    const auctions = await prisma.chitAuction.findMany({
      where: { chitGroupId: id },
      include: {
        winnerMember: {
          include: { customer: { select: { customerCode: true, name: true } } },
        },
      },
      orderBy: { periodNumber: 'asc' },
    });
    return ok(auctions);
  } catch (e: any) {
    return fail(e?.message ?? 'Auctions failed', 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }
  const { id } = await params;

  try {
    const body = await req.json();
    const periodNumber = Number(body.periodNumber);
    const winnerMemberId = body.winnerMemberId ? String(body.winnerMemberId) : null;
    const prizeAmount = body.prizeAmount ? Number(body.prizeAmount) : null;
    const bidDiscount = body.bidDiscount ? Number(body.bidDiscount) : null;
    if (!periodNumber) return fail('periodNumber required', 400);

    const group = await prisma.chitGroup.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, commissionPct: true, chitValue: true, totalMembers: true, branchId: true },
    });
    if (!group) return fail('Chit group not found', 404);

    // Whether this period was already settled — so we don't double-post the payout.
    const existing = await prisma.chitAuction.findUnique({
      where: { chitGroupId_periodNumber: { chitGroupId: id, periodNumber } },
      select: { status: true },
    });
    const wasCompleted = existing?.status === 'completed';

    const commission = prizeAmount
      ? Math.round((prizeAmount * Number(group.commissionPct)) / 100)
      : null;
    const dividend =
      prizeAmount && commission
        ? Math.round((Number(group.chitValue) - prizeAmount - commission) / group.totalMembers)
        : null;

    const auction = await prisma.chitAuction.upsert({
      where: { chitGroupId_periodNumber: { chitGroupId: id, periodNumber } },
      create: {
        chitGroupId: id,
        periodNumber,
        auctionDate: new Date(),
        winnerMemberId,
        prizeAmount,
        bidDiscount,
        commission,
        dividend,
        status: winnerMemberId ? 'completed' : 'pending',
      },
      update: {
        winnerMemberId,
        prizeAmount,
        bidDiscount,
        commission,
        dividend,
        status: winnerMemberId ? 'completed' : 'pending',
      },
    });

    if (winnerMemberId) {
      await prisma.chitMember.update({
        where: { id: winnerMemberId },
        data: { hasWon: true, wonAt: new Date() },
      });
    }

    // Prize paid to the winner = cash out → accounting payout + branch pool debit
    // (parity with the web recordAuctionWinner). Only on first settlement.
    if (winnerMemberId && prizeAmount && prizeAmount > 0 && !wasCompleted) {
      await prisma.$transaction(async (tx) => {
        await tx.accountEntry.create({
          data: {
            tenantId: ctx.tenantId,
            entryDate: new Date(),
            type: 'chit_payout',
            category: 'cash',
            amount: prizeAmount,
            description: `Chit prize payout — period ${periodNumber}`,
            referenceId: auction.id,
            referenceType: 'chit_auction',
            createdBy: ctx.userId,
            branchId: group.branchId || undefined,
          },
        });
        if (group.branchId) {
          const { chitPayoutFromBranch } = await import('@/lib/wallet');
          await chitPayoutFromBranch(tx, { tenantId: ctx.tenantId, branchId: group.branchId, amount: prizeAmount, refId: auction.id, byUserId: ctx.userId });
        }
      });
    }

    return ok(auction);
  } catch (e: any) {
    return fail(e?.message ?? 'Auction save failed', 500);
  }
}
