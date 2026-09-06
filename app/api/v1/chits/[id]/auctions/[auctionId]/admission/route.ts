import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail , failFromError} from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

// Organizer admit/deny for a customer waiting in the live-room lobby (mobile
// counterpart of the web dashboard's decideRoomAdmission server action —
// duplicated rather than shared because that action reads the web session,
// not the mobile JWT context this route authenticates with).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id, auctionId } = await params;

  const body = (await req.json().catch(() => null)) as any;
  const memberId = body?.memberId ? String(body.memberId) : '';
  const decision = body?.decision === 'deny' ? 'deny' : body?.decision === 'admit' ? 'admit' : '';
  if (!memberId) return fail('memberId is required', 400);
  if (!decision) return fail("decision must be 'admit' or 'deny'", 400);

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

    const attendance = await prisma.chitAuctionAttendance.findUnique({
      where: { auctionId_memberId: { auctionId, memberId } },
      select: { id: true },
    });
    if (!attendance) return fail('Member has not joined this room', 404);

    const admissionStatus = decision === 'deny' ? 'denied' : 'admitted';
    const updated = await prisma.chitAuctionAttendance.update({
      where: { id: attendance.id },
      data: { admissionStatus, markedById: ctx.userId },
    });
    await prisma.chitAuctionEvent.create({
      data: {
        auctionId,
        type: 'announce',
        memberId,
        message: admissionStatus === 'admitted' ? 'Member admitted to room' : 'Member denied entry',
        createdById: ctx.userId,
      },
    });
    return ok(updated);
  } catch (e: any) {
    return failFromError(e, 'Admission decision failed');
  }
}
