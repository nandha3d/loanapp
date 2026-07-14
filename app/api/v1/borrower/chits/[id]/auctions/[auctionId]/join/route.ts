import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireBorrowerMobileContext } from '@/lib/api/borrower-mobile';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import { findOwnLiveAuction } from '@/lib/chits/customerAuction';

// Customer joins the live-room lobby for their own ticket. Parks them in
// 'waiting' when the group requires organizer approval, else auto-admits —
// mirrors ChitGroup.roomAdmission / ChitAuctionAttendance.admissionStatus,
// the same fields the staff waiting-room panel already reads/writes.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const borrower = await requireBorrowerMobileContext(req);
  if (!borrower) return fail('Unauthorized', 401);
  const { id, auctionId } = await params;

  const rl = await checkRateLimit(routeKey('borrower-mobile:chit-join', getClientIp(req)), {
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.allowed) return fail('Too many join attempts — try again shortly', 429);

  try {
    const found = await findOwnLiveAuction(borrower.customerId, borrower.tenantId, id, auctionId);
    if (!found) return fail('Auction not found', 404);
    const { member, auction } = found;

    if (auction.roomStatus === 'closed' || ['confirmed', 'paid', 'cancelled'].includes(auction.status)) {
      return fail('This auction is no longer accepting members', 400);
    }
    if (member.hasWon) return fail('This ticket has already won and cannot rejoin', 400);

    const admissionStatus = auction.chitGroup.roomAdmission === 'approval' ? 'waiting' : 'admitted';
    const existing = await prisma.chitAuctionAttendance.findUnique({
      where: { auctionId_memberId: { auctionId, memberId: member.id } },
    });

    let attendance;
    if (!existing) {
      attendance = await prisma.chitAuctionAttendance.create({
        data: {
          tenantId: borrower.tenantId,
          branchId: auction.chitGroup.branchId,
          auctionId,
          memberId: member.id,
          status: 'present',
          admissionStatus,
          markedVia: 'room_join',
        },
      });
    } else if (existing.admissionStatus === 'none') {
      // Doc 18: a login-only mark ('none') escalates to waiting/admitted on
      // an actual room join — but a staff decision (waiting/admitted/denied)
      // must never be touched here.
      attendance = await prisma.chitAuctionAttendance.update({
        where: { id: existing.id },
        data: { admissionStatus, status: 'present', markedVia: 'room_join' },
      });
    } else {
      attendance = existing;
    }
    return ok({ admissionStatus: attendance.admissionStatus });
  } catch (e: any) {
    return fail(e?.message ?? 'Join failed', 500);
  }
}
