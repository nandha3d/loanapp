import { effectiveMinDiscountPct, startingDiscountAmount, assertValidPrizeAmount } from '../../lib/chits/validation';

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

function assertDoesNotThrow(fn: () => void, message: string) {
  try {
    fn();
  } catch (e: any) {
    throw new Error(`${message}. Unexpected throw: ${e.message}`);
  }
}

// ── effectiveMinDiscountPct matrix ──────────────────────────────────────────
// minDiscountPct set -> always wins, regardless of toggle
assertEqual(
  effectiveMinDiscountPct({ minDiscountPct: 8, bidStartAtCommission: true, commissionPct: 5 }),
  8,
  'explicit minDiscountPct wins over toggle=true',
);
assertEqual(
  effectiveMinDiscountPct({ minDiscountPct: 8, bidStartAtCommission: false, commissionPct: 5 }),
  8,
  'explicit minDiscountPct wins over toggle=false',
);

// minDiscountPct null, toggle true (default) -> commissionPct
assertEqual(
  effectiveMinDiscountPct({ minDiscountPct: null, bidStartAtCommission: true, commissionPct: 5 }),
  5,
  'toggle=true falls back to commissionPct',
);
assertEqual(
  effectiveMinDiscountPct({ minDiscountPct: null, commissionPct: 5 }), // bidStartAtCommission omitted — schema default is true
  5,
  'omitted toggle defaults to commission floor (matches schema default true)',
);

// minDiscountPct null, toggle false -> no floor
assertEqual(
  effectiveMinDiscountPct({ minDiscountPct: null, bidStartAtCommission: false, commissionPct: 5 }),
  null,
  'toggle=false with no explicit floor means no floor',
);

// both null -> no floor
assertEqual(
  effectiveMinDiscountPct({ minDiscountPct: null, bidStartAtCommission: true, commissionPct: null }),
  null,
  'both null means no floor even with toggle on',
);

// commissionPct = 0 with toggle true -> floor is 0 (not a special case)
assertEqual(
  effectiveMinDiscountPct({ minDiscountPct: null, bidStartAtCommission: true, commissionPct: 0 }),
  0,
  'commissionPct=0 floor is 0%, not null',
);

// ── startingDiscountAmount ───────────────────────────────────────────────
assertEqual(
  startingDiscountAmount(100000, { minDiscountPct: null, bidStartAtCommission: true, commissionPct: 5 }),
  5000,
  'starting discount amount at 5% of 100000',
);
assertEqual(
  startingDiscountAmount(100000, { minDiscountPct: null, bidStartAtCommission: false, commissionPct: 5 }),
  0,
  'no floor -> starting discount amount is 0',
);

// ── Integration: group with commission 5%, chit value 100000,
// bidStartAtCommission=true (default) — first bid at 4% rejected, at 5% accepted ──
const group = { chitValue: 100000, commissionPct: 5, bidStartAtCommission: true };
assertThrows(
  () => assertValidPrizeAmount({ chitValue: group.chitValue, prizeAmount: 96000, commissionPct: group.commissionPct, bidStartAtCommission: group.bidStartAtCommission }),
  'discount 4% (prize 96000) below 5% floor must be rejected',
);
assertDoesNotThrow(
  () => assertValidPrizeAmount({ chitValue: group.chitValue, prizeAmount: 95000, commissionPct: group.commissionPct, bidStartAtCommission: group.bidStartAtCommission }),
  'discount exactly 5% (prize 95000) must be accepted',
);

// Toggle off + no explicit minDiscountPct -> a near-zero discount is accepted
assertDoesNotThrow(
  () => assertValidPrizeAmount({ chitValue: group.chitValue, prizeAmount: 99999, commissionPct: group.commissionPct, bidStartAtCommission: false }),
  'toggle off allows a bid far below the commission %',
);

console.log('chitBidFloor tests passed');
