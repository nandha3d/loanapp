# ZoloFund — Engineering Reference

**Status: NORMATIVE.** This document is binding on every change to this repository, whether made by a human or an agent.
Rules are numbered (`SCOPE-1`, `MONEY-4`, `CHIT-7`, …) so they can be cited in review: *"rejected, violates SCOPE-3"*.

**Last verified against the codebase:** 2026-08-12 (branch `merged-all-branches`).

---

## 0. How to use this document

| | |
|---|---|
| **Precedence** | This file > `AGENTS.md` > `docs/**` > `.planning/**`. Where they disagree, this file wins and the other is stale. |
| **Source of truth** | The *code* is the source of truth for behaviour. This file is the source of truth for **what the behaviour must be**. If code contradicts a rule here, the code is a bug — fix the code, or change this file first with a stated reason. |
| **Before writing code** | Read §1–§5 always. Read the relevant part of §10 for any change that touches money. |
| **Changing this file** | Allowed and expected. Amend it in the same commit as the change it describes. Never let it drift silently. |

### Rules about the rules

- **DOC-1** — A change that makes a rule here false MUST update this file in the same commit.
- **DOC-2** — A new invariant discovered during debugging MUST be written down here, not just fixed in code. A bug fixed twice is a rule that was never written.
- **DOC-3** — `.planning/codebase/*.md` are auto-generated, stale, and superseded by this file. Each carries a SUPERSEDED banner. They MUST NOT be used as guidance.
- **DOC-4** — `SYSTEM_SPECIFICATION.md`, `PRODUCT_OVERVIEW.md`, `MCOLLECT_SPEC.md`, `CHIT_MODULE.md` and `docs/**` are **product/feature specs**. They describe *what to build*. This file describes *how it must be built*. Do not treat a product spec as an architecture decision.
- **DOC-5** — §18 records known deviations from these rules that exist in the code today. A deviation listed there is a **debt item, not a licence** — do not copy the pattern into new code.

---

## 1. What the system is

ZoloFund is a **multi-tenant SaaS lending platform** for Indian micro-finance operators. One deployment, one MySQL database, many tenants.

A tenant runs one or more **modules** (verticals). All six share the same database schema definitions, but **all operational data (customers, loans, accounting ledgers, collections, and field agents) is strictly isolated per module (`appType`)**: entities belong to exactly one vertical and are never shared across modules (see SCOPE-17).

| Module key | Label | Distinct machinery |
|---|---|---|
| `microlending` | Micro Lending | Daily/weekly field collection, routes, agent float |
| `autofinance` | Auto Finance | Hire-purchase (HP) terms, vehicles, dealers/brokers, repossession |
| `chitfunds` | Chit Funds | Groups, auctions, bidding, dividends, payouts |
| `goldloan` | Gold Loan | Ornament valuation, RBI LTV ceilings, pledge interest, redemption |
| `property` | Property Loan | Mortgage collateral (generic loan lifecycle) |
| `productfinance` | Product Finance | Financed goods (generic loan lifecycle) |

Canonical list: `types/modules.ts` → `ALL_MODULES`. **This is the only place modules are enumerated.**

Surfaces: **Next.js web app** (staff + borrower portals), **Flutter mobile app** (`mobile/`, field agents + borrowers) talking to `/api/v1/*`, **cron endpoints** for scheduled work, and **webhooks** for payment gateways.

---

## 2. Stack

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Framework | Next.js App Router | **16.3.0** | Not the Next.js you remember — see NEXT-1 |
| UI | React | 19.2.4 | Server Components by default |
| Language | TypeScript | 5.x | `tsc --noEmit` must be clean; build fails on type errors |
| ORM | Prisma Client | 5.22 | 113 models, `prisma/schema.prisma` |
| Database | MySQL | 8.x | Single shared DB, row-level tenant isolation |
| Web auth | NextAuth / Auth.js | 5.0.0-beta.32 | JWT strategy, credentials + Google |
| Mobile auth | `jose` HS256 JWT | — | Separate token family, see §6 |
| Validation | Zod | 4.x | |
| PDF / Excel | `@react-pdf/renderer`, `exceljs` | | Receipts, statements, report exports |
| Mobile | Flutter | — | `mobile/` |

- **NEXT-1** — This Next.js version has breaking changes from what any model was trained on. Before writing framework-level code (routing, caching, `middleware`/`proxy`, server actions, `params`/`searchParams` shapes, metadata), **read the relevant guide under `node_modules/next/dist/docs/`**. Do not write from memory.
- **NEXT-2** — The middleware entry point in this repo is **`proxy.ts` at the repo root**, exporting `proxy()` and `config.matcher`. There is no `middleware.ts`. Do not create one.
- **DEP-1** — No new runtime dependency without a stated reason in the PR description. This app runs on shared/low-resource hosting; bundle and memory cost is real.

---

## 3. Repository map

```
app/                      Next.js App Router
  (dashboard)/            Staff app — module-prefixed routes: /[module]/loans, /[module]/collection …
  (marketing)/            Public marketing pages (anonymous)
  admin/                  Developer/superadmin panel
  borrower/               Borrower self-service portal
  portal/                 Module + branch selector
  api/                    Session-authenticated web routes + infrastructure (§8)
  api/v1/                 JWT-authenticated API — mobile + the growth path
  api/cron/               Scheduled jobs (bearer-secret authenticated)
  api/webhooks/           Inbound gateway callbacks
lib/                      All business logic. Route handlers orchestrate; lib decides.
  accounting/             Double-entry GL, postings, exports (Tally/GST)
  autofinance/            HP schedule, allocation, ledger, origination terms
  chits/                  Chit groups, auctions, bidding, settlement, payouts
  gold/                   Valuation, ornaments, LTV, pledge interest, servicing
  npa/                    NPA classification, provisioning, upgrade
  reports/builders/       One file per report — ~80 report builders
  notify/                 Channel fan-out: email, sms, whatsapp, push
  api/                    v1 envelope, v1 auth, pagination, dual auth
components/               Shared React components
prisma/                   schema.prisma, migrations, seeds
tests/                    tsx + node:assert scripts (see §14)
mobile/                   Flutter app
proxy.ts                  Middleware: tenant headers, auth gate, role redirects, CORS
types/modules.ts          Module registry — single source of truth
```

- **STRUCT-1** — Business logic lives in `lib/`. A route handler or server action MUST be thin: authenticate → validate → call `lib` → shape response. If a route handler contains a formula, it belongs in `lib`.
- **STRUCT-2** — `lib/` modules MUST be usable from **both** the session-authenticated web path and the JWT-authenticated mobile path. That means: no `next/headers`, no `auth()`, no NextAuth imports inside a shared calculation module. Pass context in as arguments. (`lib/roles.ts`, `lib/branchScope.ts`, `lib/loanCalculator.ts`, `lib/chits/calculations.ts` are the reference examples — read their file headers.)
- **STRUCT-3** — Where the web action and the mobile route both perform a business operation, the operation lives in ONE shared `lib` function taking `tx` as its first argument. `placeChitBid`, `finalizeAuctionInTx`, `rescheduleAuctionInTx`, `collectChitSubscriptionPayment` are the pattern. Never fork the logic per surface.
- **STRUCT-4** — Test files live in `tests/`. `lib/foreclosure.test.ts` is a legacy exception; do not add more.

---

## 4. Request lifecycle

```
Browser / Flutter
      │
      ▼
proxy.ts  ──  /api/v1/*  → CORS (allowlist, never '*') + tenant headers, no auth here
          │
          ├─  public path?  → pass through with tenant headers
          ├─  no session?   → redirect /login?callbackUrl=…
          └─  role redirect (getRoleRedirectTarget) → or continue
      │  injects: x-zolofund-tenant-slug, x-zolofund-path,
      │           x-zolofund-active-branch, x-zolofund-host
      ▼
Route handler / Server Component / Server Action
      │  resolves context (§5): tenantId, appType, branchId, role
      ▼
lib/*  — business logic, pure where possible
      ▼
Prisma  — with the middleware guards in lib/db.ts
      ▼
MySQL
```

- **REQ-1** — `proxy.ts` performs **routing and coarse gating only**. It is never the authorization boundary. Every route handler, server action and page MUST re-authorize independently. A hand-crafted request that bypasses the browser must fail on its own merits.
- **REQ-2** — The `x-zolofund-*` headers are set by `proxy.ts` and consumed by `lib/tenant.ts` / `lib/branch.ts`. Never trust a `x-zolofund-*` header arriving from outside; never set one client-side.
- **REQ-3** — `/api/v1/*` skips the proxy's session gate by design — those routes carry their own bearer token. Adding a v1 route without `requireMobileContext()` publishes it to the internet unauthenticated.

---

## 5. The four scoping axes — the core invariant

**Every** read and write is scoped along four axes. Getting any one wrong is a data leak between paying customers.

| Axis | Column | Resolver (web) | Resolver (mobile) |
|---|---|---|---|
| **Tenant** | `tenantId` | `getCurrentTenantId()` — `lib/tenant.ts` | `ctx.tenantId` from JWT claims |
| **Module** | `appType` | `getUserAppType()` — `lib/tenant.ts` | `ctx.appType` (JWT, overridable by `X-App-Type` only for privileged roles) |
| **Branch** | `branchId` | `getActiveBranchId()` — `lib/branch.ts` | `ctx.branchId` from JWT claims |
| **Role** | — | session `role` + `isPrimaryAdmin` | JWT `role` |

### Rules

