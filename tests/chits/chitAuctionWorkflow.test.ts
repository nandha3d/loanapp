import { createHash } from 'crypto';
import { getTopBids, getWinningBid } from '../../lib/chits/auction';
import { calculateFixedDiscountPrize } from '../../lib/chits/calculations';
import { drawLotteryWinner, formatDrawEvidence } from '../../lib/chits/lottery';
import { antiSnipeExtension, isRoomOpen, secondsRemaining } from '../../lib/chits/liveAuction';

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${expected}, got ${actual}`);
  }
}

function assertThrows(fn: () => void, message: string) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error(`Expected throw: ${message}`);
}

// ── Winner selection ──────────────────────────────────────────────
const bids = [
  { id: 'b1', memberId: 'm1', bidDiscount: 20000, bidTime: new Date('2026-07-08T10:00:00Z'), status: 'valid' },
  { id: 'b2', memberId: 'm2', bidDiscount: 25000, bidTime: new Date('2026-07-08T10:01:00Z'), status: 'valid' },
  { id: 'b3', memberId: 'm3', bidDiscount: 25000, bidTime: new Date('2026-07-08T10:02:00Z'), status: 'valid' },
  { id: 'b4', memberId: 'm4', bidDiscount: 30000, bidTime: new Date('2026-07-08T10:03:00Z'), status: 'withdrawn' },
];

const winner = getWinningBid(bids);
assertEqual(winner?.id, 'b2', 'earliest bid wins the discount tie');
assertEqual(getWinningBid(bids.filter((b) => b.status === 'withdrawn')), null, 'no valid bids yields null');

const top = getTopBids(bids);
assertEqual(top.length, 2, 'two bids tied at top discount');
assertEqual(top.every((b) => b.bidDiscount === 25000), true, 'top bids share the highest discount');
assertEqual(getTopBids([]).length, 0, 'empty bids yield empty top list');

// Withdrawn bids never surface as top/winner even at the highest discount.
assertEqual(top.some((b) => b.id === 'b4'), false, 'withdrawn cap bid excluded');

// ── Lottery draw: reproducible and verifiable ─────────────────────
const candidates = [
  { memberId: 'm1', ticketNo: '1' },
  { memberId: 'm2', ticketNo: '2' },
  { memberId: 'm3', ticketNo: '10' },
];
const draw = drawLotteryWinner({ candidates, auctionId: 'auc_1', seed: 'fixedseed' });
const expectedIndex = createHash('sha256').update('auc_1:fixedseed').digest().readUInt32BE(0) % 3;
assertEqual(draw.index, expectedIndex, 'draw index recomputable from sha256(auctionId:seed)');
const again = drawLotteryWinner({ candidates, auctionId: 'auc_1', seed: 'fixedseed' });
assertEqual(again.winner.memberId, draw.winner.memberId, 'same seed reproduces the same winner');
assertEqual(draw.candidateTickets.join(','), '1,2,10', 'candidates sorted numerically by ticket');
assertThrows(() => drawLotteryWinner({ candidates: [], auctionId: 'auc_1' }), 'empty candidate draw');
const evidence = formatDrawEvidence(draw);
assertEqual(evidence.includes('fixedseed'), true, 'evidence line carries the seed');

const randomDraw = drawLotteryWinner({ candidates, auctionId: 'auc_1' });
assertEqual(candidates.some((c) => c.memberId === randomDraw.winner.memberId), true, 'random draw picks a candidate');

// ── Fixed discount prize (lottery / fixed_rotation / foreman ticket) ──
const fixed = calculateFixedDiscountPrize({ chitValue: 100000, fixedDiscountPct: 10 });
assertEqual(fixed.bidDiscount, 10000, 'fixed discount amount');
assertEqual(fixed.prizeAmount, 90000, 'fixed discount prize');
const noDiscount = calculateFixedDiscountPrize({ chitValue: 100000 });
assertEqual(noDiscount.prizeAmount, 100000, 'null fixed discount yields full chit value');
assertThrows(() => calculateFixedDiscountPrize({ chitValue: 100000, fixedDiscountPct: -1 }), 'negative fixed discount');

// ── Live room clock rules ─────────────────────────────────────────
const now = new Date('2026-07-08T10:00:00Z');
const closesSoon = new Date('2026-07-08T10:00:30Z');
const closedAlready = new Date('2026-07-08T09:59:00Z');

assertEqual(isRoomOpen({ roomStatus: 'open', biddingClosesAt: closesSoon }, now), true, 'open room before close');
assertEqual(isRoomOpen({ roomStatus: 'extended', biddingClosesAt: closesSoon }, now), true, 'extended room counts as open');
assertEqual(isRoomOpen({ roomStatus: 'open', biddingClosesAt: closedAlready }, now), false, 'expired room is closed');
assertEqual(isRoomOpen({ roomStatus: 'closed', biddingClosesAt: closesSoon }, now), false, 'closed status wins');
assertEqual(isRoomOpen({ roomStatus: 'scheduled', biddingClosesAt: null }, now), false, 'scheduled room not open');

assertEqual(secondsRemaining({ biddingClosesAt: closesSoon }, now), 30, 'seconds remaining from server clock');
assertEqual(secondsRemaining({ biddingClosesAt: closedAlready }, now), 0, 'no negative countdown');

// Anti-snipe: bid inside the final window extends; outside it does not.
const extended = antiSnipeExtension({ biddingClosesAt: closesSoon, autoExtendSeconds: 60 }, now);
assertEqual(extended?.toISOString(), new Date(closesSoon.getTime() + 60_000).toISOString(), 'bid in window extends close');
assertEqual(
  antiSnipeExtension({ biddingClosesAt: new Date(now.getTime() + 300_000), autoExtendSeconds: 60 }, now),
  null,
  'bid well before close does not extend',
);
assertEqual(antiSnipeExtension({ biddingClosesAt: closedAlready, autoExtendSeconds: 60 }, now), null, 'no extension after close');
assertEqual(antiSnipeExtension({ biddingClosesAt: closesSoon, autoExtendSeconds: 0 }, now), null, 'anti-snipe off');

console.log('chitAuctionWorkflow tests passed');
