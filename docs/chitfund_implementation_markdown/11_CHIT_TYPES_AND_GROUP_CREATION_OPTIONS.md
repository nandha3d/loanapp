# Step 11 — Chit Types and Group Creation Options

## Goal

Support every chit variety operated in different regions from one `ChitGroup` configuration, selected at group creation time.

Real chit businesses do not run one kind of chit. The same operator may run:

- A registered auction chit with monthly open bidding.
- An unregistered friends/office chit with weekly lottery draws.
- A daily small-value chit with fixed rotation payout order.
- A sealed-tender chit where bids are opened together.

The group creation form must expose all of these as configuration, and every downstream module (calculation engine, auction workflow, collections, reports) must read behavior from this configuration instead of assuming one style.

## Value convention

- Status fields keep the existing lowercase convention (`active`, `pending`, `vacant`).
- Configuration enum fields store UPPERCASE tokens (`ALL_MEMBERS`, `BID_DISCOUNT`) so the DB value and the TypeScript union in `lib/chits/types.ts` are identical — no mapping layer.

## Files to update

```txt
prisma/schema.prisma
lib/chits/types.ts
lib/chits/validation.ts
lib/chits/status.ts
app/(dashboard)/[module]/chits/new/ChitGroupForm.tsx
app/(dashboard)/[module]/chits/[id]/edit/ChitGroupEditForm.tsx
app/(dashboard)/[module]/chits/actions.ts
app/api/v1/chits/route.ts
mobile/lib/features/chits/chit_form_screen.dart
mobile/lib/data/models/chit.dart
```

## 1. Chit type — registered vs unregistered

Field on `ChitGroup`:

```prisma
chitType String @default("unregistered") @map("chit_type") // registered, unregistered
```

| chitType | Meaning | Activation requirement |
|---|---|---|
| `registered` | Chit registered with the registrar under the applicable Chit Funds Act. | Full compliance checklist from Step 3 (registration no, registrar office, by-law, commencement certificate, approved bank, foreman details). |
| `unregistered` | Informal/private chit run on trust. | Members complete, tickets unique, terms (value, installment, duration, commission, auction type) set. Registration fields hidden or optional. |

Step 3 activation validation must branch on this field. Backfill: existing groups get `chitType = registered` when `registrationNo` is present, otherwise `unregistered`.

## 2. Auction type

Field on `ChitGroup`:

```prisma
auctionType String @default("open_manual") @map("auction_type") // open_manual, open_live, sealed, lottery, fixed_rotation
```

| auctionType | How the winner is decided | Bid entry | Discount source |
|---|---|---|---|
| `open_manual` | Physical/phone auction. Staff types bids into the auction page during or after the event. Highest valid discount wins. | Staff, any time before confirm | Live bids |
| `open_live` | Online live beat. Bidding room with countdown; members/staff place bids in real time. Highest valid discount at close wins. See `12_LIVE_AUCTION_ROOM_POLLING.md`. | Staff + member app while room open | Live bids |
| `sealed` | Sealed tender. Bids are collected hidden and opened together after close. Highest valid discount wins. | Staff enters sealed bids; amounts hidden from other members until opened | Sealed bids |
| `lottery` | No bidding. Winner drawn at random from eligible (non-prized, non-defaulted) tickets. | None — draw button | `fixedDiscountPct` (may be 0) |
| `fixed_rotation` | Payout order predetermined (ticket order or agreed schedule). Period N winner is known in advance. | None | `fixedDiscountPct` (usually 0) |

Supporting field:

```prisma
fixedDiscountPct Decimal? @map("fixed_discount_pct") @db.Decimal(5, 2) // lottery / fixed_rotation: predetermined discount % of chit value
```

For `lottery` and `fixed_rotation`:

```txt
bidDiscount = chitValue * fixedDiscountPct / 100   (0 when fixedDiscountPct is null/0)
prizeAmount = chitValue - bidDiscount
```

Commission and dividend then flow through the same shared calculation engine (Step 2). This is how "auto dividend split" works for non-auction chits.

Hybrid rule (very common in Tamil Nadu): in `open_manual`/`open_live`/`sealed`, when several bidders hit `maxDiscountPct`, the tie is settled by lot — covered by `tieBreakRule` below.

## 3. Frequency and installment

`auctionFrequency` (Step 1) gains the full range:

```txt
daily | weekly | fortnightly | monthly
```

- Subscription generation on activation creates one period per frequency interval: `durationMonths` stays the group length driver for monthly; for daily/weekly/fortnightly use `totalMembers` periods (one prize per member is the invariant, so **periods = totalMembers** for every frequency).
- The DB column `monthlyContrib` is kept (no destructive rename) but is documented and labelled everywhere in UI as **Installment amount** — the amount due per period, whatever the frequency.
- `auctionDay` meaning by frequency: day-of-month for monthly/fortnightly, ISO weekday (1–7) for weekly, ignored for daily.

## 4. Commission configuration

