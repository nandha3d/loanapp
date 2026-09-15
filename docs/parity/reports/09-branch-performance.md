# 09 · Branch Performance

**Status:** 🆕 NEW · **Module scope:** all (multi-branch) · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Per-branch scorecard: loans, collections, outstanding, recovery %. The dashboard shows route performance;
this rolls up to branch level for multi-branch tenants.

## 2. Source models (READ ONLY)
- `Branch` (`:74`). `Loan`/`Instalment`/`Penalty` aggregated by `branchId` (scoped to tenant+module).

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Branch | `branchName` | text | left | |
| Active Loans | `activeLoans` | number | right | ✓ |
| Disbursed | `disbursed` | currency | right | ✓ |
| Collected | `collected` | currency | right | ✓ |
| Outstanding | `outstanding` | currency | right | ✓ |
| Recovery % | `recovery` | percent | right | |

## 4. KPI cards
Best branch · total outstanding · avg recovery %.

## 5. Filters
Date range, Branch (multi-select), Loan Type.

## 6. API contract
`GET /api/v1/reports/branch-performance?from&to&loanType?` → `ok(payload)`. Superadmin sees all branches;
branch users see their own only (`scopedBranchWhere`).

## 7. Aggregation (builder `lib/reports/builders/branch-performance.ts`)
`groupBy branchId` (scoped) across loans/instalments/penalties; recovery = collected/expected.

## 8. Export mapping
6 columns → CSV/Excel/PDF/Print. Filename `branch-performance-<from>-to-<to>`.

## 9. i18n keys
`reports.branchPerformance.title`, `reports.col.branch|activeLoans|disbursed|collected|outstanding|recovery`.

## 10. RBAC + subscription
Superadmin/owner (cross-branch). Hidden for single-branch tenants. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only `groupBy`. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Branch list from DB. Currency/labels from DB/i18n.

## 13. Test plan
Seed loans across 3 branches → assert per-branch totals + recovery; branch user sees only own; export matches.
