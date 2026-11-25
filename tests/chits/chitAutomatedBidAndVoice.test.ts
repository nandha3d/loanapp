import assert from 'node:assert/strict';
import {
  assertMonotonicBidDirection,
  assertValidPrizeAmount,
  computeAutomatedBidBounds,
} from '../../lib/chits/validation';

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

console.log('chit automated bid bounds and monotonic direction tests passed');
