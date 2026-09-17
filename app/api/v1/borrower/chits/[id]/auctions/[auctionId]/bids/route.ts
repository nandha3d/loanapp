import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireBorrowerMobileContext } from '@/lib/api/borrower-mobile';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import { findOwnLiveAuction } from '@/lib/chits/customerAuction';
import { placeChitBid, type ChitBidSource } from '@/lib/chits/bidService';

// Customer places a bid for their OWN ticket only — memberId is always
// resolved server-side from the authenticated customer, never taken from the
// request body. Delegates the actual validation/write to placeChitBid, the
// same shared service the staff web/mobile bid routes use.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const borrower = await requireBorrowerMobileContext(req);
  if (!borrower) return fail('Unauthorized', 401);
  const { id, auctionId } = await params;

  const body = (await req.json().catch(() => null)) as any;
  const prizeAmount = Number(body?.prizeAmount);
  const idempotencyKey = body?.idempotencyKey ? String(body.idempotencyKey) : '';
  const source: ChitBidSource = body?.source === 'voice' ? 'voice' : 'tap';
  const transcript = body?.transcript ? String(body.transcript).slice(0, 500) : null;
  if (!Number.isFinite(prizeAmount) || prizeAmount <= 0) return fail('A valid prizeAmount is required', 400);
  if (!idempotencyKey) return fail('idempotencyKey is required', 400);

  const rl = await checkRateLimit(routeKey('borrower-mobile:chit-bid', getClientIp(req)), {
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (!rl.allowed) return fail('Too many bid attempts — slow down', 429);

  try {
    const found = await findOwnLiveAuction(borrower.customerId, borrower.tenantId, id, auctionId);
    if (!found) return fail('Auction not found', 404);
    const { member, auction } = found;

    if (auction.chitGroup.roomAdmission === 'approval') {
      const attendance = await prisma.chitAuctionAttendance.findUnique({
        where: { auctionId_memberId: { auctionId, memberId: member.id } },
        select: { admissionStatus: true },
      });
      if (attendance?.admissionStatus !== 'admitted') {
        return fail('Wait for the organizer to admit you to the room before bidding', 403);
      }
    }

    const bid = await prisma.$transaction((tx) =>
      placeChitBid(tx, {
        auction,
        member,
        prizeAmount,
        source,
        transcript,
        idempotencyKey,
        createdById: null,
        tenantId: borrower.tenantId,
      }),
    );
    return ok(bid);
  } catch (e: any) {
    return fail(e?.message ?? 'Bid failed', 400);
  }
}