- **SCOPE-1** — Every query against a tenant-owned model MUST filter by `tenantId`. No exceptions. Not "the id is a cuid so it's unguessable" — filter by `tenantId`.
- **SCOPE-2** — Every query against a model in `SCOPED_MODELS` (`lib/scope.ts`) MUST also filter by `appType`, either directly or through a relation that is itself `appType`-filtered. A dev-only Prisma middleware in `lib/db.ts` warns when a list/aggregate on a **money-bearing** scoped model omits it. **A `[scope]` warning in dev output is a bug to fix, not noise to ignore.**
- **SCOPE-3** — Branch scoping is exactly `branchScopeWhere(branchId)` → `{ branchId }`, or `{}` when no branch is active. **A record belongs to exactly one branch: its own `branchId`.** Never widen this. Read the file header of `lib/branchScope.ts` before touching it — the previously-shipped "reach" variant (`branchId: null` OR the filer's branch) leaked records across branches in two distinct ways and was removed deliberately.
- **SCOPE-4** — Unbranched records (`branchId: null`) are visible to superadmins/developers only. An unbranched **admin** is the same defect on the user row: it never resolves to "All Branches" (`resolveUnbranchedAdminBranch`), and an admin is never saved without a branch. That is the safe failure direction. Orphans are a **data** problem, repaired by backfill scripts (`scripts/backfill-customer-route-agent.js`, then `scripts/backfill-loan-branch.js`) — never by widening a `where` clause.
- **SCOPE-5** — Agents scope by **customer linkage**, not by branch (`buildAgentCustomerAccessWhere` in `lib/loanPolicy.ts`, route assignments via `getAgentRouteIds` in `lib/access.ts`). Pinning an agent to a branch falsely hides their own customers' loans.
- **SCOPE-6** — Resolve `branchId` with `getActiveBranchId()`, never from `session.user.branchId`. The session copy goes stale when a user is moved and it ignores the superadmin branch switcher entirely. Only an explicit `'all'` selection resolves to `null` ("All Branches"): a stale, deactivated or unknown branch selection (web cookie or `X-Branch-Id`) falls back to the default/home branch, never to `null`. Failing to `null` silently turned a single-branch Settings → Data wipe into a wipe of every branch.
- **SCOPE-7** — A record is stamped with the branch of its **subject**, never its author. Resolve it with `resolveWriteBranchId(ctx, subjectBranchId)` (`lib/api/v1-auth.ts`), which tries, in order: the subject's branch (a loan's customer, a customer's route) → the caller's **active** branch → the caller's home branch → the tenant's only branch. Taking the author's branch first is what put one branch's loans in another branch admin's list: a superadmin sits on one branch and files for all of them, and since reads match the record's own branch (SCOPE-3), the branch that owned the customer lost the record entirely.
- **SCOPE-8** — Spell module scope as `{ tenantId, appType }` directly in the where-clause. There is deliberately no wrapper helper — one existed (`appScope()`) and reached zero call sites, because the plain spelling is already the shortest and most greppable. Enforcement lives in the tripwire, not in a helper.
- **SCOPE-9** — A tenant-wide sweep (cron, platform reporting) that intentionally omits `appType` MUST carry a comment saying so. Otherwise a reviewer cannot tell a deliberate sweep from the leak bug.
- **SCOPE-10** — Notification *reach* may be wider than record *visibility* (see NOTIF-4), and that asymmetry is intentional. Never justify widening a data `where` clause by pointing at notification fan-out.
- **SCOPE-11** — **Master data** may be branch-owned or published tenant-wide; use `branchOrSharedWhere(branchId)` → `{ OR: [{ branchId }, { branchId: null }] }`. `LoanPackage` is the only model on it today: a null branch means "every branch sees this product", and anything created from a branch is stamped with it. This is the sole sanctioned exception to SCOPE-4 and it applies to **catalogue rows only** — for a customer, loan, route or ledger row an unbranched record is still a defect to repair, never a feature. Split a tenant's catalogue per branch with `scripts/backfill-package-branch.js`.
- **SCOPE-12** — Anything a branch *works* is branch-scoped, not just the four headline lists. That includes the vehicle registry, the KYC review queue, the Auto Finance pending-task queues, finance partners, the agent-performance report, the routes and staff pickers in Settings, and the agent list served to mobile (`/api/v1/agents`). Each of these shipped tenant-wide once; a page that lists rows without a branch filter is the bug, and the reviewer's question is always "which branch's work is this?"
- **SCOPE-13** — Every branch-bearing row is stamped at **write** time, including staff and ledger rows. `POST /api/v1/agents` stamps `resolveWriteBranchId(ctx)`, and `applyAgent` in `lib/wallet.ts` stamps the agent's own branch on the ledger row. An unbranched agent is tenant-wide everywhere else in the app, and an unbranched wallet movement is invisible to the branch-filtered wallet view — so leaving either null silently breaks isolation in opposite directions. Repair legacy ledger rows with `scripts/backfill-wallet-branch.js`.
- **SCOPE-15** — Branch scoping has **NO role exemption**. `superadmin` and `developer` are not exempt: the active branch is already resolved before any scoping helper runs (`getActiveBranchId()` on web, `resolveScopeBranchId()` for v1), and it is `null` for "All Branches". "Sees every branch" is expressed by SELECTING All Branches, never by ignoring the selection. Any `role === 'superadmin' ? null : branchId` shape is the bug — it makes the branch switcher inert for the one role that has one. This shipped in 8 places at once (`scopedBranchWhere` in `lib/api/v1-auth.ts`, the wallet page, `buildLoanDetailWhere`, self-pay web + v1, the v1 approvals route, and chit actions); because 63 v1 routes share `scopedBranchWhere` and the dashboard reaches them through `serverFetch`, the leak was identical on web and mobile. `tests/branchScoping.test.ts` asserts every role gets the same where-clause.
- **SCOPE-16** — Every **picker, modal and detail page** is branch work too, not just lists. The customer/loan pickers on the new-vehicle form, the chit member picker, the staff picker in the vehicle seize modal, and the vehicle detail page each shipped tenant-wide, letting one branch attach a vehicle to another branch's loan or enrol another branch's customers into a chit. If a control offers rows to choose from, ask "which branch's rows?" — the answer is never "all of them" unless a branch is not selected.
- **SCOPE-14** — Moving a book of business between branches is a **data** operation, never a visibility one: re-stamp the rows with `scripts/backfill-branch-merge.js`, which moves operational rows (routes, customers, notifications, collection sheets) and re-derives `Loan.branchId` from the customer. It deliberately does **not** move `BranchCashAccount`, `WalletTransaction` or `AccountEntry` — a branch's cash pool is physical cash in a physical office, and merging two pools is a money decision taken through the wallet (MONEY-16..18), not a side effect of a data repair.
- **SCOPE-17** — **Strict module isolation: Customers, Loans, Accounting, Collections, and Agents MUST NOT be shared across modules.** Each vertical (`microlending`, `autofinance`, `chitfunds`, `goldloan`, `property`, `productfinance`) maintains completely separate operational, financial, and personnel silos under the same tenant:
  - **SCOPE-17.1 (Customers)** — A customer belongs strictly to one module (`appType`). A customer registered in one vertical does not exist in, cannot be loaned to, cannot be picked in, and cannot be enrolled in another. Uniqueness is checked per `(tenantId, appType, phone)`. Cross-module linking is rejected with `404 Not Found` or `400 Bad Request`.
  - **SCOPE-17.2 (Loans & Products)** — `Loan`, `LoanPackage`, `Instalment`, and `Penalty` records are strictly module-scoped (`appType`). A loan product created in Auto Finance cannot disburse in Micro Lending, and repayment schedules/dues are never aggregated or linked across modules.
  - **SCOPE-17.3 (Accounting & Money)** — Double-entry GL journals (`JournalEntry`), cash books (`AccountEntry`), branch office cash pools (`BranchCashAccount`), and wallet movements (`WalletTransaction`) carry `appType`. Physical float and accounting ledgers NEVER cross or consolidate between verticals.
  - **SCOPE-17.6 (Premium Accounting)** — Module-specific premium accounting reads and writes filter `appType` on journals, bank accounts, fiscal periods, vendors, bills, budgets, tax summaries, approvals, exports, and audit logs. A historical row with no reliable same-tenant module source keeps `appType: null` and is excluded from module views until reviewed. Do not infer its module from a shared chart-of-accounts code.
  - **SCOPE-17.4 (Collections)** — Daily collection sheets, collection runs (`CollectionRun`, `DailyCollection`), route beats, and `CollectionEntry` rows belong strictly to the active module. Doorstep micro-lending beats never include counter payments or dues from other verticals.
  - **SCOPE-17.5 (Agents & Field Staff)** — Field agents (`role: 'agent'`) are permanently pinned to their designated `appType` (rule AUTH-3) and cannot switch modules. Agent wallets (`AgentAccount`), float releases, and route assignments (`RouteAgent`) operate strictly within that module.
- **SCOPE-18** — `ApprovalRequest` has no `branchId`. Never spread `scopedBranchWhere()` into its `where` clause. The microlending mobile dashboard's approval feed follows the v1 approval queue: agents see only requests they filed; branch-scoped staff see ordinary requests through `requestedBy.branchId` and `loan_preclose` requests through the subject loan's branch via `precloseApprovalVisibility()`.

---

## 6. Identity & authentication

Three independent authentication families. Do not blur them.

### 6.1 Web session — NextAuth (`lib/auth.ts`)

- JWT session strategy, cookie `next-auth.session-token`, 30-day max age.
- Providers: credentials (username/phone + password, bcrypt) and Google.
- TOTP second factor when `user.totpSecret` is set (`otplib`).
- The `session` callback re-reads role/tenant/branch/module **from the database on every session read** — the JWT deliberately does not carry them. Keep it that way: it is what makes a role or branch change take effect immediately.
- `session.apiToken` carries a mobile-family token so server components can call `/api/v1/*` through `lib/api-client/server.ts`.

### 6.2 Mobile / API — `lib/api/v1-auth.ts`

- HS256 JWT, issuer `zolofund`, audience `mobile`, **1 hour** access token; opaque refresh token, 30 days, stored in `MobileRefreshToken` and **rotated on every use** (old token revoked).
- Claims: `userId`, `tenantId`, `branchId`, `role`, `appType`.
- Headers: `Authorization: Bearer <jwt>`, plus `X-Tenant-Slug`, `X-Branch-Id`, `X-App-Type`.
- The Auto Finance login-window check runs **when a token is minted** (login, 2FA, Google, refresh), not per request — bounded by the 1h token life.

### 6.3 Cron — `lib/cronAuth.ts`

- `Authorization: Bearer $CRON_SECRET`, compared with `crypto.timingSafeEqual`.
- Optional `CRON_IP_ALLOWLIST`.

### Rules

- **AUTH-1** — Every route handler MUST start with a context helper and MUST return its `response` immediately if present:
  - `/api/v1/*` → `requireMobileContext(req)`
  - `/api/*` (session) → `requireApiContext([...roles])` from `lib/apiAuth.ts`
  - server actions → `withActionAuth([...roles], fn)` from `lib/serverActionAuth.ts`
  - `/api/cron/*` → `authorizeCron(req)`
- **AUTH-2** — Never hand-roll session parsing, `getToken()` calls, or bearer parsing in a route. If a helper does not fit, extend the helper.
- **AUTH-3** — `X-App-Type` may switch the active module **only** for `superadmin`, `developer`, `admin`. Everyone else is pinned to their JWT `appType`. This is enforced in `requireMobileContext`; do not re-implement it.
- **AUTH-4** — Secrets are read from env at call time (`MOBILE_JWT_SECRET` → `NEXTAUTH_SECRET` → `AUTH_SECRET`). Never hardcode, never log, never return a secret in a response body.
- **AUTH-5** — Login and other abuse-prone endpoints MUST go through `checkRateLimit()` (`lib/rateLimit.ts`, MySQL-backed) with the `loginIpKey` / `loginUserKey` / `routeKey` helpers.

---

## 7. Authorization

### 7.1 Role hierarchy — `lib/roles.ts`

```
agent (10)  <  admin (20)  <  primary admin (30)  <  superadmin (40)  <  developer (50)
```

- **"Primary admin" is not a role string.** It is `role: 'admin'` + `isPrimaryAdmin: true`. This was chosen so that ~250 existing `role === 'admin'` guards keep admitting primary admins.
- **ROLE-1** — Compare privilege with `roleRank()`, `canManageUser()`, `canManageAdmins()`, `isPrimaryAdmin()`. Never invent a new rank table or a new role string.
- **ROLE-2** — `canManageUser()` requires **strictly greater** rank. Peers can never edit each other. Do not relax this to `>=`.
- **ROLE-3** — Adding a role means editing `lib/roles.ts` and auditing every `role ===` comparison. Prefer a capability flag on `User` (as with `bypassLoanApproval`, `autoReleaseFloat`) over a new role.
- **ROLE-6** — **Developer credentials isolation in user management**: Developer accounts (`role: 'developer'`) represent platform-level administration above the tenant boundary. They MUST NEVER be shown, listed, returned, or manageable by `superadmin`, `admin`, or `agent` in any user management view or API (including `/api/v1/admin/users`, `/admin/users`, mobile `Team / Agents`, or staff pickers). Only authenticated users with role `developer` themselves may see or manage developer accounts. If the caller's role is not `developer`, user queries MUST filter out developer accounts (`role: { notIn: ['developer', 'DEVELOPER'] }`), and mutation endpoints MUST refuse modification of developer accounts with `403 Forbidden`.

### 7.2 Agent restrictions

Agents are field staff on shared devices. They may: create customers (pending review), view their route's collection schedule, submit collections, originate loans **if** `bypassLoanApproval` is set. They may not: edit or delete customers, see the dashboard/reports/penalties/settings/accounting/analytics, or switch modules. Agents may not access the `/penalties` page, but may collect a penalty (settle) and request a penalty waiver from the loan detail page (DEC-06); they never waive.

- **ROLE-4** — `AGENT_BLOCKED` in `proxy.ts` is a **redirect convenience, not a security control**. Every blocked capability MUST also be refused server-side by the handler.
- **ROLE-5** — Agent permission toggles (`bypassLoanApproval`, `autoReleaseFloat`) MUST NEVER gate non-agent users. Non-agents keep full privilege unconditionally — see the explicit branch in `app/api/v1/loans/route.ts`.
- **ROLE-7** — **Payment edit and collection correction permissions**: Field agents (`role: 'agent'`) MUST NEVER directly alter, edit, or delete existing recorded collections or instalment payments. Any payment modification by an agent requires an `ApprovalRequest` (`requestType: 'edit_collection'`) stating `requestedAmount` and a mandatory `reason`, pending review by `admin` or `superadmin`. Administrators (`role: 'admin'`, `superadmin`, `developer`) hold direct privilege to correct/update instalment payment totals (`correctInstalmentPayment`). Direct admin edits do not require approval and adjust the instalment's `receivedAmount`, synchronize ledger/collection records, and trigger `reallocateLoanRepayments`. Payment corrections (by admin or upon approval of agent requests) bypass the `already_paid: Instalment is already fully collected` submission block designed for new collection submissions.
- **ROLE-8** — **Agent loan origination: direct vs request (DEC-04)**: When creating a loan, field agents (`role: 'agent'`) without `bypassLoanApproval` create loans in status `pending_review` (generating an approval request and notifications to approvers). Agents with `bypassLoanApproval: true` and all administrative roles create loans directly in status `active`. UI presentations on web and mobile MUST reflect this capability: display "Request loan" (and request titles/messages) when `bypassLoanApproval` is false for an agent, and "New loan" when true or for non-agents. Upon creating a loan in `pending_review` status, clients navigate to approvals rather than the loan view.
- **ROLE-9** — **Manual KYC status (D5, CUST-06)**: `admin`, `superadmin` and `developer` may set a customer's `kycStatus` directly from the customer edit form (web and mobile). Setting it to `verified` stamps `kycVerifiedById`/`kycVerifiedAt` and is audited with the edit. Agents can never set it — not directly, and not through a `customer_edit` request (the server drops the field).

### 7.3 Module gating

- Enabled modules resolve per **branch** and per **user** (`getActiveModules()` → `getBranchEnabledModules` / `getUserModulesForBranch`).
- **MOD-1** — A module-specific route or action MUST call `assertModuleEnabled(module)` (`lib/moduleGate.ts`). Rendering a hidden nav item is not gating.
- **MOD-2** — Adding a module means updating `ALL_MODULES`, `MODULE_LABELS`, `MODULE_SLUGS`, `MODULE_ROUTES` in `types/modules.ts` — and nothing else may hardcode a module list.
- **MOD-3** — Staff URLs are module-prefixed: `/[module]/loans`. Build them with `modulePath()` / `prefixDashboardHref()`; parse them with `parseModulePath()`. Never string-concatenate a module route.

### 7.4 Plan-bundled features — `lib/planFeatures.ts`

Premium capabilities (KYC, preclose, receipt PDF, WhatsApp/SMS, GPS, bureau, eNACH, premium accounting, NPA) are **bundled into subscription plans**, not sold as add-ons.

- **PLAN-2** — Which plan includes which feature is data: `SubscriptionPlanCatalog.includedFeatures` (JSON array of keys), edited in Developer → Billing → Pricing. Code holds only the key ↔ `TenantSubscription` flag mapping (`PLAN_FEATURES`). `NULL` = unconfigured: activating the plan leaves flags alone.
- **PLAN-3** — On every plan activation (webhook, `/api/subscribe/confirm`, simulated/mock upgrade, Developer form, registration, downgrade) the tenant's flags are recomputed with `planFeatureUpdate()`. A paid plan's checklist is the whole truth; the Developer's per-tenant toggles apply only to the Free plan (demo) and plans with no checklist.
- **PLAN-4** — `TenantSubscription.grandfatheredFeatures` holds extras a live tenant had before bundling. They survive renewals on the same plan and are cleared on any plan change.
- **PLAN-5** — eNACH is gated by `nachEnabled` (`nachGate()` in `lib/featureGate.ts` on every `/api/v1/nach/*` route, the `nach-present` cron, and the loan-detail panel). No grandfathering.
- **PLAN-6** — Add-ons are no longer sold: registration ignores client-sent add-ons, the pricing APIs return `addons: []`, and `/api/v1/billing/{addon-checkout,verify-addon-payment}` return 410. `AddonCatalog` data is kept.
- **PLAN-7** — Free is a permanent plan (no paywall, no trial clock). An unpaid expired trial is moved to Free by `downgradeToFree()` (lazily in `getSubscription`/`assertTenantSubscriptionAccess`, and by `/api/cron/trial-expiry`). Cancelled/expired/lapsed *paid* subscriptions still hit the paywall.
- **PLAN-9** — A feature locked by the plan must lead somewhere. Mobile: `showPlanUpgradeSheet()` is the single sheet for every lock, and it is role-aware — superadmin gets "View plans" (`/microlending/subscription?feature=<key>`) and "Open on web" (`/<module>/subscription?feature=<key>#feature-<key>`), admin gets "View plans" only, every other role is told to ask the account owner (this mirrors the route guards: web `/subscription` is superadmin-only, mobile `/microlending/subscription` is superadmin/admin/developer). Features hidden when locked (preclose, receipt PDF, WhatsApp/SMS, customer KYC) show a `PlanLockBadge` entry that opens the same sheet. Both subscription pages take an optional `?feature=` that highlights that card; no param = the unchanged page. The "included in <plan>" name is server-computed (`cheapestPlanByFeature()`, returned as `featurePlans` by `GET /api/v1/admin/billing`) — clients never derive it (STABLE-8). No API gating changes: only eNACH has a 403 gate (PLAN-5).
- **PLAN-8** — Plan limits are reconciled by `reconcilePlanLimits()`: over the limit, the earliest-created branches/agents stay and the rest become `plan_locked` (reversible, never deleted; owners never locked); on upgrade the earliest are unlocked. Loans are never locked — `checkLimit` only refuses *new* ones. Trial length comes from `trialDays`, defaulting to `DEFAULT_TRIAL_DAYS`.
- **PLAN-10** — The superadmin profile's subscription block (`getSuperadminProfile()`, `GET /api/v1/profile`) shows what the tenant is actually billed, worked out on the server exactly as the web My Subscription page does, and clients render it (STABLE-8): `planPrice` = the plan's catalog yearly price when `billingCycle` is yearly and a yearly price exists, else its monthly price; `expiry` = `{ kind: trial|renewal|none, date }` (trial end only while plan is `trial`, else `currentPeriodEnd`); each `addOns[]` carries `featureKey` and, when locked, `includedIn` (`cheapestPlanByFeature()`). The stored `pricing.totalMonthlyPrice` multiplies the plan price by the vertical count and is **not** what is billed — never show it as the price. `usage.activeLoans` counts **open** loans (`active` + `overdue` — the penalty cron flips a loan to `overdue`, it is still live; counting `active` alone under-reported). `addOns[]` is generated from `PLAN_FEATURES`, never a hand-kept list. `usage.limitInfo` = `{ max, unlimited }` per limit is the language-neutral twin of the English `usage.limits` strings; mobile localises it. Mobile's profile screen renders these and links to the in-app plans screen (`/microlending/subscription`) and the web subscription page; tapping a locked feature opens `showPlanUpgradeSheet()` (PLAN-9).
- **PLAN-11** — A superadmin creates branches directly, within the plan: `createTenantBranchFor()` (`lib/branches.ts`) is the only create path (web Settings and `POST /api/v1/admin/branches`) and enforces the subscription state, `maxBranches` over *active* branches, a unique code per tenant, and that a branch's `enabledModules` are a subset of the plan's. `getBranchCapacity()` (`GET /api/v1/admin/branches/capacity`) returns the used/limit/`canCreate`/`remaining` figures and the plan's module list for the form — mobile renders them and never counts branches itself (STABLE-8). Mobile `/microlending/branches` (superadmin only) is the create/edit screen with name, code, phone, address and module picker; `/microlending/branch-requests` redirects there for old links. The branch-request flow (web `/branch-requests` + `/admin/branch-requests` pages and their server actions, mobile review screen) is removed; `BranchRequest` rows are kept as history only. Mobile no longer has a superadmin Module Requests screen (developer review stays at `/admin/module-requests`). Branch edits always send the address (the update replaces it).
- **PLAN-12** — "View plans" lists **every active plan**, not only the tenant's own. `GET /api/v1/admin/billing` returns `plans[]` built by `buildPlanCatalogView()` (`lib/planCatalogView.ts`) from `SubscriptionPlanCatalog` — price, limits, bundled feature keys, bullets, `includesPlan`, `isCurrent` and the `unlimited` flags are all catalog/server values; the only client choice is monthly vs yearly view. `yearlyPrice` is non-null only when yearly can really be charged (price **and** Razorpay yearly plan), `yearlySavingsPercent` is server-computed. Mobile (`TenantBillingScreen`) renders these and sends the superadmin to the web subscription page to pay (Razorpay checkout stays web-only); admin sees the plans read-only. A server that omits `plans` hides the section.

---

## 8. API contracts

Two API namespaces coexist under `app/api/`. They are **not** two competing implementations of the same thing — there is exactly one origination path, one collection path, and one chit-bid path, all shared through `lib/` (STRUCT-3). The split is by **authentication family**:

| | `/api/v1/*` — JWT (canonical) | `/api/*` — session + infrastructure |
|---|---|---|
| Auth | Bearer JWT — `requireMobileContext` | NextAuth session — `requireApiContext` |
| Success | `{ data, error: null, pagination }` via `ok()` | `{ success: true, data }` via `apiSuccess()` |
| Failure | `{ data: null, error, pagination: null }` via `fail(msg, status)` | `{ success: false, error }` via `apiError()` |
| Paging | offset (`?page&limit`) **or** cursor (`?cursor&limit`) | offset |
| Routes | 196 | 90 |

**Permanent** `/api/*` namespaces — these are infrastructure and will never move to v1: `auth/`, `cron/`, `webhooks/`, `health/`, `files/`, `upload/`, `borrower/`, `register/`, `host/`, `portal/`, `developer/`, `debug/`, `backup/`, `export/`, `affiliate/`.

**Frozen** `/api/*` namespaces — a v1 equivalent exists; these are read/maintenance surfaces for the web app only: `loans/`, `customers/`, `collection/`, `penalties/`, `packages/`, `instalments/`, `reports/`, `dashboard/`, `notifications/`, `settings/`, `routes/`, `approvals/`, `receipts/`, `pricing/`, `kyc/`, `gps/`, `users/`, `bureau/`.

### Rules

- **API-1** — New endpoints go under `/api/v1/*` with the envelope, unless they belong to a **permanent** namespace above. Do not add a new resource under a frozen namespace.
- **API-2** — Never construct a v1 response by hand. Use `ok()` / `fail()` from `lib/api/v1-envelope.ts`, so the mobile client's single decoder keeps working. An error that must carry figures for the client (the FUND-2 `409`) uses `failWithData(msg, status, data)` — same envelope, `data` populated.
- **API-3** — Cursor pagination uses `parseCursorPaging()`, fetches `limit + 1`, and returns `nextCursor: null` at end of stream. Offset limits are clamped (max 100–200). Never return an unbounded list.
- **API-4** — HTTP status codes carry meaning and the mobile app branches on them: `400` invalid input, `401` unauthenticated, `403` forbidden/feature-not-enabled, `404` not found *or not in scope*, `409` conflict (duplicate voucher/registration, insufficient float, accounting misconfiguration), `500` unexpected. Do not return `200` with an error string.
- **API-5** — Out-of-scope records return `404`, never `403`. Do not confirm the existence of another tenant's data.
- **API-6** — CORS for `/api/v1/*` reflects an origin from a strict allowlist (`lib/cors.ts`). **Never `*`.**
- **API-7** — Any change to a v1 response shape MUST be reflected in `mobile/` in the same PR, and covered by `npm run test:mobile-parity-api`.
- **API-8** — A frozen-namespace route and its v1 counterpart MUST delegate to the same `lib` function. If you find business logic duplicated between the two, that is a bug: extract it, do not patch both.

---

## 9. Data layer

### 9.1 Prisma

- Single client singleton, `lib/db.ts`. **DB-1** — Import `prisma` from `@/lib/db`. Never `new PrismaClient()` anywhere else.
- Naming: models PascalCase, fields camelCase mapped to snake_case via `@map`/`@@map`, named relations for multiple FKs to the same model.
- Connection pool is tuned via `DATABASE_URL` query params (`connection_limit`, `pool_timeout`) — the Prisma default is too high for shared hosting.

### 9.2 Guards enforced in `lib/db.ts` — do not remove

- **DB-2** — `NpaHistory` is **immutable**: update/delete throw `IMMUTABLE_RECORD`. RBI audit trail.
- **DB-3** — `LoanProvisioning` may not be deleted (updates allowed for same-day cron upserts).
- **DB-4** — The dev-only `appType` tripwire (see SCOPE-2) is a debugging aid. It never throws and is skipped in production; do not "fix" a warning by disabling the middleware.

### 9.3 Transactions

- **DB-5** — Anything that moves money MUST be a single `prisma.$transaction`. Loan origination is the reference: contract number, loan, schedule, collateral, guarantors, vehicle, wallet debit, cash-book entry, GL journal and audit log all commit or all roll back.
- **DB-6** — Origination runs at `isolationLevel: 'Serializable'`. Keep it. It is what makes the contract-sequence increment and the float check race-free.
- **DB-7** — Inside a transaction, pass `tx` down. A `lib` function that participates in a transaction takes `tx: Prisma.TransactionClient` as its first argument (`postLoanOrigination`, `disburseFromAgent`, `nextContractCode`, `finalizeAuctionInTx`, `placeChitBid`). Never reach for the global `prisma` inside a transaction.
- **DB-8** — Validation that can fail MUST run **before** side effects, and security-critical validation MUST be **re-run inside** the transaction against fresh reads (gold LTV exposure is re-validated inside the tx precisely because concurrent originations would otherwise breach the ceiling; the live auction room re-reads its own row before closing so two requests cannot double-close).

### 9.4 Idempotency and duplicate suppression

Money paths are retried — by mobile clients on flaky networks, by cron re-runs, by users double-tapping. Every one of them needs a duplicate guard, and the guard must be one the **database** enforces.

- **DB-9** — Prefer a UNIQUE constraint over a read-then-write check. Two concurrent callers can both pass a `count() === 0` check; only the database can arbitrate. Existing constraints: `JournalEntry.dedupKey`, `ChitBid(auctionId, idempotencyKey)`, `ContractSequence(tenantId, appType, prefix)`, `LoanProvisioning(loanId, snapshotDate)`.
- **DB-10** — GL dedup keys are built by `buildDedupKey(sourceType, tenantId, sourceId)` (`lib/accounting/postingKeys.ts`) — never by string template at the call site, or the two posting paths for the same event produce different keys and both post. Catch the violation with `isDuplicateJournalEntry(e)` and return quietly; it means the work was already done.
- **DB-11** — Collection writes dedup on `buildCollectionIdempotencyKey()` (§10.3). Chit prize payouts dedup on the existing `AccountEntry` for the auction.

### 9.5 Money representation

- **DB-12** — Money columns are Prisma `Decimal`. Convert with `Number()` at the boundary; never do arithmetic on the Decimal-as-string.
- **DB-13** — Round to 2 decimals at posting boundaries (`round2` in `lib/accounting/originationPosting.ts`, `roundMoney` in `lib/chits/calculations.ts`). Rupee-level rounding remainders in a loan schedule are absorbed by the **final** instalment (`distributeInstalmentAmounts`), never spread. In chit dividends the remainder is not absorbed at all — it is recognised as foreman income (`roundingIncome`, see CHIT-3).

### 9.6 Migrations

- **DB-14** — Schema changes ship as Prisma migrations (`npm run db:migrate` locally, `npm run db:deploy` in production). `db push` is for local scratch only.
- **DB-15** — Migrations MUST be backward-compatible with the running release: add nullable, backfill, then tighten in a later migration. There is no maintenance window.
- **DB-16** — New columns on a model in `SCOPED_MODELS` that carry money or customer data MUST be considered for `tenantId`/`appType`/`branchId` denormalisation, matching the model's existing columns.

---

## 10. Domain logic

> This section is the part most often got wrong. Every rule here exists because something broke.

### 10.1 Loan products & interest — `lib/loanCalculator.ts`

| `interestType` / `deductionType` | Behaviour |
|---|---|
| `upfront_fixed` | Flat amount deducted at disbursal; `totalPayable = principal` |
| `upfront_percentage` | Percentage of principal deducted at disbursal; `totalPayable = principal` |
| `emi_flat` | Flat interest added; `totalPayable = principal + principal × rate%` |
| `emi_floating` | Reducing-balance EMI |
| `interest_only` | Monthly dues are **interest only**; principal is a bullet settled at closure |

- **MONEY-1** — All schedule generation goes through `calculateLoanPreview()`. Never inline a schedule formula in a route, action or component.
- **MONEY-2** — `interest_only` is opt-in **per tenant** (`isInterestOnlyEnabled`, AppSetting `interest_only_enabled`). Enforce it server-side in every entry path — the web form is only one of several ways into origination.
- **MONEY-3** — `interest_only` requires `frequency: 'monthly'`; the quoted rate is per month. Reject anything else rather than silently billing a monthly figure daily.
- **MONEY-4** — Branch on `isInterestOnly(type)`, never on the string literal. Schedule shape, auto-close and outstanding-principal maths all differ.
- **MONEY-5** — `interest_only` loans persist `interestRate` and `outstandingPrincipal`; every other model persists only the computed result. Interest is recomputed on prepayment.
- **MONEY-19** — **The term shape is a second axis, independent of the interest model.** `Loan.termType` is `scheduled` (n instalments at `frequency`, the shape every loan had before the column existed) or `bullet` (one payment `termDays` after the start date). It defaults to `scheduled`, so an omitted field and an old payload produce byte-identical output. Branch with `isBulletTerm(type)`, never the string literal.
- **MONEY-20** — A `bullet` term admits only `upfront_fixed`, `upfront_percentage` and `emi_flat` (`BULLET_INTEREST_TYPES`). `emi_floating` is an annuity over n periods and degenerates at n=1; `interest_only` bills a monthly rate and has no meaning over a term of days. Both are rejected at `calculateLoanPreview`, and the tenure of a bullet loan is always 1. Bullet is opt-in per tenant (`bullet_term_enabled`, CFG-2), enforced server-side in `/api/v1/loans` — the web form is one of several ways in.

### 10.2 Origination — `app/api/v1/loans/route.ts` (the only path)

Order of operations, all inside one Serializable transaction:

1. `nextContractCode(tx, …)` — upsert-increment on `ContractSequence`, keyed `(tenantId, prefix)`, followed by a collision guard. Frequency prefixes `DL`/`WL`/`BWL`/`ML`, falling back to the tenant's `loanCodePrefix`.
   - **ORIG-1** — The counter is **tenant-wide, never module-scoped**, because `Loan.loanCode` is unique on `(tenantId, loanCode)` with no `appType` axis. A sequence key MUST be a prefix of the uniqueness it feeds. This is a deliberate, documented exception to SCOPE-8. `ContractSequence.appType` still exists but is **informational only** — it records which module first created the counter. Never filter, upsert or key on it; doing so re-creates the per-module counter that caused the outage. `tests/contractNumber.test.ts` asserts the key shape.
   - **ORIG-2** — The increment runs inside the origination transaction, so a failed loan insert rewinds the counter with it. A code collision is therefore **permanent, not transient**: every retry re-requests the same taken code and origination stays wedged. Because of that, `nextContractCode` treats the counter as a **hint, not truth** — it checks whether the code it produced is already taken and, if so, steps forward to the first free code and parks the counter there. Never "just retry" an origination unique-constraint failure, and never remove that guard: it is what makes a counter that has fallen behind self-healing rather than fatal.
   - **ORIG-3** — Introducing or re-keying a sequence table MUST ship a backfill in the same migration, seeding `current_value` from `MAX()` of the numeric suffix of existing codes. `contract_sequences` originally shipped without one, defaulted to 0, and reissued `DL00001` on top of live loans. Note that prod deploys run `prisma db push`, not `migrate deploy` (see DEPLOY-4), so a migration's data steps do **not** run there — ship them as a script and run them by hand.
   - **ORIG-4** — A schema change that reaches production through `db push --accept-data-loss` MUST NOT require a destructive DDL. Widen a column to `NULL` and leave it unused rather than dropping it; a dropped column on a live database is unrecoverable and the flag makes it silent. Retiring a column is a separate, deliberate operation.
2. Re-validate module-specific policy against fresh reads (gold LTV exposure).
3. Create guarantors, loan + instalments, security cheques.
4. Write the audit log row.
5. Create collateral: gold/ornaments, property, product, HP detail + vehicle + photos.
6. **Wallet debit** — only cash legs move physical float.
7. **Cash-book entries** (`AccountEntry`, one per payout leg).
8. **GL journal** (`postLoanOrigination`), gated on the tenant's statutory-accounting subscription.

- **MONEY-6** — Cross-entity references supplied by the client (broker, dealer, customer, vehicle) MUST be re-fetched with a `tenantId` filter before use. A crafted id must not link a loan across tenants.
- **MONEY-7** — Uniqueness that the user can collide on (voucher ref, vehicle registration) is checked early for a clean `409`, **and** protected by a DB constraint. The early check is UX; the constraint is correctness.
- **MONEY-8** — Loan status is `pending_review` unless approval is bypassed; `pending_review` loans disburse nothing and notify approvers via `notifyApprovers()`.
- **MONEY-9** — Terms are snapshotted onto the loan at origination (`termsSnapshot` `HP_TERMS_V1`, `policySnapshot` `RBI_GOLD_SILVER_2025_V1`). Policy and rate changes MUST NOT retroactively alter an existing contract. Bump the version string when the snapshot shape changes.
- **MONEY-31** — **Single payment is a bullet (D3, LOAN-02)**: `frequency: single_payment` is always stored as `termType: bullet` with `termDays` = whole days from `startDate` to `endDate` when the client omits it (`resolveTermShape` in `lib/loanCalculator.ts`, used by `POST /api/v1/loans` and `/api/v1/loans/calculate`), so web and mobile produce the same shape and the `BTL` prefix. Both clients list Single payment, Bullet (feature `bullet_term_enabled`) and Custom duration under a "Custom loans" group.

### 10.3 Repayment allocation — `lib/repayments.ts`

- **MONEY-10** — Loan-level fill order is **today's due first, then overdue oldest-first, then future soonest-first** (`orderInstalmentsForCollectionFill`). Paying today's amount keeps today clean even when a backlog exists. This applies exclusively to collections received on the current business date (`cToday`). Prior historical collections (`cYesterday`) strictly settle past dues chronologically.
- **MONEY-22** — **No Historical Spillover to Today's Due or Future Instalments**: In-memory payment distribution (`getDistributedInstalmentsAndMetrics`) strictly partitions lifetime collections into historical collections (`cYesterday = cTotal - cToday`) and collections received on today's business date (`cToday`).
  1. `cYesterday` belongs exclusively to past-due instalments (`dueDate < today`). It MUST NOT spill forward into today's due date (`dueDate === today`) or future instalments (`dueDate > today`), even if lifetime collections exceed all past arrears.
  2. Today's instalment (`dueDate === today`) can ONLY receive allocations from collections actually received on today's business date (`cToday`).
  3. When `cToday == 0`, today's instalment MUST strictly remain unpaid (`receivedAmount: 0`, `outstandingAmount: dueAmount`, `status: 'due today'` / `'upcoming'`) on Collection Entry, Collection Worklists, and Dashboards.
  4. Only actual collections recorded on today's business date (`cToday > 0`) can populate today's `receivedAmount` (via priority fill per MONEY-10).
- **MONEY-11** — Instalment status is derived, never hand-set: `paid` / `partial` / `missed` / `upcoming` / `waived`. Loan status is derived by `resolveLoanStatus()`.
- **MONEY-12** — Schedules MUST NOT be modified once `hasFinancialActivity(loanId)` is true.
- **MONEY-13** — Collection writes are idempotent through `buildCollectionIdempotencyKey()` — `(tenantId, agentId, instalmentId, amount, mode, date)`. A retried mobile submission must not double-post. Never bypass it.
- **MONEY-21** — **Collection submission vs Payment correction**: `submitCollectionEntry` records new incoming collections and is strictly blocked on fully collected instalments by `getCollectionSubmissionBlockReason`. Modifying or correcting existing payments MUST use `correctInstalmentPayment` / `correctInstalmentPaymentInTx`, which updates the instalment amount, records a ledger adjustment for the delta, and executes `reallocateLoanRepayments` inside a transaction. Never call `submitCollectionEntry` inside a transaction or for a payment correction.
- **MONEY-23** — Mobile Micro Lending collection cards group dues by `loanId`, because `QuickCollectSheet` submits against one loan. The card amount must match the dues preloaded by that sheet; never add two loans under one customer card. Cadence labels use `Loan.frequency`, and dates beside collection actions use the persisted `Instalment.dueDate`. The existing `/api/v1/collection/today` cadence-day worklist remains unchanged.
- **MONEY-24** — **Collection Idempotency at Payment Request Level**: Replayed collection submissions with the same client `idempotencyKey` and `tenantId` return the existing recorded payment and instalment details immediately, preventing duplicate money movement or re-targeting subsequent instalments.
- **MONEY-25** — **Cash Handover Atomic Settlement**: Approval of a `cash_handover` request executes `collectFromAgentInTx` inside the approval transaction, atomically debiting the agent's cash float with a hard block, crediting the branch pool, locking `DailyCollection` as `settled`, and approving the request. If the agent float is insufficient, the transaction fails completely.
- **MONEY-26** — The dashboard's `todayCollected` measures money applied to today's scheduled instalments, capped by each instalment's due amount. Collections received today against overdue or future instalments are included separately in `cashCollectedToday` (all payment modes despite its legacy name). Web and v1 use `getTodayDueMetrics` after repayment distribution and the same `businessTime` day boundary; that total must not replace the due-progress KPI. Collection Entry (`/api/v1/collection/dashboard`) follows the same rule: past dues cleared today stay in its list but count only toward overdue recovered-today, never the Today card. Its overdue rows are the distributed rows with `overdueAmount > 0` (never a raw `status` filter), and its per-route cards come from `collectionSummaryByRoute`, built by the same `summarizeCollectionWorklist`, so routes sum to the all-routes card.
- **MONEY-27** — Staff web and v1 dashboards derive `currentCapital` and lifetime collections from the same tenant/module/active-branch cash-book entries, and `totalDisbursed` from gross loan principal. Net cash disbursed and `Loan.totalCollected` are different measures and must not replace those headline KPIs on one surface.

#### Micro Lending agent preclose requests

- **PRECLOSE-1** — `agent_preclose_requests_enabled` is a per-tenant opt-in, default off. Only `microlending` agents may submit `loan_preclose` approval requests, and only for linked customers' active/overdue, non-interest-only loans. The direct preclose endpoint continues to reject agents.
- **PRECLOSE-2** — A request stores the full current outstanding amount (`totalPayable - totalCollected`, rounded to paise), payment mode, remarks and reason. Filing or rejecting it never records a payment or closes the loan. An admin/superadmin (or existing developer reviewer) approves the specific settlement; it is not a reusable permission grant.
- **PRECLOSE-3** — Review visibility follows the subject loan's own branch, never the requester's branch. Review rechecks tenant, module, active branch, loan status and current balance. A stale request must be rejected and resubmitted; approval must not silently substitute another amount.
- **PRECLOSE-4** — Request creation serializes on the loan row; review atomically claims a pending request and performs the existing settlement and audit within one transaction. Direct Micro Lending preclose and approval execution lock the same loan before reading unpaid dues. Notifications run after commit. No request may settle twice.
- **PRECLOSE-5** — `lib/loanPreclose.ts` holds the existing settlement implementation shared by direct admin preclose and approved requests. Its allocation/accounting behavior is preserved; no interest-only principal servicing or other module gains an agent preclose path. The frozen legacy `/api/approvals` handlers do not expose or process this new request type.
- **PRECLOSE-6** — **Settlement Date Anchoring**: When settling a loan via preclosure (direct admin or approval execution), the settlement payment MUST anchor to today's instalment (`sameBusinessDay(dueDate, today)`) if one exists, ensuring the payment records on today's business date and does NOT jump forward to the next day's instalment. All subsequent future instalments (`instalmentNo > closureInst.instalmentNo`) and any remaining arrears are marked `waived`.
- **PRECLOSE-7** — **Paid Period & Remaining Counts (Web & Mobile Parity)**:
  - `Paid Period` reflects the actual active loan duration prior to closure. When instalments are waived due to preclosure/early settlement, Paid Period is computed from the instalments up to the preclosure anchor (`firstWaivedNo - 1`, or `totalInstalments - waivedCount`), never blindly displaying full tenure (`totalInstalments`) upon closure.
  - When a loan is closed or has zero outstanding (`outstanding <= 0`), remaining counts (`Remaining Actual` and `Remaining Extended`) and missed counts MUST clamp to 0 across both web (`LoanDetailClient.tsx`) and mobile (`loan_detail_screen.dart`).
  - Dynamic status mappers across web and mobile MUST honour `status: 'waived'` and never override past-due waived rows to `missed`.
- **PRECLOSE-8** — **One preclose quote, server-enforced (DEC-01)**: `buildForeclosureCalculation` (`lib/foreclosure.ts`) is the only payoff calculation; both clients read it from `GET /api/v1/loans/[id]/foreclosure-calc` (the frozen `/api/loans/[id]/foreclosure-calc` returns the same lib result). Payoff = `max(0, totalPayable − totalCollected)` (interest-only: outstanding principal), less a discount capped at the payoff. Pending penalty is **not** part of the payoff: the quote returns it as `penaltyDue` (after `ensurePendingPenaltiesForMissedLoans` for that loan) with an `info` line item. `precloseLoanInTx` re-quotes inside its transaction and rejects an amount below `totalSettlementAmount` with 409 `{ required }`.
- **PRECLOSE-9** — **Penalty popup (DEC-01)**: when `penaltyDue > 0` a preclose (direct, or an agent request) MUST carry `penaltyResolution { action: paid | discount | waived, amount, paymentMode }` (`validatePenaltyResolution`: paid = due, 0 < discount < due, waived = 0, mode required when money is collected; else 400 `penalty_resolution_required` / `penalty_resolution_invalid`). In the preclose transaction the collected part is settled oldest-first through `settlePenaltyInTx` (MONEY-32 money posting, GL after commit) and the rest is waived (`preclose_discount` / `preclose_waived`). An agent's proposed resolution is stored on the request and applied only when an admin approves (D6). The outcome `{ due, paid, discount, waived }` is returned as `penaltyOutcome`, stored on the preclose audit row and shown in the outcome popup and the loan timeline.
- **MONEY-29** — **Missed Instalment Definition**: An instalment or extended row is "missed" if and only if its status is `missed`. A `partial` (partially paid) row is **never** counted as a missed day in any display count (`metrics.missedCount`), report, or penalty calculation. When a loan is closed or has zero outstanding (`outstanding <= 0`), `metrics.missedCount` is 0 across all surfaces.
- **MONEY-30** — **Loan detail metrics (LD-01)**: `GET /api/v1/loans/[id]` `metrics` is the only source both clients render. `overdueAmount` = `calculateDynamicOverdueAmount` (0 when closed or outstanding <= 0). `remainingExtended` = ceil(outstanding / perInstalment). `remainingActual` = periods left to `endDate` by calendar (daily = days, weekly = ceil(days/7), monthly = ceil(days/30)). `paidPeriod` = first waived instalment no − 1 when instalments were waived (or totalInstalments − waived count when the first is no 1); otherwise totalInstalments when closed/settled, else totalInstalments − remainingExtended. Closed or zero-outstanding loans show remaining 0 (PRECLOSE-7).
- **MONEY-34** — **Schedule and event timestamps**: a schedule row shows a received time only when money is on it (`receivedAmount > 0` in the view shown — posted, ledger or distributed), as time alone on the due day and date + time otherwise. `Instalment.receivedAt` is the original receipt and never moves: today's collection lists (`/api/v1/collection/today`, `/collection/dashboard`) and the advance-payment / EMI reports read it. A payment correction (`correctInstalmentPaymentInTx`) stamps `Instalment.correctedAt` instead (null when corrected to 0), and the schedule shows `correctedAt ?? receivedAt`; an extended day that is one edited payment (`editInstalmentId`) shows its `correctedAt`. The distributed view ignores `correctedAt` (a spread row is not the edited row). `GET /api/v1/loans/[id]` `startedAt` = the loan's first `disburse` WalletTransaction (written in the activation transaction), else `createdAt`; null while `pending_review`. Approval request and review times (`createdAt`, `reviewedAt`), the agent float ledger and cash handovers show date + time on web (`formatDateTime`, `lib/utils.ts`) and mobile.
- **EXT-1** — **Extended Term Schedule & Collection Parity (Web & Mobile)**:
  - When an active loan has an outstanding balance that extends beyond its original scheduled end date (`lastScheduledDate < today`), continuous calendar periods are generated past the end date up to today and into future projection until the balance is settled.
  - Elapsed periods without collections are marked `missed` (Overdue); today's period is marked `due today` with an active Pay button; future periods are marked `projected`.
  - When a payment is collected on an extended date (via Web or Mobile QuickCollectSheet), the entry is recorded with full GPS and accounting ledger linkage, and the date row becomes `paid`. No phantom `Instalment` DB rows are created (preserving `MONEY-12` and loan closure invariants).
  - **Original rows stay as they were at the end of the term.** A missed row stays missed; its unpaid due moves on to the extended days. A payment taken after the term is still posted on an original row (no phantom rows), so `computeTenureLedger` shows each row as its posted amount less the collections posted to it after the last scheduled date. `GET /api/v1/loans/[id]` sends this as `ledgerReceivedAmount` / `ledgerStatus` beside the posted `receivedAmount` / `status`. Entries do not store their row, so `pairEntriesWithInstalments` recovers it from the Payment + PaymentAllocation written in the same transaction (same amount and mode, created within 10 s). The view is display only: corrections (web `openPaymentModal`, mobile `_requestCollectionEdit`) act on the posted row, and the penalty summary stays on posted rows.
  - An extended day shows the cash collected **on that business date** (`DailyCollection.date`, not `submittedAt`) — the only place after-term cash appears, so everything shown adds up to cash collected. `metrics.missedCount` counts missed original rows plus missed extended days (the red cells on the calendar).
  - Worked rule: days 1–4 paid, 5–10 missed → 5–10 stay missed and days 11–16 are projected. Missed 11, paid 12 → finish slides to 17. A payment above the daily amount pulls the finish in by `ceil(outstanding / perInstalment)`.
  - **Penalty days past the term** (`pastTermMissedDays`): rows missed at the end of the term plus extended days missed since, × `Loan.penaltyRate`. The loan page's `penaltySummary.potential` and the pending accrual (`ensurePendingPenaltiesForMissedLoans`) both use it, so Settle/Waive act on the figure the page shows. While the term runs both keep counting instalments marked `missed`.
  - **Edit on an extended day** (`editInstalmentId`): offered only when the day is one collection entry that is its instalment's linked entry and the only cash on that row. A correction rewrites the row total and its linked entry, so for any other day a row correction would change other payments — no Edit there.
  - The restructured rate is for the tenure only. Once the last scheduled due is behind today `computeRestructure` returns `available: false` and a zero rate, and web and mobile hide the "Show restructured rate" toggle.
  - Collections on the same business day are summed into that day's row. When today's period is already collected it is a paid history row, and the `remainingPayments = ceil(outstanding / perInstalment)` still owed are projected from the **next** period — today never counts both as paid and as a payment still due (`projectedEndDate` = today + `remainingPayments` periods).
  - The Calendar Tracker tail cells (web `LoanDetailClient.tsx`, mobile `loan_heatmap.dart`) take each extended row's status (paid / partial / missed / due today); only `projected` rows keep the dashed indigo style.
  - **Distributed view (DEC-03 B).** `distributedInstalments` (`distributeScheduleView`) lays `totalCollected` over the original rows oldest-first, so cash taken on an extended day is already counted there. Its extended days are `distributedExtendedRows` (`distributeExtendedRowsView`): only what is left after the whole original schedule reaches them, in order; a day it does not reach shows ₹0 received and takes its status from its date (missed / due today / projected), with no entry, mode or Edit. Both views stamp each filled row's `receivedAt` with the collection entry whose running total (entries oldest-first by `submittedAt`) first reaches that row's share; `null` when entries never reach it. Clients render these in the Distributed view, list and calendar alike, and never redistribute locally (STABLE-8). The Actual view is unchanged.

### 10.4 Penalties — `lib/penalties.ts`

- **MONEY-14** — Accrual = `Σ max(0, daysOverdue − grace) × penaltyPerDay`, capped by `maxCap` when non-zero. Per-tenant settings: `default_penalty_per_day`, `penalty_grace_period`, `penalty_max_cap`. **This describes `calculatePenaltyAccrual` (the cron) only.** A second accrual, `ensurePendingPenaltiesForMissedLoans`, runs on every dashboard load, the penalties page and `GET /api/penalties`, and computes `count(missed instalments) × Loan.penaltyRate` (past the term: `pastTermMissedDays`, EXT-1) — no grace, no cap — writing the same `Penalty.grossPenalty` rows, where the larger figure wins. Opening a page can therefore push a borrower's penalty past the tenant's configured cap. Live divergence, documented in `docs/CALCULATION_LOGIC.md` §14.1; one of the two has to move.
- **MONEY-15** — Recorded gross penalty only ever **increases** (`shouldUpdatePenaltyGross`). Reductions are waivers, recorded as `waivedAmount` — never by rewriting gross. The accrual job runs inside a transaction to prevent duplicate penalty rows.
- **MONEY-28** — **Penalty Settlement & Waiver Discipline (`settlePenalty`, `waivePenalty`)**: Settle amounts are increments (`settledAmount += amount`), never overwrites. Settle transitions status to `settled` if `settledAmount + waivedAmount >= grossPenalty`, otherwise `partial`. Settle rejects `amount <= 0` or `amount > remaining`. Agents may collect penalties (settle) for linked customers, but cannot waive. Waiving is strictly restricted to `admin`, `superadmin`, and `developer` roles. Agents may request a penalty waiver via an approval request (`requestType: 'penalty_waive'`, `entityType: 'penalty'`) with a required reason; administrators review and upon approval execute `waivePenalty` with the approver's identity.
- **MONEY-32** — **A penalty collection is money in, like a loan collection (DEC-06)**: `settlePenalty` requires `paymentMode` (`cash | upi | bank_transfer | cheque`, `PENALTY_PAYMENT_MODES`) and, in the same transaction as the penalty update, writes one cash-book `AccountEntry { type: 'penalty_collection', category: cash|upi|bank by mode, referenceType: 'penalty' }` and, for cash only (MONEY-17), credits the collector's float (`creditPenaltyCollection`, ledger type `penalty_collection`); the cash reaches the office by the normal handover. After commit `autoPostPenaltyCollection` posts Dr cash/bank / Cr `penalty_income` (ACC-7). The penalty row is re-read and written conditionally inside the transaction so concurrent settles cannot both pass the remaining check. Loan totals, instalments and `DailyCollection` are never touched. Waivers post nothing. Accounting summary `penaltyIncome` (Σ `penalty_collection`) counts as cash in and revenue.


### 10.5 Cash & float — `lib/wallet.ts`

Physical cash moves through two account types: `BranchCashAccount` (office pool) and `AgentAccount` (agent float). `WalletTransaction` is the ledger.

```
inject capital → branch pool → release to agent → agent float
                     ▲                                │
                     └──── deposit / collect ◄────  collections
                     │                                │
                     └──── disburse from branch    disburse from agent
```

- **MONEY-16** — Float never goes negative. `disburseFromAgent` / `disburseFromBranch` throw `InsufficientFloatError`, surfaced as `409` with available/required amounts. Never suppress it.
- **MONEY-17** — **Only cash legs move float.** Bank, UPI, cheque and DD legs appear in the cash book and GL but do not touch physical float.
- **MONEY-18** — Every wallet mutation happens inside the caller's transaction (`tx` first argument).
- **MONEY-35** — A wallet branch capital top-up writes a scoped cash-book `capital_add` entry and credits the branch pool in the same transaction (`injectBranchCashInTx`). Its wallet ledger row references that entry, and its supplemental GL posting uses the entry's persisted id and date. Increasing float without the cash-book entry lets funded loans appear as negative dashboard/accounting capital (ACC-6, MONEY-27). Legacy manual top-ups require cash-book reconciliation; hiding a negative figure with a clamp does not repair the books.
- **MONEY-33** — **One cash settlement path (MON-02, STRUCT-3)**: every way an admin takes field cash from an agent — wallet *Collect* on a handover, *Collect from agent*, approval of a `cash_handover` request, an admin reconciling an agent's route run — calls `settleAgentCashInTx` (`lib/cashSettlement.ts`) inside its transaction: agent float − amount → branch pool + amount (hard-blocked, MONEY-16; the agent must have a branch), then the agent's pending **cash** collections are verified oldest-first while the amount covers them, each getting its cash-book `collection` row; any remainder is unused float returning (no cash-book/GL effect). GL for verified entries posts after commit (`postSettledCollections` → `autoPostCollectionEntry`, ACC-7). An agent never verifies their own collections: an agent's handover is a pending `CashHandover` (`requestCashHandover`), and an agent reconciling their own run only moves float (`depositToOfficeInTx`). `reconcileRun` claims the run and writes the deposit, variance approval, run update and audit in one transaction. `CashHandover` rows carry `appType` + `branchId` stamped at write; wallet screens scope them with `handoverScopeWhere`.

#### Loan funding gate — `lib/loanFundingPolicy.ts` (pure), `lib/loanFunding.ts` (reads + alerts)

MONEY-16 is the block; these rules are the figures and alerts around it. Nothing here moves cash.

- **FUND-1** — **One funding calculation, on the server.** `computeLoanFunding` is the only place a loan's payout is compared with its source: an **agent's float** for agent-originated loans, the **branch pool** of the loan's branch (the customer's, resolved as origination does) for admin/superadmin loans. It returns `required` (net cash payout, `Loan.disbursed`), `available`, `shortfall = max(0, required − available)`, `capitalNeeded` and `sufficient`, all rounded to paise. `POST /api/v1/loans/funding { amount, customerId }` serves it to both clients' loan forms; they render it and never compare amounts themselves (STABLE-8).
- **FUND-2** — **Branch capital short ⇒ no loan; agent float short ⇒ queued, approval blocked.** An admin/superadmin loan whose branch pool cannot cover the payout is refused (the form's popup offers *Add capital*; the server still 409s via MONEY-16). An agent's loan is accepted into `pending_review` with its `funding` on the create response; approving it stays blocked by MONEY-16 until enough float is released — the approve button opens the funding popup with *Release ₹X*. Every MONEY-16 409 from origination or approval keeps its message and adds `data: { code: 'insufficient_float', funding }`.
- **FUND-3** — **Pending loans are committed against the agent's float.** `committed` = Σ `disbursed` of the agent's other `pending_review` loans, keyed on the same `(tenantId, appType, agentId)` axis as `AgentAccount` — never a branch, and only a number is returned. `queueShortfall = max(0, required + committed − available)` is the release that clears the agent's whole queue; it is advisory — approval gates on `shortfall` only. Approvals lists (web page and `GET /api/v1/approvals`) send `funding` per pending loan from `buildPendingLoanFunding`.
- **FUND-4** — **Capital chain and deep links.** A release debits the agent's branch pool, so `capitalNeeded = max(0, shortfall − branchPool)` tells the admin to add capital first (the wallet's existing *Add capital and release* step does both). Popups and alerts link to the wallet with the server's figure: `?agent=<id>&release=<amount>` or `?branch=<id>&topup=<amount>` (`fundingWalletLink`); web and mobile wallets open that row prefilled — the admin still confirms.
- **FUND-5** — **Alerts are opt-in, Micro Lending only, after commit.** AppSetting `loan_funding_alerts_enabled` (default off, Settings → Features). When on: an agent's short loan notifies the agent (`notifyUser`) and the approvers (`notifyApprovers`) with the amount to release; an approval blocked by MONEY-16 also notifies the agent; a release that makes a pending loan payable (`newlyFundableLoans`: payout fits the float after, not before) sends `float_ready` to the agent and approvers. The pre-existing approver alert on a MONEY-16 block (`float_insufficient`) is always sent, now translated (dictionary `loanFunding`) and linked to the prefilled wallet. All alerts run after the transaction and never throw (NOTIF-1, X-19).
- **FUND-6** — Guarded by `tests/loanFunding.test.ts` (exact figures + wiring, in `test:money-core`) and section 12 of `tests/mobileParityAuditValidation.test.ts`.

