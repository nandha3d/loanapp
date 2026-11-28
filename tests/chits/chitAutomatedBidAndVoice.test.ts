import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import {
  assertMonotonicBidDirection,
  assertValidPrizeAmount,
  computeAutomatedBidBounds,
} from '../../lib/chits/validation';
import {
  computeTableEdgeCoords,
  consolidateSeatsByCustomer,
  interleaveSeatsByCustomer,
  MAX_MAIN_TABLE_SEATS,
  partitionTableAndBenchSeats,
} from '../../lib/chits/seatOrder';
import {
  parseChitEngineConfig,
  resolvePeriodRoomMode,
  serializeChitEngineConfig,
  supportsBellForPeriod,
} from '../../lib/chits/engineTypes';
import {
  extendAuctionRoomMinutes,
  openScheduledRoomIfDue,
  reopenAuctionRoom,
  secondsRemaining,
} from '../../lib/chits/liveAuction';
import { placeChitBid } from '../../lib/chits/bidService';
import { getPeriodReportCopy } from '../../lib/chits/periodReportI18n';
import { getStatutoryPdfCopy } from '../../lib/chits/statutory/i18n';
import type { PdfLang } from '../../lib/reports/pdfFonts';
import {
  clampBidVoiceSpeed,
  DEFAULT_BID_VOICE_PROFILE,
  DEFAULT_BID_VOICE_SPEED,
  normalizeBidVoiceProfile,
} from '../../lib/chits/bidVoiceAnnouncer';
import { resolveCustomerRouteMode } from '../../lib/moduleCapabilities';
import { computeTableCashSummaryFromData } from '../../lib/chits/tableCash';
import {
  computeCollectionSeriesFromSubs,
  computePayoutProgressSummary,
} from '../../lib/chits/dashboard';

// 1. Fresh standard 1,00,000 chit with 5% commission floor & 35% cap -> auto-starts at 95,000
const initialBounds = computeAutomatedBidBounds({
  chitValue: 100_000,
  commissionPct: 5,
  maxDiscountPct: 35,
  bidStartAtCommission: true,
  bidIncrement: 500,
  currentHighestDiscount: 0,
  auctionType: 'open_live',
});

assert.equal(initialBounds.direction, 'reverse_prize');
assert.equal(initialBounds.startingDiscount, 5_000);
assert.equal(initialBounds.startingPrize, 95_000);
assert.equal(initialBounds.nextValidDiscount, 5_000);
assert.equal(initialBounds.nextValidPrize, 95_000);
assert.equal(initialBounds.minPrize, 65_000);
assert.equal(initialBounds.currentLowestPrize, null);
assert.equal(initialBounds.canBidFurther, true);
assert.ok(initialBounds.templatePrizes.length >= 4);
assert.equal(initialBounds.templatePrizes[0].prizeAmount, 95_000);
assert.equal(initialBounds.templatePrizes[0].label, 'Start Floor');

// Template quick-bid prices must strictly descend (reverse prize movement)
for (let i = 1; i < initialBounds.templatePrizes.length; i++) {
  assert.ok(
    initialBounds.templatePrizes[i].prizeAmount < initialBounds.templatePrizes[i - 1].prizeAmount,
    'template prizes must strictly move downward in reverse bidding',
  );
}

// 2. Active auction after 8,000 discount (92,000 prize) with 500 step -> next max prize is 91,500
const midBounds = computeAutomatedBidBounds({
  chitValue: 100_000,
  commissionPct: 5,
  maxDiscountPct: 35,
  bidStartAtCommission: true,
  bidIncrement: 500,
  currentHighestDiscount: 8_000,
  auctionType: 'open_live',
});

assert.equal(midBounds.currentLowestPrize, 92_000);
assert.equal(midBounds.nextValidDiscount, 8_500);
assert.equal(midBounds.nextValidPrize, 91_500);
assert.equal(midBounds.canBidFurther, true);
assert.ok(midBounds.templatePrizes.every((p) => p.prizeAmount <= 91_500));

// 3. Zero explicit bidIncrement still forces strict downward prize progression (minimum ₹1 step)
const zeroIncBounds = computeAutomatedBidBounds({
  chitValue: 100_000,
  commissionPct: 5,
  maxDiscountPct: 35,
  bidIncrement: 0,
  currentHighestDiscount: 5_000,
  auctionType: 'open_manual',
});
assert.equal(zeroIncBounds.nextValidDiscount, 5_001);
assert.equal(zeroIncBounds.nextValidPrize, 94_999);

