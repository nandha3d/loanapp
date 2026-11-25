import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getBorrowerSession } from '@/lib/borrowerAuth';
import { buildGroupRoomState, parseAndStoreRoomVoice, postGroupRoomMessage } from '@/lib/chits/groupRoom';
import { joinAuctionRoomAttendance } from '@/lib/chits/attendanceAuto';
import { placeChitBid, type ChitBidSource } from '@/lib/chits/bidService';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getBorrowerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const since = req.nextUrl.searchParams.get('since');

  const state = await buildGroupRoomState({
    groupId: id,
    tenantId: session.tenantId,
    viewerCustomerId: session.customerId,
    isStaff: false,
    sinceMessageId: since,
  });
  if (!state) return NextResponse.json({ error: 'Chit group not found' }, { status: 404 });
  return NextResponse.json({ ok: true, state });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getBorrowerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const member = await prisma.chitMember.findFirst({
    where: {
      customerId: session.customerId,
      chitGroup: {
        tenantId: session.tenantId,
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
  if (!member) return NextResponse.json({ error: 'Chit membership not found' }, { status: 404 });
  const group = member.chitGroup;
  const openAuction = group.auctions[0] ?? null;

  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const rl = await checkRateLimit(routeKey('borrower-web:group-voice', getClientIp(req)), {
        limit: 30,
        windowMs: 5 * 60 * 1000,
      });
      if (!rl.allowed) return NextResponse.json({ error: 'Too many voice notes — slow down' }, { status: 429 });

      const formData = await req.formData();
      const voice = await parseAndStoreRoomVoice(formData, session.tenantId);
      const message = await postGroupRoomMessage({
        tenantId: session.tenantId,
        chitGroupId: group.id,
        auctionId: openAuction?.id ?? null,
        roomChatMode: group.roomChatMode,
        isStaff: false,
        senderMemberId: member.id,
        senderName: member.customer.name || 'Member',
        visibility: 'public',
        messageType: 'voice',
        body: voice.body,
        audioUrl: voice.audioUrl,
        audioDurationSec: voice.audioDurationSec,
        replyToId: voice.replyToId,
      });
      return NextResponse.json({ ok: true, message });
    }

    const body = (await req.json().catch(() => null)) as Record<string, any> | null;
    const action = String(body?.action || 'message');

    if (action === 'message') {
      const rl = await checkRateLimit(routeKey('borrower-web:group-msg', getClientIp(req)), {
        limit: 40,
        windowMs: 60 * 1000,
      });
      if (!rl.allowed) return NextResponse.json({ error: 'Too many messages — slow down' }, { status: 429 });

      const message = await postGroupRoomMessage({
        tenantId: session.tenantId,
        chitGroupId: group.id,
        auctionId: openAuction?.id ?? null,
        roomChatMode: group.roomChatMode,
        isStaff: false,
        senderMemberId: member.id,
        senderName: member.customer.name || 'Member',
        visibility: 'public',
        messageType: 'text',
        body: String(body?.body ?? ''),
        replyToId: body?.replyToId ? String(body.replyToId) : null,
      });
      return NextResponse.json({ ok: true, message });
    }

    if (action === 'join') {
      if (!openAuction) return NextResponse.json({ error: 'No live auction is currently open' }, { status: 400 });
      if (member.hasWon) return NextResponse.json({ error: 'Already prized ticket cannot rejoin bidding' }, { status: 400 });
      if (member.subscriberStatus !== 'active') return NextResponse.json({ error: 'Member ticket is inactive' }, { status: 403 });
      const { admissionStatus } = await joinAuctionRoomAttendance({
        tenantId: session.tenantId,
        branchId: group.branchId,
        auctionId: openAuction.id,
        memberId: member.id,
        roomAdmission: group.roomAdmission,
      });
      return NextResponse.json({ ok: true, admissionStatus });
    }

    if (action === 'bid') {
      const rl = await checkRateLimit(routeKey('borrower-web:chit-bid', getClientIp(req)), {
        limit: 30,
        windowMs: 60 * 1000,
      });
      if (!rl.allowed) return NextResponse.json({ error: 'Too many bid attempts — slow down' }, { status: 429 });

      if (!openAuction) return NextResponse.json({ error: 'No live auction is open right now' }, { status: 400 });
      if (group.roomAdmission === 'approval') {
        const att = await prisma.chitAuctionAttendance.findUnique({
          where: { auctionId_memberId: { auctionId: openAuction.id, memberId: member.id } },
          select: { admissionStatus: true },
        });
        if (att?.admissionStatus !== 'admitted') {
          return NextResponse.json({ error: 'Wait for organizer approval to bid' }, { status: 403 });
        }
      }
      const prizeAmount = Number(body?.prizeAmount);
      const idempotencyKey = body?.idempotencyKey ? String(body.idempotencyKey) : '';
      if (!Number.isFinite(prizeAmount) || prizeAmount <= 0 || !idempotencyKey) {
        return NextResponse.json({ error: 'Valid prizeAmount and idempotencyKey required' }, { status: 400 });
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
          tenantId: session.tenantId,
        }),
      );
      return NextResponse.json({
        ok: true,
        bid: { id: bid.id, bidAmount: Number(bid.bidAmount), bidDiscount: Number(bid.bidDiscount) },
      });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Request failed' }, { status: 400 });
  }
}
