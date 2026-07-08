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
    const prizeAmount = body.prizeAmount != null ? Number(body.prizeAmount) : null;
    if (!periodNumber) return fail('periodNumber required', 400);

    const group = await prisma.chitGroup.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!group) return fail('Chit group not found', 404);

    // Ensure the auction row exists (chit creation seeds a stub per period, but
    // be safe for legacy groups). We never write money math inline here — when a
    // winner is provided we defer to the single source of truth so mobile
    // settles identically to web (dividend ÷ members-1, commission off the
    // discount, plus reducing every non-winner's future dues — all of which the
    // old inline math got wrong or skipped). The settle helper is idempotent.
    const auction = await prisma.chitAuction.upsert({
      where: { chitGroupId_periodNumber: { chitGroupId: id, periodNumber } },
      create: { chitGroupId: id, periodNumber, auctionDate: new Date(), status: 'pending' },
      update: {},
    });

    if (winnerMemberId && prizeAmount != null) {
      const { settleAuctionWinner } = await import('@/lib/chit/settlement');
      await settleAuctionWinner({
        auctionId: auction.id,
        winnerMemberId,
        prizeAmount,
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        actorUserId: ctx.userId,
      });
    }

    const updated = await prisma.chitAuction.findUnique({ where: { id: auction.id } });
    return ok(updated);
  } catch (e: any) {
    return fail(e?.message ?? 'Auction save failed', 500);
  }
}
