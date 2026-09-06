# 05 — Product / Consumer Financing Vertical (P1, NEW MODULE)

## Objective
Add **product-based financing** (consumer durables / EMI-on-product through dealers) to match Vasool's product
financing and exceed it with our bureau + NPA + accounting integration.

## Vasool benchmark
Product-based financing.

## Current state (file:line)
Not present. Pattern precedent = auto (`Vehicle`) and gold verticals.

## Gap
Entire vertical missing.

## Design (DB/config-driven) — follows "add a module" checklist in `00-constraints-and-conventions.md`
New slug `productfinance`. New detail model:

`ProductFinanceItem`:
- `id`, `tenantId`, `appType` (default `'productfinance'`), `loanId`
- `category` (from config list), `productName`, `brand`, `modelNo`, `serialNo`/`imei`
- `dealerName`, `dealerId` (optional link), `invoiceNo`, `invoiceAmount`
- `downPayment`, `financedAmount`, `tenureMonths`
- `warrantyExpiry`, `invoicePath`, `photoPath`
- `repossessionStatus` `active|repossessed|closed`

Reuse generic loan/customer/collection/EMI flows; add only product-specific origination + dealer capture.

## Schema changes
**Additive:** new `ProductFinanceItem` table; add `'productfinance'` to slug enumerations (code-level).

## Wiring points (gated behind sign-off — widens shared enums)
Same 12-step checklist as §04, substituting `productfinance`:
`types/modules.ts` (×3), `lib/appConfig.ts`, `lib/plans.ts`, `schema.prisma` (`ProductFinanceItem`),
`seed-pricing.ts`, routes `app/(dashboard)/[module]/products/...`, `Sidebar.tsx`, guards, i18n ×6, mobile.

## API contract
Reuse loan-create + product item sub-resource; status `PATCH` for repossession/closure.

## i18n keys (6 langs)
`product.field.category`, `product.field.name`, `product.field.brand`, `product.field.serial`,
`product.field.dealer`, `product.field.invoice`, `product.field.downPayment`, `product.field.financed`,
`product.field.tenure`, `product.action.repossess`, `product.status.active`, `product.status.repossessed`.

## Scope / RBAC guards
`appScope('productfinance')`; `requireModule`; status actions admin-gated.

## Feature-flag & rollout
Via `enabledModules`. Web first, mobile second.

## No-hardcode checklist
- [ ] Product categories, dealer list from config/DB, not inline.
- [ ] EMI math reuses existing loan calculator (no duplicate formula).
- [ ] All strings i18n; branding via `APP_CONFIGS`.

## Test plan
- Module gating + isolation (`appScope` tripwire).
- E2E: dealer + product capture → EMI schedule → collection → closure.
- Bureau/NPA: confirm product loans flow through existing NPA classification + bureau pull unchanged.

## ⚠️ Structure Impact
**Additive at data/route level**; **edits shared enums/config** (same 4 shared files as §04). Per Rule 2 those edits
**require explicit sign-off**. New table + routes are backward-compatible. **No existing behaviour changes.**
