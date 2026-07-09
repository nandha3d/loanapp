import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { loadScopedGroup, ensureAuction, LIVE_WRITE_ROLES } from '@/lib/chit/liveAuction';

// Live-room chat. [auctionId] carries the PERIOD NUMBER (System-B convention).
// 'public' messages are visible to everyone; 'organizer' messages are private
// between the sender and staff.

// GET /api/v1/chits/[id]/auctions/[period]/messages?since=<messageId>
// Staff see all messages; non-staff (M3 borrowers) see public + their own.
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
    const auction = await prisma.chitAuction.findUnique({
      where: { chitGroupId_periodNumber: { chitGroupId: id, periodNumber } },
      select: { id: true },
    });
    if (!auction) return ok([]);

    const since = new URL(req.url).searchParams.get('since');
    let sinceDate: Date | null = null;
    if (since) {
      const anchor = await prisma.chitRoomMessage.findUnique({
        where: { id: since },
        select: { createdAt: true },
      });
      sinceDate = anchor?.createdAt ?? null;
    }

    const isStaff = LIVE_WRITE_ROLES.includes(ctx.role);
    const rows = await prisma.chitRoomMessage.findMany({
      where: {
        auctionId: auction.id,
        tenantId: ctx.tenantId,
        ...(sinceDate ? { createdAt: { gt: sinceDate } } : {}),
        ...(isStaff
          ? {}
          : { OR: [{ visibility: 'public' }, { senderUserId: ctx.userId }] }),
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        senderUserId: true,
        senderMemberId: true,
        senderName: true,
        visibility: true,
        body: true,
        createdAt: true,
      },
    });
    return ok(rows);
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to load messages', 500);
  }
}

// POST /api/v1/chits/[id]/auctions/[period]/messages
// Body: { body, visibility? } — visibility 'organizer' = private to organizer.
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

    const payload = await req.json().catch(() => ({}));
    const body = String(payload.body ?? '').trim();
    if (!body) return fail('Message body required', 400);
    if (body.length > 500) return fail('Message too long (max 500 characters)', 400);
    const visibility = payload.visibility === 'organizer' ? 'organizer' : 'public';

    const auction = await ensureAuction(id, periodNumber);
    const sender = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, username: true },
    });

    const message = await prisma.chitRoomMessage.create({
      data: {
        tenantId: ctx.tenantId,
        auctionId: auction.id,
        senderUserId: ctx.userId,
        senderName: sender?.name || sender?.username || 'Staff',
        visibility,
        body,
      },
      select: {
        id: true,
        senderUserId: true,
        senderName: true,
        visibility: true,
        body: true,
        createdAt: true,
      },
    });
    return ok(message);
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to send message', 500);
  }
}
