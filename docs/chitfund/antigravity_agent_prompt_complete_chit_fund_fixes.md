# Antigravity Agent Implementation Spec: Chit Fund Module Parity & Production Fixes

## 1. Objective & Context

You are working inside the **`nandha3d/loanapp` (`merged-all-branches`)** multi-tenant lending SaaS repository (ZoloFund), built on:
- **Web & API:** Next.js (App Router) + TypeScript + Prisma ORM + PostgreSQL
- **Mobile:** Flutter (`mobile/`) consuming the Next.js API routes, including offline chit collection queueing (`chit_payment_queue.dart`)
- **Localization & Tests:** `i18n/`, Playwright E2E tests, and module docs (`CHIT_MODULE.md`, `ENGINEERING_REFERENCE.md`, `AUDIT.md`)

Your goal is to close **7 competitive and operational gaps** in the **Chit Fund module** without breaking existing modules (Microlending, Auto Finance, Gold, Property, Product Finance), multi-tenant data isolation, or double-entry ledger integrity.

---

## 2. Mandatory Discovery Phase (Do This Before Editing Any Code)

Before writing any code or creating migrations, inspect and map the existing implementation:
1. Read `CHIT_MODULE.md`, `ENGINEERING_REFERENCE.md`, and `AUDIT.md` (if present).
2. Inspect `prisma/schema.prisma` for:
   - Tenant scoping pattern (`tenantId`, branch scoping, Prisma extensions/RLS)
   - Chit models (groups, members/tickets, cycles/periods, auctions, collections/subscriptions, payouts, ledger/journal entries)
   - Subscription plans / tier entitlements / feature flags
   - Customer / KYC models
3. Locate and read:
   - `payout.ts` (and all API routes / services handling chit auction payouts and overdue calculations)
   - Chit group creation, cycle generation, and member enrollment services/routes
   - Cash collection APIs and receipt UI components (web + mobile)
   - `mobile/**/chit_payment_queue.dart` and Flutter chit screens/models
   - Existing report / PDF / Excel export utilities
4. Produce a short internal implementation plan noting exact file paths found in this repo, then execute tasks **in strict priority order (P0 -> P1 -> P2)**.

---

## 3. Non-Negotiable Engineering Guardrails

- **Strict Multi-Tenancy:** Every new query, mutation, unique constraint, and report export MUST enforce `tenantId` (and `branchId` where applicable). Never leak or aggregate records across tenants.
- **Atomic Financial Transactions:** All payouts, arrears settlements, mid-cycle opening ledger entries, and cash collections MUST run inside `prisma.$transaction(...)`.
- **Immutable Ledger & Audit Trail:** Never silently overwrite historical balances. Record explicit ledger/journal entries and audit logs (`createdBy`, `timestamp`, `reason/reference`) for arrears netting, split payouts, and opening migration balances.
- **Backward Compatibility:** Do not break existing active chit groups, existing migrations, or other loan modules. Use additive Prisma schema migrations with safe defaults.
- **Idempotency:** All financial write endpoints used by Web or Flutter (especially payouts and offline-synced collections) MUST accept and enforce an `idempotencyKey` to prevent duplicate disbursements or duplicate cash receipts.
- **i18n Ready:** Any new user-facing labels should follow the repository's existing `i18n/` convention where applicable.

---

## 4. Implementation Tasks

---

### TASK 1 (P0): Arrears Auto-Deduction & Split / Instalment Payouts

#### Problem
`payout.ts` currently disburses the full `auction.prizeAmount` without netting the winning member's unpaid overdue subscriptions/penalties, and does not support paying out a prize across multiple instalments when cash collection lags.

#### Requirements
1. **Schema Updates (`prisma/schema.prisma`):**
   - Extend the Chit Payout / Auction Payout model (or introduce a child `ChitPayoutDisbursement` table if payouts are 1:1 with auctions) to track:
     - `grossPrizeAmount` (Decimal)
     - `arrearsDeductedAmount` (Decimal, default `0`)
     - `penaltyDeductedAmount` (Decimal, default `0`)
     - `netPayableAmount` (Decimal)
     - `totalDisbursedAmount` (Decimal, default `0`)
     - `remainingPayableAmount` (Decimal)
     - `payoutStatus`: enum `PENDING | PARTIALLY_PAID | COMPLETED | CANCELLED`
     - `arrearsBreakdown` (JSON: list of settled cycle IDs, principal/subscription amounts, penalty amounts)
   - Support multiple partial disbursements (`ChitPayoutDisbursement`) linked to a single prize payout, each storing:
     - `amount`, `paymentMode` (`CASH | UPI | BANK_TRANSFER | CHEQUE`), `referenceNumber`, `paidAt`, `paidByUserId`, `denominationBreakdown` (JSON, nullable — links with Task 3), `idempotencyKey` (unique per tenant), `notes`.

