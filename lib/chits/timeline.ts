// Merged, chronological, audience-scoped auction timeline: every bid, every
// bell, room open/extend/close, passes/retractions, and the winner event —
// the "complete bid/bell history by time, by whom" the client asked for.
import prisma from '../db';

export type TimelineEntry = {
  kind: 'bid' | 'event' | 'message';
  id: string;
  createdAt: Date;
  // bid
  memberId?: string | null;
  memberName?: string | null;
  ticketNo?: string | null;
  bidAmount?: number;
  bidDiscount?: number;
  bidStatus?: string;
  bidSource?: string;
  // event
  type?: string; // open | extend | bell | pass | close | winner | cancel
  message?: string | null;
  amount?: number | null;
  // message
  senderName?: string | null;
  body?: string | null;
  visibility?: string;
  actorName?: string | null;
};

export async function buildAuctionTimeline(
  auctionId: string,
  opts: { audience: 'staff' | 'member'; memberId?: string; cursor?: string; limit?: number },
) {
  const limit = Math.min(opts.limit ?? 100, 300);

  const auction = await prisma.chitAuction.findUnique({
    where: { id: auctionId },
    select: {
      startedAt: true,
      completedAt: true,
      chitGroup: { select: { auctionType: true } },
    },
  });
  if (!auction) return null;
  const sealed = auction.chitGroup.auctionType === 'sealed';

  const [bids, events, messages] = await Promise.all([
    prisma.chitBid.findMany({
      where: { auctionId },
      include: { member: { include: { customer: { select: { name: true } } } } },
      orderBy: { bidTime: 'desc' },
      take: limit,
    }),
    prisma.chitAuctionEvent.findMany({
      where: { auctionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    opts.audience === 'staff'
      ? prisma.chitRoomMessage.findMany({ where: { auctionId }, orderBy: { createdAt: 'desc' }, take: limit })
      : prisma.chitRoomMessage.findMany({ where: { auctionId, visibility: 'public' }, orderBy: { createdAt: 'desc' }, take: limit }),
  ]);

  // createdById on ChitBid/ChitAuctionEvent is a plain scalar (no Prisma
  // relation, matching the AccountEntry convention) — resolve actor names
  // with one batched lookup instead of per-row includes.
  const actorIds = Array.from(
    new Set([...bids.map((b) => b.createdById), ...events.map((e) => e.createdById)].filter((id): id is string => !!id)),
  );
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const actorNameById = new Map(actors.map((a) => [a.id, a.name]));

  // Member audience on a still-open sealed auction: hide bid amounts/who's-
  // leading, matching the exact rule already used by getLiveAuctionState /
  // buildCustomerLiveState — never let the timeline become a side-channel.
  const stillSealed = sealed && !auction.completedAt;
  const redactBids = opts.audience === 'member' && stillSealed;

  const entries: TimelineEntry[] = [];

  for (const b of bids) {
    entries.push({
      kind: 'bid',
      id: b.id,
      createdAt: b.bidTime,
      memberId: b.memberId,
      memberName: b.member.customer.name,
      ticketNo: b.member.ticketNo,
      bidAmount: redactBids ? undefined : Number(b.bidAmount),
      bidDiscount: redactBids ? undefined : Number(b.bidDiscount),
      bidStatus: b.status,
      bidSource: b.source ?? 'tap',
      actorName: b.createdById ? actorNameById.get(b.createdById) ?? null : null,
    });
  }
  for (const e of events) {
    entries.push({
      kind: 'event',
      id: e.id,
      createdAt: e.createdAt,
      type: e.type,
      message: e.message,
      memberId: e.memberId,
      amount: e.amount != null ? Number(e.amount) : null,
      actorName: e.createdById ? actorNameById.get(e.createdById) ?? null : null,
    });
  }
  for (const m of messages) {
    entries.push({
      kind: 'message',
      id: m.id,
      createdAt: m.createdAt,
      senderName: m.senderName,
      body: m.body,
      visibility: m.visibility,
    });
  }

  // Historical auctions with no events yet (everything that ran before this
  // shipped) — synthesize a minimal open/close pair from startedAt/completedAt
  // so old auctions still show something, clearly labeled as reconstructed.
  if (events.length === 0 && (auction.startedAt || auction.completedAt)) {
    if (auction.startedAt) {
      entries.push({ kind: 'event', id: `reconstructed-open-${auctionId}`, createdAt: auction.startedAt, type: 'open', message: 'Room opened (reconstructed)' });
    }
    if (auction.completedAt) {
      entries.push({ kind: 'event', id: `reconstructed-close-${auctionId}`, createdAt: auction.completedAt, type: 'close', message: 'Auction completed (reconstructed)' });
    }
  }

  entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return { entries: entries.slice(0, limit), sealed: stillSealed };
}
