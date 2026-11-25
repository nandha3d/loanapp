# Task 07 — Tests & Milestone-1 Verification

**Owner:** 1 agent (can pair with 02/03/04 authors). **Depends on:** 02, 03, 04 landing.
**Read** `00_OVERVIEW_AND_DEPENDENCIES.md` first.

## Test runner conventions

Existing chit tests are plain `tsx` scripts with hand-rolled `assertEqual`/`assertThrows`, listed under `tests/chits/` and run via `package.json` scripts (`test:chits:calculation`, `test:chits:security`, aggregate `test:chits`). Follow that exact style — no Jest.

## 1. `tests/chits/chitWinnerInterest.test.ts` (new)

Test the **pure** functions from task 02 (`lib/chits/winnerInterest.ts`) — no DB.

```ts
import { winnerInterestPerPeriod, winnerInterestWindow } from '../../lib/chits/winnerInterest';

function assertEqual(a: unknown, e: unknown, m: string) {
  if (a !== e) throw new Error(`${m}. Expected ${e}, got ${a}`);
}

// FIXED
assertEqual(winnerInterestPerPeriod({ type: 'FIXED', value: 1000, chitValue: 100000 }), 1000, 'FIXED per period');
// PERCENT: 1% of 1,00,000 = 1000
assertEqual(winnerInterestPerPeriod({ type: 'PERCENT', value: 1, chitValue: 100000 }), 1000, 'PERCENT per period');
// NONE / zero / missing
assertEqual(winnerInterestPerPeriod({ type: 'NONE', value: 1000, chitValue: 100000 }), 0, 'NONE no-op');
assertEqual(winnerInterestPerPeriod({ type: 'FIXED', value: 0, chitValue: 100000 }), 0, 'zero value no-op');
assertEqual(winnerInterestPerPeriod({ type: undefined, value: undefined, chitValue: 100000 }), 0, 'undefined no-op');

// Window: win period 1, 6 periods, 10 total → [2..7]
let w = winnerInterestWindow({ wonPeriod: 1, periods: 6, totalPeriods: 10 });
assertEqual(w.firstPeriod, 2, 'window first');
assertEqual(w.lastPeriod, 7, 'window last');
// null periods → until group end: win period 4, 10 total → [5..10]
w = winnerInterestWindow({ wonPeriod: 4, periods: null, totalPeriods: 10 });
assertEqual(w.firstPeriod, 5, 'open-ended first');
assertEqual(w.lastPeriod, 10, 'open-ended last');
// periods overshoot clamps to totalPeriods: win period 8, 6 periods, 10 total → [9..10]
w = winnerInterestWindow({ wonPeriod: 8, periods: 6, totalPeriods: 10 });
assertEqual(w.lastPeriod, 10, 'clamp to total');

console.log('chitWinnerInterest tests passed');
```

Add to `package.json`:
```json
"test:chits:winner-interest": "tsx tests/chits/chitWinnerInterest.test.ts",
```
and append `&& npm run test:chits:winner-interest` to the aggregate `test:chits`.

## 2. Extend `tests/chits/chitAuctionWorkflow.test.ts`

Add assertions for the retract recompute (task 03) if the winning-bid selection helpers are pure/importable. If retract logic is only in the route (DB-bound), skip DB here and cover it in the manual E2E below — do **not** stand up a DB harness just for this.

## 3. Regression

`npm run test:chits` (calculation, security, winner-interest, workflow) and `npx tsx tests/chitSettlement.test.ts` must stay green.

## 4. Static gates

```bash
npm run typecheck            # web: tsc --noEmit, must be clean
cd mobile && dart analyze lib/features/chits lib/data/services lib/data/models   # 0 errors
```

## 5. End-to-end manual script (the acceptance test for M1)

Run against a local dev server + the dev MySQL. Use the **canonical worked example**.

1. **Create** a chit group: value 1,00,000 · 10 members · installment 10,000 · type `lottery` · fixedDiscountPct 5 · **auction time 17:00** · winner interest **FIXED 1000 for 6 periods**. Form preview must read "Winner pays ₹11,000 … for 6 periods".
2. **Activate** it (add 10 members, tickets, agreements as the activation validator requires). Verify each generated auction's `scheduledAt` is that date at **17:00**.
3. **Chits page**: group appears as a **card** showing "🗓 … 5:00 PM" and an Enter-room/View action.
4. **Draw period 1** (lottery draw button). Winner recorded, prize 95,000.
5. **Verify winner interest**: query the winner's subscriptions — periods **2–7** `dueAmount = 11000`, `interestAmount = 1000`; periods 8–10 `dueAmount = 10000`, `interestAmount = 0`; **non-winners unchanged**.
   ```sql
   SELECT period_number, due_amount, interest_amount FROM chit_subscriptions
   WHERE member_id = '<winnerMemberId>' ORDER BY period_number;
   ```
6. **Reschedule** period 2 to a new date/time (web modal or mobile) → row updates; `reminder_1day_at`/`reminder_1hour_at` reset to NULL.
7. **Reminder cron**: set `scheduledAt` of a test auction to ~1h ahead, then
   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/chit-auction-reminders
   ```
   → JSON `{sent: >=1}`; second call same minute → `sent: 0` (stamp idempotency); wrong bearer → 401.
8. **Live room** (make an `open_live` group, open the room): quick-bid chips place bids one-tap; bid-history panel lists all bids; avatar-tap shows a member's bids; a won member sees the spectator banner; countdown ticks from `serverNow`.
9. **Mobile** parity for chips/history/avatar/spectator + reschedule.

## 6. QA evidence

Append results to `Testing/qa_evidence/chitfunds/chitfunds-qa-summary.md` (create if missing) with a "Live-room M1" section: date, commit, each step Pass/Fail, and the SQL output from step 5.

## Acceptance criteria

- New winner-interest unit test + existing suites green via `npm run test:chits`.
- `typecheck` + `dart analyze` clean.
- E2E script steps 1–9 all pass; step 5 SQL matches the worked example exactly.
- QA evidence file updated.

## Commit

```
test(chit): winner-interest unit tests + M1 verification evidence
```