### 10.6 Accounting — `lib/accounting/`

Double-entry general ledger: `Account` (4-digit codes) → `JournalEntry` → `JournalLine`, with `AccountBalance` maintained by `bumpAccountBalance`.

- **ACC-1** — Account codes are resolved through `POSTING_DEFAULTS` (`lib/accounting/postingKeys.ts`) with per-tenant overrides from `AccountingSettings.postingOverrides` (JSON). Never hardcode a 4-digit code in business logic.
- **ACC-2** — `postingKeys.ts` is the single posting-key module: default codes, `buildDedupKey`, `isDuplicateJournalEntry`. (A parallel `POSTING_MAP` in `postings.ts` was dead on arrival and has been deleted — do not resurrect a second key registry.)
- **ACC-3** — A posting plan MUST balance. `buildOriginationPostingPlan` throws on unbalanced debit/credit and on payout legs that do not sum to the disbursed amount. Keep every new posting builder pure and testable the same way.
- **ACC-4** — Statutory accounting is a **plan feature** (Enterprise by default, see §7.4). Tenants without it keep base cash-book behaviour. `postLoanOrigination` checks the subscription and returns `null`; `autoPost*` checks `isPremiumAccountingEnabled` — new posting code MUST respect the same gate.
- **ACC-5** — Auto-generated journal entries MUST set `sourceType`, `sourceId` and `dedupKey` (DB-10). The unique index is the guard; the narration-tag scan in `autoPost.ts` is a legacy fallback for pre-`dedupKey` rows and must not be relied on for new paths.
- **ACC-6** — Cash book (`AccountEntry`) and GL (`JournalEntry`) are **both** written for a money event. They are different ledgers for different audiences; writing only one is a bug.
- **ACC-7** — `autoPost*` functions are fire-and-forget and swallow their own errors by design — a GL failure must never roll back the operational record. That is precisely why they cannot be the *only* place a money event is recorded (ACC-6).
- **ACC-8** — `AccountBalance` is a consolidated tenant-wide cache. Module and branch financial views derive balances from posted `JournalLine` rows filtered by tenant, module, and active branch. Never display `AccountBalance` as a module balance.
- **ACC-9** — Premium approval review changes the approval, underlying journal or bill, account balance and audit in one transaction. A bill becomes unpaid only after its GL journal posts. Level-2 approvals require the configured developer approver role.
- **ACC-10** — Tally voucher exports must fail when the configured `tally_export_max_vouchers` limit is exceeded. Truncating a valid date range silently produces incomplete books.
- **ACC-11** — Cash-book `AccountEntry.type` values that count as cash **in** are `capital_add`, `collection` and `penalty_collection` (DEC-06). Every total that sums the cash book by type (`lib/accounting/summary.ts`, `lib/dashboard/bookTotals.ts`, `classifyCashFlowEntryType`) MUST treat them alike. Penalty income posts to posting key `penalty_income` (default `4200`), `sourceType: 'penalty_settlement'`, dedup key `penalty_collection:<tenant>:<accountEntryId>`.

