# Web ⇄ Mobile Parity + End-to-End Test Plan
**Generated:** 2026-06-03 · **Target:** go-live in 1 week
**Scope:** every module, form, and flow. Web = Next.js admin/portal. Mobile = Flutter field app.

> **Testing tools.** Playwright drives **web only** (it cannot drive a Flutter app).
> For **mobile**, the equivalent E2E layer is **`flutter integration_test` + Patrol** (or Maestro for black-box). Every case below is written Given/When/Then so it maps to either runner. Web code samples use Playwright; mobile samples use `integration_test`.

---

## 0. How to read this

- **IN** = valid/happy path → expect success.
- **OUT** = invalid / negative / edge → expect rejection or guard.
- **Parity status:** ✅ both · 🟡 partial (field/behaviour gap) · 🌐 web-only · 📱 mobile-only · ❌ missing.

---

## 1. Module parity matrix

| Module | Web | Mobile | Status | Notes / gaps |
|---|---|---|---|---|
| Login (user/pass) | `/login` | `login_screen` | ✅ | |
| 2FA / TOTP | (web auth) | `totp_screen` | ✅ | verify both enforce after password |
| Forgot/reset password | — | `forgot_password_screen` | 🟡 | mobile has it; confirm web reset exists |
| Register tenant | `/register` | `registration_screen` | ✅ | field-diff below |
| Dashboard (admin) | `/dashboard` | `dashboard_screen` | ✅ | mobile hero = cash-today (IST) |
| Agent dashboard | `/agent-dashboard` | (dashboard role-aware) | 🟡 | web has dedicated page |
| Customers list | `/customers` | `customers_screen` | ✅ | |
| Customer create | `/customers/new` | `new_customer_screen` | ✅ | VERIFIED parity (`businessType`/`companyType` are dropdowns) |
| Customer detail/edit | `/customers/[id]` | `customer_detail_screen` | ✅ | edit is approval-gated for agents |
| Loans list | `/loans` | `loans_screen` | ✅ | branch-scope fixed (superadmin all) |
| Loan create | `/loans/new` | `new_loan_screen` | 🟡 | has `guarantorRelation`(dropdown). Gaps: **`dueDay`** (backend ready) + **`packageId`** (needs backend). Mobile adds gold/property/cheque collateral |
| Loan detail | `/loans/[id]` | `loan_detail_screen` | ✅ | heatmap both |
| Loan edit | `/loans/[id]/edit` | `edit_loan_screen` | ✅ | approval-gated |
| Collection entry | `/collection` | `collection_screen` + `quick_collect_sheet` | ✅ | mobile adds GPS, offline, QR, today/overdue split |
| Collection proof (photo/QR) | (web) | `qr_scan_screen`, proof endpoints | 🟡 | confirm web proof parity |
| Penalties | `/penalties` | `penalties_screen` | ✅ | both grouped + settle/waive + skipped heatmap |
| Approvals | `/approvals` | `approvals_screen` | ✅ | |
| KYC review | `/kyc-review` | `kyc_review_screen` | ✅ | |
| Cash Float (wallet) | `/wallet` | `wallet_screen` | ✅ | release/disburse/collect/deposit/topup both |
| Vehicles | `/vehicles`, `/new`, `/[id]` | `vehicles_screen`, `new_vehicle_screen`, `vehicle_detail_screen` | 🟡 | has `vehicleType`; `insuranceExpiry` FIXED. Gaps: **RC/insurance doc upload + `loanId` link** (need backend) |
| Chits | `/chits`, `/new`, `/[id]`, `/[id]/edit` | `chits_screen` | 🟡 | VERIFIED: mobile = view groups + members/auctions + **record auction**. **Missing: create group, add members, edit group** (web-only). Group create fields: name, chitValue, monthlyContrib, totalMembers, commissionPct, startDate |
| Accounting (base) | `/accounting` | `accounting_screen` | 🟡 | |
| Accounting premium suite (journal, CoA, tax, budget, P&L, balance-sheet, bank-rec, cashflow, trial-balance, vendors, period-lock, approvals, export, settings) | `/accounting/premium/*` (15 pages) | — | 🌐 | **web-only** — premium accounting not on mobile |
| Reports | `/reports`, `/reports/agents` | `reports_screen` | ✅ | |
| Analytics | `/analytics` | `analytics_screen` | ✅ | |
| Route tracker / GPS | `/route-tracker` | `agent_tracking_screen` (+ collections table+filters) | ✅ | |
| Notifications | `/notifications`, `/log` | `notifications_screen` | ✅ | |
| Settings | `/settings` (55 fields) | `settings_screen` + `system/penalty/payment/notification` | 🟡 | **web settings far richer — field-diff needed** |
| Subscription / billing | `/subscription`, `/admin/billing/*` | — | 🌐 | **web-only** |
| Affiliate program | `/affiliate`, `/admin/affiliates` | — | 🌐 | **web-only** |
| Branch / module requests | `/branch-requests`, `/module-requests`, `/admin/*` | — | 🌐 | **web-only** |
| Admin panel (users, team, branches, billing) | `/admin/*` | (partial: tracking) | 🌐 | **web-only** management |
| Borrower portal | `/borrower/login`, `/borrower/dashboard` | — | 🌐 | **web-only** (separate borrower app) |
| Marketing / referral | `/`, `/r/[code]`, `/portal` | — | 🌐 | web-only |
| Offline sync queue | — | `sync_status_screen` | 📱 | **mobile-only** |
| Biometric lock | — | `biometric_lock_screen` | 📱 | **mobile-only** |

