import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireBorrowerMobileContext } from '@/lib/api/borrower-mobile';
import { findOwnLiveAuction } from '@/lib/chits/customerAuction';
import { buildAuctionTimeline } from '@/lib/chits/timeline';

// Member-audience auction timeline — memberId resolved server-side from the
// borrower session only (never trust a request-supplied memberId). Sealed
// auctions still open have bid amounts redacted by buildAuctionTimeline,
// same rule as the live-state poll.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const borrower = await requireBorrowerMobileContext(req);
  if (!borrower) return fail('Unauthorized', 401);
  const { id, auctionId } = await params;

  try {
    const found = await findOwnLiveAuction(borrower.customerId, borrower.tenantId, id, auctionId);
    if (!found) return fail('Auction not found', 404);

    const limit = req.nextUrl.searchParams.get('limit');
    const timeline = await buildAuctionTimeline(auctionId, {
      audience: 'member',
      memberId: found.member.id,
      limit: limit ? Number(limit) : undefined,
    });
    if (!timeline) return fail('Auction not found', 404);
    return ok(timeline);
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to load auction timeline', 500);
  }
}
