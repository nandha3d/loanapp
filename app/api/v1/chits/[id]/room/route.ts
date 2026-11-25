import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { canAdminChits } from '@/lib/chits/access';
import { buildGroupRoomState, normalizeRoomChatMode, postGroupRoomMessage } from '@/lib/chits/groupRoom';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  const state = await buildGroupRoomState({
    groupId: id,
    tenantId: ctx.tenantId,
    branchId: ctx.branchId,
    isStaff: true,
    sinceMessageId: req.nextUrl.searchParams.get('since'),
  });
  if (!state) return fail('Chit group not found', 404);
  return ok(state);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  const group = await prisma.chitGroup.findFirst({
    where: {
      tenantId: ctx.tenantId,
      appType: 'chitfunds',
      ...scopedBranchWhere(ctx),
      deletedAt: null,
      OR: [{ id }, { groupCode: id }],
    },
    include: {
      auctions: {
        where: { roomStatus: { in: ['open', 'extended'] } },
        orderBy: { periodNumber: 'asc' },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!group) return fail('Chit group not found', 404);

  try {
    const body = (await req.json().catch(() => null)) as Record<string, any> | null;
    const action = String(body?.action || 'message');

    if (action === 'settings') {
      if (!canAdminChits(ctx.role)) return fail('Forbidden', 403);
      const roomChatMode = normalizeRoomChatMode(body?.roomChatMode);
      const pinnedAnnouncement = body?.pinnedAnnouncement
        ? String(body.pinnedAnnouncement).trim().slice(0, 500)
        : null;
      await prisma.chitGroup.update({
        where: { id: group.id },
        data: { roomChatMode, pinnedAnnouncement },
      });
      return ok({ roomChatMode, pinnedAnnouncement });
    }

    const sender = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, username: true },
    });
    const rawAudioUrl =
      typeof body?.audioUrl === 'string' && body.audioUrl.trim().startsWith(`/api/files/${ctx.tenantId}/`)
        ? body.audioUrl.trim()
        : null;
    const durNum = Number(body?.audioDurationSec);
    const audioDurationSec = Number.isFinite(durNum) && durNum > 0 ? Math.min(300, Math.round(durNum)) : null;

    const message = await postGroupRoomMessage({
      tenantId: ctx.tenantId,
      chitGroupId: group.id,
      auctionId: group.auctions[0]?.id ?? null,
      roomChatMode: group.roomChatMode,
      isStaff: true,
      senderUserId: ctx.userId,
      senderName:
        action === 'reminder'
          ? 'Payment Reminder'
          : sender?.name || sender?.username || 'Staff',
      visibility: body?.visibility === 'organizer' && action !== 'reminder' ? 'organizer' : 'public',
      messageType: action === 'reminder' ? 'payment_reminder' : rawAudioUrl ? 'voice' : 'text',
      body: String(body?.body ?? (rawAudioUrl ? '🎤 Voice message' : '')),
      audioUrl: rawAudioUrl,
      audioDurationSec,
      replyToId: body?.replyToId ? String(body.replyToId) : null,
    });
    return ok(message);
  } catch (err: any) {
    return fail(err?.message ?? 'Failed to post room message', 400);
  }
}