### 10.7 Auto Finance (hire purchase) — `lib/autofinance/`

- **AF-1** — HP terms come from `buildHpOriginationTerms()` (`lib/autofinance/origination.ts`): flat or diminishing interest, charges recovered from payout, up to two payout legs, hand-loan advances financed inside the HP schedule. Origination MUST use the returned terms rather than recomputing principal/EMI.
- **AF-2** — HP loans are always `frequency: 'monthly'`, and `tenure` comes from the generated schedule length, not from the request body.
- **AF-3** — Financed vehicle, `AutoFinanceDetail`, broker/dealer links and vehicle photos are created in the **same transaction** as the loan. The 4-step wizard is one atomic operation from the operator's point of view.
- **AF-4** — `Vehicle.registrationNo` is unique per `(tenantId, appType)` and normalised to trimmed uppercase before comparison or insert.
- **AF-5** — The allowed-login-window restriction (`checkLoginWindow`) is an Auto Finance field-ops control, applied at token mint (§6.2). Owners (`superadmin`, `developer`) are exempt — keep the carve-out consistent between `lib/auth.ts` and `lib/api/v1-auth.ts`.

### 10.8 Gold loans — `lib/gold/`

- **GOLD-1** — LTV ceilings are RBI-mandated (`validateGoldOrigination`). Exposure is computed across the borrower's **existing** active/pending gold loans and re-validated inside the transaction. Never raise a ceiling from configuration.
- **GOLD-2** — Ornament line values come from `resolveOrnamentLine` / `ornamentTotals`. Weight rules: `0 < netWeight ≤ grossWeight`, both required. When itemised lines exist they are authoritative over the header-level totals.
- **GOLD-3** — A `goldloan`-module origination without collateral is rejected outright — collateral is not optional for the module.
- **GOLD-4** — The applied policy is snapshotted (`RBI_GOLD_SILVER_2025_V1`) onto both the loan and the `GoldLoanCollateral` row, including `maximumLtvPercent`, `appliedLtvPercent` and `exposureForLtv`. Later rate movements never restate an originated pledge.

