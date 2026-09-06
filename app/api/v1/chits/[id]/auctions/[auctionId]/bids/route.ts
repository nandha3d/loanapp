import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail , failFromError} from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { placeChitBid, type ChitBidSource } from '@/lib/chits/bidService';

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
  const source: ChitBidSource = ['tap', 'voice', 'remote'].includes(body?.source) ? body.source : 'tap';
  const transcript = typeof body?.transcript === 'string' ? body.transcript.slice(0, 500) : null;
  const audioDocumentId = body?.audioDocumentId ? String(body.audioDocumentId) : null;
  const idempotencyKey = body?.idempotencyKey ? String(body.idempotencyKey) : null;

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
    const member = await prisma.chitMember.findFirst({ where: { id: memberId, chitGroupId: id } });
    if (!member) return fail('Member not found', 404);

    const bid = await prisma.$transaction(async (tx) => {
      return placeChitBid(tx, {
        auction,
        member,
        prizeAmount,
        remarks: body?.remarks ?? null,
        source,
        transcript,
        audioDocumentId,
        idempotencyKey,
        createdById: ctx.userId,
        tenantId: ctx.tenantId,
      });
    });
    return ok(bid);
  } catch (e: any) {
    // placeChitBid throws user-actionable business errors (invalid discount,
    // room not open, member already won, bid-increment, …) — surface them as a
    // 400 with the message rather than a generic 500.
    return fail(e?.message ?? 'Bid failed', 400);
  }
}
