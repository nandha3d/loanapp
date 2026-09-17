import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireBorrowerMobileContext } from '@/lib/api/borrower-mobile';
import { findOwnLiveAuction } from '@/lib/chits/customerAuction';

// Customer side of the live-room chat. Backed by the same ChitRoomMessage
// table as the staff route — customers only ever see/send 'public' messages
// (the 'organizer' visibility stays staff-to-staff).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const borrower = await requireBorrowerMobileContext(req);
  if (!borrower) return fail('Unauthorized', 401);
  const { id, auctionId } = await params;

  try {
    const found = await findOwnLiveAuction(borrower.customerId, borrower.tenantId, id, auctionId);
    if (!found) return fail('Auction not found', 404);

    const since = req.nextUrl.searchParams.get('since');
    const sinceRow = since
      ? await prisma.chitRoomMessage.findUnique({ where: { id: since }, select: { createdAt: true } })
      : null;

    const messages = await prisma.chitRoomMessage.findMany({
      where: {
        auctionId,
        visibility: 'public',
        ...(sinceRow ? { createdAt: { gt: sinceRow.createdAt } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: { id: true, senderName: true, visibility: true, body: true, createdAt: true },
    });
    return ok(messages);
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to load room messages', 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const borrower = await requireBorrowerMobileContext(req);
  if (!borrower) return fail('Unauthorized', 401);
  const { id, auctionId } = await params;

  try {
    const found = await findOwnLiveAuction(borrower.customerId, borrower.tenantId, id, auctionId);
    if (!found) return fail('Auction not found', 404);

    const body = (await req.json().catch(() => null)) as any;
    const text = String(body?.body ?? '').trim();
    if (!text) return fail('Message body required', 400);
    if (text.length > 500) return fail('Message too long (max 500 characters)', 400);

    const customer = await prisma.customer.findUnique({ where: { id: borrower.customerId }, select: { name: true } });

    const message = await prisma.chitRoomMessage.create({
      data: {
        tenantId: borrower.tenantId,
        auctionId,
        senderMemberId: found.member.id,
        senderName: customer?.name || 'Member',
        visibility: 'public',
        body: text,
      },
      select: { id: true, senderName: true, visibility: true, body: true, createdAt: true },
    });
    return ok(message);
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to send message', 500);
  }
}
