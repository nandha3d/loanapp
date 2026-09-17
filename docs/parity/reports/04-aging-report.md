# 04 · Aging Report (6 buckets)

**Status:** 🔧 ENHANCE · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Overdue distribution across aging buckets: **1-7, 8-15, 16-30, 31-60, 61-90, 90+ days**. Per bucket: number
of customers, outstanding, interest, penalty. Today's `buildReportData()` has only 3 buckets — extend to 6,
with **bucket edges from `AppSetting`** so the operator can retune them.

## 2. Source models (READ ONLY)
- Existing aging logic `lib/reports/data.ts:68-105` (short/medium/long). `Loan`, `Instalment` (oldest missed
  dueDate), `Penalty` (`grossPenalty`).
- Bucket edges from `getSetting(tenantId,'report_aging_buckets','7,15,30,60,90')` — default reproduces the
  6-bucket scheme; **not hardcoded**.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Bucket | `bucket` | badge | left | |
| Customers | `customers` | number | right | ✓ |
| Outstanding | `outstanding` | currency | right | ✓ |
| Interest | `interest` | currency | right | ✓ |
| Penalty | `penalty` | currency | right | ✓ |

Buckets: `1-7`, `8-15`, `16-30`, `31-60`, `61-90`, `90+`.

## 4. KPI cards
Total overdue customers · total outstanding · 90+ concentration %.

## 5. Filters
Branch, Agent, Loan Type, asOf date.

## 6. API contract
`GET /api/v1/reports/aging?asOf?&branchId?&agentId?&loanType?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/aging.ts`, generalizing `data.ts` aging)
```ts
const edges = (await getSetting(tenantId,'report_aging_buckets','7,15,30,60,90')).split(',').map(Number);
// for each overdue loan: daysMissed = asOf - oldestMissedDueDate; classify into edge buckets (last = 90+)
// accumulate customers(Set), outstanding(due-received), interest, penalty(grossPenalty) per bucket
```
**Refactor note:** keep `buildReportData()`'s 3-bucket output working for current consumers; add this 6-bucket
builder alongside (additive), do not break the existing shape.

## 8. Export mapping
5 columns → CSV/Excel/PDF/Print. Generalized `TableReportPDF` replaces the fixed 3-row PDF aging block.
Filename `aging-report-<asOf>`.

## 9. i18n keys
`reports.aging.title`, `reports.bucket.d1_7|d8_15|d16_30|d31_60|d61_90|d90plus`, `reports.col.customers|outstanding|interest|penalty`.

## 10. RBAC + subscription
Admin/manager; agent scoped. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Existing `buildReportData()` left intact; new builder is additive. No writes, no new columns.
Bucket edges from `AppSetting`.

## 12. No-hardcode checklist
- [ ] Bucket edges from `AppSetting`, not literals.
- [ ] Currency/labels from DB/i18n.

## 13. Test plan
Seed overdue loans at 5/12/20/45/75/120 days → assert each lands in correct bucket; retune `AppSetting` edges
→ reclassification; export totals match. Verify existing 3-bucket consumers unaffected.
