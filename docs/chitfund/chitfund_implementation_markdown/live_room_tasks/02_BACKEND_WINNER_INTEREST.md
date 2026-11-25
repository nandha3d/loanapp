# Task 02 — Winner-Interest Backend (Milestone 1)

**Owner:** 1 agent. **Depends on:** 01 (schema merged). **Parallel with:** 03, 04.
**Read** `00_OVERVIEW_AND_DEPENDENCIES.md` first.

## Goal

Implement the "winner pays interest on future installments" rule for **non-bidding chits** (lottery / fixed_rotation), plus the foreman ticket and any auction that has the config set. When a member wins, add a per-period surcharge to that member's future subscriptions, so collection treats it like a small loan repayment layered on the chit installment.

## The rule (from the user, encoded)

- Config on `ChitGroup` (added in task 01): `winnerInterestType` ∈ `NONE | FIXED | PERCENT`, `winnerInterestValue`, `winnerInterestPeriods`.
- On win at period `P`:
  - `perPeriod = winnerInterestType === 'FIXED' ? Number(winnerInterestValue) : roundMoney(chitValue * Number(winnerInterestValue) / 100)`
  - Apply to the **winner's own** `ChitSubscription` rows for `periodNumber` in `[P+1 .. P + (winnerInterestPeriods ?? (totalPeriods - P))]`, skipping any already `paid`:
    `interestAmount += perPeriod`, `dueAmount += perPeriod`.
  - `NONE` ⇒ no-op.
- Worked example (must match task 07 tests): chit 1,00,000, fixedDiscount 5% → prize 95,000; FIXED 1,000 × 6; win period 1 → periods 2–7 `dueAmount` = 11,000 (base 10,000 + interest 1,000), `interestAmount` = 1,000; periods 8–10 unchanged.

## Files

Create `lib/chits/winnerInterest.ts`. Wire it into **both** settlement paths:
- `lib/chits/finalize.ts` → `finalizeAuctionInTx` (System A: confirm/draw/foreman — the primary path for non-bidding chits).
- `lib/chit/settlement.ts` → `settleAuctionWinner` (System B: live bidding close — config-gated, harmless for bidding chits that leave type NONE).

Add unit-test-friendly pure function separated from DB writes.

## `lib/chits/winnerInterest.ts`

```ts
import { roundMoney } from './calculations';

export type WinnerInterestType = 'NONE' | 'FIXED' | 'PERCENT';

// Pure: per-period surcharge amount. No DB, unit-testable.
export function winnerInterestPerPeriod(input: {
  type: string | null | undefined;
  value: number | null | undefined;
  chitValue: number;
}): number {
  const type = (input.type ?? 'NONE') as WinnerInterestType;
  if (type === 'NONE') return 0;
  const value = Number(input.value ?? 0);
  if (!(value > 0)) return 0;
  if (type === 'FIXED') return roundMoney(value);
  if (type === 'PERCENT') return roundMoney((input.chitValue * value) / 100);
  return 0;
}

// Pure: the inclusive [firstPeriod, lastPeriod] window the surcharge covers.
export function winnerInterestWindow(input: {
  wonPeriod: number;
  periods: number | null | undefined; // winnerInterestPeriods
  totalPeriods: number;               // = ChitGroup.totalMembers (one prize per member)
}): { firstPeriod: number; lastPeriod: number } {
  const firstPeriod = input.wonPeriod + 1;
  const span = input.periods ?? input.totalPeriods - input.wonPeriod;
  const lastPeriod = Math.min(input.totalPeriods, input.wonPeriod + span);
  return { firstPeriod, lastPeriod };
}

// Applies the surcharge to the winner's future subscriptions inside a tx.
// `tx` is a Prisma transaction client. Returns the perPeriod amount applied
// (0 when the rule is NONE) so callers can audit it.
export async function applyWinnerInterest(
  tx: any,
  input: {
    winnerMemberId: string;
    wonPeriod: number;
    totalPeriods: number;
    chitValue: number;
    winnerInterestType: string | null | undefined;
    winnerInterestValue: number | null | undefined;
    winnerInterestPeriods: number | null | undefined;
  },
): Promise<number> {
  const perPeriod = winnerInterestPerPeriod({
    type: input.winnerInterestType,
    value: input.winnerInterestValue,
    chitValue: input.chitValue,
  });
  if (perPeriod <= 0) return 0;

  const { firstPeriod, lastPeriod } = winnerInterestWindow({
    wonPeriod: input.wonPeriod,
    periods: input.winnerInterestPeriods,
    totalPeriods: input.totalPeriods,
  });
  if (lastPeriod < firstPeriod) return 0;

  await tx.chitSubscription.updateMany({
    where: {
      memberId: input.winnerMemberId,
      periodNumber: { gte: firstPeriod, lte: lastPeriod },
      status: { not: 'paid' },
    },
    data: {
      interestAmount: { increment: perPeriod },
      dueAmount: { increment: perPeriod },
    },
  });
  return perPeriod;
}
```

## Wire into `lib/chits/finalize.ts`