### 10.9 Chit funds — `lib/chits/`

The most stateful module. A chit group is a fixed-size savings pool: every period each member pays a subscription, one member wins the pot via auction, and the discount they accept is redistributed to the others as dividend.

#### Entities

```
ChitGroup ──┬── ChitMember (ticketNo, ticketShare, hasWon, subscriberStatus)
            │        └── ChitSubscription   one row per member per period
            └── ChitAuction (period)
                     ├── ChitBid          (+ idempotencyKey, source: tap|voice|remote)
                     ├── ChitAuctionEvent (open / extend / winner / close — the room's log)
                     ├── ChitAuctionAttendance, ChitRoomMessage
                     └── ChitSecurity     the gate between winning and being paid
ChitReceipt        every collection, payout and dividend payout
ChitPaymentIntent  borrower-initiated payment awaiting staff approval
```

#### Auction arithmetic — `calculateChitAuction()`

```
bidDiscount   = chitValue − prizeAmount
commissionBase= commissionBasis === 'CHIT_VALUE' ? chitValue : bidDiscount
commission    = commissionBase × commissionPct%          (foreman's income)
gstAmount     = commission × gstPct%
distributable = max(0, bidDiscount − commission)
eligible      = dividendPolicy === 'NON_WINNERS_ONLY' ? max(1, totalMembers−1) : totalMembers
dividend      = floorTo(dividendRounding, distributable / eligible)   per ticket
roundingIncome= distributable − dividend × eligible                   (foreman's income)
```

