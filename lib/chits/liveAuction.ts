// Live auction room ("live beat") helpers for auctionType = open_live / open_manual / sealed.
// Deliberate polling architecture — no sockets/SSE; the room is driven by
// 2-3s client polls and a lazy close/open that runs on request timestamps.

import type { Prisma } from '@prisma/client';
import { isBiddingEnabledForPeriod, parseChitEngineConfig, resolveEngineTypeFromGroup } from './engineTypes';

export type ChitRoomStatus = 'scheduled' | 'open' | 'extended' | 'paused' | 'closed';

export function isRoomOpen(auction: { roomStatus: string; biddingClosesAt?: Date | null }, now = new Date()) {
  if (!['open', 'extended'].includes(auction.roomStatus)) return false;
  if (auction.biddingClosesAt && now.getTime() > auction.biddingClosesAt.getTime()) return false;
  return true;
}

export function secondsRemaining(
  auction: { roomStatus?: string; countdownSeconds?: number | null; biddingClosesAt?: Date | null },
  now = new Date(),
) {
  if (auction.roomStatus === 'paused') {
    return Math.max(0, Number(auction.countdownSeconds ?? 0));
  }
  if (auction.roomStatus === 'closed') return 0;
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

export async function openAuctionRoom(tx: Prisma.TransactionClient, params: {
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
export async function closeRoomIfExpired(tx: Prisma.TransactionClient, auctionId: string, now = new Date()) {
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
  tx: Prisma.TransactionClient,
  auctionId: string,
  opts: { reason?: string; closedById?: string | null } = {},
) {
  const fresh = await tx.chitAuction.findUnique({
    where: { id: auctionId },
    select: { id: true, roomStatus: true, status: true },
  });
  if (!fresh) throw new Error('Auction not found');
  if (!['open', 'extended', 'paused'].includes(fresh.roomStatus)) throw new Error('Room is not open');
  const updated = await tx.chitAuction.update({
    where: { id: auctionId },
    data: {
      roomStatus: 'closed',
      biddingClosesAt: new Date(),
      countdownSeconds: null,
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

/**
 * Freezes the entire live auction process (both room clock and bell idle countdown)
 * while holding current remaining time cleanly for later resume.
 */
export async function pauseAuctionRoom(
  tx: Prisma.TransactionClient,
  auctionId: string,
  opts: { byUserId?: string | null; now?: Date } = {},
) {
  const now = opts.now ?? new Date();
  const fresh = await tx.chitAuction.findUnique({
    where: { id: auctionId },
    select: {
      id: true,
      roomStatus: true,
      biddingClosesAt: true,
      bellAnchorAt: true,
      bellsRung: true,
      chitGroup: { select: { bellIntervalSeconds: true } },
    },
  });
  if (!fresh) throw new Error('Auction not found');
  if (!['open', 'extended'].includes(fresh.roomStatus)) {
    throw new Error('Room must be live before pausing');
  }

  const remainingRoomSec = fresh.biddingClosesAt
    ? Math.max(1, Math.ceil((fresh.biddingClosesAt.getTime() - now.getTime()) / 1000))
    : 0;
  const intervalMs = Math.max(5, fresh.chitGroup?.bellIntervalSeconds || 30) * 1000;
  const bellAnchorMs = fresh.bellAnchorAt ? fresh.bellAnchorAt.getTime() : now.getTime();
  const elapsedTotalMs = Math.max(0, now.getTime() - bellAnchorMs);
  const elapsedCycleMs = Math.min(intervalMs, Math.max(0, elapsedTotalMs - fresh.bellsRung * intervalMs));
  const bellRemainingSec = Math.max(1, Math.ceil((intervalMs - elapsedCycleMs) / 1000));

  const updated = await tx.chitAuction.update({
    where: { id: auctionId },
    data: {
      roomStatus: 'paused',
      countdownSeconds: remainingRoomSec,
    },
  });
  await tx.chitAuctionEvent.create({
    data: {
      auctionId,
      type: 'pause',
      message: 'Auction paused — timer & bells held',
      amount: bellRemainingSec,
      createdById: opts.byUserId ?? undefined,
      createdAt: now,
    },
  });
  return { auction: updated, remainingRoomSec, bellRemainingSec };
}

/**
 * Resumes a paused auction room cleanly from its saved remaining room & bell timers.
 */
export async function resumeAuctionRoom(
  tx: Prisma.TransactionClient,
  auctionId: string,
  opts: { byUserId?: string | null; now?: Date } = {},
) {
  const now = opts.now ?? new Date();
  const fresh = await tx.chitAuction.findUnique({
    where: { id: auctionId },
    select: {
      id: true,
      roomStatus: true,
      countdownSeconds: true,
      bellsRung: true,
      chitGroup: { select: { bellIntervalSeconds: true } },
    },
  });
  if (!fresh) throw new Error('Auction not found');
  if (fresh.roomStatus !== 'paused') {
    throw new Error('Auction is not currently paused');
  }

  const latestPause = await tx.chitAuctionEvent.findFirst({
    where: { auctionId, type: 'pause' },
    orderBy: { createdAt: 'desc' },
    select: { amount: true },
  });

  const remainingRoomSec = Math.max(1, Number(fresh.countdownSeconds ?? 300));
  const intervalMs = Math.max(5, fresh.chitGroup?.bellIntervalSeconds || 30) * 1000;
  const bellRemainingMs =
    latestPause?.amount != null
      ? Math.min(intervalMs, Math.max(1000, Number(latestPause.amount) * 1000))
      : intervalMs;
  const elapsedInCycleMs = intervalMs - bellRemainingMs;
  const restoredBellAnchor = new Date(now.getTime() - (fresh.bellsRung * intervalMs + elapsedInCycleMs));
  const nextClose = new Date(now.getTime() + remainingRoomSec * 1000);

  const updated = await tx.chitAuction.update({
    where: { id: auctionId },
    data: {
      roomStatus: 'open',
      biddingClosesAt: nextClose,
      bellAnchorAt: restoredBellAnchor,
      countdownSeconds: null,
    },
  });
  await tx.chitAuctionEvent.create({
    data: {
      auctionId,
      type: 'resume',
      message: 'Auction resumed',
      createdById: opts.byUserId ?? undefined,
      createdAt: now,
    },
  });
  return updated;
}

/** Extends an active auction window forward by `extraMinutes` (Meet/Zoom-style live extend). */
export async function extendAuctionRoomMinutes(
  tx: Prisma.TransactionClient,
  params: {
    auctionId: string;
    extraMinutes: number;
    byUserId?: string | null;
    now?: Date;
  },
) {
  const now = params.now ?? new Date();
  const extraMinutes = Math.round(params.extraMinutes);
  if (!(extraMinutes > 0)) throw new Error('Extension minutes must be greater than zero');

  const fresh = await tx.chitAuction.findUnique({
    where: { id: params.auctionId },
    select: { id: true, roomStatus: true, biddingClosesAt: true, countdownSeconds: true, status: true },
  });
  if (!fresh) throw new Error('Auction not found');
  if (!['open', 'extended', 'paused'].includes(fresh.roomStatus)) {
    throw new Error('Room must be open before adding extra minutes');
  }

  const updated =
    fresh.roomStatus === 'paused'
      ? await tx.chitAuction.update({
          where: { id: params.auctionId },
          data: {
            countdownSeconds: Math.max(0, Number(fresh.countdownSeconds ?? 0)) + extraMinutes * 60,
          },
        })
      : await tx.chitAuction.update({
          where: { id: params.auctionId },
          data: {
            biddingClosesAt: new Date(
              (fresh.biddingClosesAt && fresh.biddingClosesAt.getTime() > now.getTime()
                ? fresh.biddingClosesAt
                : now
              ).getTime() +
                extraMinutes * 60_000,
            ),
            roomStatus: 'extended',
          },
        });
  await tx.chitAuctionEvent.create({
    data: {
      auctionId: params.auctionId,
      type: 'extend',
      message: `+${extraMinutes} min added`,
      amount: extraMinutes * 60,
      createdById: params.byUserId ?? undefined,
      createdAt: now,
    },
  });
  return updated;
}

/**
 * Re-opens a closed (but unconfirmed) auction room and resets the 3-bell counter
 * to 0 so further bids can be placed if the foreman decides to continue.
 */
export async function reopenAuctionRoom(
  tx: Prisma.TransactionClient,
  params: {
    auctionId: string;
    durationMinutes?: number;
    byUserId?: string | null;
    now?: Date;
  },
) {
  const now = params.now ?? new Date();
  const durationMinutes = Math.max(1, Math.round(params.durationMinutes ?? 5));
  const fresh = await tx.chitAuction.findUnique({
    where: { id: params.auctionId },
    select: { id: true, status: true, roomStatus: true },
  });
  if (!fresh) throw new Error('Auction not found');
  if (['confirmed', 'paid', 'cancelled'].includes(fresh.status)) {
    throw new Error('Cannot re-open an already confirmed auction');
  }

  const nextClose = new Date(now.getTime() + durationMinutes * 60_000);
  const updated = await tx.chitAuction.update({
    where: { id: params.auctionId },
    data: {
      roomStatus: 'open',
      status: 'in_progress',
      biddingClosesAt: nextClose,
      bellAnchorAt: now,
      bellsRung: 0,
    },
  });
  await tx.chitAuctionEvent.create({
    data: {
      auctionId: params.auctionId,
      type: 'open',
      message: `Room re-opened (+${durationMinutes} min) — bells reset`,
      createdById: params.byUserId ?? undefined,
      createdAt: now,
    },
  });
  return updated;
}

/**
 * Lazy timestamp-triggered auto-open: when `meetingSchedule.autoStartAtScheduledTime`
 * is enabled and the scheduled start window has arrived (before scheduled end),
 * transitions the room from `'scheduled'` to `'open'` atomically.
 */
export async function openScheduledRoomIfDue(tx: Prisma.TransactionClient, auctionId: string, now = new Date()) {
  const fresh = await tx.chitAuction.findUnique({
    where: { id: auctionId },
    select: {
      id: true,
      periodNumber: true,
      roomStatus: true,
      status: true,
      scheduledAt: true,
      chitGroup: {
        select: {
          auctionType: true,
          chitEngineType: true,
          engineConfig: true,
          hasForemanTicket: true,
        },
      },
    },
  });
  if (!fresh || !fresh.scheduledAt) return null;
  if (fresh.roomStatus !== 'scheduled') return fresh.roomStatus;
  if (!['pending', 'notice_sent'].includes(fresh.status)) return fresh.roomStatus;
  if (!['open_live', 'open_manual', 'sealed'].includes(fresh.chitGroup.auctionType)) {
    return fresh.roomStatus;
  }
  if (!isBiddingEnabledForPeriod(fresh.chitGroup, fresh.periodNumber)) {
    return fresh.roomStatus;
  }

  const engineType = resolveEngineTypeFromGroup(fresh.chitGroup);
  const cfg = parseChitEngineConfig(fresh.chitGroup.engineConfig, engineType);
  if (!cfg.meetingSchedule?.autoStartAtScheduledTime) {
    return fresh.roomStatus;
  }

  const durationMin = Math.max(5, Math.min(240, cfg.meetingSchedule.defaultDurationMinutes || 30));
  const startMs = fresh.scheduledAt.getTime();
  const windowEnd = new Date(startMs + durationMin * 60_000);
  if (now.getTime() < startMs || now.getTime() >= windowEnd.getTime()) {
    return fresh.roomStatus;
  }

  const claimed = await tx.chitAuction.updateMany({
    where: { id: auctionId, roomStatus: 'scheduled' },
    data: {
      roomStatus: 'open',
      biddingOpensAt: now,
      biddingClosesAt: windowEnd,
      status: 'in_progress',
      startedAt: now,
      bellAnchorAt: now,
      bellsRung: 0,
    },
  });
  if (claimed.count === 1) {
    await tx.chitAuctionEvent.create({
      data: {
        auctionId,
        type: 'open',
        message: 'Auto-opened at scheduled time',
        createdAt: now,
      },
    });
    return 'open' as ChitRoomStatus;
  }
  return fresh.roomStatus;
}
