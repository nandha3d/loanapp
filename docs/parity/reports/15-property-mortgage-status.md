# 15 · Property Mortgage Status 💎

**Status:** 🆕 NEW · **Module scope:** `property` only · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Lifecycle status of property mortgages — mortgaged / released / under-process — and which titles are held vs
returned. Critical for document custody and release compliance.

## 2. Source models (READ ONLY)
- `PropertyCollateral` (`:947`): `mortgageStatus`, `releasedAt`, `releasedBy`, document paths.
- `Loan` (`:444`) status for cross-check.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Loan No | `loanCode` | text | left | |
| Customer | `customerName` | text | left | |
| Property Type | `propertyType` | badge | left | |
| Mortgage Status | `mortgageStatus` | badge | center | |
| Title Held? | `titleHeld` | badge | center | |
| Released Date | `releasedAt` | date | center | |
| Released By | `releasedBy` | text | left | |
| Loan Status | `loanStatus` | badge | center | |

## 4. KPI cards
Mortgaged · released · under-process · titles held count.

## 5. Filters
Branch, Mortgage status, Date range (on released).

## 6. API contract
`GET /api/v1/reports/property-mortgage-status?branchId?&mortgageStatus?&from?&to?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/property-mortgage-status.ts`)
`findMany` `PropertyCollateral` (scoped); titleHeld = docs present and not released; join loan status.

## 8. Export mapping
8 columns → CSV/Excel/PDF/Print. Filename `property-mortgage-status-<date>`.

## 9. i18n keys
`reports.propertyMortgageStatus.title`, `reports.col.mortgageStatus|titleHeld|releasedDate|releasedBy`.

## 10. RBAC + subscription
Property admin/manager/compliance. Module gate `property`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. No writes, no new columns, no release performed from report.

## 12. No-hardcode checklist
- [ ] Status values from data. Labels from i18n.

## 13. Test plan
Seed properties in each status → assert classification + title-held flag; export matches.
