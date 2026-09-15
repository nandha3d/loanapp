# 03 · Advance Payment Report

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Customers who paid **early / ahead of schedule** — instalments received before their `dueDate`, or payments
exceeding the current due (credit balance). Useful for cash-flow forecasting and good-customer recognition.

## 2. Source models (READ ONLY)
- `Instalment` (`:529`): `dueDate`, `receivedAt`, `status='paid'`, `dueAmount`, `receivedAmount`.
- `Payment` (`:1368`): `paymentDate` vs instalment `dueDate`; over-payment via allocation surplus.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Customer | `customerName` | text | left | |
| Loan No | `loanCode` | text | left | |
| Due Date | `dueDate` | date | center | |
| Paid Date | `receivedAt` | date | center | |
| Days Early | `daysEarly` | number | right | |
| Amount | `receivedAmount` | currency | right | ✓ |
| Advance/Credit | `advance` | currency | right | ✓ |

`daysEarly = dueDate − receivedAt` (positive). `advance` = surplus over due.

## 4. KPI cards
Advance-paying customers · total advance amount · avg days early.

## 5. Filters
Date range, Branch, Agent.

## 6. API contract
`GET /api/v1/reports/advance-payment?from&to&branchId?&agentId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/advance-payment.ts`)
`findMany` paid instalments (scoped) where `receivedAt < dueDate`; compute daysEarly, advance from
allocation surplus.

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print. Filename `advance-payment-<from>-to-<to>`.

## 9. i18n keys
`reports.advancePayment.title`, `reports.col.paidDate|daysEarly|advance`.

## 10. RBAC + subscription
Agent scoped; admin tenant. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only `findMany`. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] No magic "early" threshold beyond `receivedAt < dueDate`. Currency/labels from DB/i18n.

## 13. Test plan
Seed early-paid instalments → assert daysEarly>0 and advance; export matches.
