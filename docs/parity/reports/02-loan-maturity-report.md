# 02 · Loan Maturity Report

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Loans approaching or past their `endDate`: ending today, next 7 days, next 30 days, and **matured but
unpaid** (endDate passed with outstanding > 0). Drives renewal/closure follow-up and (for gold) auction prep.

## 2. Source models (READ ONLY)
- `Loan` (`:444`): `endDate`, `status`, `totalPayable`, `totalCollected`, `loanCode`, `customerId`.
- Maturity buckets computed from `endDate` vs `now` — **windows (7/30) are `AppSetting`-configurable**
  (`report_maturity_windows`), default `7,30`, not hardcoded.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Loan No | `loanCode` | text | left | |
| Customer | `customerName` | text | left | |
| End Date | `endDate` | date | center | |
| Days to Maturity | `daysToMaturity` | number | right | |
| Outstanding | `outstanding` | currency | right | ✓ |
| Bucket | `bucket` | badge | center | |

`bucket` ∈ {Today, ≤7d, ≤30d, Matured-Unpaid}. Negative `daysToMaturity` = overdue maturity.

## 4. KPI cards
Ending today · Next 7d · Next 30d · Matured-unpaid (count + outstanding each).

## 5. Filters
Branch, Agent, Loan Type, Bucket. (Date is derived from `now`; optional `asOf` override.)

## 6. API contract
`GET /api/v1/reports/loan-maturity?asOf?&branchId?&agentId?&loanType?&bucket?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/loan-maturity.ts`)
```ts
const windows = (await getSetting(tenantId,'report_maturity_windows','7,30')).split(',').map(Number);
const loans = await prisma.loan.findMany({ where:{ tenantId, ...appScope(appType),
  ...scopedBranchWhere(ctx), status:{ in:['active','overdue'] } },
  include:{ customer:{ select:{ name:true } } } });
// classify by (endDate - asOf) into Today/≤w1/≤w2/Matured-Unpaid (outstanding>0 && endDate<asOf)
```

## 8. Export mapping
6 columns → CSV/Excel/PDF/Print. Filename `loan-maturity-<asOf>`.

## 9. i18n keys
`reports.loanMaturity.title`, `reports.bucket.today|d7|d30|maturedUnpaid`, `reports.col.endDate|daysToMaturity|outstanding`.

## 10. RBAC + subscription
Admin/manager full; agent scoped. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only `findMany`. No writes, no new columns. Windows from `AppSetting`, not code.

## 12. No-hardcode checklist
- [ ] Maturity windows from `AppSetting`.
- [ ] Currency/labels from DB/i18n.

## 13. Test plan
Seed loans with endDates around `asOf` → assert each falls in correct bucket; matured-unpaid only when
outstanding>0; export totals match.