- **CHIT-1** — All auction money is derived by `calculateChitAuction()`. Never recompute a dividend, commission or bid discount at a call site.
- **CHIT-2** — Guards are absolute: `chitValue > 0`, `0 < prizeAmount ≤ chitValue`, `totalMembers > 0`, `commissionPct ≥ 0`, `gstPct ≥ 0`.
- **CHIT-3** — Dividend is rounded **down** to `dividendRounding`, and the remainder becomes `roundingIncome` — foreman income, not a rounding error. It must be recorded, never discarded, or the group's books will not balance.
- **CHIT-4** — Per-member dividend is scaled by `ticketShare`. Fractional tickets are real: a half ticket receives half the dividend. Never assume one member equals one ticket.

#### Configuration enums — `lib/chits/types.ts`, validated by `validateChitConfig()`

| Setting | Values |
|---|---|
| `auctionType` | `open_manual`, `open_live`, `sealed`, `lottery`, `fixed_rotation` |
| `tieBreakRule` | `EARLIEST_BID`, `LOTTERY_AMONG_TIED` |
| `dividendPolicy` | `ALL_MEMBERS`, `NON_WINNERS_ONLY` |
| `dividendDistribution` | `ADJUST_NEXT_DUE`, `CASH_PAYOUT`, `ACCUMULATE` |
| `commissionBasis` | `BID_DISCOUNT`, `CHIT_VALUE` |
| `winnerInterestType` | `NONE`, `FIXED`, `PERCENT` |

- **CHIT-5** — Every enum above is validated by `validateChitConfig()` before persistence. Adding a value means adding it to the array in `types.ts` **and** the validator. An unvalidated string reaching the calculator silently changes how money is split.

#### Bidding — `placeChitBid()` (`lib/chits/bidService.ts`)

The single entry point for both the staff web action and the mobile route. Checks, in order:

1. Idempotency: an existing bid for `(auctionId, idempotencyKey)` is returned as-is.
2. Auction not locked (`confirmed`, `paid`, `cancelled` reject).
3. `lottery` / `fixed_rotation` groups reject bids entirely — those use the draw action.
4. Member has not already won; `subscriberStatus === 'active'`.
5. `assertValidPrizeAmount()` — enforces the discount floor and ceiling.
6. Live rooms only: sync bells, require an open room, apply anti-snipe extension.
7. Bid increment: must exceed the current highest by `bidIncrement`, **except** an exact-at-cap bid, which is always accepted so cap ties can form.

- **CHIT-6** — The bid floor is `effectiveMinDiscountPct()`: an explicit `minDiscountPct` always wins; otherwise the floor is `commissionPct` unless `bidStartAtCommission === false`. This is the single source of truth and has three consumers — the hard validator, the customer live-state builder, and the staff live-room poll. If they disagree, staff and customers see different "starting bid" numbers for the same auction.
- **CHIT-7** — Bids are placed only through `placeChitBid()`. Never write a `ChitBid` row directly.
- **CHIT-8** — Mobile and web bid submissions MUST carry an `idempotencyKey`. Retrying a bid on a flaky connection must not create a second bid.

#### Live auction rooms (`auctionType: 'open_live'`) — `lib/chits/liveAuction.ts`, `bell.ts`

Deliberately a **polling** architecture — 2–3 second client polls, no sockets or SSE. Room state: `scheduled → open → extended → closed`.

- **CHIT-9** — The room closes **lazily**, on the first request after expiry, and `closeRoomIfExpired()` re-reads its own row inside the caller's transaction so two concurrent requests cannot double-close. Never close a room from a client timer.
- **CHIT-10** — Anti-snipe: a bid landing within the final `autoExtendSeconds` pushes `biddingClosesAt` forward by that many seconds and records an `extend` event. A room that can be sniped is not a fair auction.
- **CHIT-11** — The bell countdown ("going once / twice / sold") resets on every new bid (`bellAnchorAt`, `bellsRung`) and on every room open.
- **CHIT-12** — **The room never moves money.** It opens, accepts bids, extends and closes. Winner selection and settlement are the confirm/draw flow. Keep that separation.

#### Winner selection and finalisation — `finalizeAuctionInTx()`

- **CHIT-13** — The winning bid is the highest `bidDiscount`, tie-broken by earliest `bidTime` (`getWinningBid`). When `tieBreakRule === 'LOTTERY_AMONG_TIED'` and `getTopBids()` returns more than one, the winner MUST come from a `lottery.ts` draw and the draw evidence MUST be stored on the auction minutes.
- **CHIT-14** — `finalizeAuctionInTx()` is the only finaliser — shared by the web confirm/draw actions, the mobile routes, and the period-1 foreman auto-resolution. In one transaction it: demotes any previous winner, marks the winning bid, sets the auction `confirmed` / `payoutStatus: security_pending`, flags the member `hasWon`, records a `winner` event, **creates a pending `ChitSecurity` row**, distributes dividend, applies winner interest, and writes a chit audit row.
- **CHIT-15** — **Finalisation never pays the prize.** It sets `payoutStatus: 'security_pending'` and stops. Any code path that pays a winner without passing the security gate is a defect.
- **CHIT-16** — Auction minutes are generated (`generateAuctionMinutes`) and persisted for every finalisation. For registered chits these are a statutory record, not a UI nicety.

#### The payout gate

- **CHIT-17** — `assertCanReleasePrizePayout()` must pass before any prize money moves: auction status in `confirmed | payout_pending`, `securityStatus === 'approved'`, `payoutStatus === 'ready'`, a winner and a positive prize amount. Call it — do not re-implement the condition.
- **CHIT-18** — `releaseChitPrizePayout()` refuses to post twice: it first looks for an existing `AccountEntry` on `(auctionId, 'chit_auction', 'chit_payout')` and throws if found. It then writes the receipt, the cash-book entry, and debits the branch pool via `chitPayoutFromBranch`.

#### Dividend distribution — `applyDividendDistribution()`

| Mode | Effect |
|---|---|
| `ADJUST_NEXT_DUE` | Credits the **next** period's subscription: `dividendAmount +=`, `dueAmount −=`. No cash moves. |
| `ACCUMULATE` | Records `dividendAmount` on the current period. No cash moves, no due change. |
| `CASH_PAYOUT` | Records the accrual **and** moves cash: receipt + `AccountEntry` + `chitPayoutFromBranch`. |

- **CHIT-19** — `ADJUST_NEXT_DUE` only ever touches subscriptions that are `status != 'paid'`. Never reduce a due a member has already settled.
- **CHIT-20** — Only `CASH_PAYOUT` moves cash. If you add a distribution mode, decide explicitly which side of that line it sits on.

#### Winner interest — `applyWinnerInterest()`

A member who has taken the pot early may owe extra per remaining period.

- **CHIT-21** — The window is `wonPeriod + 1 … min(totalMembers, wonPeriod + winnerInterestPeriods)`. It never extends past the group's last period, and never touches the period they won in.
- **CHIT-22** — It increments **both** `interestAmount` and `dueAmount`, and only on subscriptions that are not yet `paid`. Incrementing one without the other silently loses or invents money.

#### Subscription collection — `collectChitSubscriptionPayment()`

- **CHIT-23** — Two modes: `ADD_PAYMENT` (delta) and `SET_TOTAL_PAID` (absolute). The posted amount is always `receivedDelta`, which must be `> 0`. Never post the raw input amount — under `SET_TOTAL_PAID` that would double-count everything paid so far.
- **CHIT-24** — One collection writes: subscription update, `ChitReceipt`, `AccountEntry`, and a branch pool credit. All in the caller's transaction.
- **CHIT-25** — Receipt numbers come from `generateChitReceiptNo(tx, …)`, which is branch- and type-aware. Never format a receipt number by hand.

#### Group lifecycle

Group: `draft → registered → active → suspended | cancelled | closed`.
Member: `active | defaulted | substituted | removed | closed | vacant`.
Auction: `pending → notice_sent → in_progress → completed → confirmed → payout_pending → paid | cancelled`.
Payout: `not_ready → security_pending → ready → paid`.
Security: `pending → submitted → verified → approved | rejected`.

- **CHIT-26** — Status strings come from the `CHIT_*_STATUS` constants in `lib/chits/status.ts`. Never inline a status literal.
- **CHIT-27** — Activation is gated by `validateChitGroupActivation()`. For `chitType: 'registered'` this requires registration number, registration date, registrar office, by-law number, commencement certificate, approved bank and foreman name — plus ticket integrity (every member ticketed, no duplicates, distinct count equals `totalMembers`), all agreements signed/verified, and exactly one foreman ticket where applicable. Never bypass it to "activate a group quickly"; for a registered chit these are legal preconditions.
- **CHIT-28** — Foreman commission is capped by `foremanCommissionCapPct` (`assertValidCommissionPct`), and bid discount by `maxDiscountPct`. Both are statutory ceilings for registered chits.
- **CHIT-29** — Chit access control uses `lib/chits/access.ts` (`canAdminChits`, `canCollectChits`, `canApproveChitSecurity`, `scopedChitGroupWhere`). Security approval is deliberately a *different* capability from collection — do not collapse them.
- **CHIT-30** — Every chit state change writes a `createChitAudit()` row inside the same transaction.

### 10.10 NPA classification & provisioning — `lib/npa/`

RBI IRACP asset classification. Runs nightly per tenant via `/api/cron/npa-classify`.

#### The ladder — `determineCategory()`

| Days overdue | Category |
|---|---|
| 0 | `standard` |
| 1–30 | `sma_0` |
| 31–60 | `sma_1` |
| 61–90 | `sma_2` |
| 90+ | NPA — sub-category by **time since first NPA classification**: ≤365d `sub_standard`, ≤730d `doubtful_d1`, ≤1095d `doubtful_d2`, else `doubtful_d3` |

`loss` and `written_off` exist as categories but are not reached by the automatic ladder — they are set by explicit business decision.

- **NPA-1** — The overdue clock starts at the **oldest unpaid instalment's due date** (`calculateMaxOverdueDays`), not the most recent. A partially paid instalment still counts as overdue unless `receivedAmount >= dueAmount`.
- **NPA-2** — Once a loan is classified NPA, `npaClassifiedAt` is set **once** and drives the doubtful sub-category ladder thereafter. Do not restamp it on subsequent runs — that would reset a 3-year-old doubtful asset to sub-standard.
- **NPA-3** — A loan at `sub_standard` or worse also moves `Loan.status` to `npa`.
- **NPA-11** — **Gross NPA for reporting includes SMA (D2, NPA-01)**: Gross NPA outstanding = Σ outstanding of `GROSS_NPA_CATEGORIES` (`sma_0..2`, `sub_standard`, `doubtful_d1..3`, `loss`, `written_off`; `lib/npa/npaClassifier.ts`). Gross NPA ratio = that ÷ Σ `max(0, totalPayable − totalCollected)` over every non-deleted loan in scope (tenant, module, branch). `getNpaSummary` (mobile) and the NPA classification report (web) both use this definition.

#### Provisioning — `calculateProvisioning()`

| Category | Secured | Unsecured |
|---|---|---|
| `standard`, `sma_0/1/2` | 0.40% | 0.40% |
| `sub_standard` | 15% | 15% |
| `doubtful_d1` | 25% | **100%** |
| `doubtful_d2` | 40% | **100%** |
| `doubtful_d3`, `loss`, `written_off` | 100% | 100% |

- **NPA-4** — For MFI tenants every loan is unsecured; `isSecured` exists for NBFC clients. The default is `false` — the conservative direction. Never default it to `true`.
- **NPA-5** — A `LoanProvisioning` snapshot is written **every run, for every loan**, changed or not, keyed `(loanId, snapshotDate)` and upserted. The provisioning report reads snapshots, not live loan state, so a missing snapshot is a hole in the balance sheet.
- **NPA-6** — `NpaHistory` and `LoanProvisioning` are immutable/undeletable (DB-2, DB-3). Corrections are new rows.

#### Upgrade

- **NPA-7** — An NPA loan returns to `standard` only after **3 consecutive clean instalments** (`checkUpgradeEligibility`), and only by **explicit admin action** (`upgradeNpaToStandard`). Never automate the upgrade. `upgradeNpaToStandard` re-checks eligibility itself — never call it behind an unchecked UI toggle.
- **NPA-8** — Upgrade clears `npaClassifiedAt`, resets provisioning to standard, and writes an `NpaHistory` row with `triggeredBy: 'manual_admin'` and the acting user.

#### Batch behaviour

