# Step 13 — Bid Starts From Commission (Configurable Discount Floor)

> **Implementation status (2026-07-14): NOT IMPLEMENTED.** No `bidStartAtCommission` field exists; the commission-floor fallback is implicit and inconsistently applied. This doc specifies making it explicit, configurable, and consistent everywhere a "minimum next bid" is computed.

## Goal

Requested behaviour: "commission 5000, bidding starts from 5000, 5500, 6000 etc." — i.e. the very first bid discount in an auction should default to the group's commission amount (not ₹0), so members can't undercut the foreman's minimum take. This should be an explicit per-group toggle, **default ON** (matches the client's expectation and the pre-existing implicit behaviour), with the door open to override with an explicit `minDiscountPct` that is unrelated to commission.

## Current state (verified)

- `lib/chits/validation.ts:23` — `assertValidPrizeAmount()` already does `const minPct = minDiscountPct ?? commissionPct ?? null;` — so the **server-side hard floor already falls back to commission** when no explicit `minDiscountPct` is set. This is silent/implicit behaviour with no toggle and no way to turn it off (a group that genuinely wants bids to start at ₹0 discount cannot).
- `lib/chits/customerAuction.ts:88-101` (`buildCustomerLiveState`) — **independently duplicates** the same floor calculation (`minPct` → `floorDiscount` → `minNextDiscount`) to tell the customer app what the next valid bid is.
- `app/(dashboard)/[module]/chits/actions.ts:1138-1139` (`getLiveAuctionState`) — the **staff-web equivalent is a bug**: `minNextPrize` is computed as `Math.max(1, (highestBid?.bidAmount ?? chitValue) - minStep)` — this **never applies the discount floor at all** when there are no bids yet. Staff live-room UI can therefore display/accept a first bid of ₹1 discount even when the customer app and the hard validator both expect the commission floor. This is a real, user-visible inconsistency between staff and customer views of "next minimum bid" and must be fixed as part of this feature, not left as a separate bug.
- `prisma/schema.prisma:1180` — `ChitGroup.commissionPct Decimal @default(5.00)`. `1207` — `minDiscountPct Decimal?` (nullable, currently the only escape hatch).
- No field currently distinguishes "floor comes from commission" vs "floor is explicit" vs "no floor" — it's inferred purely from whether `minDiscountPct` is null.

## Schema changes

```prisma
model ChitGroup {
  // ...existing fields...
  bidStartAtCommission Boolean @default(true) @map("bid_start_at_commission")
}
```

Migration is additive/defaulted — every existing group gets `true`, which reproduces today's implicit fallback exactly (no behaviour change for existing groups on deploy).

Semantics of the three inputs together:

| `minDiscountPct` | `bidStartAtCommission` | Effective floor |
|---|---|---|
| set (e.g. 8%) | any | `minDiscountPct` wins — explicit always overrides |
| null | `true` (default) | `commissionPct` |
| null | `false` | no floor (bids may start at ₹0 discount / full chit value prize) |

## Backend design

New shared helper in `lib/chits/validation.ts` (co-locate with `assertValidPrizeAmount`, which currently reimplements this inline):

```ts
export function effectiveMinDiscountPct(group: {
  minDiscountPct?: number | null;
  bidStartAtCommission?: boolean;
  commissionPct?: number | null;
}): number | null {
  if (group.minDiscountPct != null) return group.minDiscountPct;
  if (group.bidStartAtCommission !== false && group.commissionPct != null) return group.commissionPct;
  return null;
}

export function startingDiscountAmount(chitValue: number, group: Parameters<typeof effectiveMinDiscountPct>[0]): number {
  const pct = effectiveMinDiscountPct(group);
  return pct != null ? roundMoney((chitValue * pct) / 100) : 0;
}
```

Wire this single helper into every place that currently derives a floor independently, so there is exactly one source of truth:

