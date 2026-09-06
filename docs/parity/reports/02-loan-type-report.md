# 02 · Loan Type Report

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Portfolio sliced by repayment frequency / loan type — Daily, Weekly, Biweekly, Monthly, Quarterly, Custom.
Shows number of loans, total loan value, outstanding, and collection per type. Operator uses it to see
where the book is concentrated.

## 2. Source models (READ ONLY)
- `Loan` (`:444`): `frequency`, `loanType`, `principal`, `totalPayable`, `totalCollected`, `status`.
- Frequency/type buckets are **distinct values from data**, not hardcoded.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Type / Frequency | `bucket` | text | left | |
| No. of Loans | `count` | number | right | ✓ |
| Total Loan Value | `value` | currency | right | ✓ |
| Outstanding | `outstanding` | currency | right | ✓ |
| Collection | `collected` | currency | right | ✓ |

## 4. KPI cards
Total loans · Total value · Total outstanding · Overall collection %.

## 5. Filters
Date range (startDate), Branch, Agent, Loan Status. Group-by toggle: `frequency` (default) or `loanType`.

## 6. API contract
`GET /api/v1/reports/loan-type?from&to&branchId?&groupBy=frequency|loanType&status?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/loan-type.ts`)
```ts
const grouped = await prisma.loan.groupBy({ by:[groupBy],   // 'frequency' | 'loanType'
  where:{ tenantId, ...appScope(appType), ...scopedBranchWhere(ctx),
          startDate:{ gte:from, lte:to }, ...(status?{status}:{}) },
  _count:true, _sum:{ principal:true, totalPayable:true, totalCollected:true } });
```
value = `_sum.totalPayable`; outstanding = payable − collected; collected = `_sum.totalCollected`.

## 8. Export mapping
5 columns → CSV/Excel/PDF/Print. Filename `loan-type-<from>-to-<to>`.

## 9. i18n keys
`reports.loanType.title`, `reports.col.bucket|count|value|outstanding|collected`, frequency labels reuse `loan.freq.*`.

## 10. RBAC + subscription
Admin/manager full; agent scoped. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only `groupBy`. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Buckets from `distinct`, not a constant array.
- [ ] Currency/labels from DB/i18n.

## 13. Test plan
Seed loans across frequencies → assert per-bucket count/value/outstanding; switch groupBy=loanType; export matches.
