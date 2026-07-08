# Step 2 — Shared Chit Calculation Engine

## Goal

Create one shared calculation engine for chit auction, foreman commission, bid discount, dividend, due adjustment, payment delta, and status changes.

Current issue found in the app:

- Web server action `recordAuctionWinner` calculates commission based on bid discount.
- Mobile API `POST /api/v1/chits/:id/auctions` calculates commission based on prize amount.
- Dividend divisor is also inconsistent.

This can create wrong financial records. All web, API, mobile, reports, and tests must use one shared library.

## Files to create

```txt
lib/chits/calculations.ts
lib/chits/types.ts
lib/chits/validation.ts
tests/chits/chitCalculation.test.ts
```

## Files to update

```txt
app/(dashboard)/[module]/chits/actions.ts
app/api/v1/chits/[id]/auctions/route.ts
app/api/v1/chits/[id]/payments/route.ts
app/api/v1/chits/subscriptions/[id]/miss/route.ts
lib/reports/builders/chit-auction-report.ts
lib/reports/builders/chit-subscription-due.ts
mobile/lib/data/models/chit.dart
```

## Business rules

### Auction calculation

Inputs:

- `chitValue`
- `prizeAmount`
- `commissionPct`
- `totalMembers`
- `dividendPolicy`

Derived values:

- `bidDiscount = chitValue - prizeAmount`
- `foremanCommission = bidDiscount * commissionPct / 100` unless the business config says commission is based on chit value.
- `distributableDividend = bidDiscount - foremanCommission`
- `dividendPerMember = distributableDividend / dividendEligibleMembers`

Recommended default:

- Commission should be based on bid discount.
- Dividend should be divided among all members unless legal/compliance team confirms excluding winner.
- Keep the dividend policy configurable.

Important: Do not hard-code legal caps. Store them as config/compliance fields and validate against current approved rule values.

## Add types

Create `lib/chits/types.ts`:

```ts
export type ChitDividendPolicy = 'ALL_MEMBERS' | 'NON_WINNERS_ONLY';

export type ChitAuctionCalculationInput = {
  chitValue: number;
  prizeAmount: number;
  commissionPct: number;
  totalMembers: number;
  dividendPolicy?: ChitDividendPolicy;
  roundTo?: number;
};

export type ChitAuctionCalculationResult = {
  chitValue: number;
  prizeAmount: number;
  bidDiscount: number;
  commission: number;
  distributableDividend: number;
  dividend: number;
  dividendEligibleMembers: number;
};

export type ChitPaymentCalculationInput = {
  currentPaidAmount: number;
  incomingAmount: number;
  dueAmount: number;
  mode: 'SET_TOTAL_PAID' | 'ADD_PAYMENT';
};

export type ChitPaymentCalculationResult = {
  previousPaidAmount: number;
  newPaidAmount: number;
  receivedDelta: number;
  status: 'upcoming' | 'partial' | 'paid' | 'missed';
};
```

## Add calculation functions

Create `lib/chits/calculations.ts`:

