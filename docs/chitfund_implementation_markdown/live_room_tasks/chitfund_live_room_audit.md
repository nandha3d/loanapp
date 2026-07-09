# Chit Live-Room Experience — QA Audit & Inspection Plan

This document provides a comprehensive audit of the **Chit Live-Room Experience** module. It maps the requirements from the 10 specification files inside [live_room_tasks](file:///V:/pers/Freelance/loanapp/docs/chitfund_implementation_markdown/live_room_tasks) against the current codebase (`V:\pers\Freelance\loanapp`).

---

## 1. Audit Matrix (Implementation Status)

| Milestone & Task | Target Area | Component / Path | Current Status | Findings & Missing Pieces |
| :--- | :--- | :--- | :--- | :--- |
| **M1: Task 01** | Database Schema | `prisma/schema.prisma` | **NOT IMPLEMENTED** | `ChitGroup` default `auctionTime`, `winnerInterest*` configs, `ChitSubscription.interestAmount`, and `ChitAuction` reminder stamps are missing. |
| **M1: Task 02** | Winner Interest (Backend) | `lib/chits/winnerInterest.ts`<br>`lib/chits/finalize.ts`<br>`lib/chit/settlement.ts`<br>`lib/chits/validation.ts` | **NOT IMPLEMENTED** | - Calculation logic file does not exist.<br>- finalize/settlement paths have no interest math wired in.<br>- Config validators do not check new parameters. |
| **M1: Task 03** | Live Engine Bids | `lib/chit/liveAuction.ts`<br>`app/api/v1/chits/.../retract` | **NOT IMPLEMENTED** | - `buildLiveState` only returns `recentBids` (last 20); lacks `allBids` (last 200) and `minNextPrize`. <br>- The per-member `/retract` route does not exist. |
| **M1: Task 04** | Action / Cron APIs | `app/(dashboard)/.../actions.ts`<br>`app/api/.../schedule`<br>`app/api/cron/.../reminders` | **NOT IMPLEMENTED** | - `createChitGroup` doesn't capture `auctionTime` / winner interest fields.<br>- `rescheduleAuction` action & mobile `/schedule` endpoint do not exist.<br>- `chit-auction-reminders` cron script is missing. |
| **M1: Task 05** | Web Front-end | `ChitGroupForm.tsx`<br>`page.tsx` (cards)<br>`ChitGroupDetailClient.tsx`<br>`AuctionDetailClient.tsx` | **PARTIALLY IMPLEMENTED** | - **Implemented**: Basic live room layout and 2.5s state polling is present.<br>- **Missing**: Winner interest inputs/preview, grid of group cards, Enter-room button on list/details, reschedule actions, quick-bid chips, `allBids` panel, avatar sheets, spectator banner, 1.5s poll rate, optimistic append. |
| **M1: Task 06** | Mobile Front-end | `chit_live.dart` (Model)<br>`chit_service.dart` (Service)<br>`live_auction_screen.dart` | **PARTIALLY IMPLEMENTED** | - **Implemented**: Live bidding poker table screen with local countdown and basic timer.<br>- **Missing**: `allBids` & `minNextPrize` model parsing, `reschedule`/`retract` service methods, quick-bid chips, bid history drawer, avatar sheet, spectator banner, fast polling. |
| **M1: Task 07** | Tests & Verification | `tests/chits/...`<br>`Testing/qa_evidence/...` | **NOT IMPLEMENTED** | - `chitWinnerInterest.test.ts` is missing.<br>- `package.json` scripts are not updated.<br>- QA summary markdown lacks the "Live-room M1" checklist section. |
| **M2: Task 08** | Chat & Audio Proof | `ChitRoomMessage` (Model)<br>`.../messages` (Routes & UI)<br>Audio upload & recording | **NOT IMPLEMENTED** | Schema definitions, message endpoints, join/admit waiting room, and audio capture/link are completely missing. |
| **M3: Task 09** | Borrower Mobile | `/api/v1/borrower/chits`<br>Borrower live actions & view | **NOT IMPLEMENTED** | borrower-mobile routes and screens are completely loan-only today; chit access does not exist. |

---

## 2. Detailed Checklist of Missing Components

### Milestone 1 (Tasks 01 to 07)

#### A. Database Schema (`prisma/schema.prisma`)
*   **ChitGroup model**: Needs `auctionTime` (String?), `winnerInterestType` (String @default("NONE")), `winnerInterestValue` (Decimal?), and `winnerInterestPeriods` (Int?).
*   **ChitSubscription model**: Needs `interestAmount` (Decimal @default(0.00)).
*   **ChitAuction model**: Needs `reminder1DayAt` (DateTime?) and `reminder1HourAt` (DateTime?).

#### B. Core Library & Finalization Logic
*   **New File** `lib/chits/winnerInterest.ts`: Needs `winnerInterestPerPeriod()`, `winnerInterestWindow()`, and `applyWinnerInterest()`.
*   [finalize.ts](file:///V:/pers/Freelance/loanapp/lib/chits/finalize.ts): Wire `applyWinnerInterest` right after winner update and dividend distribution.
*   [settlement.ts](file:///V:/pers/Freelance/loanapp/lib/chit/settlement.ts): Wire `applyWinnerInterest` right after the dividend distribution loops.
*   [validation.ts](file:///V:/pers/Freelance/loanapp/lib/chits/validation.ts): Add range validations for `winnerInterestType`, `winnerInterestValue`, `winnerInterestPeriods`, and `auctionTime` regex inside `validateChitConfig()`.

#### C. Live Auction Engine
*   [liveAuction.ts](file:///V:/pers/Freelance/loanapp/lib/chit/liveAuction.ts):
    *   Extend `buildLiveState` to include `allBids` (capped to 200) and `minNextPrize` in the return shape.
*   **New Route** `app/api/v1/chits/[id]/auctions/[auctionId]/retract/route.ts`: Endpoint for staff to pull back a specific member's last bid.

#### D. Front-End Pages & Layouts (Web)
*   [ChitGroupForm.tsx](file:///V:/pers/Freelance/loanapp/app/(dashboard)/[module]/chits/new/ChitGroupForm.tsx): Add input fields for `auctionTime`, `winnerInterestType`, `winnerInterestValue`, and `winnerInterestPeriods` with dynamic preview.
*   [page.tsx](file:///V:/pers/Freelance/loanapp/app/(dashboard)/[module]/chits/page.tsx): Convert standard list view into responsive cards showing next auction date/time and direct "Enter room" link.
*   [ChitGroupDetailClient.tsx](file:///V:/pers/Freelance/loanapp/app/(dashboard)/[module]/chits/[id]/ChitGroupDetailClient.tsx): Add "Enter room" button at the top and a rescheduling modal popup.
*   [AuctionDetailClient.tsx](file:///V:/pers/Freelance/loanapp/app/(dashboard)/[module]/chits/[id]/auctions/[auctionId]/AuctionDetailClient.tsx):
    *   Change poll rate from `2500ms` to `1500ms`.
    *   Add quick-bid chips (`Min`, `+1`, `+2`, `+5` steps).
    *   Render full bid history from the state `allBids` array with source indicators (voice/tap/remote).
    *   Avatar-tap sheet/modal with a staff-only "Retract last" button.
    *   Spectator banner blocking input elements if current member `hasWon`.

#### E. Mobile App (Flutter)
*   [chit_live.dart](file:///V:/pers/Freelance/loanapp/mobile/lib/data/models/chit_live.dart): Update `LiveAuctionState` parser to parse `allBids` and `minNextPrize`.
*   [chit_service.dart](file:///V:/pers/Freelance/loanapp/mobile/lib/data/services/chit_service.dart): Add `reschedule()` and `retractMemberBid()` HTTP actions.
*   [endpoints.dart](file:///V:/pers/Freelance/loanapp/mobile/lib/shared/constants/endpoints.dart): Add route template strings for `/schedule` and `/retract`.
*   [live_auction_screen.dart](file:///V:/pers/Freelance/loanapp/mobile/lib/features/chits/live_auction_screen.dart):
    *   Implement Quick-bid chip row above table.
    *   Implement bid history bottom sheet.
    *   Implement avatar tap overlay with retract action.
    *   Enforce spectator layout when current subscriber won.

---

## 3. Structured QA & Inspection Plan

Below is a step-by-step verification plan that should be run once the implementation starts.

### Phase 1: Database and Setup Verification
1.  **Check Schema Sync**:
    *   Run `npx prisma validate` and verify it reports "schema is valid".
    *   Deploy the migration: `npx prisma migrate status`. Verify that there is exactly one new folder matching `chit_room_experience_m1`.
    *   View the SQL file: Verify it performs only `ALTER TABLE` actions and has NO `CREATE TABLE` actions for existing tables.
2.  **Verify Code Compilation**:
    *   Run `npm run typecheck` to confirm the Next.js frontend has zero typescript compilation issues.
    *   In the mobile folder, run `dart analyze` to ensure Dart/Flutter files are free of errors.

### Phase 2: Unit Testing
1.  **Run Winner Interest Test**:
    *   Execute `npm run test:chits:winner-interest` (once added).
    *   Ensure the console outputs: `chitWinnerInterest tests passed`.
2.  **Verify Math Calculations**:
    *   Run `npm run test:chits:calculation` to verify that penalty and dividend calculations do not conflict with the new winner interest.

### Phase 3: E2E Web Verification
1.  **Group Creation & Configuration**:
    *   Go to `/chits/new` and verify the new fields for default start time and winner interest exist.
    *   Toggle between "None", "Fixed", and "Percent" and check that the live preview changes correctly (e.g. previewing "₹11,000" for a 10k installment + 1k fixed surcharge).
    *   Submit the form. Go to the DB and execute:
        ```sql
        SELECT name, auction_time, winner_interest_type, winner_interest_value, winner_interest_periods
        FROM chit_groups ORDER BY created_at DESC LIMIT 1;
        ```
        Verify values match exactly.
2.  **Activation Check**:
    *   Activate the group. Verify that the generated auctions have their `scheduled_at` set to the group's default time.
3.  **Live Auction Room (System B)**:
    *   Open a live auction room. Verify the polling rate in the browser inspector is `1.5s` (`Network` tab).
    *   Verify the quick-bid chips are computed accurately using `minNextPrize`.
    *   Place a bid. Verify that it appears in the live bid list with the `👆 tap` icon.
    *   Place a bid on behalf of another user, then click their seat/avatar. Verify the "Retract last" button removes only their last bid and recalculates the POT leader.
4.  **Lottery Draw Interest Calculation**:
    *   Create a lottery group. Draw a winner for Period 1.
    *   Run the verification query on the winner's subscriptions:
        ```sql
        SELECT period_number, due_amount, interest_amount, base_due_amount, dividend_amount
        FROM chit_subscriptions WHERE member_id = '<winner_member_id>' ORDER BY period_number;
        ```
        Verify that:
        *   Periods `2` to `2 + (periods - 1)` have the interest surcharge added to `due_amount` and mapped to `interest_amount`.
        *   Subsequent periods remain unchanged.
        *   Non-winner subscriber records are completely untouched.

### Phase 4: Cron & Rescheduling
1.  **Rescheduling Flow**:
    *   On the group detail view, click the clock/reschedule icon next to a pending auction.
    *   Pick a new date and time. Save.
    *   Verify the auction row updates and database columns `reminder_1day_at` and `reminder_1hour_at` reset to `NULL`.
2.  **Cron Trigger Test**:
    *   Update a test auction `scheduled_at` to exactly 1 hour from now.
    *   Trigger the cron route:
        ```bash
        curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/chit-auction-reminders
        ```
        Verify that:
        *   The HTTP response returns `{ sent: 1 }` (or greater).
        *   Subsequent requests return `{ sent: 0 }` (idempotency check).
        *   Omitting the `Authorization` header returns a `401 Unauthorized` error.

---
*Audit compiled on July 9, 2026.*
