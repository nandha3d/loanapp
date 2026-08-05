# ZoloFund — Detailed User Stories & Web→Mobile Parity

**Date:** 2026-06-01
**Author:** generated from full route + feature audit (web `app/**` vs mobile `mobile/lib/features/**` vs API `app/api/v1/**`).
**Purpose:** One source of truth. Every feature in the product expressed as a user story with acceptance criteria, plus where it stands on **web** vs **mobile**, the **gap**, and **priority**. Nothing is left untracked.

> **Status legend:** ✅ done · 🟡 partial · ❌ missing · 🔢 calc-parity risk (math must come from API, never hardcoded in Dart).
> **Priority:** P0 (blocker / explicitly requested) · P1 (high) · P2 (medium) · P3 (nice-to-have).

---

## 1. Personas / Roles

| Role | Description | Primary surface |
|---|---|---|
| **Agent** | Field collector. Visits customers, records collections, KYC photos. | Mobile (primary) |
| **Admin** | Branch manager. Approves, manages loans/customers, runs reports. | Web + Mobile |
| **Superadmin** | Tenant owner. Branding, branches, subscription, team, security. | Web (primary) |
| **Developer** | Platform operator. System settings, pricing catalog, affiliate config, impersonation. | Web (primary) — **mobile ❌** |
| **Borrower** | End customer. Self-service portal, QR pay, approve payment proofs. | Borrower portal (web) + QR on printed slip |

---

## 2. Parity matrix (current, 2026-06-01)

| Area | Web | Mobile | Status | Priority to close |
|---|---|---|---|---|
| Auth (login, Google, 2FA, biometric, self-register) | ✅ | ✅ (ahead of web — Google + biometric) | ✅ | — |
| Dashboard (KPIs, Today/Overdue split, trend, alerts) | ✅ | 🟡 (cards + swipe done; trend range, alerts partial) | 🟡 | P2 |
| Customers — list/detail/score | ✅ | ✅ | ✅ | — |
| Customers — **create (collection points)** | ✅ | 🟡 → **API done, UI pending** | 🟡 | **P0** |
| Customers — create (company/PAN) | ✅ | ✅ (just shipped) | ✅ | — |
| Customers — edit | ✅ | ✅ | ✅ | — |
| Loans — list/detail/create/restructure/statement | ✅ | 🟡 (statement PDF missing) | 🟡 | P2 |
| Loans — edit | ✅ | ❌ | ❌ | P1 |
| Collection — list/pay/overdue/nearest/proof/receipt | ✅ | ✅ (nearest + proof + receipt shipped) | ✅ | — |
| Penalties — list/settle/waive/filters | ✅ | 🟡 (waive + filters missing) | 🟡 | P1 |
| Approvals — queue/approve/reject all types | ✅ | 🟡 | 🟡 | P1 |
| **Accounting premium suite** (13 sub-pages) | ✅ | ❌ (single summary only) | ❌ | P2 (big) |
| Chits — list/new/edit/detail/auction/members | ✅ | 🟡 (read-mostly) | 🟡 | P2 |
| **Settings — full tabs** (routes, penalty, packages, payment/UPI, notifications, bulk, bureau, NPA, **system**, data, security) | ✅ | 🟡 (language, routes, logout only) | 🟡 | **P0/P1** |
| **Developer — System Settings tab** | ✅ | ❌ | ❌ | **P0** |
| **Developer panel** (pricing catalog, affiliate config/rewards, impersonate) | ✅ | ❌ | ❌ | P2 |
| Reports & Analytics | ✅ | 🟡 🔢 | 🟡 | P2 |
| KYC Review (manual/Aadhaar OTP/video) | ✅ | 🟡 (screen exists, OTP/video flows missing) | 🟡 | P2 |
| Vehicles — list/detail/new | ✅ | ✅ | ✅ | — |
| Subscription / Billing | ✅ | ❌ | ❌ | P2 |
| Notifications — list + log | ✅ | 🟡 (log missing) | 🟡 | P3 |
| Branch / Module requests (admin flows) | ✅ | ❌ | ❌ | P2 |
| Affiliate marketing + tracking | ✅ | ❌ (web-only by design) | ❌ | P3 |
| Route tracker / live GPS map | ✅ | ✅ (agent tracking) | ✅ | — |
| Borrower portal (QR pay, approvals) | ✅ | n/a (separate surface) | — | — |

