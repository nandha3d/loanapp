# mCollect — Mobile & Digital Collection Spec

**Generated:** 2026-06-04 · **Target app:** ZoloFund (Next.js 16 admin/portal + Flutter field app)
**Scope:** fill the **collection** gaps vs. a modern NBFC-MFI core. **Group lending is explicitly out of scope for this document** — every feature here works for ordinary, individual customers and loans.

---

## ✅ IMPLEMENTATION STATUS (2026-06-04) — BUILT, type-checked, tests green, zero changes to existing flows

**Schema** (`prisma/migrations/20260604000000_mcollect_runs_selfpay`, additive only)
- `CollectionEntry.source` (`field`|`route_run`|`self_pay_upi`) + `runId` — stream tag separating agent-cash from digital on every report.
- `ClientPaymentToken.channel`/`payUrl`/`providerRef`/`paidAt` — digital self-pay (legacy agent-scan QR untouched; defaults preserve behaviour).
- new `collection_runs` table (standalone, scalar FKs — `Tenant`/`Branch` models untouched).

**Shared engine**
- `lib/collectionWrite.ts` — `recordCollection()` gains optional `source`/`runId`/`creditFloat`/`gps` (back-compat; existing QR caller unchanged).
- `lib/collectionRun.ts` — `buildRouteSheet`, `openRun`, `collectRunLines`, `closeRun`, `reconcileRun`.
- `lib/selfPay.ts` — `createSelfPayLink`, `reconcileSelfPayToken`; `lib/razorpay.ts` + `createRazorpayPaymentLink` (mock fallback).

**APIs (mobile-ready v1)**: `POST run/open`, `GET run/:id/sheet`, `POST run/:id/collect|close|reconcile`, `POST self-pay/link`. Webhook now reconciles `payment_link.paid`/`payment.captured`/`order.paid` **before** the subscription path (reuses signature + idempotency). Borrower confirm: `POST /api/borrower/self-pay/confirm`.

**Web UI**: `/[module]/collection/runs` (list + start) and `/[module]/collection/runs/[id]` (sheet → batch collect → close → deposit/reconcile) + Sidebar entry. Borrower hosted page `/borrower/pay?token=…`.

**Server actions**: `app/(dashboard)/[module]/collection/runActions.ts`.

> Enforced in code: `route_run` cash credits agent float; `self_pay_upi` posts a **verified** entry with **no** float credit (money is in the bank). `npm run test:repayments` ✅ · `tsc --noEmit` ✅. Apply with `prisma migrate deploy`.

**Multi-tenant payment gateway (each lender uses their OWN Razorpay account):**
- Self-pay settles into the **tenant's** bank, not the platform's. Per-tenant keys stored encrypted (`encryptField`, PII key) in `app_settings` group `payments` — separate from the platform env keys that still power subscription billing.
- `lib/tenantRazorpay.ts` — get/save/resolve tenant gateway; `createRazorpayPaymentLink` now takes explicit (tenant) keys, never env. No keys → graceful fallback to the internal hosted UPI page.
- Per-tenant webhook `POST /api/webhooks/razorpay/collections`: resolves tenant from `notes.tenant_id` (or token), verifies signature with **that tenant's** secret, idempotency namespaced per tenant. Platform subscription webhook `/api/webhooks/razorpay` left untouched.
- Admin UI `/[module]/settings/payment-gateway` — enter keys + per-tenant webhook URL/event setup instructions. Secrets write-only (masked, blank = keep).

