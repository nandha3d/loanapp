import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { buildWinnerSummary } from '@/lib/chits/winnerSummary';

// Full post-win summary, staff audience — prize/discount/commission/GST/
// dividend breakdown plus every member's dividend. 404 while the auction is
// still pending/in_progress (not yet confirmed).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id, auctionId } = await params;

  try {
    const exists = await prisma.chitAuction.findFirst({
      where: {
        id: auctionId,
        chitGroupId: id,
        chitGroup: { tenantId: ctx.tenantId, appType: 'chitfunds', ...scopedBranchWhere(ctx), deletedAt: null },
      },
      select: { id: true },
    });
    if (!exists) return fail('Auction not found', 404);

    const summary = await buildWinnerSummary(auctionId, { audience: 'staff' });
    if (!summary) return fail('Auction not confirmed yet', 404);
    return ok(summary);
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to load winner summary', 500);
  }
}
