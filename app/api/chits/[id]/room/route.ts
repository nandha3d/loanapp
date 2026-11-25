import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiContext } from '@/lib/apiAuth';
import { canAdminChits, canConductChitAuction, scopedChitGroupWhere } from '@/lib/chits/access';
import { mergeStaffPermissions, type StaffPermissions } from '@/lib/staffPermissions';
import { buildGroupRoomState, normalizeRoomChatMode, parseAndStoreRoomVoice, postGroupRoomMessage } from '@/lib/chits/groupRoom';
import { closeAuctionRoom, openAuctionRoom } from '@/lib/chits/liveAuction';
import { placeChitBid, type ChitBidSource } from '@/lib/chits/bidService';
import { requireModule } from '@/lib/moduleGate';
import { branchScopeWhere } from '@/lib/branch';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { context, response } = await requireApiContext(['admin', 'superadmin', 'developer', 'agent']);
  if (response) return response;
  try {
    await requireModule(context.tenantId, 'chitfunds');
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Module disabled' }, { status: 403 });
  }

  const { id } = await params;
  const since = req.nextUrl.searchParams.get('since');
  const state = await buildGroupRoomState({
    groupId: id,
    tenantId: context.tenantId,
    branchId: context.branchId,
    isStaff: true,
    sinceMessageId: since,
  });
  if (!state) return NextResponse.json({ error: 'Chit group not found' }, { status: 404 });
  return NextResponse.json({ ok: true, state });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { context, response } = await requireApiContext(['admin', 'superadmin', 'developer', 'agent']);
  if (response) return response;
  try {
    await requireModule(context.tenantId, 'chitfunds');
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Module disabled' }, { status: 403 });
  }

  const { id } = await params;
  const group = await prisma.chitGroup.findFirst({
    where: {
      ...scopedChitGroupWhere({
        tenantId: context.tenantId,
        appType: 'chitfunds',
        branchId: context.branchId,
        role: context.role,
        userId: context.userId,
      }),
      OR: [{ id }, { groupCode: id }],
    },
    include: {
      auctions: {
        orderBy: { periodNumber: 'asc' },
        select: { id: true, periodNumber: true, status: true, roomStatus: true },
      },
    },
  });
  if (!group) return NextResponse.json({ error: 'Chit group not found' }, { status: 404 });

  const sender = context.userId
    ? await prisma.user.findUnique({
        where: { id: context.userId },
        select: {
          name: true,
          username: true,
          staffPermissions: true,
          customRole: { select: { permissionsJson: true, status: true } },
        },
      })
    : null;
  const senderName = sender?.name || sender?.username || 'Staff';
  const staffPerms: StaffPermissions | null = sender
    ? mergeStaffPermissions(
        sender.customRole?.status === 'active' ? sender.customRole.permissionsJson : null,
        sender.staffPermissions,
      )
    : null;

  const activeAuction =
    group.auctions.find((a) => ['open', 'extended'].includes(a.roomStatus)) ??
    group.auctions.find((a) => ['in_progress', 'notice_sent', 'pending'].includes(a.status)) ??
    null;

  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const voice = await parseAndStoreRoomVoice(formData, context.tenantId);
      const message = await postGroupRoomMessage({
        tenantId: context.tenantId,
        chitGroupId: group.id,
        auctionId: activeAuction?.id ?? null,
        roomChatMode: group.roomChatMode,
        isStaff: true,
        senderUserId: context.userId,
        senderName,
        visibility: voice.visibility,
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

    if (action === 'message' || action === 'reminder') {
      const visibility: 'public' | 'organizer' = body?.visibility === 'organizer' ? 'organizer' : 'public';
      const messageType = action === 'reminder' ? 'payment_reminder' : 'text';
      const message = await postGroupRoomMessage({
        tenantId: context.tenantId,
        chitGroupId: group.id,
        auctionId: activeAuction?.id ?? null,
        roomChatMode: group.roomChatMode,
        isStaff: true,
        senderUserId: context.userId,
        senderName: action === 'reminder' ? 'Payment Reminder' : senderName,
        visibility: action === 'reminder' ? 'public' : visibility,
        messageType,
        body: String(body?.body ?? ''),
        replyToId: body?.replyToId ? String(body.replyToId) : null,
      });
      return NextResponse.json({ ok: true, message });
    }

    if (action === 'settings') {
      if (!canConductChitAuction(context.role, staffPerms)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const roomChatMode = normalizeRoomChatMode(body?.roomChatMode);
      const pinnedAnnouncement = body?.pinnedAnnouncement
        ? String(body.pinnedAnnouncement).trim().slice(0, 500)
        : null;
      await prisma.chitGroup.update({
        where: { id: group.id },
        data: { roomChatMode, pinnedAnnouncement },
      });
      return NextResponse.json({ ok: true, roomChatMode, pinnedAnnouncement });
    }

    if (action === 'open_room') {
      if (!canConductChitAuction(context.role, staffPerms)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const targetAuctionId = String(body?.auctionId || activeAuction?.id || '');
      if (!targetAuctionId) return NextResponse.json({ error: 'No auction available to open' }, { status: 400 });
      const durationMinutes = Number(body?.durationMinutes || 30);
      const autoExtendSeconds = Number(body?.autoExtendSeconds || 60);
      await prisma.$transaction((tx) =>
        openAuctionRoom(tx, {
          auctionId: targetAuctionId,
          durationMinutes,
          autoExtendSeconds,
          openedById: context.userId,
        }),
      );
      return NextResponse.json({ ok: true });
    }

    if (action === 'close_room') {
      if (!canConductChitAuction(context.role, staffPerms)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const targetAuctionId = String(body?.auctionId || activeAuction?.id || '');
      if (!targetAuctionId) return NextResponse.json({ error: 'No open auction room' }, { status: 400 });
      await prisma.$transaction((tx) =>
        closeAuctionRoom(tx, targetAuctionId, { closedById: context.userId }),
      );
      return NextResponse.json({ ok: true });
    }

    if (action === 'bid') {
      if (!canConductChitAuction(context.role, staffPerms)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const targetAuctionId = String(body?.auctionId || activeAuction?.id || '');
      const memberId = String(body?.memberId || '');
      const prizeAmount = Number(body?.prizeAmount);
      if (!targetAuctionId || !memberId || !(prizeAmount > 0)) {
        return NextResponse.json({ error: 'auctionId, memberId, and prizeAmount are required' }, { status: 400 });
      }
      const [auction, member] = await Promise.all([
        prisma.chitAuction.findFirst({
          where: { id: targetAuctionId, chitGroupId: group.id, chitGroup: branchScopeWhere(context.branchId) },
          include: { chitGroup: true },
        }),
        prisma.chitMember.findFirst({
          where: { id: memberId, chitGroupId: group.id },
          select: { id: true, hasWon: true, subscriberStatus: true },
        }),
      ]);
      if (!auction || !member) return NextResponse.json({ error: 'Auction or member not found' }, { status: 404 });

      const source: ChitBidSource = body?.source === 'voice' ? 'voice' : 'tap';
      const bid = await prisma.$transaction((tx) =>
        placeChitBid(tx, {
          auction,
          member,
          prizeAmount,
          source,
          transcript: body?.transcript ? String(body.transcript).slice(0, 500) : null,
          idempotencyKey: body?.idempotencyKey ? String(body.idempotencyKey) : null,
          createdById: context.userId,
          tenantId: context.tenantId,
        }),
      );
      return NextResponse.json({
        ok: true,
        bid: { id: bid.id, bidAmount: Number(bid.bidAmount), bidDiscount: Number(bid.bidDiscount) },
      });
    }

    if (action === 'admit' || action === 'deny') {
      if (!canConductChitAuction(context.role, staffPerms)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const targetAuctionId = String(body?.auctionId || activeAuction?.id || '');
      const memberId = String(body?.memberId || '');
      if (!targetAuctionId || !memberId) return NextResponse.json({ error: 'auctionId and memberId required' }, { status: 400 });
      await prisma.chitAuctionAttendance.updateMany({
        where: { auctionId: targetAuctionId, memberId, tenantId: context.tenantId },
        data: {
          admissionStatus: action === 'admit' ? 'admitted' : 'denied',
          status: action === 'admit' ? 'present' : 'absent',
        },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed to update room' }, { status: 400 });
  }
}