```ts
import type {
  ChitAuctionCalculationInput,
  ChitAuctionCalculationResult,
  ChitPaymentCalculationInput,
  ChitPaymentCalculationResult,
} from './types';

function roundMoney(value: number, roundTo = 2) {
  const factor = Math.pow(10, roundTo);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateChitAuction(input: ChitAuctionCalculationInput): ChitAuctionCalculationResult {
  const dividendPolicy = input.dividendPolicy ?? 'ALL_MEMBERS';
  const roundTo = input.roundTo ?? 2;

  if (!(input.chitValue > 0)) throw new Error('Chit value must be greater than zero');
  if (!(input.prizeAmount > 0)) throw new Error('Prize amount must be greater than zero');
  if (input.prizeAmount > input.chitValue) throw new Error('Prize amount cannot exceed chit value');
  if (!(input.totalMembers > 0)) throw new Error('Total members must be greater than zero');
  if (input.commissionPct < 0) throw new Error('Commission percentage cannot be negative');

  const bidDiscount = roundMoney(input.chitValue - input.prizeAmount, roundTo);
  const commission = roundMoney((bidDiscount * input.commissionPct) / 100, roundTo);
  const distributableDividend = roundMoney(Math.max(0, bidDiscount - commission), roundTo);
  const dividendEligibleMembers = dividendPolicy === 'NON_WINNERS_ONLY'
    ? Math.max(1, input.totalMembers - 1)
    : input.totalMembers;
  const dividend = roundMoney(distributableDividend / dividendEligibleMembers, roundTo);

  return {
    chitValue: roundMoney(input.chitValue, roundTo),
    prizeAmount: roundMoney(input.prizeAmount, roundTo),
    bidDiscount,
    commission,
    distributableDividend,
    dividend,
    dividendEligibleMembers,
  };
}

export function calculateChitPayment(input: ChitPaymentCalculationInput): ChitPaymentCalculationResult {
  if (input.currentPaidAmount < 0) throw new Error('Current paid amount cannot be negative');
  if (input.incomingAmount < 0) throw new Error('Incoming amount cannot be negative');
  if (input.dueAmount < 0) throw new Error('Due amount cannot be negative');

  const previousPaidAmount = roundMoney(input.currentPaidAmount);
  const newPaidAmount = input.mode === 'ADD_PAYMENT'
    ? roundMoney(previousPaidAmount + input.incomingAmount)
    : roundMoney(input.incomingAmount);

  const receivedDelta = roundMoney(Math.max(0, newPaidAmount - previousPaidAmount));
  const status = newPaidAmount >= input.dueAmount ? 'paid' : newPaidAmount > 0 ? 'partial' : 'upcoming';

  return { previousPaidAmount, newPaidAmount, receivedDelta, status };
}
```

## Add validation helpers

Create `lib/chits/validation.ts`:

```ts
export function assertValidPrizeAmount(params: {
  chitValue: number;
  prizeAmount: number;
  maxDiscountPct?: number | null;
}) {
  const { chitValue, prizeAmount, maxDiscountPct } = params;
  if (prizeAmount <= 0) throw new Error('Prize amount must be greater than zero');
  if (prizeAmount > chitValue) throw new Error('Prize amount cannot exceed chit value');

  if (maxDiscountPct !== null && maxDiscountPct !== undefined) {
    const discount = chitValue - prizeAmount;
    const discountPct = (discount / chitValue) * 100;
    if (discountPct > maxDiscountPct) {
      throw new Error(`Bid discount exceeds allowed maximum of ${maxDiscountPct}%`);
    }
  }
}

export function assertValidCommissionPct(params: {
  commissionPct: number;
  foremanCommissionCapPct?: number | null;
}) {
  const { commissionPct, foremanCommissionCapPct } = params;
  if (commissionPct < 0) throw new Error('Commission percentage cannot be negative');
  if (foremanCommissionCapPct !== null && foremanCommissionCapPct !== undefined && commissionPct > foremanCommissionCapPct) {
    throw new Error(`Commission exceeds allowed cap of ${foremanCommissionCapPct}%`);
  }
}
```

## Update web auction action

In `app/(dashboard)/[module]/chits/actions.ts`, replace inline calculation:

```ts
const chitValue = Number(auction.chitGroup.chitValue);
const commissionPct = Number(auction.chitGroup.commissionPct);
const totalMembers = auction.chitGroup.totalMembers;
const bidDiscount = chitValue - prizeAmount;
const commission = (bidDiscount * commissionPct) / 100;
const dividend = totalMembers > 1 ? (bidDiscount - commission) / (totalMembers - 1) : 0;
```

With:

```ts
import { calculateChitAuction } from '@/lib/chits/calculations';
import { assertValidPrizeAmount, assertValidCommissionPct } from '@/lib/chits/validation';

assertValidPrizeAmount({
  chitValue: Number(auction.chitGroup.chitValue),
  prizeAmount,
  maxDiscountPct: auction.chitGroup.maxDiscountPct ? Number(auction.chitGroup.maxDiscountPct) : null,
});
assertValidCommissionPct({
  commissionPct: Number(auction.chitGroup.commissionPct),
  foremanCommissionCapPct: auction.chitGroup.foremanCommissionCapPct ? Number(auction.chitGroup.foremanCommissionCapPct) : null,
});

const calc = calculateChitAuction({
  chitValue: Number(auction.chitGroup.chitValue),
  prizeAmount,
  commissionPct: Number(auction.chitGroup.commissionPct),
  totalMembers: auction.chitGroup.totalMembers,
  dividendPolicy: 'ALL_MEMBERS',
});

const bidDiscount = calc.bidDiscount;
const commission = calc.commission;
const dividend = calc.dividend;
```

