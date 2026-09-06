import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail , failFromError} from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { buildAuctionTimeline } from '@/lib/chits/timeline';

// Complete chronological auction activity feed (bids, bells, open/extend/
// close, passes, winner) — staff audience sees everything including
// organizer-only chat. Not part of the hot poll loop; fetched on demand.
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

    const limit = req.nextUrl.searchParams.get('limit');
    const timeline = await buildAuctionTimeline(auctionId, {
      audience: 'staff',
      limit: limit ? Number(limit) : undefined,
    });
    if (!timeline) return fail('Auction not found', 404);
    return ok(timeline);
  } catch (e: any) {
    return failFromError(e, 'Failed to load auction timeline');
  }
}