1. **`assertValidPrizeAmount`** (`validation.ts:10-30`) — replace the inline `minDiscountPct ?? commissionPct` with `effectiveMinDiscountPct(params)`. This is the hard server-side gate inside `placeChitBid` (`bidService.ts:55-61`) — nothing can bid below the floor regardless of client.
2. **`buildCustomerLiveState`** (`customerAuction.ts:88-101`) — replace the duplicated `minPct`/`floorDiscount` block with a call to `startingDiscountAmount(chitValueNum, auction.chitGroup)`, keep the existing `minNextDiscount = highestBid ? max(highest+increment, floor) : floor` logic (that part is already correct, just remove the duplicated floor derivation).
3. **`getLiveAuctionState`** (`actions.ts:1138-1139`, staff web) — **fix the bug**: when there is no `highestBid`, `minNextPrize` must be `chitValue - startingDiscountAmount(chitValue, group)`, not `chitValue - minStep`. When there is a highest bid, keep existing `highestBid.bidAmount - minStep` behaviour (that path is fine — the floor only matters for the opening bid; increments take over after).
4. **Chit group create/update actions** (`actions.ts` ~128-220, ~1312) — accept and persist `bidStartAtCommission` from the form (default `true` if omitted, matching the schema default).

## Web UI

- **Group create/edit form** (`ChitGroupForm.tsx` or equivalent under `chits/new` / `chits/[id]/edit`): checkbox "Start bidding from commission amount" next to the existing Commission % field, checked by default. When checked, show a live-computed helper chip: `Starting bid discount: ₹{startingDiscountAmount} (Prize starts at ₹{chitValue - startingDiscountAmount})`. When unchecked, the existing `minDiscountPct` field (if the form exposes one) becomes the only floor, and clearing it means no floor.
- **Staff live room** (`AuctionDetailClient.tsx`): the room-open / bid-entry area should show the same "Starting bid discount ₹X" chip sourced from `minNextPrize`/`minNextDiscount` in the poll payload — no separate calculation in the component.

## Mobile (Flutter)

- `borrower_chit_live_screen.dart` and `chit_live_auction_screen.dart` already render `minNextDiscount`/`minNextPrize` from the poll payload (no client-side floor math to duplicate) — once the two server-side payload builders are fixed/aligned (points 2 and 3 above), mobile is correct with no code change required. Verify by reading the current bid-entry widget to confirm it purely displays the server value (do not let it silently default to 0 if the field is null).

## Edge cases

- `commissionPct = 0` and `bidStartAtCommission = true` → floor is 0%, i.e. no effective floor. Fine, not a special case.
- Group has both `minDiscountPct` set AND `bidStartAtCommission = true` → `minDiscountPct` wins per the table above (explicit always beats implicit); document this in the UI helper text so admins aren't confused why unchecking the toggle doesn't remove the floor.
- Existing in-progress auctions with bids already below the new commission floor (from before this feature) must not be retroactively invalidated — the floor only gates **new** bids via `assertValidPrizeAmount`; never re-validate historical `ChitBid` rows.
- `bidIncrement` + floor interplay: first bid must clear the floor; subsequent bids must clear `highest + bidIncrement` (existing `bidService.ts:82-95` logic, unchanged).

## Verification steps

- Unit test `effectiveMinDiscountPct` / `startingDiscountAmount` matrix: (minDiscountPct set, toggle true/false) × (toggle true/false, commissionPct set/0) × (both null).
- Integration: create a group with commission 5%, chit value 100000, `bidStartAtCommission=true` (default) — assert first bid attempt at discount 4000 (4%) is rejected by `placeChitBid`, and at 5000 (5%) is accepted; assert customer-app `minNextDiscount` and staff-web `minNextPrize` agree (both derive prize = 95000) before any bid exists.
- Regression: existing groups (migration default `true`) must produce identical `minNextPrize`/`minNextDiscount` values before and after deploy — snapshot a few real groups' computed floor pre/post migration.

## Dependencies

None — this is schema-additive and can ship in Phase 1 alongside doc 16 (frequency engine) since both are simple `ChitGroup` config additions with no live-room engine changes.
