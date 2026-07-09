import 'server-only';
import prisma from '@/lib/db';
import type { MobileApiContext } from '@/lib/api/v1-auth';
import { scopedBranchWhere } from '@/lib/api/v1-auth';

// Tunables for a live auction. Overridable per-auction via the `open` route.
export const DEFAULT_COUNTDOWN_SECONDS = 60;
// If a bid lands with less than this many seconds left, extend the clock (anti
// snipe) so everyone gets a fair chance to respond.
export const ANTI_SNIPE_SECONDS = 10;

export const LIVE_WRITE_ROLES = ['admin', 'superadmin', 'developer'];

export type ChitGroupLite = {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  chitValue: number;
  commissionPct: number;
  totalMembers: number;
};

/** Load a tenant/branch-scoped chit group by id, or null if not visible. */
export async function loadScopedGroup(
  chitGroupId: string,
  ctx: MobileApiContext,
): Promise<ChitGroupLite | null> {
  const group = await prisma.chitGroup.findFirst({
    where: { id: chitGroupId, tenantId: ctx.tenantId, ...scopedBranchWhere(ctx) },
    select: {
      id: true,
      tenantId: true,
      branchId: true,
      name: true,
      chitValue: true,
      commissionPct: true,
      totalMembers: true,
    },
  });
  if (!group) return null;
  return {
    id: group.id,
    tenantId: group.tenantId,
    branchId: group.branchId,
    name: group.name,
    chitValue: Number(group.chitValue),
    commissionPct: Number(group.commissionPct),
    totalMembers: group.totalMembers,
  };
}

/** Find (or create a pending stub for) the auction of a period. */
export async function ensureAuction(chitGroupId: string, periodNumber: number) {
  return prisma.chitAuction.upsert({
    where: { chitGroupId_periodNumber: { chitGroupId, periodNumber } },
    create: { chitGroupId, periodNumber, auctionDate: new Date(), status: 'pending' },
    update: {},
  });
}

/** Next monotonic bid sequence number for an auction. */
export async function nextSeq(auctionId: string): Promise<number> {
  const last = await prisma.chitBid.findFirst({
    where: { auctionId },
    orderBy: { seq: 'desc' },
    select: { seq: true },
  });
  return (last?.seq ?? 0) + 1;
}

export type LiveStatePayload = ReturnType<typeof buildStateShape>;

function buildStateShape(args: {
  auction: {
    id: string;
    status: string;
    periodNumber: number;
    startedAt: Date | null;
    endsAt: Date | null;
    countdownSeconds: number | null;
    minBidDecrement: unknown;
    currentBestBidId: string | null;
    winnerMemberId: string | null;
    prizeAmount: unknown;
    bidDiscount: unknown;
    commission: unknown;
    dividend: unknown;
  };
  group: ChitGroupLite;
  seats: Array<{
    memberId: string;
    memberNumber: number;
    name: string;
    customerCode: string;
    profilePhoto: string | null;
    hasWon: boolean;
    passed: boolean;
    latestPrize: number | null;
  }>;
  activeCount: number;
  currentBest: { bidId: string; memberId: string; prizeAmount: number; discountAmount: number } | null;
  minNextPrize: number;
  recentBids: Array<{
    id: string;
    memberId: string;
    prizeAmount: number;
    discountAmount: number;
    kind: string;
    source: string;
    createdAt: string;
  }>;
  allBids: Array<{
    id: string;
    memberId: string;
    prizeAmount: number;
    discountAmount: number;
    kind: string;
    source: string;
    createdAt: string;
  }>;
  memberBids: Record<string, Array<{
    id: string;
    memberId: string;
    prizeAmount: number;
    discountAmount: number;
    kind: string;
    source: string;
    createdAt: string;
  }>>;
  events: Array<{
    id: string;
    type: string;
    message: string | null;
    memberId: string | null;
    amount: number | null;
    createdAt: string;
  }>;
}) {
  const { auction, group, seats, activeCount, currentBest, minNextPrize, recentBids, allBids, memberBids, events } = args;
  return {
    auctionId: auction.id,
    periodNumber: auction.periodNumber,
    status: auction.status,
    serverNow: new Date().toISOString(),
    startedAt: auction.startedAt ? auction.startedAt.toISOString() : null,
    endsAt: auction.endsAt ? auction.endsAt.toISOString() : null,
    countdownSeconds: auction.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS,
    minBidDecrement: auction.minBidDecrement != null ? Number(auction.minBidDecrement) : 0,
    chitValue: group.chitValue,
    commissionPct: group.commissionPct,
    totalMembers: group.totalMembers,
    currentBest,
    minNextPrize,
    seats,
    activeCount,
    recentBids,
    allBids,
    memberBids,
    events,
    winner:
      auction.status === 'completed' && auction.winnerMemberId
        ? {
            memberId: auction.winnerMemberId,
            prizeAmount: auction.prizeAmount != null ? Number(auction.prizeAmount) : 0,
            bidDiscount: auction.bidDiscount != null ? Number(auction.bidDiscount) : 0,
            commission: auction.commission != null ? Number(auction.commission) : 0,
            dividend: auction.dividend != null ? Number(auction.dividend) : 0,
          }
        : null,
  };
}

/**
 * Builds the full live-auction state payload for a group+period. Select-heavy
 * but scoped to one auction — cheap enough for 1.5s polling; swappable to SSE.
 */
