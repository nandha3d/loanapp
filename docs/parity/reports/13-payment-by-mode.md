# 13 · Payment by Mode

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
All payments broken down by channel — Cash / UPI / Bank / Cheque collections — for treasury reconciliation.
(The collection-mode report §03 is collection-side; this is the payment-ledger side and lists individual
transactions, not just totals.)

## 2. Source models (READ ONLY)
- `Payment` (`:1368`): `amount`, `paymentMode`, `paymentDate`, `paymentType`, `status`, `loanId`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Date | `paymentDate` | date | left | |
| Loan No | `loanCode` | text | left | |
| Customer | `customerName` | text | left | |
| Mode | `paymentMode` | badge | center | |
| Type | `paymentType` | badge | center | |
| Amount | `amount` | currency | right | ✓ |
| Status | `status` | badge | center | |

## 4. KPI cards
Total by mode (cash/upi/bank/cheque chips) · transaction count.

## 5. Filters
Date range, Branch, Agent, Mode, Type, Status.

## 6. API contract
`GET /api/v1/reports/payment-by-mode?from&to&mode?&type?&status?&branchId?&cursor?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/payment-by-mode.ts`)
`findMany` payments (scoped via loan) with filters; KPI via `groupBy paymentMode _sum amount`.

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print. Filename `payment-by-mode-<from>-to-<to>`.

## 9. i18n keys
`reports.paymentByMode.title`, `reports.col.mode|type|amount|status`.

## 10. RBAC + subscription
Admin/accountant; agent scoped. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only over `Payment`. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Mode/type/status options from distinct DB values. Currency/labels from DB/i18n.

## 13. Test plan
Seed payments across modes → assert per-mode totals + txn list; filter; export matches.