---

## 3. Epics & User Stories

### EPIC A — Authentication & Onboarding

- **A1** — As an **agent/admin**, I want to log in with username/phone + password so I can access my tenant. **AC:** invalid creds show error; session persists 30d; tenant slug resolved. Web ✅ · Mobile ✅.
- **A2** — As a **new business owner**, I want to self-register (5-step: details → modules → plan → add-ons → review) so I can start a trial. **AC:** pricing catalog from `/api/pricing`; referral code captured from `?ref`/field; email or Google path. Web ✅ · Mobile ✅.
- **A3** — As a **user**, I want Google sign-in so I skip passwords. **AC:** new Google user routed to registration prefilled. Web ❌ · **Mobile ✅ (ahead)**.
- **A4** — As a **security-conscious user**, I want 2FA (TOTP) and biometric app-lock. **AC:** TOTP gate after login if enabled; biometric unlock on resume. Web ✅ (2FA) · Mobile ✅ (both).
- **A5** — As an **affiliate-referred signup**, I want my referral attributed so the affiliate is credited. **AC:** `referralCode` → `Referral{status:signup}` on register. Web ✅ · Mobile ✅ (just shipped).

### EPIC B — Dashboard

- **B1** — As an **admin**, I want KPI cards (expected, collected, gap, active loans, defaulters, penalty) so I see tenant health at a glance. Web ✅ · Mobile 🟡.
- **B2** — As an **admin**, I want **separate Today vs Overdue** collection cards (total overdue till date, today collected, remaining) that reset daily. **AC:** today's instalments only counted as "today"; overdue counted separately; no merge. Web ✅ · Mobile ✅ (swipable cards).
- **B3** — As an **admin**, I want an interactive collection trend with range filter. Web ✅ · Mobile 🟡 (trend exists, range filter missing). **Gap P2.**
- **B4** — As an **admin**, I want defaulter alerts + route performance + recent activity. Web ✅ · Mobile 🟡. **Gap P2.**
- **B5** — As an **agent**, I want a personalised greeting + my-customers + hit-rate + today's pending count. Web ✅ · Mobile 🟡 (i18n keys added; wire-up pending).

### EPIC C — Customers

- **C1** — As an **agent**, I want to list/search customers with photo, code, route, paid-to-date. Web ✅ · Mobile ✅.
- **C2** — As an **agent**, I want a customer profile: contact, KYC docs, guarantors, loans, **credit score (API-computed)**. **AC:** score identical across clients (no Dart math). Web ✅ · Mobile ✅ 🔢-safe.
- **C3** — As an **agent**, I want to **create a customer** with photo, name, phone, Aadhaar, **PAN, email**, address, route, agent, **company/business block** (logo, name, type, GST, CIN, occupation, etc.), documents, guarantors. Web ✅ · Mobile ✅ (company/PAN shipped).
- **C4 (P0)** — As an **agent**, I want to add **multiple collection points** per customer (name/label, address, optional lat/lng, primary flag) so the route covers home/shop/office. **AC:** ≥0 points; each needs name+address; one primary; lat/lng optional (GPS-fillable); persisted via `/api/v1/customers` `collectionPoints[]`. Web ✅ · **Mobile: API ✅ (done) · UI ❌ (next).**
- **C5** — As an **admin**, I want to edit a customer (basic + company + collection points). Web ✅ · Mobile 🟡 (basic+company ✅; collection points UI pending with C4).
- **C6** — As an **agent**, I want a closed-loans toggle on the registry. Web ✅ · Mobile ✅.