export async function buildLiveState(group: ChitGroupLite, periodNumber: number) {
  const auction = await prisma.chitAuction.findUnique({
    where: { chitGroupId_periodNumber: { chitGroupId: group.id, periodNumber } },
    select: {
      id: true,
      status: true,
      periodNumber: true,
      startedAt: true,
      endsAt: true,
      countdownSeconds: true,
      minBidDecrement: true,
      currentBestBidId: true,
      winnerMemberId: true,
      prizeAmount: true,
      bidDiscount: true,
      commission: true,
      dividend: true,
    },
  });

  const members = await prisma.chitMember.findMany({
    where: { chitGroupId: group.id },
    orderBy: { memberNumber: 'asc' },
    select: {
      id: true,
      memberNumber: true,
      hasWon: true,
      customer: { select: { name: true, customerCode: true, profilePhoto: true } },
    },
  });

  // No live session yet — return an idle shell so the client can show the seats
  // and an "Open auction" button without a second round-trip.
  const startedAt = auction?.startedAt ?? null;
  const bidWhere = {
    auctionId: auction?.id ?? '__none__',
    kind: { not: 'retracted' },
    ...(startedAt ? { createdAt: { gte: startedAt } } : {}),
  };

  const allBids = auction
    ? await prisma.chitBid.findMany({
        where: bidWhere,
        orderBy: { seq: 'asc' },
        select: {
          id: true,
          memberId: true,
          prizeAmount: true,
          discountAmount: true,
          kind: true,
          source: true,
          createdAt: true,
          seq: true,
        },
      })
    : [];

  // Per-member latest prize + passed flag.
  const latestPrize = new Map<string, number>();
  const passed = new Set<string>();
  for (const b of allBids) {
    if (b.kind === 'pass') passed.add(b.memberId);
    else if (b.kind === 'bid') {
      latestPrize.set(b.memberId, Number(b.prizeAmount));
      passed.delete(b.memberId); // a fresh bid re-activates (defensive)
    }
  }

  const seats = members.map((m) => ({
    memberId: m.id,
    memberNumber: m.memberNumber,
    name: m.customer?.name ?? '—',
    customerCode: m.customer?.customerCode ?? '',
    profilePhoto: m.customer?.profilePhoto ?? null,
    hasWon: m.hasWon,
    passed: passed.has(m.id),
    latestPrize: latestPrize.has(m.id) ? latestPrize.get(m.id)! : null,
  }));

  // Eligible = in this group, hasn't already won a prior period. Active = eligible
  // and not passed this round.
  const activeCount = seats.filter((s) => !s.hasWon && !s.passed).length;

  let currentBest: { bidId: string; memberId: string; prizeAmount: number; discountAmount: number } | null =
    null;
  if (auction?.currentBestBidId) {
    const best = allBids.find((b) => b.id === auction.currentBestBidId);
    if (best) {
      currentBest = {
        bidId: best.id,
        memberId: best.memberId,
        prizeAmount: Number(best.prizeAmount),
        discountAmount: Number(best.discountAmount),
      };
    }
  }

  const recentBids = allBids
    .slice(-20)
    .reverse()
    .map((b) => ({
      id: b.id,
      memberId: b.memberId,
      prizeAmount: Number(b.prizeAmount),
      discountAmount: Number(b.discountAmount),
      kind: b.kind,
      source: b.source,
      createdAt: b.createdAt.toISOString(),
    }));
  const exposedBids = allBids
    .slice(-200)
    .reverse()
    .map((b) => ({
      id: b.id,
      memberId: b.memberId,
      prizeAmount: Number(b.prizeAmount),
      discountAmount: Number(b.discountAmount),
      kind: b.kind,
      source: b.source,
      createdAt: b.createdAt.toISOString(),
    }));
  const memberBids = exposedBids.reduce<Record<string, typeof exposedBids>>((acc, bid) => {
    acc[bid.memberId] = acc[bid.memberId] ?? [];
    acc[bid.memberId].push(bid);
    return acc;
  }, {});
  const minBidDecrement = auction?.minBidDecrement != null ? Number(auction.minBidDecrement) : 0;
  const minNextPrize = Math.max(1, (currentBest?.prizeAmount ?? group.chitValue) - minBidDecrement);

  const eventRows = auction
    ? await prisma.chitAuctionEvent.findMany({
        where: {
          auctionId: auction.id,
          ...(startedAt ? { createdAt: { gte: startedAt } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, type: true, message: true, memberId: true, amount: true, createdAt: true },
      })
    : [];
  const events = eventRows.map((e) => ({
    id: e.id,
    type: e.type,
    message: e.message,
    memberId: e.memberId,
    amount: e.amount != null ? Number(e.amount) : null,
    createdAt: e.createdAt.toISOString(),
  }));

  const shell = auction ?? {
    id: '',
    status: 'pending',
    periodNumber,
    startedAt: null,
    endsAt: null,
    countdownSeconds: null,
    minBidDecrement: null,
    currentBestBidId: null,
    winnerMemberId: null,
    prizeAmount: null,
    bidDiscount: null,
    commission: null,
    dividend: null,
  };

  return buildStateShape({
    auction: shell,
    group,
    seats,
    activeCount,
    currentBest,
    minNextPrize,
    recentBids,
    allBids: exposedBids,
    memberBids,
    events,
  });
}