- **NPA-9** — Per-loan failures are caught and counted; the sweep continues. One bad loan must never abort a tenant's nightly classification (CRON-4).
- **NPA-10** — The classification sweep reads across all modules for the tenant by design (a tenant's balance sheet is not per-module). It is one of the SCOPE-9 exceptions and must stay annotated as such.

---

## 11. Background jobs

Endpoints under `app/api/cron/`: `accrue-penalties`, `dunning`, `npa-classify`, `nach-present`, `send-reminders`, `send-reports`, `reports`, `recompute-balances`, `subscription-reminders`, `trial-expiry`, `chit-auction-reminders`, `gps-purge`, `affiliate-sync`. Triggered by GitHub Actions (`.github/workflows/daily-cron.yml`, 18:30 UTC = midnight IST) and/or host cron.

- **CRON-1** — Every cron route starts with `authorizeCron(req)`.
- **CRON-2** — Cron jobs MUST be **idempotent**. They will be re-run — manually, by retry, by overlapping schedules. Covered by `npm run test:e2e-cron`.
- **CRON-3** — Use `CronLock` for jobs that must not overlap.
- **CRON-4** — A cron job MUST NOT abort the whole tenant sweep on one tenant's or one record's failure. Log, continue, report a summary (`{ processed, changed, errors }` is the established shape).
- **CRON-5** — Tenant-wide sweeps legitimately omit `appType`; annotate them (SCOPE-9).
- **CRON-6** — Reminder jobs stamp what they sent (`reminder1DayAt`, `reminder1HourAt` on `ChitAuction`) so a re-run does not re-notify. Rescheduling clears those stamps deliberately — see `rescheduleAuctionInTx`.

---

## 12. Notifications

Two separate systems with different audiences, guarantees and gates. Do not mix them up.

### 12.1 Customer-facing — `notify()` in `lib/notify/events.ts`

Reaches borrowers on SMS, WhatsApp, email and push. Events: `payment_received`, `payment_due_reminder`, `loan_disbursed`, `loan_overdue`, `loan_closed`, `penalty_accrued`, and six `chit_*` events.

Dispatch order, per call:

1. **Subscription gate** — `TenantSubscription.whatsappSmsEnabled`. Off ⇒ no SMS/WhatsApp at all.
2. **Per-event gate** — AppSetting `notify_event_<event>` (default on).
3. **Global gate** — AppSetting `whatsapp_sms_active` (default on).
4. **Template resolution** — `NotificationTemplate` rows for `(tenantId, name=event, channel, lang)`, falling back to the requested language, then `en`, then the hardcoded `MESSAGES` map. Inactive templates are skipped.
5. **WhatsApp first, SMS on failure** — a failed or unconfigured WhatsApp send falls through to SMS. They are alternatives, not duplicates.
6. **Push** — only when a push template exists and the customer is linked to a `User`.
7. **Email** — independent of the SMS/WhatsApp path; sent whenever an address is supplied.

- **NOTIF-1** — `notify()` is fire-and-forget and **never throws**. Notification failure must never roll back or fail a money operation. Call it *after* the transaction commits, never inside it.
- **NOTIF-2** — Never call a provider SDK from a route handler or action. Go through `notify()` and the channel adapters in `lib/notify/channels/`.
- **NOTIF-3** — A new event means: add the `EventKey`, a message in `MESSAGES` (at minimum `en`), and a `WA_TEMPLATES` entry — and register the WhatsApp template in the provider dashboard, or WhatsApp sends will fail and silently fall back to SMS.
- **NOTIF-13** — `NotificationLog` delivery attempts are stamped with `appType` and `branchId` (resolved automatically from the loan/customer meta). Delivery logs are scoped to the active module and branch (`listNotificationLogs`); legacy unscoped records (`appType: null`) are hidden from module views (SCOPE-17.6 precedent).

### 12.2 Staff-facing — `notifyUser()` / `notifyApprovers()` in `lib/notify/`

Creates in-app `SystemNotification` rows and pushes to devices via FCM.

- **NOTIF-4** — Notifications are **always per-user**: a role broadcast fans out into one row per matching user, each with its own read state. Never write a single shared "role row" — one user reading it would mark it read for everyone.
- **NOTIF-5** — `notifyUser()` returns the number of users reached so callers can detect a broadcast that landed on nobody and fall back rather than dropping it.
- **NOTIF-6** — `notifyApprovers()` is the only correct way to raise an approval. It notifies admins on the **record's** branch, unbranched admins, and — only when the filer is an **agent** — the admins of that agent's own branch. Superadmins are always notified tenant-wide. There is **no** all-admin fallback: when no admin matches, that is logged and the superadmins carry it. Both removed widenings sent one branch's approvals to another branch's bell, for records the recipient's queue (scoped by SCOPE-3) would not even open — a superadmin files for every branch, so honouring a non-agent filer's branch pinged their branch's admin about all of them, and the fallback sprayed customer names and amounts tenant-wide.
- **NOTIF-7** — This wider *reach* never widens *visibility*. Who can SEE a record stays pinned to `branchScopeWhere` (SCOPE-3, SCOPE-10).
- **NOTIF-12** — The bell honours the branch switcher. `buildSystemNotificationWhere` (`lib/notificationVisibility.ts`) filters a **superadmin/developer**'s own rows to the active branch + unbranched rows, because NOTIF-6 fans them out tenant-wide at write time; All Branches (`null`) shows every row. Branch staff are scoped at write time, so their own rows stay unfiltered — filtering them would drop an agent's cross-branch ping to their own admin. `tests/approvalNotifications.test.ts` guards both cases.
- **NOTIF-8** — Both helpers swallow their own errors per stage (recipient resolution, in-app write, push dispatch) so one broken channel cannot take down the others.
- **NOTIF-9** — Creating an `ApprovalRequest` and notifying approvers are **one step**. Every `approvalRequest.create` is paired with a `notifyApprovers()` call on the same path, unconditionally — never gated on the entity type, the request type, or how the request arrived. A request the queue holds but nobody was told about is invisible until someone happens to open the Approvals page. `tests/approvalNotifications.test.ts` guards the pairing.
- **NOTIF-10** — Pass `branchId` (the record's branch), `requesterBranchId` (the filer's) and `requesterRole` as three separate values. Collapsing the two branches with `||` silently drops the admins of whichever branch lost; omitting the role makes the filer's branch inert, since it only widens the fan-out for an `agent`.
- **NOTIF-11** — Push (FCM) is **per-deployment configuration, not code**: without `FIREBASE_SERVICE_ACCOUNT_BASE64` server-side, `sendPushToUsers` is a documented no-op, and without `NEXT_PUBLIC_FIREBASE_*` + `NEXT_PUBLIC_FIREBASE_VAPID_KEY` no browser ever registers a `DeviceToken`. The in-app bell (30s poll) is then the only live channel. Verify both before diagnosing a missing notification as a code bug.
- **NOTIF-14** — A staff notification is created ONLY through `notifyUser()` / `notifyApprovers()`. A bare `prisma.systemNotification.create` writes the bell row but never pushes, and a row with neither `targetUserId` nor a role matching `buildSystemNotificationWhere` is invisible to everyone. Platform-level module/branch-request rows and the GPS idle alert are the only remaining direct writers (deliberately untouched: not per-tenant microlending staff events). `tests/staffNotifications.test.ts` guards the migrated sites.
- **NOTIF-15** — Push shape. **Android is sent data-only** (no `notification` block): with one, the OS draws the notification itself while the app is closed — no logo, no Approve/Reject buttons. The background handler (`NotificationActionService.showBackgroundNotification`) draws both. iOS/web keep the `notification` block. `imageUrl` must be a real `https://` URL (`validImageUrl`): an icon name or relative path makes FCM answer `invalid-argument`, which fails the whole batch and **prunes the tokens** — the device then never receives another push.
- **NOTIF-16** — **Actionable means the server said so.** A push/row is actionable (Approve/Reject buttons) only for a still-pending request the recipient may decide: `notifyApprovers` sets `data.actionable` + `approvalId` and appends `?id=<approvalId>` to the link; `GET /api/v1/notifications` returns `approvalId`, `approvalStatus` (`pending`/`handled`) and `canAct` per row (`lib/notificationApprovalState.ts`). Clients render those flags and never infer approval-ness from the words in a title (that matched "Request approved" result notices and showed agents buttons they cannot use). Approve from the shade runs in-place in a background isolate (falls back to opening the request on any failure; 404/409 = "already handled"); Reject always opens the app so a reason can be typed.
- **NOTIF-17** — Scheduled staff alerts are **digests** (`lib/notify/staffAlerts.ts`): EMIs due tomorrow/today (`send-reminders` cron), newly overdue + periodic overdue summary + new penalties (`accrue-penalties` cron), one row per agent / branch admin set / tenant superadmin per run — never one per instalment. Each is idempotent through `SystemNotification.dedupeKey`, switchable per tenant via AppSetting `staff_notify_<event>` (default on), and the overdue-summary cadence is AppSetting `staff_overdue_digest_days` (default 7). Single-payment alerts (`notifyPaymentReceived`) go to the customer's agent unless they took the payment, plus admins on paths that notified nobody (borrower self-pay, UPI self-pay). Figures are formatted server-side and shipped in `params` (STABLE-8).
- **NOTIF-18** — Notification copy is i18n by key: `SystemNotification.titleKey/messageKey/params` (nullable, additive — null = legacy row) travel to the clients, which render `notif.staff.*` in the device language and fall back to the stored English `title`/`message`. New keys ship in all six locales in web `notifications.staff_*` and mobile `app_strings.dart` (STABLE-5).

---

## 13. Cross-cutting concerns

| Concern | Where | Rule |
|---|---|---|
| **PII** | `lib/pii.ts` | **SEC-1** — Aadhaar, PAN and equivalent personal identifiers are encrypted at rest (`encryptField`/`encryptAadharNumber`) and masked in any UI, API response or export (`maskAadharNumber`, `maskPan`). Business company PAN is not masked. Never log raw PII; `redactPii()` in `lib/audit.ts` before writing audit values. |
| **Audit** | `lib/audit.ts`, `AuditLog`, `createChitAudit` | **SEC-2** — Every state change to a loan, customer, user, payment, chit or setting writes an audit row **inside the same transaction** as the change. |
| **Files** | `lib/fileUpload.ts`, `lib/fileAccessPolicy.ts` | **SEC-3** — Uploads are validated and re-encoded via `sharp`; downloads are authorized by `fileAccessPolicy`, never served by raw path. |
| **Rate limits** | `lib/rateLimit.ts` | **SEC-4** — MySQL-backed `checkRateLimit` is the production implementation. The in-memory fixed-window store is test-only. |
| **i18n** | `i18n/*.ts` (en, ta, hi, te, kn, ml) | **I18N-1** — No user-facing string is hardcoded in a component. Add the key to `i18n/en.ts` first; `npm run i18n:check` reports gaps. **I18N-2** — A key lands in **all six** locales in the **same commit**; an English value copied into `ta.ts` is a missing translation, not a translation. **I18N-3** — `npm run i18n:scan` lists literal English still sitting in JSX; the count is a debt figure that must go down, never up. Options, status labels, table headers, placeholders, `title`/`aria-label` and toast text are user-facing. |
| **Config** | `lib/env.ts`, `lib/config.ts`, `AppSetting` | **CFG-1** — Per-tenant behaviour is an `AppSetting` read via `getSetting()` (cached, invalidated by `setSetting()`), **not** an env var. Env vars are per-deployment only. |
| **Feature flags** | `lib/features.ts` | **CFG-2** — Behaviour flags live here and default **off**, so an existing tenant is never affected by a new flag landing. Billable capabilities live on `TenantSubscription`, not here. Register every UI-reachable flag in `FEATURE_FLAG_KEYS`. |
| **Logging** | `lib/logger.ts` | **LOG-1** — Use `logger`. Legacy `console.*` calls exist; do not add more. Never log secrets, tokens or PII. |

---

## 14. Testing & quality gates

Tests are **`tsx` scripts using `node:assert/strict`**, run via npm scripts. There is no Jest/Vitest. Playwright covers UI e2e.

```
tests/                    unit + integration (tsx scripts)
tests/e2e-business/       business-flow integration against a real DB
tests/e2e/, e2e/          Playwright UI
```

Key commands:

| Command | Scope |
|---|---|
| `npm run typecheck` | `tsc --noEmit` — must be clean |
| `npm run test:ci` | 17 suites: repayments, **calculation logic**, calculator, interest-only, roles, branch scoping, approvals, security, **money-core**, **routing-core** |
| `npm run test:calc` | 184 declarative money cases + the HTML page. Formulas: `docs/CALCULATION_LOGIC.md`. For a non-Claude agent: `tests/calc/AGENT_RUNBOOK.md` |
| `npm run test:money-core` | Origination integrity, atomicity, posting/dedup, contract numbering, wallet float |
| `npm run test:routing-core` | Proxy public paths, module routing, subscription lifecycle, file-upload safety |
| `npm run test:full-regression` | CI set + parity, RBAC, autofinance, dashboard |
| `npm run test:e2e-final` | Full business e2e + UI critical path |
| `npm run test:chits` / `test:gold` | Module suites |
| `npm run test:coverage` | c8 thresholds: 40% lines/statements, 45% functions, 60% branches |

- **TEST-1** — A change to money logic MUST ship with a test asserting the numbers. `tests/originationPosting.test.ts` is the model: pure function, exact expected values, an assertion that invalid input throws.
- **TEST-2** — Write logic as a **pure function in `lib/`** so it can be tested without a database. If a rule can only be tested by standing up MySQL, it is in the wrong place. `calculateChitAuction`, `calculateProvisioning`, `determineCategory`, `buildOriginationPostingPlan`, `effectiveMinDiscountPct` are all pure for exactly this reason.
- **TEST-3** — A bug fix MUST add the test that would have caught it, in the same commit.
- **TEST-4** — New npm test scripts MUST be reachable from `test:ci` or `test:full-regression`. **An unreferenced test script does not exist** — 24 of them were orphaned at one point, including every origination and wallet test. Verify reachability, do not assume it.
- **TEST-5** — CI (`.github/workflows/pr-quality.yml`) runs: `db:generate` → `typecheck` → `db:push` → `db:seed` → `test:ci` → `npm audit --audit-level=high` → `test:coverage`, plus gitleaks secret scanning. Do not merge red. Do not lower a coverage threshold to make a build pass.
- **TEST-6** — The pre-push hook (`npm run hooks:install` → `scripts/self-heal/healer.mjs`) is the local gate. Do not `--no-verify`.

---

## 15. Deployment & configuration

- `output: 'standalone'`, build = `prisma generate && next build && node scripts/postbuild.js`.
- Security headers and CSP are defined in `next.config.ts`. **DEPLOY-1** — Any new external origin (CDN, API, font host) MUST be added to the CSP there, and justified in a comment, as the existing `unpkg`/OpenStreetMap/Supabase entries are.
- `basePath` is env-driven (`NEXT_PUBLIC_BASE_PATH`); build URLs with the helpers in `proxy.ts` / `lib/public-path.ts`, never by concatenation.
- Tenant resolution by host: **custom domain first** (`Tenant.customDomain`), then subdomain slug of `NEXT_PUBLIC_ROOT_DOMAIN`. Reserved slugs: `www, api, admin, app, portal, support, static, assets`.
- Suspended tenants: `getCurrentTenantId()` calls `assertTenantSubscriptionAccess()` on server actions and non-billing paths, so an unpaid tenant hits the payment wall but can still reach billing.
- **DEPLOY-2** — Secrets live in the deploy environment. `.env*` files in this repo are for local development; never commit a real secret (gitleaks runs on every PR).
- **DEPLOY-3** — Deployment procedure is `deploy/README.md` and `docs/DEPLOYMENT.md`; migration procedure is `docs/MIGRATIONS.md`. Update them when the procedure changes.
- **DEPLOY-4** — The VPS deploy script runs **`npx prisma db push --accept-data-loss`**, not `prisma migrate deploy`. Consequences, all verified in production on 2026-08-25:
  - `_prisma_migrations` on prod is **stale** (last row `20260808090000`). Migration files are not the source of truth there; `schema.prisma` is.
  - A migration's **data steps — backfills, collapses, seeds — never run in production.** `db push` only reconciles shape. Ship any data step as a script under `scripts/` and run it by hand, before the deploy that changes the shape.
  - `--accept-data-loss` makes destructive DDL **silent**. See ORIG-4: never let a schema change require one.
  - A `db push` that adds a UNIQUE index **hard-fails** if duplicate rows exist. Dedupe first, in a script, as part of the same manual step.
  - A schema field with no migration behind it still works in production (`db push` infers it) while breaking every environment that uses `migrate deploy` — CI, a fresh deploy, a developer's local database. `LoanPackage.branchId` shipped that way and went unnoticed for exactly this reason. **Every `schema.prisma` change still needs its migration file.**

---

## 16. Change protocol

### 16.0 Change discipline — the standing rules

This system is live and carries other people's money. The default answer to
"should I change this?" is **no**. New capability is added *alongside* what
ships, never by reshaping it.

- **STABLE-1 — Shipped behaviour is frozen.** Change existing logic only to fix a
  defect that is *demonstrated*: a failing test, a reproduction, or a rule in this
  document it contradicts. Never to tidy, restyle, rename, "simplify" or
  modernise. A refactor that changes no behaviour still risks the behaviour it
  claims to preserve — it needs the same justification as a fix.
- **STABLE-2 — New capability is additive and defaults to today.** Every new
  column, flag, setting or parameter carries a default that reproduces current
  behaviour exactly, so a migration is a no-op for existing rows and an untouched
  tenant sees no change. Gate anything that alters a user-visible flow behind a
  per-tenant flag (`lib/features.ts`), off by default.
- **STABLE-3 — The four scoping axes are frozen** (§5). No new query, route,
  action or component may widen `tenantId`, `appType`, `branchId` or role scope,
  and none may exempt a privileged role from branch scope (SCOPE-15). Tenant
  isolation has collapsed here before; it does not get a second chance.
- **STABLE-4 — Nothing is hardcoded.** Rates, fees, day counts, caps, grace
  periods, cadences, limits, thresholds and labels come from `AppSetting` /
  `TenantSubscription` / the loan's own snapshot / the dictionary — never from a
  literal in a route, action or component. A magic number in business logic is a
  defect even when it is currently correct.
- **STABLE-5 — Every user-visible string is translated.** New copy goes into
  `i18n/en.ts` **and** all five other locales (`ta`, `hi`, `te`, `kn`, `ml`) in the
  same commit, plus `mobile/lib/core/l10n/app_strings.dart` where mobile shows it.
  `npm run i18n:check` must pass. An English literal in JSX is untranslatable for
  every non-English tenant and counts as an incomplete change (I18N-1).
- **STABLE-6 — The money maths is guarded before and after.** `npm run test:calc`
  is green before you start and green when you finish. If a change makes a case
  fail, either the change is wrong, or the rule genuinely moved — and then this
  document, `docs/CALCULATION_LOGIC.md` and the case move in the same commit
  (DOC-1).
- **STABLE-7 — UI charts and metrics must never overflow or bleed.** Chart heights must
  scale against the maximum of all plotted series (both collected and expected), clamp bar
  heights within 0–100%, clip child elements with `overflow: hidden`, and support responsive
  layouts on mobile and desktop without unstyled column squishing (UI-1).
- **STABLE-8 — Calculations are done on the server; clients only render.** Every
  money, float, capital, shortfall, total or count a screen shows is computed by
  a `lib/` function and delivered through the API. The Flutter app and the web
  client display those values — they never derive one figure from others, not
  even a comparison such as "payout > float". A screen that needs a new figure
  gets a new API field, never local arithmetic (MONEY-1, FUND-1, X-29).

### Adding an API endpoint
1. `/api/v1/<resource>/route.ts` (or a permanent `/api/*` namespace — §8).
2. `requireMobileContext` → role check → `tenantId` + `appType` + branch scope in the `where`.
3. Validate input; return `fail(msg, status)` with the correct code (API-4).
4. Business logic in `lib/`; response via `ok()`.
5. Update the Flutter client if it consumes it (API-7); add to the parity test.

### Adding a field to a model
1. Edit `prisma/schema.prisma`; create a migration (DB-14, DB-15).
2. Consider `tenantId`/`appType`/`branchId` (DB-16).
3. Update creates/updates, the API shape, the UI, and any report builder that lists the model.
4. If it holds PII: encrypt + mask (SEC-1).

### Adding a report
1. One builder file in `lib/reports/builders/`.
2. Register it in the report catalog; `tests/reportCatalog.test.ts` guards registration.
3. Scope by all four axes (§5).

### Adding a module
1. `types/modules.ts` only (MOD-2).
2. Route allow-list, gating (MOD-1), seed data, module pricing catalog.
3. Do not fork the loan lifecycle — `property` and `productfinance` reuse it and only add collateral models.

### Touching money
1. Read the relevant part of §10 in full.
2. Pure function in `lib/` + test with exact numbers (TEST-1, TEST-2).
3. Single transaction, `tx` threaded through (DB-5, DB-7).
4. A database-enforced duplicate guard (DB-9).
5. Cash book **and** GL (ACC-6). Wallet float if cash moves (MONEY-17).
6. Audit row in the same transaction (SEC-2).
7. Notify only **after** commit (NOTIF-1).

### Touching chits
1. Read §10.9 in full — the state machine is the hard part, not the arithmetic.
2. Money maths goes in `calculations.ts` (pure); state transitions go in the shared `*InTx` functions.
3. Respect the two gates: the security gate before payout (CHIT-15, CHIT-17), and the activation gate before a group goes live (CHIT-27).

---

## 17. Forbidden patterns

Each of these has shipped a bug in this repository.

- **X-1** — A `where` clause without `tenantId`.
- **X-2** — A `where` clause without `appType` on a `SCOPED_MODELS` model, unannotated.
- **X-3** — Widening branch scope beyond `{ branchId }` (e.g. OR-ing `branchId: null`).
- **X-4** — Reading `branchId`/`role`/`appType` off the session object instead of the resolvers.
- **X-5** — Trusting `proxy.ts` as the authorization boundary.
- **X-6** — A money mutation outside a transaction, or a partial write path where one step can commit without the others.
- **X-7** — Inline schedule/interest/penalty/dividend arithmetic in a route handler, action or component.
- **X-8** — Hardcoded 4-digit account codes, or a second posting-key registry.
- **X-9** — Hardcoded module lists, role rank tables, chit status literals, or route strings.
- **X-10** — `new PrismaClient()` outside `lib/db.ts`.
- **X-11** — Hand-built API response objects on `/api/v1/*`.
- **X-12** — Returning `403`/`200` where the record is simply out of scope (must be `404`).
- **X-13** — Logging or returning PII, tokens or secrets.
- **X-14** — Suppressing `InsufficientFloatError`, `AccountingConfigurationError`, or `IMMUTABLE_RECORD`.
- **X-15** — Mutating or deleting `NpaHistory`; deleting `LoanProvisioning`; restamping `npaClassifiedAt`.
- **X-16** — Retroactively changing an originated contract's terms instead of writing a new snapshot version.
- **X-17** — Paying a chit prize without passing `assertCanReleasePrizePayout`, or activating a registered group without `validateChitGroupActivation`.
- **X-18** — A read-then-write duplicate check where a UNIQUE constraint is available (DB-9).
- **X-19** — Calling a notification inside a money transaction, or letting a notification failure fail the operation.
- **X-20** — Writing Next.js framework code from memory instead of reading `node_modules/next/dist/docs/` (NEXT-1); adding a `middleware.ts` (NEXT-2).
- **X-21** — Committing a test that is not reachable from a CI runner script.
- **X-22** — Lowering a coverage threshold or `--no-verify`-ing a hook to get green.
- **X-23** — Creating an `ApprovalRequest` without a paired `notifyApprovers()` call, or gating that call on the entity/request type (NOTIF-9).
- **X-24** — Exposing or returning developer credentials/accounts to non-developer roles (`superadmin`, `admin`, `agent`) in user management APIs, lists, or pickers (ROLE-6).
- **X-25** — Allowing agents to directly edit or modify collection payments without admin/superadmin approval (`edit_collection`), or calling `submitCollectionEntry` inside a transaction or for a payment correction (ROLE-7, MONEY-21).
- **X-26** — Unbounded bar charts or graph heights that scale solely off expected amount without tracking collections, or lacking overflow protection on bar containers (UI-1).
- **X-27** — Inflating subscription plan pricing cards with per-module multipliers or tenant add-ons instead of showing the authoritative developer subscription plan catalog price (PLAN-1).
- **X-28** — Allowing historical collections (`cYesterday`) or cumulative lifetime collections (`cTotal`) to spill over into today's instalment (`dueDate === today`) or future instalments in payment distribution helpers (`getDistributedInstalmentsAndMetrics`), which falsely causes unpaid today instalments to appear 'paid' and inflates 'collected today' metrics on Collection Entry and the Dashboard when zero payment was collected today (MONEY-22).
- **X-29** — Computing or comparing money/float figures in a client (Flutter or web component) instead of rendering the API's server-computed value (STABLE-8).
- **X-30** — Writing a staff notification with a bare `prisma.systemNotification.create` (no push, often invisible), sending an FCM `imageUrl` that is not an `https://` URL (kills the batch and prunes the tokens), or deciding "show Approve/Reject" from the words in a title instead of the server's `canAct` (NOTIF-14, NOTIF-15, NOTIF-16).

---

## 18. Known debt and live deviations

Recorded so it is not mistaken for a pattern to copy. Items marked **VIOLATION** contradict a rule above and should be fixed when the area is next touched.

| Item | Status |
|---|---|
| Two API namespaces (`/api/*`, `/api/v1/*`) | **Resolved as a boundary, not a duplication.** Verified: exactly one origination path (`/api/v1/loans`), no duplicated business logic. §8 now lists permanent vs frozen namespaces (API-1, API-8) |
| `POSTING_MAP` / `lib/accounting/postings.ts` | **Deleted.** It was dead on arrival; `postingKeys.ts` is the single registry (ACC-2). `buildDedupKey` was salvaged from it and wired up |
| GL duplicate suppression by narration scan | **Fixed.** All five `autoPost*` paths now write `sourceId` + `dedupKey` and rely on the UNIQUE index, with the narration scan kept only as a legacy pre-check (ACC-5, DB-10) |
| `appScope()` helper with zero call sites | **Deleted.** The rule (SCOPE-2) is universal; the wrapper added nothing over `{ tenantId, appType }` and advertised a convention nobody followed (SCOPE-8) |
| 24 orphaned test scripts | **Partly fixed.** The 9 money- and routing-critical ones are now in `test:ci` via `test:money-core` / `test:routing-core`. The rest (`test:ml-*`, `test:gps`, `test:dashboard-kpi`, `test:links`, e2e variants) are still unreferenced — wire or delete them (TEST-4) |
| NPA audit rows written outside the transaction | **VIOLATION of SEC-2.** `npaClassifier.ts` and `npaUpgrade.ts` write `auditLog` after their `$transaction` commits, so a crash between the two loses the audit trail. Fix when next touched |
| NPA unchanged-branch writes are non-transactional | **VIOLATION of DB-5.** The "nothing changed" path does two independent writes (loan review date, provisioning snapshot) outside a transaction |
| `notify()` customer messages exist only in en/ta/hi | `te`, `kn`, `ml` are accepted as languages but silently fall back to English in `MESSAGES`. DB templates can cover the gap per tenant |
| Mobile i18n gaps (ta/hi/te/kn/ml) | CI check is non-blocking pending native-speaker translation |
| Mixed `console.*` and `logger` | New code uses `logger` (LOG-1) |
| No test framework (raw `tsx` + `assert`) | Deliberate for now; keep tests as standalone scripts (TEST-2) |
| `lib/foreclosure.test.ts` lives in `lib/` | Legacy exception (STRUCT-4) |
| `.planning/codebase/*.md` | Stale, banner-marked, superseded (DOC-3) |
| Settings → Data wipe and `/api/backup/export` scoped by `tenantId` only | **Fixed.** Both now scope `{ tenantId, appType, ...branch }`; wiping on one branch no longer deletes every branch and module (SCOPE-2, SCOPE-3) |
| Branch admin with `branchId: null` resolved to "All Branches" | **Fixed (fail closed).** `resolveUnbranchedAdminBranch` (`lib/branchScope.ts`): no active branch → null, one → that branch, several → `UNBRANCHED_ADMIN_ERROR` (403 on web API and v1). `manageMasterUser` refuses to save an admin without a branch. Repair existing rows with `scripts/backfill-admin-branch.js` **before** deploying |
| By-id lookups with `tenantId` only (no `appType`/branch) | **Fixed.** Loan lookups by id use `loanAccessWhere` (`lib/loanPolicy.ts`): repossession, property-release, gold receipt, NACH (loan, mandate list/detail/cancel, present — which now also requires the instalment to be on the mandate's loan), foreclosure calc + settlement letter, HP receipt. Also reset-password, collection runs (`runAccessWhere`), finance-partner actions, vehicle create/update/flag, GPS latest-location, collection-receipt (web + v1, which also had an agent `OR` overwriting the id `OR`) |
| Unscoped lists/aggregates | **Fixed.** Finance-partner pickers (web) and partner validation on `POST /api/v1/loans` now match the branch-scoped Finance Partners page; gold report weights scope through the loan; day-close is per branch as its UNIQUE key always said ("All Branches" gate counts any branch's close) |
| Superadmin/developer exempt from branch scope | **Fixed (SCOPE-15).** `lib/npa/npaService.ts`, `scopedChitGroupWhere` (`lib/chits/access.ts`), chit payment intents, and the v1 approve/reject/settle/waive routes each exempted privileged roles; all now use the active branch for every role |
| Mobile had no branch switcher | **Fixed.** Superadmins switch branch from the app-bar title (`mobile/lib/shared/widgets/branch_switcher.dart`), fed by `GET /api/v1/auth/me/branches` — the same list as the web header (`getSuperadminBranches`, plus "All Branches" when there are two or more). The choice is sent as `X-Branch-Id`; switching clears domain caches and re-emits auth state so providers refetch. Before this a superadmin on mobile was pinned to their home branch. The same pass scoped `v1/customers/[id]/loans`, `v1/loans/[id]/instalments`, `v1/loans/[id]/print/[doc]`, chit payment-intent review and GPS idle-check. `v1/guarantors/check-aadhaar` stays tenant+module-wide on purpose: it is a duplicate-identity check across branches |
| `tests/desktopMobileParity.test.ts` §3 | Fails on `app/api/v1/routes/route.ts`: it text-matches `scopedBranchWhere(ctx)`, but the route now delegates to `routeWhere` in `lib/routes/service.ts`, which scopes correctly. Stale assertion, pre-existing |
| Duplicated `extractTenantSlugFromHost` in `proxy.ts` and `lib/tenant.ts` | Intentional — the proxy runs in a restricted runtime. Keep both in sync if either changes |
