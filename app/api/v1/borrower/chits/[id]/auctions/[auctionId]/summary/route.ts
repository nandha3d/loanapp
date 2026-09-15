import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireBorrowerMobileContext } from '@/lib/api/borrower-mobile';
import { buildWinnerSummary } from '@/lib/chits/winnerSummary';

// Member-audience winner summary — memberId resolved from the borrower
// session only (never trust a request-supplied memberId). Unlike the live-
// room routes, this is NOT restricted to auctionType='open_live': any
// confirmed auction (manual/sealed/live/lottery/fixed_rotation) can be
// summarized once it's done.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const borrower = await requireBorrowerMobileContext(req);
  if (!borrower) return fail('Unauthorized', 401);
  const { id, auctionId } = await params;

  try {
    const member = await prisma.chitMember.findFirst({
      where: {
        customerId: borrower.customerId,
        chitGroupId: id,
        chitGroup: { tenantId: borrower.tenantId, appType: 'chitfunds', deletedAt: null },
      },
      select: { id: true },
    });
    if (!member) return fail('You are not a member of this chit group', 404);

    const auction = await prisma.chitAuction.findFirst({
      where: { id: auctionId, chitGroupId: id },
      select: { id: true },
    });
    if (!auction) return fail('Auction not found', 404);

    const summary = await buildWinnerSummary(auctionId, { audience: 'member', memberId: member.id });
    if (!summary) return fail('Auction not confirmed yet', 404);
    return ok(summary);
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to load winner summary', 500);
  }
}
