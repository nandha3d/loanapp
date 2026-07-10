// Single source of truth for placing a chit-auction bid — shared by the staff
// web dashboard action and the mobile REST route so both write bids the same
// way (eligibility, discount limits, anti-snipe, source/transcript audit).
import { antiSnipeExtension, closeRoomIfExpired, isRoomOpen } from './liveAuction';
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

  if (['confirmed', 'paid', 'cancelled'].includes(auction.status)) throw new Error('Auction is locked');
  if (['lottery', 'fixed_rotation'].includes(auction.chitGroup.auctionType)) {
    throw new Error('This chit uses a draw — bids are not accepted. Use the draw action instead.');
  }
  if (member.hasWon) throw new Error('This member has already won in this group');
  if (member.subscriberStatus !== 'active') throw new Error(`A ${member.subscriberStatus} ticket cannot bid`);

  assertValidPrizeAmount({
    chitValue: Number(auction.chitGroup.chitValue),
    prizeAmount,
    maxDiscountPct: auction.chitGroup.maxDiscountPct ? Number(auction.chitGroup.maxDiscountPct) : null,
    minDiscountPct: auction.chitGroup.minDiscountPct ? Number(auction.chitGroup.minDiscountPct) : null,
    commissionPct: Number(auction.chitGroup.commissionPct),
  });
  const bidDiscount = Number(auction.chitGroup.chitValue) - prizeAmount;

  // Live room: lazily close on expiry, require an open room, apply anti-snipe extension.
  if (auction.chitGroup.auctionType === 'open_live') {
    await closeRoomIfExpired(tx, auction.id);
    const fresh = await tx.chitAuction.findUnique({
      where: { id: auction.id },
      select: { roomStatus: true, biddingClosesAt: true, autoExtendSeconds: true },
    });
    if (!fresh || !isRoomOpen(fresh)) throw new Error('Bidding room is not open');
    const extendedClose = antiSnipeExtension(fresh);
    if (extendedClose) {
      await tx.chitAuction.update({
        where: { id: auction.id },
        data: { biddingClosesAt: extendedClose, roomStatus: 'extended' },
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
      throw new Error(`Bid discount must exceed the current highest (${currentHighest}) by at least ${Number(auction.chitGroup.bidIncrement)}`);
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
    data: { status: auction.status === 'pending' ? 'in_progress' : auction.status, startedAt: auction.startedAt ?? new Date() },
  });
  return created;
}
