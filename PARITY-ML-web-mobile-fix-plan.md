# PARITY-ML — Micro Lending web ↔ mobile parity fix plan

Source: 18-page read-only audit, 2026-10-01 (web `app/(dashboard)/[module]/**` vs Flutter `mobile/lib/**`, `appType === 'microlending'`).
Audience: an implementing agent that takes **one task at a time**. Each task is self-contained: problem, exact files, steps, how to verify.

---

## 0. Rules for every task (read before starting)

1. Read `ENGINEERING_REFERENCE.md` §0–§5 and §16.0 once. For any task tagged **MONEY**, also read §10 in full. Cite rule ids (SCOPE-3, MONEY-10, API-8 …) in your commit message.
2. Run `npm run test:calc` **before** and **after**. It must be green both times. It rewrites `test-report/calculation-logic.html`; commit that file only if your task changed calculation output.
3. Line numbers below were correct on 2026-10-01 (HEAD `4d834cc`). Code moves. **Always re-locate with grep** using the quoted snippet before editing.
4. One task = one commit. Do not fix "nearby" things. Do not refactor or rename beyond the task.
5. Every new user-visible string ships in **all six locales**: web `i18n/{en,hi,kn,ml,ta,te}.ts`, mobile `mobile/lib/core/l10n/app_strings.dart` (STABLE-5).
6. No new dependencies. Reuse helpers named in the task (`scopedBranchWhere`, `branchScopeWhere`, `startOfBusinessToday`, `buildSystemNotificationWhere`, `canCollectForLoanStatus`, `_toDouble`/`_num`, …).
7. Never hardcode values that exist as settings (STABLE-4).
8. If a task changes a rule written in `ENGINEERING_REFERENCE.md`, update that doc in the same commit (DOC-1). Tasks that need this say **DOC-1**.
9. **Uncommitted WIP exists** in `lib/wallet.ts`, `lib/cashSettlement.ts`, `prisma/schema.prisma` (CashHandover appType/branchId) and migration `20260930000000_cash_handover_scope`. Tasks tagged **WIP-DEP** touch that area: check `git status` first; if the WIP is still uncommitted, stop and ask the owner.
10. If the code does not match the task description (already fixed, different shape), **stop and report**; do not improvise.
11. Prisma `Decimal` fields arrive in mobile JSON as **strings**. In Dart never write `json['x'] as num`; use the file's existing `_toDouble`/`_num`/`_d` helper or `num.tryParse('${json['x']}') ?? 0`.
12. Server TZ is UTC; business TZ is IST. "Today" on the server must come from `lib/businessTime.ts` (`startOfBusinessToday`, `startOfBusinessTomorrow`, `startOfBusinessDayUtc`). Dart: parse server timestamps then `.toLocal()`; send dates as `toUtc().toIso8601String()` or `yyyy-MM-dd`.

Verification commands available: `npm run test:calc`, `npm run test:ci`, `npm run test:mobile-parity-api` (API-7: run whenever a v1 response shape changes), `npx tsc --noEmit`, `cd mobile && flutter analyze`.

---

## 1. Owner decisions (2026-10-01) — binding for this plan

| # | Topic | Decision | Tasks |
|---|---|---|---|
| D1 | Accounting projected revenue / P&L | **Web is correct**: count loans in **every status**. Mobile must match web. | ACC-01 |
| D2 | Gross NPA | **Include SMA-0/1/2** in Gross NPA on **both** web and mobile. | NPA-01 (DOC-1) |
| D3 | Single payment / bullet loans | Both web and mobile can create **Single payment** and **Bullet** loans; both appear under a **"Custom loans"** group in the plan/frequency picker. | LOAN-02 (DOC-1) |
| D4 | Closed loans in lists | Add a **"Hide closed loans" toggle** on web and mobile loans lists. Default **on** (closed hidden) on both. | LOAN-01 |
| D5 | KYC status in customer edit form | **Admins** (admin/superadmin/developer) on **web and mobile** may set KYC status directly from the edit form. Agents may not. | CUST-06 (DOC-1) |
| D6 | Agent penalty waiver | Agents **cannot** waive with a manager's password (web or mobile). An agent can only **request** a waiver; admin/superadmin approves. | PEN-01, PEN-03 (DOC-1) |
| D7 | "Active loan" on customers list | Count/display loans that are **not closed**, defined as status **active or overdue** (`COLLECTIBLE_LOAN_STATUSES`), same on web and mobile. | CUST-01 |

### Answered 2026-10-01 → see `docs/fixes/PARITY-ML-owner-decisions-2.md` (tasks DEC-01 … DEC-07). The table below is kept for history; follow the DEC tasks, not "blocked" notes in this file.

| # | Question | Blocks |
|---|---|---|
| Q1 | Preclose payoff: web `principal − collected + penalty − discount` (e.g. ₹7,000) vs mobile/agent-request `totalPayable − collected` (₹9,000). Which is the payoff? | LD-05 |
| Q2 | Missed-days definition on loan detail: does a part-paid past row count as "missed"? (web: no, server/mobile: yes) | LD-01 step 2 |
| Q3 | Money display: show paise (web) or whole rupees (mobile `decimalDigits: 0`)? | FMT-01 |
| Q4 | Web "New Loan" button on customer detail for agents (server allows agent origination; web hides it, mobile shows it). | CUST-07 step 4 |
| Q5 | Agent dashboard month-to-date figures: add to mobile or drop from web? | DASH-11 |
| Q6 | Penalty collections never post to wallet / cash book / GL. Intended? | — |
| Q7 | Mobile shows PAN unmasked; web hides PAN. Mask PAN? | — |

---

## 2. Task index (do in this order)

Severity: **H** = wrong money / scope leak / data loss / crash, **M** = missing data or action, **L** = label/format.
Size: S ≤ 20 lines, M ≤ 100 lines, L > 100 lines or multiple files.

| ID | Title | Sev | Size | Depends |
|---|---|---|---|---|
| **Phase A — security & scoping (no behaviour risk, do first)** |||||
| SEC-01 | Strip `passwordHash` from customer GET/PATCH responses | H | S | — |
| SEC-02 | Strip user secrets from `/api/v1/dashboard` recentActivity | H | S | — |
| SEC-03 | Scope `/gps/agent/[id]/collections` | H | M | — |
| SEC-04 | Block agents from `/reports/overdue` | H | S | — |
| SEC-05 | Scope NPA summary to module + branch | H | S | — |
| SEC-06 | Scope `GET /api/v1/admin/users` | H | S | — |
| SEC-07 | Fix v1 branch resolution (validation + superadmin default) | H | M | — |
| SEC-08 | Allow-list keys in `POST /api/v1/settings` | H | M | — |
| SEC-09 | Remove plaintext bureau editor on mobile | H | S | SEC-08 |
| SEC-10 | Scope notification mark-one-read | H | S | — |
| SEC-11 | Module/branch columns on NotificationLog | H | M | — |
| SEC-12 | v1 customer_edit approval: tenant/module/stale check | H | S | — |
| SEC-13 | Web approval actions: add module/branch guards | H | S | — |
| SEC-14 | Web wallet actions: add branch/module scope | H | S | WIP-DEP |
| SEC-15 | Remove mobile admin "Collect" cash button; scope UPI verify | H | S | — |
| SEC-16 | Self-pay: module filter + staff-only actions on web | H | S | — |
| SEC-17 | KYC: queue status list + review route gates | H | S | — |
| SEC-18 | Wallet agent lists: add `appType` | M | S | — |
| SEC-19 | GPS v1 read routes: subscription gate | M | S | — |
| SEC-20 | `deletedAt: null` on customer/loan by-id + customer list | M | S | — |
| SEC-21 | KYC method gate on v1 KYC routes | M | S | — |
| **Phase B — money & data loss** |||||
| MON-01 | Mobile "hand over cash" = pending handover (not instant deposit) | H | M | WIP-DEP |
| MON-02 | Mobile run settlement via `reconcile` | H | S | MON-01 |
| MON-03 | Block staff collecting on another agent's run | H | S | — |
| MON-04 | v1 approve/reject: atomic claim | H | S | — |
| MON-05 | Offline collection replay: one idempotency key | H | M | — |
| MON-06 | Remove mobile client cap on collect amount | H | S | — |
| MON-07 | Web "Pay" on partly-paid row must collect, not correct | H | S | — |
| MON-08 | Customer PATCH: ignore masked Aadhaar | H | S | — |
| MON-09 | Customer PATCH: KYC docs append-only | H | S | — |
| MON-10 | Web customer edit: stop deleting security cheques | H | S | — |
| MON-11 | Customer PATCH: update guarantors in place | H | M | — |
| MON-12 | Customer POST: save guarantors | H | S | MON-11 |
| MON-13 | Web customer form: keep company inputs mounted | H | S | — |
| MON-14 | Server phone/Aadhaar normalisation + validation | H | M | — |
| MON-15 | Admin user PATCH: keep unchanged fields | H | M | — |
| MON-16 | Journal approval: period lock + entry numbering | H | M | — |
| MON-17 | `/wallet/branch`: fix invalid Branch filter | H | S | — |
| MON-18 | Wallet release: 409 + shared guard | H | M | WIP-DEP |
| MON-19 | Loan POST: customer must be active | H | S | — |
| MON-20 | Due day validation (server + mobile values) | H | M | — |
| MON-21 | Mobile loan penalty default from setting | H | S | — |
| MON-22 | Loan edit PATCH: keep deduction + guarantor keys | H | S | — |
| MON-23 | Loan-edit approval applies `dueDay` | H | S | — |
| MON-24 | Use `totalPayable` for repayable totals (web list + detail) | H | S | — |
| PEN-01 | Shared `settlePenalty` / `waivePenalty`; agents blocked | H | M | — |
| PEN-02 | Mobile penalties: treat `partial` as open | M | S | PEN-01 |
| PEN-03 | Agent penalty-waiver request flow | M | M | PEN-01, MON-04 |
| **Phase C — crashes & "today"** |||||
| CRA-01 | Mobile Decimal-as-string crashes (journal, bank-rec, AF routes) | H | S | — |
| CRA-02 | Sweep remaining `as num` casts on API money fields | H | M | CRA-01 |
| CRA-03 | Guarantor relation: one shared list | H | S | — |
| TIM-01 | GPS route progress: IST day + `capturedAt` | H | M | SEC-03 |
| TIM-02 | Collection runs `startOfDay` → business day | M | S | — |
| TIM-03 | Analytics "today" → business day | M | S | — |
| TIM-04 | NPA summary reads latest snapshot | H | S | SEC-05 |
| TIM-05 | Web loan-detail collect modal: IST today | M | S | — |
| TIM-06 | Mobile: `.toLocal()` on server timestamps | M | S | — |
| TIM-07 | Mobile: send dates with offset / date-only | M | S | — |
| TIM-08 | Web server-rendered times: `timeZone: 'Asia/Kolkata'` | L | S | — |
| TIM-09 | v1 P&L default end = today | M | S | — |
| **Phase D — single source per page (parity core)** |||||
| DASH-01 … DASH-11 | Admin + agent dashboard | H/M | S–L | Phase A–C |
| COL-01 … COL-04 | Collection entry | H/M | M | MON-05/06 |
| LD-01 … LD-06 | Loan detail | H/M | M–L | MON-24 |
| CUST-01 … CUST-08 | Customers list/detail/form | H/M | S–M | MON-08…14 |
| LOAN-01 … LOAN-04 | Loans list / form | H/M | S–M | MON-19…23 |
| APR-01 … APR-03 | Approvals | M | S–L | MON-04, SEC-12/13 |
| KYC-01 | Mobile video KYC review via shared lib | H | S | SEC-17 |
| ACC-01 … ACC-04 | Accounting | H/M | S–M | — |
| WAL-01 … WAL-03 | Wallet | M | M | MON-01 |
| RUN-01 | Collection runs mobile gaps | M | M | MON-02 |
| RTE-01 | Route tracker mobile gaps | M | M | TIM-01 |
| RPT-01 … RPT-05 | Analytics / reports | H/M | S–M | — |
| NPA-01 … NPA-02 | NPA | H/M | S | SEC-05, TIM-04 |
| NOT-01 … NOT-04 | Notifications | M | S | SEC-10 |
| SET-01 … SET-06 | Settings | M | S–M | SEC-08 |
| **Phase E — polish** |||||
| I18N-01 | Hardcoded strings sweep | L | L | last |
| FMT-01 | Money display precision | L | S | Q3 |

