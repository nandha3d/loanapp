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

A tenant runs one or more **modules** (verticals). All six share the same customer/loan/collection/accounting spine:

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
- **SCOPE-4** — Unbranched records (`branchId: null`) are visible to superadmins/developers only. That is the safe failure direction. Orphans are a **data** problem, repaired by backfill scripts (`scripts/backfill-customer-route-agent.js`, then `scripts/backfill-loan-branch.js`) — never by widening a `where` clause.
- **SCOPE-5** — Agents scope by **customer linkage**, not by branch (`buildAgentCustomerAccessWhere` in `lib/loanPolicy.ts`, route assignments via `getAgentRouteIds` in `lib/access.ts`). Pinning an agent to a branch falsely hides their own customers' loans.
- **SCOPE-6** — Resolve `branchId` with `getActiveBranchId()`, never from `session.user.branchId`. The session copy goes stale when a user is moved and it ignores the superadmin branch switcher entirely.
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

### 7.2 Agent restrictions

Agents are field staff on shared devices. They may: create customers (pending review), view their route's collection schedule, submit collections, originate loans **if** `bypassLoanApproval` is set. They may not: edit or delete customers, see the dashboard/reports/penalties/settings/accounting/analytics, or switch modules.

- **ROLE-4** — `AGENT_BLOCKED` in `proxy.ts` is a **redirect convenience, not a security control**. Every blocked capability MUST also be refused server-side by the handler.
- **ROLE-5** — Agent permission toggles (`bypassLoanApproval`, `autoReleaseFloat`) MUST NEVER gate non-agent users. Non-agents keep full privilege unconditionally — see the explicit branch in `app/api/v1/loans/route.ts`.

### 7.3 Module gating

- Enabled modules resolve per **branch** and per **user** (`getActiveModules()` → `getBranchEnabledModules` / `getUserModulesForBranch`).
- **MOD-1** — A module-specific route or action MUST call `assertModuleEnabled(module)` (`lib/moduleGate.ts`). Rendering a hidden nav item is not gating.
- **MOD-2** — Adding a module means updating `ALL_MODULES`, `MODULE_LABELS`, `MODULE_SLUGS`, `MODULE_ROUTES` in `types/modules.ts` — and nothing else may hardcode a module list.
- **MOD-3** — Staff URLs are module-prefixed: `/[module]/loans`. Build them with `modulePath()` / `prefixDashboardHref()`; parse them with `parseModulePath()`. Never string-concatenate a module route.

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
- **API-2** — Never construct a v1 response by hand. Use `ok()` / `fail()` from `lib/api/v1-envelope.ts`, so the mobile client's single decoder keeps working.
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

### 10.3 Repayment allocation — `lib/repayments.ts`

- **MONEY-10** — Loan-level fill order is **today's due first, then overdue oldest-first, then future soonest-first** (`orderInstalmentsForCollectionFill`). Paying today's amount keeps today clean even when a backlog exists. This is a deliberate business decision, not an accident of sorting — do not "fix" it to strict-oldest-first.
- **MONEY-11** — Instalment status is derived, never hand-set: `paid` / `partial` / `missed` / `upcoming` / `waived`. Loan status is derived by `resolveLoanStatus()`.
- **MONEY-12** — Schedules MUST NOT be modified once `hasFinancialActivity(loanId)` is true.
- **MONEY-13** — Collection writes are idempotent through `buildCollectionIdempotencyKey()` — `(tenantId, agentId, instalmentId, amount, mode, date)`. A retried mobile submission must not double-post. Never bypass it.

### 10.4 Penalties — `lib/penalties.ts`

- **MONEY-14** — Accrual = `Σ max(0, daysOverdue − grace) × penaltyPerDay`, capped by `maxCap` when non-zero. Per-tenant settings: `default_penalty_per_day`, `penalty_grace_period`, `penalty_max_cap`. **This describes `calculatePenaltyAccrual` (the cron) only.** A second accrual, `ensurePendingPenaltiesForMissedLoans`, runs on every dashboard load, the penalties page and `GET /api/penalties`, and computes `count(missed instalments) × Loan.penaltyRate` — no grace, no cap — writing the same `Penalty.grossPenalty` rows, where the larger figure wins. Opening a page can therefore push a borrower's penalty past the tenant's configured cap. Live divergence, documented in `docs/CALCULATION_LOGIC.md` §14.1; one of the two has to move.
- **MONEY-15** — Recorded gross penalty only ever **increases** (`shouldUpdatePenaltyGross`). Reductions are waivers, recorded as `waivedAmount` — never by rewriting gross. The accrual job runs inside a transaction to prevent duplicate penalty rows.

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

### 10.6 Accounting — `lib/accounting/`

Double-entry general ledger: `Account` (4-digit codes) → `JournalEntry` → `JournalLine`, with `AccountBalance` maintained by `bumpAccountBalance`.