```prisma
commissionBasis String   @default("BID_DISCOUNT") @map("commission_basis") // BID_DISCOUNT, CHIT_VALUE
gstPct          Decimal? @map("gst_pct") @db.Decimal(5, 2)                 // optional GST on foreman commission (registered chits)
```

| commissionBasis | Formula |
|---|---|
| `BID_DISCOUNT` | `commission = bidDiscount * commissionPct / 100` |
| `CHIT_VALUE` | `commission = chitValue * commissionPct / 100` |

- `foremanCommissionCapPct` (Step 1) still caps `commissionPct`.
- When `gstPct` is set, `gstAmount = commission * gstPct / 100` is calculated and reported separately (foreman commission report); it is **not** deducted from the dividend pool — it is the foreman's tax liability on commission income.

## 5. Dividend configuration

```prisma
dividendPolicy       String @default("ALL_MEMBERS") @map("dividend_policy")            // ALL_MEMBERS, NON_WINNERS_ONLY
dividendDistribution String @default("ADJUST_NEXT_DUE") @map("dividend_distribution")  // ADJUST_NEXT_DUE, CASH_PAYOUT, ACCUMULATE
dividendRounding     Int    @default(0) @map("dividend_rounding")                      // 0 = exact, 1 = round to rupee, 10 = round to ten rupees
```

### dividendPolicy — who shares the dividend

| Value | Eligible members |
|---|---|
| `ALL_MEMBERS` | Every ticket including the current winner. |
| `NON_WINNERS_ONLY` | Every ticket except the current period's winner. |

The calculation engine (Step 2) must take this from group config. Call sites must never hard-code a policy.

### dividendDistribution — how the dividend reaches the member

| Value | Behavior |
|---|---|
| `ADJUST_NEXT_DUE` | Next period's payable is reduced: `payable = baseDueAmount - dividendAmount + penaltyAmount`. Default, matches Step 5/7 subscription fields. |
| `CASH_PAYOUT` | Dividend is paid out in cash/bank per member per period. Creates a `ChitReceipt` (`receiptType = dividend_payout`) and an account entry; branch wallet debited. Subscription due stays full. |
| `ACCUMULATE` | Dividend accrues in a member ledger and is settled at group closure (or against the final installments). Store per-period rows so the dividend register reports it. |

### dividendRounding

- `0`: exact paise.
- `1` / `10`: each member's dividend is rounded **down** to the nearest ₹1/₹10; the total remainder (`distributableDividend - dividendPerMember * eligibleCount`) is posted as foreman rounding income and must appear in the foreman commission report. Nothing silently disappears.

## 6. Bid rules

```prisma
minDiscountPct Decimal? @map("min_discount_pct") @db.Decimal(5, 2)   // null => defaults to commissionPct at validation time
bidIncrement   Decimal? @map("bid_increment") @db.Decimal(14, 2)     // null => any amount step allowed
tieBreakRule   String   @default("EARLIEST_BID") @map("tie_break_rule") // EARLIEST_BID, LOTTERY_AMONG_TIED
```

- **Minimum discount**: an auction cannot open below the foreman's commission — default floor is `commissionPct` when `minDiscountPct` is null. Validation: `bidDiscountPct >= (minDiscountPct ?? commissionPct)`.
- **Bid increment**: when set, each new bid's discount must exceed the current highest by at least `bidIncrement` (absolute amount).
- **Maximum discount**: `maxDiscountPct` from Step 1 stays the ceiling.
- **tieBreakRule** when top discounts are equal (typically at the cap):
  - `EARLIEST_BID`: first bid at that discount wins (current Step 5 behavior).
  - `LOTTERY_AMONG_TIED`: random draw among the tied bidders; the draw must be audit-logged (see `12_LIVE_AUCTION_ROOM_POLLING.md` lottery draw spec).

## 7. Foreman ticket and vacant tickets

### Foreman ticket

```prisma
hasForemanTicket Boolean @default(false) @map("has_foreman_ticket") // on ChitGroup
isForemanTicket  Boolean @default(false) @map("is_foreman_ticket")  // on ChitMember
```

Common practice: the foreman/company holds ticket 1 and takes the **period-1 prize without auction** (working capital), then pays installments like any subscriber for the remaining periods.

Behavior when `hasForemanTicket = true`:

- Exactly one member must have `isForemanTicket = true` (activation validation).
- Period 1 auction is auto-resolved: winner = foreman ticket, `bidDiscount` per `fixedDiscountPct` (usually 0), status flows straight to `confirmed`; security step may be waived for the foreman ticket by config/role.
- Foreman ticket is excluded from later draws/bids (it has already won).

### Vacant tickets

New `subscriberStatus` value on `ChitMember`: `vacant`.

- A vacant ticket is an unsold slot held by the company so the group can start full. The company pays its installments (posted as company contribution, not customer cash).
- When a new subscriber buys in, the vacant member is substituted using the Step 4 substitution flow (history preserved), and arrears are settled per business rule.
- Vacant tickets are eligible for dividend (they are paying) but **not** for lottery draws or bidding while vacant, unless the business explicitly allows the company to take a prize.
- This feeds the `vacant-chit-report` already linked from the analytics page (Step 8).

