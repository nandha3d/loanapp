# Chit Live-Room Experience — Task Split (Overview & Coordination)

This folder breaks the "Zoom-style scheduled chit auction" build into **independently assignable task files**. Each `NN_*.md` is self-contained: an agent with cold context can execute it from the file alone. Read this overview first, then your assigned file.

## What we are building (one paragraph)

Evolve the chit module into a meeting-app experience: auctions scheduled at a clock time with reminder pushes (1 day + 1 hour before), subscriber-facing "my chits" cards that jump straight into a live bidding room, organizer admission control, public/private chat, voice-bid audio proof, one-tap quick-bid chips, a full bid-history panel for late joiners, avatar-tap to see a member's bids, and a **winner-interest** option for non-bidding chits (lottery / fixed rotation) where the winner repays a surcharge on future installments like a loan.

## Ground truth about the codebase (verified — do not re-investigate)

- **Web** = Next.js (App Router) at repo root. **Mobile** = Flutter in `mobile/`.
- **Two live-auction implementations coexist** (tech debt, do not merge them in this build):
  - **System B (canonical, poker-table)**: `lib/chit/liveAuction.ts` (singular `chit`) + routes `app/api/v1/chits/[id]/auctions/[auctionId]/{open,bid,pass,undo,state,close}/route.ts`. Settlement in `lib/chit/settlement.ts` (`settleAuctionWinner`) + `lib/chit/settlementMath.ts`. Mobile screen `mobile/lib/features/chits/live_auction_screen.dart` (router-wired). **This is the live room.**
  - **System A (room-style, config/variant path)**: `lib/chits/liveAuction.ts` (plural `chits`) + `lib/chits/finalize.ts` (`finalizeAuctionInTx`, `applyDividendDistribution`) driving web server actions `confirmAuction` / `drawAuctionWinner` / foreman resolve in `app/(dashboard)/[module]/chits/actions.ts`. Mobile screen `chit_live_auction_screen.dart`. **This is where draw/lottery/fixed-rotation winners are settled** → **winner-interest lives here.**
  - Rule of thumb: **singular `lib/chit/` = live bidding room. Plural `lib/chits/` = variant config + draw settlement.**
- **The `[auctionId]` route segment carries the PERIOD NUMBER**, not a cuid, for the System-B routes (`open/bid/pass/undo/state/close`). Those routes do `const periodNumber = Number(auctionId)`. The `[auctionId]` segment for `bids/confirm/draw/live/room/attendance/security/payout` carries a real auction cuid. Both coexist under one folder because Next.js forbids two slug names at one level. **When you add a route, match the convention of the sibling you copy.**
- **Poll-based, no websockets** anywhere. Live room = client polls the `state` route every 1.5–2.5s; `buildLiveState` returns a full snapshot with `serverNow` for a server-authoritative countdown. Chat and admission ride the same poll (piggyback fields), no new realtime infra.
- **Push** = Firebase FCM via `lib/notify/channels/push.ts`; token table `DeviceToken` (schema line 740) FKs to staff `User` only. **WhatsApp/SMS** = MSG91 via `lib/notify/events.ts#notify()` (template + subscription gated, multi-lang). **Email** = SMTP.
- **Cron routes** exist under `app/api/cron/*` (bearer `CRON_SECRET`) but only Vercel triggers them. The prod VPS runs PM2 — **scheduled jobs need an OS crontab entry curl-ing the route** (documented in task 04).
- **Borrower OTP portal exists** (`lib/api/borrower-mobile.ts`, audience `borrower-mobile`, role `borrower`; mobile `/borrower/*` routes) but is **loan-repayment-only** today, and its token is **rejected** by `requireMobileContext` (different audience). Extending it to chits = Milestone 3 (task 09).
- **Uploads** = local disk, image/PDF allowlist only (`lib/fileUpload.ts`, `app/api/v1/upload/route.ts`). Audio not allowed yet (task 08 adds it).
- **Mobile voice** = `speech_to_text` (STT) + `flutter_tts` (TTS) already; **no audio-capture package** — task 08 adds `record`.
- **Schema model line numbers** (grep to confirm before editing; the file shifts):
  `Customer` 283 · `DeviceToken` 740 · `ChitGroup` 1169 · `ChitMember` 1224 · `ChitAuction` 1257 · `ChitBid` 1304 · `ChitAuctionEvent` 1338 · `ChitSubscription` 1353 · `ChitDocument` 1377 · `ChitAuctionAttendance` 1402 · `ChitSecurity` 1448.

## Shared conventions (every task obeys these)