// 4. Statutory cap reached -> further bidding stops cleanly
const cappedBounds = computeAutomatedBidBounds({
  chitValue: 100_000,
  commissionPct: 5,
  maxDiscountPct: 35,
  bidIncrement: 500,
  currentHighestDiscount: 35_000,
  auctionType: 'open_live',
});
assert.equal(cappedBounds.canBidFurther, false);
assert.equal(cappedBounds.templatePrizes.length, 0);

// 5. Monotonic direction assertions (backend parity)
assert.throws(
  () =>
    assertMonotonicBidDirection({
      chitValue: 100_000,
      bidDiscount: 8_000,
      currentHighestDiscount: 8_000,
      incrementStep: 0,
      maxDiscountCap: 35_000,
      auctionType: 'open_live',
    }),
  /Reverse bidding only decreases prize/,
);

assert.throws(
  () =>
    assertMonotonicBidDirection({
      chitValue: 100_000,
      bidDiscount: 8_200,
      currentHighestDiscount: 8_000,
      incrementStep: 500,
      maxDiscountCap: 35_000,
      auctionType: 'open_manual',
    }),
  /Reverse bidding only decreases prize/,
);

assert.doesNotThrow(() =>
  assertMonotonicBidDirection({
    chitValue: 100_000,
    bidDiscount: 8_500,
    currentHighestDiscount: 8_000,
    incrementStep: 500,
    maxDiscountCap: 35_000,
    auctionType: 'open_live',
  }),
);

// Exact-at-cap tie remains valid even after cap is reached
assert.doesNotThrow(() =>
  assertMonotonicBidDirection({
    chitValue: 100_000,
    bidDiscount: 35_000,
    currentHighestDiscount: 35_000,
    incrementStep: 500,
    maxDiscountCap: 35_000,
    auctionType: 'open_live',
  }),
);

// Sealed tenders do not leak/enforce public monotonic order
assert.doesNotThrow(() =>
  assertMonotonicBidDirection({
    chitValue: 100_000,
    bidDiscount: 6_000,
    currentHighestDiscount: 8_000,
    incrementStep: 500,
    maxDiscountCap: 35_000,
    auctionType: 'sealed',
  }),
);

// Below commission floor still fails loudly
assert.throws(
  () =>
    assertValidPrizeAmount({
      chitValue: 100_000,
      prizeAmount: 98_000,
      commissionPct: 5,
      bidStartAtCommission: true,
      maxDiscountPct: 35,
    }),
  /Bid discount must be at least 5%/,
);

// 7. Customer interleaving prevents identical customers from sitting side-by-side
const groupedSeats = [
  { customerId: 'c1', ticketNo: '1', name: 'Dinesh' },
  { customerId: 'c1', ticketNo: '2', name: 'Dinesh' },
  { customerId: 'c2', ticketNo: '3', name: 'Ilango' },
  { customerId: 'c2', ticketNo: '4', name: 'Ilango' },
  { customerId: 'c2', ticketNo: '5', name: 'Ilango' },
  { customerId: 'c3', ticketNo: '6', name: 'Nandakumar' },
  { customerId: 'c3', ticketNo: '7', name: 'Nandakumar' },
  { customerId: 'c3', ticketNo: '8', name: 'Nandakumar' },
  { customerId: 'c4', ticketNo: '9', name: 'Eswari' },
  { customerId: 'c5', ticketNo: '10', name: 'Gopinath' },
];
const interleaved = interleaveSeatsByCustomer(groupedSeats);
assert.equal(interleaved.length, groupedSeats.length);
for (let i = 1; i < interleaved.length; i++) {
  assert.notEqual(
    interleaved[i].customerId,
    interleaved[i - 1].customerId,
    `Adjacent duplicate customer found at seat index ${i}`,
  );
}

// 8. Customer consolidation shrinks 10 duplicate tickets into 5 unique member seats and keeps leading ticket
const consolidated = consolidateSeatsByCustomer(groupedSeats, '7');
assert.equal(consolidated.length, 5);
const nandakumarGroup = consolidated.find((g) => g.primary.customerId === 'c3');
assert.ok(nandakumarGroup);
assert.equal(nandakumarGroup.ticketCount, 3);
assert.equal(nandakumarGroup.primary.ticketNo, '7');
assert.deepEqual(nandakumarGroup.ticketNos, ['6', '7', '8']);

