# 03 · Partial Payment Report

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Customers who paid **less than due** — partial collections. Highlights stress accounts before they roll
into missed/overdue.

## 2. Source models (READ ONLY)
- `Instalment` (`:529`): `status = 'partial'`, `dueAmount`, `receivedAmount`, `dueDate`, `agentId`.
- `Loan`, `Customer`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Customer | `customerName` | text | left | |
| Loan No | `loanCode` | text | left | |
| Due Date | `dueDate` | date | center | |
| Due | `dueAmount` | currency | right | ✓ |
| Paid | `receivedAmount` | currency | right | ✓ |
| Balance | `balance` | currency | right | ✓ |
| Paid % | `paidPct` | percent | right | |
| Agent | `agentName` | text | left | |

## 4. KPI cards
Partial count · total balance owed · avg paid %.

## 5. Filters
Date range, Branch, Agent.

## 6. API contract
`GET /api/v1/reports/partial-payment?from&to&branchId?&agentId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/partial-payment.ts`)
`findMany` instalments where `status='partial'` (scoped) in range; balance = due − paid; paidPct = paid/due.

## 8. Export mapping
8 columns → CSV/Excel/PDF/Print. Filename `partial-payment-<from>-to-<to>`.

## 9. i18n keys
`reports.partialPayment.title`, `reports.col.due|paid|balance|paidPct`.

## 10. RBAC + subscription
Agent scoped; admin tenant. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only `findMany`. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Status from enum. Currency/labels from DB/i18n.

## 13. Test plan
Seed partial instalments → assert balance/paidPct; export matches.
