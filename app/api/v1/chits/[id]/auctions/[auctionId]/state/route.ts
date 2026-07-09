import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { loadScopedGroup, buildLiveState } from '@/lib/chit/liveAuction';

// GET /api/v1/chits/[id]/auctions/[period]/state — hot polling path. Any
// authenticated tenant user may read (spectators). Returns serverNow so the
// countdown is server-authoritative regardless of device clock skew.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id, auctionId } = await params;
  const periodNumber = Number(auctionId);
  if (!periodNumber) return fail('Invalid period', 400);

  try {
    const group = await loadScopedGroup(id, ctx);
    if (!group) return fail('Chit group not found', 404);
    return ok(await buildLiveState(group, periodNumber));
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to load auction state', 500);
  }
}
