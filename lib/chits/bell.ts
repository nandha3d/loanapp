// Organizer bell ("going once / going twice / sold") — a traditional physical
// chit-auction mechanic layered on the polling live room. Bells are lazily
// evaluated from timestamps on every poll/bid, exactly like closeRoomIfExpired
// (lib/chits/liveAuction.ts) — never setTimeout/cron, since the room has no
// server-side timer, only client polls.
import { closeRoomIfExpired, closeAuctionRoom } from './liveAuction';

export type BellState = {
  bellsRung: number;
  bellCount: number;
  nextBellAt: Date | null; // null once bellsRung === bellCount or bells are disabled
  intervalSeconds: number;
  enabled: boolean;
  autoClose: boolean;
};

// Lazy, timestamp-derived bell advancement. Call this (via syncRoom, below)
// on every poll and before every bid so a client landing shortly after a bell
// was "due" is the one that actually writes it.
export async function evaluateBells(tx: any, auctionId: string, now = new Date()) {
  const fresh = await tx.chitAuction.findUnique({
    where: { id: auctionId },
    select: {
      id: true,
      roomStatus: true,
      bellAnchorAt: true,
      bellsRung: true,
      chitGroup: { select: { bellEnabled: true, bellIntervalSeconds: true, bellCount: true, bellAutoClose: true } },
    },
  });
  if (!fresh || !['open', 'extended'].includes(fresh.roomStatus)) return fresh;
  const g = fresh.chitGroup;
  if (!g.bellEnabled || !fresh.bellAnchorAt) return fresh;

  const elapsedIntervals = Math.floor((now.getTime() - fresh.bellAnchorAt.getTime()) / (g.bellIntervalSeconds * 1000));
  const due = Math.min(g.bellCount, Math.max(0, elapsedIntervals));
  if (due <= fresh.bellsRung) return fresh;

  // Optimistic-concurrency guard: only advance if bellsRung still matches what
  // we just read, so two overlapping poll requests can't both write duplicate
  // bell events for the same interval.
  const updated = await tx.chitAuction.updateMany({
    where: { id: auctionId, bellsRung: fresh.bellsRung },
    data: { bellsRung: due },
  });
  if (updated.count === 0) return fresh; // lost the race — another request already advanced it

  // One event per bell number crossed (handles a poll that skipped over more
  // than one interval, e.g. a tab left idle). Backdated to the actual due
  // time (not "now") so the timeline (doc 17) reads in the right order.
  for (let n = fresh.bellsRung + 1; n <= due; n++) {
    await tx.chitAuctionEvent.create({
      data: {
        auctionId,
        type: 'bell',
        message: `Bell ${n} of ${g.bellCount}`,
        createdAt: new Date(fresh.bellAnchorAt.getTime() + n * g.bellIntervalSeconds * 1000),
      },
    });
  }

  if (due >= g.bellCount && g.bellAutoClose) {
    await closeAuctionRoom(tx, auctionId);
    await tx.chitAuctionEvent.create({
      data: { auctionId, type: 'close', message: 'Auto-closed (sold on the final bell)' },
    });
  }

  return { ...fresh, bellsRung: due };
}

// Manual ring (staff action). Re-anchors so the NEXT automatic bell lands
// exactly one interval after this manual ring, rather than being skipped or
// duplicated by the lazy evaluator on the following poll.
export async function ringBellManually(tx: any, auctionId: string, byUserId: string | null, now = new Date()) {
  const fresh = await tx.chitAuction.findUnique({
    where: { id: auctionId },
    select: {
      id: true,
      roomStatus: true,
      bellsRung: true,
      chitGroup: { select: { bellCount: true, bellAutoClose: true } },
    },
  });
  if (!fresh) throw new Error('Auction not found');
  if (!['open', 'extended'].includes(fresh.roomStatus)) throw new Error('Bidding room is not open');
  if (fresh.bellsRung >= fresh.chitGroup.bellCount) throw new Error('Final bell already rung');

  const nextCount = fresh.bellsRung + 1;
  await tx.chitAuction.update({
    where: { id: auctionId },
    data: { bellsRung: nextCount, bellAnchorAt: now },
  });
  await tx.chitAuctionEvent.create({
    data: {
      auctionId,
      type: 'bell',
      message: `Bell ${nextCount} of ${fresh.chitGroup.bellCount} (manual)`,
      createdById: byUserId ?? undefined,
      createdAt: now,
    },
  });

  if (nextCount >= fresh.chitGroup.bellCount && fresh.chitGroup.bellAutoClose) {
    await closeAuctionRoom(tx, auctionId);
    await tx.chitAuctionEvent.create({
      data: { auctionId, type: 'close', message: 'Auto-closed (sold on the final bell)' },
    });
  }
}

// Single call site replacing every bare closeRoomIfExpired(tx, auctionId) —
// evaluates bells first (which may itself close the room via bellAutoClose),
// then applies the existing deadline-based auto-close on top.
export async function syncRoom(tx: any, auctionId: string, now = new Date()) {
  await evaluateBells(tx, auctionId, now);
  return closeRoomIfExpired(tx, auctionId, now);
}

export async function buildBellState(auction: {
  roomStatus: string;
  bellAnchorAt: Date | null;
  bellsRung: number;
  chitGroup: { bellEnabled: boolean; bellIntervalSeconds: number; bellCount: number; bellAutoClose: boolean };
}): Promise<BellState> {
  const g = auction.chitGroup;
  const roomLive = ['open', 'extended'].includes(auction.roomStatus);
  const nextBellAt =
    roomLive && g.bellEnabled && auction.bellAnchorAt && auction.bellsRung < g.bellCount
      ? new Date(auction.bellAnchorAt.getTime() + (auction.bellsRung + 1) * g.bellIntervalSeconds * 1000)
      : null;
  return {
    bellsRung: auction.bellsRung,
    bellCount: g.bellCount,
    nextBellAt,
    intervalSeconds: g.bellIntervalSeconds,
    enabled: g.bellEnabled,
    autoClose: g.bellAutoClose,
  };
}
