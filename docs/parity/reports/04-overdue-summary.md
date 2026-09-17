# 04 · Overdue Summary

**Status:** ✅ EXISTS (wrap) · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
The most-used recovery report: every overdue customer with days overdue, amount overdue, assigned agent and
contact. Already exists as a paginated endpoint; this wraps it in the table-first + export shell.

## 2. Source models (READ ONLY)
- Existing `app/api/v1/reports/overdue/route.ts` → loanId, loanCode, customer, overdueAmount, overdueDays,
  missedCount. Backed by `Loan`/`Instalment`/`Customer`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Customer | `customerName` | text | left | |
| Loan No | `loanCode` | text | left | |
| Days Overdue | `overdueDays` | number | right | |
| Amount Overdue | `overdueAmount` | currency | right | ✓ |
| Missed | `missedCount` | number | right | ✓ |
| Agent | `agentName` | text | left | |
| Contact | `phone` | text | left | |

## 4. KPI cards
Overdue customers · total overdue amount · avg days overdue.

## 5. Filters
Branch, Agent, Min days overdue, Amount range.

## 6. API contract
**Existing:** `GET /api/v1/reports/overdue?page&pageSize`. Add adapter → `ReportPayload` (columns/rows/totals)
+ pass-through pagination.

## 7. Aggregation
Reuse existing route (sorted by overdueDays). Adapter adds agent name/phone via include. Scope already applied.

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print. Filename `overdue-summary-<date>`.

## 9. i18n keys
`reports.overdueSummary.title`, `reports.col.daysOverdue|amountOverdue|missed|contact`.

## 10. RBAC + subscription
Agent sees own; admin tenant. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
No change to existing endpoint. Adapter read-only/additive.

## 12. No-hardcode checklist
- [ ] No magic overdue threshold (filter is user input). Currency/labels from DB/i18n.

## 13. Test plan
Seed overdue loans → adapter rows == endpoint; sorted desc by days; export totals match.