---

## 3. Phase A — security & scoping

### SEC-01 — Strip `passwordHash` from customer GET/PATCH responses
- **Problem:** `GET /api/v1/customers/[id]` returns the whole Customer row incl. `passwordHash`; web passes it to a client component (reaches the browser). Agent PATCH reply also returns encrypted Aadhaar ciphertext. Rule X-13 / SEC-1.
- **Files:** `app/api/v1/customers/[id]/route.ts` (GET ~L66-118 `ok({...customer, ...})`; agent PATCH branch ~L235-256 `ok({...existing, ...})`).
- **Steps:**
  1. In GET, before `ok(...)`: `const { passwordHash: _ph, ...safe } = customer;` and build the response from `safe`. (Prisma 5.22 here has no `omit`.)
  2. In the agent PATCH branch, return only `{ pendingApproval: true, approvalRequestId, message }`. Mobile ignores the body (`customer_detail_screen.dart` ~L213-217, ~L312-317), web agent path does not read it — verify with grep for the call sites before changing.
- **Verify:** `npm run test:mobile-parity-api`; manual: GET a customer, JSON has no `passwordHash`.

### SEC-02 — Strip user secrets from `/api/v1/dashboard` recentActivity
- **Problem:** `auditLog.findMany({ include: { user: true } })` returns `passwordHash`, `totpSecret` of users to every caller incl. agents.
- **File:** `app/api/v1/dashboard/route.ts` ~L179-184.
- **Steps:** replace `include: { user: true }` with `include: { user: { select: { name: true } } }`. Mobile `RecentActivity.fromJson` (`mobile/lib/data/models/dashboard_summary.dart` ~L514-524) reads only `user.name` — confirm by reading it.
- **Verify:** `npm run test:mobile-parity-api`.

### SEC-03 — Scope `/api/v1/gps/agent/[id]/collections`
- **Problem:** no agent-scope check and no loan module/branch filter. Any admin can pass any agent id in the tenant (other module/branch) and get customer names, photos, amounts, GPS. Must be 404 (SCOPE-2/3/12/17.5, API-5).
- **Files:** `app/api/v1/gps/agent/[id]/collections/route.ts` ~L17-42; reference guard in `app/api/v1/gps/agent/[id]/route.ts` ~L20-24 (`gpsAgentWhere`); `lib/gps/routeProgress.ts` (~L4-12 `gpsAgentWhere`, ~L50-56 entry where).
- **Steps:**
  1. In `lib/gps/routeProgress.ts` export `gpsEntryWhere({ tenantId, appType, branchId })` returning `{ tenantId, loan: { tenantId, appType, ...branchScopeWhere(branchId) } }`; use it in its own collection query (~L50-56) so behaviour there is unchanged.
  2. In `collections/route.ts` copy the 3-line `gpsAgentWhere` lookup + `return fail('Not found', 404)` from `agent/[id]/route.ts`.
  3. Merge `gpsEntryWhere(ctx)` into the entries `where`.
  4. In `app/api/v1/gps/live/route.ts` ~L63-70 replace `entryWhere.loan = { appType }` with `gpsEntryWhere(...)`.
- **Verify:** `npm run test:mobile-parity-api`; add a case to `tests/branchScoping.test.ts` if it tests v1 GPS routes.

### SEC-04 — Block agents from `/api/v1/reports/overdue`
- **Problem:** no role gate → agent on mobile sees whole branch's overdue loans with phones (tenant-wide if agent has no branch). Siblings `reports/daily` and `reports/agent` already gate.
- **Files:** `app/api/v1/reports/overdue/route.ts` ~L10; `mobile/lib/features/reports/reports_screen.dart` (~L110-119 tabs).
- **Steps:** add `if (ctx.role === 'agent') return fail('Forbidden', 403);` exactly as in `reports/daily/route.ts`. Mobile: hide the Overdue tab when role is agent (same predicate the screen uses for `_canViewCatalog`).
- **Verify:** agent token → 403.

### SEC-05 — Scope NPA summary to module + branch
- **Problem:** `getTenantProvisioningSummary` filters `{tenantId, snapshotDate}` only → mobile NPA summary mixes all modules and branches. The NPA loan list next to it is scoped.
- **Files:** `lib/npa/provisioningCalculator.ts` ~L73-81; `lib/npa/npaService.ts` ~L45 (`getNpaSummary`).
- **Steps:** add optional `{ appType, branchId }` param; set `where.loan = { appType, ...(branchId ? { branchId } : {}) }` (relation `LoanProvisioning.loan` exists). Pass from `getNpaSummary` using the actor. Keep the cron/sweep caller unscoped (NPA-10).
- **Verify:** `npm run test:ci`.

### SEC-06 — Scope `GET /api/v1/admin/users`
- **Problem:** filters tenant only → mobile Team screen shows every branch and every module's staff. Web Users tab = active-branch agents of this module.
- **File:** `app/api/v1/admin/users/route.ts` ~L17-22.
- **Steps:** for non-developer callers add `appType: ctx.appType, ...scopedBranchWhere(ctx)`; for `ctx.role === 'admin'` also `role: 'agent'` (matches web `settings/page.tsx` ~L118-136).
- **Verify:** admin token → only own branch's module agents.

### SEC-07 — Fix v1 branch resolution
- **Problem:** `resolveScopeBranchId` (`lib/api/v1-auth.ts` ~L220-247): (a) accepts a branch the superadmin does not own or that is inactive (checks only `tenantId`); (b) `requestedBranchId === claims.branchId` skips validation; (c) bad header falls back to `claims.branchId` which can be `null` = All Branches (SCOPE-6); (d) superadmin with no header gets home branch/null, web gets first owned active branch by name (`lib/branch.ts` ~L16-55). Same user sees different data per device.
- **Steps:**
  1. In the superadmin `findFirst`, add `superadminId: claims.userId, status: 'active'` (developer keeps tenant-only).
  2. Remove the `=== claims.branchId` shortcut.
  3. When header absent/invalid for superadmin, return `getSuperadminBranches(...)[0]?.id` (exists in `lib/branch.ts` ~L126) — same default as web. Only an explicit `all` header returns `null`.
- **Verify:** extend `tests/branchScoping.test.ts` with: foreign branch header → falls back to default; no header → first owned active branch. `npm run test:ci`.

### SEC-08 — Allow-list keys in `POST /api/v1/settings`
- **Problem:** any admin can write any AppSetting key with any value (system keys are developer-only on web; feature flags/theme superadmin-only; secrets encrypted). Raw values are copied into the audit log. `GET` returns encrypted secrets' ciphertext.
- **File:** `app/api/v1/settings/route.ts` (~L16-19 GET, ~L36-51 POST).
- **Steps:**
  1. Add `const SETTING_KEY_MIN_ROLE: Record<string, Role>` built from the web gates in `app/(dashboard)/[module]/settings/SettingsClient.tsx` (~L207-249) and `settings/actions.ts` (system → developer; feature flags `FEATURE_FLAG_KEYS`, `theme_preset`, colours → superadmin; payment/system-business keys → admin). Import existing key constants; do not retype literals where a constant exists.
  2. Reject unknown keys (400) and keys above caller role (403). Reject the dead keys `bulk_collection_allowed`, `bulk_limit_per_agent`, `bureau_member_id`, `bureau_api_key`, `bureau_pulls_enabled`, `npa_threshold_days`, `npa_penalty_rate`, `session_timeout_minutes` (no reader anywhere).
  3. Audit: log the list of keys, not values.
  4. GET: blank values of secret keys the same way web `settings/page.tsx` ~L70-74 does.
- **Verify:** `npm run test:ci`; manual: admin posting `interest_only_enabled` → 403.

### SEC-09 — Remove plaintext bureau editor on mobile
- **Problem:** mobile Bureau screen writes `bureau_member_id/api_key/pulls_enabled` AppSettings that nothing reads; web uses encrypted `BureauCredential`. Plaintext key exposure.
- **Files:** `mobile/lib/features/settings/settings_detail_screen.dart` (~L229-232, ~L254-256 bureau branch).
- **Steps:** replace the bureau form with a read-only status text ("Configure bureau credentials on web") — new string in 6 locales. Add a one-off script `scripts/purge-plaintext-bureau-settings.ts` that deletes those three AppSetting keys (dry-run flag default on).
- **Depends:** SEC-08 (server rejects the keys).

