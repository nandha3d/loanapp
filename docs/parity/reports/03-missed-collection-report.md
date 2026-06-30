# 03 · Missed Collection Report

**Status:** 🔧 ENHANCE · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Customers who had a payment **due today (or in range) but did not pay** — the follow-up call list. Today's
defaulter alerts exist in the dashboard; this turns it into a filterable, exportable report.

## 2. Source models (READ ONLY)
- `Instalment` (`:529`): `dueDate`, `dueAmount`, `receivedAmount`, `status` (`missed`/`partial`/`upcoming`), `agentId`.
- `Loan` (`:444`), `Customer` (`:283`).

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Customer | `customerName` | text | left | |
| Loan No | `loanCode` | text | left | |
| Due Date | `dueDate` | date | center | |
| Amount Due | `dueAmount` | currency | right | ✓ |
| Received | `receivedAmount` | currency | right | ✓ |
| Shortfall | `shortfall` | currency | right | ✓ |
| Agent | `agentName` | text | left | |
| Phone | `phone` | text | left | |

`shortfall = dueAmount − receivedAmount`, rows where shortfall > 0 and dueDate ≤ asOf.

## 4. KPI cards
Missed count · total shortfall · worst agent/route.

## 5. Filters
Date range (default today), Branch, Agent, Route.

## 6. API contract
`GET /api/v1/reports/missed-collection?from?&to?&branchId?&agentId?` (default both = today) → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/missed-collection.ts`)
```ts
const rows = await prisma.instalment.findMany({ where:{
  loan:{ tenantId, ...appScope(appType), ...scopedBranchWhere(ctx) },
  dueDate:{ gte:from, lte:to }, status:{ in:['missed','partial','upcoming'] } },
  include:{ loan:{ include:{ customer:{ select:{ name:true, phone:true } } } } } });
// keep where dueAmount-receivedAmount>0
```

## 8. Export mapping
8 columns → CSV/Excel/PDF/Print. Filename `missed-collection-<from>-to-<to>`.

## 9. i18n keys
`reports.missedCollection.title`, `reports.col.dueDate|amountDue|received|shortfall|phone`.

## 10. RBAC + subscription
Agent sees own; admin tenant. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Reuses dashboard defaulter logic. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Status set from instalment enum. Currency/labels from DB/i18n.

## 13. Test plan
Seed instalments due today (some paid, some not) → assert only shortfall>0 listed; export matches.
