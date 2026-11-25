# Task 09 — Milestone 3: Subscriber (Borrower) Chit Access & Customer Push

**Owner:** 1 agent. **Depends on:** M1 + M2 merged.
**Read** `00_OVERVIEW_AND_DEPENDENCIES.md` first.

Covers user points **7** (subscriber cards → direct room entry, only their chits) and the customer half of **9** (push to subscribers).

## Constraint that shapes everything

The borrower token (audience `borrower-mobile`, role `borrower`, issued by `lib/api/borrower-mobile.ts`) is **rejected** by `requireMobileContext` (wrong audience). So subscribers **cannot** call the staff `/api/v1/chits/**` routes. Build a **parallel borrower surface** guarded by `requireBorrowerMobileContext`, reusing the shared engine functions (`buildLiveState`, bid/retract/settlement helpers) but with member-scoped authorization.

## Backend — new borrower chit routes

Under `app/api/v1/borrower/chits/` (all guarded by `requireBorrowerMobileContext` from `lib/api/borrower-mobile.ts`; the context yields the authenticated `Customer`):

- `GET /api/v1/borrower/chits` → the caller's `ChitMember` rows (join `chitGroup`), each with the next pending auction `{id, periodNumber, scheduledAt, roomStatus, auctionType}`. **Only groups the customer is a member of** (point 7). Shape for cards: groupName, chitValue, installment, next-auction date/time, ticketNo, hasWon.
- `GET /api/v1/borrower/chits/[id]/auctions/[period]/state` → reuse `buildLiveState(group, period)` but load the group via a **member-scoped** loader (the customer must be a member of `id`; reject otherwise). Do NOT reuse `loadScopedGroup` (that's tenant/branch staff scope) — write `loadMemberGroup(chitGroupId, customerId)` that checks a `ChitMember` exists for this customer.
- `POST /api/v1/borrower/chits/[id]/auctions/[period]/join` → self-join (upsert attendance; admitted or waiting per `roomAdmission`).
- `POST /api/v1/borrower/chits/[id]/auctions/[period]/bid` → **memberId forced to the caller's own membership** in this group (never trust a body memberId). Then run the exact same validations + insert as the staff bid route (extract the staff bid route's core into a shared `placeBid({...})` helper in `lib/chit/liveAuction.ts` and call it from both, so rules can't diverge). Reject if the member `hasWon` (spectator) or admission != admitted. This is the relaxation the staff route flagged as "Phase 4 will let members POST their own bids".
- `POST /api/v1/borrower/chits/[id]/auctions/[period]/retract` → retract **own** last bid (call task 03's retract logic with `memberId = own`).
- `POST /api/v1/borrower/chits/[id]/auctions/[period]/messages` → post chat as `senderMemberId = own` (public or organizer visibility).

Share logic, don't fork: refactor the staff bid/retract cores into helpers so borrower routes are thin authorization wrappers.

## Customer push

- Migration `chit_room_experience_m3`: add `DeviceToken.customerId String?` (nullable FK to `Customer`) alongside the existing `userId`. A token belongs to either a staff user or a customer.
- Borrower FCM registration: `POST /api/v1/borrower/fcm-token` (borrower-guarded) upserts a `DeviceToken` with `customerId`.
- `lib/notify/channels/push.ts`: teach the sender to resolve customer tokens (by `customerId`) in addition to user tokens.
- Reminder cron (task 04 `sendAuctionReminder`): also push FCM to each member's customer devices, not just WhatsApp/SMS. 1-day + 1-hour, same idempotent stamps.

## Mobile — borrower flow

- `mobile/lib/data/services/` — a `BorrowerChitService` (or extend the borrower service) hitting the `/borrower/chits/**` endpoints; add the endpoint constants.
- After borrower OTP login (`/borrower/dashboard`), add a **"My Chits"** section: cards (only subscribed groups) showing name, next auction date/time, and an **Enter room** button active when the next auction `roomStatus` ∈ `open|extended` (or `scheduled` near the time).
- Tapping Enter room → open the poker live screen in **member mode**: reuse `live_auction_screen.dart` with `isAdmin:false` and a fixed `myMemberId` = the customer's membership; only own-ticket bidding, spectator if `hasWon`. The screen's bid calls route to the **borrower** endpoints, not the staff ones (inject the service or a mode flag).
- Register the borrower FCM token on login; handle a "chit auction starting" push tapping through to the room.

## Web (optional, lighter)

Subscribers are primarily mobile. A minimal web subscriber view can wait; if built, gate behind a customer session (out of scope of the staff NextAuth). Note the decision; don't block M3 on it.

## Organizer settings surface

On the group **edit** form (web + mobile), expose `roomAdmission` (from M2) and any reminder toggles so the organizer controls auto-admit vs approval and whether reminders fire.

## Acceptance criteria

- A customer logs in via OTP → sees **only their** chit groups as cards with the next auction time.
- Tapping into an open room lets them place their **own** bid (other-member bid attempts server-rejected); they can retract their own last bid and chat.
- A member who already won can enter the room but only spectate.
- Subscribers receive FCM push 1 day and 1 hour before an auction.
- Borrower routes never accept a spoofed memberId; all bid rules match the staff path (shared helper).
- `npm run typecheck`, `dart analyze` clean; migration additive.

## Commit(s)

```
feat(chit): borrower (subscriber) chit access — my chits, room, own-bid
feat(chit): customer device tokens + auction push reminders
```