// 9. Narrow ₹1 bidding vs strict bid multiplier restriction
assert.doesNotThrow(() =>
  assertMonotonicBidDirection({
    chitValue: 100_000,
    bidDiscount: 5_001,
    currentHighestDiscount: 5_000,
    incrementStep: 1,
    maxDiscountCap: 40_000,
    auctionType: 'open_live',
    strictBidMultiple: false,
    startingDiscount: 5_000,
  }),
);

assert.throws(
  () =>
    assertMonotonicBidDirection({
      chitValue: 100_000,
      bidDiscount: 5_101,
      currentHighestDiscount: 5_000,
      incrementStep: 100,
      maxDiscountCap: 40_000,
      auctionType: 'open_live',
      strictBidMultiple: true,
      startingDiscount: 5_000,
    }),
  /Narrow bidding restricted/,
);

assert.doesNotThrow(() =>
  assertMonotonicBidDirection({
    chitValue: 100_000,
    bidDiscount: 5_100,
    currentHighestDiscount: 5_000,
    incrementStep: 100,
    maxDiscountCap: 40_000,
    auctionType: 'open_live',
    strictBidMultiple: true,
    startingDiscount: 5_000,
  }),
);

// Snapping next valid bid cleanly when narrow ₹5,003 is locked mid-auction to ₹100 strict multiple
const snappedMidLock = computeAutomatedBidBounds({
  chitValue: 100_000,
  commissionPct: 5,
  maxDiscountPct: 40,
  bidIncrement: 100,
  strictBidMultiple: true,
  currentHighestDiscount: 5_003,
  auctionType: 'open_live',
});
assert.equal(snappedMidLock.nextValidDiscount, 5_200);
assert.equal(snappedMidLock.nextValidPrize, 94_800);

// 10. PeriodRoomMode & bell capability across chit templates
assert.equal(
  resolvePeriodRoomMode({ chitEngineType: 'AUCTION_RESERVE_PRICE', auctionType: 'open_manual' }, 1),
  'OPEN_AUCTION',
);
assert.equal(
  supportsBellForPeriod({ chitEngineType: 'AUCTION_RESERVE_PRICE', auctionType: 'open_manual', bellEnabled: true }, 1),
  true,
);
assert.equal(
  resolvePeriodRoomMode({ chitEngineType: 'PURE_LOTTERY', auctionType: 'lottery' }, 1),
  'LOTTERY_DRAW',
);
assert.equal(
  supportsBellForPeriod({ chitEngineType: 'PURE_LOTTERY', auctionType: 'lottery', bellEnabled: true }, 1),
  false,
);
assert.equal(
  supportsBellForPeriod({ chitEngineType: 'AUCTION_STANDARD', auctionType: 'sealed', bellEnabled: true }, 1),
  false,
);
assert.equal(
  resolvePeriodRoomMode({ chitEngineType: 'NEED_BASED_CONSENSUS', auctionType: 'lottery' }, 1),
  'CONSENSUS',
);
assert.equal(
  resolvePeriodRoomMode({ chitEngineType: 'GOLD_VALUE_ACCUMULATION', auctionType: 'fixed_rotation' }, 1),
  'FIXED_ROTATION',
);
assert.equal(
  resolvePeriodRoomMode({ chitEngineType: 'AUCTION_STANDARD', auctionType: 'open_live', hasForemanTicket: true }, 1),
  'FIXED_ROTATION',
);

// 11. meetingSchedule config preservation + clamping
const legacyParsed = parseChitEngineConfig(null, 'AUCTION_STANDARD');
assert.equal(legacyParsed.meetingSchedule, undefined);
const scheduledParsed = parseChitEngineConfig(
  serializeChitEngineConfig({
    ...legacyParsed,
    meetingSchedule: { defaultDurationMinutes: 45, autoStartAtScheduledTime: true },
  }),
  'AUCTION_STANDARD',
);
assert.deepEqual(scheduledParsed.meetingSchedule, {
  defaultDurationMinutes: 45,
  autoStartAtScheduledTime: true,
});

