// Single source of truth for placing a chit-auction bid — shared by the staff
// web dashboard action and the mobile REST route so both write bids the same
// way (eligibility, discount limits, reserve floor, anti-snipe, source/transcript audit).
import { antiSnipeExtension, isRoomOpen } from './liveAuction';
import { syncRoom } from './bell';
import { assertMonotonicBidDirection, assertValidPrizeAmount, startingDiscountAmount } from './validation';
import { roundMoney } from './calculations';
import { calculateReserveFloor } from './engineCalculator';
import { isBiddingEnabledForPeriod, parseChitEngineConfig, resolveEngineTypeFromGroup } from './engineTypes';
import { postRoomBidEvent } from './groupRoom';

export type ChitBidSource = 'tap' | 'voice' | 'remote';

export type PlaceChitBidParams = {
  auction: {
    id: string;
    chitGroupId: string;
    periodNumber?: number;
    status: string;
    startedAt: Date | null;
    chitGroup: {
      chitValue: unknown;
      totalMembers?: number;
      auctionType: string;
      chitEngineType?: string | null;
      engineConfig?: string | null;
      maxDiscountPct: unknown;
      minDiscountPct: unknown;
      commissionPct: unknown;
      bidStartAtCommission?: boolean | null;
      bidIncrement: unknown;
      branchId: string | null;
    };
  };
  member: { id: string; customerId?: string | null; hasWon: boolean; subscriberStatus: string };
  prizeAmount: number;
  remarks?: string | null;
  source?: ChitBidSource;
  transcript?: string | null;
  audioDocumentId?: string | null;
  idempotencyKey?: string | null;
  createdById?: string | null;
  tenantId?: string | null;
  /** When true, prevents consecutive valid bids by the same customer across single or multiple tickets. */
  blockConsecutiveSelfBid?: boolean;
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

  const periodNumber = auction.periodNumber ?? 1;
  if (!isBiddingEnabledForPeriod(auction.chitGroup, periodNumber)) {
    throw new Error('This chit cycle uses a scheduled draw or fixed allocation — bids are not accepted.');
  }
  if (member.hasWon) throw new Error('This member has already won in this group');
  if (member.subscriberStatus !== 'active') throw new Error(`A ${member.subscriberStatus} ticket cannot bid`);

  const engineType = resolveEngineTypeFromGroup(auction.chitGroup);
  const config = parseChitEngineConfig(auction.chitGroup.engineConfig, engineType);
  const chitValueNum = Number(auction.chitGroup.chitValue);
  const uncapped = engineType === 'AUCTION_UNCAPPED_ENTERPRISE' || config.discountRules.uncapped;

  let reserveFloorPct: number | null = null;
  if (engineType === 'AUCTION_RESERVE_PRICE' && config.discountRules.reservePriceStepPct > 0) {
    reserveFloorPct = calculateReserveFloor({
      chitValue: chitValueNum,
      totalPeriods: auction.chitGroup.totalMembers ?? 20,
      periodNumber,
      reservePriceStepPct: config.discountRules.reservePriceStepPct,
      maxDiscountPct: uncapped ? null : auction.chitGroup.maxDiscountPct ? Number(auction.chitGroup.maxDiscountPct) : null,
    }).reserveFloorPct;
  }

  assertValidPrizeAmount({
    chitValue: chitValueNum,
    prizeAmount,
    maxDiscountPct: auction.chitGroup.maxDiscountPct ? Number(auction.chitGroup.maxDiscountPct) : null,
    minDiscountPct: auction.chitGroup.minDiscountPct ? Number(auction.chitGroup.minDiscountPct) : null,
    commissionPct: Number(auction.chitGroup.commissionPct),
    bidStartAtCommission: auction.chitGroup.bidStartAtCommission,
    reserveFloorPct,
    uncapped,
  });
  const bidDiscount = chitValueNum - prizeAmount;

  // Live / manual-bell rooms: lazily evaluate bells + close on expiry, require Start Live Now (open room),
  // apply anti-snipe extension, and reject bids once a 3rd bell has closed the room until re-opened.
  if (auction.chitGroup.auctionType === 'open_live') {
    await syncRoom(tx, auction.id);
    const fresh = await tx.chitAuction.findUnique({
      where: { id: auction.id },
      select: { roomStatus: true, biddingClosesAt: true, autoExtendSeconds: true },
    });
    if (!fresh) {
      throw new Error('Bidding room is not open — press Start Live Now before placing bids.');
    }
    if (fresh.roomStatus === 'paused') {
      throw new Error('Auction is currently paused — resume the auction before placing bids.');
    }
    if (!isRoomOpen(fresh)) {
      throw new Error('Bidding room is not open — press Start Live Now before placing bids.');
    }
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
  } else if (auction.chitGroup.auctionType === 'open_manual') {
    await syncRoom(tx, auction.id);
    const fresh = await tx.chitAuction.findUnique({
      where: { id: auction.id },
      select: {
        roomStatus: true,
        biddingClosesAt: true,
        autoExtendSeconds: true,
        bellsRung: true,
        chitGroup: { select: { bellCount: true } },
      },
    });
    if (fresh) {
      const bellClosed = fresh.bellsRung >= (fresh.chitGroup?.bellCount ?? 3) && fresh.roomStatus === 'closed';
      if (bellClosed) {
        throw new Error('Final 3rd bell closed bidding — confirm the winner or re-open the room (+5m) first.');
      }
      if (fresh.roomStatus === 'paused') {
        throw new Error('Auction is currently paused — resume the auction before placing bids.');
      }
      if (!isRoomOpen(fresh)) {
        throw new Error('Bidding room is not open — press Start Live Now before placing bids.');
      }
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
  }

  // Automated monotonic direction + increment enforcement for non-sealed auctions.
  // Exact-cap bids remain accepted so statutory cap ties can still resolve via tieBreakRule.
  const incrementStep = auction.chitGroup.bidIncrement
    ? Number(auction.chitGroup.bidIncrement)
    : config.discountRules.bidIncrementMultiple > 0
      ? config.discountRules.bidIncrementMultiple
      : 0;
  const capDiscount =
    !uncapped && auction.chitGroup.maxDiscountPct
      ? roundMoney((chitValueNum * Number(auction.chitGroup.maxDiscountPct)) / 100)
      : null;
  const highestBidRow = await tx.chitBid.findFirst({
    where: { auctionId: auction.id, status: 'valid' },
    orderBy: [{ bidDiscount: 'desc' }, { bidTime: 'asc' }],
    select: {
      memberId: true,
      bidDiscount: true,
      member: { select: { customerId: true } },
    },
  });
  const currentHighest = highestBidRow?.bidDiscount ? Number(highestBidRow.bidDiscount) : 0;

  if (
    params.blockConsecutiveSelfBid &&
    auction.chitGroup.auctionType !== 'sealed' &&
    highestBidRow
  ) {
    const leaderCustomerId = highestBidRow.member?.customerId;
    const sameMember = highestBidRow.memberId === member.id;
    const sameCustomer = Boolean(
      leaderCustomerId && member.customerId && leaderCustomerId === member.customerId,
    );
    if (sameMember || sameCustomer) {
      throw new Error(
        'Consecutive bids by the same customer are turned off — another member must bid next, or toggle Repeat Self-Bid ON.',
      );
    }
  }
  assertMonotonicBidDirection({
    chitValue: chitValueNum,
    bidDiscount,
    currentHighestDiscount: currentHighest,
    incrementStep,
    maxDiscountCap: capDiscount,
    auctionType: auction.chitGroup.auctionType,
    strictBidMultiple: Boolean(config.discountRules.strictBidMultiple),
    startingDiscount: startingDiscountAmount(chitValueNum, {
      minDiscountPct: auction.chitGroup.minDiscountPct ? Number(auction.chitGroup.minDiscountPct) : null,
      bidStartAtCommission: auction.chitGroup.bidStartAtCommission,
      commissionPct: Number(auction.chitGroup.commissionPct),
      reserveFloorPct,
    }),
  });

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
  const now = new Date();
  await tx.chitAuction.update({
    where: { id: auction.id },
    data: {
      status: auction.status === 'pending' ? 'in_progress' : auction.status,
      startedAt: auction.startedAt ?? now,
      // Any new valid bid resets the "going once / going twice / sold" bell count for both live & manual-bell rooms.
      ...(['open_live', 'open_manual'].includes(auction.chitGroup.auctionType)
        ? { bellAnchorAt: now, bellsRung: 0 }
        : {}),
    },
  });

  if (params.tenantId) {
    const memberInfo = await tx.chitMember.findUnique({
      where: { id: member.id },
      select: { ticketNo: true, memberNumber: true, customer: { select: { name: true } } },
    });
    await postRoomBidEvent(tx, {
      tenantId: params.tenantId,
      chitGroupId: auction.chitGroupId,
      auctionId: auction.id,
      periodNumber,
      ticketNo: memberInfo?.ticketNo ?? (memberInfo ? String(memberInfo.memberNumber) : null),
      memberId: member.id,
      memberName: memberInfo?.customer?.name ?? 'Member',
      prizeAmount,
      bidDiscount,
      source,
    });
  }

  return created;
}
