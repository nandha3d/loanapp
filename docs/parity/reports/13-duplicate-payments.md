# 13 · Duplicate Payments

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Suspected double payments — same loan, same amount, same/near time — for review and refund. A fraud/error
control report.

## 2. Source models (READ ONLY)
- `Payment` (`:1368`): group by `loanId` + `amount` + day; flag where count > 1 within a time window.
- Window from `getSetting(tenantId,'report_duplicate_window_min','120')` (minutes).

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Loan No | `loanCode` | text | left | |
| Customer | `customerName` | text | left | |
| Amount | `amount` | currency | right | ✓ |
| Count | `count` | number | right | ✓ |
| Times | `timestamps` | text | left | |
| Modes | `modes` | text | left | |
| Flag | `flag` | badge | center | |

## 4. KPI cards
Duplicate groups · suspected amount · loans affected.

## 5. Filters
Date range, Branch, Min count.

## 6. API contract
`GET /api/v1/reports/duplicate-payments?from&to&branchId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/duplicate-payments.ts`)
`groupBy loanId, amount` (scoped) within day → having count > 1; refine by time window from `AppSetting`;
collect timestamps/modes.

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print. Filename `duplicate-payments-<from>-to-<to>`.

## 9. i18n keys
`reports.duplicatePayments.title`, `reports.col.count|times|modes|flag`.

## 10. RBAC + subscription
Admin/owner/auditor. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only detection. No writes, no new columns, no auto-reversal — flags only for human review.

## 12. No-hardcode checklist
- [ ] Duplicate window from `AppSetting`. Currency/labels from DB/i18n.

## 13. Test plan
Seed two identical payments within window → assert flagged as duplicate; outside window → not flagged; export matches.
