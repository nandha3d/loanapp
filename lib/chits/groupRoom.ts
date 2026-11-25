import prisma from '@/lib/db';
import { syncRoom, buildBellState } from './bell';
import { computeSubscriptionBalances, calculateReserveFloor } from './engineCalculator';
import {
  CHIT_ENGINE_CATALOG,
  isBiddingEnabledForPeriod,
  parseChitEngineConfig,
  resolveEngineTypeFromGroup,
} from './engineTypes';
import { isRoomOpen, secondsRemaining } from './liveAuction';
import { computeAutomatedBidBounds } from './validation';
import { roundMoney } from './calculations';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  detectMimeTypeFromBytes,
  isAudioMime,
  maxUploadSizeFor,
  storeTenantUpload,
  validateFileBytes,
} from '@/lib/fileUpload';

export async function parseAndStoreRoomVoice(formData: FormData, tenantId: string) {
  const audio = formData.get('audio');
  if (!(audio instanceof File) || audio.size <= 0) {
    throw new Error('Voice clip is required');
  }
  const rawMime = (audio.type || 'audio/webm').split(';')[0].trim().toLowerCase();
  const buffer = Buffer.from(await audio.arrayBuffer());
  const effectiveMime =
    isAudioMime(rawMime) && ALLOWED_UPLOAD_MIME_TYPES.includes(rawMime) && validateFileBytes(buffer, rawMime)
      ? rawMime
      : detectMimeTypeFromBytes(buffer) ?? '';
  if (!effectiveMime || !isAudioMime(effectiveMime) || !ALLOWED_UPLOAD_MIME_TYPES.includes(effectiveMime)) {
    throw new Error('Unsupported voice audio format');
  }
  if (buffer.byteLength > maxUploadSizeFor(effectiveMime)) {
    throw new Error('Voice clip exceeds 1 MB limit');
  }
  const stored = await storeTenantUpload({
    tenantId,
    mimeType: effectiveMime,
    buffer,
    prefix: 'voice',
  });
  const transcript = String(formData.get('transcript') ?? '').trim().slice(0, 500);
  const durNum = Number(formData.get('durationSec'));
  const audioDurationSec = Number.isFinite(durNum) && durNum > 0 ? Math.min(300, Math.round(durNum)) : null;
  const replyToId = formData.get('replyToId') ? String(formData.get('replyToId')).trim() : null;
  const visibility: 'public' | 'organizer' = formData.get('visibility') === 'organizer' ? 'organizer' : 'public';

  return {
    audioUrl: stored.url,
    audioDurationSec,
    body: transcript || '🎤 Voice message',
    replyToId,
    visibility,
  };
}

export type RoomChatMode = 'open' | 'announcements_only' | 'auction_live';

export function normalizeRoomChatMode(raw: string | null | undefined): RoomChatMode {
  if (raw === 'announcements_only' || raw === 'auction_live') return raw;
  return 'open';
}

export function canMemberPostInRoom(mode: string | null | undefined): boolean {
  return normalizeRoomChatMode(mode) !== 'announcements_only';
}