Inside `finalizeAuctionInTx`, after the winner member is flagged and dividend distribution runs (find the block that does `tx.chitMember.update({ ... hasWon: true })` / calls `applyDividendDistribution`), add:

```ts
import { applyWinnerInterest } from './winnerInterest';
// ...
const interestPerPeriod = await applyWinnerInterest(tx, {
  winnerMemberId: params.selectedBid.memberId,
  wonPeriod: params.auction.periodNumber,
  totalPeriods: params.group.totalMembers,
  chitValue: Number(params.group.chitValue),
  winnerInterestType: params.group.winnerInterestType,
  winnerInterestValue: params.group.winnerInterestValue != null ? Number(params.group.winnerInterestValue) : null,
  winnerInterestPeriods: params.group.winnerInterestPeriods,
});
```

Include `interestPerPeriod` in the existing `createChitAudit(tx, { ... newValue: { ..., interestPerPeriod } })` payload. **Ensure the `group` object passed into `finalizeAuctionInTx` selects the three `winnerInterest*` columns** — check every caller (`confirmAuction`, `drawAuctionWinner`, foreman resolve in `app/(dashboard)/[module]/chits/actions.ts`) loads the group with those fields (they use `include: { chitGroup: true }` or `findFirst` on the group, which returns all scalar columns by default — verify, don't assume a narrow `select`).

## Wire into `lib/chit/settlement.ts`

`settleAuctionWinner` loads `auction` with `include: { chitGroup: true }` (all scalars present). After the `chitMember.updateMany({ hasWon: true })` block and before/after the dividend loop, wrap the interest application. Note this function currently does several writes **outside** a single `$transaction`; keep the interest write consistent with that style — do it right after the dividend decrement loop, using `prisma` directly (there is no shared `tx` there), or better, reuse the existing per-member loop pattern:

```ts
import { applyWinnerInterest } from '@/lib/chits/winnerInterest';
// ... after dividend loop:
await applyWinnerInterest(prisma, {
  winnerMemberId,
  wonPeriod: auction.periodNumber,
  totalPeriods: auction.chitGroup.totalMembers,
  chitValue: Number(auction.chitGroup.chitValue),
  winnerInterestType: auction.chitGroup.winnerInterestType,
  winnerInterestValue: auction.chitGroup.winnerInterestValue != null ? Number(auction.chitGroup.winnerInterestValue) : null,
  winnerInterestPeriods: auction.chitGroup.winnerInterestPeriods,
});
```
Add `interestApplied` to the `auditLog.create` `newValue` JSON.

## Validation (`lib/chits/validation.ts`)

Extend `validateChitConfig` (the function that already validates auctionType/commissionBasis/etc.):

```ts
const WINNER_INTEREST_TYPES = ['NONE', 'FIXED', 'PERCENT'];
// inside validateChitConfig(input):
if (input.winnerInterestType && !WINNER_INTEREST_TYPES.includes(input.winnerInterestType)) {
  throw new Error('Invalid winner interest type');
}
if (input.winnerInterestType && input.winnerInterestType !== 'NONE') {
  if (!(Number(input.winnerInterestValue) > 0)) throw new Error('Winner interest value must be greater than zero');
  if (input.winnerInterestPeriods != null && !(Number(input.winnerInterestPeriods) >= 1)) {
    throw new Error('Winner interest periods must be at least 1');
  }
}
if (input.auctionTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.auctionTime)) {
  throw new Error('Auction time must be HH:mm (24-hour)');
}
```
Add the new params to the `validateChitConfig` input type. Task 04 (create/reschedule actions) calls this; Task 05 (form) passes the fields.

## Payable semantics (document, no code change to collection)

Payable for a subscription = `dueAmount` (which already rolls up base − dividend + penalty, and now + interest). Because we `increment dueAmount` alongside `interestAmount`, the existing collection flow (`collectChitSubscriptionPayment`) needs **no change** — it already collects against `dueAmount`. The `interestAmount` column exists purely for reporting/transparency (a future subscriber-ledger column). Confirm you did **not** double count: interest is added to `dueAmount` exactly once, at settlement.

## Acceptance criteria

- `lib/chits/winnerInterest.ts` exports the three functions; `npm run typecheck` passes.
- Drawing/confirming a winner on a group with `winnerInterestType != NONE` increments the winner's future `interestAmount` and `dueAmount` by `perPeriod` for the correct period window; NONE groups are untouched.
- Both settlement paths call it; audit payloads include the amount.
- No change to non-winner subscriptions from this rule (dividend is separate).
- Task 07 unit tests for the pure functions pass (they will be written against `winnerInterestPerPeriod` / `winnerInterestWindow`).

## Commit

```
feat(chit): winner-interest surcharge for non-bidding chits

Lottery/fixed-rotation (and any configured) winner repays a per-period
surcharge (FIXED ₹ or PERCENT of chit value, for N periods) layered onto
future installments. Pure calc in lib/chits/winnerInterest.ts, applied in
both finalize.ts and settlement.ts, gated by ChitGroup.winnerInterestType.
```
