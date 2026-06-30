# 05 · EMI Schedule Report

**Status:** 🔧 ENHANCE · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Full instalment schedule for a loan (or filtered set): every instalment with due date, paid date, delay,
penalty, running balance. Per-loan instalments exist; this standardizes + adds export.

## 2. Source models (READ ONLY)
- `Instalment` (`:529`): `instalmentNo`, `dueDate`, `dueAmount`, `receivedAmount`, `receivedAt`, `status`,
  `paymentMode`, `penaltyApplied`. `Penalty` (`:561`). `Loan` (`:444`).

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| # | `instalmentNo` | number | center | |
| Due Date | `dueDate` | date | center | |
| Paid Date | `receivedAt` | date | center | |
| Delay (days) | `delay` | number | right | |
| Due | `dueAmount` | currency | right | ✓ |
| Paid | `receivedAmount` | currency | right | ✓ |
| Penalty | `penalty` | currency | right | ✓ |
| Balance | `balance` | currency | right | |
| Status | `status` | badge | center | |

`delay = receivedAt − dueDate` (0 if on/early). Balance = remaining payable.

## 4. KPI cards
Total instalments · paid · pending · total penalty.

## 5. Filters
Loan (required for single loan) OR Customer; Date range; Status.

## 6. API contract
`GET /api/v1/reports/emi-schedule?loanId` (single) or `?customerId&from&to` → `ok(payload)`. Reuse existing
`loans/[id]/instalments`/`statement` query where possible.

## 7. Aggregation (builder `lib/reports/builders/emi-schedule.ts`)
`findMany` instalments by loan (scoped), ordered by `instalmentNo`; join penalties; compute delay + running
balance.

## 8. Export mapping
9 columns → CSV/Excel/PDF/Print. Filename `emi-schedule-<loanCode>`.

## 9. i18n keys
`reports.emiSchedule.title`, `reports.col.instalmentNo|dueDate|paidDate|delay|penalty|balance`.

## 10. RBAC + subscription
Agent sees own loans; admin all. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Reuses instalment/statement queries. No writes, no new columns, no schedule regeneration.

## 12. No-hardcode checklist
- [ ] Status from enum. Currency/labels from DB/i18n.

## 13. Test plan
Seed a loan with mixed paid/late instalments → assert delay + balance + penalty per row; export matches.
