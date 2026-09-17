# 06 · Repeat Borrowers

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Customers with **2+ / 3+ / 5+** loans over their lifetime — loyal/repeat business. Drives retention offers
and pre-approved renewals.

## 2. Source models (READ ONLY)
- `Loan` (`:444`) grouped by `customerId` → count. `Customer` (`:283`).
- Tier thresholds (2/3/5) from `getSetting(tenantId,'report_repeat_tiers','2,3,5')`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Customer | `customerName` | text | left | |
| Total Loans | `loanCount` | number | right | ✓ |
| Lifetime Disbursed | `lifetimeDisbursed` | currency | right | ✓ |
| Active Loans | `activeLoans` | number | right | |
| Last Loan Date | `lastLoanDate` | date | center | |
| Tier | `tier` | badge | center | |

`tier` ∈ {2+, 3+, 5+}.

## 4. KPI cards
Repeat customers · share of book · avg loans/customer.

## 5. Filters
Branch, Agent, Min loans (tier).

## 6. API contract
`GET /api/v1/reports/repeat-borrowers?branchId?&minLoans?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/repeat-borrowers.ts`)
`groupBy customerId` (scoped) `_count` loans + `_sum` disbursed; keep `count ≥ minTier`; assign tier.

## 8. Export mapping
6 columns → CSV/Excel/PDF/Print. Filename `repeat-borrowers-<date>`.

## 9. i18n keys
`reports.repeatBorrowers.title`, `reports.col.loanCount|lifetimeDisbursed|activeLoans|lastLoan|tier`.

## 10. RBAC + subscription
Admin/manager; agent scoped. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only `groupBy`. Tiers from `AppSetting`. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Tier thresholds from `AppSetting`. Currency/labels from DB/i18n.

## 13. Test plan
Seed customers with 1/2/3/5 loans → assert tiering and counts; export matches.
