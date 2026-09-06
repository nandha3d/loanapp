# 08 · Penalty Income Report

**Status:** ✅ EXISTS (wrap) · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Late-fee / penalty collected over a period — accrued, settled, waived. `app/api/reports/route.ts`
(`?type=penalty`) + `buildReportData().penaltyReport` exist; wrap + export + period grouping.

## 2. Source models (READ ONLY)
- `Penalty` (`:561`): `grossPenalty`, `settledAmount`, `waivedAmount`, `createdAt`, `settledAt`, `status`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Period | `period` | text | left | |
| Accrued | `accrued` | currency | right | ✓ |
| Settled (collected) | `settled` | currency | right | ✓ |
| Waived | `waived` | currency | right | ✓ |
| Outstanding | `outstanding` | currency | right | ✓ |

`outstanding = accrued − settled − waived`.

## 4. KPI cards
Penalty income (settled) · waived total · realization %.

## 5. Filters
Date range, Branch, Agent, Bucket = day|month.

## 6. API contract
`GET /api/v1/reports/penalty-income?from&to&bucket?&branchId?` → `ok(payload)`. Adapter over existing penalty
aggregation (`lib/reports/data.ts:108`).

## 7. Aggregation
Reuse penalty `aggregate` (`_sum grossPenalty/settledAmount/waivedAmount`) grouped by bucket (scoped).

## 8. Export mapping
5 columns → CSV/Excel/PDF/Print. Filename `penalty-income-<from>-to-<to>`.

## 9. i18n keys
`reports.penaltyIncome.title`, `reports.col.accrued|settled|waived|outstanding`.

## 10. RBAC + subscription
Admin/owner/accountant. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
No change to existing penalty aggregation. Adapter read-only/additive.

## 12. No-hardcode checklist
- [ ] Currency/labels from DB/i18n. No magic penalty rate (read from data).

## 13. Test plan
Seed penalties (accrued/settled/waived) → assert sums + outstanding; export matches.