### EPIC D — Loans

- **D1** — As an **agent**, I want a loans list: id, customer+photo, progress bar, closed-loans toggle, sort. Web ✅ · Mobile ✅.
- **D2** — As an **admin**, I want a loan detail: schedule, instalments, **restructured rate (API)**, penalties, ledger. **AC:** restructured rate = perInstalment + overdueTillDate/remainingPeriods, from `/api/v1/loans/[id]`; fractions shown (2dp). Web ✅ · Mobile ✅ 🔢-safe.
- **D3** — As an **admin**, I want to create a loan (principal, frequency, tenure, dates, charges). Web ✅ · Mobile ✅.
- **D4 (P1)** — As an **admin**, I want to **edit a loan** (terms, dates, charges) post-creation. Web ✅ · **Mobile ❌.**
- **D5 (P2)** — As an **admin/borrower**, I want a **loan statement PDF**. Web ✅ · **Mobile ❌** (needs `/api/v1/loans/[id]/statement` Bearer endpoint).

### EPIC E — Collection

- **E1** — As an **agent**, I want today's collection grouped by route. Web ✅ · Mobile ✅.
- **E2** — As an **agent**, I want to record a payment on the **clicked instalment in actual mode** (no oldest-first redistribution on write; distribution is view-only). Web ✅ · Mobile ✅.
- **E3** — As an **admin**, I want Today vs Overdue split cards on the collection screen. Web ✅ · Mobile ✅.
- **E4** — As an **agent**, I want **"Sort by nearest"** using my GPS + customer geocode (Xm/X.Xkm away). Web ✅ · Mobile ✅ (shipped).
- **E5** — As an **agent**, I want **payment proof**: photo-with-client (client approves) or QR (auto-approve). Web ✅ · Mobile ✅.
- **E6** — As an **agent/admin**, I want a **receipt PDF** per collection entry (subscription-gated). Web ✅ · Mobile ✅ (shipped).
- **E7** — As an **agent**, I want offline queueing + sync status for collections. Web n/a · Mobile ✅.

### EPIC F — Penalties

- **F1** — As an **admin**, I want a penalties list (gross, settled, waived, net) with search. Web ✅ · Mobile 🟡.
- **F2 (P1)** — As an **admin**, I want to **waive** a penalty with reason. Web ✅ · **Mobile ❌.**
- **F3 (P1)** — As an **admin**, I want status/route filters on penalties. Web ✅ · **Mobile ❌.**
- **F4** — As an **admin**, I want to settle a penalty. Web ✅ · Mobile ✅.

### EPIC G — Approvals

- **G1** — As an **admin**, I want an approvals queue across request types (customer edit, penalty waive, loan changes, payment proofs). Web ✅ · Mobile 🟡.
- **G2 (P1)** — As an **admin**, I want approve/reject **with note** for every request type the web supports. Web ✅ · Mobile 🟡 (subset).

### EPIC H — Accounting (Premium Suite) — **big gap**

Web pages: dashboard, COA, journal (+new, +detail), P&L, balance sheet, trial balance, cash flow, bank-rec (+account), budget, tax, vendors, period-lock, export, approvals.

