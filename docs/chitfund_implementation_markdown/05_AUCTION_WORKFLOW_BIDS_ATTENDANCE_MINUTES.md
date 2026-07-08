# Step 5 — Auction Workflow with Bids, Attendance, and Minutes

> **Implementation status (2026-07-08): BACKEND DONE, UI MISSING + 3 LOGIC GAPS.** Bids/attendance/notice/confirm with minutes, audit, and `payoutStatus=security_pending` are implemented; payout is no longer posted at confirmation. Missing: the auction detail page (web) and screen wiring (mobile); `tieBreakRule` not honored in `getWinningBid`; lottery/fixed_rotation groups have no draw path; confirm resurrects withdrawn/rejected bids (`updateMany → valid`). See `IMPLEMENTATION_STATUS_GAP_ANALYSIS.md` gaps 1, 2, 6.

## Goal

Convert the current basic auction winner entry into a proper chit auction module.

Current state:

- `ChitAuction` stores only period, winner, prize amount, discount, commission, dividend, and status.
- Web and mobile can record winner directly.
- There is no attendance, bid history, auction notice, auction minutes, or confirmation workflow.

Target state:

- Auction schedule is created per period.
- Notice can be marked as sent.
- Attendance is captured.
- Multiple bids are recorded.
- Winner is selected from valid bids.
- Auction is confirmed.
- Minutes are generated and saved.
- Only confirmed auction can move toward payout security workflow.

## Files to create

```txt
lib/chits/auction.ts
app/(dashboard)/[module]/chits/[id]/auctions/[auctionId]/page.tsx
app/(dashboard)/[module]/chits/[id]/auctions/[auctionId]/AuctionDetailClient.tsx
app/api/v1/chits/[id]/auctions/[auctionId]/bids/route.ts
app/api/v1/chits/[id]/auctions/[auctionId]/attendance/route.ts
app/api/v1/chits/[id]/auctions/[auctionId]/confirm/route.ts
```

## Files to update

```txt
app/(dashboard)/[module]/chits/[id]/ChitGroupDetailClient.tsx
app/(dashboard)/[module]/chits/actions.ts
app/api/v1/chits/[id]/auctions/route.ts
mobile/lib/data/models/chit.dart
mobile/lib/data/services/chit_service.dart
mobile/lib/features/chits/chit_detail_screen.dart
lib/chits/calculations.ts
lib/chits/validation.ts
```

## Auction lifecycle

Use statuses:

```txt
pending -> notice_sent -> in_progress -> completed -> confirmed -> payout_pending -> paid
```

Recommended status usage:

| Status | Meaning |
|---|---|
| `pending` | Auction stub created but not started. |
| `notice_sent` | Notice sent/marked for subscribers. |
| `in_progress` | Attendance/bids are being recorded. |
| `completed` | Winner selected, but not finally confirmed. |
| `confirmed` | Auction result approved and locked. |
| `payout_pending` | Security/payout process is pending. |
| `paid` | Prize payout completed. |
| `cancelled` | Auction cancelled. |

## Auction detail page

Create:

```txt
app/(dashboard)/[module]/chits/[id]/auctions/[auctionId]/page.tsx
app/(dashboard)/[module]/chits/[id]/auctions/[auctionId]/AuctionDetailClient.tsx
```

Sections:

1. Auction summary
   - Group name
   - Period number
   - Auction date
   - Chit value
   - Status
   - Notice status
2. Attendance
   - Member list
   - Present/Absent/Proxy
   - Mark attendance button
3. Bid entry
   - Select member
   - Bid prize amount
   - Bid discount auto-calculated
   - Remarks
   - Add bid button
4. Bid history
   - Bid time
   - Ticket number
   - Subscriber
   - Bid amount
   - Discount
   - Status
5. Winner selection
   - Highest valid discount highlighted
   - Select winning bid
   - Calculate commission/dividend preview
6. Auction minutes
   - Auto-generated text
   - Editable notes
   - Confirm auction button

## Auction library

Create `lib/chits/auction.ts`:

```ts
import { calculateChitAuction } from './calculations';

export function getWinningBid<T extends { bidDiscount: number; bidTime: Date; status: string }>(bids: T[]): T | null {
  const valid = bids.filter((b) => b.status === 'valid');
  if (!valid.length) return null;
  return valid.sort((a, b) => {
    if (b.bidDiscount !== a.bidDiscount) return b.bidDiscount - a.bidDiscount;
    return a.bidTime.getTime() - b.bidTime.getTime();
  })[0];
}

export function generateAuctionMinutes(input: {
  groupName: string;
  periodNumber: number;
  auctionDate: Date;
  totalMembers: number;
  presentCount: number;
  winnerName: string;
  prizeAmount: number;
  bidDiscount: number;
  commission: number;
  dividend: number;
}) {
  return [
    `Auction for ${input.groupName}, period ${input.periodNumber}, was conducted on ${input.auctionDate.toDateString()}.`,
    `${input.presentCount} out of ${input.totalMembers} subscribers were marked present/proxy.`,
    `${input.winnerName} was selected as the prize subscriber.`,
    `Prize amount: ${input.prizeAmount}. Bid discount: ${input.bidDiscount}.`,
    `Foreman commission: ${input.commission}. Dividend per eligible subscriber: ${input.dividend}.`,
  ].join('\n');
}
```

