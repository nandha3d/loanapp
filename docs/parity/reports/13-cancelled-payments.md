# 13 · Cancelled Payments

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Payments that were **cancelled / voided / reversed** after entry (mistaken entry, bounced cheque) — audit and
reconciliation of nullified transactions.

## 2. Source models (READ ONLY)
- `Payment` (`:1368`): `status='cancelled'`/`'reversed'` (or void flag), `amount`, `paymentDate`, `loanId`,
  cancel reason/by if stored. `AuditLog` for who/when cancelled.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Original Date | `paymentDate` | date | left | |
| Cancelled Date | `cancelledAt` | date | left | |
| Customer | `customerName` | text | left | |
| Loan No | `loanCode` | text | left | |
| Amount | `amount` | currency | right | ✓ |
| Reason | `reason` | text | left | |
| Cancelled By | `cancelledBy` | text | left | |

## 4. KPI cards
Cancelled count · cancelled value · top reason.

## 5. Filters
Date range, Branch, Reason.

## 6. API contract
`GET /api/v1/reports/cancelled-payments?from&to&branchId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/cancelled-payments.ts`)
`findMany` cancelled/reversed payments (scoped); join `AuditLog` for actor/reason.

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print. Filename `cancelled-payments-<from>-to-<to>`.

## 9. i18n keys
`reports.cancelledPayments.title`, `reports.col.cancelledDate|reason|cancelledBy`.

## 10. RBAC + subscription
Admin/owner/auditor. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. No writes, no new columns, no cancellation performed from the report.

## 12. No-hardcode checklist
- [ ] Cancelled status from existing payment fields. Currency/labels from DB/i18n.

## 13. Test plan
Seed cancelled payments → assert listing + actor/reason; export matches.
