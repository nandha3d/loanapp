# Task 01 — Schema & Migrations (Milestone 1 foundation)

**Owner:** 1 agent. **Blocks:** 02, 03, 04, 05, 06, 07. Do this first, merge, then unblock the rest.
**Read** `00_OVERVIEW_AND_DEPENDENCIES.md` first.

## Goal

Add the columns Milestone 1 needs to `prisma/schema.prisma`, generate **one** safe migration, regenerate the client. No behavior change yet — later tasks fill in logic.

## Exact schema edits

Grep the model first (line numbers drift). Add these fields inside the existing model blocks; keep the existing fields.

### 1. `ChitGroup` (model at ~line 1169)

```prisma
  // Live-room scheduling & winner-interest (Task 01)
  auctionTime           String?   @map("auction_time")            // "HH:mm" 24h; group default start time for auctions
  winnerInterestType    String    @default("NONE") @map("winner_interest_type") // NONE | FIXED | PERCENT
  winnerInterestValue   Decimal?  @map("winner_interest_value") @db.Decimal(14, 2) // FIXED: ₹ per period. PERCENT: % of chitValue per period.
  winnerInterestPeriods Int?      @map("winner_interest_periods") // number of periods the surcharge applies; null = until group end
```

### 2. `ChitSubscription` (model at ~line 1353)

```prisma
  // Winner-interest surcharge for this period (Task 02 fills it). Rolled into
  // dueAmount like dividendAmount is, so collection flow is unchanged.
  interestAmount Decimal @default(0.00) @map("interest_amount") @db.Decimal(14, 2)
```

### 3. `ChitAuction` (model at ~line 1257)

```prisma
  // Reminder dispatch stamps so the cron never double-sends (Task 04).
  reminder1DayAt  DateTime? @map("reminder_1day_at")
  reminder1HourAt DateTime? @map("reminder_1hour_at")
```

`scheduledAt`, `biddingOpensAt`, `biddingClosesAt`, `roomStatus`, `startedAt`, `endsAt`, `countdownSeconds`, `autoExtendSeconds`, `currentBestBidId`, `operatorId`, `winnerMemberId` **already exist** — do NOT re-add them.

## Validation before migrating

```bash
npx prisma validate     # must print "schema is valid"
```

## Generate the migration (safe path)

The dev DB already has the full chit schema. Generate the migration from a **diff of the live DB against the new schema** so it only emits the four ALTERs above — never a table re-create (a past migration broke prod by re-adding `started_at`).

1. Stop the dev server (frees the Prisma engine DLL on Windows):
   ```bash
   # find the "next dev" node PIDs and stop them, e.g. via PowerShell Stop-Process
   ```
2. Create the migration folder + SQL by diffing:
   ```bash
   mkdir -p prisma/migrations/20260710000000_chit_room_experience_m1
   npx prisma migrate diff \
     --from-url "$DATABASE_URL" \
     --to-schema-datamodel prisma/schema.prisma \
     --script > prisma/migrations/20260710000000_chit_room_experience_m1/migration.sql
   ```
   (On Windows Git Bash, `$DATABASE_URL` comes from `.env` — export it or inline the mysql URL.)
3. Inspect the SQL. It must be **only** `ALTER TABLE chit_groups ADD COLUMN ...`, `ALTER TABLE chit_subscriptions ADD COLUMN interest_amount ...`, `ALTER TABLE chit_auctions ADD COLUMN reminder_1day_at ..., ADD COLUMN reminder_1hour_at ...`. If it contains any `CREATE TABLE` or re-adds an existing column, **stop** — your schema has an unintended change; fix and re-diff.
4. Add a header comment to the SQL:
   ```sql
   -- Chit room experience M1: auction time, winner-interest config, per-period
   -- interest surcharge, reminder dispatch stamps. Additive & backward-compatible.
   ```
5. Apply + mark applied:
   ```bash
   npx prisma migrate deploy      # applies the pending migration
   npx prisma migrate status      # must say "Database schema is up to date!"
   ```
6. Regenerate the client (dev server still stopped):
   ```bash
   npx prisma generate
   ```

## Acceptance criteria

- `npx prisma validate` passes.
- `npx prisma migrate status` = up to date; exactly one new migration folder.
- Migration SQL is four ALTERs, zero CREATE TABLE.
- `npx prisma generate` succeeds; `grep -n "winnerInterestType\|interestAmount\|reminder1DayAt" node_modules/.prisma/client/index.d.ts` finds the new fields.
- `npm run typecheck` still passes (no code references them yet, so nothing breaks).

## Handoff notes for downstream tasks

- Task 02 owns writes to `ChitSubscription.interestAmount` and reads `ChitGroup.winnerInterest*`.
- Task 04 owns writes to `ChitAuction.reminder1DayAt/reminder1HourAt` and reads `ChitGroup.auctionTime`.
- Do **not** add `ChitRoomMessage`, `roomAdmission`, `admissionStatus`, `audioDocumentId`, or `DeviceToken.customerId` here — those belong to M2 (task 08) and M3 (task 09) migrations, kept separate so M1 can ship alone.

## Commit

```
feat(db): chit room experience M1 schema — auction time, winner interest, reminders

Adds ChitGroup.auctionTime + winnerInterestType/Value/Periods, ChitSubscription
.interestAmount, ChitAuction.reminder1DayAt/1HourAt. Single additive migration
generated via migrate diff (ALTERs only, no table re-creation).
```
