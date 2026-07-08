# 04 — Property Loan Vertical (P1, NEW MODULE)

## Objective
Add a **property / mortgage loan** vertical (collateral = immovable property with document management) so we match
Vasool's property loans and exceed them via our compliance + accounting stack.

## Vasool benchmark
Property loans with document management.

## Current state (file:line)
Not present. No `property` slug, model, or routes. Closest precedent = gold (`GoldLoanCollateral`) and auto
(`Vehicle`) verticals, which establish the exact pattern to copy.

## Gap
Entire vertical missing.

## Design (DB/config-driven) — follows the "add a module" checklist in `00-constraints-and-conventions.md`
New slug `property`. New collateral model mirroring gold's shape:

`PropertyCollateral`:
- `id`, `tenantId`, `appType` (default `'property'`), `loanId`
- `propertyType` (residential/commercial/land — from config list), `address`, `surveyNo`, `extentSqft`/`extentUnit`
- `marketValue`, `eligibleLtvPercent`, `eligibleAmount` (auto-calc, LTV default from `AppSetting`
  `property_default_ltv_percent`)
- `encumbranceStatus`, `registrationNo`, `valuerName`, `valuationDate`
- `titleDeedPath`, `ecPath`, `taxReceiptPath`, `photoPath` (document management)
- `mortgageStatus` `mortgaged|released`, `releasedAt`, `releasedBy`

Reuse generic loan/customer/collection flows; add only property-specific origination + release pages and a
document-checklist sub-UI.

## Schema changes
**Additive:** new `PropertyCollateral` table; add `'property'` wherever module slugs are enumerated (code-level, not
data migration). No changes to existing tables except none required (collateral is its own table).

## Wiring points (enumerated — all gated behind sign-off because they widen shared enums)
1. `types/modules.ts:1-6` add `'property'` to `ALL_MODULES`.
2. `types/modules.ts:10-15` add `MODULE_SLUGS.property` label key.
3. `types/modules.ts:24-29` add `MODULE_ROUTES.property` (loans, customers, collection, property, reports, settings…).
4. `lib/appConfig.ts` add `APP_CONFIGS.property` (colors/icon/logo/description).
5. `lib/plans.ts` add `'property'` to plans that include it (per §06 pricing).
6. `prisma/schema.prisma` add `PropertyCollateral`.
7. `prisma/seed-pricing.ts` add `ModulePriceCatalog` row `property`.
8. `app/(dashboard)/[module]/property/...` pages (origination, detail, release, docs checklist).
9. `components/layout/Sidebar.tsx` nav items `appTypes:['property']`.
10. Page guards `requireModule(tenantId,'property')`; queries `appScope('property')`.
11. i18n keys in all 6 languages.
12. Mobile: add slug + `kStrings`; reuse generic collection; property origination screen.

## API contract
Reuse loan-create + property collateral sub-resource; release `PATCH` mirrors gold.

## i18n keys (6 langs)
`property.field.type`, `property.field.address`, `property.field.extent`, `property.field.marketValue`,
`property.field.ltv`, `property.field.encumbrance`, `property.doc.titleDeed`, `property.doc.ec`,
`property.doc.taxReceipt`, `property.action.release`, `property.status.mortgaged`, `property.status.released`.

## Scope / RBAC guards
`appScope('property')` everywhere; `requireModule`; release restricted to admin roles.

## Feature-flag & rollout
Enabled via `enabledModules` per plan/tenant. Ship web first, mobile second.

## No-hardcode checklist
- [ ] Property types, default LTV from config/`AppSetting`, not inline.
- [ ] Document checklist items from a config list.
- [ ] All strings i18n; module branding via `APP_CONFIGS`.

## Test plan
- Module gating: tenant without `property` gets lock UI, not 404 leak.
- Isolation: property rows never appear under other modules (`appScope` test, like the scope tripwire in `lib/scope.ts`).
- E2E: originate property loan → docs upload → collect → release.

## ⚠️ Structure Impact
**Additive at data/route level**, but **edits shared enums/config** (`types/modules.ts`, `lib/plans.ts`,
`lib/appConfig.ts`, `Sidebar.tsx`). Per Rule 2, these shared-file edits **require explicit sign-off** before
implementation. New table + new routes are backward-compatible. **No existing behaviour changes.**