---

## 2. Field-level parity — core transactional forms

### 2.1 Customer create
**Web** (`CustomerForm.tsx`): name, phone, aadharNumber, pan, email, address, routeId, agentId, profilePhoto, collectionPoints[], monthlyIncome, occupation, companyName, businessType, companyType, designation, gstNumber, companyPan, companyRegNo, companyPhone, companyEmail, companyAddress, companyLogo, documents[] (KYC).
**Mobile** (`new_customer_screen.dart`): name, phone, aadhar, pan, email, address, route(dropdown), agent(dropdown), photo, collectionPoints[], monthlyIncome, occupation, companyName, designation, gst, companyPan, companyRegNo, companyPhone, companyEmail, companyAddress, KYC docs.
**VERIFIED ✅ no gap:** `businessType`/`companyType` are dropdowns (`_businessType`/`_companyType`), route/agent are dropdowns, logo is file-picker. Earlier "gap" was a false positive from counting only `TextEditingController`.

### 2.2 Loan create
**Web** (`LoanForm.tsx`): packageId, loanType, customerId, principal, deduction, deductionType, frequency, dueDay, tenure, startDate, penaltyRate, guarantorName, guarantorPhone, guarantorAadhar, guarantorRelation, guarantorAddress, guarantorPhoto, voucherRef.
**Mobile** (`new_loan_screen.dart`): customerId(search), principal, deduction, tenure, frequency, startDate, penaltyRate, guarantorName, guarantorPhone, guarantorAadhar, guarantorAddress, voucherRef, + collateral by type: cheque(bank/number/amount), gold(grams/items), property(value/address).
**VERIFIED GAP 🟡:** mobile HAS `guarantorRelation` (dropdown). Real gaps: **`dueDay`** (v1 POST accepts it — mobile UI missing) and **`packageId`** (v1 POST does NOT accept — needs backend + picker). Mobile adds gold/property/cheque collateral web LoanForm lacks inline.

### 2.3 Vehicle create
**Web** (`VehicleForm.tsx`): customerId, loanId, registrationNo, vehicleType, make, model, year, color, engineNo, chassisNo, insuranceExpiry, rcDocPath, insurancePath.
**Mobile** (`new_vehicle_screen.dart`): registrationNo, make, model, year, color, engineNo, chassisNo (+ customer/loan link).
**VERIFIED:** mobile HAS `vehicleType` (dropdown); **`insuranceExpiry` now FIXED** (date picker added 2026-06-03). Remaining gap: **RC doc + insurance doc upload + `loanId` link** — v1 vehicles POST accepts none of these → needs backend extension + mobile upload UI.