- **H1 (P2)** — As an **accountant**, I want a premium accounting dashboard (net profit, assets, liabilities, cash, recent entries). Web ✅ · **Mobile ❌** (single summary only).
- **H2 (P2)** — Chart of Accounts: list, add/edit account, classes, sub-types, activate/deactivate. Web ✅ · Mobile ❌.
- **H3 (P2)** — Journal entries: list, new (multi-line, balanced), post/reverse/approve, detail + audit trail. Web ✅ · Mobile ❌.
- **H4 (P2)** — Financial statements: P&L, Balance Sheet, Trial Balance, Cash Flow (period filter, export). Web ✅ · Mobile ❌.
- **H5 (P2)** — Bank reconciliation: import statement, match/unmatch, create JE. Web ✅ · Mobile ❌.
- **H6 (P2)** — Budgets: create, variance vs actual. Web ✅ · Mobile ❌.
- **H7 (P2)** — Tax: GSTR-3B/1, TDS register, mark filed, challan. Web ✅ · Mobile ❌.
- **H8 (P2)** — Vendors & bills: AP lifecycle (post/pay/cancel). Web ✅ · Mobile ❌.
- **H9 (P2)** — Period lock & audit; export (Tally XML, Excel, JSON); approvals. Web ✅ · Mobile ❌.
- **i18n note:** all `pa.*` keys now translated in 6 languages (done) — UI strings ready when screens are built.

### EPIC I — Chits

- **I1** — As an **admin**, I want chit groups list + detail (members, periods, auctions, dividends). Web ✅ · Mobile 🟡.
- **I2 (P2)** — As an **admin**, I want to **create/edit** a chit group, add members, record auctions/bids on mobile. Web ✅ · Mobile ❌.

### EPIC J — Settings (multi-tab) — **P0/P1 gap**

Web tabs: **routes, penalty, packages, payment/UPI, notifications, bulk, bureau, NPA, system (developer), data, security.** Mobile currently: language, voice-assist, routes, logout.

- **J1** — As an **admin**, I want to manage **routes** (add/rename/assign agents). Web ✅ · Mobile 🟡 (add only).
- **J2 (P1)** — As an **admin**, I want **penalty config** (per-day, grace, max cap). Web ✅ · **Mobile ❌.**
- **J3 (P2)** — As an **admin**, I want **loan packages** management. Web ✅ · Mobile ❌.
- **J4 (P1)** — As an **admin**, I want **payment/UPI** settings (UPI id, QR image, receipt-PDF toggle). Web ✅ · **Mobile ❌.**
- **J5 (P1)** — As an **admin**, I want **notification** settings (SMS/WhatsApp toggles, audit log link). Web ✅ · **Mobile ❌.**
- **J6 (P2)** — As an **admin**, I want **bulk tools** (import/export). Web ✅ · Mobile ❌.
- **J7 (P2)** — As an **admin**, I want **Bureau Connect** config (provider, member id, API key/secret, SSL cert/key, go-live). Web ✅ · Mobile ❌.
- **J8 (P2)** — As an **admin**, I want **NPA classification** view (schedule, provisioning basis, RBI rates). Web ✅ · Mobile ❌.
- **J9 (P2)** — As a **superadmin**, I want **data** + **security** tabs. Web ✅ · Mobile ❌.
- **J10 (P0)** — As a **DEVELOPER**, I want the **System Settings** tab: app name, currency, currency symbol, timezone, **midnight cutoff**, **allow weekend collection**, **KYC method**, **loan code prefixes** (daily/weekly/biweekly/monthly). **AC:** developer-role-gated; reads/writes `appSettings` via a Bearer `/api/v1/settings/system` (GET+PUT); identical fields to web `system` tab. Web ✅ · **Mobile ❌ (next after C4).**

### EPIC K — Developer Panel — **mobile ❌**

Web/API: pricing catalog (plans/modules/addons CRUD), affiliate config, affiliate rewards, impersonation.

- **K1 (P2)** — As a **developer**, I want to manage the **pricing catalog** (plans, modules, add-ons + prices). Web ✅ (`/api/developer/pricing/*`) · Mobile ❌.
- **K2 (P2)** — As a **developer**, I want **affiliate config** (threshold, commission rate/months, free months) + **rewards** ledger. Web ✅ · Mobile ❌.
- **K3 (P3)** — As a **developer**, I want to **impersonate** a tenant for support. Web ✅ · Mobile ❌.
- **K4 (P0 subset)** — System settings → see **J10**.

### EPIC L — Admin Panel — **mobile ❌**

