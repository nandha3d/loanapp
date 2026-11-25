# PARITY-ML — owner decisions, round 2 (fix tasks)

Companion to `docs/fixes/PARITY-ML-web-mobile-fix-plan.md`. That file's §0 rules apply to every task here: read `ENGINEERING_REFERENCE.md` §0–§5, §16.0 (and §10 for anything tagged MONEY), run `npm run test:calc` before and after, one task per commit, all six locales for new strings, re-locate code by grep (line numbers are from 2026-10-01 and drift), stop and report if the code doesn't match the card.

Audience: an implementing agent taking one task at a time.

## Standing principle (applies to every task below)

**All business logic and money maths live on the server (the Next.js app).** Web pages and the Flutter app only call the API and render the numbers it returns. Neither client computes a money figure, a count used for decisions, or a status. Where a client does this today, the fix is: add the figure to the API response (one shared `lib/` function), then delete the client maths. This is the existing rule MONEY-1 / X-7 / API-8 — cite it.

## Decisions recorded (2026-10-01)

| # | Question (from fix plan §1) | Decision | Task |
|---|---|---|---|
| Q1 | Preclose payoff formula | **Mobile's formula is correct**: payoff = `totalPayable − totalCollected` (interest was deducted upfront from the principal). Compute it **only on the server**; mobile must call the API, not compute locally. Pending penalty is resolved in a **mandatory popup** at preclose: paid completely / discount / waived, and the outcome is shown after. | DEC-01 |
| Q2 | Is a part-paid past instalment a "missed day"? | **No.** Only rows with status `missed` count. | DEC-02 |
| Q3 | Money display precision | **Round to whole rupees** (mobile's behaviour) — change web. Mobile must stop computing figures locally. | DEC-03 |
| Q4 | Can agents create loans? | Agents create a loan **directly only if** admin/superadmin enabled their **Bypass loan approval** flag. Otherwise the loan is a **request** (`pending_review`) that an admin approves. | DEC-04 |
| Q5 | Agent dashboard month-to-date figures | **Add them to mobile.** | DEC-05 |
| Q6 | Penalty collections and accounting | Penalty collections **must post to the wallet, the cash book and the ledger**, and count as **revenue**. A penalty collection works **exactly like a loan collection**: the collecting agent's wallet is credited, then normal handover. Agents may collect penalties; only admin/superadmin waive. No backfill — past data was deleted. | DEC-06 |
| Q7 | Mask PAN | **Yes.** | DEC-07 |

These replace, in the main plan: LD-05 → DEC-01; LD-01 step 2 → DEC-02; FMT-01 → DEC-03; CUST-07 step 4 → DEC-04; DASH-11 "MTD" note → DEC-05.

## Order

| ID | Title | Sev | Size | Depends on (main plan / this file) |
|---|---|---|---|---|
| DEC-07 | Mask PAN in API responses | H | S | SEC-01 |
| DEC-02 | One "missed" definition | H | S | — |
| DEC-04 | Agent loan creation = direct or request | M | S | — |
| DEC-06 | Penalty collections → wallet, cash book, ledger, revenue (same as loan collection) | H | L | PEN-01, ACC-01, MON-01 |
| DEC-01 | Preclose quote: one server calculation + penalty popup | H | L | MON-24, PEN-01, DEC-06 |
| DEC-05 | Month-to-date figures on mobile agent dashboard | M | M | DASH-11 |
| DEC-03 | Whole-rupee display on web + remove client maths | M | L | LD-02, LD-03, COL-01, CUST-01, CUST-04, DEC-01 |

---

## DEC-01 — Preclose quote: one server calculation (MONEY)

**Problem.**
- Web asks the server: `LoanDetailClient.tsx` ~L763 and ~L784 `fetch('/api/loans/${loan.id}/foreclosure-calc?discount=…')` → `lib/foreclosure.ts` `buildForeclosureCalculation`. That function uses `principal − totalCollected + netPenalty − discount` (~L127-142) — the **wrong** formula per the owner.
- Mobile computes the payoff itself: `loan_detail_screen.dart` ~L2645-2647 (`totalRepayable - totalCollected`), also used as the minimum at ~L2733 and ~L2767. Right formula, wrong place.
- There is no v1 foreclosure endpoint (only the frozen `/api/loans/[id]/foreclosure-calc`).
- `POST /api/v1/loans/[id]/preclose` (~L37-44) accepts **any** positive amount; the minimum is enforced only in the clients.
- Web's agent preclose request shows `precloseOutstanding` (~L1623) computed separately.

**Target rule.** Payoff = `max(0, totalPayable − totalCollected) − discount` (discount ≥ 0, ≤ payoff). Pending penalty is **not** part of the payoff; it is returned as a separate `penaltyDue` figure and **must be resolved in a penalty popup during the preclose** (see "Penalty popup" below). Interest-only loans keep their existing branch (outstanding principal) — do not change that branch.

**Penalty popup (owner decision, 2026-10-01).** When `penaltyDue > 0`, preclose cannot be submitted until the user resolves the penalty in a popup, on web and mobile alike. The popup shows the penalty due (₹, missed-day count) and three choices:
- **Paid completely** — penalty amount collected in full (amount = `penaltyDue`, payment mode picker).
- **Discount** — part collected, remainder written off (collected amount input, 0 < amount < `penaltyDue`; the remainder is the discount).
- **Waived** — nothing collected, whole penalty written off.

The choice travels with the preclose request as `penaltyResolution: { action: 'paid' | 'discount' | 'waived', amount, paymentMode }`. After a successful preclose both clients show a confirmation popup stating the outcome, e.g. "Penalty ₹500: paid ₹300, discount ₹200" / "Penalty ₹500 waived" / "Penalty ₹500 paid in full". The settlement letter and loan timeline show the same line.

**Steps.**
1. `lib/foreclosure.ts` `buildForeclosureCalculation`: for non-interest-only loans set the outstanding to `Math.max(0, toNumber(loan.totalPayable) − totalCollected)`. Add `totalPayable` to `ForeclosureLoanSnapshot` if it is missing. `maxDiscount` = that outstanding (no penalty). `totalSettlementAmount = max(0, outstanding − safeDiscount)`. Line items: "Total payable", "Collected so far", "Payoff", then a separate informational "Penalty due (settled separately)" with `sign: 'info'` (add that sign value if the type needs it), then the discount line.
2. Add `app/api/v1/loans/[id]/foreclosure-calc/route.ts` (GET, `?discount=`): same scoping as `app/api/v1/loans/[id]/preclose/route.ts` (tenant, appType, `scopedBranchWhere`, add-on check), loads the snapshot, returns `buildForeclosureCalculation(...)`. Make the frozen `/api/loans/[id]/foreclosure-calc` call the same snapshot loader so both return identical JSON (it already calls the same lib fn — keep it).
3. `POST /api/v1/loans/[id]/preclose`: inside the transaction, compute the quote with the same function (passing the request's `discount`) and reject `amount < totalSettlementAmount` with 409 `{ required }`. Same check in the approval path that executes an agent preclose request (`lib/loanPrecloseRequests.ts` → `precloseLoanInTx`).
4. **Penalty resolution on the server** (needs PEN-01 and DEC-06 done first):
   - a. Quote response adds `penaltyDue` (net of settled + waived, from the loan's open penalties after `ensurePendingPenaltiesForMissedLoans` for that loan) and `penaltyMissedDays`.
   - b. Preclose body requires `penaltyResolution` when `penaltyDue > 0` (400 `penalty_resolution_required` otherwise). Validate: `paid` → amount = `penaltyDue`; `discount` → 0 < amount < `penaltyDue`; `waived` → amount = 0; `paymentMode` required when amount > 0.
   - c. In the **same transaction** as the preclose: when amount > 0 call `settlePenalty` across the loan's open penalties oldest-first for that amount (this posts wallet + cash book per DEC-06); then call `waivePenalty` for the remainder (`discount`/`waived`), with waive reason `preclose_discount` or `preclose_waived`. GL posting for the collected part runs after commit (DEC-06 step 3). Store the resolution on the preclose `Payment`/audit row so the settlement letter and timeline can show it.
   - d. Agent preclose request (`lib/loanPrecloseRequests.ts`): the agent's proposed `penaltyResolution` is stored in the request; nothing is waived or settled until an admin/superadmin approves the request (D6). The approver sees the proposed resolution and approves or rejects the whole request.
   - e. Return `penaltyOutcome: { due, paid, discount, waived }` in the preclose response.
5. Web `LoanDetailClient.tsx`: switch the two fetches to `/api/v1/loans/${loan.id}/foreclosure-calc` (through the existing api client); delete the local `precloseOutstanding` maths (~L1623) and show the quote's `totalSettlementAmount` for the agent request too. Add the penalty popup (shown on submit when `penaltyDue > 0`) and the outcome popup from `penaltyOutcome`.
6. Mobile: add `LoanService.foreclosureQuote(loanId, {discount})`; in the preclose sheet (~L2581-2790) load the quote, render its line items, prefill the amount and enforce the minimum from `totalSettlementAmount`. Delete the local `totalRepayable - totalCollected` maths at ~L2645-2647, ~L2733, ~L2767. Add a discount field (admin roles only; same as web). Add the same penalty popup (bottom sheet) and outcome dialog.
7. Settlement letter (`app/api/loans/[id]/settlement-letter`) and loan timeline: add the penalty outcome line.
8. Update `lib/foreclosure.test.ts` expectations to the new formula; add a case: ₹10,000 at 20% emi_flat (totalPayable ₹12,000), ₹3,000 collected → payoff ₹9,000. Add preclose tests: penalty ₹500 + `discount` ₹300 → penalty rows settled 300 / waived 200, one AccountEntry ₹300; missing resolution with penalty due → 400.
9. Strings (popup titles, three options, outcome sentences) in six locales.
10. **DOC-1:** update the PRECLOSE rules in `ENGINEERING_REFERENCE.md` §10.3 (payoff formula, server-enforced minimum, penalty resolved via mandatory popup: paid / discount / waived) and §10.4.

**Verify.** `npm run test:calc`, `npx tsx lib/foreclosure.test.ts` (or the script that runs it — check `package.json`), `npm run test:mobile-parity-api`. Manual: same loan on web and mobile shows the same payoff; posting less than it returns 409.

---

## DEC-02 — One "missed" definition (MONEY)

**Rule.** An instalment is "missed" only when its status is `missed`. A `partial` row is **not** missed. A closed loan has 0 missed days.

**Problem.** `GET /api/v1/loans/[id]` builds `metrics.missedCount` from rows with `missed || partial` (`app/api/v1/loans/[id]/route.ts` ~L186-190; extended rows the same). Mobile shows that (LDS ~L904-915). Web counts `missed` only (LDC ~L396-402). Example: yesterday part-paid ₹50 of ₹100 → web 0, mobile 1.

**Steps.**
1. In the route, count only `status === 'missed'` for both normal and extended rows; return 0 when the loan is closed or outstanding ≤ 0 (web's rule).
2. Web: after LD-02 the page reads `loan.metrics.missedCount`; until then make sure the web formula already matches (it does).
3. Grep the rest of the server for other "missed" counters (`'missed' ||`, `=== 'partial'` next to `missed`) — e.g. `lib/foreclosure.ts` (uses `missed` only — fine), dashboard/report builders. Any that count `partial` as missed: change to `missed` only **if it is a display count**.
4. **Stop and report** if `ensurePendingPenaltiesForMissedLoans` (`lib/penalties.ts`) or the penalty accrual counts partial rows as missed days — that changes money and needs the owner.
5. **DOC-2:** write the definition in §10 (loan metrics).

**Verify.** `npm run test:calc`; add a unit case for a part-paid row → missedCount 0.

---

## DEC-03 — Whole-rupee display on web + remove client maths

### Part A — web shows whole rupees

**Problem.** Web `formatCurrency` (`lib/utils.ts` ~L4-9) prints `num.toLocaleString('en-IN')` (keeps paise: ₹1,250.5). Mobile `currency_controller.dart` ~L40-44 uses `decimalDigits: 0` (₹1,251).

**Steps.**
1. `formatCurrency`: `safeSymbol + num.toLocaleString('en-IN', { maximumFractionDigits: 0 })`. Check one rounding edge with a test: 0.5 → 1, 2.5 → 3 on both sides (JS `toLocaleString` rounds half away from zero; confirm Dart `NumberFormat` gives the same for the test values — if not, round on the server-side value before formatting is NOT allowed; instead make Dart use `(v).round()` before format).
2. Grep the web for money printed without `formatCurrency` and route them through it: `toLocaleString('en-IN')` near `₹`, local `fc(` helpers (e.g. `AnalyticsClient.tsx`), `'₹' + `, `` `₹${ `` in `app/` and `components/`. Use the tenant currency symbol where the component has it.
3. **Do not round:** stored values, API values, amounts sent in requests, input fields and their prefills (a ₹150.50 penalty must still be payable as 150.50), receipts/statements/exports/PDFs (accounting documents keep paise unless the owner says otherwise). Mobile prefills that round today (penalty settle ~L674, run sheet "Fill due" ~L189-193) switch to `toStringAsFixed(2)` — they are inputs.

### Part B — clients stop computing figures

Each row: move the figure to the API (shared `lib/` fn), render it, delete the client maths. Many are already tasks in the main plan — do them there; the rest are new here.

| Client maths today | Where | Server field to use / add | Task |
|---|---|---|---|
| Loan outstanding, repayable, paid period, remaining, progress % | LDS ~L1169-1171, ~L1312-1326, ~L194-197; LDC ~L190-402 | `metrics.totalOutstanding`, `metrics.paidPeriod`, `metrics.remaining*` | LD-01/02/03 |
| Loan "due now", overdue fallback | LDS ~L43-61, ~L904-963 | `metrics.dueNow` (add), `metrics.overdueAmount` | LD-01/03 + add `dueNow` |
| Preclose payoff | LDS ~L2645-2647 | foreclosure-calc | DEC-01 |
| Restructured rate per row | LDC ~L366-394 | `inst.restructuredAmount`, `restructure.*` | LD-02 |
| Collection screen totals, "today due" fallback | `collection_screen.dart` ~L495-512, ~L1793-1802 | `collectionSummary`, `collectionSummaryByRoute` | COL-01/02 |
| Quick-collect preset totals and cap | `quick_collect_sheet.dart` ~L66-80, ~L234-247 | per-loan `dueToday`, `overdueOutstanding`, `remainingPayable` (add to the collection payload) | MON-06 + add fields |
| Customer tile "outstanding" / loans count | `customer_tile.dart` ~L29-31, ~L50 | `activeLoanPrincipal`, `activeLoanCount` | CUST-01 |
| Customer detail outstanding / counts | `customer_detail_screen.dart` ~L1148-1177 | `creditScore.stats.outstanding/activeLoans/closedLoans` | CUST-04 |
| Loans list "N active" count, progress % | `loans_screen.dart` ~L82-95, ~L235-237 | `counts.active` (add to `GET /loans` response), `progressPct` per row (add) | LOAN-01 + add |
| Penalty group sums / status per loan | `penalties_screen.dart` ~L355-374, ~L97 | add `GET /penalties?groupBy=loan` returning per-loan gross/settled/waived/net/status, and `kpis.net` | PEN-02 + add |
| Web penalty net | `PenaltiesClient.tsx` ~L32 | `kpis.net` | add |
| Wallet "exceeds pool" sum | `wallet_screen.dart` ~L555-556; `WalletClient.tsx` | per-agent `branchPoolBalance` in agents list | WAL-02 |
| Run sheet per-loan sums and auto-split | `run_sheet_screen.dart` ~L31-56, ~L90-100 | server loan-level collect line using `orderInstalmentsForCollectionFill` (MONEY-10) | RUN-01 (server variant) |
| Dashboard progress % | `dashboard_screen.dart` ~L637 | `todayBreakdown.*.pct` | DASH-01 |
| Analytics segment %, colour thresholds | `analytics_screen.dart` ~L504-519, ~L224-228, ~L342-346 | drop %, use server `color` | RPT-04 |
| Accounting projected revenue / profit (web) | `AccountingClient.tsx` ~L186-215 | shared summary fields | ACC-01 |

**Steps.** Work row by row, one commit per row. For every new response field: add it in the shared `lib/` function, include it in the v1 response, add it to `npm run test:mobile-parity-api` (API-7), parse it in the Dart model with the file's Decimal-safe helper, render it, delete the client maths.

**DOC-1:** add one line under §10 (money): "Clients render server figures; they never compute money or decision counts." if no rule already says this — check MONEY-1 / X-7 first and cite instead of duplicating.

**Verify.** `npm run test:calc`, `npm run test:mobile-parity-api`, `flutter analyze`. Spot-check the same loan/customer/collection screen on web and mobile.

---

## DEC-04 — Agent loan creation = direct or request

**Rule.** Server already does this (`app/api/v1/loans/route.ts` ~L421-440): agent with `bypassLoanApproval` → loan `active`; agent without → `pending_review` (a request; approvers are notified). Admin roles always `active`. **Keep this server logic unchanged.** The clients must present it the same way.

**Steps.**
1. Expose the flag: `GET /api/v1/auth/me` returns `bypassLoanApproval` for the caller (agents; `true` for non-agents). Web pages read it from the DB in the server component (not from the session object — X-4).
2. Web customer detail (`CustomerProfileClient.tsx` ~L491): show the button for agents too. Label: "New loan" when bypass is on or role is not agent; "Request loan" when an agent lacks bypass. Same label rule on the web loans list "New loan" button and the `/loans/new` page title.
3. Mobile: same label rule on customer detail (~L474-505), loans FAB (`loans_screen.dart` ~L138-142) and the new-loan screen title.
4. After create: if the response loan status is `pending_review`, web and mobile show "Loan request submitted for approval" and go to the approvals/own-requests view (mobile: needs APR-01 step 4); otherwise go to the loan.
5. Strings in six locales.

**Verify.** Agent without bypass → loan `pending_review`, approvers notified, both clients say "request". Agent with bypass → `active`. Admin → `active`.

---

## DEC-05 — Month-to-date figures on mobile agent dashboard

**Problem.** Web agent dashboard shows Month rate %, MTD collected and MTD expected from `DailyCollection` (`agent-dashboard/page.tsx` ~L94-98, ~L139-140). Mobile shows none; `GET /api/v1/dashboard` has no MTD fields.

**Steps.**
1. In `lib/dashboard/` add `getDueMetricsForRange(scope, from, to)` using the **same** inputs and maths as today's figures in `/api/v1/dashboard` (agent-linked loans via `buildAgentCustomerAccessWhere`, active/overdue, distributed instalments, `getTodayDueMetrics`-style expected/collected/pct). Today's figures must call it with `[startOfBusinessToday, startOfBusinessTomorrow)` and give identical numbers to now (check with `tests/dashboardKPI.test.ts`).
2. `/api/v1/dashboard` adds `monthToDate: { expected, collected, pct }` for the range `[first day of the IST month, startOfBusinessTomorrow)`. Additive (STABLE-2).
3. Web agent dashboard (after DASH-11 it reads v1) renders `monthToDate` instead of the `DailyCollection` aggregate. This changes web MTD numbers to the instalment-based definition — that is intended (one definition).
4. Mobile `_AgentMetricsRow` (`dashboard_screen.dart` ~L3153-3191): add Month rate (integer %), MTD collected, MTD expected. Parse in `dashboard_summary.dart` with the Decimal-safe helper.
5. Strings in six locales. API-7 parity test.

**Verify.** On the 1st of a month at 01:00 IST the MTD range is that day only (IST), on both clients.

---

## DEC-06 — Penalty collections → wallet, cash book, ledger, revenue (MONEY)

**Problem.** Settling a penalty only updates the `Penalty` row (`settledAmount`, status). No cash enters the collector's float, no cash-book (`AccountEntry`) row, no journal entry, and penalty money never appears as income. (The v1 settle route also tries to store `paymentMode` on `Penalty`, which has no such column — fixed in PEN-01.)

**Builds on** PEN-01 (`settlePenalty` in `lib/penalties.ts`, one transaction, increments). Do PEN-01 first.

**What exists to reuse.**
- Wallet: `creditCollection(tx, { tenantId, appType, agentId, amount, entryId })` in `lib/wallet.ts` ~L428-437 (credits the collector's float, ledger type `collection`). Collections credit float only when `creditFloat` is true (`lib/collectionWrite.ts` ~L333-336) — read that block to see which payment modes credit float.
- Cash book: `AccountEntry` (schema ~L2083): `type` is a free string (current values: capital_add, capital_withdraw, loan_disburse, collection, expense, adjustment), `category` already lists `penalty`, `referenceType` already lists `penalty`.
- Ledger: `lib/accounting/autoPost.ts` `autoPostCollection` (~L150-215) is the pattern (premium-accounting check, dedup tag + `buildDedupKey`, Dr cash/bank by mode, Cr account by posting key). CoA already has `4200 Penalty Income` (`seedDefaultCoA.ts` ~L53). `POSTING_DEFAULTS` (`lib/accounting/postingKeys.ts`) has no penalty key yet.

**Steps.**
1. `settlePenalty` input gains required `paymentMode` (`cash | upi | bank_transfer | cheque`) and optional `collectedById` (defaults to the acting user). Both callers (web action, v1 PATCH) and both clients send it; web settle modal and mobile settle sheet get a payment-mode picker (same options on both).
2. Inside the `settlePenalty` transaction, after updating the penalty:
   - a. Create `AccountEntry { tenantId, appType, branchId: loan.branchId, entryDate: business today, type: 'penalty_collection', category: 'penalty', amount, description: 'Penalty collected — <loanCode>', referenceType: 'penalty', referenceId: penaltyId, createdBy: userId }`.
   - b. **Treat it exactly like a loan collection** (owner decision): the collector's wallet (float) is credited, and verification status, cash-book category by payment mode, handover and GL debit side all follow the same rules `recordCollection` applies to a loan repayment (`lib/collectionWrite.ts` ~L220-340 — read it and mirror each rule; do not invent new ones). Add `creditPenaltyCollection(tx, { tenantId, appType, agentId: collectedById, amount, accountEntryId })` in `lib/wallet.ts`, a copy of `creditCollection` with ledger `type: 'penalty_collection'`, `refType: 'account_entry'`, `refId: accountEntryId`, called under the same condition `recordCollection` uses for `creditCollection`. The cash then reaches the office through the normal handover flow (MON-01), like any collection. Check the wallet ledger `type` column accepts the new value (string vs enum); if it is an enum, stop and report.
   - c. The only differences from a loan collection: the GL credit goes to `penalty_income` (4200), and loan totals / instalments / `DailyCollection` are not touched (step 4).
3. After the transaction commits (same as collections do), call a new `autoPostPenaltyCollection({ tenantId, appType, entryId: accountEntry.id, loanId, loanCode, amount, date, branchId, createdById, paymentMode })` in `autoPost.ts`: copy `autoPostCollection`, credit key `penalty_income`, `sourceType: 'penalty'`, `dedupKey: buildDedupKey('penalty_collection', tenantId, entryId)`, narration "Penalty collected for loan <code>". Add `penalty_income: '4200'` to `POSTING_DEFAULTS`.
4. **Do not** change `Loan.totalCollected`, instalments or `DailyCollection` — a penalty is not a loan repayment.
5. Revenue and cash totals: grep every place that sums `AccountEntry` by `type` (`app/(dashboard)/[module]/accounting/actions.ts` `getAccountingSummary`, `lib/dashboard/bookTotals.ts`, `app/api/v1/accounting/route.ts`, cash-balance helpers in `lib/wallet.ts` / `lib/accounting/*`). Wherever `'collection'` counts as a cash **inflow**, include `'penalty_collection'` as an inflow too. In the accounting summary (shared fn from ACC-01) add `penaltyIncome` (Σ `penalty_collection` in range) and include it in revenue / projected profit / net P&L. Show "Penalty income" on web and mobile accounting (six locales); add a label for the new type in the web transaction ledger.
6. Waivers post nothing (no money moved).
7. **Past penalties: no backfill.** The owner deleted all past data on 2026-10-01, so there is nothing to backfill. Do not write a backfill script.
8. **Who collects.** Agents collect penalties in the field (owner decision). `settlePenalty` allows role `agent` for loans the agent can reach (`buildAgentCustomerAccessWhere`, SCOPE-5) and admin roles for their branch scope. **Waiving stays admin/superadmin only** (D6); agents request a waiver (PEN-03). Agent entry points: loan detail penalty card "Collect penalty" (web and mobile) and the preclose penalty popup (DEC-01). The penalties list page stays staff-only (§7.2).
9. **DOC-1:** §7.2 (agents may collect penalties from loan detail / preclose, not waive, penalties page still staff-only), §10.4 (settle posts money like a collection), §10.5 (float credit type `penalty_collection`), §10.6 (new AccountEntry type, posting key `penalty_income` → 4200).

**Verify.** Unit test: cash settle ₹200 → one AccountEntry `penalty_collection` ₹200, collector float +₹200, one JE Dr 1100 / Cr 4200 ₹200 (premium on), loan totals unchanged; UPI settle → no float change, JE Dr 1200. Second identical call with the same entry id posts no second JE (dedup). `npm run test:calc`, `npm run test:ci`.

---

## DEC-07 — Mask PAN in API responses

**Problem.** Mobile customer detail shows PAN unmasked (`customer_detail_screen.dart` ~L1442-1445); the API returns it raw. Aadhaar is already masked server-side (`maskAadharNumber`, `lib/pii.ts` ~L74-86).

**Steps.**
1. `lib/pii.ts`: add `maskPan(value)` → `'XXXXXX' + last 4 chars` (null-safe) and `isMaskedPan(value)` (starts with `XXXXXX`, length 10).
2. Apply `maskPan` to the personal `pan` field in every v1 response that returns a customer: `GET /api/v1/customers/[id]` (next to the Aadhaar masking ~L107-111), the customer list (`/api/v1/customers`), `/api/v1/loans/[id]` customer include, `/api/v1/approvals` synthetic customer rows (~L75-81). Grep `pan` in `app/api/v1` to find the rest.
3. `PATCH /api/v1/customers/[id]`: `if (isMaskedPan(data.pan)) delete data.pan;` (same guard pattern as MON-08), so a prefilled masked value never overwrites the real one.
4. Mobile shows the masked value as returned. Mobile edit form: do not prefill PAN (or prefill masked — the server guard covers it).
5. Business `companyPan` is **not** masked (company PAN is not personal data) — leave it; mention in the commit.
6. **DOC-1:** SEC-1 (masked identifiers) now includes PAN.

**Verify.** GET a customer → `pan` = `XXXXXX234F`; edit and save on web and mobile without touching PAN → stored PAN unchanged.
