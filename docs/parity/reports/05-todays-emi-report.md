# 05 · Today's EMI Report

**Status:** 🔧 ENHANCE · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
All collections **due today** — the day's worklist. The collection dashboard already computes today's
instalments; this turns it into a printable/exportable sheet.

## 2. Source models (READ ONLY)
- `Instalment` (`:529`): `dueDate = today`, `dueAmount`, `receivedAmount`, `status`, `agentId`.
- Existing logic in `app/api/v1/collection/dashboard/route.ts` (today's instalments, frequency-aware).

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Customer | `customerName` | text | left | |
| Loan No | `loanCode` | text | left | |
| Amount Due | `dueAmount` | currency | right | ✓ |
| Collected | `receivedAmount` | currency | right | ✓ |
| Pending | `pending` | currency | right | ✓ |
| Agent | `agentName` | text | left | |
| Route | `routeName` | text | left | |
| Status | `status` | badge | center | |

## 4. KPI cards
Total due today · collected so far · pending · count.

## 5. Filters
Branch, Agent, Route, Status.

## 6. API contract
`GET /api/v1/reports/todays-emi?asOf?&branchId?&agentId?&routeId?` → `ok(payload)`. Reuse dashboard's
today-instalment query (frequency-aware visibility).

## 7. Aggregation (builder `lib/reports/builders/todays-emi.ts`)
Reuse the frequency-aware "due today" logic from the collection dashboard (scoped); compute pending.

## 8. Export mapping
8 columns → CSV/Excel/PDF/Print. Filename `todays-emi-<asOf>`.

## 9. i18n keys
`reports.todaysEmi.title`, `reports.col.amountDue|collected|pending|route`.

## 10. RBAC + subscription
Agent sees own worklist; admin tenant. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Reuses dashboard query; no change to it. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Frequency visibility reuses existing policy. Currency/labels from DB/i18n.

## 13. Test plan
Seed instalments due today across frequencies → assert worklist matches dashboard; export totals match.