- **Status/enum casing**: lifecycle/status values are lowercase (`pending`, `active`, `open`, `closed`, `admitted`). Configuration enums are UPPERCASE tokens matching the TypeScript unions in `lib/chits/types.ts` (`NONE`, `FIXED`, `PERCENT`, `ALL_MEMBERS`). Keep DB value == TS union member — no mapping layer.
- **Money**: `Decimal(14,2)` in Prisma; round with `roundMoney` from `lib/chits/calculations.ts` in TS. Never do float math in a route without rounding.
- **Tenant/branch scope**: every query filters `tenantId` + branch via `scopedBranchWhere(ctx)` (mobile) or `scopedChitGroupWhere(scope)` (web actions). Never `findUnique({id})` on a write path without a scope check.
- **Audit**: web actions use `createChitAudit(tx, {...})` (`lib/chits/audit.ts`); System-B uses `prisma.auditLog.create` and `chitAuctionEvent`. Match the file you edit.
- **Migrations**: never hand-write a migration that re-creates an existing table/column. Generate with `npx prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script` when in doubt (a prior migration broke prod by re-adding `started_at`). Details in task 01.
- **Prisma client is locked by the dev server** on Windows — stop `npm run dev` (kill the `next dev` node PIDs) before `prisma generate`, or you get `EPERM rename query_engine`.

## Task files & dependency order

```
00_OVERVIEW_AND_DEPENDENCIES.md      ← you are here
01_SCHEMA_AND_MIGRATIONS.md          ← M1 foundation. BLOCKS 02,03,04,05,06.
02_BACKEND_WINNER_INTEREST.md        ← needs 01. Pure lib + settlement wiring.
03_LIVE_ENGINE_STATE_RETRACT.md      ← needs 01. buildLiveState allBids + retract helper.
04_ACTIONS_ROUTES_SCHEDULE_CRON.md   ← needs 01,02. schedule/reschedule/reminders.
05_WEB_UI.md                         ← needs 01,02,03,04 (calls their actions/state).
06_MOBILE_UI.md                      ← needs 03,04 (state fields + endpoints).
07_TESTS_AND_VERIFICATION.md         ← needs 02,03,04. Can start stubs after 01.
08_M2_CHAT_ADMISSION_AUDIO.md        ← Milestone 2. Needs M1 merged.
09_M3_BORROWER_ACCESS_PUSH.md        ← Milestone 3. Needs M1+M2 merged.
```

### Parallelization

- **Wave 1 (serial gate):** Task **01** (schema + migration). Everyone else waits — it defines the columns they read/write. Small, do it first, merge it.
- **Wave 2 (parallel after 01 merges):** **02**, **03**, **04** can proceed simultaneously — they touch different files (`finalize.ts`/`settlement.ts` vs `lib/chit/liveAuction.ts` vs new routes/cron). Coordinate only on the `interestAmount` column (owned by 02) and the `allBids` state field (owned by 03).
- **Wave 3 (after 02/03/04):** **05** (web) and **06** (mobile) in parallel — different trees. **07** (tests) in parallel, depends on 02/03/04 landing.
- **Milestone 2 (08)** and **Milestone 3 (09)** are separate later waves; each is one cohesive vertical slice for a single agent.

## Definition of done for Milestone 1 (tasks 01–07)

- A **draw-type** chit (lottery/fixed_rotation) can be created with an auction **time** and a **winner-interest** rule; the group card shows the next auction date+time; drawing a winner adds the interest surcharge to the winner's future installments (user's worked example below); auctions can be **rescheduled**; a **cron route** sends 1-day and 1-hour reminders; the **live room** shows quick-bid chips, a full bid-history panel, avatar-tap member bids, and a spectator state for members who already won. Web + mobile both updated. `npm run typecheck`, `dart analyze`, and `npm run test:chits` (plus new `chitWinnerInterest`) all green.

## The canonical worked example (use in every test & preview)

> Chit value ₹1,00,000 · 10 members · installment ₹10,000 · `fixedDiscountPct` 5% → **prize ₹95,000**. Winner-interest: `FIXED`, value **₹1,000/period**, for **6 periods**. Member wins period 1 → their installments for periods **2–7 become ₹11,000** (10,000 base + 1,000 interest); periods 8–10 stay ₹10,000. Non-winners are unaffected. If a second member wins period 2 with the same rule, their periods 3–8 become ₹11,000.

`PERCENT` variant: value = **% of chit value per period** (e.g. 1% of 1,00,000 = ₹1,000/period → same result).
