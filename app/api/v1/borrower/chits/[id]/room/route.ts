import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireBorrowerMobileContext } from '@/lib/api/borrower-mobile';
import { buildGroupRoomState, postGroupRoomMessage } from '@/lib/chits/groupRoom';
import { joinAuctionRoomAttendance } from '@/lib/chits/attendanceAuto';
import { placeChitBid, type ChitBidSource } from '@/lib/chits/bidService';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const borrower = await requireBorrowerMobileContext(req);
  if (!borrower) return fail('Unauthorized', 401);
  const { id } = await params;

  const state = await buildGroupRoomState({
    groupId: id,
    tenantId: borrower.tenantId,
    viewerCustomerId: borrower.customerId,
    isStaff: false,
    sinceMessageId: req.nextUrl.searchParams.get('since'),
  });
  if (!state) return fail('Chit group not found', 404);
  return ok(state);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const borrower = await requireBorrowerMobileContext(req);
  if (!borrower) return fail('Unauthorized', 401);
  const { id } = await params;

  const member = await prisma.chitMember.findFirst({
    where: {
      customerId: borrower.customerId,
      chitGroup: {
        tenantId: borrower.tenantId,
        appType: 'chitfunds',
        deletedAt: null,
        OR: [{ id }, { groupCode: id }],
      },
    },
    orderBy: [{ hasWon: 'asc' }, { memberNumber: 'asc' }],
    include: {
      customer: { select: { name: true } },
      chitGroup: {
        include: {
          auctions: {
            where: { roomStatus: { in: ['open', 'extended'] } },
            orderBy: { periodNumber: 'asc' },
            take: 1,
          },
        },
      },
    },
  });
  if (!member) return fail('Chit membership not found', 404);
  const group = member.chitGroup;
  const openAuction = group.auctions[0] ?? null;

  try {
    const body = (await req.json().catch(() => null)) as Record<string, any> | null;
    const action = String(body?.action || 'message');

    if (action === 'join') {
      if (!openAuction) return fail('No live auction is open right now', 400);
      if (member.hasWon) return fail('Already prized ticket cannot rejoin bidding', 400);
      if (member.subscriberStatus !== 'active') return fail('Member ticket is inactive', 403);
      const { admissionStatus } = await joinAuctionRoomAttendance({
        tenantId: borrower.tenantId,
        branchId: group.branchId,
        auctionId: openAuction.id,
        memberId: member.id,
        roomAdmission: group.roomAdmission,
      });
      return ok({ admissionStatus });
    }

    if (action === 'bid') {
      if (!openAuction) return fail('No live auction is open right now', 400);
      if (group.roomAdmission === 'approval') {
        const att = await prisma.chitAuctionAttendance.findUnique({
          where: { auctionId_memberId: { auctionId: openAuction.id, memberId: member.id } },
          select: { admissionStatus: true },
        });
        if (att?.admissionStatus !== 'admitted') {
          return fail('Wait for organizer approval to bid', 403);
        }
      }
      const prizeAmount = Number(body?.prizeAmount);
      const idempotencyKey = body?.idempotencyKey ? String(body.idempotencyKey) : '';
      if (!Number.isFinite(prizeAmount) || prizeAmount <= 0 || !idempotencyKey) {
        return fail('Valid prizeAmount and idempotencyKey required', 400);
      }
      const auctionWithGroup = { ...openAuction, chitGroup: group };
      const source: ChitBidSource = body?.source === 'voice' ? 'voice' : 'tap';
      const bid = await prisma.$transaction((tx) =>
        placeChitBid(tx, {
          auction: auctionWithGroup,
          member,
          prizeAmount,
          source,
          transcript: body?.transcript ? String(body.transcript).slice(0, 500) : null,
          idempotencyKey,
          createdById: null,
          tenantId: borrower.tenantId,
        }),
      );
      return ok({
        id: bid.id,
        bidAmount: Number(bid.bidAmount),
        bidDiscount: Number(bid.bidDiscount),
      });
    }

    const rawAudioUrl =
      typeof body?.audioUrl === 'string' && body.audioUrl.trim().startsWith(`/api/files/${borrower.tenantId}/`)
        ? body.audioUrl.trim()
        : null;
    const durNum = Number(body?.audioDurationSec);
    const audioDurationSec = Number.isFinite(durNum) && durNum > 0 ? Math.min(300, Math.round(durNum)) : null;

    const message = await postGroupRoomMessage({
      tenantId: borrower.tenantId,
      chitGroupId: group.id,
      auctionId: openAuction?.id ?? null,
      roomChatMode: group.roomChatMode,
      isStaff: false,
      senderMemberId: member.id,
      senderName: member.customer.name || 'Member',
      visibility: 'public',
      messageType: rawAudioUrl ? 'voice' : 'text',
      body: String(body?.body ?? (rawAudioUrl ? '🎤 Voice message' : '')),
      audioUrl: rawAudioUrl,
      audioDurationSec,
      replyToId: body?.replyToId ? String(body.replyToId) : null,
    });
    return ok(message);
  } catch (err: any) {
    return fail(err?.message ?? 'Request failed', 400);
  }
}