export interface GroupRoomMessageDto {
  id: string;
  chitGroupId: string | null;
  auctionId: string | null;
  senderName: string;
  senderMemberId: string | null;
  senderUserId: string | null;
  visibility: string;
  messageType: string;
  body: string;
  audioUrl: string | null;
  audioDurationSec: number | null;
  replyToId: string | null;
  replyToSender: string | null;
  replyToBody: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

function parseMeta(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function formatRoomMessage(m: {
  id: string;
  chitGroupId: string | null;
  auctionId: string | null;
  senderName: string;
  senderMemberId: string | null;
  senderUserId: string | null;
  visibility: string;
  messageType: string;
  body: string;
  audioUrl: string | null;
  audioDurationSec: number | null;
  replyToId: string | null;
  replyToSender: string | null;
  replyToBody: string | null;
  metadataJson: string | null;
  createdAt: Date;
}): GroupRoomMessageDto {
  return {
    id: m.id,
    chitGroupId: m.chitGroupId,
    auctionId: m.auctionId,
    senderName: m.senderName,
    senderMemberId: m.senderMemberId,
    senderUserId: m.senderUserId,
    visibility: m.visibility,
    messageType: m.messageType,
    body: m.body,
    audioUrl: m.audioUrl,
    audioDurationSec: m.audioDurationSec,
    replyToId: m.replyToId,
    replyToSender: m.replyToSender,
    replyToBody: m.replyToBody,
    metadata: parseMeta(m.metadataJson),
    createdAt: m.createdAt.toISOString(),
  };
}

/** Emits a structured live bid bubble into the group's persistent room timeline. */
export async function postRoomBidEvent(
  tx: any,
  params: {
    tenantId: string;
    chitGroupId: string;
    auctionId: string;
    periodNumber: number;
    ticketNo: string | null;
    memberId: string;
    memberName: string;
    prizeAmount: number;
    bidDiscount: number;
    source: string;
  },
) {
  const label = `#${params.ticketNo ?? '?'} ${params.memberName}`;
  await tx.chitRoomMessage.create({
    data: {
      tenantId: params.tenantId,
      chitGroupId: params.chitGroupId,
      auctionId: params.auctionId,
      senderMemberId: params.memberId,
      senderName: label,
      visibility: 'public',
      messageType: 'bid_event',
      body: `Period ${params.periodNumber} Bid: Rs. ${roundMoney(params.prizeAmount).toLocaleString('en-IN')} (Discount Rs. ${roundMoney(params.bidDiscount).toLocaleString('en-IN')}) via ${params.source}`,
      metadataJson: JSON.stringify({
        auctionId: params.auctionId,
        periodNumber: params.periodNumber,
        ticketNo: params.ticketNo,
        memberName: params.memberName,
        prizeAmount: roundMoney(params.prizeAmount),
        bidDiscount: roundMoney(params.bidDiscount),
        source: params.source,
      }),
    },
  });
}

/** Emits a structured Period Result & PDF Report card into the group room on finalization. */
export async function postRoomSettlementCard(
  tx: any,
  params: {
    tenantId: string;
    chitGroupId: string;
    auctionId: string;
    periodNumber: number;
    winnerName: string;
    winnerTicketNo: string | null;
    prizeAmount: number;
    bidDiscount: number;
    commission: number;
    dividendPerTicket: number;
    monthlyContrib: number;
  },
) {
  const netInstallment = Math.max(0, roundMoney(params.monthlyContrib - params.dividendPerTicket));
  await tx.chitRoomMessage.create({
    data: {
      tenantId: params.tenantId,
      chitGroupId: params.chitGroupId,
      auctionId: params.auctionId,
      senderName: 'Chit Settlement',
      visibility: 'public',
      messageType: 'settlement_card',
      body: `Period ${params.periodNumber} Settled · Winner: ${params.winnerName}${params.winnerTicketNo ? ` (#${params.winnerTicketNo})` : ''} · Prize Rs. ${roundMoney(params.prizeAmount).toLocaleString('en-IN')} · Dividend Rs. ${roundMoney(params.dividendPerTicket).toLocaleString('en-IN')}/ticket · Net Due Rs. ${netInstallment.toLocaleString('en-IN')}`,
      metadataJson: JSON.stringify({
        auctionId: params.auctionId,
        periodNumber: params.periodNumber,
        winnerName: params.winnerName,
        winnerTicketNo: params.winnerTicketNo,
        prizeAmount: roundMoney(params.prizeAmount),
        bidDiscount: roundMoney(params.bidDiscount),
        commission: roundMoney(params.commission),
        dividendPerTicket: roundMoney(params.dividendPerTicket),
        netInstallment,
        reportPath: `/api/chits/${params.chitGroupId}/auctions/${params.auctionId}/report`,
        borrowerReportPath: `/api/borrower/chits/${params.chitGroupId}/auctions/${params.auctionId}/report`,
      }),
    },
  });
}

export async function postGroupRoomMessage(params: {
  tenantId: string;
  chitGroupId: string;
  auctionId?: string | null;
  roomChatMode?: string | null;
  isStaff: boolean;
  senderUserId?: string | null;
  senderMemberId?: string | null;
  senderName: string;
  visibility?: 'public' | 'organizer';
  messageType?: 'text' | 'voice' | 'payment_reminder' | 'system_notice';
  body: string;
  audioUrl?: string | null;
  audioDurationSec?: number | null;
  replyToId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<GroupRoomMessageDto> {
  if (!params.isStaff && !canMemberPostInRoom(params.roomChatMode)) {
    throw new Error('Room is in Organizer Announcements-Only mode right now.');
  }

  const trimmedBody = params.body.trim();
  if (!trimmedBody) throw new Error('Message body is required');
  if (trimmedBody.length > 500) throw new Error('Message too long (max 500 characters)');

  let replyToSender: string | null = null;
  let replyToBody: string | null = null;
  let validReplyId: string | null = null;
  if (params.replyToId) {
    const parent = await prisma.chitRoomMessage.findFirst({
      where: {
        id: params.replyToId,
        tenantId: params.tenantId,
        OR: [
          { chitGroupId: params.chitGroupId },
          { auction: { chitGroupId: params.chitGroupId } },
        ],
      },
      select: { id: true, senderName: true, body: true },
    });
    if (parent) {
      validReplyId = parent.id;
      replyToSender = parent.senderName.slice(0, 60);
      replyToBody = parent.body.slice(0, 120);
    }
  }

  const created = await prisma.chitRoomMessage.create({
    data: {
      tenantId: params.tenantId,
      chitGroupId: params.chitGroupId,
      auctionId: params.auctionId ?? null,
      senderUserId: params.senderUserId ?? null,
      senderMemberId: params.senderMemberId ?? null,
      senderName: params.senderName,
      visibility: params.isStaff && params.visibility === 'organizer' ? 'organizer' : 'public',
      messageType: params.messageType ?? (params.audioUrl ? 'voice' : 'text'),
      body: trimmedBody,
      audioUrl: params.audioUrl ?? null,
      audioDurationSec: params.audioDurationSec ?? null,
      replyToId: validReplyId,
      replyToSender,
      replyToBody,
      metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });

  return formatRoomMessage(created);
}

export async function buildGroupRoomState(params: {
  groupId: string;
  tenantId: string;
  branchId?: string | null;
  viewerCustomerId?: string | null;
  isStaff: boolean;
  sinceMessageId?: string | null;
}) {
  const group = await prisma.chitGroup.findFirst({
    where: {
      tenantId: params.tenantId,
      appType: 'chitfunds',
      deletedAt: null,
      OR: [{ id: params.groupId }, { groupCode: params.groupId }],
      ...(params.branchId ? { branchId: params.branchId } : {}),
      ...(params.viewerCustomerId
        ? { members: { some: { customerId: params.viewerCustomerId } } }
        : {}),
    },
    include: {
      members: {
        orderBy: { memberNumber: 'asc' },
        include: {
          customer: { select: { id: true, name: true, phone: true, profilePhoto: true } },
        },
      },
      auctions: {
        orderBy: { periodNumber: 'asc' },
        include: {
          winnerMember: { include: { customer: { select: { name: true } } } },
          bids: {
            where: { status: { in: ['valid', 'winning'] } },
            orderBy: { bidDiscount: 'desc' },
            take: 1,
            include: { member: { include: { customer: { select: { name: true } } } } },
          },
        },
      },
    },
  });

  if (!group) return null;

  const activeAuction =
    group.auctions.find((a) => ['open', 'extended'].includes(a.roomStatus)) ??
    group.auctions.find((a) => ['in_progress', 'notice_sent', 'pending'].includes(a.status)) ??
    group.auctions[group.auctions.length - 1] ??
    null;

  if (activeAuction && ['open', 'extended'].includes(activeAuction.roomStatus)) {
    await prisma.$transaction(async (tx) => {
      await syncRoom(tx, activeAuction.id);
    });
  }

  const freshAuction = activeAuction
    ? await prisma.chitAuction.findUnique({
        where: { id: activeAuction.id },
        include: {
          bids: {
            where: { status: { in: ['valid', 'winning'] } },
            orderBy: [{ bidDiscount: 'desc' }, { bidTime: 'asc' }],
            include: { member: { include: { customer: { select: { name: true } } } } },
          },
          attendance: true,
        },
      })
    : null;

  const engineType = resolveEngineTypeFromGroup(group);
  const engineCfg = parseChitEngineConfig(group.engineConfig, engineType);
  const chitValueNum = Number(group.chitValue);
  let bidBounds: ReturnType<typeof computeAutomatedBidBounds> | null = null;
  let bellState: Awaited<ReturnType<typeof buildBellState>> | null = null;
  let waitingMembers: Array<{ memberId: string; name: string }> = [];

  if (freshAuction) {
    const sealed = group.auctionType === 'sealed' && freshAuction.roomStatus !== 'closed';
    const topBid = !sealed && freshAuction.bids.length > 0 ? freshAuction.bids[0] : null;
    const reserveFloorPct =
      engineType === 'AUCTION_RESERVE_PRICE' && engineCfg.discountRules.reservePriceStepPct > 0
        ? calculateReserveFloor({
            chitValue: chitValueNum,
            totalPeriods: group.totalMembers,
            periodNumber: freshAuction.periodNumber,
            reservePriceStepPct: engineCfg.discountRules.reservePriceStepPct,
            maxDiscountPct: engineCfg.discountRules.uncapped
              ? null
              : group.maxDiscountPct != null
                ? Number(group.maxDiscountPct)
                : null,
          }).reserveFloorPct
        : null;
    const increment =
      group.bidIncrement && Number(group.bidIncrement) > 0
        ? Number(group.bidIncrement)
        : engineCfg.discountRules.bidIncrementMultiple > 0
          ? engineCfg.discountRules.bidIncrementMultiple
          : 0;

    bidBounds = computeAutomatedBidBounds({
      chitValue: chitValueNum,
      minDiscountPct: group.minDiscountPct != null ? Number(group.minDiscountPct) : null,
      maxDiscountPct: engineCfg.discountRules.uncapped
        ? null
        : group.maxDiscountPct != null
          ? Number(group.maxDiscountPct)
          : null,
      commissionPct: Number(group.commissionPct),
      bidStartAtCommission: group.bidStartAtCommission,
      bidIncrement: increment,
      reserveFloorPct,
      uncapped: engineType === 'AUCTION_UNCAPPED_ENTERPRISE' || engineCfg.discountRules.uncapped,
      currentHighestDiscount: topBid ? Number(topBid.bidDiscount) : null,
      auctionType: group.auctionType,
    });

    bellState = await buildBellState({
      bellsRung: freshAuction.bellsRung,
      bellAnchorAt: freshAuction.bellAnchorAt,
      roomStatus: freshAuction.roomStatus,
      chitGroup: {
        bellEnabled: group.bellEnabled,
        bellIntervalSeconds: group.bellIntervalSeconds,
        bellCount: group.bellCount,
        bellAutoClose: group.bellAutoClose,
      },
    });

    if (params.isStaff) {
      const nameByMemberId = new Map(group.members.map((m) => [m.id, m.customer.name]));
      waitingMembers = freshAuction.attendance
        .filter((a) => a.admissionStatus === 'waiting')
        .map((a) => ({ memberId: a.memberId, name: nameByMemberId.get(a.memberId) ?? 'Member' }));
    }
  }

  const myMembers = params.viewerCustomerId
    ? group.members.filter((m) => m.customer.id === params.viewerCustomerId)
    : [];
  const myMember = myMembers.find((m) => !m.hasWon) ?? myMembers[0] ?? null;

  let mySummary: {
    memberId: string;
    ticketNo: string | null;
    hasWon: boolean;
    subscriberStatus: string;
    admissionStatus: string | null;
    nextDue: {
      subscriptionId: string;
      periodNumber: number;
      dueDate: string;
      dueAmount: number;
      outstanding: number;
      status: string;
    } | null;
  } | null = null;

  if (myMember) {
    const nextSub = await prisma.chitSubscription.findFirst({
      where: { memberId: myMember.id, status: { in: ['upcoming', 'partial', 'missed'] } },
      orderBy: { periodNumber: 'asc' },
    });
    const myAtt = freshAuction?.attendance.find((a) => a.memberId === myMember.id);
    const bal = nextSub ? computeSubscriptionBalances(nextSub, group.dividendDistribution) : null;
    mySummary = {
      memberId: myMember.id,
      ticketNo: myMember.ticketNo,
      hasWon: myMember.hasWon,
      subscriberStatus: myMember.subscriberStatus,
      admissionStatus: myAtt?.admissionStatus ?? null,
      nextDue: nextSub && bal
        ? {
            subscriptionId: nextSub.id,
            periodNumber: nextSub.periodNumber,
            dueDate: nextSub.dueDate.toISOString(),
            dueAmount: bal.netDue,
            outstanding: bal.outstanding,
            status: nextSub.status,
          }
        : null,
    };
  }

  const sinceRow = params.sinceMessageId
    ? await prisma.chitRoomMessage.findUnique({
        where: { id: params.sinceMessageId },
        select: { createdAt: true },
      })
    : null;

  const auctionIds = group.auctions.map((a) => a.id);
  const rawMessages = await prisma.chitRoomMessage.findMany({
    where: {
      tenantId: group.tenantId,
      OR: [
        { chitGroupId: group.id },
        ...(auctionIds.length > 0 ? [{ auctionId: { in: auctionIds } }] : []),
      ],
      ...(params.isStaff ? {} : { visibility: 'public' }),
      ...(sinceRow ? { createdAt: { gt: sinceRow.createdAt } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: 250,
  });

  const settlements = group.auctions
    .filter((a) => ['confirmed', 'paid', 'completed'].includes(a.status))
    .slice(-6)
    .reverse()
    .map((a) => ({
      auctionId: a.id,
      periodNumber: a.periodNumber,
      winnerName: a.winnerMember?.customer?.name ?? 'TBD',
      prizeAmount: a.prizeAmount != null ? Number(a.prizeAmount) : 0,
      bidDiscount: a.bidDiscount != null ? Number(a.bidDiscount) : 0,
      dividend: a.dividend != null ? Number(a.dividend) : 0,
      payoutStatus: a.payoutStatus,
      reportUrl: `/api/chits/${group.id}/auctions/${a.id}/report`,
      borrowerReportUrl: `/api/borrower/chits/${group.id}/auctions/${a.id}/report`,
    }));

  const currentTop =
    freshAuction && !(group.auctionType === 'sealed' && freshAuction.roomStatus !== 'closed') && freshAuction.bids.length > 0
      ? freshAuction.bids[0]
      : null;

  return {
    serverTime: new Date().toISOString(),
    group: {
      id: group.id,
      groupCode: group.groupCode,
      name: group.name,
      chitValue: chitValueNum,
      monthlyContrib: Number(group.monthlyContrib),
      totalMembers: group.totalMembers,
      enrolledCount: group.members.length,
      chitEngineType: engineType,
      engineLabel: CHIT_ENGINE_CATALOG[engineType].name,
      auctionType: group.auctionType,
      status: group.status,
      roomChatMode: normalizeRoomChatMode(group.roomChatMode),
      roomAdmission: group.roomAdmission,
      pinnedAnnouncement: group.pinnedAnnouncement ?? null,
    },
    members: group.members.map((m) => ({
      memberId: m.id,
      ticketNo: m.ticketNo ?? String(m.memberNumber),
      name: m.customer.name,
      phone: params.isStaff ? m.customer.phone : null,
      profilePhoto: m.customer.profilePhoto,
      hasWon: m.hasWon,
      subscriberStatus: m.subscriberStatus,
      isMe: params.viewerCustomerId ? m.customer.id === params.viewerCustomerId : false,
    })),
    activeAuction: freshAuction
      ? {
          id: freshAuction.id,
          periodNumber: freshAuction.periodNumber,
          status: freshAuction.status,
          roomStatus: freshAuction.roomStatus,
          supportsBidding: isBiddingEnabledForPeriod(group, freshAuction.periodNumber),
          isOpen: isRoomOpen(freshAuction),
          biddingClosesAt: freshAuction.biddingClosesAt?.toISOString() ?? null,
          secondsRemaining: secondsRemaining(freshAuction),
          auctionDate: freshAuction.auctionDate.toISOString(),
          scheduledAt: freshAuction.scheduledAt?.toISOString() ?? null,
          leadingBid: currentTop
            ? {
                prizeAmount: Number(currentTop.bidAmount),
                bidDiscount: Number(currentTop.bidDiscount),
                memberName: currentTop.member.customer.name,
                ticketNo: currentTop.member.ticketNo,
              }
            : null,
          bidBounds,
          bellState,
          waitingMembers,
        }
      : null,
    settlements,
    mySummary,
    messages: rawMessages.map(formatRoomMessage),
  };
}
