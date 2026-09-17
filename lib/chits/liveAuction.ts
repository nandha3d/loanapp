// Live auction room ("live beat") helpers for auctionType = open_live.
// Deliberate polling architecture — no sockets/SSE; the room is driven by
// 2-3s client polls and a lazy close that runs on the first request after expiry.

export type ChitRoomStatus = 'scheduled' | 'open' | 'extended' | 'closed';

export function isRoomOpen(auction: { roomStatus: string; biddingClosesAt?: Date | null }, now = new Date()) {
  if (!['open', 'extended'].includes(auction.roomStatus)) return false;
  if (auction.biddingClosesAt && now.getTime() > auction.biddingClosesAt.getTime()) return false;
  return true;
}

export function secondsRemaining(auction: { biddingClosesAt?: Date | null }, now = new Date()) {
  if (!auction.biddingClosesAt) return 0;
  return Math.max(0, Math.floor((auction.biddingClosesAt.getTime() - now.getTime()) / 1000));
}

// Anti-snipe: a bid landing within the final autoExtendSeconds pushes the close forward.
// Returns the new close time when an extension applies, else null.
export function antiSnipeExtension(
  auction: { biddingClosesAt?: Date | null; autoExtendSeconds: number },
  bidTime = new Date()
): Date | null {
  if (!auction.biddingClosesAt || auction.autoExtendSeconds <= 0) return null;
  const remainingMs = auction.biddingClosesAt.getTime() - bidTime.getTime();
  if (remainingMs <= 0 || remainingMs > auction.autoExtendSeconds * 1000) return null;
  return new Date(auction.biddingClosesAt.getTime() + auction.autoExtendSeconds * 1000);
}

export async function openAuctionRoom(tx: any, params: {
  auctionId: string;
  durationMinutes: number;
  autoExtendSeconds?: number;
  now?: Date;
  openedById?: string | null;
}) {
  const now = params.now ?? new Date();
  if (!(params.durationMinutes > 0)) throw new Error('Room duration must be greater than zero');
  const updated = await tx.chitAuction.update({
    where: { id: params.auctionId },
    data: {
      roomStatus: 'open',
      biddingOpensAt: now,
      biddingClosesAt: new Date(now.getTime() + params.durationMinutes * 60_000),
      autoExtendSeconds: params.autoExtendSeconds ?? 0,
      status: 'in_progress',
      startedAt: now,
      // Bell countdown starts fresh every time the room opens (doc 14).
      bellAnchorAt: now,
      bellsRung: 0,
    },
  });
  await tx.chitAuctionEvent.create({
    data: {
      auctionId: params.auctionId,
      type: 'open',
      message: 'Room opened',
      createdById: params.openedById ?? undefined,
      createdAt: now,
    },
  });
  return updated;
}

// Transaction-safe lazy close: re-reads the row inside the caller's transaction so two
// concurrent requests cannot double-close. Marks the room closed once time is up;
// winner selection stays with the confirm/draw flow — the room never moves money.
export async function closeRoomIfExpired(tx: any, auctionId: string, now = new Date()) {
  const fresh = await tx.chitAuction.findUnique({
    where: { id: auctionId },
    select: { id: true, roomStatus: true, biddingClosesAt: true, status: true },
  });
  if (!fresh) return null;
  if (!['open', 'extended'].includes(fresh.roomStatus)) return fresh.roomStatus as ChitRoomStatus;
  if (!fresh.biddingClosesAt || now.getTime() <= fresh.biddingClosesAt.getTime()) {
    return fresh.roomStatus as ChitRoomStatus;
  }
  await tx.chitAuction.update({
    where: { id: auctionId },
    data: {
      roomStatus: 'closed',
      status: fresh.status === 'in_progress' ? 'completed' : fresh.status,
    },
  });
  await tx.chitAuctionEvent.create({
    data: { auctionId, type: 'close', message: 'Auto-closed (time expired)', createdAt: now },
  });
  return 'closed' as ChitRoomStatus;
}

export async function closeAuctionRoom(
  tx: any,
  auctionId: string,
  opts: { reason?: string; closedById?: string | null } = {},
) {
  const fresh = await tx.chitAuction.findUnique({
    where: { id: auctionId },
    select: { id: true, roomStatus: true, status: true },
  });
  if (!fresh) throw new Error('Auction not found');
  if (!['open', 'extended'].includes(fresh.roomStatus)) throw new Error('Room is not open');
  const updated = await tx.chitAuction.update({
    where: { id: auctionId },
    data: {
      roomStatus: 'closed',
      biddingClosesAt: new Date(),
      status: fresh.status === 'in_progress' ? 'completed' : fresh.status,
    },
  });
  await tx.chitAuctionEvent.create({
    data: {
      auctionId,
      type: 'close',
      message: opts.reason ?? 'Manually closed',
      createdById: opts.closedById ?? undefined,
    },
  });
  return updated;
}
