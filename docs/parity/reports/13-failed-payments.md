# 13 · Failed Payments

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Digital payment attempts that **failed** (gateway/UPI/NACH declines) — so staff can follow up and re-collect.

## 2. Source models (READ ONLY)
- `Payment` (`:1368`): `status='failed'` (or gateway failure state), `paymentMode`, `amount`, `paymentDate`,
  failure reason if stored. Self-pay/gateway records.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Date | `paymentDate` | date | left | |
| Customer | `customerName` | text | left | |
| Loan No | `loanCode` | text | left | |
| Mode | `paymentMode` | badge | center | |
| Amount | `amount` | currency | right | ✓ |
| Reason | `failReason` | text | left | |
| Retry? | `retryable` | badge | center | |

## 4. KPI cards
Failed count · failed value · top failure reason · retryable %.

## 5. Filters
Date range, Branch, Mode, Reason.

## 6. API contract
`GET /api/v1/reports/failed-payments?from&to&mode?&branchId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/failed-payments.ts`)
`findMany` payments with failed status (scoped); group reasons for KPI.

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print. Filename `failed-payments-<from>-to-<to>`.

## 9. i18n keys
`reports.failedPayments.title`, `reports.col.reason|retry`.

## 10. RBAC + subscription
Admin/accountant. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. No writes, no new columns, no retry triggered from the report.

## 12. No-hardcode checklist
- [ ] Failure status/reasons from existing payment fields. Currency/labels from DB/i18n.

## 13. Test plan
Seed failed payment records → assert listing + reason KPI; export matches.
