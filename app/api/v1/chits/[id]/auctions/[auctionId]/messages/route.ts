import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail , failFromError} from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

// Live-room chat, canonical auctionId-based route (the old period-based route
// was retired in the auction-engine unification). Backed by ChitRoomMessage —
// the same table the web dashboard's room chat writes through its server
// action — so web and mobile share one conversation per auction.

const STAFF_ROLES = ['admin', 'superadmin', 'developer', 'agent'];

async function findAuction(ctx: any, id: string, auctionId: string) {
  return prisma.chitAuction.findFirst({
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
    select: { id: true },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id, auctionId } = await params;

  try {
    const auction = await findAuction(ctx, id, auctionId);
    if (!auction) return fail('Auction not found', 404);

    const since = req.nextUrl.searchParams.get('since');
    const sinceRow = since
      ? await prisma.chitRoomMessage.findUnique({
          where: { id: since },
          select: { createdAt: true },
        })
      : null;

    const isStaff = STAFF_ROLES.includes(ctx.role);
    const messages = await prisma.chitRoomMessage.findMany({
      where: {
        auctionId,
        tenantId: ctx.tenantId,
        // Organizer-only messages stay between staff.
        ...(isStaff ? {} : { visibility: 'public' }),
        ...(sinceRow ? { createdAt: { gt: sinceRow.createdAt } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: {
        id: true,
        senderName: true,
        visibility: true,
        body: true,
        createdAt: true,
      },
    });
    return ok(messages);
  } catch (e: any) {
    return failFromError(e, 'Failed to load room messages');
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id, auctionId } = await params;

  try {
    const auction = await findAuction(ctx, id, auctionId);
    if (!auction) return fail('Auction not found', 404);

    const body = (await req.json().catch(() => null)) as any;
    const text = String(body?.body ?? '').trim();
    if (!text) return fail('Message body required', 400);
    if (text.length > 500) return fail('Message too long (max 500 characters)', 400);

    const sender = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, username: true },
    });
    const visibility = body?.visibility === 'organizer' ? 'organizer' : 'public';

    const message = await prisma.chitRoomMessage.create({
      data: {
        tenantId: ctx.tenantId,
        auctionId,
        senderUserId: ctx.userId,
        senderName: sender?.name || sender?.username || 'Staff',
        visibility,
        body: text,
      },
      select: {
        id: true,
        senderName: true,
        visibility: true,
        body: true,
        createdAt: true,
      },
    });
    return ok(message);
  } catch (e: any) {
    return failFromError(e, 'Failed to send message');
  }
}