## 8. Fractional tickets

```prisma
ticketShare Decimal @default(1.00) @map("ticket_share") @db.Decimal(4, 2) // 1.00, 0.50, 0.25
```

Several subscribers can share one ticket (half/quarter tickets). Rules:

- `fractionNo` (Step 1) labels the fragment (`12-A`, `12-B`); all fragments share the same `ticketNo`.
- Sum of `ticketShare` per `ticketNo` must equal 1.00 (activation validation).
- Money math is share-weighted:
  - installment due = `installmentAmount * ticketShare`
  - dividend = `dividendPerTicket * ticketShare`
  - prize = winning ticket's fragments split `prizeAmount` by share; every fragment holder must clear security (Step 6) before payout.
- One full ticket = one bid/draw entry: fragments bid jointly (any fragment holder may place the bid for the ticket).
- Group member-count invariant becomes **tickets**, not member rows: `distinct ticketNo count == totalMembers`.

## 9. Group creation form — option matrix

Extends the 6-section wizard from Step 3 (`app/(dashboard)/[module]/chits/new/ChitGroupForm.tsx`):

| Section | Fields | Shown when |
|---|---|---|
| 1. Basic details | name, chitValue, installmentAmount, totalMembers, duration, startDate, **chitType** | always |
| 2. Chit style | **auctionType**, auctionFrequency, auctionDay, auctionMode, fixedDiscountPct | fixedDiscountPct only for `lottery`/`fixed_rotation` |
| 3. Registration & approval | registrationNo, registrationDate, registrarOffice, bylawNo, commencementCertificate, compliance documents | `chitType = registered` only (hidden otherwise) |
| 4. Foreman & commission | foremanName, commissionPct, commissionBasis, foremanCommissionCapPct, gstPct, hasForemanTicket | always; gstPct only for registered |
| 5. Bid & dividend rules | minDiscountPct, maxDiscountPct, bidIncrement, tieBreakRule, dividendPolicy, dividendDistribution, dividendRounding | bid fields hidden for `lottery`/`fixed_rotation` |
| 6. Bank details | approvedBankName, approvedBankAccountNo | required for registered, optional otherwise |
| 7. Members & tickets | member selection, ticketNo, ticketShare, fractionNo, isForemanTicket, vacant slots | always |
| 8. Review & create | summary of every option above | always |

Sensible defaults so a small operator can create a working group by filling only section 1: `unregistered`, `open_manual`, `monthly`, commission 5% on `BID_DISCOUNT`, dividend `ALL_MEMBERS` / `ADJUST_NEXT_DUE`, no rounding, tie `EARLIEST_BID`.

## 10. Validation summary (`lib/chits/validation.ts`)

- `fixedDiscountPct` required to be ≥ 0 and ≤ `maxDiscountPct` (when both set); only meaningful for `lottery`/`fixed_rotation`.
- `minDiscountPct <= maxDiscountPct` when both set.
- `hasForemanTicket` ⇒ exactly one `isForemanTicket` member.
- Fraction shares per ticket sum to 1.00.
- Distinct ticket count equals `totalMembers` at activation.
- `chitType = registered` ⇒ Step 3 full compliance checklist; `unregistered` ⇒ short checklist.
- Config enums restricted to the documented token sets.

## Acceptance criteria

- Group creation form exposes chit type, auction type, frequency, commission basis, dividend policy/distribution/rounding, bid rules, foreman ticket, vacant slots, and fractional shares.
- An unregistered weekly lottery chit and a registered monthly open-auction chit can both be created and activated from the same form.
- Downstream calculation (Step 2), auction workflow (Step 5), collections (Step 7), and reports (Step 8) read these options from group config — nothing hard-coded.
- Backfill assigns `chitType`, defaults for all new config columns, and `ticketShare = 1.00` for existing members.
- Mobile group form/detail shows the same options (create for admin, read-only for agents).

## Implementation prompt for coding agent

```txt
Implement Step 11 for the LoanTrack chit-fund module.

Add chit variant configuration to ChitGroup: chitType, auctionType, fixedDiscountPct, commissionBasis, gstPct, dividendPolicy, dividendDistribution, dividendRounding, minDiscountPct, bidIncrement, tieBreakRule, hasForemanTicket; add ticketShare and isForemanTicket to ChitMember and the vacant subscriberStatus. Store config enums as UPPERCASE tokens matching lib/chits/types.ts unions; statuses stay lowercase.

Rebuild the group creation wizard per the option matrix in 11_CHIT_TYPES_AND_GROUP_CREATION_OPTIONS.md, hiding registration fields for unregistered chits and bid rules for lottery/fixed_rotation chits. Enforce the validation summary in lib/chits/validation.ts. Backfill existing groups (chitType from registrationNo presence, defaults elsewhere). Update mobile form/model. All downstream modules must read behavior from this config.
```