### SEC-10 — Scope notification mark-one-read
- **Problem:** v1 PATCH single-id path checks `{id, tenantId, appType}` only → any user can mark another user's notification read; 200 vs 404 leaks existence. Web uses the visibility helper.
- **File:** `app/api/v1/notifications/route.ts` ~L63-75.
- **Steps:** use `updateMany({ where: { id: body.notificationId, ...buildSystemNotificationWhere({ tenantId: ctx.tenantId, appType: ctx.appType, userId: ctx.userId, userRole: ctx.role, activeBranchId: ctx.branchId }) }, data: { isRead: true } })`; `count === 0` → 404.
- **Verify:** `npm run test:approval-notifications`.

### SEC-11 — Module/branch columns on NotificationLog
- **Problem:** delivery log filtered by tenant only on both clients; branch admin sees other branches'/modules' recipient phones (mobile also message bodies). `NotificationLog` has no `appType`/`branchId`.
- **Files:** `prisma/schema.prisma` (model NotificationLog ~L895-915), new migration, the log writer used by `notify()` channel adapters (find with grep `notificationLog.create` in `lib/notify/`), `lib/notify/logs.ts` ~L22-32.
- **Steps:** add nullable `appType String?`, `branchId String?` + index; stamp both where rows are written (from the event's loan/customer); in `listNotificationLogs` accept `{appType, branchId}` and filter (`branchId` only when set). Both callers (web `notifications/log/page.tsx`, v1 `notifications/log/route.ts`) pass scope. Legacy null rows: hide from module view (SCOPE-17.6 precedent).
- **DOC-1:** note the new columns in §12.
- **Verify:** `npx prisma migrate dev` locally, `npm run test:ci`.

### SEC-12 — v1 customer_edit approval: tenant/module/stale check
- **Problem:** `tx.customer.update({ where: { id: request.entityId } })` with no tenant/appType/stale check; filing never validates `entityId`. Web refuses the same approval.
- **Files:** `app/api/v1/approvals/[id]/approve/route.ts` ~L85-105; reference `app/(dashboard)/[module]/approvals/actions.ts` ~L90-120.
- **Steps:** copy web's `customer.findFirst({ id: entityId, tenantId, appType })` + stale check before update; update with `where: { id, tenantId }`. In `app/api/v1/approvals/route.ts` (~L305-317) validate `entityId` exists in `{tenantId, appType}` when filing `customer_edit`.

### SEC-13 — Web approval actions: add module/branch guards
- **Problem:** web server actions lack guards v1 has: `reviewRequest` claim (no branch), `reviewPendingLoan` (no appType/branch), `approveCustomerCreation` (`{id, tenantId}` only — can re-activate any customer), `rejectCustomerCreation` (no appType/branch), loan_edit target (no branch).
- **File:** `app/(dashboard)/[module]/approvals/actions.ts` (~L64-65, ~L195-197, ~L405-408, ~L581-583, ~L736-738).
- **Steps:** resolve `const branchId = await getActiveBranchId()` once; add `appType` and `...branchScopeWhere(branchId)` (and `status: 'pending_review'` for customer creation) to each of the five `where`s. Match the v1 equivalents in `approve/route.ts` (~L54-63, ~L150-152, ~L302-304, ~L345-347).

### SEC-14 — Web wallet actions: add branch/module scope (WIP-DEP)
- **Problem:** `injectBranchAction`, `collectFromAgentAction`, `collectHandoverAction`, `rejectHandoverAction`, `releaseFundsAction` agent lookup have no active-branch scope; handovers have no appType filter.
- **Files:** `app/(dashboard)/[module]/wallet/actions.ts` (~L44-47, ~L135-138, ~L197-200, ~L234-235, ~L252-255), `wallet/page.tsx` ~L127-131.
- **Steps:** in `requirePrivileged()` resolve `getActiveBranchId()` once; add `...(branchId ? { branchId } : {})` to agent/branch lookups and `{ appType, ...(branchId ? { branchId } : {}) }` to CashHandover lookups (after the WIP column exists). Agent lookups also need `status: 'active', appType`.

### SEC-15 — Remove mobile admin "Collect" cash button; scope UPI verify
- **Problem:** mobile admin dashboard route list has a "Collect" button → `POST /collection/verify {action:'collect-cash'}`: no appType/branch check, never moves agent float (cash counted twice), non-deterministic GL dedup key. Web removed this button on purpose (`dashboard/page.tsx` ~L2194). Separately, single UPI verify looks up `{id, tenantId}` only.
- **Files:** `mobile/lib/features/dashboard/dashboard_screen.dart` ~L3342-3369; `mobile/lib/features/dashboard/widgets/collect_cash_sheet.dart` (or wherever `collect_cash_sheet.dart` lives); `app/api/v1/collection/verify/route.ts` ~L21-24.
- **Steps:**
  1. Delete the mobile Collect button and the sheet file; remove `Endpoints.dashboardCollectCash` if unused afterwards.
  2. In verify route, the `collect-cash` action: return `fail('Use the wallet handover flow', 410)`.
  3. UPI verify lookup: add `loan: { appType: ctx.appType, ...scopedBranchWhere(ctx) }`.
- **Verify:** `flutter analyze`; `npm run test:mobile-parity-api`.

### SEC-16 — Self-pay: module filter + staff-only on web
- **Problem:** `listPendingSelfPay` has no `appType` (both clients show other modules' self-pay claims). Web self-pay confirm/reject allows agents; v1 allows staff only.
- **Files:** `lib/selfPay.ts` ~L280-296; callers `app/(dashboard)/[module]/collection/self-pay/page.tsx` ~L19, `app/api/v1/collection/self-pay/route.ts` ~L16; `collection/self-pay/actions.ts` ~L33,48; `CollectionClient.tsx` ~L1367 (link).
- **Steps:** add `appType` param, filter `loan.findMany` by `{ tenantId, appType }`; pass from both callers. Web actions: roles `['admin','superadmin','developer']`; hide the Self-Pay link for agents.

### SEC-17 — KYC queue + review route gates
- **Problem:** v1 queue includes `'pending'` (default for every customer) → mobile lists everyone who never did KYC. v1 review route has no subscription check and no current-status check.
- **Files:** `app/api/v1/kyc/queue/route.ts` ~L10-15; `app/api/v1/kyc/[customerId]/review/route.ts` ~L90-120; `lib/kyc/index.ts` (`assertKycSubscription`).
- **Steps:** export `PENDING_KYC_STATUSES = ['video_under_review','video_submitted','otp_initiated']` from `lib/kyc`; use it in the v1 queue and in web `kyc-review/page.tsx` ~L49-51. Export `assertKycSubscription` and call it in the review route; reject (409) if current `kycStatus` not in `PENDING_KYC_STATUSES`.

### SEC-18 — Wallet agent lists: add `appType`
- **Files:** `app/(dashboard)/[module]/wallet/page.tsx` ~L108-112; `app/api/v1/wallet/agents/route.ts` ~L19-28; release lookups `wallet/actions.ts` ~L44, `app/api/v1/wallet/release/route.ts` ~L32.
- **Steps:** add `appType` to the four `user` wheres (SCOPE-17.5).

### SEC-19 — GPS v1 read routes: subscription gate
- **Files:** `app/api/v1/gps/live/route.ts`, `gps/history/[id]/route.ts`, `gps/agent/[id]/route.ts`, `gps/agent/[id]/collections/route.ts`.
- **Steps:** `if (!(await isGpsTrackingEnabled(ctx.tenantId))) return fail('GPS tracking not enabled', 403);` (helper in `lib/gps/locationVerifier.ts` ~L178).

### SEC-20 — `deletedAt: null` on by-id reads + customer list
- **Files:** `app/api/v1/customers/[id]/route.ts` `findScopedCustomer` ~L50-55; `app/api/v1/customers/route.ts` list where ~L28-32; `app/api/v1/loans/[id]/route.ts` ~L25-40.
- **Steps:** add `deletedAt: null` to each where. Soft-deleted rows then 404 / disappear on both clients.

### SEC-21 — KYC method gate on v1 KYC routes
- **Problem:** mobile always offers Aadhaar OTP and Video KYC; web shows only the tenant `kyc_method`. No server gate.
- **Files:** `app/api/v1/kyc/[customerId]/aadhaar-otp/*`, `app/api/v1/kyc/[customerId]/video/*` (grep exact), `app/api/v1/auth/me/route.ts` ~L46; `mobile/lib/features/customers/customer_detail_screen.dart` ~L113-181.
- **Steps:** routes read `getSetting(tenantId,'kyc_method')` and 403 when the method doesn't match; `/auth/me` returns `kycMethod`; mobile hides the non-matching button.

---

## 4. Phase B — money & data loss (MONEY: read §10 first)

### MON-01 — Mobile "hand over cash" = pending handover (WIP-DEP)
- **Problem:** web agent handover creates a **pending** `CashHandover` (float moves when admin collects). Mobile `POST /wallet/deposit` → `depositToOffice` moves float to the branch pool **immediately**, no handover row, no admin, no role guard, returns 402 (API-4 wants 409). Same cash can be counted twice.
- **Files:** `app/(dashboard)/[module]/wallet/actions.ts` `requestFloatHandoverAction` ~L158-188; `app/api/v1/wallet/deposit/route.ts`; `lib/cashSettlement.ts` (WIP); `mobile/lib/features/wallet/wallet_screen.dart` ~L113-115.
- **Steps:**
  1. Move the body of `requestFloatHandoverAction` (balance check, ≤5 pending, create pending `CashHandover` with appType/branchId, `notifyApprovers`) into one lib fn, e.g. `requestCashHandover()` in `lib/cashSettlement.ts`.
  2. Server action calls it. `POST /api/v1/wallet/deposit` calls it too (keep the URL), guard `ctx.role === 'agent'`, map `InsufficientFloatError` → 409.
  3. Mobile: change button label/success text to "Handover requested — awaiting collection" (6 locales). No endpoint change.
- **Verify:** `tests/walletAtomicity.test.ts` (WIP) + `npm run test:ci`.

### MON-02 — Mobile run settlement via `reconcile`
- **Problem:** closed run on mobile → "Go to Cash Float" → `/wallet/deposit` (no run link, no variance approval, run stays `closed` forever; web then offers a second deposit). Web uses `reconcileRun`. `CollectionRunService.reconcile` exists, unused.
- **Files:** `mobile/lib/features/collection/run_sheet_screen.dart` `_DepositHint` ~L386-420; `mobile/lib/data/services/collection_run_service.dart` ~L70-88.
- **Steps:** when `run.status == 'closed'`: show amount field (prefilled `cashCollected`) + button calling `reconcile(runId, cashDeposited)`, then refresh. When `run.status == 'reconciled'`: show `cashDeposited` and `varianceAmount` (already parsed) — no deposit prompt.
- **Also (shared):** `lib/collectionRun.ts` `reconcileRun` ~L416-454 writes the approval + run update outside the deposit transaction (X-6). Move `approvalRequest.create` and `collectionRun.update` into the same `$transaction` as the deposit (pass `tx` through `depositToOffice` if it accepts one; if not, stop and report).

### MON-03 — Block staff collecting on another agent's run
- **Problem (web-only):** admin collecting on agent A's run credits the admin's float; reconcile later debits A's float.
- **File:** `lib/collectionRun.ts` `collectRunLines` ~L279.
- **Steps:** next to the existing agent check, reject for all roles when `actor.userId !== run.agentId` (`throw new Error('forbidden')`). Map in web `runActions.ts` and v1 route to a translated message.

### MON-04 — v1 approve/reject: atomic claim
- **Problem:** v1 approve reads with `findFirst` outside the tx then `update where {id}` — no `status:'pending'` guard. Double approve of a cash_handover debits agent float twice. Same race lets reject overwrite approve.
- **Files:** `app/api/v1/approvals/[id]/approve/route.ts` ~L65-83; `reject/route.ts` ~L45-62; reference web `approvals/actions.ts` ~L64-76.
- **Steps:** inside the tx, `const { count } = await tx.approvalRequest.updateMany({ where: { id, tenantId: ctx.tenantId, appType: ctx.appType, status: 'pending' }, data: {...} }); if (count !== 1) throw new ConflictError()` → 409. Mobile: disable approve/reject buttons while the request is in flight (`approvals_screen.dart` ~L474-483).
- **Verify:** add a test: approve twice → second 409, wallet moved once.

### MON-05 — Offline collection replay: one idempotency key
- **Problem:** online `collectLoan` sends no key (server key `tenant:agent:inst:amt:mode:date`); on timeout the raw `DioException` queues the item with key `date:inst:amt` and replays through `/collection/entry` (different fn). A committed partial payment posts twice and credits float twice. Also replays blocked by "row already full" lose the cash record.
- **Files:** `mobile/lib/features/collection/quick_collect_sheet.dart` ~L300-330; `mobile/lib/data/local/collection_queue.dart` ~L40-120; `mobile/lib/data/services/collection_service.dart`; server `lib/collectionWrite.ts` (~L580-600 honours `input.idempotencyKey` on `/collect`).
- **Steps:**
  1. Generate one key per user action in the sheet (`const Uuid()` if already a dependency, else `'${DateTime.now().microsecondsSinceEpoch}-${loanId}'`), send it on the online `collectLoan` call.
  2. On non-`ApiException` failure, queue `{loanId, amount, mode, collectionDate, idempotencyKey: sameKey}`.
  3. Replay through `collectLoan` (`/collection/collect`), not `/collection/entry`.
- **Verify:** unit test the queue: same key on online + replay.

### MON-06 — Remove mobile client cap on collect amount
- **Problem:** mobile caps the amount at outstanding of loaded rows (`min(amt, totalRoom)`); a ₹300 advance is recorded as ₹100 while the agent holds ₹300. Web has no client cap; server caps at loan remaining.
- **File:** `mobile/lib/features/collection/quick_collect_sheet.dart` ~L234-247.
- **Steps:** delete the cap; send the typed amount; show the server's `applied` amount in the snackbar.

### MON-07 — Web "Pay" on partly-paid row must collect, not correct
- **Problem:** web `openModal` treats `receivedAmount > 0` as "edit": admin typing ₹60 on a row with ₹40 received sets the row to ₹60 (+₹20) via correction PATCH; agent gets an edit request instead of collecting. Mobile adds +₹60. Breaks MONEY-21.
- **File:** `app/(dashboard)/[module]/collection/CollectionClient.tsx` (~L667-680 `openModal`, ~L766-779 `handleSubmit`, modal title).
- **Steps:** replace the condition `instalment.receivedAmount > 0` with `instalment.outstandingAmount <= 0` (same test as `isSettled` ~L1046) in all three places.

### MON-08 — Customer PATCH: ignore masked Aadhaar
- **Problem:** web edit prefills masked `XXXX XXXX 1234`; PATCH encrypts it → stored Aadhaar becomes `1234`.
- **File:** `app/api/v1/customers/[id]/route.ts` ~L149.
- **Steps:** before encrypting: `if (isMaskedAadharNumber(String(data.aadharNumber))) delete data.aadharNumber;` (helper in `lib/pii.ts`, already used in `approvals/actions.ts` ~L483). Do the same for guarantor Aadhaar in the guarantor mapper.

### MON-09 — Customer PATCH: KYC docs append-only
- **Problem:** web always sends `kycDocs: []`; PATCH does `deleteMany: {}` → every web edit deletes all KYC documents.
- **File:** `app/api/v1/customers/[id]/route.ts` ~L208-217.
- **Steps:** remove `deleteMany: {}`; only `create` new docs; skip when array empty. Grep confirms only `customers/actions.ts` sends `kycDocs` — re-check before editing.

### MON-10 — Web customer edit: stop deleting security cheques
- **Problem:** dead cheque loop in `saveCustomer` always sends `securityCheques: []`; PATCH replaces → cheques from loan origination deleted.
- **Files:** `app/(dashboard)/[module]/customers/actions.ts` ~L111-125, ~L160; `app/api/v1/customers/[id]/route.ts` ~L219-232.
- **Steps:** delete the loop and the `securityCheques` key from the payload. In PATCH, ignore an empty `securityCheques` array.

### MON-11 — Customer PATCH: update guarantors in place
- **Problem:** PATCH `guarantors: { deleteMany: {}, create }` recreates rows → loans' `guarantorId` becomes NULL (FK ON DELETE SET NULL); guarantor Aadhaar/notes wiped; web also wipes guarantor photo.
- **Files:** `app/api/v1/customers/[id]/route.ts` ~L192-207; `customers/actions.ts` ~L100-105; `customers/new/CustomerForm.tsx` (~L69 guarantor rows).
- **Steps:**
  1. Extract the mapper at ~L193-202 into a local fn `mapGuarantorInput(g)`.
  2. Load existing guarantors. For each incoming: match by `id`, else by `(name, phone)`. Matched → `update` (keep `aadharNumber`/`photo`/`notes` when incoming value is absent/empty). Unmatched → `create`. Existing rows not in input → `delete`. All inside one `$transaction`.
  3. Web: add hidden input `guarantorExistingPhoto_${i}` with the current photo URL; in `actions.ts` `gPhoto ??= formData.get('guarantorExistingPhoto_'+i)`; also send guarantor `id`.
- **Verify:** edit a customer with a guarantor linked to a loan → loan `guarantorId` unchanged.

### MON-12 — Customer POST: save guarantors
- **Problem:** POST ignores `body.guarantors`; both clients send them; silently dropped.
- **File:** `app/api/v1/customers/route.ts` (~L163-202 body type, ~L336-394 create).
- **Steps:** add `guarantors: { create: (body.guarantors ?? []).map(mapGuarantorInput) }` (reuse MON-11 mapper — move it to a shared module next to the route, e.g. `lib/customers/guarantors.ts`).

### MON-13 — Web customer form: keep company inputs mounted
- **Problem:** collapsed company section unmounts inputs → `formData.get()` null → PATCH writes null to occupation/companyType/designation/companyPan/etc.
- **File:** `app/(dashboard)/[module]/customers/new/CustomerForm.tsx` ~L399.
- **Steps:** replace `{showCompany && (...)}` with `<div hidden={!showCompany}>...</div>`.

### MON-14 — Server phone/Aadhaar normalisation + validation
- **Problem:** 10-digit phone and 12-digit Aadhaar checks exist only on mobile; server stores raw phone; PATCH has no duplicate check → web can create duplicate customers (`+91 98765 43210`).
- **Files:** `app/api/v1/customers/route.ts` (~L203-212, ~L342); `app/api/v1/customers/[id]/route.ts` (PATCH).
- **Steps:** add `normalizePhone(raw)` (strip non-digits, drop leading `91` when length 12) in `lib/pii.ts`; reject if result length ≠ 10 (400). Store normalized. Run the duplicate check (same `{tenantId, appType}`) on normalized phone in POST and PATCH (exclude self in PATCH). Aadhaar: when provided and not masked, `normalizeAadharNumber` result must be 12 digits.
- **Note:** a DB unique constraint is a separate, later change (needs backfill, DB-15). Do not add it here.

### MON-15 — Admin user PATCH: keep unchanged fields
- **Problem:** mobile user edit sends only name/username/phone/role/branchId; `manageMasterUser` treats missing fields as cleared → status reset to active (suspended user re-enabled), appType defaults, email/aadhaar/dob nulled, bypass/autoRelease/feeConfirmation flags false.
- **File:** `app/api/v1/admin/users/[id]/route.ts` ~L49-60.
- **Steps:** load the target user (scoped); seed the FormData with current `status, appType, email, aadharNumber, dob, experience, age, bypassLoanApproval, bypassCustomerApproval, autoReleaseFloat, feeConfirmationMandatory`, then overlay body keys. Do not change `manageMasterUser`. Also: when `ctx.role === 'admin'`, call `manageBranchAgent` (as POST does, `users/route.ts` ~L90-92) and route status toggles to `setBranchAgentStatus`.

### MON-16 — Journal approval: period lock + entry numbering
- **Problem:** approving a pending JE posts it without checking period lock (web and mobile). Approval path numbers entries `JE-${calendarYear}…-${count}`, unlike FY-based `assignNextEntryNo` (copy-pasted 3×).
- **Files:** `lib/accounting/premiumMobileService.ts` ~L208-222; `app/(dashboard)/[module]/accounting/premium/journal/actions.ts` (~L18 `assignNextEntryNo`, ~L237-256 `approveEntry`); `app/api/v1/accounting/journal/route.ts` ~L10; `app/api/v1/accounting/journal/[id]/route.ts` (~L15, ~L98-133).
- **Steps:** move `assignNextEntryNo` to `lib/accounting/premium.ts`; delete the three copies and import. Add `assertPeriodOpen(tenantId, appType, date, role)` there (copy logic from `journal/route.ts` ~L132-138) and call it in every pending→posted path. Use `assignNextEntryNo` in `reviewPremiumApproval`.

### MON-17 — `/wallet/branch`: fix invalid Branch filter
- **Problem:** `branch.findMany({ tenantId, ...scopedBranchWhere(ctx) })` puts `branchId` on Branch (no such column) → 500 for every branch-scoped admin; mobile silently hides branch pools.
- **File:** `app/api/v1/wallet/branch/route.ts` ~L22 and ~L63; test `tests/desktopMobileParity.test.ts` ~L141-145 (regex asserts the buggy spelling).
- **Steps:** replace with `...(ctx.branchId ? { id: ctx.branchId } : {})`. Update the test regex in the same commit. Fix `tests/e2e/microlending/04-capital-float.spec.ts` ~L230-239 to assert `status === 200` (it passes vacuously on 500).

### MON-18 — Wallet release: 409 + shared guard (WIP-DEP)
- **Problem:** web release checks the agent's branch pool and offers a capital top-up; v1 release has no check (HEAD: pool goes negative; WIP: 500 `insufficient_float`).
- **Files:** `app/(dashboard)/[module]/wallet/actions.ts` ~L34-126; `app/api/v1/wallet/release/route.ts` ~L37-57.
- **Steps (minimum):** v1 maps `InsufficientFloatError` → `fail(..., 409)` with `{ available, required }` (MONEY-16). Then move the agent lookup + low-capital check into one lib fn in `lib/wallet.ts` used by both. Mobile shows the 409 message.

### MON-19 — Loan POST: customer must be active
- **Problem:** mobile loan picker defaults to all statuses; server never checks → loans for `pending_review`/`suspended` customers.
- **Files:** `app/api/v1/loans/route.ts` ~L267-280 (`customerWhere`); mobile `new_loan_screen.dart` ~L917 picker.
- **Steps:** add `status: 'active'` to `customerWhere` (404/400 "Customer not active"). Mobile picker: use a dedicated provider with `status: 'active'` (do not reuse `customerFilterProvider` — see CUST-03).

### MON-20 — Due day validation
- **Problem:** server weekly generator expects 0-6 (Sun=0), monthly 1-28. Mobile sends weekly 1-7 (Sun=7), monthly 1-31, optional → schedules shift a week / land on 28th / first instalment on disbursal day.
- **Files:** `app/api/v1/loans/route.ts` (~L223); `mobile/lib/features/loans/new_loan_screen.dart` (~L1527-1538, `_weekdayLabel` ~L643-652, ~L770); `mobile/lib/features/loans/edit_loan_screen.dart` (~L267-271 free text).
- **Steps:**
  1. Server POST and PATCH: for weekly/biweekly require `dueDay` integer 0-6; monthly 1-28; else 400.
  2. Mobile new loan: weekly items `0..6` labelled Sun..Sat; monthly `1..28`; required for weekly/biweekly/monthly.
  3. Mobile edit: replace free-text with the same dropdowns.

### MON-21 — Mobile loan penalty default from setting
- **File:** `mobile/lib/features/loans/new_loan_screen.dart` ~L267 (`TextEditingController(text: '1.5')`).
- **Steps:** server: in `POST /api/v1/loans`, when `body.penaltyRate` is absent, default from `getSetting(tenantId,'default_penalty_per_day','50')`. Mobile: start the field empty and omit `penaltyRate` unless the user typed one (or prefill from `settingsService.all()` if readable by agents — check the endpoint role gate first).

### MON-22 — Loan edit PATCH: keep deduction + guarantor keys
- **Problem:** PATCH whitelist drops `deductionType`, `deduction`, guarantor fields; approver applier reads them → approved rate change does nothing.
- **File:** `app/api/v1/loans/[id]/route.ts` ~L241-248.
- **Steps:** add `'deductionType','deduction'` to the core list and `guarantorName, guarantorPhone, guarantorAadhar, guarantorAddress, guarantorRelation, guarantorId` to the scalar list (exact key names: copy from `loans/actions.ts` ~L397-415). Add `validateLoanNumericInputs` on proposed core values (PUT already does, ~L399).

### MON-23 — Loan-edit approval applies `dueDay`
- **Problem:** both appliers (web `approvals/actions.ts` loan_edit, v1 `approve/route.ts` ~L170-241) ignore `dueDay` and regenerate schedules without it.
- **Steps:** in both: `const dueDay = changes.dueDay !== undefined ? changes.dueDay : loan.dueDay;` pass to `calculateLoanPreview`, write it, include in `coreChanged`. (APR-03 later merges the two appliers.)

### MON-24 — Use `totalPayable` for repayable totals
- **Problem:** web computes `perInstalment × totalInstalments` (last instalment absorbs remainder; interest-only excludes principal). Loans list "of ₹9,999" for ₹10,000; loan detail hides Record Payment while ₹10 is due.
- **Files:** `app/(dashboard)/[module]/loans/page.tsx` ~L269; `app/(dashboard)/[module]/loans/[id]/LoanDetailClient.tsx` ~L190.
- **Steps:** both → `Number(l.totalPayable)` / `Number(loan.totalPayable)`.
- **Verify:** `npm run test:calc`; open a 30-day ₹10,000 upfront loan: repayable ₹10,000.

### PEN-01 — Shared `settlePenalty` / `waivePenalty`; agents blocked (D6)
- **Problem:** four implementations (web actions, v1 settle, v1 waive, frozen `/api/penalties/[id]`). v1 settle writes nonexistent `paymentMode` → always 500. Settle overwrites vs increments; v1 marks partial as settled → phantom penalty rows. Web waive/enforce skip branch scope. v1 waive accepts agents with manager username/password.
- **Files:** `lib/penalties.ts`; `app/(dashboard)/[module]/penalties/actions.ts`; `app/api/v1/penalties/[id]/settle/route.ts`; `app/api/v1/penalties/[id]/waive/route.ts`; `app/api/penalties/[id]/route.ts`; `mobile/lib/data/services/penalty_service.dart` ~L86-103; `mobile/lib/features/penalties/penalties_screen.dart` (settle ~L656-669, ~L732-748).
- **Steps:**
  1. In `lib/penalties.ts` add `settlePenalty({ tenantId, appType, branchId, userId, penaltyId, amount })`: find with `{ id, loan: { tenantId, appType, ...branchScopeWhere(branchId) } }`; reject `amount <= 0` or `amount > gross − settled − waived`; `settledAmount = settled + amount` (increment); `status = settled+amount+waived >= gross ? 'settled' : 'partial'`; update + auditLog in one `$transaction`.
  2. Add `waivePenalty({...same scope, amount?})`: default waive full remaining; same scoping; one tx with audit; the "Penalty Waived" notification after commit (as web does today).
  3. Roles: `waivePenalty` throws `Forbidden` unless role in `admin|superadmin|developer`. `settlePenalty` (= collecting penalty money) also allows `agent`, scoped to loans the agent can reach (`buildAgentCustomerAccessWhere`) — owner decision 2026-10-01, see DEC-06 in `PARITY-ML-owner-decisions-2.md`.
  4. Point all four callers at them. Delete `managerUsername/managerPassword` handling from the v1 waive route and from `penalty_service.dart`.
  5. Mobile settle: wrap in try/catch, show the error snackbar, invalidate the list on success. Prefill settle amount with `net.toStringAsFixed(2)`.
- **DOC-1:** §10.4 — record that settle amounts are increments and agents cannot settle/waive.
- **Verify:** add a unit test for partial→settled transitions; `npm run test:calc`.

### PEN-02 — Mobile penalties: treat `partial` as open
- **File:** `mobile/lib/features/penalties/penalties_screen.dart` (~L167 filter list, ~L366-374 status, ~L536 buttons, ~L904-934 waive dialog).
- **Steps:** "open" rows = `status == 'pending' || status == 'partial'` (mirror `ACTIVE_PENALTY_STATUSES`); group status shows `partial` when any partial and none pending; add `'partial'` to the status filter chips.

### PEN-03 — Agent penalty-waiver request flow (D6)
- **Problem:** after PEN-01 agents can't waive. Decision: agent may **request** a waiver; admin/superadmin approves.
- **Steps:**
  1. Allow `requestType: 'penalty_waive'`, `entityType: 'penalty'` in `POST /api/v1/approvals` (validate penalty in caller's scope; `reason` required) and in the web request action.
  2. Approval handler (both appliers, or the shared lib from APR-03) calls `waivePenalty` with the approver's identity.
  3. Entry point for agents: loan detail penalty card (web `LoanDetailClient.tsx` ~L1575-1580 currently shows Waive/Settle to agents — replace with "Request waiver" for agents; mobile loan detail add the same button).
- **DOC-1:** §7.2 (agents may not see the penalties page, but may request a waiver from loan detail) and §10.4.

---

## 5. Phase C — crashes & "today"

### CRA-01 — Mobile Decimal-as-string crashes
- `mobile/lib/features/accounting/accounting_screen.dart` ~L1556: `je['totalDebit'] as num?` → `_num(je['totalDebit'])` (helper at end of file).
- `mobile/lib/features/accounting/bank_reconciliation_screen.dart` ~L414-415: `line['debit'] as num?`, `line['credit'] as num?` → `num.tryParse('${line['debit']}') ?? 0` (×2); same for closing balance ~L349.
- `mobile/lib/features/loans/route_customers_screen.dart` ~L35-40: `totalPayable`/`totalCollected` `as num?` → reuse `_toDouble` pattern from `loans_screen.dart` ~L224-225.

### CRA-02 — Sweep remaining `as num` casts
- Grep `mobile/lib` for `as num` and `as double` on JSON values. For each, check whether the server field is a Prisma `Decimal` (schema). Replace with the file's parse helper. List every change in the commit message.

### CRA-03 — Guarantor relation: one shared list
- **Problem:** web `friend|relative|business_partner|other`, mobile `father|mother|spouse|sibling|friend|other`; web edit wipes mobile-set values; mobile dropdown asserts on web values.
- **Files:** `app/(dashboard)/[module]/customers/new/CustomerForm.tsx` ~L656-660; `mobile/lib/features/customers/new_customer_screen.dart` ~L2050-2057.
- **Steps:** one list on both = `father, mother, spouse, sibling, relative, friend, business_partner, other` (union); labels in 6 locales. Mobile dropdown: if current value not in list, add it as an extra item instead of asserting.

### TIM-01 — GPS route progress: IST day + `capturedAt`
- **Files:** `lib/gps/routeProgress.ts` (~L14-18, ~L31-33, ~L41-49, ~L73-76); `app/api/v1/gps/live/route.ts` ~L61-62; `app/api/v1/gps/agent/[id]/collections/route.ts` ~L24-25.
- **Steps:** replace `setHours(0,0,0,0)` windows with `startOfBusinessToday()` / `startOfBusinessTomorrow()`. In `routeProgress.ts`, filter and order pings by `capturedAt` (not `receivedAt`), and compute last-seen/online from `capturedAt`.

### TIM-02 — Collection runs: business day
- **File:** `lib/collectionRun.ts` ~L27-40 `startOfDay`.
- **Steps:** use `startOfBusinessDayUtc(d)` from `lib/businessTime.ts` (as `lib/collectionWrite.ts` ~L14-25 does).

### TIM-03 — Analytics "today": business day
- **Files:** `app/(dashboard)/[module]/analytics/actions.ts` ~L6-10, ~L87; `app/api/v1/analytics/collections/route.ts` ~L20-36.
- **Steps:** replace local-midnight helpers with `startOfBusinessToday()` / `startOfBusinessDayUtc()`.

### TIM-04 — NPA summary reads latest snapshot
- **Problem:** cron writes snapshots at 20:00 UTC; summary reads only today's UTC date → all zeros ~20h/day.
- **File:** `lib/npa/provisioningCalculator.ts` ~L68-79.
- **Steps:** find `max(snapshotDate) <= asOf` (in the SEC-05 scope) with `findFirst({ orderBy: { snapshotDate: 'desc' } })`, then aggregate that date.

### TIM-05 — Web loan-detail collect modal: IST today
- **File:** `LoanDetailClient.tsx` ~L464 `new Date().toISOString().slice(0,10)`.
- **Steps:** use the IST business-day string helper used elsewhere (`toBusinessDayStr` in `lib/businessTime.ts` — grep exact name).

### TIM-06 — Mobile `.toLocal()` on server timestamps
- `mobile/lib/data/models/wallet.dart` ~L32; `mobile/lib/data/models/notification_item.dart` ~L31-33. Append `?.toLocal()` after `DateTime.tryParse`.

### TIM-07 — Mobile: send dates with offset / date-only
- `mobile/lib/data/services/collection_service.dart` ~L67 and `mobile/lib/data/local/collection_queue.dart` ~L46: `collectionDate.toUtc().toIso8601String()`.
- `mobile/lib/data/services/dashboard_service.dart` ~L32-33 (activities range): `toUtc().toIso8601String()`.
- `mobile/lib/data/services/loan_service.dart` ~L88-136 (`create`, `calculate`): `DateFormat('yyyy-MM-dd').format(startDate)` and same for `endDate`.

### TIM-08 — Web server-rendered times: IST
- `app/(dashboard)/[module]/agent-dashboard/page.tsx` ~L150 and `app/(dashboard)/[module]/notifications/log/page.tsx` ~L49: add `timeZone: 'Asia/Kolkata'` to `toLocaleTimeString`/`toLocaleString` options.

### TIM-09 — v1 P&L default end = today
- **File:** `app/api/v1/accounting/pnl/route.ts` ~L18-19.
- **Steps:** default `to` = today (business day), `from` = first of month — copy web `premium/pnl/page.tsx` ~L73-74. Build bounds with businessTime helpers, not `new Date(y,m,1)`.

---

## 6. Phase D — single source per page

### Admin dashboard (`app/(dashboard)/[module]/dashboard/page.tsx` vs `app/api/v1/dashboard/route.ts` + `dashboard_screen.dart`)

> Long-term target (API-8): one `getStaffDashboardData(scope)` in `lib/dashboard/` used by page and route. The tasks below are the small steps toward it; do them in order. If you are asked to do the extraction instead, DASH-01..05 become part of it.

**DASH-01 (H) — v1 instalment input set.** v1 feeds `getDistributedInstalmentsAndMetrics` only rows with `dueDate < today OR receivedAmount > 0` (route.ts ~L120-139, ~L413-423) → today collected/remaining and overdue recovered differ from web. Change the v1 query to load **all instalments of the loans in scope** exactly like `page.tsx` ~L412-432, and build pending dues (~L673) from the distributed today rows. Verify with `tests/dashboardKPI.test.ts`.

**DASH-02 (H) — customers count.** `route.ts` ~L83 `status: { not: 'blacklisted' }` → `status: 'active'` (web `page.tsx` ~L113).

**DASH-03 (H) — overdue customer count.** `route.ts` ~L604-614/~L647: count customers with distributed `overdueAmount > 0` (web `page.tsx` ~L475-477). Also make web per-frequency counts (~L840-845) use the same rule.

**DASH-04 (H) — penalty KPI.** v1 returns `pendingPenaltyTotal` = Σ(gross − settled − waived) for status `pending|partial`, after calling `ensurePendingPenaltiesForMissedLoans` (copy web ~L84, ~L217-221, ~L911-916). Mobile `_AlertsRow` (~L1259-1267) shows it as ₹ amount. Keep old `pendingPenalties` count field (STABLE-2). For agents return 0 and hide the card (§7.2).

**DASH-05 (H) — remove fabricated mobile charts.** Delete synthetic generators in `overdue_aging_card.dart` (fixed %, fallback 70320), `disbursement_trend_card.dart` (weights, fallback 1280000, hardcoded month names), `interactive_portfolio_donut_card.dart` (customers − loans). Add `overdueAgeing`, `cashFlow`, `portfolioHealth`, `topOverdueCustomers` to the v1 payload using the same lib calls `page.tsx` uses (`buildOverdueAgeing`, `topOverdueCustomers`, cash-book groupBy ~L493-550). Render those; show the empty state when absent.

**DASH-06 (M) — missing KPIs on mobile.** Add `overdueCustomerCount`, `pendingApprovals` (same query as web ~L126-146 incl. preclose visibility), `pendingFieldFloat` (~L1093-1103) to v1; render.

**DASH-07 (M) — best payer / highest borrower.** One definition: best payer = top Σ collected (v1's), highest borrower = max Σ principal of active+overdue loans per customer. Web `page.tsx` ~L274-290 (add `orderBy`), v1 ~L255-266.

**DASH-08 (M) — UPI panel.** v1 returns `upiManualVerification` flag and lists modes `['upi','online']` (web ~L294, ~L1525); mobile shows panel only when flag true.

**DASH-09 (M) — activity feed.** v1 `dashboard/activities/route.ts` calls `getActivityFeed(scope, start, end)` (lib/dashboard/activityFeed.ts) instead of its own copy; one set of caps for "today" lists (use web's 20/20/10/10) and SCOPE-18 approvals visibility on web feed.

**DASH-10 (M) — route table "collected today".** Add `routeCollections` to v1 (web ~L1104-1109); mobile route rows show it.

**DASH-11 (H) — agent dashboard web uses v1.** Web `agent-dashboard/page.tsx` queries Prisma with primary-route-only scope, UTC today, collected-only "expected". Replace items 1-8/15 with `serverFetch('/dashboard')` (pattern: `collection/page.tsx` ~L88) and render `hitRate`, `todayBreakdown.total`, `totalCustomers`, `activeLoans`, `overdueLoans`, `todaysActivity.paidItems`. Keep the 7-day chart. Month-to-date: blocked by Q5 — leave web MTD as is until answered. Mobile: render `activeLoans` in `_AgentMetricsRow`; `hitRate` as `${summary.hitRate.round()}%`. Update `tests/agentDashboardChart.test.ts` / `tests/endToEndFeatures.test.ts` that read page source.

### Collection entry

**COL-01 (H) — mobile reads `/collection/dashboard`.** Mobile `CollectionService.today()` (`collection_service.dart` ~L12-19) → `GET /collection/dashboard` (same as web `page.tsx` ~L88). Map `todayInstalments` + `overdueInstalments` to `CollectionRow`; render header from server `collectionSummary` and per-route from `collectionSummaryByRoute`; delete Dart totals folds (`collection_screen.dart` ~L495-512). Read receipt id from `json['collectionEntry']?['id']`. Fixes overdue mismatch, 1000-row cut, missing receipt, missing summary cards, branch-scope mismatch.

**COL-02 (M) — drop invented "due today".** After COL-01, remove the `_CustomerGroup.todayDue` fallback (`collection_screen.dart` ~L1793-1802).

**COL-03 (M) — mobile handover action.** After MON-01: add daily collected total + "Submit handover" + "Handover pending" badge on mobile collection screen, calling the MON-01 endpoint (web `CollectionClient.tsx` ~L1372-1395).

**COL-04 (L) — web GPS status.** `collection/actions.ts` ~L112-122: send `gps: { status, latitude, longitude, ... }` (nested), so `normalizeGpsBody` keeps `location_denied`.

### Loan detail (`LoanDetailClient.tsx` = LDC, `loan_detail_screen.dart` = LDS, `app/api/v1/loans/[id]/route.ts`)

**LD-01 (H) — server metrics are the only source.** In GET route (~L185-195): compute `metrics.overdueAmount` with `calculateDynamicOverdueAmount` (`lib/repayments.ts` ~L156-212); add `metrics.paidPeriod`, `metrics.remainingExtended`, `metrics.remainingActual` using web's rules (waived rows: paid period = first waived no − 1; closed loan → remaining 0, PRECLOSE-7). `missedCount` definition: **blocked by Q2**, leave as is. DOC-2: write the definitions in §10.

**LD-02 (H) — web reads server values.** Delete client maths in LDC (~L190-191 after MON-24, ~L283-402, ~L832-840, client `computeExtendedSchedule` ~L290-302); read `loan.metrics.*`, `loan.restructure.*` (`restructuredRate`, `remainingPeriods`), per-row `inst.restructuredAmount`, `loan.extendedSchedule`. Fix the false comment at `lib/restructure.ts` ~L13.

**LD-03 (M) — mobile reads server values.** LDS ~L1318-1321: use `metrics.paidPeriod/remaining*`; progress ring = `paidPeriod / totalInstalments`. Fix `LoanRestructure.fromJson` keys (`loan.dart` ~L144-156) to `restructuredRate, outstanding, remainingPeriods, available`; render "Remaining actual" + finishing rate. Delete dead Dart overdue fallback (LDS ~L904-963).

**LD-04 (M) — mobile labels & actions.**
1. `waived` case in `_badgeKind`/`_statusLabel` (LDS ~L1455-1469); exclude waived and missed rows from `canPay` (~L1483-1485).
2. Tenure/paid/remaining unit by frequency (days/weeks/months) — LDS ~L1324-1372, ~L1911-1923; web LDC ~L1005 literals → i18n.
3. Extended-plan card condition: show when `remainingPayments > 0` (match web).
4. Cheque collateral branch in `_buildCollateralDetailsCard` (LDS ~L281-593) reading `collateralDetails` + `customer.securityCheques`.
5. Action sheet (LDS ~L2581-2640): Close/Renew/Preclose only for admin roles; Preclose only if `foreclosureEnabled` and not interest-only (same predicates as LDC ~L1625-1663); payment modes `cash|upi|bank_transfer|cheque`.
6. Pay on an extended missed day: pass the row date as `collectionDate` to `collectLoan` (web LDC ~L1350).
7. Admin payment correction: admin roles call the direct correction endpoint (web `correctInstalmentPaymentAction`), agents keep `edit_collection` request.
8. NACH default max = `perInstalment` (match web).

**LD-05 (H) — preclose quote. BLOCKED by Q1.** When answered: compute the quote once server-side (`buildForeclosureCalculation` from `lib/foreclosure.ts`, exposed in `GET /api/v1/loans/[id]` as `precloseQuote`), both clients prefill and enforce the minimum from it.

**LD-06 (M) — mobile agent preclose request.** Add agent "Request preclose" on mobile loan detail filing `requestType: 'loan_preclose'` through the same lib as web (`lib/loanPrecloseRequests.ts`), gated by `isAgentPrecloseRequestAllowed` (`lib/loanPreclosePolicy.ts`). Amount shown = same figure web uses today (`precloseOutstanding`); revisit after Q1.

### Customers

**CUST-01 (H) — active loan definition + mobile tile (D7).**
1. Web `customers/page.tsx` ~L101: `c.loans.find((l) => canCollectForLoanStatus(l.status))` (import from `lib/collectionPolicy`); add `orderBy: { createdAt: 'desc' }` to the loans include in the offset branch of `app/api/v1/customers/route.ts` (~L84-93).
2. Mobile `customer_tile.dart` ~L29-31, ~L50: use `customer.activeLoanPrincipal` / `customer.activeLoanCount` (already parsed). Label the amount "Active principal" (new key, 6 locales) — it is not outstanding.

**CUST-02 (M) — credit score on mobile list.** Cursor branch of `app/api/v1/customers/route.ts` (~L105-145): include the same loans select as the offset branch and add `creditScore: calculateCreditScore(c.loans)`.

**CUST-03 (M) — list filters.**
1. `customer_repository.dart` ~L81: `StateProvider.autoDispose` (stop New-Loan picker search leaking into Customers list).
2. Mobile status filter → send `status` to server; one status list on both = `active, pending_review, suspended, inactive`; web drop `overdue/closed/blacklisted` options (nothing writes them) and add `suspended`, `inactive`.
3. Mobile `routeId` filter (server supports it).
4. Phone on mobile tile.
5. Web score colour bands for 300-850 scale (`page.tsx` ~L125): ≥750 green, ≥650 amber, else red; unrated grey (match mobile).

**CUST-04 (H) — customer outstanding.** Add `outstanding = Σ max(0, totalPayable − totalCollected)` over loans with status active/overdue to `calculateCreditScore().stats` (`lib/creditScore.ts`); render on web customer detail KPI strip and replace mobile's principal-of-active-only "Outstanding" (`customer_detail_screen.dart` ~L1148-1150). Mobile also renders `punctuality`, `activeLoans/closedLoans` (already parsed); add `frequency`, `startDate`, `tenure`, `paidCount` to `CustomerLoanSummary` and show progress.

**CUST-05 (H) — agent customer edits from mobile.** v1 PATCH agent branch (`customers/[id]/route.ts` ~L235-256): filter `data` to `CUSTOMER_EDIT_ALLOW_LIST`, diff against existing (skip masked Aadhaar), audit row, `notifyApprovers` after commit (args as `approvals/actions.ts` ~L538-545). Mobile: when response `pendingApproval == true` show "Submitted for approval" (customer edit, GPS register, suspend). Mobile agent edit form: show only allow-listed fields (match web request-edit modal).

**CUST-06 (M) — admin KYC status edit (D5).**
1. Web `CustomerForm.tsx`: add a `kycStatus` select in edit mode for admin roles (same values mobile offers + current value if different). Send via `saveCustomer`.
2. Mobile `new_customer_screen.dart` ~L909-924: show the dropdown only for admin roles; include the current value as an item if it is not in the list (avoid assert crash).
3. Server PATCH: accept `kycStatus` only from admin roles; set `kycVerifiedById`/`kycVerifiedAt` when set to `verified`; audit.
4. **DOC-1:** note in §10 / KYC section that admins may set KYC status manually.

**CUST-07 (M) — customer detail action parity.**
1. Web: render `customer.kycDocuments` in the KYC tab.
2. Web: status badge + Suspend/Unsuspend + Delete (admin) calling v1 PATCH/DELETE.
3. Mobile: "Reset portal password" menu item → v1 `/customers/[id]/reset-password`.
4. New Loan for agents on web: **blocked by Q4**.
5. Mobile: KYC rejected reason + verified date; WhatsApp number normalisation same as web (country code from setting, not hardcoded `91` — fix web too).

**CUST-08 (M) — mobile customer form gaps.** After MON-09: upload `_docs` on edit and send `kycDocs`. In edit mode send `null` for text fields the user cleared and `[]` for emptied lists (guarantors, collection points); allow clearing GPS. Add `preferredCollectionTime` (same options as web, from one constant). Hide "New Route" for agents.

### Loans

**LOAN-01 (M) — loans list (D4).**
1. Server `GET /api/v1/loans` (~L37-82): add optional `hideClosed=1` param → `status: { not: 'closed' }` (only when no explicit `status` filter is sent; absent = today's behaviour, STABLE-2). Web `loans/page.tsx`: "Hide closed loans" toggle, default on, sends `hideClosed=1`.
2. Mobile `loans_screen.dart`: keep the toggle, default on; pass to server instead of client filtering.
3. Mobile count: "N active" = count of `status == 'active'` (~L95).
4. Mobile: pass `q`, `status`, `frequency` through `LoanService.list` (~L14-17); add search box + status/frequency filter sheet.
5. Mobile status labels via `t.x('status.$status')`.

**LOAN-02 (H) — single payment & bullet under "Custom loans" (D3).**
1. Server `POST /api/v1/loans` (~L218-219): when `frequency === 'single_payment'` set `termType = 'bullet'` and derive `termDays` from `startDate`→`endDate` if not sent. This makes mobile and web store the same shape (`BTL` prefix).
2. `app/api/v1/loans/calculate/route.ts` (~L12-20): forward `termType`, `termDays`, `endDate` like `app/api/loans/calculate/route.ts` (~L15-31). Then point the web preview at the v1 route and delete the duplicate if nothing else calls it (grep).
3. Web `LoanForm.tsx` (~L1122-1127): group options — regular cadences, then an `<optgroup label="Custom loans">` with Single payment, Bullet (shown only when `bulletTermEnabled`), Custom duration. "Bullet" = existing `termType: 'bullet'` shape (`setTermShape('bullet')`).
4. Mobile `new_loan_screen.dart` (~L1484-1494): same grouping (section header "Custom loans"); add Bullet (gated by the `bullet_term_enabled` flag — expose it in `/auth/me` if not present); send `termType`/`termDays` exactly as web (~L546-553).
5. **DOC-1:** §10.2 — single_payment is always stored as bullet.
- **Verify:** `npm run test:calc`; create single payment on both → same prefix and term columns.

**LOAN-03 (M) — mobile loan form options/defaults.** Blank principal/deduction/tenure (no 30000/3000/100). Add `emi_floating`, `biweekly`, and `interest_only` (gated by `isInterestOnlyEnabled`, expose flag). Edit screen frequency options = all frequencies. Web `handlePackageChange` (~L426-433): also copy `penaltyRate` and reset `dueDay` (match mobile). Mobile edit collateral: structured fields like web instead of raw JSON.

**LOAN-04 (M) — admin loan edit on mobile.** Admin roles call `PUT /api/v1/loans/[id]` (add `LoanService.update`); others keep PATCH request (mirror web `LoanEditForm.tsx` ~L257-267).

### Approvals & KYC

**APR-01 (M) — mobile approvals screen.**
1. Tabs (`approvals_screen.dart` ~L97-109): customers/loans tabs = `action == 'create'` only; everything else → General.
2. Fetch all statuses (drop `status:'pending'` ~L20); show status chip + reviewer.
3. Parse and show `reason` (`approval.dart`).
4. Agents: show Approvals (read-only, own requests) in More menu (`more_screen.dart` ~L186-193).
5. Labels for `loan_preclose` / `cash_handover`, ₹ formatting, customerCode in v1 synthetic rows (`approvals/route.ts` ~L75-81, ~L129-138).

**APR-02 (M) — v1 approve/reject behaviour = web.** Apply `LOAN_EDIT_ALLOW_LIST` (declared, unused, `approve/route.ts` ~L18-22); `notifyUser` requester on approve/reject (web `actions.ts` ~L372-386); rejecting a pending customer sets `inactive` (web shipped value) not `rejected`; audit action `'reject'`; notification links via `modulePath`.

**APR-03 (L, optional) — one review lib.** Move the web review functions into `lib/approvals/review.ts` (scope on all four axes, atomic claim, stale check, allow-lists, notifications, dueDay applier); server action + both v1 routes call it. Supersedes the duplicated code touched by SEC-12/13, MON-04/23, APR-02, PEN-03.

**KYC-01 (H) — mobile video KYC review via shared lib.** Mobile video sheet (`kyc_review_screen.dart` ~L492-529) → `Endpoints.kycVideo` with `{action:'review', sessionId, decision, notes}` (route `app/api/v1/kyc/video/route.ts` delegates to `reviewVideoKyc`). Non-video rows: replace Verify/Reject with "View profile" (match web) — manual KYC status change is done from the customer edit form (CUST-06).

### Accounting

**ACC-01 (H) — one accounting summary (D1).** Move `getAccountingSummary` (`app/(dashboard)/[module]/accounting/actions.ts` ~L127, loan set: **all statuses**) to `lib/accounting/summary.ts`; v1 `GET /api/v1/accounting` returns its fields and computes `projectedRevenue`/`netProfit` from the same loans (delete the `status in [active, overdue]` filter ~L57-71). Accept `from/to` (web date filter) and use the full `releasedToAgents` aggregate on web (`AccountingClient.tsx` ~L207-209 sums only last 100 rows). Mobile: show Released to Agent, Total Deductions, Total Interest; date range picker.

**ACC-02 (M) — one cash-flow statement.** Move web `cashflow/actions.ts` `getCashFlowData` to `lib/accounting/cashflow.ts`; v1 delegates; account predicate `isCash: true, isActive: true`; mobile renders the statement (opening, operating/investing/financing, closing), not a 14-day series.

**ACC-03 (M) — mobile accounting gaps.** Quick actions (Capital add/withdraw, Expense) calling existing `POST /api/v1/accounting`; journal filters (service already supports); approvals list all statuses + reject note prompt; P&L/BS date pickers; TB formatting via currency formatter + Dr=Cr / A=L+E banners.

**ACC-04 (M) — audit rows from mobile.** Add `appType: ctx.appType, branchId: entry.branchId` to the four v1 audit creates (`journal/route.ts` ~L254-263, `journal/[id]/route.ts` ~L121-130, ~L230, ~L313-322).

### Wallet

**WAL-01 (M) — wallet summary + handover endpoints.** Move web summary aggregates (`wallet/page.tsx` ~L82-105) into `lib/wallet.ts`; web page calls it; add `GET /api/v1/wallet/summary`. Add `GET /api/v1/wallet/handovers`, `POST .../handovers/[id]/collect|reject` delegating to the same lib fns as the web actions. Mobile: KPI cards, pending handover queue with Collect/Reject, agent handover history, direct "Collect from agent".

**WAL-02 (L) — exceeds-pool warning per agent.** Compare against the agent's own branch pool (v1 agents already return `branchId`; web select it) on both clients.

**WAL-03 (L) — wallet labels.** Web wallet strings → i18n with mobile wording; show ledger note and agent phone on mobile; label handover status `collected` on web.

### Collection runs

**RUN-01 (M) — mobile runs gaps.** Mobile list calls `GET /collection/run` (routes + last 50 runs) — runs history + route picker from the same source (active routes only). Close button visible whenever not locked (`run_sheet_screen.dart` ~L198, drop `&& groups.isNotEmpty` for Close). Pass GPS on open. "Fill due" → `toStringAsFixed(2)`. Auto-split order: today's due first, then overdue oldest-first (MONEY-10, comparator ~L46-47). Run date `substring(0,10)`. Web run sheet: add "Send pay link" button using existing `createSelfPayLinkAction`; map lib error codes to messages. v1 sheet route: agent on another agent's run → 404 not 403; insufficient float → 409.

### Route tracker

**RTE-01 (M) — mobile tracking gaps.** History provider follows `nextCursor` (`tracking_provider.dart` ~L26-46; loop pattern in `loan_service.dart` ~L23-34). Export the alert calculation from `routeProgress.ts`, add `alerts` to `/gps/live` rows, add `locationStatus` to `/collections` select + Dart model; render alerts + location status chips. Parse `pingType`. Tracking log: show all rows or a "showing 200 of N" note.

### Analytics / reports / NPA

**RPT-01 (H) — agent performance numbers.** `app/api/v1/reports/agent/route.ts` delegates to the catalog builder `buildAgentPerformance` (`lib/reports/builders/agent-performance.ts`) and returns `{agentId, name, expected, collected, entryCount, hitRate}`. Analytics leaderboard on mobile (`analytics_screen.dart` ~L624-668): show rank + collected, top 5 (no efficiency text — server has none). Delete orphan web `reports/agents/page.tsx` if still unlinked (grep).

**RPT-02 (H) — overdue list completeness.** `overdue/route.ts` ~L25: `orderBy: { dueDate: 'asc' }` on the instalments include. Mobile overdue + NPA lists: page through results (load more) instead of first 50/20.

**RPT-03 (M) — export gates.** Export route (`app/api/v1/reports/[slug]/export/route.ts`): for `format !== 'csv'` require `receiptPdfAllowed` (403); honour requested `branchId` exactly as the view route does (~L26-29, ~L46).

**RPT-04 (M) — mobile analytics fixes.** Route health overdue → double + currency (`analytics.dart` ~L446, screen ~L814). Borrower leaderboard: filter principal > 0, sort desc, top 10, relabel "Overdue amount". Segments: drop `%`. Remove `dueToday` row (always 0). Use server `color` for risk/efficiency. Map insight icon names to `Icons.*` or drop. Recovery ratio integer. Catalog default range = month to date (`_dateRangeProvider`). Catalog filters (agent/route/loanType/status/paymentMode) from `/v1/reports/options`.

**RPT-05 (M, verify first) — analytics excludes `status:'npa'` loans.** `analytics/actions.ts` ~L120-140 status lists omit `'npa'`. Confirm with the owner/DB that microlending tenants have `npa` loans; if yes add `'npa'` to those lists.

**NPA-01 (H) — Gross NPA includes SMA (D2).** Mobile summary (`lib/npa/npaService.ts` ~L47-50): `npaOutstanding` = Σ over `sma_0, sma_1, sma_2, sub_standard, doubtful_*, loss` (export one `GROSS_NPA_CATEGORIES` constant; web builder `npa-classification-report.ts` ~L45-56 uses it too). Denominator: same on both = total outstanding of loans in scope (use the web builder's definition ~L72-75). **DOC-1:** §10.10 — Gross NPA includes SMA categories for reporting.

**NPA-02 (M) — NPA upgrade usable.** Mobile: enable Upgrade button always; server re-checks eligibility and returns 400 `UPGRADE_NOT_ELIGIBLE` → show message. (Optional) call `fetchUpgradeEligibility` on expand.

### Notifications

**NOT-01 (M) — mobile deep links.** In `mobile/lib/core/router/app_router.dart` add a top-level `redirect`: if the first path segment is a module key (use existing AppType constants) and the path is not an explicit `/microlending/...` route, strip it; map `/route-tracker` → `/tracking`. Covers list tap, reply, FCM taps.

**NOT-02 (M) — due-reminder switch.** `lib/notify/events.ts` ~L136: map event `payment_due_reminder` to stored key `notify_event_due_reminder` (do not rename stored keys). Add a test.

**NOT-03 (M) — unread badge on mobile.** Expose `total` from `notifications_service.dart` (~L54-60); provider with `unreadOnly: true, pageSize: 1`; badge on the dashboard bell. Mark-one-read invalidates all pages.

**NOT-04 (M) — web lists & mobile gates.** Web notifications page: paging (load more). Web delivery log: read `searchParams` (channel/status/date/search/cursor) and show provider + message body. Mobile: disable SMS/WhatsApp channel switches when subscription lacks WhatsApp/SMS; hide Notifications settings tile then. Mobile template editor: placeholder list (same source as web).

### Settings

**SET-01 (M) — remove dead mobile settings.** Delete bulk-collection, NPA config and session-timeout editors from `settings_detail_screen.dart` (~L225-262) and their tiles; mobile NPA view = read-only RBI table like web.

**SET-02 (M) — missing settings.** Mobile payment settings: `upi_manual_verification` switch. Mobile system settings: `kyc_method` disabled without KYC add-on; loan prefixes max 4 chars. Receipt-PDF toggle hidden when not allowed.

**SET-03 (M) — branches from mobile.** v1 `admin/branches` routes call `createBranch/updateBranch` which read the NextAuth session → always "Unauthorized" for bearer tokens. Point them at the same logic as web Settings (`createTenantBranch/updateTenantBranch` in `settings/actions.ts`) with an actor parameter (pattern: `manageMasterUser(formData, actor)`).

**SET-04 (M) — agent create on mobile.** Remove "None (Cross-branch)" for role agent (`team_management_screen.dart` ~L455); server rejects `role === 'agent' && !branchId` (SCOPE-13). Mobile agent form: add the 9 missing fields (email, aadhaar, dob, experience, age, 4 flags). Status vocabulary: use `inactive` like web.

**SET-05 (M) — superadmin entries.** Mobile Settings→Account tiles for Affiliate, Branch requests, Module requests (routes exist). Mobile Features/Theme: out of scope unless asked; Data wipe stays web-only (say so in a code comment near the settings list).

**SET-06 (M) — web package edit.** Wire the dead Edit button (`SettingsClient.tsx` ~L858) to `updatePackage` (`lib/packages/service.ts` ~L112); show package status column; same list order as mobile (`createdAt desc`).

---

## 7. Phase E — polish

**I18N-01 (L).** Per page, move hardcoded English to dictionaries (web `i18n/*.ts`, mobile `app_strings.dart`). Lists per page are in the audit reports (search "STABLE-5" / "hardcoded English"). Do one page per commit. Also replace hardcoded `₹` with the tenant currency symbol/formatter.

**FMT-01 (L, blocked by Q3).** One money display rule for both clients.

---

## 8. Done criteria for the whole plan

- Every task above merged or explicitly marked "won't do" by the owner.
- `npm run test:calc`, `npm run test:ci`, `npm run test:mobile-parity-api`, `flutter analyze` green.
- `ENGINEERING_REFERENCE.md` updated for D2, D3, D5, D6 and any LD-01 definitions (DOC-1/DOC-2).
- Spot-check on one tenant, same user/branch on web and mobile: dashboard, collection, loans list, loan detail, customers list/detail, penalties, approvals, wallet, accounting summary, NPA summary show the same numbers.