## Update mobile auction API

In `app/api/v1/chits/[id]/auctions/route.ts`, remove current calculation:

```ts
const commission = prizeAmount
  ? Math.round((prizeAmount * Number(group.commissionPct)) / 100)
  : null;
const dividend =
  prizeAmount && commission
    ? Math.round((Number(group.chitValue) - prizeAmount - commission) / group.totalMembers)
    : null;
```

Replace with shared calculation:

```ts
const calc = prizeAmount
  ? calculateChitAuction({
      chitValue: Number(group.chitValue),
      prizeAmount,
      commissionPct: Number(group.commissionPct),
      totalMembers: group.totalMembers,
      dividendPolicy: 'ALL_MEMBERS',
    })
  : null;

const bidDiscountToSave = calc?.bidDiscount ?? bidDiscount ?? null;
const commission = calc?.commission ?? null;
const dividend = calc?.dividend ?? null;
```

## Fix payment amount semantics

Current web detail page can submit outstanding amount, while backend treats it as total paid amount. Standardize both options.

Backend should accept:

```ts
{
  amount: 3000,
  mode: 'ADD_PAYMENT'
}
```

or

```ts
{
  paidAmount: 5000,
  mode: 'SET_TOTAL_PAID'
}
```

Recommended implementation:

- Web detail modal should send additional payment amount as `amount` and `mode: 'ADD_PAYMENT'`.
- Collection page can continue to send total paid if already built that way, but must explicitly pass `mode: 'SET_TOTAL_PAID'`.
- Mobile should send `amount` and `mode: 'ADD_PAYMENT'` for field collection.

Update API to use `calculateChitPayment`.

## Required tests

Create `tests/chits/chitCalculation.test.ts`.

Test cases:

1. Calculates discount correctly.
2. Calculates commission from discount, not prize amount.
3. Calculates dividend with `ALL_MEMBERS` policy.
4. Calculates dividend with `NON_WINNERS_ONLY` policy.
5. Rejects prize amount greater than chit value.
6. Rejects negative commission.
7. Payment `ADD_PAYMENT` increases current paid amount.
8. Payment `SET_TOTAL_PAID` overwrites total paid amount.
9. Partial payment status remains `partial`.
10. Full payment status becomes `paid`.

Example:

```ts
import { calculateChitAuction, calculateChitPayment } from '@/lib/chits/calculations';

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) throw new Error(`${message}. Expected ${expected}, got ${actual}`);
}

const calc = calculateChitAuction({
  chitValue: 100000,
  prizeAmount: 75000,
  commissionPct: 5,
  totalMembers: 20,
});

assertEqual(calc.bidDiscount, 25000, 'bid discount');
assertEqual(calc.commission, 1250, 'commission');
assertEqual(calc.distributableDividend, 23750, 'distributable dividend');
assertEqual(calc.dividend, 1187.5, 'dividend per member');

const pay = calculateChitPayment({
  currentPaidAmount: 2000,
  incomingAmount: 3000,
  dueAmount: 5000,
  mode: 'ADD_PAYMENT',
});
assertEqual(pay.newPaidAmount, 5000, 'new paid amount');
assertEqual(pay.receivedDelta, 3000, 'cash delta');
assertEqual(pay.status, 'paid', 'payment status');
```

## Acceptance criteria

- No auction calculation exists directly inside UI/server action/API route.
- Web and mobile auction APIs return the same values for the same input.
- Payment modal bug is fixed.
- Tests prove calculation behavior.
- Reports use saved calculated values or shared calculation helpers.
- All money values are rounded consistently.

## Implementation prompt for coding agent

```txt
Implement Step 2 for the LoanTrack chit-fund module.

Create lib/chits/types.ts, lib/chits/calculations.ts, and lib/chits/validation.ts. Move all auction, commission, discount, dividend, and payment delta calculations into these shared functions.

Update app/(dashboard)/[module]/chits/actions.ts and app/api/v1/chits/[id]/auctions/route.ts to use the shared calculation engine. Fix the web/mobile inconsistency where web calculates commission from bid discount but mobile calculates it from prize amount. Standardize payment handling so ADD_PAYMENT and SET_TOTAL_PAID are explicit, and fix the outstanding-payment bug from the chit detail page.

Add tests/chits/chitCalculation.test.ts and package script test:chits:calculation. Run typecheck and the new calculation test.
```
