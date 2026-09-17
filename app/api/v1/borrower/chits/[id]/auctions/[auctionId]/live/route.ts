import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireBorrowerMobileContext } from '@/lib/api/borrower-mobile';
import { findOwnLiveAuction, buildCustomerLiveState } from '@/lib/chits/customerAuction';

// Customer live-room poll (2-3s cadence, same convention as the staff route).
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

    const state = await buildCustomerLiveState(id, auctionId, found.member.id);
    if (!state) return fail('Auction not found', 404);
    return ok(state);
  } catch (e: any) {
    return fail(e?.message ?? 'Live room fetch failed', 500);
  }
}
