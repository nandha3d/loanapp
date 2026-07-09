import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { loadScopedGroup, ensureAuction, LIVE_WRITE_ROLES } from '@/lib/chit/liveAuction';

// POST /api/v1/chits/[id]/auctions/[period]/join — enter the live room.
// Upserts attendance (presence) for the joining member. Group policy 'auto'
// admits instantly; 'approval' parks the member in the waiting room until the
// organizer decides. Staff callers are always admitted themselves; they may
// pass { memberId } to join a subscriber who is present in the hall.
export async function POST(
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
    const isStaff = LIVE_WRITE_ROLES.includes(ctx.role);

    const body = await req.json().catch(() => ({}));
    let memberId = body.memberId ? String(body.memberId) : '';

    if (!memberId) {
      // Non-staff (M3 borrower) — resolve their own membership via the linked
      // customer account.
      const member = await prisma.chitMember.findFirst({
        where: { chitGroupId: id, customer: { userId: ctx.userId } },
        select: { id: true },
      });
      memberId = member?.id ?? '';
    }

    // A staff viewer without a member to seat is simply admitted as organizer.
    if (!memberId) {
      if (isStaff) return ok({ admissionStatus: 'admitted', role: 'organizer' });
      return fail('You are not a member of this chit group', 403);
    }

    const member = await prisma.chitMember.findFirst({
      where: { id: memberId, chitGroupId: id },
      select: { id: true },
    });
    if (!member) return fail('Member not in this chit group', 404);

    const auction = await ensureAuction(id, periodNumber);
    const admissionStatus = group.roomAdmission === 'approval' && !isStaff ? 'waiting' : 'admitted';

    const attendance = await prisma.chitAuctionAttendance.upsert({
      where: { auctionId_memberId: { auctionId: auction.id, memberId } },
      create: {
        tenantId: ctx.tenantId,
        branchId: group.branchId,
        auctionId: auction.id,
        memberId,
        status: 'present',
        admissionStatus,
        markedById: ctx.userId,
      },
      // Re-joining never downgrades an admitted/denied decision back to waiting.
      update: { status: 'present', markedById: ctx.userId },
      select: { admissionStatus: true },
    });

    return ok({ admissionStatus: attendance.admissionStatus, memberId });
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to join room', 500);
  }
}