// 12. Lazy scheduled auto-open + live room extension (+N minutes)
async function verifyRoomScheduling() {
  const scheduledTime = new Date('2026-12-01T19:30:00.000Z');
  const row: {
    id: string;
    periodNumber: number;
    roomStatus: string;
    status: string;
    scheduledAt: Date;
    biddingOpensAt: Date | null;
    biddingClosesAt: Date | null;
    startedAt: Date | null;
    bellAnchorAt: Date | null;
    bellsRung: number;
    chitGroup: {
      auctionType: string;
      chitEngineType: string;
      engineConfig: string;
      hasForemanTicket: boolean;
    };
  } = {
    id: 'auc_sched_1',
    periodNumber: 2,
    roomStatus: 'scheduled',
    status: 'pending',
    scheduledAt: scheduledTime,
    biddingOpensAt: null,
    biddingClosesAt: null,
    startedAt: null,
    bellAnchorAt: null,
    bellsRung: 0,
    chitGroup: {
      auctionType: 'open_live',
      chitEngineType: 'AUCTION_STANDARD',
      engineConfig: serializeChitEngineConfig({
        ...legacyParsed,
        meetingSchedule: { defaultDurationMinutes: 30, autoStartAtScheduledTime: true },
      }),
      hasForemanTicket: false,
    },
  };
  const events: Array<Record<string, unknown>> = [];
  const fakeTx = {
    chitAuction: {
      findUnique: async () => ({ ...row }),
      updateMany: async ({
        where,
        data,
      }: {
        where: { roomStatus?: string };
        data: Partial<typeof row>;
      }) => {
        if (where.roomStatus && row.roomStatus !== where.roomStatus) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      update: async ({ data }: { data: Partial<typeof row> }) => {
        Object.assign(row, data);
        return { ...row };
      },
    },
    chitAuctionEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        events.push(data);
        return data;
      },
    },
  } as unknown as Prisma.TransactionClient;

  // Before scheduled start -> remains scheduled
  await openScheduledRoomIfDue(fakeTx, 'auc_sched_1', new Date(scheduledTime.getTime() - 60_000));
  assert.equal(row.roomStatus, 'scheduled');

  // At scheduled start + 1 minute -> atomically transitions to open
  await openScheduledRoomIfDue(fakeTx, 'auc_sched_1', new Date(scheduledTime.getTime() + 60_000));
  assert.equal(row.roomStatus, 'open');
  assert.equal(row.status, 'in_progress');
  assert.equal(events[0]?.type, 'open');

  // Extend live room by +10 minutes
  const prevClose = row.biddingClosesAt as Date;
  await extendAuctionRoomMinutes(fakeTx, {
    auctionId: 'auc_sched_1',
    extraMinutes: 10,
    now: new Date(scheduledTime.getTime() + 120_000),
  });
  assert.equal(row.roomStatus, 'extended');
  assert.equal((row.biddingClosesAt as Date).getTime(), prevClose.getTime() + 10 * 60_000);
}

