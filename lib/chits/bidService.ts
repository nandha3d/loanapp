import { HttpError } from '@/lib/httpError';
// Single source of truth for placing a chit-auction bid — shared by the staff
// web dashboard action and the mobile REST route so both write bids the same
// way (eligibility, discount limits, anti-snipe, source/transcript audit).
import { antiSnipeExtension, isRoomOpen } from './liveAuction';
import { syncRoom } from './bell';
import { assertValidPrizeAmount } from './validation';
import { roundMoney } from './calculations';

export type ChitBidSource = 'tap' | 'voice' | 'remote';

export type PlaceChitBidParams = {
  auction: {
    id: string;
    chitGroupId: string;
    status: string;
    startedAt: Date | null;
    chitGroup: {
      chitValue: unknown;
      auctionType: string;
      maxDiscountPct: unknown;
      minDiscountPct: unknown;
      commissionPct: unknown;
      bidStartAtCommission?: boolean | null;
      bidIncrement: unknown;
      branchId: string | null;
    };
  };
  member: { id: string; hasWon: boolean; subscriberStatus: string };
  prizeAmount: number;
  remarks?: string | null;
  source?: ChitBidSource;
  transcript?: string | null;
  audioDocumentId?: string | null;
  idempotencyKey?: string | null;
  createdById?: string | null;
  tenantId?: string | null;
};

export async function placeChitBid(tx: any, params: PlaceChitBidParams) {
  const { auction, member, prizeAmount } = params;
  const source: ChitBidSource = params.source ?? 'tap';

  if (params.idempotencyKey) {
    const existing = await tx.chitBid.findUnique({
      where: { auctionId_idempotencyKey: { auctionId: auction.id, idempotencyKey: params.idempotencyKey } },
    });
    if (existing) return existing;
  }

  if (['confirmed', 'paid', 'cancelled'].includes(auction.status)) throw new HttpError(409, 'Auction is locked');
  if (['lottery', 'fixed_rotation'].includes(auction.chitGroup.auctionType)) {
    throw new HttpError(409, 'This chit uses a draw — bids are not accepted. Use the draw action instead.');
  }
  if (member.hasWon) throw new HttpError(409, 'This member has already won in this group');
  if (member.subscriberStatus !== 'active') throw new HttpError(400, `A ${member.subscriberStatus} ticket cannot bid`);

  assertValidPrizeAmount({
    chitValue: Number(auction.chitGroup.chitValue),
    prizeAmount,
    maxDiscountPct: auction.chitGroup.maxDiscountPct ? Number(auction.chitGroup.maxDiscountPct) : null,
    minDiscountPct: auction.chitGroup.minDiscountPct ? Number(auction.chitGroup.minDiscountPct) : null,
    commissionPct: Number(auction.chitGroup.commissionPct),
    bidStartAtCommission: auction.chitGroup.bidStartAtCommission,
  });
  const bidDiscount = Number(auction.chitGroup.chitValue) - prizeAmount;

  // Live room: lazily evaluate bells + close on expiry, require an open room,
  // apply anti-snipe extension.
  if (auction.chitGroup.auctionType === 'open_live') {
    await syncRoom(tx, auction.id);
    const fresh = await tx.chitAuction.findUnique({
      where: { id: auction.id },
      select: { roomStatus: true, biddingClosesAt: true, autoExtendSeconds: true },
    });
    if (!fresh || !isRoomOpen(fresh)) throw new HttpError(409, 'Bidding room is not open');
    const extendedClose = antiSnipeExtension(fresh);
    if (extendedClose) {
      await tx.chitAuction.update({
        where: { id: auction.id },
        data: { biddingClosesAt: extendedClose, roomStatus: 'extended' },
      });
      await tx.chitAuctionEvent.create({
        data: {
          auctionId: auction.id,
          type: 'extend',
          message: 'Anti-snipe extension',
          amount: fresh.autoExtendSeconds,
        },
      });
    }
  }

  // Bid increment step; exact-cap bids always accepted so cap ties can form.
  if (auction.chitGroup.bidIncrement) {
    const capDiscount = auction.chitGroup.maxDiscountPct
      ? roundMoney((Number(auction.chitGroup.chitValue) * Number(auction.chitGroup.maxDiscountPct)) / 100)
      : null;
    const highest = await tx.chitBid.aggregate({
      where: { auctionId: auction.id, status: 'valid' },
      _max: { bidDiscount: true },
    });
    const currentHighest = highest._max.bidDiscount ? Number(highest._max.bidDiscount) : 0;
    const atCap = capDiscount != null && bidDiscount === capDiscount;
    if (!atCap && currentHighest > 0 && bidDiscount < currentHighest + Number(auction.chitGroup.bidIncrement)) {
      throw new HttpError(400, `Bid discount must exceed the current highest (${currentHighest}) by at least ${Number(auction.chitGroup.bidIncrement)}`);
    }
  }

  const created = await tx.chitBid.create({
    data: {
      tenantId: params.tenantId ?? undefined,
      branchId: auction.chitGroup.branchId,
      auctionId: auction.id,
      chitGroupId: auction.chitGroupId,
      memberId: member.id,
      bidAmount: prizeAmount,
      bidDiscount,
      source,
      transcript: params.transcript ?? null,
      audioDocumentId: params.audioDocumentId ?? null,
      idempotencyKey: params.idempotencyKey ?? null,
      remarks: params.remarks ?? null,
      createdById: params.createdById ?? undefined,
    },
  });
  await tx.chitAuction.update({
    where: { id: auction.id },
    data: {
      status: auction.status === 'pending' ? 'in_progress' : auction.status,
      startedAt: auction.startedAt ?? new Date(),
      // A new bid means the "going once/twice/sold" countdown starts over.
      ...(auction.chitGroup.auctionType === 'open_live' ? { bellAnchorAt: new Date(), bellsRung: 0 } : {}),
    },
  });
  return created;
}
/**
 * Record a bid that was AWARDED rather than competitively placed: the foreman
 * ticket taking period 1, and the winner of a lottery / fixed-rotation draw.
 *
 * CHIT-7 says a `ChitBid` row is never written directly, and the web action and
 * the mobile route each had their own `chitBid.create`. These awards deliberately
 * skip the competitive checks in `placeChitBid` (there is no room, no increment
 * and no rival bid to beat), so they get their own entry point here instead of
 * being forced through a validation path that does not describe them — but the
 * write itself lives in this service, where it can be found and audited.
 */
export async function recordAwardedChitBid(
  tx: any,
  input: {
    tenantId: string;
    branchId: string | null;
    auctionId: string;
    chitGroupId: string;
    memberId: string;
    bidAmount: number;
    bidDiscount: number;
    remarks: string;
    createdById?: string;
  },
) {
  return tx.chitBid.create({
    data: {
      tenantId: input.tenantId,
      branchId: input.branchId,
      auctionId: input.auctionId,
      chitGroupId: input.chitGroupId,
      memberId: input.memberId,
      bidAmount: input.bidAmount,
      bidDiscount: input.bidDiscount,
      remarks: input.remarks,
      createdById: input.createdById,
    },
  });
}