### 2.4 Collection entry — ✅ parity (mobile superset)
Common: instalmentId, receivedAmount, paymentMode, remarks, idempotencyKey. Mobile adds GPS capture, offline queue, QR/photo proof, today/overdue split, receipt print/share.

### 2.5 Penalty settle / waive — ✅ parity
settle{amount,paymentMode}; waive{reason}. Both grouped per customer→loan, skipped-days heatmap.

### 2.6 Wallet — ✅ parity
release{agentId,amount,note}, inject{branchId,amount,note}, deposit{amount,note}; disburse/collect auto-hooked. Web + mobile both.

> **Forms still needing a field-by-field diff before launch:** Chits (new/edit), Settings (web 55 fields vs mobile split), Register, Accounting base. Run the same name=/controller diff on each.

---

## 3. Pre-launch parity gaps — priority

> **DECISION 2026-06-03:** #2 loan dueDay + #4 vehicle insuranceExpiry **DONE**. #3 packageId, #5 vehicle docs+loanId, #6 chits create/edit, #7 deep settings = **ACCEPTED WEB-ONLY** (admin/config tasks not needed by field agents on mobile). Not launch blockers. Core money flows are at parity.

> **Method note:** field counts are unreliable (dropdowns/pickers/uploads aren't `TextEditingController`). Every gap below is **read-verified** on both sides + backend.

| # | Gap | Layer | Status | Sev |
|---|---|---|---|---|
| ~~1~~ | ~~customer businessType/companyType~~ | — | **FALSE ALARM — at parity** | — |
| 2 | Loan `dueDay` (monthly/weekly due-day) | mobile UI only (v1 ready) | TODO | Med |
| 3 | Loan `packageId` (preset packages) | backend + mobile | TODO | Low (web admin convenience) |
| 4 | Vehicle `insuranceExpiry` | mobile UI | **DONE** | — |
| 5 | Vehicle RC/insurance doc upload + `loanId` | backend + mobile | TODO | Med (autofinance) |
| 6 | Chits — full form diff (new/edit/auctions/members) | both | **NOT DIFFED** | High |
| 7 | Settings — web 55 fields vs mobile 4 screens | both | **NOT DIFFED** | High |
| 8 | Register, Accounting-base — field diff | both | **NOT DIFFED** | Med |
| 9 | Web proof (photo/QR) parity vs mobile | verify | TODO | Med |
| 10 | Premium accounting/subscription/affiliate/admin/borrower | web-only by design | confirm | Info |

---

## 4. End-to-End test cases

Convention: `MODULE-NN` · each has **IN** and **OUT**. Run web on Playwright, mobile on integration_test/Patrol.

### AUTH
- **AUTH-01 Login.** IN: valid user/pass → dashboard (role-correct landing). OUT: wrong pass → error, no session; locked after N tries (rate limit).
- **AUTH-02 2FA.** IN: correct TOTP → in. OUT: wrong code → reject; brute-force >5 → 429.
- **AUTH-03 Forgot/reset.** IN: valid email → reset link → new pass works. OUT: expired/invalid token → reject.
- **AUTH-04 Register tenant.** IN: valid org+admin → tenant created, can log in. OUT: dup slug/email → reject.
- **AUTH-05 Session.** IN: refresh token (mobile) renews access. OUT: revoked/expired refresh → 401 → forced login. Biometric lock after background (mobile).
- **AUTH-06 RBAC.** IN: agent blocked from `/loans`,`/penalties`,`/wallet`,`/settings` → redirected. OUT: agent hits admin API → 403.

### CUSTOMER
- **CUST-01 Create.** IN: name+phone (+optional KYC) → created, status pending_review (agent) / active (admin). OUT: missing name/phone → validation; dup phone → handled; bad Aadhaar (non-12-digit) → reject; aadhaar stored **encrypted** (verify not plaintext).
- **CUST-02 Edit (agent).** IN: edit → creates approval request (not direct write). OUT: agent direct field write → blocked.
- **CUST-03 Branch scope.** IN: superadmin sees all branches; admin sees own. OUT: admin sees other branch customer → hidden.
- **CUST-04 Collection points / geocode.** IN: add point w/ lat/lng → saved → used for GPS geofence.

### LOAN
- **LOAN-01 Create.** IN: valid principal/tenure/freq → schedule generated, instalments created, disbursed = principal − deduction. OUT: principal≤0/tenure≤0 → reject; dup voucherRef → 409.
- **LOAN-02 Wallet hard-block (agent).** IN: agent float ≥ disbursed → loan created + float debited. OUT: float < disbursed → **402 insufficient_float**, no loan.
- **LOAN-03 Direct disburse (admin).** IN: admin loan active → branch pool debited. OUT: (branch pool may go negative — tracked, allowed).
- **LOAN-04 Edit.** IN: edit non-financial → applied. OUT: schedule change after repayments exist → blocked.
- **LOAN-05 Branch inherit.** IN: superadmin-created loan inherits customer branch (not null) → visible in branch views.
- **LOAN-06 Foreclosure / restructure.** IN: foreclose → balance settled. OUT: foreclose closed loan → reject.

### COLLECTION
- **COLL-01 Today's due.** IN: collect today instalment → instalment receivedAmount↑, daily totals↑, **agent float credited**, dashboard cash-today↑. OUT: collect > due → capped; already-paid → 409.
- **COLL-02 Overdue.** IN: collect overdue → posts to that past-due instalment (not today) → shows under overdue, not "today's collection". 
- **COLL-03 Idempotency.** IN: retry same idempotencyKey → single entry. OUT: double-submit → no double-charge.
- **COLL-04 GPS geofence (mobile).** IN: within 500m → locationStatus=verified. OUT: >500m → mismatch flag stored.
- **COLL-05 Offline (mobile).** IN: no network → queued in Isar → syncs on reconnect → server idempotent. OUT: conflicting sync → resolved once.
- **COLL-06 Receipt.** IN: print/share PDF (mobile), download (web). OUT: subscription gate off → 403.

### PENALTY
- **PEN-01 Accrual (cron).** IN: overdue instalment → penalty row, missedDays set. OUT: cron double-run → idempotent (cronLock), no double penalty.
- **PEN-02 Settle.** IN: settle ≤ net → status settled, net↓. OUT: settle > net → reject (max).
- **PEN-03 Waive (admin/superadmin).** IN: waive → all loan's pending penalties waived, reason logged. OUT: agent waive → button hidden + API 403.
- **PEN-04 Group + heatmap.** IN: same-customer same-loan combined; multi-loan swipes; tap → calendar shows skipped days.

### APPROVAL
- **APPR-01.** IN: admin approves agent request → side-effect applied (customer edit / loan / collection / cash handover). OUT: approve already-processed → "already processed"; stale edit → rejected.

### KYC
- **KYC-01.** IN: review approve → customer kycStatus updated. OUT: non-admin → 403.

### WALLET (cash float)
- **WAL-01 Release.** IN: admin releases ₹X to agent → agent float +X, branch −X, ledger+audit. OUT: amount≤0 → reject; non-admin → 403.
- **WAL-02 Top-up branch.** IN: inject ₹X → branch pool +X. OUT: unknown branch → 404.
- **WAL-03 Deposit (agent).** IN: agent deposits ≤ float → float −X, branch +X. OUT: deposit > float → 402.
- **WAL-04 Disburse debit.** (see LOAN-02/03).
- **WAL-05 Collection credit.** (see COLL-01).
- **WAL-06 Statement.** IN: ledger shows release/disburse/collection/deposit with running balance.
- **WAL-07 Branch scope.** IN: superadmin sees all branch pools + all agents; admin sees own branch only.

### VEHICLE / CHIT
- **VEH-01.** IN: create vehicle linked to loan/customer. OUT: dup registrationNo → handled.
- **CHIT-01.** IN: create group, add members, run auction. OUT: members > size → reject; auction on closed chit → reject.

### ACCOUNTING (web premium)
- **ACC-01 Journal.** IN: balanced JE posts. OUT: debit≠credit → reject; post into locked period → reject.
- **ACC-02 P&L/Balance-sheet/Trial-balance** render with correct totals (assets=liab+equity).
- **ACC-03 Tax (GSTR/TDS)** generate; mark filed. **ACC-04 Budget** variance. **ACC-05 Bank-rec** match. **ACC-06 Period-lock** blocks edits. **ACC-07 Vendors/Bills** AP overdue.

### SETTINGS / SUBSCRIPTION / AFFILIATE / ADMIN (web)
- **SET-01** save each settings group persists + reflects (penalty rate, currency, branding, channels). OUT: invalid (negative penalty) → reject.
- **SUB-01** Razorpay webhook: activated/charged/halted/cancelled → status + grace + invoice; **signature required** (no secret → 500; bad sig → 401); duplicate event → idempotent.
- **AFF-01** register affiliate, track visit/step, payout sync.
- **ADM-01** create/disable user, assign branch/route; **ADM-02** branch/module request approve.

### BORROWER PORTAL (web)
- **BOR-01** borrower login (OTP) → dashboard shows own loans/instalments. OUT: cross-borrower data → hidden.

### DASHBOARD / REPORTS / ANALYTICS / TRACKING
- **DASH-01** cash-collected-today = Σ today's collection entries (IST day); KPIs match DB.
- **RPT-01** daily/agent/overdue reports + PDF export totals reconcile.
- **TRK-01** live agent pins refresh; **TRK-02** agent detail collections table + date filters (today/7d/30d/lastmonth/custom).

### INFRA / NON-FUNCTIONAL
- **INF-01** pagination on customers/loans/penalties/collection lists.
- **INF-02** CORS preflight OK for mobile origin; **INF-03** rate limits (login/2fa/upload/webhook).
- **INF-04** upload rejects spoofed magic bytes / >5MB.
- **INF-05** secrets: missing AUTH/PII key → boot fail; **INF-06** HSTS/security headers present.
- **INF-07** cron idempotency (penalty/NPA/dunning).

---

## 5. Sample harness

### Web — Playwright (`tests/e2e/wallet.spec.ts`)
```ts
import { test, expect } from '@playwright/test';

test('WAL-01 release funds to agent', async ({ page }) => {
  await login(page, 'admin', 'admin123');           // helper
  await page.goto('/microlending/wallet');
  const row = page.locator('form', { hasText: 'Karthik' });
  await row.getByPlaceholder('Amount').fill('5000');
  page.once('dialog', d => d.accept());             // confirm()
  await row.getByRole('button', { name: 'Release' }).click();
  await expect(row).toContainText('₹5,000');        // balance updated
});

test('WAL-01 OUT non-admin blocked', async ({ page }) => {
  await login(page, 'karthik', 'agent123');
  await page.goto('/microlending/wallet');
  await expect(page).not.toHaveURL(/wallet/);        // redirected
});
```

### Mobile — integration_test (`integration_test/collection_test.dart`)
```dart
testWidgets('COLL-01 collect today due credits float', (t) async {
  await t.pumpWidget(const ProviderScope(child: ZoloFundApp()));
  await login(t, 'karthik', 'agent123');
  await t.tap(find.text('Collection')); await t.pumpAndSettle();
  await t.tap(find.text("Today's due").first); await t.pumpAndSettle();
  await t.enterText(find.byType(TextField).first, '200');
  await t.tap(find.text('Collect')); await t.pumpAndSettle();
  expect(find.textContaining('Collected'), findsWidgets);
});
```

---

## 6. Launch checklist (must-pass)
1. AUTH-01/02/06, CUST-01, LOAN-01/02, COLL-01/03, PEN-02/03, WAL-01/03, APPR-01 green on **both** apps.
2. Parity gaps #1–#4 (§3) closed or accepted.
3. `npm run build` green (type-check on ✅), `flutter analyze` clean, `prisma migrate deploy` applied.
4. INF-02/03/04/05 verified on staging.
5. Razorpay webhook (SUB-01) tested with real signature.
