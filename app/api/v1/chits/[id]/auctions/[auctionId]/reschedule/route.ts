import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail , failFromError} from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { rescheduleAuctionInTx } from '@/lib/chits/auction';

// Mobile counterpart of the web rescheduleAuction action (audit 03 parity).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id, auctionId } = await params;

  try {
    const body = (await req.json().catch(() => null)) as { scheduledAt?: string } | null;
    const scheduledAt = new Date(body?.scheduledAt || '');
    if (Number.isNaN(scheduledAt.getTime())) return fail('scheduledAt is invalid', 400);

    const auction = await prisma.chitAuction.findFirst({
      where: {
        id: auctionId,
        chitGroupId: id,
        chitGroup: {
          tenantId: ctx.tenantId,
          appType: 'chitfunds',
          ...scopedBranchWhere(ctx),
          deletedAt: null,
        },
      },
      select: { id: true, status: true },
    });
    if (!auction) return fail('Auction not found', 404);
    if (!['pending', 'notice_sent'].includes(auction.status)) {
      return fail('Only pending or notice-sent auctions can be rescheduled', 400);
    }

    await prisma.$transaction(async (tx) => {
      await rescheduleAuctionInTx(tx, {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        auctionId: auction.id,
        scheduledAt,
      });
    });
    return ok({ scheduledAt: scheduledAt.toISOString() });
  } catch (e: any) {
    return failFromError(e, 'Reschedule failed');
  }
}