- **ACC-1** — Account codes are resolved through `POSTING_DEFAULTS` (`lib/accounting/postingKeys.ts`) with per-tenant overrides from `AccountingSettings.postingOverrides` (JSON). Never hardcode a 4-digit code in business logic.
- **ACC-2** — `postingKeys.ts` is the single posting-key module: default codes, `buildDedupKey`, `isDuplicateJournalEntry`. (A parallel `POSTING_MAP` in `postings.ts` was dead on arrival and has been deleted — do not resurrect a second key registry.)
- **ACC-3** — A posting plan MUST balance. `buildOriginationPostingPlan` throws on unbalanced debit/credit and on payout legs that do not sum to the disbursed amount. Keep every new posting builder pure and testable the same way.
- **ACC-4** — Statutory accounting is a **billable add-on**. Tenants without it keep base cash-book behaviour. `postLoanOrigination` checks the subscription and returns `null`; `autoPost*` checks `isPremiumAccountingEnabled` — new posting code MUST respect the same gate.
- **ACC-5** — Auto-generated journal entries MUST set `sourceType`, `sourceId` and `dedupKey` (DB-10). The unique index is the guard; the narration-tag scan in `autoPost.ts` is a legacy fallback for pre-`dedupKey` rows and must not be relied on for new paths.
- **ACC-6** — Cash book (`AccountEntry`) and GL (`JournalEntry`) are **both** written for a money event. They are different ledgers for different audiences; writing only one is a bug.
- **ACC-7** — `autoPost*` functions are fire-and-forget and swallow their own errors by design — a GL failure must never roll back the operational record. That is precisely why they cannot be the *only* place a money event is recorded (ACC-6).

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

Endpoints under `app/api/cron/`: `accrue-penalties`, `dunning`, `npa-classify`, `nach-present`, `send-reminders`, `send-reports`, `reports`, `recompute-balances`, `subscription-reminders`, `chit-auction-reminders`, `gps-purge`, `affiliate-sync`. Triggered by GitHub Actions (`.github/workflows/daily-cron.yml`, 18:30 UTC = midnight IST) and/or host cron.

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

### 12.2 Staff-facing — `notifyUser()` / `notifyApprovers()` in `lib/notify/`

Creates in-app `SystemNotification` rows and pushes to devices via FCM.

- **NOTIF-4** — Notifications are **always per-user**: a role broadcast fans out into one row per matching user, each with its own read state. Never write a single shared "role row" — one user reading it would mark it read for everyone.
- **NOTIF-5** — `notifyUser()` returns the number of users reached so callers can detect a broadcast that landed on nobody and fall back rather than dropping it.
- **NOTIF-6** — `notifyApprovers()` is the only correct way to raise an approval. It notifies admins on the **record's** branch, unbranched admins, and — only when the filer is an **agent** — the admins of that agent's own branch. Superadmins are always notified tenant-wide. There is **no** all-admin fallback: when no admin matches, that is logged and the superadmins carry it. Both removed widenings sent one branch's approvals to another branch's bell, for records the recipient's queue (scoped by SCOPE-3) would not even open — a superadmin files for every branch, so honouring a non-agent filer's branch pinged their branch's admin about all of them, and the fallback sprayed customer names and amounts tenant-wide.
- **NOTIF-7** — This wider *reach* never widens *visibility*. Who can SEE a record stays pinned to `branchScopeWhere` (SCOPE-3, SCOPE-10).
- **NOTIF-8** — Both helpers swallow their own errors per stage (recipient resolution, in-app write, push dispatch) so one broken channel cannot take down the others.
- **NOTIF-9** — Creating an `ApprovalRequest` and notifying approvers are **one step**. Every `approvalRequest.create` is paired with a `notifyApprovers()` call on the same path, unconditionally — never gated on the entity type, the request type, or how the request arrived. A request the queue holds but nobody was told about is invisible until someone happens to open the Approvals page. `tests/approvalNotifications.test.ts` guards the pairing.
- **NOTIF-10** — Pass `branchId` (the record's branch), `requesterBranchId` (the filer's) and `requesterRole` as three separate values. Collapsing the two branches with `||` silently drops the admins of whichever branch lost; omitting the role makes the filer's branch inert, since it only widens the fan-out for an `agent`.
- **NOTIF-11** — Push (FCM) is **per-deployment configuration, not code**: without `FIREBASE_SERVICE_ACCOUNT_BASE64` server-side, `sendPushToUsers` is a documented no-op, and without `NEXT_PUBLIC_FIREBASE_*` + `NEXT_PUBLIC_FIREBASE_VAPID_KEY` no browser ever registers a `DeviceToken`. The in-app bell (30s poll) is then the only live channel. Verify both before diagnosing a missing notification as a code bug.

---

## 13. Cross-cutting concerns

| Concern | Where | Rule |
|---|---|---|
| **PII** | `lib/pii.ts` | **SEC-1** — Aadhaar and equivalent identifiers are encrypted at rest (`encryptField`/`encryptAadharNumber`) and masked in any UI or export (`maskAadharNumber`). Never log raw PII; `redactPii()` in `lib/audit.ts` before writing audit values. |
| **Audit** | `lib/audit.ts`, `AuditLog`, `createChitAudit` | **SEC-2** — Every state change to a loan, customer, user, payment, chit or setting writes an audit row **inside the same transaction** as the change. |
| **Files** | `lib/fileUpload.ts`, `lib/fileAccessPolicy.ts` | **SEC-3** — Uploads are validated and re-encoded via `sharp`; downloads are authorized by `fileAccessPolicy`, never served by raw path. |
| **Rate limits** | `lib/rateLimit.ts` | **SEC-4** — MySQL-backed `checkRateLimit` is the production implementation. The in-memory fixed-window store is test-only. |
| **i18n** | `i18n/*.ts` (en, ta, hi, te, kn, ml) | **I18N-1** — No user-facing string is hardcoded in a component. Add the key to `i18n/en.ts` first; `npm run i18n:check` reports gaps. |
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
| `npm run test:calc` | 173 declarative money cases + the HTML page. Formulas: `docs/CALCULATION_LOGIC.md`. For a non-Claude agent: `tests/calc/AGENT_RUNBOOK.md` |
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
| Duplicated `extractTenantSlugFromHost` in `proxy.ts` and `lib/tenant.ts` | Intentional — the proxy runs in a restricted runtime. Keep both in sync if either changes |
