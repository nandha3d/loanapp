# 06 · Inactive Customers

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Customers with **no loan for 6 months / 1 year** — dormant accounts to re-engage. The win-back list.

## 2. Source models (READ ONLY)
- `Loan` (`:444`): latest `startDate`/`createdAt` per customer. `Customer` (`:283`): `status`.
- Inactivity windows from `getSetting(tenantId,'report_inactive_windows','180,365')` (days).

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Customer | `customerName` | text | left | |
| Phone | `phone` | text | left | |
| Last Loan Date | `lastLoanDate` | date | center | |
| Days Inactive | `daysInactive` | number | right | |
| Lifetime Loans | `loanCount` | number | right | ✓ |
| Window | `window` | badge | center | |

`window` ∈ {≥6mo, ≥1yr}.

## 4. KPI cards
Inactive ≥6mo · ≥1yr · total dormant.

## 5. Filters
Branch, Agent, Window.

## 6. API contract
`GET /api/v1/reports/inactive-customers?asOf?&branchId?&window?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/inactive-customers.ts`)
Per customer (scoped): max loan date; daysInactive = asOf − lastLoanDate; keep ≥ minWindow; no active loan.

## 8. Export mapping
6 columns → CSV/Excel/PDF/Print. Filename `inactive-customers-<asOf>`.

## 9. i18n keys
`reports.inactiveCustomers.title`, `reports.col.lastLoan|daysInactive`, `reports.window.m6|y1`.

## 10. RBAC + subscription
Admin/manager; agent scoped. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Windows from `AppSetting`. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Windows from `AppSetting`. Labels from DB/i18n.

## 13. Test plan
Seed customers with last loan at −200d/−400d → assert window; active-loan customers excluded; export matches.