**Tiered cashless collection (final model — tenant picks per appetite):**
- **Tier 0 · UPI VPA (zero setup, default):** tenant enters only their UPI ID → borrower pay page renders a **dynamic UPI-intent QR with the exact amount** (`lib/upiIntent.ts`, real `upi://pay`) → money bank-to-bank into the tenant's account, no PSP. Borrower taps "I've paid" → token marked **`claimed`** (never auto-posts money) → staff confirm in the **Self-Pay queue** (`/[module]/collection/self-pay`, one-tap `confirm`/`reject`, branch-scoped). Sidebar entry added.
- **Tier 1 · Razorpay own keys (built):** auto-reconcile via per-tenant signed webhook.
- **Tier 2 · Razorpay Linked Accounts (deferred):** one partner key + `X-Razorpay-Account` header; needs Razorpay Partner/Route approval (paperwork) — adapter to be added then.
- `reconcileSelfPayToken` hardened: resolves a **real** `User` for `CollectionEntry.agentId` (passed actor → loan creator → customer's agent → tenant admin), never a fake `'system'` id. Self-pay never credits agent float regardless of tier.

---

> **Decided with product owner (2026-06-04):** mCollect ships in **two halves**, both independent of any group concept:
> - **A — Route batch collection (agent):** an agent opens a **collection run** over their route, sees every due/overdue customer on one offline-capable sheet, and collects in bulk in a single session — instead of opening each loan one at a time.
> - **B — Digital self-pay (borrower):** the borrower pays their own instalment via **UPI / QR / payment link**, auto-reconciled to the loan with no agent and no cash.
>
> Both layers are **additive** over the collection engine you already trust. They reuse `CollectionEntry`, `DailyCollection`, the wallet (`AgentAccount`/`BranchCashAccount`/`WalletTransaction`), the existing GPS/idempotency/receipt machinery, and the already-present `ClientPaymentToken`. **No existing money-flow is rewritten.**

---

## 0. How this fits the current architecture

| Current capability (verified in code) | How mCollect plugs in |
|---|---|
| `DailyCollection` — one row per agent/day, `totalExpected`/`totalCollected`/`entriesCount`, `status open/locked` | This is **already a per-day collection session.** Route-batch mCollect adds an explicit **run** (open → collect sheet → close/deposit) over that same row — no new "session" concept invented. |
| `CollectionEntry` — per-instalment posting, idempotent (`idempotencyKey`), GPS fields, `verificationStatus` | mCollect emits **the same `CollectionEntry` rows**. Batch = many entries in one transaction. Self-pay = one entry posted from a webhook. We add a `source` tag to tell the streams apart. |
| Wallet: collection **credits** agent float; disburse debits | Batch field collection credits agent float per line (cash in agent's hand). Self-pay does **not** touch agent float (money goes to the company bank via PSP). |
| `RouteStop` (route → customer, `sequence`, lat/lng) | The route batch sheet is **ordered by `RouteStop.sequence`** — the agent's existing walking order. |
| `ClientPaymentToken` (active/used/expired, per instalment, unique token) | The seed for **digital self-pay** — extended into a payable link + signed-webhook reconciliation. No new payment concept. |
| Razorpay webhooks + `WebhookEvent` (already wired for subscriptions, signature-verified) | Self-pay reuses the **same** signed-webhook plumbing and idempotency. |
| Receipts: `@react-pdf/renderer` (web), `qrcode`; mobile print/share | Batch run produces a consolidated receipt; self-pay produces a digital receipt + QR. |

**Design rule:** the instalment is the source of truth for money. mCollect is a *collection-convenience + cashless* layer over the per-instalment engine. If you removed every run and token tomorrow, every instalment and rupee would still reconcile.

---

## 1. Data model — changes

All additive. New columns are nullable or defaulted → `prisma migrate dev` yields a zero-downtime migration, no backfill.

### 1.1 Extend `CollectionEntry`

```prisma
// model CollectionEntry { ... }
  source        String   @default("field")   // field | route_run | self_pay_upi
  runId         String?  @map("run_id")        // batch run this entry came from
  @@index([runId])
```

`source` is the one field that disambiguates the money streams on every report and statement:
- `field` — existing one-loan-at-a-time collection (back-compat default).
- `route_run` — collected inside a route batch run (still agent cash → credits float).
- `self_pay_upi` — borrower paid digitally (no agent, no float credit).

### 1.2 Extend `ClientPaymentToken` (digital self-pay)

```prisma
// model ClientPaymentToken { ... }   (status already: active | used | expired — add: paid | failed)
  channel       String   @default("upi")     // upi | card | netbanking | link
  payUrl        String?  @map("pay_url") @db.Text   // hosted payable link / UPI intent
  providerRef   String?  @map("provider_ref")        // PSP order/txn id
  paidAt        DateTime? @map("paid_at")
```

### 1.3 New model — `CollectionRun` (the route batch session)

A thin wrapper so a batch run can be opened, paused, resumed, and reconciled as one unit. It **groups** `CollectionEntry` rows by `runId`; it does **not** replace `DailyCollection` (which stays the per-agent/day rollup).

```prisma
model CollectionRun {
  id              String   @id @default(cuid())
  tenantId        String   @map("tenant_id")
  branchId        String?  @map("branch_id")
  appType         String   @default("microlending") @map("app_type")
  agentId         String   @map("agent_id")
  routeId         String?  @map("route_id")
  date            DateTime @db.Date
  status          String   @default("open")        // open | collecting | closed | reconciled
  // snapshot taken at open
  expectedTotal   Decimal  @default(0) @map("expected_total") @db.Decimal(14, 2)
  stopsExpected   Int      @default(0) @map("stops_expected")
  // running
  collectedTotal  Decimal  @default(0) @map("collected_total") @db.Decimal(14, 2)
  stopsCollected  Int      @default(0) @map("stops_collected")
  cashCollected   Decimal  @default(0) @map("cash_collected") @db.Decimal(14, 2)   // for deposit reconcile
  digitalCollected Decimal @default(0) @map("digital_collected") @db.Decimal(14, 2)
  // session GPS / device proof
  openedAt        DateTime? @map("opened_at")
  closedAt        DateTime? @map("closed_at")
  openLat         Float?   @map("open_lat")
  openLng         Float?   @map("open_lng")
  notes           String?  @db.Text
  createdAt       DateTime @default(now()) @map("created_at")

  tenant Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  branch Branch? @relation(fields: [branchId], references: [id])

  @@unique([tenantId, appType, agentId, routeId, date])  // one run per agent/route/day
  @@index([tenantId, status])
  @@index([agentId, date])
  @@map("collection_runs")
}
```

> **Why a separate model and not just `DailyCollection`?** A `DailyCollection` is one row per agent per day regardless of route; an agent may cover multiple routes, and a run needs its own GPS-open snapshot + cash/digital split for end-of-day deposit reconciliation. `CollectionRun` references the same entries via `runId`; both rollups stay correct.

---

## 2. mCollect-A — Route batch collection (agent)

### 2.1 Flow

```
open run ──► load batch sheet (route stops in sequence) ──► collect line-by-line (offline ok)
   │                                                              │
   └────────────────────── GPS snapshot ──────────────────────────┘
                                                                   ▼
                                          close run ──► deposit reconciliation
```

### 2.2 API (`app/api/collection/run/...` — must be API routes; mobile + offline)

`POST /api/collection/run/open` `{ routeId, date, lat, lng }`
- Idempotent on `(agentId, routeId, date)` → creates/returns the `CollectionRun` (status `open`).
- Snapshots `expectedTotal` = Σ due+overdue instalments for the route's customers, `stopsExpected`.

`GET /api/collection/run/:id/sheet`
- Returns the **batch sheet**, ordered by `RouteStop.sequence`: one row per customer →
  `{ stopSeq, customerId, name, loanId, instalmentId, dueAmount, overdueAmount, penaltyDue, suggested, lastPaidAt, lat, lng }`.
- This is exactly what the agent's screen renders, top to bottom in walking order.

`POST /api/collection/run/:id/collect` `{ lines: [{ instalmentId, receivedAmount, paymentMode, lat, lng }], idempotencyKey }`
- **One `$transaction`** emitting many `CollectionEntry` rows, each `source = 'route_run'`, `runId` set, reusing the **existing collection-entry posting logic** (instalment update, daily-total rollup, **wallet collection-credit per cash line**, idempotency, GPS distance vs customer).
- Partial collection allowed; skipped customers simply have no entry.
- Updates `CollectionRun` running totals (`collectedTotal`, `stopsCollected`, `cashCollected`/`digitalCollected` by `paymentMode`).

`POST /api/collection/run/:id/close` `{ }` → status `closed`, `closedAt`. Locks the run.

`POST /api/collection/run/:id/reconcile` `{ cashDeposited, depositRef }`
- Agent deposits the cash they collected. Compare `cashDeposited` vs `cashCollected` → if equal, post the **existing wallet deposit** (agent float − X, branch + X); if short/over, flag a variance + create an `ApprovalRequest` (never silently absorb). Status → `reconciled`.

> **Offline (mobile):** the whole run (open → collect → close) queues in Isar like the current `quick_collect_sheet`, replays on reconnect; server idempotency on `idempotencyKey` + `(agentId, routeId, date)` makes replay safe. Matches existing `COLL-05`.

### 2.3 Reuse, don't fork

If the single-entry collection logic (instalment update + daily rollup + wallet credit + idempotency) isn't already a shared helper, extract it into `postCollectionEntry()` and call it in a loop from the batch endpoint. The batch endpoint must **not** reimplement collection math.

---

## 3. mCollect-B — Digital self-pay (borrower, UPI/QR/link)

Builds directly on `ClientPaymentToken`. No agent, no cash, money lands in the company bank via PSP.

### 3.1 Create a payable link

`POST /api/collection/self-pay/link` `{ instalmentId }` (admin/agent, or borrower from portal)
- Create/refresh a `ClientPaymentToken`: `amount` = instalment due + penalty due, `channel`, `payUrl` from PSP (Razorpay order / UPI intent), `expiresAt`, status `active`.
- Return `payUrl` + a QR (you already ship `qrcode`). Agent can show the QR in the field for a cashless field collection too.

### 3.2 Borrower pays

- Borrower-portal page `app/borrower/pay/[token]` — shows loan, amount, UPI/QR/link; on success PSP redirects back to a receipt page.
- Or: agent shows QR at the doorstep → borrower scans → pays → money to company bank, **agent float untouched**.

### 3.3 Reconcile via signed webhook

`POST /api/webhooks/payment` (extend existing Razorpay/`WebhookEvent` handler)
- **Signature required** (mirrors `SUB-01`: no secret → 500, bad signature → 401).
- On `payment.captured`:
  1. Resolve token by `providerRef`; assert `active` + amount match.
  2. Post a `CollectionEntry` via the **same `postCollectionEntry()` helper**, `source = 'self_pay_upi'`, `paymentMode = 'upi'`, **no agent float credit** (cash never touched an agent).
  3. Token → `paid`, set `paidAt`, link `collectionEntryId`.
  4. Idempotent on `WebhookEvent` id → duplicate event = no double post.
- Send digital receipt (SMS/email via existing `NotificationLog`/templates).

> **The key money-flow distinction (encode it everywhere):** `self_pay_upi` **bypasses agent cash float** — the collection credit goes to a bank/virtual line, not `AgentAccount`. `route_run`/`field` collections **credit agent float** (agent holds the cash). `CollectionEntry.source` + `paymentMode` carry this; reports and the wallet statement must show the two streams separately.

---

## 4. UI / pages

### 4.1 Web (`app/(dashboard)/[module]/...`)

- `collection/page.tsx` (existing) — add a **"Start route run"** action and a **runs history** tab.
- `collection/run/[id]/` — the batch sheet: customer rows in `RouteStop.sequence`, due/overdue/penalty per row, quick-fill "mark all suggested", running collected total, cash vs digital split, GPS badge, **Close** + **Reconcile/Deposit** buttons.
- `collection/self-pay/` — admin view: generate/share payable links, see token status (active/paid/expired), resend.

### 4.2 Mobile (Flutter — field-critical)

- `route_run_screen` — the offline-first batch sheet (the heart of mCollect-A): stop-ordered list, per-customer amount, attendance/skip, GPS capture, sync queue, **consolidated run receipt** + per-customer receipt (print/share).
- Reuse existing `quick_collect_sheet` patterns; add **"Show QR to pay"** per row → renders a self-pay QR for a cashless field collection.
- End-of-day **deposit/reconcile screen** (cash collected vs deposited).

### 4.3 Borrower portal

- `borrower/dashboard` → **"Pay now"** per due instalment → self-pay link/QR (mCollect-B).
- `borrower/pay/[token]` → hosted payment page → receipt.

---

## 5. Phased rollout

| Phase | Deliverable | Gate |
|---|---|---|
| **P0 — schema** | `CollectionRun` + additive columns (`CollectionEntry.source/runId`, `ClientPaymentToken.channel/payUrl/providerRef/paidAt`); migration; back-compat (`source='field'`) verified | `prisma migrate` green, existing tests pass |
| **P1 — shared helper** | Extract `postCollectionEntry()` from current single-collection path (pure refactor, no behaviour change) | existing COLL-* tests still green |
| **P2 — route run API** | open / sheet / collect / close, multi-entry txn, GPS, idempotency | RUN-01..05 |
| **P3 — route run web** | batch sheet + close screen | RUN web |
| **P4 — route run mobile** | offline `route_run_screen` + sync + consolidated receipt | RUN mobile parity |
| **P5 — deposit reconcile** | reconcile endpoint + variance approval + wallet deposit | RUN-06 |
| **P6 — self-pay** | token link + QR + portal pay page + signed webhook reconcile + digital receipt | PAY-01..03 |

P6 (self-pay) is fully independent of P1–P5 and can ship in parallel.

---

## 6. Test cases (extends PARITY_AND_E2E_TESTS.md conventions)

### RUN (mCollect-A)
- **RUN-01 Open.** IN: open run for route → `expectedTotal` = Σ dues, `stopsExpected` set; dup open same agent/route/date → same run (idempotent). OUT: agent without that route → 403.
- **RUN-02 Sheet.** IN: sheet returns one row/customer **ordered by `RouteStop.sequence`** with due+overdue+penalty.
- **RUN-03 Collect.** IN: submit N lines → N `CollectionEntry` (`source=route_run`, `runId` set), each instalment updated, daily totals↑, **agent float credited per cash line**. OUT: line > due → capped; already-paid → 409; retry same `idempotencyKey` → single post.
- **RUN-04 GPS.** IN: within geofence of customer → verified; OUT: far → mismatch flag stored (not blocked) — matches existing COLL-04.
- **RUN-05 Offline (mobile).** IN: full run offline → syncs once on reconnect, server idempotent.
- **RUN-06 Reconcile.** IN: `cashDeposited == cashCollected` → wallet deposit posts (float−X, branch+X), status `reconciled`. OUT: short/over → variance flagged + ApprovalRequest, no silent absorb.

### PAY (mCollect-B)
- **PAY-01 Link.** IN: create token → `payUrl`+QR, `amount` = due+penalty, `expiresAt` set, status `active`. OUT: instalment already paid → reject; expired token reused → reject.
- **PAY-02 Webhook.** IN: signed `payment.captured` → `CollectionEntry` (`source=self_pay_upi`, **no agent float credit**), token→`paid`, receipt sent. OUT: bad signature → 401; missing secret → 500; dup event → idempotent (no double post).
- **PAY-03 Reconcile/report.** IN: statement shows self-pay stream separate from agent-cash stream; loan balance reflects payment; dashboard cash-today **excludes** self-pay UPI (it's bank, not agent cash) — confirm KPI definition.

---

## 7. Risks & decisions to confirm

1. **Self-pay float semantics.** Confirmed assumption: self-pay money lands in a **company bank account**, so the webhook posts collection **without** crediting `AgentAccount`. If some tenants want agent-attributed UPI (agent shows their own QR), add a config flag — flag before P6.
2. **PSP / merchant account.** Reuses the existing Razorpay integration (already wired for subscriptions + signed webhooks). Confirm the **same merchant account** is acceptable for borrower repayments, or a separate route/account is needed.
3. **Dashboard "cash collected today" KPI.** Today it sums collection entries. Decide whether self-pay UPI counts toward "cash today" (recommended: **no** — show it as a separate "digital collected" tile, since no agent cash moved). This is `PAY-03` / `DASH-01`.
4. **Penalty in batch context.** Penalty accrual stays **per-loan/per-instalment** (unchanged cron). The batch sheet just surfaces `penaltyDue`; the penalty engine doesn't change.
5. **Branch scope.** Runs inherit `branchId`; superadmin sees all, admin own branch (mirror existing `WAL-07`).
6. **One run per agent/route/day.** The `@@unique([tenantId, appType, agentId, routeId, date])` assumes an agent runs a route at most once a day. If split AM/PM runs are needed, add a `sequence`/`shift` to the key.

---

## 8. One-paragraph summary for stakeholders

mCollect modernises collection in two independent halves, both for ordinary individual customers. **Route batch collection** lets a field agent open one **run** over their route, collect from every due customer on a single offline-capable sheet in walking order (emitting normal `CollectionEntry` rows, crediting agent float), then reconcile and deposit the day's cash in one step. **Digital self-pay** lets borrowers pay their own instalment by **UPI / QR / link** through a signature-verified webhook that reconciles straight to the loan with no agent and no cash. Nothing in the money engine is rewritten: both reuse the existing collection-posting logic, wallet, idempotency, GPS, receipts, and the `ClientPaymentToken` already in the schema — they are additive, back-compatible, and ship behind a one-line `source` tag that keeps the cash and digital streams cleanly separated on every report.