Web `app/admin/*`: affiliates, billing (+tenant, +pricing), branches, team, users, module-requests, branch-requests, settings.

- **L1 (P2)** — As a **superadmin**, I want **branch** management (create, assign superadmin). Web ✅ · Mobile ❌.
- **L2 (P2)** — As a **superadmin**, I want **team/users** management (create agents/admins, roles). Web ✅ · Mobile 🟡 (agent create inline only).
- **L3 (P2)** — As a **superadmin**, I want **billing** + invoices + plan changes. Web ✅ · Mobile ❌.
- **L4 (P2)** — As an **admin**, I want **branch-requests** + **module-requests** approval flows. Web ✅ · Mobile ❌.

### EPIC M — Reports & Analytics

- **M1** — As an **admin**, I want daily/agent/overdue reports. Web ✅ · Mobile 🟡.
- **M2 (P2)** — As an **admin**, I want analytics dashboards (efficiency, portfolio, recovery, trend) — **all figures from API**. Web ✅ · Mobile 🟡 🔢.
- **M3** — As an **admin**, I want a live GPS route tracker / agent map. Web ✅ · Mobile ✅ (agent tracking).

### EPIC N — KYC, Vehicles, Notifications, Subscription, Borrower

- **N1 (P2)** — As an **admin**, I want a **KYC review** queue with manual upload, **Aadhaar OTP eKYC**, and **Video KYC** flows. Web ✅ · Mobile 🟡 (screen + manual; OTP/video ❌). i18n keys ready.
- **N2** — As an **admin**, I want vehicle list/detail/new (auto-finance). Web ✅ · Mobile ✅.
- **N3 (P3)** — As a **user**, I want notifications list **+ log**. Web ✅ · Mobile 🟡 (list only).
- **N4 (P2)** — As a **superadmin**, I want subscription/billing view (plan, usage, invoices). Web ✅ · Mobile ❌.
- **N5** — As a **borrower**, I want the portal (QR pay, approve photo proofs). Web ✅ · Mobile n/a (separate surface, complete).

---

## 4. Prioritised implementation backlog (mobile)

**P0 — explicitly requested / blockers**
1. **C4** Customer **collection points** UI (multi-entry, lat/lng GPS, primary). _API done._
2. **J10** Developer **System Settings** screen (+ Bearer `/api/v1/settings/system` GET/PUT, developer-gated).

**P1 — high value**
3. **D4** Loan edit.
4. **F2/F3** Penalty waive + filters.
5. **G2** Approvals: full request-type coverage with notes.
6. **J2/J4/J5** Settings: penalty config, payment/UPI, notification toggles.

**P2 — medium (larger builds)**
7. **H1–H9** Accounting premium suite (phase it: dashboard → COA → journal → statements → AP/bank-rec/tax/budget → period-lock/export).
8. **J3/J6/J7/J8/J9** Settings: packages, bulk, bureau, NPA, data, security.
9. **K1/K2** Developer panel: pricing catalog, affiliate config/rewards.
10. **L1–L4** Admin panel: branches, team/users, billing, request flows.
11. **I2** Chits create/edit/auction.
12. **N1** KYC OTP/video flows. **N4** Subscription view. **D5** Loan statement PDF. **B3/B4** Dashboard trend range + alerts.

**P3 — nice-to-have**
13. **N3** Notification log. **K3** Impersonation. **Affiliate** mobile views.

---

## 5. Architecture guardrails (must hold for every story)

1. **No web changes** unless the owner explicitly requests a feature that touches web.
2. **All business math via `/api/v1/*`** — scores, restructure, P&L, ageing, NPA, totals. Never duplicate formulas in Dart (🔢).
3. New mobile capability = **new/extended `/api/v1` endpoint (Bearer) + Flutter screen + i18n keys (6 langs)**.
4. CORS for `/api/v1/*` already handled in middleware (native Dio bypasses; Flutter-web reflected origin).
5. Commit/push only when the owner asks.