async function runAsyncTests() {
  await verifyRoomScheduling();

  // 13. 20-seat main table cap + right bench promotion & equal Euclidean outer-edge spacing
  const smallGroup = Array.from({ length: 15 }, (_, idx) => ({
    memberId: `m_${idx + 1}`,
    customerId: `c_${idx + 1}`,
    ticketNo: String(idx + 1),
    name: `Member ${idx + 1}`,
    latestPrize: null as number | null,
  }));
  const smallPart = partitionTableAndBenchSeats(smallGroup, MAX_MAIN_TABLE_SEATS);
  assert.equal(smallPart.tableSeats.length, 15);
  assert.equal(smallPart.benchSeats.length, 0);

  const largeGroup = Array.from({ length: 26 }, (_, idx) => ({
    memberId: `m_${idx + 1}`,
    customerId: `c_${idx + 1}`,
    ticketNo: String(idx + 1),
    name: `Member ${idx + 1}`,
    latestPrize: idx === 23 ? 91_500 : null, // bench member #24 placed a bid
  }));
  const largePart = partitionTableAndBenchSeats(largeGroup, MAX_MAIN_TABLE_SEATS);
  assert.equal(largePart.tableSeats.length, 20);
  assert.equal(largePart.benchSeats.length, 6);
  assert.ok(
    largePart.tableSeats.some((s) => s.memberId === 'm_24'),
    'Benched member who placed a bid must automatically appear on the main 20-seat table',
  );
  assert.ok(
    !largePart.benchSeats.some((s) => s.memberId === 'm_24'),
    'Promoted bidder should move out of bench list',
  );

  // Outer-edge coordinates stay inside stage bounds (5%..95% horizontal, 12%..88% vertical)
  for (let i = 0; i < 20; i++) {
    const { left, top } = computeTableEdgeCoords(i, 20);
    assert.ok(left > 5 && left < 95, `Seat ${i} left out of bounds: ${left}`);
    assert.ok(top > 12 && top < 88, `Seat ${i} top out of bounds: ${top}`);
  }

  // 14. 3-Bell reset on every valid bid for both open_manual and open_live, plus block after 3rd-bell close until reopen
  async function verifyBellResetAndReopen() {
    const auctionRow = {
      id: 'auc_bell_1',
      chitGroupId: 'grp_bell_1',
      periodNumber: 1,
      status: 'in_progress',
      roomStatus: 'open',
      startedAt: new Date(Date.now() - 60_000),
      scheduledAt: new Date(Date.now() - 60_000),
      biddingClosesAt: new Date(Date.now() + 300_000),
      autoExtendSeconds: 0,
      bellAnchorAt: new Date(Date.now() - 10_000),
      bellsRung: 2,
      chitGroup: {
        chitValue: 100_000,
        totalMembers: 10,
        auctionType: 'open_manual',
        chitEngineType: 'AUCTION_RESERVE_PRICE',
        engineConfig: null,
        maxDiscountPct: 40,
        minDiscountPct: 5,
        commissionPct: 5,
        bidStartAtCommission: true,
        bidIncrement: 500,
        branchId: null,
        bellEnabled: false,
        bellIntervalSeconds: 60,
        bellCount: 3,
        bellAutoClose: true,
      },
    };
    let updatedAuctionData: Record<string, unknown> | null = null;
    const fakeTx = {
      chitAuction: {
        findUnique: async () => ({ ...auctionRow }),
        updateMany: async () => ({ count: 1 }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          updatedAuctionData = data;
          Object.assign(auctionRow, data);
          return { ...auctionRow };
        },
      },
      chitBid: {
        findFirst: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => ({ id: 'bid_1', status: 'valid', ...data }),
      },
      chitAuctionEvent: {
        create: async () => ({}),
      },
    } as unknown as Prisma.TransactionClient;

    // Scheduled rooms must reject bids before Start Live Now is pressed (open_manual & open_live)
    auctionRow.bellsRung = 0;
    auctionRow.roomStatus = 'scheduled';
    await assert.rejects(
      () =>
        placeChitBid(fakeTx, {
          auction: auctionRow,
          member: { id: 'mem_1', customerId: 'cust_1', hasWon: false, subscriberStatus: 'active' },
          prizeAmount: 84_500,
        }),
      /Bidding room is not open/,
    );

    auctionRow.bellsRung = 2;
    auctionRow.roomStatus = 'open';
    await placeChitBid(fakeTx, {
      auction: auctionRow,
      member: { id: 'mem_1', customerId: 'cust_1', hasWon: false, subscriberStatus: 'active' },
      prizeAmount: 84_000,
    });
    assert.equal(updatedAuctionData?.['bellsRung'], 0, 'open_manual bid must reset bellsRung back to 0');

    // After 3rd bell auto-closes room, bids are rejected until foreman re-opens room
    auctionRow.bellsRung = 3;
    auctionRow.roomStatus = 'closed';
    await assert.rejects(
      () =>
        placeChitBid(fakeTx, {
          auction: auctionRow,
          member: { id: 'mem_2', customerId: 'cust_2', hasWon: false, subscriberStatus: 'active' },
          prizeAmount: 83_000,
        }),
      /Final 3rd bell closed bidding/,
    );

    await reopenAuctionRoom(fakeTx, { auctionId: auctionRow.id, durationMinutes: 5 });
    assert.equal(auctionRow.roomStatus, 'open');
    assert.equal(auctionRow.bellsRung, 0);
  }

  await verifyBellResetAndReopen();

  // 15. All 6 PDF languages produce non-English localized headers & statutory labels
  const nonEnglishLangs: PdfLang[] = ['ta', 'hi', 'te', 'kn', 'ml'];
  const enPeriod = getPeriodReportCopy('en');
  for (const l of nonEnglishLangs) {
    const c = getPeriodReportCopy(l);
    assert.notEqual(c.totalChitValue, enPeriod.totalChitValue, `${l} totalChitValue must be translated`);
    assert.notEqual(c.row2WinningBid('5'), enPeriod.row2WinningBid('5'), `${l} row2WinningBid must be translated`);
    assert.notEqual(c.row3CommOnBasis(5, 'BID_DISCOUNT'), enPeriod.row3CommOnBasis(5, 'BID_DISCOUNT'));
    assert.notEqual(c.row4NetDivTitle(10), enPeriod.row4NetDivTitle(10));
    assert.notEqual(c.arrearsOffsetTitle, enPeriod.arrearsOffsetTitle);
    const stat = getStatutoryPdfCopy(l);
    assert.notEqual(stat.groupLabel, getStatutoryPdfCopy('en').groupLabel);
    assert.notEqual(stat.registerTitles['subscriber-register'], getStatutoryPdfCopy('en').registerTitles['subscriber-register']);
  }

  // 16. parseChitEngineConfig preserves voiceSettings & tableCash (defaulting tableCash to undefined per STABLE-2)
  const rawEngineCfg = JSON.stringify({
    chitType: 'AUCTION_STANDARD',
    voiceSettings: {
      language: 'ta',
      allowMemberChange: true,
      speakingRate: 0.82,
      voiceProfile: 'FEMALE_CLASSIC',
    },
    tableCash: {
      enabled: true,
      allowWinnerSettleAfterAuction: true,
    },
  });
  const parsedWithExtras = parseChitEngineConfig(rawEngineCfg, 'AUCTION_STANDARD');
  assert.equal(parsedWithExtras.voiceSettings?.language, 'ta');
  assert.equal(parsedWithExtras.voiceSettings?.allowMemberChange, true);
  assert.equal(parsedWithExtras.voiceSettings?.speakingRate, 0.82);
  assert.equal(parsedWithExtras.voiceSettings?.voiceProfile, 'FEMALE_CLASSIC');
  assert.equal(parsedWithExtras.tableCash?.enabled, true);
  assert.equal(parsedWithExtras.tableCash?.allowWinnerSettleAfterAuction, true);

  const parsedUntouched = parseChitEngineConfig(null, 'AUCTION_STANDARD');
  assert.equal(parsedUntouched.tableCash, undefined);

  // 17. Voice speed clamping (default 0.88x) & voice profile normalization
  assert.equal(clampBidVoiceSpeed(undefined), DEFAULT_BID_VOICE_SPEED);
  assert.equal(clampBidVoiceSpeed(0), DEFAULT_BID_VOICE_SPEED);
  assert.equal(clampBidVoiceSpeed(0.3), 0.65);
  assert.equal(clampBidVoiceSpeed(1.8), 1.2);
  assert.equal(clampBidVoiceSpeed(0.88), 0.88);
  assert.equal(normalizeBidVoiceProfile(undefined), DEFAULT_BID_VOICE_PROFILE);
  assert.equal(normalizeBidVoiceProfile('FEMALE_CLASSIC'), 'FEMALE_CLASSIC');
  assert.equal(normalizeBidVoiceProfile('male_warm'), 'MALE_WARM');
  assert.equal(normalizeBidVoiceProfile('FEMALE_NATURAL'), 'FEMALE_NATURAL');
  assert.equal(normalizeBidVoiceProfile('unknown_voice'), 'MALE_CLASSIC');

  // 18. Configurable Customer Route Mode (chitfunds optional by default, lending mandatory)
  assert.equal(resolveCustomerRouteMode('chitfunds', null), 'ENABLED_OPTIONAL');
  assert.equal(resolveCustomerRouteMode('microlending', null), 'ENABLED_REQUIRED');
  assert.equal(resolveCustomerRouteMode('chitfunds', 'DISABLED'), 'DISABLED');
  assert.equal(resolveCustomerRouteMode('chitfunds', 'ENABLED_REQUIRED'), 'ENABLED_REQUIRED');
  assert.equal(resolveCustomerRouteMode('microlending', 'ENABLED_OPTIONAL'), 'ENABLED_OPTIONAL');

  // 19. Server-side Table Cash Pre-Auction Settlement calculation (STABLE-8)
  const tcPendingSummary = computeTableCashSummaryFromData({
    enabled: true,
    allowWinnerSettleAfterAuction: true,
    periodNumber: 2,
    monthlyContrib: 10_000,
    winnerMemberId: 'mem_2',
    members: [
      { id: 'mem_1', memberNumber: 1, ticketNo: 1, subscriberStatus: 'active', hasWon: false, customer: { name: 'Asha' } },
      { id: 'mem_2', memberNumber: 2, ticketNo: 2, subscriberStatus: 'active', hasWon: true, customer: { name: 'Bala' } },
      { id: 'mem_3', memberNumber: 3, ticketNo: 3, subscriberStatus: 'active', hasWon: false, customer: { name: 'Chitra' } },
    ],
    subscriptions: [
      { id: 'sub_1', memberId: 'mem_1', dueAmount: 10_000, paidAmount: 10_000, status: 'paid', lastReceiptNo: 'RCP-1' },
      { id: 'sub_2', memberId: 'mem_2', dueAmount: 10_000, paidAmount: 4_000, status: 'partial' },
    ],
  });
  assert.equal(tcPendingSummary.totalTickets, 3);
  assert.equal(tcPendingSummary.settledTickets, 1);
  assert.equal(tcPendingSummary.pendingTickets, 2);
  assert.equal(tcPendingSummary.totalDueAmount, 30_000);
  assert.equal(tcPendingSummary.totalCollectedAmount, 14_000);
  assert.equal(tcPendingSummary.totalPendingAmount, 16_000);
  assert.equal(tcPendingSummary.allSettled, false);
  assert.equal(tcPendingSummary.winnerRow?.memberId, 'mem_2');
  assert.equal(tcPendingSummary.winnerRow?.remainingAmount, 6_000);

  const tcAllSettledSummary = computeTableCashSummaryFromData({
    enabled: true,
    periodNumber: 2,
    monthlyContrib: 10_000,
    members: [
      { id: 'mem_1', memberNumber: 1, ticketNo: 1, subscriberStatus: 'active', hasWon: false },
      { id: 'mem_2', memberNumber: 2, ticketNo: 2, subscriberStatus: 'active', hasWon: false },
    ],
    subscriptions: [
      { id: 'sub_1', memberId: 'mem_1', dueAmount: 10_000, paidAmount: 10_000, status: 'paid' },
      { id: 'sub_2', memberId: 'mem_2', dueAmount: 10_000, paidAmount: 0, status: 'waived' },
    ],
  });
  assert.equal(tcAllSettledSummary.settledTickets, 2);
  assert.equal(tcAllSettledSummary.pendingTickets, 0);
  assert.equal(tcAllSettledSummary.allSettled, true);

  // 20. Paused auction room returns frozen countdownSeconds
  assert.equal(
    secondsRemaining({
      roomStatus: 'paused',
      countdownSeconds: 742,
      biddingClosesAt: new Date(Date.now() + 10_000),
    }),
    742,
  );
  assert.equal(
    secondsRemaining({
      roomStatus: 'closed',
      countdownSeconds: 742,
      biddingClosesAt: new Date(Date.now() + 10_000),
    }),
    0,
  );

  // 21. Server-side Chit Dashboard collection series & payout progress math (STABLE-8)
  const collSeries = computeCollectionSeriesFromSubs(
    [
      { periodNumber: 1, dueAmount: 85_975, paidAmount: 85_975 },
      { periodNumber: 2, dueAmount: 85_975, paidAmount: 70_000 },
      { periodNumber: 3, dueAmount: 85_975, paidAmount: 85_725 },
    ],
    'Standard Commercial Auction Chit',
  );
  assert.equal(collSeries.points.length, 3);
  assert.equal(collSeries.collectedTotal, 85_725);
  assert.equal(collSeries.expectedTotal, 85_975);
  assert.equal(collSeries.collectionPct, 99.71);
  assert.equal(collSeries.peakPeriodLabel, 'P1');

  const payoutProg = computePayoutProgressSummary({
    grossPrize: 95_000,
    arrearsOffset: 28_050,
    penaltyOffset: 1_000,
    disbursedAmount: 42_868,
  });
  assert.equal(payoutProg.arrearsAndPenaltyOffset, 29_050);
  assert.equal(payoutProg.netTargetAfterArrears, 65_950);
  assert.equal(payoutProg.disbursedAmount, 42_868);
  assert.equal(payoutProg.balancePending, 23_082);
  assert.equal(payoutProg.payoutProgressPct, 65);

  console.log('chit automated bid bounds and monotonic direction tests passed');
}

runAsyncTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
