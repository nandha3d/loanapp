# Web → Mobile Parity Audit

**Date:** 2026-05-29
**Scope:** Identify every feature present in the **web app** (`app/(dashboard)/[module]/…`) that is **missing or partial in the Flutter mobile app** (`mobile/lib/features/…`), document each in a per-area file, and implement the gaps **mobile-side only**.

## Ground rules (per product owner)

1. **Do NOT change the web app.** No edits to `app/(dashboard)/**`, web components, or web server actions. ✅ enforced.
2. **All calculations come from the API.** No business math is hardcoded/duplicated in Dart. Anything computed (scores, restructure rates, totals, P&L, ageing, etc.) must be returned by an `/api/v1/*` endpoint so **web, mobile, and any future client always agree**. See [11-calculations-and-architecture.md](11-calculations-and-architecture.md).
3. New mobile capabilities are delivered through **new or existing `/api/v1/*` endpoints** (adding a v1 endpoint does not change the web UI) + Flutter screens.

## How this audit was produced

- Enumerated web pages: `find "app/(dashboard)/[module]" -name page.tsx`.
- Enumerated mobile screens: `mobile/lib/features/**/*_screen.dart`.
- Enumerated the mobile API surface: `app/api/v1/**/route.ts`.
- Cross-referenced each area; depth gauged by screen size + the services/endpoints each screen calls.

> Status legend — ✅ full · 🟡 partial · ❌ missing · 🔢 calc-parity risk (math may be client-side/divergent).

## Parity matrix (high level)

| Area | Web | Mobile | Status | Detail file |
|---|---|---|---|---|
| Dashboard | KPIs, Today + Overdue collection cards, split, trend, alerts | summary + (now) swipable Today/Overdue cards | 🟡 | [04-dashboard.md](04-dashboard.md) |
| Customers | list, detail, **create (full)**, **edit (full)**, KYC, score | list, detail, create, **edit (basic – new)**, score (now parity) | 🟡 | [01-customers.md](01-customers.md) |
| Loans | list, detail, create, **edit**, restructure, statement | list, detail, create, restructure (now fixed) | 🟡 | [02-loans.md](02-loans.md) |
| Collection | grouped list, pay, overdue, cash handover, GPS | list, pay, handover, GPS | 🟡 | [03-collection.md](03-collection.md) |
| Penalties | list, settle, waive, filters | list, settle | 🟡 | [09-penalties-approvals.md](09-penalties-approvals.md) |
| Approvals | queue, approve/reject, all request types | queue, approve/reject | 🟡 | [09-penalties-approvals.md](09-penalties-approvals.md) |
| Accounting | **premium suite: journal, COA, P&L, balance sheet, trial balance, bank-rec, budget, cashflow, tax, vendors, period-lock, export, approvals** | single summary screen | ❌ (big) | [05-accounting.md](05-accounting.md) |
| Chits | list, **new, edit, detail, auctions, members** | list/detail (~) | 🟡 | [06-chits.md](06-chits.md) |
| Settings | routes, agents, branding, prefixes, SMS, receipts, KYC config, branches | partial settings | 🟡 | [07-settings.md](07-settings.md) |
| Reports & Analytics | reports, reports/agents, analytics dashboards | reports + analytics screens | 🟡 🔢 | [08-reports-analytics.md](08-reports-analytics.md) |
| KYC Review | review queue (manual/Aadhaar OTP/video) | none | ❌ | [10-kyc-vehicles-misc.md](10-kyc-vehicles-misc.md) |
| Vehicles | list, detail, **new** | list, detail | 🟡 | [10-kyc-vehicles-misc.md](10-kyc-vehicles-misc.md) |
| Subscription / Billing | plan, invoices, packages | none (packages API exists) | ❌ | [10-kyc-vehicles-misc.md](10-kyc-vehicles-misc.md) |
| Notifications | list + log | list | 🟡 | [10-kyc-vehicles-misc.md](10-kyc-vehicles-misc.md) |
| Branch / Module requests | admin approval flows | none | ❌ | [10-kyc-vehicles-misc.md](10-kyc-vehicles-misc.md) |
| Route tracker | live GPS map | agent tracking screen | 🟡 | [08-reports-analytics.md](08-reports-analytics.md) |

## Fixed in this pass (mobile + API only — web untouched)

- **Credit score parity** — `/api/v1/customers/[id]` now returns the **canonical** `calculateCreditScore` object (300–850 + grade + stats) from the shared lib; the mobile renders the same number/grade as web (was a wrong 0–100 mapping showing "74 / Medium Risk" vs web "706 / Good"). Files: `app/api/v1/customers/[id]/route.ts`, `mobile/lib/data/models/customer.dart`, `mobile/lib/features/customers/customer_detail_screen.dart`.
- **Edit Profile** — was a no-op button (`onPressed: () {}`). Now opens an **edit mode** of the customer form (prefilled; PATCHes name/phone/address/aadhaar via the existing `/api/v1/customers/[id]` PATCH). Files: `mobile/lib/features/customers/new_customer_screen.dart`, `mobile/lib/core/router/app_router.dart`, `customer_detail_screen.dart`.
- **Restructured rate** (earlier) — fixed the denominator bug and now shown in the schedule. ⚠️ This calc currently lives in Dart and must be **moved to the API** — tracked in [11-calculations-and-architecture.md](11-calculations-and-architecture.md).

## Prioritised backlog (recommended order)

1. **Calc centralisation** (P0, cross-cutting) — move restructure rate + any client math behind the API. [11](11-calculations-and-architecture.md)
2. **Loan edit** (P1) — needs a v1 PATCH for loans. [02](02-loans.md)
3. **Customer create full parity** (P1) — company/PAN fields, KYC config. [01](01-customers.md)
4. **Penalty waive + filters; approvals request-type coverage** (P1). [09](09-penalties-approvals.md)
5. **Chits create/auction/members** (P2). [06](06-chits.md)
6. **Vehicles create; KYC review queue** (P2). [10](10-kyc-vehicles-misc.md)
7. **Accounting read-only reports on mobile** (P2; full premium suite is P3). [05](05-accounting.md)
8. **Settings parity** (P3). [07](07-settings.md)
9. **Subscription, branch/module requests, notification log** (P3). [10](10-kyc-vehicles-misc.md)

Each detail file lists: web scope, current mobile scope, concrete gaps, the API endpoint(s) needed, and acceptance criteria.