## Backend rules

### Add bid

When adding a bid:

1. Validate auction belongs to tenant + branch.
2. Validate auction is not confirmed/paid/cancelled.
3. Validate member belongs to group.
4. Validate member has not already won.
5. Validate prize amount and max discount.
6. Calculate bid discount.
7. Save `ChitBid`.
8. Audit log.

### Mark attendance

When marking attendance:

1. Validate member belongs to group.
2. Upsert attendance row.
3. Allow proxy only with proxy name.
4. Audit log.

### Confirm auction

When confirming auction:

1. Validate role admin/superadmin/developer.
2. Validate at least one valid bid.
3. Select winning bid.
4. Validate winner has not won.
5. Run shared calculation engine.
6. Mark winning bid as `winning`.
7. Update auction:
   - `winnerMemberId`
   - `prizeAmount`
   - `bidDiscount`
   - `commission`
   - `dividend`
   - `status = confirmed`
   - `payoutStatus = security_pending`
   - `confirmedById`
   - `confirmedAt`
   - `minutesText`
8. Update member `hasWon = true` and `wonAt = now`.
9. Apply dividend adjustment based on policy.
10. Do not release prize payout here. Prize payout belongs to Step 6.

## Important change from current behavior

Current code posts prize payout immediately when winner is recorded.

After this step:

- Recording/confirming auction must **not** post payout account entry.
- It should only set `payoutStatus = security_pending`.
- Payout should happen only after Step 6 security approval.

Update current code paths:

```txt
app/(dashboard)/[module]/chits/actions.ts -> recordAuctionWinner
app/api/v1/chits/[id]/auctions/route.ts -> POST
```

Either:

- Deprecate direct winner recording, or
- Convert it to create a winning bid + confirm auction without payout.

## API design

### Add bid

```http
POST /api/v1/chits/:id/auctions/:auctionId/bids
```

Payload:

```json
{
  "memberId": "...",
  "prizeAmount": 75000,
  "remarks": "Highest bidder"
}
```

Response:

```json
{
  "id": "bid_id",
  "bidAmount": 75000,
  "bidDiscount": 25000,
  "status": "valid"
}
```

### Mark attendance

```http
POST /api/v1/chits/:id/auctions/:auctionId/attendance
```

Payload:

```json
{
  "memberId": "...",
  "status": "present",
  "proxyName": null
}
```

### Confirm auction

```http
POST /api/v1/chits/:id/auctions/:auctionId/confirm
```

Payload:

```json
{
  "winningBidId": "...",
  "minutesText": "optional override"
}
```

## Mobile changes

Mobile agent/admin should be able to:

- View auction status.
- View winning bid.
- View bid history.
- Mark attendance if role allows.
- Add bid if role allows.
- Confirm auction only for admin/superadmin/developer.

Update Flutter files:

```txt
mobile/lib/data/models/chit.dart
mobile/lib/data/services/chit_service.dart
mobile/lib/features/chits/chit_detail_screen.dart
```

Optional new screen:

```txt
mobile/lib/features/chits/chit_auction_detail_screen.dart
```

## Dividend adjustment

Use the shared calculation result.

Recommended policy:

- Store dividend in auction.
- Store dividend adjustment per subscription in `dividendAmount`.
- Recalculate due amount as:

```txt
payableAmount = baseDueAmount - dividendAmount + penaltyAmount
```

Avoid repeatedly decrementing `dueAmount` without clear audit. If existing code decrements dueAmount, move toward separate `baseDueAmount` and `dividendAmount` for transparency.

## Acceptance criteria

- Admin can open each auction period detail page.
- Admin can mark attendance.
- Admin can record multiple bids.
- System highlights/selects valid winning bid.
- Confirming auction calculates values using shared engine.
- Confirming auction does not release prize payout.
- Auction minutes are stored.
- Winner cannot win again in same group.
- Mobile can view auction details and bid history.
- All auction changes are audit logged.

## Implementation prompt for coding agent

```txt
Implement Step 5 for the LoanTrack chit-fund module.

Replace the direct winner-only auction process with a full auction workflow. Add ChitBid and ChitAuctionAttendance usage, auction detail page, bid entry, attendance marking, bid history, winning bid selection, auction confirmation, and minutes generation.

Do not post prize payout during auction confirmation. Set payoutStatus to security_pending and leave payout to Step 6. Use shared calculation functions from lib/chits/calculations.ts. Update mobile APIs and Flutter models/screens for auction detail, bid history, attendance, and confirmation. Add audit logs and tenant/branch security checks.
```
