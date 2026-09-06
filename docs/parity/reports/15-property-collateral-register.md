# 15 · Property Collateral Register 💎

**Status:** 🆕 NEW · **Module scope:** `property` only · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Register of all property-backed loans — property type, address, extent, market value, eligible amount,
documents on file, mortgage status. The property-finance master book.

## 2. Source models (READ ONLY)
- `PropertyCollateral` (`:947`): `propertyType`, `address`, `surveyNo`, `extentValue`, `extentUnit`,
  `marketValue`, `eligibleLtvPercent`, `eligibleAmount`, `mortgageStatus`, `valuerName`, `valuationDate`,
  `titleDeedPath`, `ecPath`, `taxReceiptPath`. `Loan`, `Customer`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Loan No | `loanCode` | text | left | |
| Customer | `customerName` | text | left | |
| Property Type | `propertyType` | badge | left | |
| Address | `address` | text | left | |
| Survey No | `surveyNo` | text | left | |
| Extent | `extent` | text | right | |
| Market Value | `marketValue` | currency | right | ✓ |
| Eligible Amount | `eligibleAmount` | currency | right | ✓ |
| Loan Amount | `principal` | currency | right | ✓ |
| Docs | `docsComplete` | badge | center | |
| Status | `mortgageStatus` | badge | center | |

`docsComplete` = all of title/EC/tax present.

## 4. KPI cards
Active mortgages · total market value · total exposure · docs-incomplete count.

## 5. Filters
Date range, Branch, Property type, Mortgage status.

## 6. API contract
`GET /api/v1/reports/property-collateral-register?from?&to?&branchId?&propertyType?&mortgageStatus?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/property-collateral-register.ts`)
`findMany` `PropertyCollateral` (scoped, `appType='property'`) include loan + customer; derive extent string +
docs-complete flag.

## 8. Export mapping
11 columns → CSV/Excel/PDF/Print (document paths as links in Excel; omitted from CSV). Filename
`property-register-<date>`.

## 9. i18n keys
`reports.propertyRegister.title`, `reports.col.propertyType|address|surveyNo|extent|marketValue|eligibleAmount|docs`.

## 10. RBAC + subscription
Property admin/manager; agent scoped. Module gate `property`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only over `PropertyCollateral`. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Property types/extent units from data. Currency/labels from DB/i18n.

## 13. Test plan
Seed property loans → assert register + value totals + docs flag; filter; export matches; module isolation.
