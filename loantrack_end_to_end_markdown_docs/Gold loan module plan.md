# Gold Loan Module Implementation Plan

**Summary**
Add `goldloan` as a first-class paid subscription module using the existing slug-based dashboard shell: `/goldloan/dashboard`, `/goldloan/loans`, `/goldloan/customers`, `/goldloan/collection`, etc. Reuse the shared loan, customer, route, collection, reports, accounting, approval, notification, and mobile API flows by scoping records with `appType = 'goldloan'`, and add a dedicated structured collateral table for gold-specific data.

**Key Changes**

- Add `goldloan` to the module registry in `types/modules.ts`.
  - `ALL_MODULES`: include `'goldloan'`.
  - `MODULE_SLUGS`: map `goldloan` to `'goldloan'`.
  - `MODULE_LABELS`: `Gold Loan`.
  - `MODULE_ROUTES`: mirror microlending routes, excluding vehicles/chits: `/loans`, `/customers`, `/collection`, `/route-tracker`, `/penalties`, `/reports`, `/accounting`, `/analytics`, `/approvals`, `/notifications`, `/agent-dashboard`.
  - Preserve slug behavior through `parseModulePath`, `modulePath`, and `prefixDashboardHref`; do not create separate top-level route folders.

- Add product identity and navigation support.
  - Extend `lib/appConfig.ts` `AppType` and `APP_CONFIGS` with `goldloan`, using icon `workspace_premium` or `account_balance_wallet`, name `Gold Loan`, and a gold/burgundy theme.
  - Update `components/layout/Sidebar.tsx` so `goldloan` shows dashboard, customers, loans, collections, penalties, approvals, KYC review, accounting, analytics, route tracker, notifications, settings, subscription, and branch requests as appropriate.
  - Update portal app selection automatically via `APP_CONFIGS`, no special-case routing.

- Add subscription/pricing support as a paid module.
  - Add `goldloan: 'Gold Loan'` to `lib/plans.ts` labels, but do not include it in existing `PLAN_FEATURES` defaults.
  - Add a `goldloan` row to `prisma/seed-pricing.ts` `ModulePriceCatalog`, e.g. display name `Gold Loan`, description `Gold-backed lending, valuation, LTV, packets, pledges, and release tracking`, monthly price configurable by developer, recommended default `699`, sort order after Auto Finance and before Chit Funds.
  - Ensure register, billing, branch, user, team, and module-request screens pick it up through `ALL_MODULES`, `MODULE_LABELS`, or pricing catalog.
  - Existing module request approval should append `goldloan` to `TenantSubscription.enabledModules`.

- Add structured gold collateral storage.
  - Create Prisma model `GoldLoanCollateral` mapped to `gold_loan_collaterals`.
  - Fields:
    - `id String @id @default(cuid())`
    - `tenantId String @map("tenant_id")`
    - `branchId String? @map("branch_id")`
    - `loanId String @unique @map("loan_id")`
    - `customerId String @map("customer_id")`
    - `packetNo String? @map("packet_no")`
    - `ornamentDescription String? @map("ornament_description") @db.Text`
    - `grossWeightGrams Decimal @map("gross_weight_grams") @db.Decimal(12, 3)`
    - `netWeightGrams Decimal @map("net_weight_grams") @db.Decimal(12, 3)`
    - `purityKarat String @map("purity_karat")`
    - `marketRatePerGram Decimal? @map("market_rate_per_gram") @db.Decimal(12, 2)`
    - `assessedValue Decimal? @map("assessed_value") @db.Decimal(12, 2)`
    - `eligibleLtvPercent Decimal? @map("eligible_ltv_percent") @db.Decimal(5, 2)`
    - `storageLocation String? @map("storage_location")`
    - `valuerName String? @map("valuer_name")`
    - `valuationDate DateTime? @map("valuation_date") @db.Date`
    - `releaseStatus String @default("pledged") @map("release_status")`
    - `releasedAt DateTime? @map("released_at")`
    - timestamps and relations to `Tenant`, `Branch`, `Customer`, and `Loan`.
  - Add indexes on `[tenantId, releaseStatus]`, `[tenantId, packetNo]`, `[branchId]`, `[customerId]`.

- Update loan creation/editing for Gold Loan.
  - In `app/(dashboard)/[module]/loans/actions.ts`, replace the hardcoded `assertModuleEnabled('microlending')` with validation against the active `appType` when it is a valid module key.
  - For `appType === 'goldloan'`, force/default `loanType = 'gold'`.
  - Add required form fields for gold collateral on the new/edit loan form when `appType === 'goldloan'`: packet number, ornament description, gross weight, net weight, purity, market rate, assessed value, LTV, storage location, valuer name, valuation date.
  - On create/update, write `Loan.collateralDetails` as a JSON audit snapshot and create/update the `GoldLoanCollateral` row transactionally.
  - On loan detail pages, show the structured gold collateral panel only for `goldloan` loans.

- Keep shared APIs module-scoped.
  - Existing `/api/loans`, `/api/customers`, `/api/collection`, `/api/reports`, and `/api/v1/*` already use `getUserAppType()`/`ctx.appType`; ensure `goldloan` passes through without being normalized back to microlending.
  - Update `lib/tenant.ts` only if needed so active app cookie/module slug recognition handles `goldloan`; no route-exclusive rule is required because `/loans` is shared.
  - Mobile loan POST should accept optional `goldCollateral` when `ctx.appType === 'goldloan'` and create the structured row in the same transaction.

**Test Plan**

- Add/update `tests/moduleRoutes.test.ts`.
  - `modulePath('goldloan', '/loans') === '/goldloan/loans'`.
  - `parseModulePath('/goldloan/loans/new')` returns `{ module: 'goldloan', page: '/loans/new' }`.
  - `isRouteEnabledForModules('/goldloan/loans/new', ['goldloan']) === true`.
  - `isRouteEnabledForModules('/goldloan/vehicles', ['goldloan']) === false`.
  - Keep `moduleForRoute('/loans') === 'microlending'` for unprefixed legacy behavior.

- Add focused unit/integration tests.
  - `normalizeModuleList` accepts `goldloan`.
  - `createLoan` module gate checks active `goldloan` access, not hardcoded microlending.
  - Gold loan creation stores `Loan.appType = 'goldloan'`, `loanType = 'gold'`, and a linked `GoldLoanCollateral`.
  - A microlending/autofinance loan does not create a gold collateral row.
  - Subscription/module request approval adds `goldloan` to `TenantSubscription.enabledModules`.

- Run verification commands.
  - Confirm Node runtime first: `node -v` should be `v22.22.0` or above; current shell reports `v22.22.2`.
  - `npm run db:validate`
  - `npm run db:generate`
  - `npm run typecheck`
  - `tsx tests/moduleRoutes.test.ts`
  - Run the relevant loan/subscription tests available in the repo.
  - Start the app and rerun the browser-based visual check for portal, `/goldloan/dashboard`, `/goldloan/loans/new`, subscription/module request, and admin module approval flows.

**Assumptions**

- Final slug is `goldloan`.
- Gold Loan is a paid selectable/requestable module, not included automatically in existing plan defaults.
- Gold-specific collateral uses a dedicated table, while `Loan.collateralDetails` remains as a JSON snapshot for compatibility.
- The implementer must follow the repo’s Next.js 16 rule and consult `node_modules/next/dist/docs/` before changing App Router page/layout/server-action code.
