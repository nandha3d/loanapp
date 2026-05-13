# LoanTrack V5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the LoanTrack v5 bug-fix prompt: complete the headless REST API layer, fix broken navigation, remove duplicated hardcoded configuration, improve theme/mobile behavior, repair credit-score logic, and add fixed/percentage deduction support with reusable loan templates.

**Architecture:** Keep existing Next.js App Router patterns: server components fetch Prisma data, client components own interactivity, server actions remain the canonical UI mutation path, and route handlers expose the same scoped behavior for headless clients. Shared constants and API helpers live in `lib/` to avoid duplicated billing/package/module configuration.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 5/MySQL, NextAuth 5 beta, TypeScript, CSS variables in `app/globals.css`.

---

## Baseline Notes

- `npm test` is unavailable because `package.json` has no test script.
- `npm run lint` is already failing before changes with repo-wide `any`, hook, image, and scratch-file lint errors.
- `npx tsc --noEmit` is already failing before changes:
  - `app/(dashboard)/loans/[id]/actions.ts`: penalty create payload uses nonexistent `tenantId`.
  - `app/(dashboard)/loans/actions.ts`: uses nonexistent `prisma.loanInstalment`.
  - `app/(dashboard)/loans/new/LoanForm.tsx`: inline style uses invalid `block`.
- Browser Use visual verification is blocked by the local Node runtime mismatch noted in `AGENTS.md`; use build/type/manual code checks until that runtime is upgraded.

## File Structure

- Create `lib/plans.ts` for `PLAN_FEATURES`, `PLAN_LABELS`, `PLAN_COLORS`, and `MODULE_LABELS`.
- Create `lib/moduleGate.ts` for tenant module access helpers.
- Create `lib/apiAuth.ts` for repeated route-handler auth, role, tenant, app, and branch context.
- Create REST handlers under `app/api/**/route.ts` for instalments, penalties, collection, customers, loans, routes, packages, dashboard, reports, approvals, settings, and health.
- Modify Prisma schema and generated client inputs for loan/package `deductionType`.
- Modify existing dashboard/UI files listed in the prompt without broad rewrites.

## Task 1: Schema And Generated Client

**Files:**
- Modify: `prisma/schema.prisma`
- Verify: `npx prisma generate`, `npx tsc --noEmit`

- [ ] Add `deductionType String @default("fixed") @map("deduction_type")` to `LoanPackage`.
- [ ] Add `deductionType String @default("fixed") @map("deduction_type")` to `Loan`.
- [ ] Run `npx prisma generate` so TypeScript recognizes the fields.
- [ ] Defer `npx prisma migrate dev --name v5_deduction_type` unless the database is available and migration is safe to run locally.

## Task 2: Shared Configuration And Module Gate

**Files:**
- Create: `lib/plans.ts`
- Create: `lib/moduleGate.ts`
- Modify: `lib/subscription.ts`
- Modify: `app/portal/billing/page.tsx`
- Modify: `app/admin/billing/[tenantId]/page.tsx`
- Modify: `app/(dashboard)/subscription/page.tsx`

- [ ] Move plan/module labels and limits into `lib/plans.ts`.
- [ ] Replace duplicated billing/subscription constants with imports from `lib/plans.ts`.
- [ ] Add `getEnabledModules(tenantId)` and `requireModule(tenantId, module)` in `lib/moduleGate.ts`.
- [ ] Extend `checkLimit` so `vehicles` requires `autofinance` and `chits` requires `chitfunds`.

## Task 3: Existing TypeScript Baseline Fixes

**Files:**
- Modify: `app/(dashboard)/loans/[id]/actions.ts`
- Modify: `app/(dashboard)/loans/actions.ts`
- Modify: `app/(dashboard)/loans/new/LoanForm.tsx`

- [ ] Remove invalid `tenantId` fields from penalty create data or route the tenant relationship through existing schema fields.
- [ ] Replace `prisma.loanInstalment` with `prisma.instalment`.
- [ ] Replace invalid inline `style.block` with valid layout CSS.
- [ ] Run `npx tsc --noEmit` and record remaining failures.

## Task 4: Headless API Layer

**Files:**
- Create: `lib/apiAuth.ts`
- Create/modify: all `app/api/**/route.ts` files listed in prompt task 1.

- [ ] Add reusable `requireApiUser(allowedRoles?)` returning `{ session, role, userId, branchId, tenantId, appType }` or an API error.
- [ ] Implement `GET /api/instalments` and `GET/PATCH /api/instalments/[id]`.
- [ ] Implement `GET /api/penalties` and `GET/PATCH /api/penalties/[id]` with audit logs.
- [ ] Implement `GET/POST /api/collection`; mirror `submitCollectionEntry` logic for POST.
- [ ] Implement `GET/PATCH/DELETE /api/customers/[id]` with allow-listed updates and soft delete.
- [ ] Implement `GET/PATCH/DELETE /api/loans/[id]`.
- [ ] Implement `GET/POST /api/routes`.
- [ ] Implement `GET/POST /api/packages` and `GET/PATCH/DELETE /api/packages/[id]`.
- [ ] Implement `GET /api/dashboard` and `GET /api/reports` by reusing the same scoped aggregation logic as the pages.
- [ ] Implement `GET /api/approvals` plus review route if supported by Next route structure; if not, create `app/api/approvals/[id]/review/route.ts`.
- [ ] Implement `GET/POST /api/settings`.
- [ ] Implement public `GET /api/health`.

