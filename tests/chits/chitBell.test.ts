import { evaluateBells } from '../../lib/chits/bell';

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Minimal in-memory mock of the Prisma transaction client surface evaluateBells
// touches — this repo's chit tests are plain assertion scripts with no mocking
// framework, so a tiny hand-rolled store is the lightest way to exercise the
// lazy timestamp-derived advancement + optimistic-concurrency guard.
type MockAuction = {
  id: string;
  roomStatus: string;
  bellAnchorAt: Date | null;
  bellsRung: number;
  status: string;
};

function makeMockTx(auction: MockAuction, group: { bellEnabled: boolean; bellIntervalSeconds: number; bellCount: number; bellAutoClose: boolean }) {
  const events: any[] = [];
  const tx = {
    chitAuction: {
      findUnique: async (_args: any) => ({
        id: auction.id,
        roomStatus: auction.roomStatus,
        bellAnchorAt: auction.bellAnchorAt,
        bellsRung: auction.bellsRung,
        status: auction.status,
        chitGroup: group,
      }),
      updateMany: async ({ where, data }: any) => {
        if (where.bellsRung !== auction.bellsRung) return { count: 0 }; // lost the race
        auction.bellsRung = data.bellsRung;
        return { count: 1 };
      },
      update: async ({ data }: any) => {
        Object.assign(auction, data);
        return auction;
      },
    },
    chitAuctionEvent: {
      create: async ({ data }: any) => {
        events.push(data);
        return data;
      },
    },
  };
  return { tx, events };
}

// ── Due-math: 5 minutes elapsed with a 60s interval / 3-bell cap lands at
// exactly 3, not 5 — a poll skipping over multiple intervals (idle tab) must
// not overshoot the cap ─────────────────────────────────────────────────────
async function testDueMathCapsAtBellCount() {
  const auction: MockAuction = {
    id: 'a1', roomStatus: 'open', bellAnchorAt: new Date('2026-01-01T00:00:00Z'), bellsRung: 0, status: 'in_progress',
  };
  const group = { bellEnabled: true, bellIntervalSeconds: 60, bellCount: 3, bellAutoClose: false };
  const { tx, events } = makeMockTx(auction, group);
  await evaluateBells(tx, auction.id, new Date('2026-01-01T00:05:00Z')); // 5 intervals elapsed
  assertEqual(auction.bellsRung, 3, 'idle-tab poll caps bellsRung at bellCount, not raw elapsed intervals');
  assertEqual(events.filter((e) => e.type === 'bell').length, 3, 'exactly 3 bell events created, one per number crossed');
}

// ── Race guard: a second evaluateBells call against already-advanced state
// must be a no-op (simulates two overlapping polls) ─────────────────────────
async function testRaceGuardNoDoubleAdvance() {
  const auction: MockAuction = {
    id: 'a2', roomStatus: 'open', bellAnchorAt: new Date('2026-01-01T00:00:00Z'), bellsRung: 0, status: 'in_progress',
  };
  const group = { bellEnabled: true, bellIntervalSeconds: 60, bellCount: 3, bellAutoClose: false };
  const { tx, events } = makeMockTx(auction, group);
  const now = new Date('2026-01-01T00:01:00Z'); // exactly 1 interval due

  await evaluateBells(tx, auction.id, now);
  assertEqual(auction.bellsRung, 1, 'first call advances bellsRung to 1');
  const afterFirst = events.length;

  // Second call at the same instant: due(1) <= fresh.bellsRung(1) -> short-circuits.
  await evaluateBells(tx, auction.id, now);
  assertEqual(auction.bellsRung, 1, 'second call at the same instant does not double-advance');
  assertEqual(events.length, afterFirst, 'no duplicate bell event created');
}

// ── bellEnabled=false short-circuits immediately, no events ─────────────────
async function testDisabledBellsNoOp() {
  const auction: MockAuction = {
    id: 'a3', roomStatus: 'open', bellAnchorAt: new Date('2026-01-01T00:00:00Z'), bellsRung: 0, status: 'in_progress',
  };
  const group = { bellEnabled: false, bellIntervalSeconds: 60, bellCount: 3, bellAutoClose: true };
  const { tx, events } = makeMockTx(auction, group);
  await evaluateBells(tx, auction.id, new Date('2026-01-01T01:00:00Z'));
  assertEqual(auction.bellsRung, 0, 'bellEnabled=false never advances bellsRung');
  assertEqual(events.length, 0, 'bellEnabled=false creates no events');
}

// ── Room not open (e.g. already closed) short-circuits ──────────────────────
async function testClosedRoomNoOp() {
  const auction: MockAuction = {
    id: 'a4', roomStatus: 'closed', bellAnchorAt: new Date('2026-01-01T00:00:00Z'), bellsRung: 0, status: 'completed',
  };
  const group = { bellEnabled: true, bellIntervalSeconds: 60, bellCount: 3, bellAutoClose: true };
  const { tx, events } = makeMockTx(auction, group);
  await evaluateBells(tx, auction.id, new Date('2026-01-01T01:00:00Z'));
  assertEqual(auction.bellsRung, 0, 'closed room never advances bellsRung');
  assertEqual(events.length, 0, 'closed room creates no events');
}

async function main() {
  await testDueMathCapsAtBellCount();
  await testRaceGuardNoDoubleAdvance();
  await testDisabledBellsNoOp();
  await testClosedRoomNoOp();
  console.log('chitBell tests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