2. **Arrears Calculation & Netting Logic (`payout.ts`):**
   - Add a deterministic preview helper `calculateWinnerPayoutSummary(tenantId, auctionId)`:
     - Fetch all unpaid / partially paid subscription dues (and applicable overdue penalties) for the winning **ticket/member** up to and including the current auction cycle (respecting group rules on whether current cycle's due is included).
     - Compute:
       - `totalOverdueSubscriptions`
       - `totalOverduePenalties`
       - `maxDeductible = totalOverdueSubscriptions + totalOverduePenalties`
       - `defaultArrearsDeduction = min(grossPrizeAmount, maxDeductible)`
       - `netPayableAmount = max(0, grossPrizeAmount - defaultArrearsDeduction)`
   - Allow an authorized role (e.g., Foreman / Branch Manager) to toggle whether to deduct full arrears (default: **ON**), deduct a custom partial arrears amount (`0 <= amount <= maxDeductible`), or waive penalties (logged in audit trail).
   - **Atomic Settlement in `prisma.$transaction`:**
     - Allocate `arrearsDeductedAmount` across the winner's unpaid cycles in **FIFO order (oldest overdue cycle first)**, updating each cycle subscription's `paidAmount` and `status` (`PAID` or `PARTIAL`), tagged with payment mode `PAYOUT_ADJUSTMENT` and linked to the `payoutId`.
     - Post balanced ledger entries:
       - Debit: Prize Payable / Chit Pool for `grossPrizeAmount`
       - Credit: Member Subscriptions Receivable / Overdue Dues for `arrearsDeductedAmount` (and Penalty Income for `penaltyDeductedAmount`)
       - Credit: Cash / Bank (or Prize Payable Liability for unpaid remainder if split payout) for `disbursedNowAmount`
     - If `netPayableAmount === 0` (entire prize consumed by arrears), mark payout `COMPLETED` with `0` cash outflow and clear the netted dues.

3. **Split / Instalment Payout Flow:**
   - Allow disbursing any amount `0 < amount <= remainingPayableAmount` across 1 or more tranches.
   - Reject over-disbursement (`amount > remainingPayableAmount`) with HTTP `400`.
   - Recalculate `totalDisbursedAmount`, `remainingPayableAmount`, and `payoutStatus` (`PARTIALLY_PAID` -> `COMPLETED`) atomically on every tranche.

4. **UI (Web + Mobile where payout is shown):**
   - Show a clear payout breakdown card before confirmation:
     - `Gross Prize Amount`
     - `(-) Unpaid Arrears (X overdue cycles)` (expandable list of cycles)
     - `(-) Pending Penalties`
     - `= Net Payable to Winner`
     - `Already Paid` & `Remaining Balance`
     - Input for `Disburse Amount Now` (pre-filled with `remainingPayableAmount`, editable for split payouts).
   - Generate a printable/downloadable **Winner Settlement Receipt** showing both the arrears netted and each disbursement tranche.

---

### TASK 2 (P0): Mid-Cycle Running Chit Migration (Wizard + Bulk Import)

#### Problem
Group activation currently assumes a brand-new chit starting at Cycle 1 and generates fresh periods `1..N`, making it impossible for foremen to migrate live running chits (e.g., currently at Month 9 of 20).

#### Requirements
1. **Schema Updates (`prisma/schema.prisma`):**
   - Add migration/opening fields to Chit Group:
     - `isMigrated` (Boolean, default `false`)
     - `migrationStartCycle` (Int, default `1`) — the first cycle to be actively managed in ZoloFund
     - `openingCashBalance` (Decimal, default `0`)
     - `openingForemanCommissionBalance` (Decimal, default `0`)
     - `migratedAt` (DateTime, nullable)
   - Add opening balance / historical prize fields to Chit Member / Ticket:
     - `openingArrearsAmount` (Decimal, default `0`) — positive = member owes money from prior cycles
     - `openingAdvanceAmount` (Decimal, default `0`) — positive = member has overpaid/credit carried forward
     - `isPrized` / `prizedCycleNumber` (Int, nullable)
     - `historicalPrizeAmount` (Decimal, nullable)
     - `historicalPayoutPendingAmount` (Decimal, default `0`) — if a prior winner is still owed partial prize money
   - Mark periods `1..(migrationStartCycle - 1)` explicitly as `MIGRATED_HISTORICAL` (closed/archived summary records) OR do not generate fake unpaid dues for them—choose the pattern cleanest with existing reports/queries, ensuring **zero phantom overdue dues are created for historical cycles**.

2. **Migration Logic & Service (`migrateRunningChit`):**
   - Accept:
     - Standard chit parameters (`name`, `chitValue`, `totalMembers`, `totalCycles`, `frequency`, `startDate`, `commissionPercent`)
     - `currentActiveCycle` (`2 <= k <= totalCycles`)
     - Member roster (exact count or up to `totalMembers`), each with:
       - `name`, `phone`, `ticketNumber`
       - `alreadyPrized` (boolean), `prizedCycleNumber` (must be `< k`, unique per historical cycle), `historicalPrizeAmount`, `historicalPayoutPendingAmount`
       - `openingArrearsAmount` OR `openingAdvanceAmount`
     - Opening pool reconciliation (`openingCashBalance`, optional notes)
   - **Validation Rules (must run in dry-run preview & commit):**
     - `1 < currentActiveCycle <= totalCycles`
     - Count of `alreadyPrized` members cannot exceed `currentActiveCycle - 1` (and no duplicate `prizedCycleNumber`).
     - No member can have both `openingArrearsAmount > 0` and `openingAdvanceAmount > 0` simultaneously.
     - Active schedules and dues are generated strictly for cycles `currentActiveCycle..totalCycles`.
     - If a member has `openingArrearsAmount > 0`, register an opening receivable/arrear entry so **Task 1 (Arrears Auto-Deduction)** automatically nets it if they win a future auction.
     - If a member has `openingAdvanceAmount > 0`, apply or hold it as member credit that can offset Cycle `k` dues.
     - If `historicalPayoutPendingAmount > 0`, create an open `PARTIALLY_PAID` payout balance so the foreman can pay the remainder via Task 1.
     - Post an explicit **Opening Balance Journal Entry** in the ledger so Day Book / Trial Balance stays balanced from Day 1.

3. **UI Wizard + CSV/Excel Import:**
   - Add an entry option on "New Chit Group": **"Start Fresh (Cycle 1)"** vs. **"Import Running Chit (Mid-Cycle)"**.
   - Build a 4-step wizard:
     1. Group Details & Current Cycle (`k` of `N`)
     2. Members & Opening Positions (inline editable grid + **Upload CSV/XLSX** + downloadable template)
     3. Opening Cash & Historical Winners Reconciliation Summary (shows total arrears, total advances, prized count, opening pool balance)
     4. Dry-Run Validation & Atomic Activate.

---

### TASK 3 (P1): Note-by-Note Cash Denomination Tally (Web + Flutter)

#### Problem
Cash collections and cash payouts have no note-by-note denomination counter to catch counting errors before saving.

#### Requirements
1. **Tenant Configuration:**
   - Add tenant setting `cashDenominationMode`: enum `DISABLED | OPTIONAL | REQUIRED` (default `OPTIONAL` for existing tenants so nothing breaks unexpectedly, and toggleable in Tenant Settings -> Chit/Cash Settings).
   - When `REQUIRED`, saving any `CASH` chit collection or `CASH` chit payout MUST fail unless denominations are entered and sum exactly to the transaction amount.

2. **Data Model & Server Validation:**
   - Add `denominationBreakdown` (`Json?`) to Chit Collection/Payment records, Chit Payout Disbursements, and Agent Cash Handover (if present).
   - Standardize JSON schema for Indian Rupee notes & coins:
     ```json
     {
       "currency": "INR",
       "counts": {
         "500": 10,
         "200": 2,
         "100": 5,
         "50": 0,
         "20": 0,
         "10": 0,
         "5": 0,
         "2": 0,
         "1": 0
       },
       "computedTotal": 5900
     }
     ```
   - Create a shared TypeScript validation helper `validateDenominationBreakdown(breakdown, expectedAmount, mode)`:
     - Ensures all counts are non-negative integers.
     - Recomputes `sum(denomination * count)` on the server (never trust client `computedTotal`).
     - Asserts `recomputedTotal === expectedAmount` (to paisa/rupee precision) whenever breakdown is provided or `mode === 'REQUIRED'`.

3. **Reusable UI Component (Web + Flutter):**
   - **Web (React/Next.js):** Build `<CashDenominationCounter expectedAmount={amount} value={...} onChange={...} required={...} />` displayed automatically whenever `paymentMode === 'CASH'`.
     - Shows each INR denomination row (`₹500, ₹200, ₹100, ₹50, ₹20, ₹10, ₹5, ₹2, ₹1`), quick `+`/`-` buttons, numeric input, line subtotal, grand total, and live **Difference indicator** (green checkmark when `diff === 0`, red shortage/excess badge otherwise).
     - Disables Submit button when `required && diff !== 0`.
   - **Flutter (`mobile/`):** Build matching `CashDenominationSheet` / widget integrated into the chit collection screen and included in the offline queue payload (`chit_payment_queue.dart`).
   - Display denomination summary on Cash Collection Daily Summary / Branch Handover screens so managers can verify exact note bundles handed over by field agents.

---

### TASK 4 (P1): Lightweight Member Onboarding, Phone Contact Import & Spreadsheet Templates

#### Problem
Adding chit members currently forces creating full KYC `Customer` records first; there is no Flutter phone-contact import or downloadable Excel/Sheets templates.

#### Requirements
1. **Quick-Add Chit Member (Zero-KYC Friction):**
   - Add a fast-path API & UI inside Chit Group management: `POST /api/chit/groups/:groupId/members/quick-add` (supports single or batch array).
   - Required fields: `fullName` + `phone` (normalize Indian phone numbers to E.164 / 10-digit canonical format). Optional: `alias`, `address`, `ticketCount` (allow 1 person to hold multiple tickets if supported by the existing model).
   - Behavior:
     - Look up existing `Customer` within the same `tenantId` by normalized phone.
     - If found, link existing customer to the chit group without duplicating.
     - If not found, create a lightweight `Customer` with `kycStatus = 'MINIMAL'` (or existing lowest non-blocking status) — do NOT require Aadhaar, PAN, photo, or bureau pull to join a chit.
     - Preserve full KYC enforcement as optional/upgradeable later (e.g., before high-value payout if tenant configures it).

2. **Flutter Phone Contact Import (`mobile/`):**
   - Add native phonebook import in the Flutter "Add Chit Members" screen using `flutter_contacts` (check `pubspec.yaml` first for any existing contacts plugin).
   - Handle Android (`READ_CONTACTS`) and iOS (`NSContactsUsageDescription`) permissions cleanly with graceful denial fallback.
   - Provide a searchable multi-select contact picker that strips formatting/country codes, flags already-enrolled members in the group, and batch-submits to the `quick-add` API.

3. **Downloadable Spreadsheet Templates & Bulk Upload:**
   - Add template download endpoints / static generators (using `exceljs` or `xlsx`, checking existing `package.json` dependencies first):
     1. **Chit Members Import Template (`.xlsx` & `.csv`)** — columns: `Full Name, Phone, Ticket No (Optional), Address (Optional)`.
     2. **Mid-Cycle Running Chit Migration Template (`.xlsx`)** — integrates directly with Task 2.
     3. **Public Lead-Magnet Chit Fund Tracker Workbook (`.xlsx`)** — accessible without login on the marketing/public route (e.g., `/api/public/templates/chit-fund-tracker.xlsx` + CTA link on landing/chit page), featuring 5 working formula-driven tabs compatible with Excel & Google Sheets:
        - `1_Group_Setup`
        - `2_Members`
        - `3_Monthly_Auctions` (live formulas for Foreman Commission, Dividend per Member, Net Payable)
        - `4_Collection_Ledger`
        - `5_Summary_Dashboard` (auto-calculated totals & defaulters)
   - Add a **Bulk Import Members from Excel/CSV** modal in the Chit Group Members tab with row-by-row validation preview before saving.

---

### TASK 5 (P1): Free PLG Entry Tier — "1 Running Chit, Unlimited Members"

#### Problem
ZoloFund's Free (`₹0`) tier currently gates usage by "25 active loans", which blocks solo chit organizers running a single 30–50 member chit from self-serving on the free plan.

#### Requirements
1. **Plan Entitlements Refactor:**
   - Locate where subscription plans, quotas, and module limits are defined and enforced.
   - Decouple **Chit Fund quotas** from the generic `maxActiveLoans` quota:
     - On the **Free (`₹0`) tier**, allow:
       - `maxActiveChitGroups = 1`
       - `maxMembersPerChit = null` (unlimited members for that 1 running chit)
       - Full access to core ledger, auction calculation, arrears auto-deduction, cash denomination counter, and receipts for that 1 chit.
     - Keep `maxActiveLoans = 25` strictly scoped to loan modules (Microlending/Gold/Auto/etc.), NOT chit member count.
     - Gate the following to Paid / Enterprise tiers via clean feature flags:
       - `2+` active chit groups (Pro/Growth)
       - Multi-branch & extra field agents
       - Automated WhatsApp/n8n reminders
       - State Statutory Register PDF exports (Task 7 — Enterprise)
2. **Self-Serve Onboarding & Upgrade UX:**
   - Ensure a brand-new user signing up on the Free tier can immediately create and run 1 chit group with 50+ members without hitting a paywall or card requirement.
   - When attempting to activate a 2nd concurrent active chit group on Free tier, return structured HTTP `402`/`403` (`code: 'CHIT_PLAN_LIMIT_REACHED'`) and display a clear, non-destructive upgrade modal.
   - Note: Completed/Closed chits must NOT count toward `maxActiveChitGroups`.

---

### TASK 6 (P2): Resilient Offline Mobile Support (Scoped to Flutter)

#### Scope Decision (Important)
Do **NOT** retrofit offline-first architecture onto the Next.js Web app (live auctions, multi-branch accounting, and concurrent cash pools on web must remain strongly consistent server-side). Instead, harden the **Flutter field app** (`mobile/`) where agents actually lose connectivity.

#### Requirements
1. **Audit & Harden `chit_payment_queue.dart`:**
   - Ensure every queued offline collection includes:
     - `clientMutationId` / `idempotencyKey` (UUID v4 generated on device at collection time)
     - `tenantId`, `groupId`, `memberId`, `cycleId`, `amount`, `paymentMode`
     - `denominationBreakdown` (from Task 3)
     - `collectedAtLocal` (ISO timestamp) + `agentId`
   - Ensure the Next.js collection API honors `idempotencyKey`: if the exact same key is re-sent after a flaky network timeout, return the existing receipt (`200 OK`, `idempotentReplay: true`) instead of creating a duplicate payment.
2. **Offline Read Cache for Field Agents:**
   - Cache assigned chit groups, member rosters, phone numbers, and current cycle due balances locally on device (using existing local DB/storage in `mobile/`, e.g., Hive/SQLite/SharedPreferences) with a `lastSyncedAt` banner.
   - Allow agents to record offline collections against cached members even with Airplane Mode enabled.
3. **Sync Engine & Conflict Visibility UI:**
   - Add an **Offline Queue & Sync Status** screen in Flutter showing `PENDING`, `SYNCING`, `FAILED` (with server error reason), and `SYNCED` receipts, with manual "Retry All" and per-item retry/discard controls.
   - Handle edge cases cleanly: e.g., if a cycle was already paid online by another user before the offline queue synced, surface a clear `CONFLICT` state rather than silently dropping the agent's cash entry.

---

### TASK 7 (P2): State-Configurable Statutory Register Exports (Enterprise Add-On)

#### Problem
ZoloFund only exports generic reports and auction minutes, lacking structured statutory registers formatted for Indian state Chit Fund Rules.

#### Context on State Form Numbering
Indian chit fund statutory form numbers vary by state (they are NOT uniform nationwide):
- **Tamil Nadu Chit Funds Rules, 1984:** e.g., Form I (Prior Sanction Application), Form VII (Certificate of Furnishing Chit Agreement), Form VIII (Chit Agreement Proforma), Form XXII (Bank Deposit / Security Register), plus Statutory Subscriber Register, Ledger, Day Book, and Auction Minutes.
- **Delhi Chit Fund Rules, 2007:** e.g., Form VII (Certificate of Commencement), Form XI (Register of Subscribers), Form XII (Chit Ledger), Form XIII (Day Book), Form XIV (Bank Deposit Register).
- **Central Chit Funds Act, 1982 (Generic Fallback):** Standard statutory books usable across other states.

#### Requirements
1. **Feature Gating:**
   - Gate behind a tenant entitlement flag: `canExportStatutoryRegisters` (enabled on Enterprise tier or via tenant feature override).
2. **Modular State Template Architecture:**
   - Create a registry (`lib/chit/statutory/templates/`) keyed by `stateCode`: `'TN' | 'DL' | 'GENERIC'` (extensible for `KA`, `KL`, `AP`, `TS`, `MH`).
   - Store optional chit registration metadata on the Chit Group / Tenant: `chitRegistrationNumber`, `priorSanctionNumber`, `foremanName`, `registeredOfficeAddress`, `registrarJurisdiction`, `stateCode`.
3. **Core Exportable Registers (PDF + Excel):**
   - Implement clean, print-ready **PDF** (matching the repo's existing PDF library) and **XLSX** exports for:
     1. **Subscriber Register** (TN Statutory Register / Delhi Form XI) — Ticket No, Subscriber Name & Address, Nominee, Ticket Value, Joining/Transfer Date, Prized Cycle.
     2. **Chit Ledger** (TN Statutory Ledger / Delhi Form XII) — Per-subscriber cycle-wise subscription, dividend, arrears, payments, and payout adjustments.
     3. **Day Book / Cash Book** (TN Statutory Day Book / Delhi Form XIII) — Chronological daily receipts, payouts, foreman commission, and running cash/bank balances.
     4. **Auction Minutes Register** — Cycle No, Date/Time, Present Subscribers, Bid History/Winning Bid, Foreman Commission, Dividend per Ticket, Prize Amount, Sign-off blocks for Foreman & Witnesses.
     5. **Bank Deposit / Security Register** (TN Form XXII / Delhi Form XIV) — Security deposit / FDR details, bank name, maturity, and lien/release status (add lightweight metadata table if not present).
     6. **Chit Agreement / Prior Sanction Summary Sheets** (TN Form I / Form VII / Form VIII printable templates pre-filled from group data).
   - Include a clear footer note on generated PDFs: *"Generated by ZoloFund for register maintenance and Registrar submission review. Verify state-specific filing requirements with your local Chit Registrar."*

---

## 5. Verification & Definition of Done

Before finishing, run and verify all of the following (fixing any failures):

1. **Database & Types:**
   - Generate and apply Prisma migration (`npx prisma migrate dev` / `npx prisma generate`) cleanly with zero schema drift.
   - Run `npm run typecheck` (or `npx tsc --noEmit`) and `npm run lint` with zero errors.
   - Run `npm run build` for Next.js to confirm clean production compilation.

2. **Automated Tests (Add Unit + Integration + E2E Tests):**
   - **Unit/Integration Tests:**
     - Arrears auto-deduction: full arrears netting, partial arrears netting, zero-net-payout edge case, FIFO oldest-cycle allocation, and double-entry balance equality.
     - Split payout: 2-tranche payout transitioning `PENDING -> PARTIALLY_PAID -> COMPLETED`, plus rejection of over-payment and duplicate `idempotencyKey`.
     - Mid-cycle migration: Cycle 8 of 20 migration generates no unpaid dues for Cycles 1–7, properly carries opening arrears into future payout netting, rejects duplicate prized cycles.
     - Denomination validator: rejects tampered `computedTotal`, negative counts, and mismatching totals when `REQUIRED`.
     - Free tier entitlement: allows 1 active chit with 50 members on Free plan; blocks 2nd active chit; allows new chit after 1st is `CLOSED`.
     - Tenant isolation test: Tenant B cannot query, payout, or export Tenant A's chit data.
   - **Playwright E2E Tests:** Add/update specs covering Quick-Add member, Cash Denomination collection, Mid-Cycle migration wizard, and Payout with arrears netting.
   - **Flutter Verification (`mobile/`):** Run `flutter pub get`, `flutter analyze`, and `flutter test` covering `chit_payment_queue.dart` idempotency + denomination serialization + contact picker logic.

3. **Final Report:**
   - Summarize every file created/modified, Prisma migration names, new API endpoints, environment/config flags added, and any manual steps needed before deploying to Vercel / Play Store.