## Task 5: Broken Links And Redirects

**Files:**
- Modify: `app/(dashboard)/penalties/PenaltiesClient.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `app/(dashboard)/loans/[id]/LoanDetailClient.tsx`
- Modify: `app/(dashboard)/customers/[id]/CustomerProfileClient.tsx`
- Modify: `components/layout/Sidebar.tsx`
- Modify: `app/(dashboard)/settings/page.tsx`

- [ ] Change penalty customer links to use `customerCode`.
- [ ] Verify loan detail routes use loan `id` before changing penalty loan links.
- [ ] Add dashboard links for overdue loans, penalties, approvals, customers, and collection.
- [ ] Add/verify the loan-detail breadcrumb back to `/loans`.
- [ ] Link customer-profile loan codes to `/loans/${loan.id}`.
- [ ] Redirect agents from dashboard/settings to `/collection`.
- [ ] Verify sidebar superadmin-only subscription visibility remains correct.

## Task 6: Hardcoded Values And Module Pages

**Files:**
- Modify: `app/(dashboard)/customers/page.tsx`
- Modify: `app/(dashboard)/chits/new/page.tsx`
- Modify: `app/(dashboard)/chits/new/ChitGroupForm.tsx`
- Modify: `app/admin/users/page.tsx`
- Modify: `app/admin/users/UsersClient.tsx`
- Modify: `app/(dashboard)/vehicles/page.tsx`
- Modify: `app/(dashboard)/vehicles/new/page.tsx`
- Modify: `app/(dashboard)/vehicles/actions.ts`
- Modify: chit pages/actions listed in the prompt.

- [ ] Fetch `currency_symbol` from tenant settings wherever the UI currently hardcodes the rupee symbol outside defaults.
- [ ] Pass `currencySymbol` into `ChitGroupForm`.
- [ ] Pass current app type as `defaultAppType` into `UsersClient`.
- [ ] Replace hardcoded vehicle `appType: 'autofinance'` with `getUserAppType()`.
- [ ] Gate vehicle and chit pages/actions with `requireModule`.

## Task 7: Theme And Mobile Responsiveness

**Files:**
- Modify: `app/globals.css`
- Modify: `app/(dashboard)/loans/[id]/LoanDetailClient.tsx`
- Modify: `app/(dashboard)/loans/new/LoanForm.tsx`
- Modify: `app/(dashboard)/subscription/page.tsx`
- Modify: `components/layout/Sidebar.tsx`
- Modify: `app/(dashboard)/collection/CollectionClient.tsx`

- [ ] Add semantic CSS color variables and badge classes.
- [ ] Replace hardcoded badge inline colors with `getBadgeClass` or badge classes.
- [ ] Change `.form-computed` to use theme variables.
- [ ] Add mobile table/card/filter/modal/header/form/topbar/collection/loan-form rules.
- [ ] Add sidebar overlay close behavior on mobile.
- [ ] Add `collection-entry` class to collection rows.

## Task 8: Credit Score Logic

**Files:**
- Modify: `lib/creditScore.ts`

- [ ] Count partial instalment payments in `totalPaid`.
- [ ] Use `loan.tenure` for due instalment volume.
- [ ] Rebalance punctuality/completion/volume scoring to 55/35/10.
- [ ] Update grade thresholds to 780/680/560/440.
- [ ] Return `{ score: 0, grade: 'N/A' }` when loans have no paid, missed, or partial instalment activity.

## Task 9: Deduction Type And Save Template

**Files:**
- Modify: `app/(dashboard)/loans/new/LoanForm.tsx`
- Modify: `app/(dashboard)/loans/actions.ts`
- Modify: `app/(dashboard)/settings/actions.ts`
- Modify: `app/(dashboard)/settings/SettingsClient.tsx`

- [ ] Add fixed/percentage deduction state and hidden form values to the loan form.
- [ ] Restore package `deductionType` in `handlePackageChange`.
- [ ] Persist loan `deductionType` in `createLoan`.
- [ ] Persist package `deductionType` in settings package creation.
- [ ] Add deduction type controls to the package modal.
- [ ] Add "Save as Template" UI that POSTs to `/api/packages`.
- [ ] Maintain local package state and auto-select the saved template.

## Task 10: Production Hygiene

**Files:**
- Modify: `.gitignore`
- Modify: `README.md`

- [ ] Ignore `scratch/`, `database/*.sql`, and `loantrack_export*.sql`.
- [ ] Add `AUTH_SECRET` setup instructions to `README.md`.
- [ ] Do not mutate `.env` or `.env.local` secrets automatically.

## Verification

- [ ] Run `npx prisma generate`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build` if TypeScript generation succeeds.
- [ ] Run `npm run lint` and report whether remaining failures are pre-existing or introduced.
- [ ] Browser visual check remains blocked until the Browser Use/Codex Node runtime is upgraded to `v22.22.0+`; use code review and build output meanwhile.
