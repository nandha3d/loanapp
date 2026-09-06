# 03 · Daily Collection Report

**Status:** ✅ EXISTS (document + wrap in shell) · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
The lender's everyday sheet: per agent/customer — amount due, amount collected, pending, and time of
collection for a single day. Already powering the dashboard; this spec standardizes it into the
table-first + export shell.

## 2. Source models (READ ONLY)
- Existing endpoint `app/api/v1/reports/daily/route.ts` aggregates `DailyCollection` (`:588`) +
  `CollectionEntry` (`:618`): `dueAmount`, `receivedAmount`, `paymentMode`, `submittedAt`, `agentId`,
  `customerId`, `gpsCapturedAt`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Agent | `agentName` | text | left | |
| Customer | `customerName` | text | left | |
| Amount Due | `dueAmount` | currency | right | ✓ |
| Collected | `receivedAmount` | currency | right | ✓ |
| Pending | `pending` | currency | right | ✓ |
| Mode | `paymentMode` | badge | center | |
| Time | `submittedAt` | time | center | |

`pending = dueAmount − receivedAmount`.

## 4. KPI cards
Total collected · Total expected · Entry count · Efficiency % (reuse existing payload fields).

## 5. Filters
Date (single `date`, default today), Branch, Agent, Collection Mode.

## 6. API contract
**Existing:** `GET /api/v1/reports/daily?date=YYYY-MM-DD` → already returns totalCollected, totalExpected,
entryCount, collections, entries. **Wrap:** add a thin adapter to emit `ReportPayload` (columns+rows+totals)
without changing the existing response consumers — additive shape only.

## 7. Aggregation
Reuse the existing route logic (no change). Adapter maps `entries[]` → `rows`, computes `pending`, packs
columns. Scope already enforced (`tenantId, appType`, branch via context).

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print. Filename `daily-collection-<date>`.

## 9. i18n keys
`reports.dailyCollection.title`, `reports.col.agent|customer|amountDue|collected|pending|mode|time`.

## 10. RBAC + subscription
Agent sees own; admin sees branch/tenant. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
No change to the existing endpoint's queries or write paths. Adapter is read-only and additive.

## 12. No-hardcode checklist
- [ ] Mode list from distinct `paymentMode`.
- [ ] Currency/labels from DB/i18n.

## 13. Test plan
Seed a day of entries → existing endpoint unchanged; adapter payload totals == endpoint totals == export totals.
